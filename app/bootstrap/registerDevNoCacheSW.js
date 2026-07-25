// app/bootstrap/registerDevNoCacheSW.js
//
// DEV-only registration for sw-nocache.js
//
// Goal:
// - keep service-worker registration out of index.html
// - control it via systemPrefs
// - make it easy to disable during debugging

export async function registerDevNoCacheSW({
	enabled = false,
	swUrl = "./sw-nocache.js",
} = {}) {
	const isDev =
		location.hostname === "localhost" ||
		location.hostname === "127.0.0.1";

	if (!isDev) {
		return { ok: true, skipped: "not-dev" };
	}

	if (!enabled) {
		if (!("serviceWorker" in navigator)) {
			return { ok: true, skipped: "disabled-unsupported" };
		}
		try {
			const registrations = await navigator.serviceWorker.getRegistrations();
			const stale = registrations.filter((registration) => {
				const scriptURL = registration.active?.scriptURL
					?? registration.waiting?.scriptURL
					?? registration.installing?.scriptURL
					?? "";
				return new URL(scriptURL || swUrl, location.href).pathname.endsWith("/sw-nocache.js");
			});
			const removed = (await Promise.all(stale.map((registration) => registration.unregister())))
				.filter(Boolean).length;
			console.log(`[registerDevNoCacheSW] disabled; stale registrations removed: ${removed}`);
			return { ok: true, skipped: "disabled", removed };
		} catch (err) {
			console.warn("[registerDevNoCacheSW] stale-registration cleanup failed", err);
			return { ok: false, skipped: "disabled", error: err };
		}
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
