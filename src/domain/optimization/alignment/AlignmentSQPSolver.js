// src/domain/optimization/alignment/AlignmentSQPSolver.js
//
// AXTRAN2 Calculation Kernel - the solver.
//
// Turns a declared problem document into an SQP run and returns a proposal:
// candidates, residuals, diagnostics. It never applies, persists, selects, or
// decides which candidate is the engineering answer.
//
// The objective is chosen by the caller, not by this module. Which quantity
// AXTRAN2 should minimise is an engineering decision that is still open, and
// the two candidates behave very differently:
//
//   "points"             sum of squared point residuals. A least-squares
//                        objective supplies its own curvature through J'J.
//   "accumulated-length" the total element length. Linear, so its Hessian is
//                        exactly zero and the descent estimate
//                        l1'(x; d; eta) <= -d'Qd degenerates to <= 0. Powell's
//                        modified BFGS is what keeps that usable; without it
//                        the line search has no descent guarantee at all.
//
// Both are supported so that the decision can be made on measurements rather
// than on which one the solver happens to allow.
//
// Constraints come from the problem document: poseE and every hardened
// Zwangspunkt are equalities, the element sequence contributes lower bounds on
// the element lengths. An inconsistent linearisation is not an error here: the
// relaxed QP reports how far it had to give up through its slack.
//
// The alignment builder and the projector are injected, so this module stays
// free of geometry imports and of any realization binding.

import { solveSQP } from "../../../lib/math/optim/sqp/solveSQP.js";
import { finiteDiffJacobian } from "../../../lib/math/optim/diff/finiteDiffJacobian.js";
import { scaleEvaluator, scale as toScaled, unscale } from "../../../lib/math/optim/scale/variableScaling.js";

export const ALIGNMENT_SQP_SOLVER_VERSION = "axtran2/alignment-sqp-solver/0.1";

export const OBJECTIVES = Object.freeze(["points", "accumulated-length"]);

export class AlignmentSqpSolverError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "AlignmentSqpSolverError";
		this.code = code;
		this.detail = detail;
	}
}

function error(code, message, detail) {
	throw new AlignmentSqpSolverError(code, message, detail);
}

function wrapAngle(angle) {
	let value = angle;
	while (value > Math.PI) value -= 2 * Math.PI;
	while (value < -Math.PI) value += 2 * Math.PI;
	return value;
}

/**
 * @param {object} input
 * @param {object} input.problem                       from createAlignmentOptimizationProblem
 * @param {(overlay: object) => object} input.buildAlignment
 *        receives the decoded free-variable overlay and returns
 *        { worldToTrack, endPose, lengths } for that parameter set
 * @param {"points"|"accumulated-length"} [input.objective]
 * @param {(overlay: object) => object} [input.analyticJacobian]
 *        optional; returns an object with endPoseJacobian(parameters) and
 *        lateralDerivative(parameters, station), as built by
 *        createAlignmentPoseJacobian. When supplied the finite-difference path
 *        is not used at all.
 * @param {Array<{id: string, residual: (x: number[]) => number, gradient: number[]}>}
 *        [input.extraEqualities]
 *        additional linear equalities on the free variables, used by the
 *        lexicographic driver to hold a budget from an earlier tier
 * @param {number[]} [input.startAt]
 *        starting point in free-variable order; defaults to the declared one.
 *        Used to warm start a later phase from an earlier phase's result.
 * @param {number} [input.maxIterations]
 */
