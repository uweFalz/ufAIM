/* sw-nocache.js – Dev-only Cache-Buster für alles (auch dynamic import) */

const NC_VER = Date.now();
const STAMP_KEY = 'nocache';

const MATCH_EXT = /\.(?:js|mjs|css|json|xml|gml|ifc|ifcxml|ifcjson|wasm|txt|csv|xlsx|html?)$/i;

self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (e) => {
	e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
	const req = event.request;

	if (req.method !== 'GET') return;

	let url;
	try {
		url = new URL(req.url);
	} catch {
		return;
	}

	const sameOrigin = self.location.origin === url.origin;

	const isInteresting =
		MATCH_EXT.test(url.pathname) ||
		req.destination === 'script' ||
		req.destination === 'style' ||
		req.destination === 'document' ||
		req.destination === 'worker' ||
		req.destination === 'sharedworker';

	if (!sameOrigin || !isInteresting) return;
	if (url.searchParams.has(STAMP_KEY)) return;

	url.searchParams.set(STAMP_KEY, String(NC_VER));

	event.respondWith((async () => {
		try {
			const res = await fetch(url.toString(), { cache: 'no-store' });

			const headers = new Headers(res.headers);
			headers.set('Cache-Control', 'no-store, max-age=0');
			headers.set('Pragma', 'no-cache');
			headers.set('Expires', '0');

			return new Response(res.body, {
				status: res.status,
				statusText: res.statusText,
				headers,
			});
		} catch (err) {
			console.warn('[sw-nocache] stamped fetch failed, fallback to original request', req.url, err);
			return fetch(req);
		}
	})());
});
