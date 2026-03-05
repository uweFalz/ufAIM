// app/core/systemPrefs.js
//
// Central runtime prefs (DEV vs PROD).
// Keep it tiny + stable; expand only when needed.

function resolveWorkerUrl() {
  // index.html jetzt im Root:
  const base = "./src/shared/messaging/SharedMessagingWorker.js";

  // DEV: erzwinge neue Worker-Instanz pro Reload (URL ändert sich)
  const isDev = (location.hostname === "localhost" || location.hostname === "127.0.0.1");
  if (isDev) return `${base}?v=${Date.now()}`;

  return base;
}

function makeSystemPrefs() {
	const isDev = (location.hostname === "localhost" || location.hostname === "127.0.0.1");

	return {
		isDev,

		debug: {
			emitImportPropsEffects: isDev,
		},

		view: {
			onGeomChange: "softfit",          // MS13.2 (ohne target-jump)
			// onGeomChange: "softfitanimated", // MS13.2b (smooth zoom)
			fitPadding: 1.35,
			fitDurationMs: 240,              // MS13.2b default anim duration
			cursorStepS: 10,                 // MS13.8: +/- step (meters)

			// MS13.9: show background tracks (other alignments) alongside the active one
			showAuxTracks: true,
			auxTracksScope: "pinned",        // "active" | "all" | "routeProject" | "pinned"
			auxTracksMax: 12,
			autoFitOnGeomChange: false,
		},
		
		messaging: {
			mode: "sharedWorker",              // "local" | "sharedWorker"
			workerUrl: resolveWorkerUrl(),
			debug: true,
			workerEcho: true,
		},
		
		runtime: {
			legacyAppCore: true,
		},
	};
}

export const systemPrefs = makeSystemPrefs();
