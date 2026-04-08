// app/bootstrap/registerDevNoCacheSW.js
//
// DEV-only registration for sw-nocache.js
//
// Goal:
// - keep service-worker registration out of index.html
// - control it via systemPrefs
// - make it easy to disable during debugging

export async function registerDevNoCacheSW({
	enabled = true,
	swUrl = "./sw-nocache.js",
} = {}) {
	const isDev =
		location.hostname === "localhost" ||
		location.hostname === "127.0.0.1";

	if (!isDev) {
		return { ok: true, skipped: "not-dev" };
	}

	if (!enabled) {
		console.log("[registerDevNoCacheSW] skipped by config");
		return { ok: true, skipped: "disabled" };
	}

	if (!("serviceWorker" in navigator)) {
		console.warn("[registerDevNoCacheSW] serviceWorker not supported");
		return { ok: false, skipped: "unsupported" };
	}

	try {
		const registration = await navigator.serviceWorker.register(swUrl);
		console.log("sw-nocache active (DEV) ✅");
		return { ok: true, registration };
	} catch (err) {
		console.warn("sw-nocache failed", err);
		return { ok: false, error: err };
	}
}
