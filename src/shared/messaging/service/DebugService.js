// src/shared/messaging/service/DebugService.js
//
// DebugService
//
// Minimal worker/window debug event bridge.
//
// Emits:
//   Debug.Log
//
// Payload:
//   {
//     scope,
//     level,
//     message,
//     meta,
//     ts
//   }

export function createDebugService({
	router,
	scope = "debug",
	enabled = true,
} = {}) {
	function emit(level, message, meta = null) {
		if (!enabled) return;

		router?.emitEvt?.("Debug.Log", {
			scope,
			level,
			message: String(message ?? ""),
			meta: meta ?? null,
			ts: Date.now(),
		});
	}

	function log(message, meta = null) {
		emit("log", message, meta);
	}

	function error(message, meta = null) {
		emit("error", message, meta);
	}

	return {
		log,
		error,
	};
}
