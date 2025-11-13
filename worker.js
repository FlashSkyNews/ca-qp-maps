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
					return newResponse;
				}
			}
			
			// If still 404, return 204 (No Content) instead of 404
			if (response.status === 404) {
				return new Response(null, { status: 204 });
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
				return newResponse;
			}
			
			// If .gz doesn't exist, try the original file
			return env.ASSETS.fetch(request);
		}

		// For all other requests, serve normally
		return env.ASSETS.fetch(request);
	}
};

