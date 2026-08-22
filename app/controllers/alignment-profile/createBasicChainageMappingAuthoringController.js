import {
	appendChainageSegment,
	createChainageMapping,
	mapIntrinsicToChainage,
} from "../../../src/aim-core/alignment/profile/ChainageMapping.js";

export class BasicChainageMappingAuthoringError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "BasicChainageMappingAuthoringError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) {
		throw new BasicChainageMappingAuthoringError(
			"INVALID_CHAINAGE_MAPPING",
			`${label} must be a non-empty string`
		);
	}
	return id;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") {
		throw new BasicChainageMappingAuthoringError(
			"INVALID_CHAINAGE_MAPPING",
			`${label} must be finite`
		);
	}
	const number = Number(value);
	if (!Number.isFinite(number)) {
		throw new BasicChainageMappingAuthoringError(
			"INVALID_CHAINAGE_MAPPING",
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
	if (!left || !right || typeof left !== "object" || typeof right !== "object") {
		return false;
	}
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	return leftKeys.length === rightKeys.length && leftKeys.every(
		(key, index) => key === rightKeys[index] && sameValue(left[key], right[key])
	);
}

function validateProjection(projection, expected) {
	if (
		!projection ||
		projection.alignmentId !== expected.alignmentId ||
		!sameValue(projection.revision, expected.revision) ||
		projection.cursor?.parameterKind !== "intrinsic-s" ||
		!Object.is(projection.cursor?.s, expected.s)
	) {
		throw new BasicChainageMappingAuthoringError(
			"PROFILE_READBACK_MISMATCH",
			"profile projection does not match the active Alignment context"
		);
	}
	return projection;
}

function profileStateMatches(snapshot, profileState) {
	return snapshot?.presence === "present" &&
		sameValue(snapshot.vertical, profileState.vertical) &&
		sameValue(snapshot.cant, profileState.cant) &&
		sameValue(snapshot.chainageMappings, profileState.chainageMappings);
}

function requireProfileState(profileState, alignmentId) {
	if (
		!profileState ||
		typeof profileState !== "object" ||
		Array.isArray(profileState) ||
		!Object.prototype.hasOwnProperty.call(profileState, "vertical") ||
		!Object.prototype.hasOwnProperty.call(profileState, "cant") ||
		!Array.isArray(profileState.chainageMappings) ||
		(profileState.vertical !== null &&
			profileState.vertical?.alignmentId !== alignmentId) ||
		(profileState.cant !== null && profileState.cant?.alignmentId !== alignmentId)
	) {
		throw new BasicChainageMappingAuthoringError(
			"INVALID_CHAINAGE_MAPPING",
			"a canonical profileState for the active Alignment is required"
		);
	}
	if (profileState.chainageMappings.length !== 0) {
		throw new BasicChainageMappingAuthoringError(
			"CHAINAGE_MAPPING_ALREADY_PRESENT",
			"the active Alignment already has a chainage mapping"
		);
	}
	return profileState;
}

export function createBasicChainageMappingAuthoringController({
	alignmentProfileApplicationService,
	projectionController,
} = {}) {
	if (
		typeof alignmentProfileApplicationService?.saveProfileState !== "function" ||
		typeof projectionController?.projectAt !== "function"
	) {
		throw new BasicChainageMappingAuthoringError(
			"INVALID_SERVICE",
			"chainage mapping authoring requires profile save and projection services"
		);
	}

	return Object.freeze({
		async submit({
			alignmentId,
			revision,
			s,
			profileState,
			mappingId,
			schemeId,
			schemeVersion,
			segmentId,
			startS,
			endS,
			startAddress,
			direction,
		} = {}) {
			const normalizedAlignmentId = requireId(alignmentId, "alignmentId");
			if (revision === undefined) {
				throw new BasicChainageMappingAuthoringError(
					"INVALID_CHAINAGE_MAPPING",
					"revision must be explicit"
				);
			}
			const cursorS = finite(s, "s");
			const numericDirection = Number(direction);
			if (numericDirection !== 1 && numericDirection !== -1) {
				throw new BasicChainageMappingAuthoringError(
					"INVALID_CHAINAGE_MAPPING",
					"direction must be numeric 1 or -1"
				);
			}
			const persisted = requireProfileState(profileState, normalizedAlignmentId);
			const context = { alignmentId: normalizedAlignmentId, revision, s: cursorS };
			validateProjection(await projectionController.projectAt(context), context);

			let mapping = createChainageMapping({
				id: requireId(mappingId, "mappingId"),
				alignmentId: normalizedAlignmentId,
				schemeId: requireId(schemeId, "schemeId"),
				schemeVersion: requireId(schemeVersion, "schemeVersion"),
			});
			mapping = appendChainageSegment(mapping, {
				id: requireId(segmentId, "segmentId"),
				startS: finite(startS, "startS"),
				endS: finite(endS, "endS"),
				startAddress: finite(startAddress, "startAddress"),
				direction: numericDirection,
			});
			const candidates = mapIntrinsicToChainage(mapping, { s: cursorS });
			const nextProfileState = {
				vertical: persisted.vertical,
				cant: persisted.cant,
				chainageMappings: [mapping],
			};

			let snapshot;
			try {
				snapshot = await alignmentProfileApplicationService.saveProfileState({
					alignmentId: normalizedAlignmentId,
					profileState: nextProfileState,
				});
			} catch (cause) {
				throw new BasicChainageMappingAuthoringError(
					"CHAINAGE_MAPPING_SAVE_FAILED",
					"chainage mapping was not saved",
					{ cause }
				);
			}
			if (!profileStateMatches(snapshot, nextProfileState)) {
				throw new BasicChainageMappingAuthoringError(
					"PROFILE_READBACK_MISMATCH",
					"saved chainage mapping does not match repository readback"
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
				candidates,
			});
		},
	});
}

export default createBasicChainageMappingAuthoringController;
