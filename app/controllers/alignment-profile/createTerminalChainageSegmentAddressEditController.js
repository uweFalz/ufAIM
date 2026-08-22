import {
	appendChainageSegment,
	createChainageMapping,
	mapChainageToIntrinsic,
	mapIntrinsicToChainage,
} from "../../../src/aim-core/alignment/profile/ChainageMapping.js";

export class TerminalChainageSegmentAddressEditError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "TerminalChainageSegmentAddressEditError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) throw new TerminalChainageSegmentAddressEditError(
		"INVALID_TERMINAL_CHAINAGE_ADDRESS_EDIT",
		`${label} must be a non-empty string`
	);
	return id;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") {
		throw new TerminalChainageSegmentAddressEditError(
			"INVALID_TERMINAL_CHAINAGE_ADDRESS_EDIT",
			`${label} must be finite`
		);
	}
	const number = Number(value);
	if (!Number.isFinite(number)) throw new TerminalChainageSegmentAddressEditError(
		"INVALID_TERMINAL_CHAINAGE_ADDRESS_EDIT",
		`${label} must be finite`
	);
	return number;
}

function sameValue(left, right) {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) &&
		Array.isArray(right) && left.length === right.length &&
		left.every((entry, index) => sameValue(entry, right[index]));
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
	) throw new TerminalChainageSegmentAddressEditError(
		"PROFILE_READBACK_MISMATCH",
		"profile projection does not match the active Alignment context"
	);
	return projection;
}

function requireTarget(profileState, alignmentId, mappingId, segmentId) {
	if (!profileState || typeof profileState !== "object" || Array.isArray(profileState) ||
		!Array.isArray(profileState.chainageMappings)) {
		throw new TerminalChainageSegmentAddressEditError(
			"INVALID_TERMINAL_CHAINAGE_ADDRESS_EDIT",
			"canonical profileState is required"
		);
	}
	const mappings = profileState.chainageMappings.filter((mapping) => mapping?.id === mappingId);
	if (mappings.length !== 1 || mappings[0].alignmentId !== alignmentId) {
		throw new TerminalChainageSegmentAddressEditError(
			"CHAINAGE_MAPPING_IDENTITY_MISMATCH",
			"the exact persisted chainage mapping identity is unavailable or duplicated"
		);
	}
	const mapping = mappings[0];
	const segments = mapping.segments?.filter((segment) => segment?.id === segmentId) ?? [];
	if (segments.length !== 1) throw new TerminalChainageSegmentAddressEditError(
		"CHAINAGE_SEGMENT_IDENTITY_MISMATCH",
		"the exact persisted chainage segment identity is unavailable or duplicated"
	);
	const segment = segments[0];
	if (!Object.is(segment, mapping.segments.at(-1))) throw new TerminalChainageSegmentAddressEditError(
		"CHAINAGE_SEGMENT_NOT_TERMINAL",
		"only the terminal chainage segment may be edited"
	);
	return { profileState, mapping, segment };
}

function rebuildMapping(mapping, target, startAddress) {
	let rebuilt = createChainageMapping({
		id: mapping.id,
		alignmentId: mapping.alignmentId,
		schemeId: mapping.schemeId,
		schemeVersion: mapping.schemeVersion,
	});
	const standardKeys = new Set([
		"contractVersion", "type", "id", "alignmentId", "schemeId", "schemeVersion",
		"longitudinalParameter", "addressQuantity", "unit", "segments",
	]);
	const extensions = Object.fromEntries(
		Object.entries(mapping).filter(([key]) => !standardKeys.has(key))
	);
	if (Object.keys(extensions).length > 0) rebuilt = Object.freeze({ ...rebuilt, ...extensions });
	for (const segment of mapping.segments) {
		rebuilt = appendChainageSegment(
			rebuilt,
			Object.is(segment, target) ? { ...segment, startAddress } : segment
		);
	}
	return rebuilt;
}

