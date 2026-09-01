// src/domain/optimization/alignment/AlignmentResidualBuilder.js
//
// AXTRAN2 Calculation Kernel — the reality check.
//
// One residual per point, expressed in units of that point's own tolerance:
//
//     r = (lateralOffset - target) / tolerance
//
// A measured point, a Zwangspunkt and a point carrying a prescribed offset are
// the same object with different tolerances and targets. No separate mechanism
// is needed for the three kinds the requirement names.
//
// A MetricContext is required, not optional. Relating a world-domain point to
// an intrinsic track reference is World-to-Track, and per the Knowledge Kernel
// that projection is context-qualified: without a declared measurement
// authority the residual is a number without a claim.
//
// The comparison r = (offset - target) / tolerance is itself a metric
// statement. Offset, target and tolerance are three lengths, and they may only
// be divided by one another when they share an authority. Points may therefore
// carry their own context, and one that disagrees with the problem's is
// refused by name rather than silently divided.
//
// The projector is injected. This module performs no projection of its own and
// never converts between authorities, applies, persists or selects.

import { assertMetricComparability } from "./MetricContext.js";

/**
 * Relative slop below which a foot point counts as a genuine perpendicular foot
 * rather than a station clamped to an end. Measured: `dist - |q|` is 2.8e-17 m
 * at real foot points across a 1430 m alignment and already 9.9e-4 m one
 * centimetre past the end, so anything between separates them; this catches an
 * overshoot of about ten microns.
 */
export const FOOT_POINT_TOLERANCE = 1e-9;

/**
 * How far past an end a foot point may sit and still count as being on the
 * alignment, in metres. Used when the projector reports the longitudinal
 * residual itself, which is exact where the distance route is quadratic: one
 * centimetre past an end gives u = 1.00e-2 directly and only 9.9e-4 through the
 * distance. Measured, u is 7.6e-14 m at a point exactly on an end, so a micron
 * is far above the projector's own noise and far below anything an engineer
 * would call "past the end".
 */
export const FOOT_POINT_OVERSHOOT = 1e-6;

export const ALIGNMENT_RESIDUAL_BUILDER_VERSION =
	"axtran2/alignment-residual-builder/0.2";

export const POINT_ENFORCEMENT = Object.freeze(["soft", "hard"]);

export class AlignmentResidualBuilderError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "AlignmentResidualBuilderError";
		this.code = code;
	}
}

function error(code, message) {
	throw new AlignmentResidualBuilderError(code, message);
}

function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}

function requireMetricContext(context) {
	if (!isObject(context) || typeof context.lengthAuthority !== "string") {
		error("MISSING_METRIC_CONTEXT",
			"points are world-domain positions; a MetricContext must be declared "
			+ "(see createMetricContext)");
	}
	return context;
}

/**
 * @param {object} declaration
 * @param {Array} declaration.points
 * @param {object} declaration.metricContext  from createMetricContext
 */
/**
 * Whether a projection is a genuine perpendicular foot point, from whichever
 * evidence the projector offered.
 *
 * The longitudinal residual is the direct answer and is preferred when it is
 * there: `clamped && |u| > tolerance` says the station was pinned to an end and
 * the point lies that far past it. Where only the distance is reported the same
 * question is answered indirectly - at a true foot point the offset IS the
 * distance - which works but is quadratic in the overshoot and so far less
 * sensitive: one centimetre past an end shows as u = 1.00e-2 directly and only
 * 9.9e-4 through the distance. A projector offering neither cannot be checked at
 * all, and that is reported rather than passed over.
 */
export function footPointOf(projected) {
	if (isFiniteNumber(projected?.u)) {
		const overshoot = Math.abs(projected.u);
		const extrapolated = projected.clamped !== false && overshoot > FOOT_POINT_OVERSHOOT;
		return { checkable: true, extrapolated, overshoot: extrapolated ? overshoot : null };
	}
	if (isFiniteNumber(projected?.dist) && isFiniteNumber(projected?.q)) {
		const gap = projected.dist - Math.abs(projected.q);
		const extrapolated = gap > FOOT_POINT_TOLERANCE * Math.max(1, Math.abs(projected.q));
		return {
			checkable: true,
			extrapolated,
			overshoot: extrapolated
				? Math.sqrt(Math.max(0, projected.dist ** 2 - projected.q ** 2))
				: null,
		};
	}
	return { checkable: false, extrapolated: false, overshoot: null };
}

