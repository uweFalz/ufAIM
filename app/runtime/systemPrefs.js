// app/runtime/systemPrefs.js

function resolveWorkerUrl() {
	// SharedWorker must use exactly the same URL in every window
	return "/src/shared/messaging/SharedMessagingWorker.bootstrap.js?v=20260714";
}

function makeSystemPrefs() {
	const isDev =
		location.hostname === "localhost" ||
		location.hostname === "127.0.0.1";

	return {
		isDev,

		debug: {
			enabled: true,
			// Development has no offline contract. Keep registration disabled
			// unless a real no-cache worker is deliberately supplied.
			disableServiceWorker: true,
			workerEcho: true,
			importMirror: true,
			emitImportPropsEffects: isDev,
		},

	intro: {
		enabled: true,
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
			workerSmokeTimeoutMs: 5000,
			allowLocalFallback: false,
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

		intro: {
	enabled: Boolean(prefs.intro?.enabled),
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
			workerSmokeTimeoutMs: Number(prefs.runtime?.workerSmokeTimeoutMs ?? 5000),
			allowLocalFallback: Boolean(prefs.runtime?.allowLocalFallback ?? false),
		},
	};
}

export const systemPrefs = normalizePrefs(makeSystemPrefs());