function snapshotMatches(snapshot, profileState) {
	return snapshot?.presence === "present" &&
		sameValue(snapshot.vertical, profileState.vertical) &&
		sameValue(snapshot.cant, profileState.cant) &&
		sameValue(snapshot.chainageMappings, profileState.chainageMappings);
}

export function createTerminalChainageSegmentAddressEditController({
	alignmentProfileApplicationService,
	projectionController,
} = {}) {
	if (typeof alignmentProfileApplicationService?.saveProfileState !== "function" ||
		typeof projectionController?.projectAt !== "function") {
		throw new TerminalChainageSegmentAddressEditError(
			"INVALID_SERVICE",
			"terminal chainage address editing requires profile save and projection services"
		);
	}

	return Object.freeze({
		async update({ alignmentId, revision, s, profileState, mappingId, segmentId, startAddress } = {}) {
			const normalizedAlignmentId = requireId(alignmentId, "alignmentId");
			if (revision === undefined) throw new TerminalChainageSegmentAddressEditError(
				"INVALID_TERMINAL_CHAINAGE_ADDRESS_EDIT", "revision must be explicit"
			);
			const cursorS = finite(s, "s");
			const normalizedMappingId = requireId(mappingId, "mappingId");
			const normalizedSegmentId = requireId(segmentId, "segmentId");
			const numericStartAddress = finite(startAddress, "startAddress");
			const persisted = requireTarget(
				profileState, normalizedAlignmentId, normalizedMappingId, normalizedSegmentId
			);
			if (Object.is(numericStartAddress, persisted.segment.startAddress)) {
				throw new TerminalChainageSegmentAddressEditError(
					"TERMINAL_CHAINAGE_ADDRESS_NO_CHANGE", "startAddress is unchanged"
				);
			}
			const context = { alignmentId: normalizedAlignmentId, revision, s: cursorS };
			validateProjection(await projectionController.projectAt(context), context);
			const mapping = rebuildMapping(persisted.mapping, persisted.segment, numericStartAddress);
			const forwardCandidates = mapIntrinsicToChainage(mapping, { s: cursorS });
			const inverseCandidates = mapChainageToIntrinsic(mapping, {
				address: numericStartAddress,
			});
			if (!inverseCandidates.some((candidate) => candidate.segmentId === normalizedSegmentId)) {
				throw new TerminalChainageSegmentAddressEditError(
					"CHAINAGE_SEGMENT_VALIDATION_FAILED",
					"canonical inverse mapping did not expose the edited terminal segment"
				);
			}
			const nextProfileState = {
				...persisted.profileState,
				vertical: persisted.profileState.vertical,
				cant: persisted.profileState.cant,
				chainageMappings: persisted.profileState.chainageMappings.map(
					(entry) => Object.is(entry, persisted.mapping) ? mapping : entry
				),
			};
			let snapshot;
			try {
				snapshot = await alignmentProfileApplicationService.saveProfileState({
					alignmentId: normalizedAlignmentId,
					profileState: nextProfileState,
				});
			} catch (cause) {
				throw new TerminalChainageSegmentAddressEditError(
					"TERMINAL_CHAINAGE_ADDRESS_SAVE_FAILED",
					"terminal chainage segment address was not saved",
					{ cause }
				);
			}
			if (!snapshotMatches(snapshot, nextProfileState)) throw new TerminalChainageSegmentAddressEditError(
				"PROFILE_READBACK_MISMATCH",
				"saved terminal chainage address does not match repository readback"
			);
			const savedContext = {
				alignmentId: normalizedAlignmentId,
				revision: snapshot.revision,
				s: cursorS,
			};
			const projection = validateProjection(
				await projectionController.projectAt(savedContext), savedContext
			);
			return Object.freeze({
				status: "saved", profileState: nextProfileState, snapshot, projection,
				mapping, forwardCandidates, inverseCandidates,
			});
		},
	});
}

export default createTerminalChainageSegmentAddressEditController;
