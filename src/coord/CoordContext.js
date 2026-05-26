// src/coord/CoordContext.js
//
// Canonical coordinate / metric context descriptor.
//
// Role:
// - describe the metric/spatial context an object lives in
// - no projection math
// - no proj4
// - no rendering
// - no CRS guessing side effects

export function makeCoordContext({
	id,
	crsId = null,
	status = "unknown",
	family = "unknown",
	label = null,
	source = null,
	raw = {},
} = {}) {
	const contextId = normalizeContextId(id ?? crsId);

	return {
		id: contextId,
		crsId: crsId ?? contextId,
		status,
		family,
		label: label ?? crsId ?? contextId,
		source,
		raw: isObject(raw) ? { ...raw } : {},
	};
}

export function normalizeContextId(value) {
	const s = String(value ?? "").trim();
	if (!s) return "ctx:unknown";
	return s.startsWith("ctx:") ? s : `ctx:${s}`;
}

export function isCoordContext(value) {
	return (
		isObject(value) &&
		typeof value.id === "string" &&
		value.id.length > 0
	);
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
