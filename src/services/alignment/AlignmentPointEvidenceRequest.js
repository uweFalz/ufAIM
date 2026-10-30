import {
	createPointObservationSet,
	cloneObservationJson,
	freezeObservationJson,
	observationJsonEqual,
} from "../../domain/observation/PointObservationSet.js";

export class AlignmentPointEvidenceRequestError extends TypeError {
	constructor(code, message) {
		super(message);
		this.name = "AlignmentPointEvidenceRequestError";
		this.code = code;
	}
}

function fail(code, message) {
	throw new AlignmentPointEvidenceRequestError(code, message);
}

/**
 * Bind source evidence to explicit solver roles without changing the source.
 * Every point is assigned exactly once. A prepared input may be roundtripped
 * through JSON and revalidated, but forged derived points are never trusted.
 */
export function preparePointObservationInput(input) {
	const copy = cloneObservationJson(input);
	if (!copy || typeof copy !== "object" || Array.isArray(copy)) fail("INVALID_POINT_INPUT", "pointObservationInput must be an object");
	const allowed = new Set(["observationSet", "assignments", "alignmentMetricContext", "points", "hardPoints"]);
	for (const key of Object.keys(copy)) if (!allowed.has(key)) fail("UNKNOWN_INPUT_FIELD", `unknown point observation input field: ${key}`);
	const observationSet = createPointObservationSet(copy.observationSet);
	const alignmentMetricContext = copy.alignmentMetricContext;
	// Do not use metricComparabilityConflict's same-ID shortcut here. No
	// conversion, context inference or independent per-point frame is supported.
	if (!observationJsonEqual(observationSet.metricContext, alignmentMetricContext)) {
		fail("INCOMPARABLE_METRIC_CONTEXT", "observations and alignment require the exact same complete planar metric declaration");
	}
	if (!Array.isArray(copy.assignments) || copy.assignments.length !== observationSet.points.length) {
		fail("INCOMPLETE_ASSIGNMENTS", "assignments must bind every observation point exactly once");
	}
	const byId = new Map(observationSet.points.map((point) => [point.id, point]));
	const assigned = new Set();
	const points = copy.assignments.map((assignment) => {
		if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) fail("INVALID_ASSIGNMENT", "each assignment must be a JSON object");
		const { pointId, target, tolerance, enforcement } = assignment;
		if (typeof pointId !== "string" || !byId.has(pointId)) fail("UNKNOWN_POINT", `assignment references an unknown observation point: ${String(pointId)}`);
		if (assigned.has(pointId)) fail("DUPLICATE_ASSIGNMENT", `duplicate point assignment: ${pointId}`);
		assigned.add(pointId);
		if (!Number.isFinite(target) || !Number.isFinite(tolerance) || tolerance <= 0 ||
			!["soft", "hard"].includes(enforcement)) {
			fail("INVALID_ASSIGNMENT", `point ${pointId} requires explicit finite target, positive tolerance, and soft/hard enforcement`);
		}
		const point = byId.get(pointId);
		return { name: pointId, x: point.x, y: point.y, target, tolerance, enforcement, kind: "external-observation", metricContext: alignmentMetricContext };
	});
	const hardPoints = points.filter((point) => point.enforcement === "hard").map((point) => ({ name: point.name }));
	for (const [key, derived] of [["points", points], ["hardPoints", hardPoints]]) {
		if (Object.hasOwn(copy, key) && !observationJsonEqual(copy[key], derived)) fail("FORGED_POINT_MAPPING", `${key} does not match the observation set and assignments`);
	}
	return freezeObservationJson({ observationSet, assignments: copy.assignments, alignmentMetricContext, points, hardPoints });
}