export function createAlignmentResidualBuilder({ points, metricContext } = {}) {
	const context = requireMetricContext(metricContext);

	if (!Array.isArray(points) || points.length === 0) {
		error("NO_POINTS", "points must be a non-empty array");
	}

	const seen = new Set();
	const entries = points.map((point, index) => {
		if (!isObject(point)) error("INVALID_POINT", `point at index ${index} must be an object`);
		const name = typeof point.name === "string" && point.name.trim()
			? point.name.trim()
			: `P${index}`;
		if (seen.has(name)) error("DUPLICATE_POINT", `point name "${name}" occurs more than once`);
		seen.add(name);

		if (![point.x, point.y].every(isFiniteNumber)) {
			error("INVALID_POINT", `point "${name}" must carry finite x and y`);
		}
		const target = point.target ?? 0;
		if (!isFiniteNumber(target)) {
			error("INVALID_TARGET", `point "${name}" target must be a finite number`);
		}
		const tolerance = point.tolerance;
		if (!isFiniteNumber(tolerance) || tolerance <= 0) {
			error("INVALID_TOLERANCE", `point "${name}" tolerance must be a finite number > 0`);
		}
		const enforcement = point.enforcement ?? "soft";
		if (!POINT_ENFORCEMENT.includes(enforcement)) {
			error("UNKNOWN_ENFORCEMENT", `point "${name}" has unknown enforcement "${enforcement}"`);
		}
		// A point measured under a different authority cannot be divided by a
		// tolerance stated under this one.
		if (isObject(point.metricContext)) {
			assertMetricComparability(context, point.metricContext, `point "${name}" and the problem`);
		}
		return Object.freeze({
			name, x: point.x, y: point.y, target, tolerance, enforcement,
			kind: point.kind ?? "measured",
			metricContext: point.metricContext ?? context,
		});
	});

	const soft = entries.filter((p) => p.enforcement === "soft");
	const hard = entries.filter((p) => p.enforcement === "hard");

	return Object.freeze({
		version: ALIGNMENT_RESIDUAL_BUILDER_VERSION,
		metricContext: context,
		points: Object.freeze(entries),
		softPoints: Object.freeze(soft),
		hardPoints: Object.freeze(hard),
		count: entries.length,

		/**
		 * Evaluate every residual against one alignment.
		 *
		 * Two ways a point has no residual here, and neither is scored.
		 *
		 * It may not project at all, which the projector says with a null.
		 *
		 * Or it may project onto an extension of the alignment rather than onto
		 * the alignment. Projectors clamp the foot station to the ends -
		 * Alignment2D does - so a point past an end comes back with the offset
		 * from the END TANGENT and no hint that it did. Measured on a 1430 m
		 * alignment, a point a kilometre past the end reports an offset of
		 * 0.0500 m and would be scored as comfortably met. The distance gives it
		 * away: at a true foot point the offset IS the distance, and where the
		 * station was clamped they differ by the longitudinal overshoot.
		 *
		 * A projector that reports no distance cannot be checked for this, and
		 * such a point carries `extrapolated: null` rather than `false`.
		 *
		 * @param {(x:number,y:number)=>({q:number,s:number,dist?:number}|null)} worldToTrack
		 */
		evaluate(worldToTrack) {
			if (typeof worldToTrack !== "function") {
				error("MISSING_PROJECTOR", "evaluate requires a worldToTrack function");
			}
			return Object.freeze(entries.map((point) => {
				const projected = worldToTrack(point.x, point.y);
				if (!isObject(projected) || !isFiniteNumber(projected.q)) {
					return Object.freeze({
						...point, projected: false, extrapolated: null, overshoot: null,
						station: null, offset: null, deviation: null, residual: null, met: false,
					});
				}
				const station = isFiniteNumber(projected.s) ? projected.s : null;
				const foot = footPointOf(projected);
				if (foot.extrapolated) {
					return Object.freeze({
						...point, projected: false, extrapolated: true, overshoot: foot.overshoot,
						station, offset: projected.q, deviation: null, residual: null, met: false,
					});
				}
				const deviation = projected.q - point.target;
				return Object.freeze({
					...point,
					projected: true,
					extrapolated: foot.checkable ? false : null,
					overshoot: null,
					station,
					offset: projected.q,
					deviation,
					residual: deviation / point.tolerance,
					met: Math.abs(deviation) <= point.tolerance,
				});
			}));
		},
	});
}
