// src/domain/optimization/alignment/AlignmentOptimizationProblem.js
//
// AXTRAN2 Calculation Kernel - the problem document.
//
// Assembles a declared problem from its three parts and states what is left to
// work with. It is inspectable before any solver exists, and it refuses a
// declaration that cannot be satisfied, naming the conflict rather than
// reporting a generic failure.
//
// Degree-of-freedom budget:
//
//     available = free variables
//               - 3                       (poseE; poseA is the origin)
//               - one per hardened Zwangspunkt
//
// Element-sequence lower bounds are inequalities. They are declared here but
// consume a degree of freedom only while active, which no declaration can know
// in advance, so they are reported separately and never subtracted.
//
// This module declares. It does not evaluate, solve, apply, persist or select.

export const ALIGNMENT_OPTIMIZATION_PROBLEM_VERSION =
	"axtran2/alignment-optimization-problem/0.1";

export class AlignmentOptimizationProblemError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "AlignmentOptimizationProblemError";
		this.code = code;
		this.detail = detail;
	}
}

function error(code, message, detail) {
	throw new AlignmentOptimizationProblemError(code, message, detail);
}

export function createAlignmentOptimizationProblem({
	codec,
	constraints,
	residuals,
	label = "axtran2.alignment",
} = {}) {
	if (!codec?.freeNames) error("MISSING_CODEC", "codec is required");
	if (!constraints?.equalities) error("MISSING_CONSTRAINTS", "constraints are required");
	if (!residuals?.points) error("MISSING_RESIDUALS", "residuals are required");

	// Every hardened point must be declared as a constraint, and every hard
	// constraint must correspond to a declared point. A mismatch means the two
	// declarations disagree about what is enforced.
	const hardFromPoints = new Set(residuals.hardPoints.map((p) => p.name));
	const hardFromConstraints = new Set(constraints.hardPointNames);

	for (const name of hardFromPoints) {
		if (!hardFromConstraints.has(name)) {
			error(
				"UNDECLARED_HARD_POINT",
				`point "${name}" is enforced but not declared as a constraint`,
				{ pointName: name }
			);
		}
	}
	for (const name of hardFromConstraints) {
		if (!hardFromPoints.has(name)) {
			error(
				"MISSING_HARD_POINT",
				`constraint "zwang.${name}" has no point declared with that name`,
				{ pointName: name }
			);
		}
	}

	// The element sequence must match what the bounds were built for.
	const boundIds = constraints.bounds.map((b) => b.elementId).join(" ");
	if (boundIds !== codec.elementSequence.join(" ")) {
		error(
			"SEQUENCE_MISMATCH",
			"constraint bounds do not cover the codec element sequence in order",
			{
				codec: [...codec.elementSequence],
				bounds: constraints.bounds.map((b) => b.elementId),
			}
		);
	}

	const equalityCount = constraints.equalityCount;
	const degreesOfFreedom = codec.freeCount - equalityCount;

	if (degreesOfFreedom < 0) {
		error(
			"OVER_CONSTRAINED",
			`the declaration has ${codec.freeCount} free variables against ${equalityCount} `
				+ `equalities, so ${-degreesOfFreedom} more must be released before it can be satisfied`,
			{
				freeVariables: [...codec.freeNames],
				equalities: constraints.equalities.map((e) => e.id),
				hardenedPoints: [...hardFromPoints],
				shortfall: -degreesOfFreedom,
				// Naming the candidates is the point: a bare "infeasible" tells the
				// engineer nothing about which declaration to revisit.
				releaseCandidates: [...hardFromPoints],
			}
		);
	}

	return Object.freeze({
		version: ALIGNMENT_OPTIMIZATION_PROBLEM_VERSION,
		label,
		codec,
		constraints,
		residuals,
		metricContext: residuals.metricContext,
		budget: Object.freeze({
			freeVariables: codec.freeCount,
			heldVariables: codec.heldCount,
			derivedVariables: codec.derivedCount,
			endPoseEqualities: 3,
			hardenedPoints: hardFromPoints.size,
			equalities: equalityCount,
			degreesOfFreedom,
			sequenceBounds: constraints.bounds.length,
		}),
		softPointCount: residuals.softPoints.length,
	});
}