export function solveAlignmentProblem({
	problem,
	buildAlignment,
	analyticJacobian = null,
	objective = "points",
	extraEqualities = [],
	startAt = null,
	maxIterations = 60,
	relaxationWeight = 1e6,
} = {}) {
	if (!problem?.codec) error("MISSING_PROBLEM", "problem is required");
	if (typeof buildAlignment !== "function") {
		error("MISSING_BUILDER", "buildAlignment is required");
	}
	if (!OBJECTIVES.includes(objective)) {
		error("UNKNOWN_OBJECTIVE", `objective must be one of ${OBJECTIVES.join(", ")}`, { objective });
	}

	const { codec, constraints, residuals } = problem;
	const scales = [...codec.freeScales];
	const declared = [...codec.encode()];
	if (startAt && startAt.length !== declared.length) {
		error("START_LENGTH", "startAt must have one entry per free variable", {
			expected: declared.length, received: startAt.length,
		});
	}
	const x0 = startAt ? [...startAt] : declared;

	const hardPoints = residuals.hardPoints;
	const softPoints = residuals.softPoints;

	// Lower bounds on the element lengths keep the element sequence intact.
	// A curvature variable carries no bound.
	const boundByName = new Map(
		constraints.bounds.map((bound) => [`${bound.elementId}.length`, bound.minimum])
	);
	const lower = codec.freeNames.map((name) => boundByName.get(name) ?? -Infinity);
	const upper = codec.freeNames.map(() => Infinity);

	let builds = 0;
	let jacobianEvaluations = 0;

	// codec names carry the element id; the analytic Jacobian addresses elements
	// by their position in the sequence
	const parameterSpecs = codec.freeNames.map((name) => {
		const dot = name.lastIndexOf(".");
		const elementId = name.slice(0, dot);
		return {
			elementIndex: codec.elementSequence.indexOf(elementId),
			kind: name.slice(dot + 1),
		};
	});

	function realise(x) {
		builds += 1;
		const overlay = codec.decode(x);
		const built = buildAlignment(overlay);
		if (typeof built?.worldToTrack !== "function" || !built?.endPose) {
			error("BUILDER_CONTRACT", "buildAlignment must return { worldToTrack, endPose }");
		}
		return built;
	}

	/** Equality residuals: end pose first, then every hardened Zwangspunkt. */
	function equalityResiduals(built) {
		const pose = built.endPose;
		const target = constraints.endPose;
		const values = [
			pose.x - target.x,
			pose.y - target.y,
			wrapAngle(pose.theta - target.theta),
		];
		for (const point of hardPoints) {
			const projected = built.worldToTrack(point.x, point.y);
			values.push(Number.isFinite(projected?.q) ? projected.q - point.target : 0);
		}
		return values;
	}

	/** Residuals of the equalities carried over from an earlier tier. */
	function extraResiduals(x) {
		return extraEqualities.map((constraint) => constraint.residual(x));
	}

	/** Soft point residuals, each in units of its own tolerance. */
	function softResiduals(built) {
		return softPoints.map((point) => {
			const projected = built.worldToTrack(point.x, point.y);
			if (!Number.isFinite(projected?.q)) return 0;
			return (projected.q - point.target) / point.tolerance;
		});
	}

	function accumulatedLength(x) {
		// Only the free lengths vary; the held ones are a constant offset that
		// does not change the gradient.
		let total = 0;
		codec.freeNames.forEach((name, i) => {
			if (name.endsWith(".length")) total += x[i];
		});
		return total;
	}

	function evaluateAnalytically(x) {
		const overlay = codec.decode(x);
		const built = realise(x);
		const geometry = analyticJacobian(overlay);
		jacobianEvaluations += 1;

		const h = [...equalityResiduals(built), ...extraResiduals(x)];

		// end pose: three rows straight from the chain rule
		const poseRows = geometry.endPoseJacobian(parameterSpecs);
		const Jh = [
			poseRows.map((d) => d.dx),
			poseRows.map((d) => d.dy),
			poseRows.map((d) => d.dtheta),
		];
		// hardened Zwangspunkte: one row each, at their own foot station
		for (const point of hardPoints) {
			const projected = built.worldToTrack(point.x, point.y);
			Jh.push(Number.isFinite(projected?.s)
				? geometry.lateralDerivative(parameterSpecs, projected.s)
				: parameterSpecs.map(() => 0));
		}
		for (const constraint of extraEqualities) Jh.push([...constraint.gradient]);

		if (objective === "accumulated-length") {
			const gradF = codec.freeNames.map((name) => (name.endsWith(".length") ? 1 : 0));
			return { f: accumulatedLength(x), gradF, h, Jh };
		}

		const r = softResiduals(built);
		const Jr = softPoints.map((point) => {
			const projected = built.worldToTrack(point.x, point.y);
			if (!Number.isFinite(projected?.s)) return parameterSpecs.map(() => 0);
			const row = geometry.lateralDerivative(parameterSpecs, projected.s);
			return row.map((value) => value / point.tolerance);
		});
		const f = 0.5 * r.reduce((sum, value) => sum + value * value, 0);
		const gradF = parameterSpecs.map((_, j) =>
			Jr.reduce((sum, row, i) => sum + row[j] * r[i], 0));
		return { f, gradF, h, Jh };
	}

	function evaluate(x) {
		if (typeof analyticJacobian === "function") return evaluateAnalytically(x);

		const built = realise(x);
		const h = [...equalityResiduals(built), ...extraResiduals(x)];

		const jacobian = finiteDiffJacobian({
			x,
			scales,
			relative: 1e-4,
			residual: (probe) => {
				const probed = realise(probe);
				const base = [...equalityResiduals(probed), ...extraResiduals(probe)];
				return objective === "points" ? [...base, ...softResiduals(probed)] : base;
			},
		});
		if (!jacobian.ok) {
			error("JACOBIAN_FAILED", `finite differences failed: ${jacobian.status}`, jacobian);
		}

		const Jh = jacobian.J.slice(0, h.length);

		if (objective === "accumulated-length") {
			const gradF = codec.freeNames.map((name) => (name.endsWith(".length") ? 1 : 0));
			return { f: accumulatedLength(x), gradF, h, Jh };
		}

		const r = softResiduals(built);
		const Jr = jacobian.J.slice(h.length);
		const f = 0.5 * r.reduce((sum, value) => sum + value * value, 0);
		const gradF = x.map((_, j) => Jr.reduce((sum, row, i) => sum + row[j] * r[i], 0));
		return { f, gradF, h, Jh };
	}

	// The solve runs in scaled coordinates. A length in metres and a curvature
	// near 1e-3 1/m differ by five orders of magnitude in the Jacobian, and an
	// identity Hessian against a gradient of that spread drives the QP into its
	// bounds on every iteration. The scaling is by engineering magnitude, fixed
	// before the solve, not by Jacobian norm.
	const scaledRun = solveSQP({
		x0: toScaled(x0, scales),
		evaluate: scaleEvaluator(evaluate, scales),
		lower: toScaled(lower, scales),
		upper: toScaled(upper, scales),
		maxIterations,
		relaxationWeight,
		initialHessianScale: 1,
	});
	const run = {
		...scaledRun,
		x: scaledRun.x ? unscale(scaledRun.x, scales) : null,
	};

	const built = run.x ? realise(run.x) : null;
	const finalEquality = built ? equalityResiduals(built) : [];
	const finalExtra = run.x ? extraResiduals(run.x) : [];
	const finalSoft = built ? softResiduals(built) : [];

	return Object.freeze({
		version: ALIGNMENT_SQP_SOLVER_VERSION,
		type: "proposal",
		objective,
		status: run.status,
		ok: run.ok === true,
		candidate: Object.freeze({
			variables: Object.freeze(run.x ? [...run.x] : []),
			names: codec.freeNames,
			overlay: run.x ? codec.decode(run.x) : null,
		}),
		diagnostics: Object.freeze({
			iterations: run.iterations,
			alignmentBuilds: builds,
			jacobianKind: typeof analyticJacobian === "function" ? "analytic" : "finite-difference",
			jacobianEvaluations,
			endPoseResidual: finalEquality.slice(0, 3),
			endPoseDistance: built ? Math.hypot(finalEquality[0], finalEquality[1]) : null,
			hardPointResiduals: Object.freeze(hardPoints.map((point, i) => Object.freeze({
				name: point.name,
				residual: finalEquality[3 + i] ?? null,
			}))),
			softOutsideTolerance: finalSoft.filter((value) => Math.abs(value) > 1).length,
			softResidualRms: finalSoft.length
				? Math.sqrt(finalSoft.reduce((sum, v) => sum + v * v, 0) / finalSoft.length)
				: 0,
			// slack of the relaxed QP in the last recorded iteration: how far the
			// linearised constraints had to be given up to stay solvable
			extraEqualityResiduals: Object.freeze(extraEqualities.map((constraint, i) => Object.freeze({
				id: constraint.id,
				residual: finalExtra[i] ?? null,
			}))),
			accumulatedLength: run.x ? accumulatedLength(run.x) : null,
			finalRelaxation: run.history?.at(-1)?.delta ?? null,
			history: Object.freeze(run.history ?? []),
			reason: run.reason ?? null,
		}),
		// A proposal is never an engineering decision. Applying, persisting and
		// selecting all happen outside this kernel.
		delta: null,
	});
}
