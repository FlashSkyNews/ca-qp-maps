export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;

		// Handle map tile requests - return 204 for missing tiles instead of 404
		const tilePattern = /^\/maps\/[^/]+\/tiles\//;
		if (tilePattern.test(path)) {
			// Try to fetch the requested file first
			let response = await env.ASSETS.fetch(request);
			
			// If file not found and it's not already a .gz request, try .gz version
			if (response.status === 404 && !path.endsWith('.gz')) {
				const gzUrl = new URL(url);
				gzUrl.pathname = path + '.gz';
				const gzRequest = new Request(gzUrl.toString(), request);
				response = await env.ASSETS.fetch(gzRequest);
				
				// If .gz file exists, serve it with proper Content-Encoding header
				if (response.status === 200) {
					const newResponse = new Response(response.body, response);
					newResponse.headers.set('Content-Encoding', 'gzip');
					// Preserve original content type
					if (response.headers.has('Content-Type')) {
						newResponse.headers.set('Content-Type', response.headers.get('Content-Type'));
					}
					// Ensure cache headers are set
					if (!newResponse.headers.has('Cache-Control')) {
						newResponse.headers.set('Cache-Control', 'public, max-age=86400');
					}
					return newResponse;
				}
			}
			
			// If still 404, return 200 OK with empty body instead of 404
			// This prevents BlueMap from treating it as an error and retrying
			// Use appropriate content-type based on file extension
			if (response.status === 404) {
				let contentType = 'application/octet-stream';
				if (path.endsWith('.png') || path.match(/\/tiles\/[^/]+\//)) {
					contentType = 'image/png'; // Low-res tiles are PNG
				} else if (path.endsWith('.prbm')) {
					contentType = 'application/octet-stream'; // High-res tiles are PRBM
				}
				
				return new Response(new Uint8Array(0), { 
					status: 200,
					headers: {
						'Content-Type': contentType,
						'Content-Length': '0',
						'Cache-Control': 'public, max-age=31536000, immutable',
						'X-Content-Type-Options': 'nosniff'
					}
				});
			}
			
			// Add cache headers to successful tile responses
			if (response.status === 200) {
				const newResponse = new Response(response.body, response);
				// Copy existing headers
				response.headers.forEach((value, key) => {
					newResponse.headers.set(key, value);
				});
				// Ensure cache headers are set
				if (!newResponse.headers.has('Cache-Control')) {
					newResponse.headers.set('Cache-Control', 'public, max-age=86400');
				}
				return newResponse;
			}
			
			return response;
		}

		// Handle textures.json and .prbm files - check for .gz versions
		// BlueMap stores these as .gz files but the web app requests them without .gz
		if (path.endsWith('/textures.json') || path.endsWith('.prbm')) {
			const gzUrl = new URL(url);
			gzUrl.pathname = path + '.gz';
			const gzRequest = new Request(gzUrl.toString(), request);
			const gzResponse = await env.ASSETS.fetch(gzRequest);
			
			if (gzResponse.status === 200) {
				const newResponse = new Response(gzResponse.body, gzResponse);
				newResponse.headers.set('Content-Encoding', 'gzip');
				// Set appropriate content type
				if (path.endsWith('.json')) {
					newResponse.headers.set('Content-Type', 'application/json');
				} else if (path.endsWith('.prbm')) {
					newResponse.headers.set('Content-Type', 'application/octet-stream');
				}
				// Cache static files aggressively
				if (!newResponse.headers.has('Cache-Control')) {
					newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
				}
				return newResponse;
			}
			
			// If .gz doesn't exist, try the original file
			const response = await env.ASSETS.fetch(request);
			if (response.status === 200 && !response.headers.has('Cache-Control')) {
				const newResponse = new Response(response.body, response);
				response.headers.forEach((value, key) => {
					newResponse.headers.set(key, value);
				});
				newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
				return newResponse;
			}
			return response;
		}

		// Handle live data files (players.json, markers.json) - cache aggressively for static maps
		// BlueMap polls these every second, but for static maps they never change
		if (path.match(/\/maps\/[^/]+\/live\/(players|markers)\.json$/)) {
			const response = await env.ASSETS.fetch(request);
			if (response.status === 200) {
				const newResponse = new Response(response.body, response);
				// Copy existing headers
				response.headers.forEach((value, key) => {
					newResponse.headers.set(key, value);
				});
				// Cache for 1 year - static map, data never changes
				newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
				newResponse.headers.set('Content-Type', 'application/json');
				return newResponse;
			}
			return response;
		}

		// For all other requests, add aggressive caching for static assets
		const response = await env.ASSETS.fetch(request);
		if (response.status === 200) {
			// Only add cache headers if not already present and it's a static asset
			if (!response.headers.has('Cache-Control')) {
				const newResponse = new Response(response.body, response);
				response.headers.forEach((value, key) => {
					newResponse.headers.set(key, value);
				});
				// Cache static assets for 1 year
				newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
				return newResponse;
			}
		}
		return response;
	}
};

