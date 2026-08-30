// src/domain/optimization/alignment/MetricContext.js
//
// AXTRAN2 Calculation Kernel - measurement authority.
//
// Two different things are routinely called "metric" and they must not be
// mixed:
//
//   - a metric as a distance notion, d(p, q) between two points;
//   - a Riemannian metric as a local measurement law, g_p(u, v), which fixes
//     lengths and angles of tangent vectors at every point and therefore curve
//     lengths, geodesics and the rest.
//
// Every constructive calculation needs an explicit measurement authority. Not
// every one needs a Riemannian manifold.
//
// The intrinsic parameter s is already metrically loaded. The moment
//
//     dpsi/ds = kappa(s)
//
// is written, it must be settled what one metre of ds means, or kappa is not
// uniquely interpretable. The same holds throughout AXTRAN2: transition
// lengths, Zwangspunkt distances and accumulated lengths may only be compared
// when they belong to the same authority or have been transformed under a
// recorded one.
//
// Consequence, measured: a Gauss-Krueger or UTM grid scale factor is of order
// 1e-4, which is 0.14 m over a 1430 m alignment. The entire reachable range of
// the accumulated length on that alignment was measured at 0.179 m. Mixing
// authorities therefore does not perturb the length objective, it swamps it.
//
// The same UTM coordinate pair admits at least three readings:
//
//   grid       - plane grid geometry, Euclidean in the grid
//   ellipsoid  - a representation of ellipsoidal geometry, position-dependent
//                scale
//   ground     - ground distances, with height and scale reduction applied
//
// A CRS identifier alone selects none of them, which is why a CRS is not by
// itself a complete metric determination.
//
// This module declares an authority. It performs no transformation, holds no
// coordinate data and never converts between authorities.

export const METRIC_CONTEXT_VERSION = "axtran2/metric-context/0.1";

/**
 * Which law assigns a length to a separation.
 *
 *   intrinsic - the alignment's own arc length; the authority the Kernel owns
 *   grid      - distances read in a projected plane, Euclidean in that plane
 *   ground    - distances on the terrain, after height and scale reduction
 *   ellipsoid - distances on the reference ellipsoid, position-dependent
 */
export const LENGTH_AUTHORITIES = Object.freeze([
	"intrinsic",
	"grid",
	"ground",
	"ellipsoid",
]);

export const ANGLE_CONVENTIONS = Object.freeze([
	"mathematical",  // counter-clockwise from +x
	"bearing",       // clockwise from north
]);

export class MetricContextError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "MetricContextError";
		this.code = code;
		this.detail = detail;
	}
}

function error(code, message, detail) {
	throw new MetricContextError(code, message, detail);
}

function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function requireEnum(value, allowed, label) {
	if (typeof value !== "string" || !allowed.includes(value)) {
		error(
			"INVALID_" + label.toUpperCase(),
			`${label} must be one of ${allowed.join(", ")}; received ${JSON.stringify(value)}`
		);
	}
	return value;
}

function requireText(value, label) {
	if (typeof value !== "string" || !value.trim()) {
		error("MISSING_" + label.toUpperCase(), `${label} must be a non-empty string`);
	}
	return value.trim();
}

/**
 * @param {object} declaration
 * @param {string} declaration.id
 * @param {"intrinsic"|"grid"|"ground"|"ellipsoid"} declaration.lengthAuthority
 * @param {string} declaration.unit                 e.g. "m"
 * @param {string} declaration.referenceFrame       what the coordinates are in
 * @param {string} [declaration.distanceOperator]   how a separation becomes a length
 * @param {string} [declaration.angleConvention]
 * @param {object} [declaration.provenance]         transformation / projection origin
 * @param {object} [declaration.tolerancePolicy]    how tolerances are to be read
 */
export function createMetricContext({
	id,
	lengthAuthority,
	unit,
	referenceFrame,
	distanceOperator = null,
	angleConvention = "mathematical",
	provenance = null,
	tolerancePolicy = null,
} = {}) {
	const contextId = requireText(id, "id");
	const authority = requireEnum(lengthAuthority, LENGTH_AUTHORITIES, "lengthAuthority");
	const contextUnit = requireText(unit, "unit");
	const frame = requireText(referenceFrame, "referenceFrame");
	const convention = requireEnum(angleConvention, ANGLE_CONVENTIONS, "angleConvention");

	// A projected authority is meaningless without a record of where the
	// projection came from: the same numbers read under a different projection
	// are a different measurement.
	if (authority !== "intrinsic" && !isObject(provenance)) {
		error(
			"MISSING_PROVENANCE",
			`lengthAuthority "${authority}" requires provenance describing the transformation `
				+ "or projection the coordinates came from",
			{ lengthAuthority: authority }
		);
	}

	const operator = distanceOperator ?? (authority === "grid" || authority === "intrinsic"
		? "euclidean"
		: null);
	if (typeof operator !== "string" || !operator.trim()) {
		error(
			"MISSING_DISTANCE_OPERATOR",
			`lengthAuthority "${authority}" has no default distance operator; declare one`,
			{ lengthAuthority: authority }
		);
	}

	return Object.freeze({
		version: METRIC_CONTEXT_VERSION,
		id: contextId,
		lengthAuthority: authority,
		distanceOperator: operator.trim(),
		angleConvention: convention,
		unit: contextUnit,
		referenceFrame: frame,
		provenance: provenance ? Object.freeze({ ...provenance }) : null,
		tolerancePolicy: tolerancePolicy ? Object.freeze({ ...tolerancePolicy }) : null,
	});
}

/**
 * The intrinsic authority the Kernel owns: arc length along the alignment
 * itself, in a local frame, with no projection behind it.
 */
export function createIntrinsicMetricContext({ id = "intrinsic:arc-length", unit = "m" } = {}) {
	return createMetricContext({
		id,
		lengthAuthority: "intrinsic",
		unit,
		referenceFrame: "alignment-local",
		distanceOperator: "arc-length",
	});
}

/**
 * Two quantities may only be compared when they were measured under the same
 * authority, or after a recorded transformation between them. This returns the
 * reason they are incomparable, or null when they are comparable.
 */
export function metricComparabilityConflict(left, right) {
	if (!isObject(left) || !isObject(right)) return "one of the contexts is missing";
	if (left.id === right.id) return null;
	if (left.unit !== right.unit) {
		return `unit differs: ${left.unit} against ${right.unit}`;
	}
	if (left.lengthAuthority !== right.lengthAuthority) {
		return `length authority differs: ${left.lengthAuthority} against ${right.lengthAuthority}`;
	}
	if (left.referenceFrame !== right.referenceFrame) {
		return `reference frame differs: ${left.referenceFrame} against ${right.referenceFrame}`;
	}
	if (left.distanceOperator !== right.distanceOperator) {
		return `distance operator differs: ${left.distanceOperator} against ${right.distanceOperator}`;
	}
	return null;
}

export function assertMetricComparability(left, right, what = "quantities") {
	const conflict = metricComparabilityConflict(left, right);
	if (conflict) {
		error(
			"INCOMPARABLE_METRIC_CONTEXT",
			`${what} were measured under different authorities and may not be compared: ${conflict}`,
			{ left: left?.id ?? null, right: right?.id ?? null, conflict }
		);
	}
	return true;
}
