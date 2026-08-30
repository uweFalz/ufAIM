// src/lib/math/optim/sqp/solveSQP.js
//
// Globalised SQP loop: relaxed QP subproblem, Powell's modified BFGS, Powell's
// per-constraint penalty weights, and an Armijo line search on the l1 merit.
//
// Follows Gerdts, Optimierung, Algorithmus 3.2.5, with two deliberate
// differences that are recorded where they occur: the QP subproblem is Powell's
// relaxed form from section 3.3 rather than the plain one, so an inconsistent
// linearisation degrades instead of failing; and only the equalities are
// relaxed, because this loop's inequalities are bounds that stay satisfied.
//
// Pure numerics: depends only on its siblings.

import { solveRelaxedQpStep, modifiedBfgsUpdate, identityMatrix } from "./sqpStep.js";
import { l1Merit, updatePenaltyWeights, createPenaltyWeights, constraintViolation } from "./merit.js";
import { lineSearchArmijo } from "./lineSearchArmijo.js";

export const SOLVE_SQP_VERSION = "optim/sqp/solveSQP/0.1";

function dot(a, b) {
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
	return sum;
}

/**
 * @param {object} input
 * @param {number[]} input.x0
 * @param {(x: number[]) => ({ f: number, gradF: number[], h: number[], Jh: number[][] })} input.evaluate
 * @param {number[]} [input.lower]   bounds on x, not on the step
 * @param {number[]} [input.upper]
 */
export function solveSQP({
	x0,
	evaluate,
	lower,
	upper,
	maxIterations = 100,
	// The KKT test is relative to the gradient. An absolute threshold is
	// meaningless when the objective gradient is of order 1e5, which it is as
	// soon as residuals are scaled by a tolerance: an absolute 1e-8 would then
	// demand thirteen digits of stationarity and never be reached.
	kktTolerance = 1e-8,
	feasibilityTolerance = 1e-9,
	stepTolerance = 1e-12,
	meritTolerance = 1e-12,
	stallLimit = 2,
	relaxationWeight = 1e4,
	initialHessianScale = 1,
} = {}) {
	if (!Array.isArray(x0) || typeof evaluate !== "function") {
		return { ok: false, status: "invalid", reason: "x0 and evaluate are required" };
	}

	const n = x0.length;
	const lo = lower ?? new Array(n).fill(-Infinity);
	const up = upper ?? new Array(n).fill(Infinity);

	let x = x0.map((value, i) => Math.min(Math.max(value, lo[i]), up[i]));
	let H = identityMatrix(n, initialHessianScale);
	let state = evaluate(x);
	let weights = createPenaltyWeights({ equalityCount: state.h?.length ?? 0 });
	const history = [];
	let previousMerit = null;
	let stalls = 0;

	for (let iteration = 0; iteration < maxIterations; iteration++) {
		const violation = constraintViolation(state);

		// stationarity of the Lagrangian, using the multipliers of the last QP
		const step = solveRelaxedQpStep({
			H,
			gradF: state.gradF,
			h: state.h ?? [],
			Jh: state.Jh ?? [],
			// bounds on the step, derived from the bounds on x
			lower: x.map((value, i) => lo[i] - value),
			upper: x.map((value, i) => up[i] - value),
			relaxationWeight,
		});

		if (!step.ok) {
			history.push({ iteration, status: "qp_failed", reason: step.status, detail: step.reason ?? null });
			return { ok: false, status: "qp_failed", x, state, history, iterations: iteration };
		}

		const stepNorm = Math.hypot(...step.d);
		const kkt = Math.hypot(
			...state.gradF.map((value, i) =>
				value + (state.Jh ?? []).reduce((sum, row, j) => sum + row[i] * step.multipliers.equality[j], 0))
		);

		const gradientScale = Math.max(1, Math.hypot(...state.gradF));
		if (violation.total <= feasibilityTolerance && kkt <= kktTolerance * gradientScale) {
			history.push({
				iteration, status: "converged", kkt, violation: violation.total,
				relativeKkt: kkt / gradientScale,
			});
			return {
				ok: true, status: "converged", x, state, history,
				iterations: iteration, multipliers: step.multipliers, hessian: H,
			};
		}
		if (stepNorm <= stepTolerance && violation.total <= feasibilityTolerance) {
			history.push({ iteration, status: "step_too_small", kkt, violation: violation.total });
			return {
				ok: true, status: "stationary", x, state, history,
				iterations: iteration, multipliers: step.multipliers, hessian: H,
			};
		}

		weights = updatePenaltyWeights(weights, step.multipliers);
		const meritAt0 = l1Merit(state, weights);

		// Feasible, and the merit no longer moves: the iteration has reached what
		// this gradient can resolve. Report it as stationary rather than running
		// out of iterations, which reads like a failure and is not one.
		if (previousMerit !== null
			&& violation.total <= feasibilityTolerance
			&& Math.abs(previousMerit - meritAt0) <= meritTolerance * (1 + Math.abs(meritAt0))) {
			stalls += 1;
			if (stalls >= stallLimit) {
				history.push({ iteration, status: "merit_stationary", kkt, violation: violation.total });
				return {
					ok: true, status: "stationary", x, state, history,
					iterations: iteration, multipliers: step.multipliers, hessian: H,
				};
			}
		} else {
			stalls = 0;
		}
		previousMerit = meritAt0;

		let trialState = null;
		const search = lineSearchArmijo({
			meritAt0,
			predictedDecrease: step.predictedDecrease,
			meritAt: (alpha) => {
				const candidate = x.map((value, i) =>
					Math.min(Math.max(value + alpha * step.d[i], lo[i]), up[i]));
				let evaluated;
				try { evaluated = evaluate(candidate); } catch { return null; }
				if (!Number.isFinite(evaluated?.f)) return null;
				trialState = { x: candidate, state: evaluated };
				return l1Merit(evaluated, weights);
			},
		});

		if (!search.ok || !trialState) {
			history.push({
				iteration, status: "line_search_failed", reason: search.status,
				predictedDecrease: step.predictedDecrease, delta: step.delta,
			});
			return { ok: false, status: "line_search_failed", reason: search.status, x, state, history, iterations: iteration };
		}

		// Powell's modified BFGS on the Lagrangian gradient difference
		const lagrangeGradient = (evaluated) => evaluated.gradF.map((value, i) =>
			value + (evaluated.Jh ?? []).reduce(
				(sum, row, j) => sum + row[i] * step.multipliers.equality[j], 0));
		const s = trialState.x.map((value, i) => value - x[i]);
		const y = lagrangeGradient(trialState.state).map((value, i) => value - lagrangeGradient(state)[i]);
		H = modifiedBfgsUpdate(H, s, y);

		history.push({
			iteration,
			f: state.f,
			violation: violation.total,
			kkt,
			alpha: search.alpha,
			backtracks: search.backtracks,
			stepNorm,
			delta: step.delta,
			qpIterations: step.qpIterations,
		});

		x = trialState.x;
		state = trialState.state;
	}

	return {
		ok: false, status: "max_iterations", x, state, history,
		iterations: maxIterations, hessian: H,
	};
}
