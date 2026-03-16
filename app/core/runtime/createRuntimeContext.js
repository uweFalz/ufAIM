// app/core/runtime/createRuntimeContext.js
//
// Small mutable runtime context for the window client.
// It is created once in bootWindowApp/bootLegacyAppCore and then enriched
// step by step during startup.

export function createRuntimeContext(seed = {}) {
	return {
		prefs: seed.prefs ?? null,
		messaging: seed.messaging ?? null,

		store: seed.store ?? null,
		windowSessionState: seed.windowSessionState ?? null,
		windowSession: seed.windowSession ?? null,
		focusManager: seed.focusManager ?? null,

		ui: seed.ui ?? null,
		threeA: seed.threeA ?? null,
		transV: seed.transV ?? null,

		logElement: seed.logElement ?? null,
		statusElement: seed.statusElement ?? null,
		propsElement: seed.propsElement ?? null,
		logLine: seed.logLine ?? null,
	};
}
