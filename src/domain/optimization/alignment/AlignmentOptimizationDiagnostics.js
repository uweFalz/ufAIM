// src/domain/optimization/alignment/AlignmentOptimizationDiagnostics.js
//
// AXTRAN2 Calculation Kernel - diagnostics.
//
// Evaluates a declared problem against one alignment and reports what a
// reviewer needs in order to judge it: the degree-of-freedom budget, every
// point with its residual and whether it is met, and the sharpening order.
//
// Sharpening order matters and is not symmetric. A wrong point held soft shows
// up in its own residual. A wrong point held hard is satisfied exactly by
// construction and its error becomes invisible. So the ranking below is
// computed over the SOFT points only, and hardened points are reported as
// unrankable rather than given a score that would look meaningful and not be.
//
// This module reports. It does not solve, does not decide what to harden, and
// does not apply, persist or select.

export const ALIGNMENT_OPTIMIZATION_DIAGNOSTICS_VERSION =
	"axtran2/alignment-optimization-diagnostics/0.1";

export class AlignmentOptimizationDiagnosticsError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "AlignmentOptimizationDiagnosticsError";
		this.code = code;
	}
}

function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}

/**
 * @param {object} input
 * @param {object} input.problem            from createAlignmentOptimizationProblem
 * @param {(x: number, y: number) => ({ q: number, s: number } | null)} input.worldToTrack
 * @param {{ x: number, y: number, theta: number }} [input.endPose] realised end pose
 */
export function evaluateAlignmentOptimizationProblem({
	problem,
	worldToTrack,
	endPose = null,
} = {}) {
	if (!problem?.residuals) {
		throw new AlignmentOptimizationDiagnosticsError(
			"MISSING_PROBLEM",
			"problem is required"
		);
	}
	if (typeof worldToTrack !== "function") {
		throw new AlignmentOptimizationDiagnosticsError(
			"MISSING_PROJECTOR",
			"worldToTrack is required"
		);
	}

	const evaluated = problem.residuals.evaluate(worldToTrack);

	const soft = evaluated.filter((p) => p.enforcement === "soft");
	const hard = evaluated.filter((p) => p.enforcement === "hard");
	const unprojected = evaluated.filter((p) => !p.projected);
	// A point with no foot point at all and one that fell onto an extension of
	// the alignment are both unscoreable, and they are not the same problem: the
	// first is usually a broken alignment, the second a point past an end.
	const extrapolated = unprojected.filter((p) => p.extrapolated === true);

	// Sharpening order: soft points by how far outside their own tolerance they
	// sit. This is the pass that must run before anything is hardened.
	const sharpening = [...soft]
		.filter((p) => p.projected)
		.sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual))
		.map((p, index) => Object.freeze({
			rank: index + 1,
			name: p.name,
			kind: p.kind,
			deviation: p.deviation,
			tolerance: p.tolerance,
			residual: p.residual,
			met: p.met,
		}));

	const endPoseReport = endPose && problem.constraints?.endPose
		? Object.freeze({
			dx: endPose.x - problem.constraints.endPose.x,
			dy: endPose.y - problem.constraints.endPose.y,
			dtheta: endPose.theta - problem.constraints.endPose.theta,
			distance: Math.hypot(
				endPose.x - problem.constraints.endPose.x,
				endPose.y - problem.constraints.endPose.y
			),
		})
		: null;

	const metSoft = soft.filter((p) => p.met).length;
	const rms = soft.length
		? Math.sqrt(
			soft.reduce(
				(sum, p) => sum + (isFiniteNumber(p.residual) ? p.residual * p.residual : 0),
				0
			) / soft.length
		)
		: 0;

	return Object.freeze({
		version: ALIGNMENT_OPTIMIZATION_DIAGNOSTICS_VERSION,
		label: problem.label,
		metricContext: problem.metricContext,
		budget: problem.budget,
		endPose: endPoseReport,
		points: evaluated,
		summary: Object.freeze({
			total: evaluated.length,
			soft: soft.length,
			hard: hard.length,
			unprojected: unprojected.length,
			extrapolated: extrapolated.length,
			extrapolatedPoints: Object.freeze(extrapolated.map((p) => Object.freeze({
				name: p.name, station: p.station, offset: p.offset, overshoot: p.overshoot,
			}))),
			softMet: metSoft,
			softOutsideTolerance: soft.length - metSoft,
			softResidualRms: rms,
		}),
		sharpening: Object.freeze(sharpening),
		// Hardened points are satisfied by construction; their residual carries
		// no information about whether the declaration was right.
		unrankable: Object.freeze(hard.map((p) => Object.freeze({
			name: p.name,
			reason: "enforced exactly; a wrong hard point does not reveal itself in its own residual",
		}))),
	});
}
