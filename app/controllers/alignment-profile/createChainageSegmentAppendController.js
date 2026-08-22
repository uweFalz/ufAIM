import {
	appendChainageSegment,
	mapChainageToIntrinsic,
	mapIntrinsicToChainage,
} from "../../../src/aim-core/alignment/profile/ChainageMapping.js";

export class ChainageSegmentAppendError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "ChainageSegmentAppendError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) {
		throw new ChainageSegmentAppendError(
			"INVALID_CHAINAGE_SEGMENT",
			`${label} must be a non-empty string`
		);
	}
	return id;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") {
		throw new ChainageSegmentAppendError(
			"INVALID_CHAINAGE_SEGMENT",
			`${label} must be finite`
		);
	}
	const number = Number(value);
	if (!Number.isFinite(number)) {
		throw new ChainageSegmentAppendError(
			"INVALID_CHAINAGE_SEGMENT",
			`${label} must be finite`
		);
	}
	return number;
}

function sameValue(left, right) {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		return Array.isArray(left) && Array.isArray(right) &&
			left.length === right.length &&
			left.every((entry, index) => sameValue(entry, right[index]));
	}
	if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	return leftKeys.length === rightKeys.length && leftKeys.every(
		(key, index) => key === rightKeys[index] && sameValue(left[key], right[key])
	);
}

function validateProjection(projection, expected) {
	if (
		projection?.alignmentId !== expected.alignmentId ||
		!sameValue(projection?.revision, expected.revision) ||
		projection?.cursor?.parameterKind !== "intrinsic-s" ||
		!Object.is(projection?.cursor?.s, expected.s)
	) {
		throw new ChainageSegmentAppendError(
			"PROFILE_READBACK_MISMATCH",
			"profile projection does not match the active Alignment context"
		);
	}
	return projection;
}

function requireProfileState(profileState, alignmentId, mappingId) {
	if (
		!profileState ||
		typeof profileState !== "object" ||
		Array.isArray(profileState) ||
		!Array.isArray(profileState.chainageMappings)
	) {
		throw new ChainageSegmentAppendError(
			"INVALID_CHAINAGE_SEGMENT",
			"canonical profileState is required"
		);
	}
	const matches = profileState.chainageMappings.filter(
		(mapping) => mapping?.id === mappingId
	);
	if (matches.length !== 1 || matches[0].alignmentId !== alignmentId) {
		throw new ChainageSegmentAppendError(
			"CHAINAGE_MAPPING_IDENTITY_MISMATCH",
			"the exact persisted chainage mapping identity is unavailable or duplicated"
		);
	}
	return { profileState, mapping: matches[0] };
}

function snapshotMatches(snapshot, profileState) {
	return snapshot?.presence === "present" &&
		sameValue(snapshot.vertical, profileState.vertical) &&
		sameValue(snapshot.cant, profileState.cant) &&
		sameValue(snapshot.chainageMappings, profileState.chainageMappings);
}

export function createChainageSegmentAppendController({
	alignmentProfileApplicationService,
	projectionController,
} = {}) {
	if (
		typeof alignmentProfileApplicationService?.saveProfileState !== "function" ||
		typeof projectionController?.projectAt !== "function"
	) {
		throw new ChainageSegmentAppendError(
			"INVALID_SERVICE",
			"chainage segment append requires profile save and projection services"
		);
	}

	return Object.freeze({
		async append({
			alignmentId,
			revision,
			s,
			profileState,
			mappingId,
			segmentId,
			startS,
			endS,
			startAddress,
			direction,
		} = {}) {
			const normalizedAlignmentId = requireId(alignmentId, "alignmentId");
			if (revision === undefined) {
				throw new ChainageSegmentAppendError(
					"INVALID_CHAINAGE_SEGMENT",
					"revision must be explicit"
				);
			}
			const cursorS = finite(s, "s");
			const normalizedMappingId = requireId(mappingId, "mappingId");
			const normalizedSegmentId = requireId(segmentId, "segmentId");
			const numericStartS = finite(startS, "startS");
			const numericEndS = finite(endS, "endS");
			const numericStartAddress = finite(startAddress, "startAddress");
			const numericDirection = Number(direction);
			if (numericDirection !== 1 && numericDirection !== -1) {
				throw new ChainageSegmentAppendError(
					"INVALID_CHAINAGE_SEGMENT",
					"direction must be numeric 1 or -1"
				);
			}
			const persisted = requireProfileState(
				profileState,
				normalizedAlignmentId,
				normalizedMappingId
			);
			if (persisted.mapping.segments.some((segment) => segment?.id === normalizedSegmentId)) {
				throw new ChainageSegmentAppendError(
					"CHAINAGE_SEGMENT_ALREADY_PRESENT",
					"the chainage segment identity already exists"
				);
			}
			const context = { alignmentId: normalizedAlignmentId, revision, s: cursorS };
			validateProjection(await projectionController.projectAt(context), context);
			const mapping = appendChainageSegment(persisted.mapping, {
				id: normalizedSegmentId,
				startS: numericStartS,
				endS: numericEndS,
				startAddress: numericStartAddress,
				direction: numericDirection,
			});
			const forwardCandidates = mapIntrinsicToChainage(mapping, { s: cursorS });
			const inverseCandidates = mapChainageToIntrinsic(mapping, {
				address: numericStartAddress,
			});
			if (!inverseCandidates.some((candidate) => candidate.segmentId === normalizedSegmentId)) {
				throw new ChainageSegmentAppendError(
					"CHAINAGE_SEGMENT_VALIDATION_FAILED",
					"canonical inverse mapping did not expose the appended segment"
				);
			}
			const chainageMappings = persisted.profileState.chainageMappings.map(
				(entry) => Object.is(entry, persisted.mapping) ? mapping : entry
			);
			const nextProfileState = {
				...persisted.profileState,
				vertical: persisted.profileState.vertical,
				cant: persisted.profileState.cant,
				chainageMappings,
			};
			let snapshot;
			try {
				snapshot = await alignmentProfileApplicationService.saveProfileState({
					alignmentId: normalizedAlignmentId,
					profileState: nextProfileState,
				});
			} catch (cause) {
				throw new ChainageSegmentAppendError(
					"CHAINAGE_SEGMENT_SAVE_FAILED",
					"chainage segment was not saved",
					{ cause }
				);
			}
			if (!snapshotMatches(snapshot, nextProfileState)) {
				throw new ChainageSegmentAppendError(
					"PROFILE_READBACK_MISMATCH",
					"saved chainage segment does not match repository readback"
				);
			}
			const savedContext = {
				alignmentId: normalizedAlignmentId,
				revision: snapshot.revision,
				s: cursorS,
			};
			const projection = validateProjection(
				await projectionController.projectAt(savedContext),
				savedContext
			);
			return Object.freeze({
				status: "saved",
				profileState: nextProfileState,
				snapshot,
				projection,
				mapping,
				forwardCandidates,
				inverseCandidates,
			});
		},
	});
}

export default createChainageSegmentAppendController;
