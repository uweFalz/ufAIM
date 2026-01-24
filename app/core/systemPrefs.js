// app/core/systemPrefs.js
//
// Central runtime prefs (DEV vs PROD).
// Keep it tiny + stable; expand only when needed.

export function makeSystemPrefs() {
	const isDev = (location.hostname === "localhost" || location.hostname === "127.0.0.1");

	return {
		isDev,

		debug: {
			emitImportPropsEffects: isDev,
		},

		view: {
			onGeomChange: "softfitanimated", // MS13.2b (smooth zoom, no target-jump)
			fitPadding: 1.35,
			fitDurationMs: 240,              // MS13.2b default anim duration
			autoFitOnGeomChange: false,
		}
	};
}
