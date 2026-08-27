import {
	appendRailOffsetElement,
	createRailPairCantConstructiveState,
	evaluateRailPairCantAt,
} from "../../../src/aim-core/alignment/profile/RailPairCantConstructiveState.js";

export class RailPairCantAdmissionError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "RailPairCantAdmissionError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

const fail = (code, message) => new RailPairCantAdmissionError(code, message);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function id(value, label) {
	const normalized = typeof value === "string" ? value.trim() : "";
	if (!normalized) throw fail("INVALID_RAIL_PAIR_ADMISSION", `${label} must be explicit`);
	return normalized;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") throw fail("INVALID_RAIL_PAIR_ADMISSION", `${label} must be finite`);
	const number = Number(value);
	if (!Number.isFinite(number)) throw fail("INVALID_RAIL_PAIR_ADMISSION", `${label} must be finite`);
	return number;
}

function sameValue(left, right) {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => sameValue(entry, right[index]));
	if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
	const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
	return leftKeys.length === rightKeys.length && leftKeys.every((key) => own(right, key) && sameValue(left[key], right[key]));
}

function requireProfileState(profileState, alignmentId) {
	if (!profileState || typeof profileState !== "object" || Array.isArray(profileState) || !own(profileState, "vertical") || !own(profileState, "cant") || !Array.isArray(profileState.chainageMappings)) {
		throw fail("RAIL_PAIR_PROFILE_STATE_UNAVAILABLE", "canonical profileState is required");
	}
	if (profileState.vertical !== null && profileState.vertical?.alignmentId !== alignmentId) throw fail("ALIGNMENT_ID_MISMATCH", "vertical state belongs to another Alignment");
	if (profileState.chainageMappings.some((mapping) => mapping?.alignmentId !== alignmentId)) throw fail("ALIGNMENT_ID_MISMATCH", "chainage state belongs to another Alignment");
	if (profileState.cant !== null) throw fail("CANT_STATE_ALREADY_PRESENT", "Cant state already exists; Rail-Pair admission cannot replace it");
	return profileState;
}

function projectionMatches(projection, { alignmentId, revision, s }) {
	return projection?.status === "projected" && projection.alignmentId === alignmentId && sameValue(projection.revision, revision) &&
		projection.cursor?.parameterKind === "intrinsic-s" && Object.is(projection.cursor.s, s);
}

