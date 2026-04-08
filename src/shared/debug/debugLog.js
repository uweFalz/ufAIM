// src/shared/debug/debugLog.js
//
// Debug-Minimum v0
//
// Single shared debug output helper.
// Use this instead of console.debug.
//
// Rule:
// - console.debug is forbidden
// - prefer debugLog(scope, message, meta)

export function debugLog(scope, message, meta = null) {
	const prefix = `[${String(scope ?? "debug")}] ${String(message ?? "")}`;

	if (meta == null) {
		console.log(prefix);
		return;
	}

	console.log(prefix, meta);
}

export function debugError(scope, message, meta = null) {
	const prefix = `[${String(scope ?? "debug")}] ${String(message ?? "")}`;

	if (meta == null) {
		console.error(prefix);
		return;
	}

	console.error(prefix, meta);
}
