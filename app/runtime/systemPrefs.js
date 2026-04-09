// app/runtime/systemPrefs.js

function resolveWorkerUrl() {
	// SharedWorker must use exactly the same URL in every window
	return "/src/shared/messaging/SharedMessagingWorker.js";
}

function makeSystemPrefs() {
	const isDev =
		location.hostname === "localhost" ||
		location.hostname === "127.0.0.1";

	return {
		isDev,

		debug: {
			enabled: true,
			disableServiceWorker: false,
			workerEcho: true,
			importMirror: true,
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
			spotStateCacheMs: isDev ? 1000 : 300,
		},

		messaging: {
			mode: "sharedWorker",
			workerUrl: resolveWorkerUrl(),
			debug: true,
			workerEcho: true,
		},

		runtime: {
			legacyAppCore: true,
			runWorkerSmokeTest: true,
		},
	};
}

function normalizePrefs(raw = {}) {
	const prefs = raw ?? {};

	return {
		isDev: true, // Boolean(prefs.isDev),

		debug: {
			enabled: Boolean(prefs.debug?.enabled),
			disableServiceWorker: Boolean(prefs.debug?.disableServiceWorker),
			workerEcho: Boolean(prefs.debug?.workerEcho),
			importMirror: Boolean(prefs.debug?.importMirror),
			emitImportPropsEffects: Boolean(prefs.debug?.emitImportPropsEffects),
		},

		view: {
			onGeomChange: String(prefs.view?.onGeomChange ?? "softfit"),
			fitPadding: Number(prefs.view?.fitPadding ?? 1.35),
			fitDurationMs: Number(prefs.view?.fitDurationMs ?? 240),
			cursorStepS: Number(prefs.view?.cursorStepS ?? 10),
			showAuxTracks: Boolean(prefs.view?.showAuxTracks),
			auxTracksScope: String(prefs.view?.auxTracksScope ?? "pinned"),
			auxTracksMax: Number(prefs.view?.auxTracksMax ?? 12),
			autoFitOnGeomChange: Boolean(prefs.view?.autoFitOnGeomChange),
			spotStateCacheMs: Number(prefs.view?.spotStateCacheMs ?? 300),
		},

		messaging: {
			mode: String(prefs.messaging?.mode ?? "sharedWorker"),
			workerUrl: String(prefs.messaging?.workerUrl ?? resolveWorkerUrl()),
			debug: Boolean(prefs.messaging?.debug),
			workerEcho: Boolean(prefs.messaging?.workerEcho),
		},

		runtime: {
			legacyAppCore: Boolean(prefs.runtime?.legacyAppCore ?? true),
			runWorkerSmokeTest: Boolean(prefs.runtime?.runWorkerSmokeTest ?? true),
		},
	};
}

export const systemPrefs = normalizePrefs(makeSystemPrefs());
