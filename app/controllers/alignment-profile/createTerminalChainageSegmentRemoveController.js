import {
	appendChainageSegment,
	createChainageMapping,
	mapChainageToIntrinsic,
	mapIntrinsicToChainage,
} from "../../../src/aim-core/alignment/profile/ChainageMapping.js";

export class TerminalChainageSegmentRemoveError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "TerminalChainageSegmentRemoveError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

const fail = (code, message) => new TerminalChainageSegmentRemoveError(code, message);

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) throw fail("INVALID_TERMINAL_CHAINAGE_REMOVE", `${label} must be a non-empty string`);
	return id;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") throw fail("INVALID_TERMINAL_CHAINAGE_REMOVE", `${label} must be finite`);
	const number = Number(value);
	if (!Number.isFinite(number)) throw fail("INVALID_TERMINAL_CHAINAGE_REMOVE", `${label} must be finite`);
	return number;
}

function sameValue(left, right) {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => sameValue(entry, right[index]));
	if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
	const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
	return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && sameValue(left[key], right[key]));
}

function validateProjection(projection, expected) {
	if (projection?.alignmentId !== expected.alignmentId || !sameValue(projection?.revision, expected.revision) || projection?.cursor?.parameterKind !== "intrinsic-s" || !Object.is(projection?.cursor?.s, expected.s)) {
		throw fail("PROFILE_READBACK_MISMATCH", "profile projection does not match the active Alignment context");
	}
	return projection;
}

function requireTarget(profileState, alignmentId, mappingId, segmentId) {
	if (!profileState || typeof profileState !== "object" || Array.isArray(profileState) || !Array.isArray(profileState.chainageMappings)) throw fail("INVALID_TERMINAL_CHAINAGE_REMOVE", "canonical profileState is required");
	const mappings = profileState.chainageMappings.filter((mapping) => mapping?.id === mappingId);
	if (mappings.length !== 1 || mappings[0].alignmentId !== alignmentId) throw fail("CHAINAGE_MAPPING_IDENTITY_MISMATCH", "the exact persisted chainage mapping identity is unavailable or duplicated");
	const mapping = mappings[0];
	const segments = mapping.segments?.filter((segment) => segment?.id === segmentId) ?? [];
	if (segments.length !== 1) throw fail("CHAINAGE_SEGMENT_IDENTITY_MISMATCH", "the exact persisted chainage segment identity is unavailable or duplicated");
	const segment = segments[0];
	if (!Object.is(segment, mapping.segments.at(-1))) throw fail("CHAINAGE_SEGMENT_NOT_TERMINAL", "only the terminal chainage segment may be removed");
	if (mapping.segments.length < 2) throw fail("CHAINAGE_SEGMENT_REMOVE_WOULD_EMPTY_MAPPING", "at least one prefix chainage segment must remain");
	return { profileState, mapping, segment };
}

function rebuildPrefix(mapping, target) {
	let rebuilt = createChainageMapping({ id: mapping.id, alignmentId: mapping.alignmentId, schemeId: mapping.schemeId, schemeVersion: mapping.schemeVersion });
	const standardKeys = new Set(["contractVersion", "type", "id", "alignmentId", "schemeId", "schemeVersion", "longitudinalParameter", "addressQuantity", "unit", "segments"]);
	const extensions = Object.fromEntries(Object.entries(mapping).filter(([key]) => !standardKeys.has(key)));
	if (Object.keys(extensions).length > 0) rebuilt = Object.freeze({ ...rebuilt, ...extensions });
	for (const segment of mapping.segments) {
		if (!Object.is(segment, target)) rebuilt = appendChainageSegment(rebuilt, segment);
	}
	return rebuilt;
}

function snapshotMatches(snapshot, profileState) {
	return snapshot?.presence === "present" && sameValue(snapshot.vertical, profileState.vertical) && sameValue(snapshot.cant, profileState.cant) && sameValue(snapshot.chainageMappings, profileState.chainageMappings);
}

export function createTerminalChainageSegmentRemoveController({ alignmentProfileApplicationService, projectionController } = {}) {
	if (typeof alignmentProfileApplicationService?.saveProfileState !== "function" || typeof projectionController?.projectAt !== "function") throw fail("INVALID_SERVICE", "terminal chainage removal requires profile save and projection services");
	return Object.freeze({
		async remove({ alignmentId, revision, s, profileState, mappingId, segmentId } = {}) {
			const normalizedAlignmentId = requireId(alignmentId, "alignmentId");
			if (revision === undefined) throw fail("INVALID_TERMINAL_CHAINAGE_REMOVE", "revision must be explicit");
			const cursorS = finite(s, "s"), normalizedMappingId = requireId(mappingId, "mappingId"), normalizedSegmentId = requireId(segmentId, "segmentId");
			const persisted = requireTarget(profileState, normalizedAlignmentId, normalizedMappingId, normalizedSegmentId);
			const context = { alignmentId: normalizedAlignmentId, revision, s: cursorS };
			validateProjection(await projectionController.projectAt(context), context);
			const mapping = rebuildPrefix(persisted.mapping, persisted.segment);
			const retained = mapping.segments.at(-1);
			const validationForward = mapIntrinsicToChainage(mapping, { s: retained.startS }).filter((candidate) => candidate.segmentId === retained.id);
			const validationInverse = validationForward.flatMap((candidate) => mapChainageToIntrinsic(mapping, { address: candidate.address }));
			if (!validationInverse.some((candidate) => candidate.segmentId === retained.id && Object.is(candidate.s, retained.startS))) throw fail("CHAINAGE_MAPPING_VALIDATION_FAILED", "canonical mapping did not expose the retained prefix segment");
			const forwardCandidates = mapIntrinsicToChainage(mapping, { s: cursorS });
			const nextProfileState = { ...persisted.profileState, vertical: persisted.profileState.vertical, cant: persisted.profileState.cant, chainageMappings: persisted.profileState.chainageMappings.map((entry) => Object.is(entry, persisted.mapping) ? mapping : entry) };
			let snapshot;
			try { snapshot = await alignmentProfileApplicationService.saveProfileState({ alignmentId: normalizedAlignmentId, profileState: nextProfileState }); }
			catch (cause) { throw new TerminalChainageSegmentRemoveError("TERMINAL_CHAINAGE_REMOVE_SAVE_FAILED", "terminal chainage segment was not removed", { cause }); }
			if (!snapshotMatches(snapshot, nextProfileState)) throw fail("PROFILE_READBACK_MISMATCH", "removed terminal chainage segment does not match repository readback");
			const savedContext = { alignmentId: normalizedAlignmentId, revision: snapshot.revision, s: cursorS };
			const projection = validateProjection(await projectionController.projectAt(savedContext), savedContext);
			return Object.freeze({ status: "removed", profileState: nextProfileState, snapshot, projection, mapping, forwardCandidates, validationForward, validationInverse });
		},
	});
}

export default createTerminalChainageSegmentRemoveController;
