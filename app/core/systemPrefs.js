// app/core/systemPrefs.js

function resolveWorkerUrl() {
  // SharedWorker muss in allen Fenstern exakt dieselbe URL haben
  return "/src/shared/messaging/SharedMessagingWorker.js";
}

function makeSystemPrefs() {
	const isDev = (location.hostname === "localhost" || location.hostname === "127.0.0.1");

	return {
		isDev,

		debug: {
			emitImportPropsEffects: isDev,
		},

		view: {
			onGeomChange: "softfit",
			fitPadding: 1.35,
			fitDurationMs: 240,
			cursorStepS: 10,
			showAuxTracks: true,
			auxTracksScope: "pinned",
			auxTracksMax: 12,
			autoFitOnGeomChange: false,
		},
		
		messaging: {
			mode: "sharedWorker",
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
