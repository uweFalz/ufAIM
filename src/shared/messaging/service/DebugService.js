// src/shared/messaging/service/DebugService.js

export function createDebugService({ router, scope = "worker", enabled = true } = {}) {
	function emit(level, ...args) {
		if (!enabled) return;

		router?.broadcastEvt?.("Debug.Log", {
			scope,
			level,
			args,
			ts: Date.now(),
		});
	}

	return {
		log(...args) {
			emit("log", ...args);
		},

		warn(...args) {
			emit("warn", ...args);
		},

		error(...args) {
			emit("error", ...args);
		},
	};
}
