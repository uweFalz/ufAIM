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
	// A step that has stopped moving proves stationarity only if the Lagrangian
	// gradient is also small. This is looser than kktTolerance on purpose: it
	// decides whether a stalled iteration may be called stationary, not whether
	// the run has converged.
	stationarityTolerance = 1e-4,
	stallLimit = 2,
	penaltyRule = "monotone",
	penaltySafety = 20,
	relaxationWeight = 1e4,
	initialHessianScale = 1,
	// Box trust region on the step. A linear objective gets its curvature only
	// from the constraints, so the reduced Hessian can be genuinely tiny and the
	// QP's Newton step correspondingly enormous - measured at |d| = 150 in a
	// space where the variables themselves are of order 100, cut back to alpha =
	// 2e-3 by the line search. Backtracking from a step that far out wastes the
	// evaluations it costs and leaves the quadratic model unquestioned. Bounding
	// the step instead asks the model only where it is credible. The box shape
	// costs nothing: the subproblem already carries bounds.
	trustRadius = null,          // default: a tenth of the largest variable
	minTrustRadius = 1e-10,
	trustGrowth = 2,
	trustShrink = 0.5,
} = {}) {
	if (!Array.isArray(x0) || typeof evaluate !== "function") {
		return { ok: false, status: "invalid", reason: "x0 and evaluate are required" };
	}

	const n = x0.length;
	const lo = lower ?? new Array(n).fill(-Infinity);
	const up = upper ?? new Array(n).fill(Infinity);

	let x = x0.map((value, i) => Math.min(Math.max(value, lo[i]), up[i]));
	let radius = Number.isFinite(trustRadius)
		? trustRadius
		: Math.max(1, 0.1 * Math.max(...x.map(Math.abs), 0));
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
			// bounds on the step: the bounds on x, tightened by the trust region
			lower: x.map((value, i) => Math.max(lo[i] - value, -radius)),
			upper: x.map((value, i) => Math.min(up[i] - value, radius)),
			relaxationWeight,
		});

		if (!step.ok) {
			history.push({ iteration, status: "qp_failed", reason: step.status, detail: step.reason ?? null });
			return { ok: false, status: "qp_failed", x, state, history, iterations: iteration };
		}

		const stepNorm = Math.hypot(...step.d);
		// Stationarity is measured on the PROJECTED Lagrangian gradient. At a
		// solution held by a bound, the gradient is balanced by that bound's own
		// multiplier, which does not appear here at all - so the plain gradient
		// stays large and would deny a perfectly good optimum. A component
		// pressing outwards through an active bound is held by it and contributes
		// nothing; only what could still move counts.
		const lagrangeAt = state.gradF.map((value, i) =>
			value + (state.Jh ?? []).reduce((sum, row, j) => sum + row[i] * step.multipliers.equality[j], 0));
		const kkt = Math.hypot(...lagrangeAt.map((value, i) => {
			if (x[i] <= lo[i] && value > 0) return 0;
			if (x[i] >= up[i] && value < 0) return 0;
			return value;
		}));

		const gradientScale = Math.max(1, Math.hypot(...state.gradF));
		// Every verdict of "we are done" has to answer the KKT question. A step
		// can go to zero because the point is stationary, or because the trust
		// region has collapsed onto it - and only the KKT residual tells the two
		// apart. Measured before this guard: a run reported merit_stationary at a
		// KKT residual of 3.09, having shrunk its region to 8e-6.
		const stationary = kkt <= stationarityTolerance * gradientScale;
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
		if (stepNorm <= stepTolerance && violation.total <= feasibilityTolerance && stationary) {
			history.push({ iteration, status: "step_too_small", kkt, violation: violation.total });
			return {
				ok: true, status: "stationary", x, state, history,
				iterations: iteration, multipliers: step.multipliers, hessian: H,
			};
		}

		weights = updatePenaltyWeights(weights, step.multipliers, { rule: penaltyRule, safety: penaltySafety });

		const meritAt0 = l1Merit(state, weights);

		// Feasible, and the merit no longer moves: the iteration has reached what
		// this gradient can resolve. Report it as stationary rather than running
		// out of iterations, which reads like a failure and is not one.
		if (previousMerit !== null
			&& violation.total <= feasibilityTolerance
			&& stationary
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
		// exact directional derivative of the l1 merit along the step
		const penaltyDrop = (state.h ?? []).reduce(
			(sum, value, j) => sum + (weights.equality[j] ?? 0) * Math.abs(value), 0
		);
		const directional = step.gradientAlongStep - (1 - (step.delta ?? 0)) * penaltyDrop;
		// the curvature bound is the theoretical guarantee; when it is zero the
		// Hessian has no curvature along the step and only the penalty term can
		// supply descent
		const predictedDecrease = Math.min(directional, step.curvature);

		// Second-order correction. The l1 merit has a kink at every feasible
		// point, and a good step that reduces the objective at first order can
		// raise the violation at second order and be charged for it immediately.
		// That is the Maratos effect, and unaided it makes the search backtrack to
		// nothing right where the iteration should be finishing: measured here at
		// alpha = 5e-10 after 31 backtracks with the objective unchanged in five
		// digits. The correction re-linearises the constraints at the trial point
		// and adds the smallest step that closes them, which restores the
		// quadratic convergence the plain search throws away.
		const meritOf = (candidate) => {
			let evaluated;
			try { evaluated = evaluate(candidate); } catch { return null; }
			if (!Number.isFinite(evaluated?.f)) return null;
			return { merit: l1Merit(evaluated, weights), state: evaluated };
		};
		const clamp = (candidate) => candidate.map((value, i) =>
			Math.min(Math.max(value, lo[i]), up[i]));

		const full = meritOf(clamp(x.map((value, i) => value + step.d[i])));
		const armijo = (value, alpha) => value <= meritAt0 + 0.1 * alpha * predictedDecrease;

		let corrected = null;
		if (full && !armijo(full.merit, 1) && (state.h ?? []).length && predictedDecrease < 0) {
			// smallest d that satisfies Jh(x) d = -h(x + d): the same subproblem
			// with no objective and the trial point's residuals
			const soc = solveRelaxedQpStep({
				H: identityMatrix(n, 1),
				gradF: new Array(n).fill(0),
				h: full.state.h ?? [],
				Jh: state.Jh ?? [],
				lower: x.map((value, i) => Math.max(lo[i] - value - step.d[i], -radius)),
				upper: x.map((value, i) => Math.min(up[i] - value - step.d[i], radius)),
				relaxationWeight,
			});
			if (soc.ok) {
				const point = clamp(x.map((value, i) => value + step.d[i] + soc.d[i]));
				const trial = meritOf(point);
				if (trial && armijo(trial.merit, 1)) corrected = { x: point, ...trial };
			}
		}

		const search = corrected
			? { ok: true, status: "accepted_after_correction", alpha: 1, backtracks: 0, merit: corrected.merit }
			: lineSearchArmijo({
			meritAt0,
			predictedDecrease,
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
		if (corrected) trialState = { x: corrected.x, state: corrected.state };

		if (!search.ok || !trialState) {
			// A failed search is the model overreaching, not necessarily a dead
			// end. Shrink the region and try again from the same point; give up
			// only once the region is too small to be the explanation. A step of
			// length zero is never the model overreaching, and shrinking around it
			// would loop until the iterations ran out.
			if (radius > minTrustRadius && stepNorm > stepTolerance) {
				radius = Math.max(minTrustRadius, radius * trustShrink);
				history.push({ iteration, status: "trust_shrunk", reason: search.status, radius });
				continue;
			}
			history.push({
				iteration, status: "line_search_failed", reason: search.status,
				predictedDecrease: step.predictedDecrease, delta: step.delta, radius,
			});
			return { ok: false, status: "line_search_failed", reason: search.status, x, state, history, iterations: iteration };
		}

		// The line search's own verdict sizes the region: a full step accepted
		// means the model held that far and may be trusted further; backtracking
		// means it did not, and the region follows the step that was accepted.
		radius = search.backtracks === 0
			? Math.min(radius * trustGrowth, Math.max(1, 1e3 * Math.max(...x.map(Math.abs), 0)))
			: Math.max(minTrustRadius, Math.max(search.alpha * stepNorm, radius * trustShrink));

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
			correction: search.status === "accepted_after_correction",
			stepNorm,
			delta: step.delta,
			radius,
			qpIterations: step.qpIterations,
			// per constraint, because the aggregate hides which one is in trouble
			// and the answer to that is usually a scaling question
			equalities: Object.freeze((state.h ?? []).map((value, j) => Object.freeze({
				residual: value,
				multiplier: step.multipliers.equality[j],
				weight: weights.equality[j],
				rowNorm: Math.hypot(...(state.Jh?.[j] ?? [0])),
			}))),
		});

		x = trialState.x;
		state = trialState.state;
	}

	return {
		ok: false, status: "max_iterations", x, state, history,
		iterations: maxIterations, hessian: H,
	};
}