export function createRailPairCantAdmissionController({ alignmentProfileApplicationService, projectionController } = {}) {
	if (typeof alignmentProfileApplicationService?.saveProfileState !== "function" || typeof projectionController?.projectAt !== "function") {
		throw fail("INVALID_SERVICE", "Rail-Pair admission requires profile save and projection services");
	}
	return Object.freeze({
		async admit(request = {}) {
			const alignmentId = id(request.alignmentId, "alignmentId");
			if (!own(request, "revision")) throw fail("INVALID_RAIL_PAIR_ADMISSION", "revision must be explicit");
			const s = finite(request.s, "s");
			const persisted = requireProfileState(request.profileState, alignmentId);
			const initialContext = { alignmentId, revision: request.revision, s };
			if (!projectionMatches(await projectionController.projectAt(initialContext), initialContext)) throw fail("PROFILE_READBACK_MISMATCH", "initial projection does not match the active context");
			if (request.admitCompleteConstruction !== true) throw fail("ADMISSION_CONFIRMATION_REQUIRED", "complete admitted construction must be explicitly confirmed");

			const startS = finite(request.coverageStartS, "coverageStartS");
			const endS = finite(request.coverageEndS, "coverageEndS");
			if (s < startS || s > endS) throw fail("CURSOR_OUTSIDE_COVERAGE", "active intrinsic cursor must lie inside admitted coverage");
			const leftRailId = id(request.leftRailId, "leftRailId");
			const rightRailId = id(request.rightRailId, "rightRailId");
			const anchorKind = id(request.anchorKind, "anchorKind");
			const anchorRule = {
				id: id(request.anchorRuleId, "anchorRuleId"),
				version: id(request.anchorRuleVersion, "anchorRuleVersion"),
				kind: anchorKind,
				provenance: { sourceId: id(request.anchorProvenanceSourceId, "anchorProvenanceSourceId") },
			};
			if (["left-reference", "right-reference"].includes(anchorKind)) anchorRule.railId = id(request.anchorRailId, "anchorRailId");
			if (anchorKind === "qualified-other") {
				anchorRule.leftLateralOffset = finite(request.anchorLeftLateralOffset, "anchorLeftLateralOffset");
				anchorRule.rightLateralOffset = finite(request.anchorRightLateralOffset, "anchorRightLateralOffset");
			}

			let cant;
			let railSide;
			let elementId;
			try {
				cant = createRailPairCantConstructiveState({
					id: id(request.cantStateId, "cantStateId"), alignmentId,
					coverage: { status: "complete", startS, endS, authority: "admitted-construction" },
					railPair: { leftRailId, rightRailId, separation: {
						kind: id(request.separationKind, "separationKind"),
						unit: id(request.separationUnit, "separationUnit"),
						value: finite(request.separationValue, "separationValue"),
						measurementDefinition: id(request.separationMeasurementDefinition, "separationMeasurementDefinition"),
						provenance: { sourceId: id(request.separationProvenanceSourceId, "separationProvenanceSourceId") },
					} },
					anchorRule,
				});
				railSide = id(request.railSide, "railSide");
				if (!["left", "right"].includes(railSide)) throw fail("RAIL_SIDE_REQUIRED", "railSide must explicitly be left or right");
				const type = id(request.lawType, "lawType");
				elementId = id(request.elementId, "elementId");
				const element = {
					id: elementId, railId: railSide === "left" ? leftRailId : rightRailId, type,
					startS: finite(request.elementStartS, "elementStartS"), endS: finite(request.elementEndS, "elementEndS"),
					startOffset: finite(request.startOffset, "startOffset"),
				};
				if (type === "linear-rail-offset") element.offsetRate = finite(request.offsetRate, "offsetRate");
				cant = appendRailOffsetElement(cant, element);
			} catch (cause) {
				if (cause instanceof RailPairCantAdmissionError) throw cause;
				throw new RailPairCantAdmissionError("INVALID_RAIL_PAIR_ADMISSION", "explicit Rail-Pair construction is invalid", { cause });
			}

			const nextProfileState = { ...persisted, vertical: persisted.vertical, cant, chainageMappings: persisted.chainageMappings };
			let snapshot;
			try { snapshot = await alignmentProfileApplicationService.saveProfileState({ alignmentId, profileState: nextProfileState }); }
			catch (cause) { throw new RailPairCantAdmissionError("RAIL_PAIR_ADMISSION_SAVE_FAILED", "Rail-Pair construction was not saved", { cause }); }
			if (snapshot?.presence !== "present" || !sameValue(snapshot.vertical, nextProfileState.vertical) || !sameValue(snapshot.cant, cant) || !sameValue(snapshot.chainageMappings, nextProfileState.chainageMappings)) {
				throw fail("PROFILE_READBACK_MISMATCH", "saved Rail-Pair construction does not match canonical readback");
			}
			const savedContext = { alignmentId, revision: snapshot.revision, s };
			const projection = await projectionController.projectAt(savedContext);
			if (!projectionMatches(projection, savedContext) || projection.cant?.representation !== "rail-pair" || projection.cant?.left?.railId !== leftRailId || projection.cant?.right?.railId !== rightRailId) {
				throw fail("PROFILE_READBACK_MISMATCH", "saved Rail-Pair projection is not synchronized");
			}
			return Object.freeze({ status: "saved", railSide, railId: railSide === "left" ? leftRailId : rightRailId, elementId, profileState: nextProfileState, snapshot, projection, cant, evaluation: evaluateRailPairCantAt(cant, { s }) });
		},
	});
}

export default createRailPairCantAdmissionController;
