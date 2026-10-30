import { METRIC_CONTEXT_VERSION } from "../optimization/alignment/MetricContext.js";

export const POINT_OBSERVATION_SET_VERSION = "point-observation-set/1";

export class PointObservationSetError extends TypeError {
	constructor(code, message) {
		super(message);
		this.name = "PointObservationSetError";
		this.code = code;
	}
}

function fail(code, message) {
	throw new PointObservationSetError(code, message);
}

function record(value, path) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		fail("INVALID_RECORD", `${path} must be a JSON object`);
	}
	return value;
}

function text(value, path) {
	if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
		fail("INVALID_TEXT", `${path} must be an explicit, non-empty, unpadded string`);
	}
}

/**
 * Copy only losslessly JSON-roundtrippable data. Do not invoke getters/toJSON,
 * coerce numbers, silently drop undefined/extra array properties, or keep aliases
 * to the caller. Repeated references are copied; cycles are refused.
 */
export function cloneObservationJson(value, path = "input", ancestors = new Set()) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return value;
	if (typeof value === "number") {
		if (!Number.isFinite(value) || Object.is(value, -0)) fail("INVALID_JSON", `${path} contains a non-roundtrippable number`);
		return value;
	}
	if (typeof value !== "object") fail("INVALID_JSON", `${path} must contain only JSON data`);
	if (ancestors.has(value)) fail("INVALID_JSON", `${path} contains a cycle`);
	const array = Array.isArray(value);
	if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
		fail("INVALID_JSON", `${path} must contain plain JSON objects`);
	}
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== "string")) fail("INVALID_JSON", `${path} contains symbol keys`);
	if (array && (keys.length !== value.length + 1 || keys.some((key) => key !== "length" && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)))) {
		fail("INVALID_JSON", `${path} must be a dense JSON array without extra properties`);
	}
	ancestors.add(value);
	try {
		const entries = keys.filter((key) => !(array && key === "length")).map((key) => {
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
				fail("INVALID_JSON", `${path}.${key} must be an enumerable data property`);
			}
			return [key, cloneObservationJson(descriptor.value, `${path}.${key}`, ancestors)];
		});
		return array ? entries.map(([, entry]) => entry) : Object.fromEntries(entries);
	} finally {
		ancestors.delete(value);
	}
}

export function freezeObservationJson(value) {
	if (value !== null && typeof value === "object") {
		for (const entry of Object.values(value)) freezeObservationJson(entry);
		Object.freeze(value);
	}
	return value;
}

export function observationJsonEqual(left, right) {
	if (Object.is(left, right)) return true;
	if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
	const keys = Object.keys(left);
	return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && observationJsonEqual(left[key], right[key]));
}

function validateMetricContext(context) {
	record(context, "metricContext");
	if (context.version !== METRIC_CONTEXT_VERSION) fail("INVALID_METRIC_CONTEXT", "metricContext.version must name the supported explicit declaration");
	for (const key of ["id", "referenceFrame"]) text(context[key], `metricContext.${key}`);
	if (!["intrinsic", "grid", "ground"].includes(context.lengthAuthority) || context.unit !== "m" ||
		context.distanceOperator !== "euclidean" || context.angleConvention !== "mathematical") {
		fail("UNSUPPORTED_METRIC_CONTEXT", "point observations require a declared planar metre context with euclidean distances and mathematical angles; no transformation is performed");
	}
	record(context.provenance, "metricContext.provenance");
	if (Object.keys(context.provenance).length === 0) fail("INVALID_METRIC_CONTEXT", "metricContext.provenance must explicitly describe the declared frame's origin");
	if (!Object.hasOwn(context, "tolerancePolicy") || (context.tolerancePolicy !== null &&
		(typeof context.tolerancePolicy !== "object" || Array.isArray(context.tolerancePolicy)))) {
		fail("INVALID_METRIC_CONTEXT", "metricContext.tolerancePolicy must be explicitly declared as an object or null");
	}
}

/**
 * Source evidence only, not an Alignment definition or a solver declaration.
 * Coordinates and all supplied JSON provenance/quality fields are retained.
 * Target offsets, enforcement and solver weights belong to a separate request.
 */
export function createPointObservationSet(input) {
	const copy = cloneObservationJson(input);
	record(copy, "observationSet");
	if (Object.hasOwn(copy, "version") && copy.version !== POINT_OBSERVATION_SET_VERSION) {
		fail("INVALID_VERSION", "unsupported point observation set version");
	}
	copy.version = POINT_OBSERVATION_SET_VERSION;
	text(copy.id, "observationSet.id");
	text(copy.revision, "observationSet.revision");
	record(copy.source, "observationSet.source");
	text(copy.source.kind, "observationSet.source.kind");
	text(copy.source.reference, "observationSet.source.reference");
	validateMetricContext(copy.metricContext);
	if (!Array.isArray(copy.points) || copy.points.length === 0) fail("NO_POINTS", "observationSet.points must be a non-empty array");
	const ids = new Set();
	for (const point of copy.points) {
		record(point, "point");
		text(point.id, "point.id");
		if (ids.has(point.id)) fail("DUPLICATE_POINT", `duplicate observation point id: ${point.id}`);
		ids.add(point.id);
		if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) fail("INVALID_COORDINATE", `point ${point.id} requires finite numeric x and y`);
		if (Object.hasOwn(point, "metricContext") && !observationJsonEqual(point.metricContext, copy.metricContext)) {
			fail("CONFLICTING_POINT_CONTEXT", `point ${point.id} declares a different metric context`);
		}
	}
	return freezeObservationJson(copy);
}
