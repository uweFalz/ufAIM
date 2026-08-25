import {
	assertRailPairCantConstructiveState,
	evaluateRailPairCantAt,
} from "./RailPairCantConstructiveState.js";

export const RAIL_PAIR_REALIZATION_VERSION =
	"aim-core/rail-pair-realization/0.1";

export class RailPairRealizationError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "RailPairRealizationError";
		this.code = code;
	}
}

function fail(code, message) {
	throw new RailPairRealizationError(code, message);
}

function finitePoint(value) {
	return value && [value.x, value.y, value.z].every((entry) => typeof entry === "number" && Number.isFinite(entry));
}

function dot(a, b) {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}

function norm(value) {
	return Math.sqrt(dot(value, value));
}

function qualifiedFrame(referenceFrame) {
	if (!referenceFrame || !finitePoint(referenceFrame.origin) ||
		!finitePoint(referenceFrame.lateral) || !finitePoint(referenceFrame.vertical)) return false;
	return Math.abs(norm(referenceFrame.lateral) - 1) <= 1e-9 &&
		Math.abs(norm(referenceFrame.vertical) - 1) <= 1e-9 &&
		Math.abs(dot(referenceFrame.lateral, referenceFrame.vertical)) <= 1e-9 &&
		typeof referenceFrame.contextId === "string" && referenceFrame.contextId.length > 0;
}

function add(origin, lateral, lateralOffset, vertical, verticalOffset) {
	return Object.freeze({
		x: origin.x + lateralOffset * lateral.x + verticalOffset * vertical.x,
		y: origin.y + lateralOffset * lateral.y + verticalOffset * vertical.y,
		z: origin.z + lateralOffset * lateral.z + verticalOffset * vertical.z,
	});
}
function lateralOffsets(rule, separation) {
	if (rule.kind === "midpoint") return [-separation / 2, separation / 2];
	if (rule.kind === "left-reference") return [0, separation];
	if (rule.kind === "right-reference") return [-separation, 0];
	if (rule.kind === "qualified-other") {
		if (Math.abs((rule.rightLateralOffset - rule.leftLateralOffset) - separation) > 1e-9) {
			fail("ANCHOR_SEPARATION_MISMATCH", "qualified anchor offsets do not match separation");
		}
		return [rule.leftLateralOffset, rule.rightLateralOffset];
	}
	fail("ANCHOR_RULE_UNSUPPORTED", "unsupported cross-section anchor rule");
}

export function realizeRailPairAt({ state, s, referenceFrame } = {}) {
	assertRailPairCantConstructiveState(state, "realizeRailPairAt state");
	if (!qualifiedFrame(referenceFrame)) fail("REFERENCE_FRAME_INVALID", "qualified orthonormal profile reference frame is required");
	const cant = evaluateRailPairCantAt(state, { s });
	if (cant.status !== "known") fail("CANT_UNKNOWN", "rail offsets are not known at s");
	const separation = state.railPair.separation.value;
	const [leftLateral, rightLateral] = lateralOffsets(state.anchorRule, separation);
	const left = add(referenceFrame.origin, referenceFrame.lateral, leftLateral, referenceFrame.vertical, cant.left.offset);
	const right = add(referenceFrame.origin, referenceFrame.lateral, rightLateral, referenceFrame.vertical, cant.right.offset);
	const midpoint = Object.freeze({
		x: 0.5 * (left.x + right.x),
		y: 0.5 * (left.y + right.y),
		z: 0.5 * (left.z + right.z),
	});
	return Object.freeze({
		contractVersion: RAIL_PAIR_REALIZATION_VERSION,
		status: "realized",
		alignmentId: state.alignmentId,
		s,
		contextId: referenceFrame.contextId,
		leftRail: Object.freeze({ railId: state.railPair.leftRailId, point: left, offset: cant.left.offset }),
		rightRail: Object.freeze({ railId: state.railPair.rightRailId, point: right, offset: cant.right.offset }),
		midpoint,
		crossLevel: cant.crossLevel,
		commonOffset: cant.commonOffset,
		roll: Math.atan2(cant.crossLevel, separation),
		separation: state.railPair.separation,
		anchorRule: state.anchorRule,
		provenance: Object.freeze({
			cantStateId: state.id,
			anchorRuleId: state.anchorRule.id,
			separationSourceId: state.railPair.separation.provenance.sourceId,
		}),
	});
}
