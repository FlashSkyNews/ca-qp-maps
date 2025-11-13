// Custom script to fix BlueMap behavior for static maps
// This overrides fetch behavior to handle missing tiles and disable live polling

(function() {
	'use strict';
	
	// Store original fetch
	const originalFetch = window.fetch;
	
	// Override fetch to intercept BlueMap requests
	window.fetch = function(...args) {
		const url = args[0];
		const options = args[1] || {};
		
		// Check if this is a BlueMap request
		if (typeof url === 'string' && url.includes('/maps/')) {
			// For live data files, add cache control to prevent polling
			if (url.includes('/live/players.json') || url.includes('/live/markers.json')) {
				// Add cache: 'force-cache' to prevent network requests
				options.cache = 'force-cache';
			}
			
			// For tile requests, handle 404s gracefully
			if (url.includes('/tiles/')) {
				return originalFetch.apply(this, args).then(response => {
					// If 404, return empty response with 200 status
					if (response.status === 404) {
						const contentType = url.endsWith('.png') ? 'image/png' : 'application/octet-stream';
						return new Response(new Uint8Array(0), {
							status: 200,
							headers: {
								'Content-Type': contentType,
								'Content-Length': '0'
							}
						});
					}
					return response;
				}).catch(() => {
					// On error, return empty response
					const contentType = url.endsWith('.png') ? 'image/png' : 'application/octet-stream';
					return new Response(new Uint8Array(0), {
						status: 200,
						headers: {
							'Content-Type': contentType,
							'Content-Length': '0'
						}
					});
				});
			}
		}
		
		// For all other requests, use original fetch
		return originalFetch.apply(this, args);
	};
	
	// Override XMLHttpRequest for older code paths
	const originalXHROpen = XMLHttpRequest.prototype.open;
	const originalXHRSend = XMLHttpRequest.prototype.send;
	
	XMLHttpRequest.prototype.open = function(method, url, ...rest) {
		this._bluemapUrl = url;
		return originalXHROpen.apply(this, [method, url, ...rest]);
	};
	
	XMLHttpRequest.prototype.send = function(...args) {
		if (this._bluemapUrl && typeof this._bluemapUrl === 'string') {
			// Intercept live data requests
			if (this._bluemapUrl.includes('/live/players.json') || 
			    this._bluemapUrl.includes('/live/markers.json')) {
				// Override onload to return cached empty response
				this.addEventListener('load', function() {
					if (this.status === 404 || this.status === 0) {
						Object.defineProperty(this, 'status', { value: 200, writable: false });
						Object.defineProperty(this, 'responseText', { value: '{}', writable: false });
						Object.defineProperty(this, 'response', { value: '{}', writable: false });
						if (this.onload) this.onload();
					}
				}, { once: true });
			}
		}
		return originalXHRSend.apply(this, args);
	};
	
	console.log('BlueMap static map fixes applied');
})();

