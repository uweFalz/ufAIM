/* sw-nocache.js – Dev-only Cache-Buster für alles (auch dynamic import) */

const NC_VER = Date.now(); // bei jedem Reload neu installieren = neue Version
const STAMP_KEY = 'nocache';

const MATCH_EXT = /\.(?:js|mjs|css|json|xml|gml|ifc|ifcxml|ifcjson|wasm|txt|csv|xlsx|html?)$/i;

self.addEventListener('install', (e) => {
	// sofort aktiv werden
	self.skipWaiting();
});

self.addEventListener('activate', (e) => {
	// alte SWs weg – sofort kontrollieren
	e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
	const req = event.request;

	// Nur GET und gleiche Origin behandeln
	if (req.method !== 'GET') return;

	let url;
	try { url = new URL(req.url); } catch { return; }

	// Nur eigene Origin/no-cors ignorieren wir nicht – dynamic import nutzt gleiche Origin
	const sameOrigin = self.location.origin === url.origin;

	// Welche Ressourcen stempeln? Alles mit passender Endung + module scripts + styles
	const isInteresting =
	MATCH_EXT.test(url.pathname) ||
	req.destination === 'script' ||
	req.destination === 'style' ||
	req.destination === 'document' ||
	req.destination === 'worker' ||
	req.destination === 'sharedworker';

	if (!sameOrigin || !isInteresting) return;

	// Schon gestempelt? Dann nix tun
	if (url.searchParams.has(STAMP_KEY)) return;

	// Neuen Request mit Zeitstempel erzeugen
	url.searchParams.set(STAMP_KEY, NC_VER.toString());

	const bustReq = new Request(url.toString(), {
		method: req.method,
		headers: req.headers,
		mode: req.mode,
		credentials: req.credentials,
		cache: 'no-store',
		redirect: req.redirect,
		referrer: req.referrer,
		referrerPolicy: req.referrerPolicy,
		integrity: req.integrity,
		destination: req.destination,
	});

	event.respondWith(
	fetch(bustReq).then((res) => {
		// Antwort ohne Caching zurückgeben
		const headers = new Headers(res.headers);
		headers.set('Cache-Control', 'no-store, max-age=0');
		headers.set('Pragma', 'no-cache');
		headers.set('Expires', '0');
		return new Response(res.body, {
			status: res.status,
			statusText: res.statusText,
			headers,
		});
	}).catch(() => fetch(req)) // Fallback, falls was schief geht
	);
});
