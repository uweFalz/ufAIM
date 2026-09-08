export class AlignmentChangeProfileRefreshBridgeError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "AlignmentChangeProfileRefreshBridgeError";
		this.code = code;
	}
}

const fail = (code, message) => new AlignmentChangeProfileRefreshBridgeError(code, message);
const cleanId = (value) => typeof value === "string" ? value.trim() : "";

function activeContext(store) {
	const state = store.getState();
	return {
		alignmentId: cleanId(state?.workspace_selection?.primaryId),
		s: Number(state?.cursor?.s),
	};
}

function requireEvent(event, current) {
	const detail = event?.detail;
	if (!detail || typeof detail.waitUntil !== "function") throw fail("CHANGE_WAIT_UNAVAILABLE", "productive Alignment change must expose waitUntil");
	const alignmentId = cleanId(detail.objectId);
	if (!alignmentId || alignmentId !== current.alignmentId) throw fail("CHANGE_ALIGNMENT_MISMATCH", "Alignment change does not target the exact active Alignment");
	if (detail.revision === null || detail.revision === undefined) throw fail("CHANGE_REVISION_REQUIRED", "verified Alignment change revision is required");
	if (!Number.isFinite(current.s)) throw fail("ACTIVE_CURSOR_INVALID", "active intrinsic cursor must be finite");
	return { detail, alignmentId, revision: detail.revision, s: current.s };
}

function requireProjection(projection, expected, store) {
	const current = activeContext(store);
	if (current.alignmentId !== expected.alignmentId || !Object.is(current.s, expected.s)) {
		throw fail("ACTIVE_CONTEXT_CHANGED", "active Alignment or intrinsic cursor changed during profile refresh");
	}
	if (projection?.status !== "projected" || projection.alignmentId !== expected.alignmentId || !Object.is(projection.revision, expected.revision) || projection?.cursor?.parameterKind !== "intrinsic-s" || !Object.is(projection.cursor.s, expected.s)) {
		throw fail("PROFILE_REFRESH_READBACK_MISMATCH", "profile projection does not match the verified horizontal change context");
	}
	return projection;
}

export function createAlignmentChangeProfileRefreshBridge({ store, profileSource, windowRef = globalThis.window } = {}) {
	if (typeof store?.getState !== "function" || typeof profileSource?.refresh !== "function" || typeof windowRef?.addEventListener !== "function" || typeof windowRef?.removeEventListener !== "function") {
		throw fail("INVALID_BRIDGE", "Alignment change profile refresh requires store, profile refresh, and event target");
	}
	let started = false;
	function refreshForChange(event) {
		const expected = requireEvent(event, activeContext(store));
		const operation = Promise.resolve()
			.then(() => profileSource.refresh())
			.then((projection) => requireProjection(
				projection ?? profileSource.getCurrentProjection?.(),
				expected,
				store
			));
		expected.detail.waitUntil(operation);
		return operation;
	}
	function onChange(event) {
		try { void refreshForChange(event).catch(() => {}); }
		catch { /* malformed or foreign changes are ignored fail-closed */ }
	}
	return Object.freeze({
		start() {
			if (started) return false;
			windowRef.addEventListener("ufaim:alignment-changed", onChange);
			started = true;
			return true;
		},
		stop() {
			if (!started) return false;
			windowRef.removeEventListener("ufaim:alignment-changed", onChange);
			started = false;
			return true;
		},
		refreshForChange,
	});
}

export default createAlignmentChangeProfileRefreshBridge;
