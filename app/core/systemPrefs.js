// app/core/systemPrefs.js
//
// Central runtime prefs (DEV vs PROD).
// Keep it tiny + stable; expand only when needed.

export function makeSystemPrefs() {
	const isDev = (location.hostname === "localhost" || location.hostname === "127.0.0.1");

	return {
		isDev,

		debug: {
			// MS10.4: Should importApply emit "props" effects at all?
			// DEV: yes (handy), PROD: no (quiet).
			emitImportPropsEffects: isDev,
		},
	};
}
