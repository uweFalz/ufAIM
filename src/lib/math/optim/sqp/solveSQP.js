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
	// Powell's rule, which lets a weight fall again when its multiplier drops.
	// The monotone rule of Gerdts 3.8 was the default, chosen because a weight
	// that decays does so exactly when the multipliers are least trustworthy.
	// That reasoning was wrong about which risk is larger. A rule that never
	// decays makes one bad early estimate permanent, and measured on an alignment
	// fit it did: a heading weight of 1.2e6 against a multiplier of order one,
	// locked in for the rest of the run, after which the merit rejected every
	// step that touched the heading. The same fit under Powell's rule reaches the
	// identical answer in 45 iterations instead of 86, in 9 seconds instead of
	// 100, with weights of 3.8, 21 and 3130.
	penaltyRule = "powell",
	// The margin over |multiplier| that the l1 merit needs to be exact. Powell
	// asks for eta > |mu|; this is the factor applied to it. It stood at 20
	// without a reason recorded, and 20 is far past what exactness needs.
	//
	// The cost of the excess is that the merit is then dominated by the penalty
	// term, and a step that lowers the objective while lifting the violation a
	// little - which is what an SQP step legitimately does - is refused. The
	// search backtracks, the region shrinks, and once it is smaller than the
	// violation the relaxation takes over: at delta = 1 the merit's constraint
	// term is multiplied by (1 - delta) and the violation can no longer be paid
	// off at all. Measured on the nine-element scenario under the exact ramp
	// rule, it froze at 4.6e-5 for the last hundred iterations.
	//
	// At 2 the same fit clears it to 4.8e-13, and every other row improves with
	// it: the bound path converges in 91 iterations instead of 151 and its points
	// run reaches "converged" again rather than stopping at "stationary".
	penaltySafety = 2,
	relaxationWeight = 1e4,
	qpIterations = 200,
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
	// How close to a bound counts as held by it. An exact test is too sharp: the
	// iterate is clamped into the box after every step, but a step that stops
	// just short leaves the variable beside its bound rather than on it, and the
	// bound is then invisible to everything that asks. Measured on an alignment
	// fit, a curvature sat 1.9e-9 under its minimum-radius limit - held for every
	// practical purpose, and 1.9e-9 too far away to be recognised. Relative,
	// because the bounds are engineering magnitudes, not numbers near one.
	boundTolerance = 1e-6,
	// How close to its bound an inequality counts as held by it, relative to its
	// own magnitude. The rows are engineering quantities and are not comparable
	// to each other.
	activeTolerance = 1e-6,
} = {}) {
	if (!Array.isArray(x0) || typeof evaluate !== "function") {
		return { ok: false, status: "invalid", reason: "x0 and evaluate are required" };
	}

	const n = x0.length;
	const lo = lower ?? new Array(n).fill(-Infinity);
	const up = upper ?? new Array(n).fill(Infinity);

	let x = x0.map((value, i) => Math.min(Math.max(value, lo[i]), up[i]));
	const nearBound = (value, bound) => Number.isFinite(bound)
		&& Math.abs(value - bound) <= boundTolerance * Math.max(1, Math.abs(bound));
	const heldByBounds = (point) => {
		const held = [];
		for (let i = 0; i < n; i++) {
			if (nearBound(point[i], lo[i]) || nearBound(point[i], up[i])) held.push(i);
		}
		return held;
	};
	let radius = Number.isFinite(trustRadius)
		? trustRadius
		: Math.max(1, 0.1 * Math.max(...x.map(Math.abs), 0));
	let H = identityMatrix(n, initialHessianScale);
	let state = evaluate(x);
	let weights = createPenaltyWeights({
		equalityCount: state.h?.length ?? 0,
		inequalityCount: state.g?.length ?? 0,
	});
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
			g: state.g ?? [],
			Jg: state.Jg ?? [],
			// bounds on the step: the bounds on x, tightened by the trust region
			lower: x.map((value, i) => Math.max(lo[i] - value, -radius)),
			upper: x.map((value, i) => Math.min(up[i] - value, radius)),
			relaxationWeight,
			qpIterations,
			pinnedVariables: heldByBounds(x),
			activeInequalities: (state.g ?? []).reduce((held, value, j) => {
				if (value > -activeTolerance * Math.max(1, Math.abs(value))) held.push(j);
				return held;
			}, []),
		});

		if (!step.ok) {
			history.push({
				iteration, status: "qp_failed", reason: step.status,
				detail: step.detail ?? step.reason ?? null,
			});
			return { ok: false, status: "qp_failed", x, state, history, iterations: iteration };
		}

		const stepNorm = Math.hypot(...step.d);
		// Stationarity is measured on the PROJECTED Lagrangian gradient. At a
		// solution held by a bound, the gradient is balanced by that bound's own
		// multiplier, which does not appear here at all - so the plain gradient
		// stays large and would deny a perfectly good optimum. A component
		// pressing outwards through an active bound is held by it and contributes
		// nothing; only what could still move counts.
		// The Lagrangian carries both blocks. An inequality held at its bound
		// contributes exactly like an equality; an inactive one has multiplier
		// zero and contributes nothing, which is what makes this the same
		// expression for both.
		const lagrangeAt = state.gradF.map((value, i) =>
			value
			+ (state.Jh ?? []).reduce((sum, row, j) => sum + row[i] * step.multipliers.equality[j], 0)
			+ (state.Jg ?? []).reduce((sum, row, j) => sum + row[i] * (step.multipliers.inequality[j] ?? 0), 0));
		const kkt = Math.hypot(...lagrangeAt.map((value, i) => {
			if (nearBound(x[i], lo[i]) && value > 0) return 0;
			if (nearBound(x[i], up[i]) && value < 0) return 0;
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
		// A zero step is stationarity when the subproblem that produced it was
		// free to say otherwise. Two things have to hold: the subproblem reached
		// its own optimum rather than being truncated, and the trust region was
		// not what held it there. Then no admissible descent direction exists -
		// which is exactly what happens when the active constraints pin every
		// degree of freedom, as they do at a vertex of the feasible set.
		// "solved" is the subproblem at its own optimum. "stationary_on_working_set"
		// is the subproblem at a degenerate vertex: it released a bound and was
		// blocked again by the same one without moving, so it cannot prove
		// optimality and cannot move either. For the question being asked here -
		// is there an admissible direction - the two answer the same way, and
		// they are told apart in the reason rather than run together.
		// The region has to be big enough for a zero step to mean something. An
		// absolute threshold does not say that where the variables are hundreds of
		// metres: measured, a run reported a vertex at a KKT residual of 22.5 with
		// its region collapsed to 1.08e-10, which is not a vertex but a solver
		// that had stopped being able to move.
		const stepScale = Math.max(1, Math.hypot(...x));
		const pinnedByModel = radius > stepTolerance * stepScale
			&& (step.qpStatus === "solved" || step.qpStatus === "stationary_on_working_set");
		// The step tolerance is relative to the point. An absolute 1e-12 means
		// nothing where the variables are hundreds of metres: measured at a
		// vertex, the steps were 3.6e-10 and then 9.0e-16, all of them zero for
		// any purpose and only the last of them small enough to say so.
		if (stepNorm <= stepTolerance * stepScale && violation.total <= feasibilityTolerance
			&& (stationary || pinnedByModel)) {
			history.push({
				iteration, status: "step_too_small", kkt, violation: violation.total,
				reason: stationary
					? "stationary"
					: step.qpStatus === "solved" ? "no_admissible_direction" : "degenerate_vertex",
			});
			return {
				ok: true, status: "stationary",
				reason: stationary
					? "stationary"
					: step.qpStatus === "solved" ? "no_admissible_direction" : "degenerate_vertex",
				x, state, history,
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
		// Only the violated part of an inequality is charged, so only the violated
		// part can be given up - which is what the relaxation gives back.
		const penaltyDrop = (state.h ?? []).reduce(
			(sum, value, j) => sum + (weights.equality[j] ?? 0) * Math.abs(value), 0
		) + (state.g ?? []).reduce(
			(sum, value, j) => sum + (weights.inequality[j] ?? 0) * Math.max(0, value), 0
		);
		const directional = step.gradientAlongStep - (1 - (step.delta ?? 0)) * penaltyDrop;
		// the curvature bound is the theoretical guarantee; when it is zero the
		// Hessian has no curvature along the step and only the penalty term can
		// supply descent
		const predictedDecrease = Math.min(directional, step.curvature);

		// A step along which the merit does not fall is not searched along. The
		// exact directional derivative is known here, and when it is not negative
		// there is no step length that Armijo can accept - yet the curvature bound
		// used as its reference is negative, so the search would be sent hunting
		// for a decrease the model itself denies. Measured on the exact ramp rule
		// with eight declared points: thirty to thirty-eight backtracks to alpha
		// near 1e-11 at a merit slope of +5.8e-5, repeatedly, while the iterate
		// crept along an active ramp row.
		//
		// Such a step is the quasi-Newton matrix speaking, not the problem: with
		// the equalities met to 1e-6 the subproblem returned |d| = 1.3 to restore
		// them, an objective rise of 2.8e-4 against a penalty drop of 2.3e-4. The
		// estimate is discarded and the region tightened, and the next subproblem
		// starts from the identity again. On the twelve-point scenario this
		// alone takes the exact form from 73 iterations with eight backtracking
		// episodes to 44 with none - the same count as the bound form.
		if (!(directional < 0)) {
			H = identityMatrix(n, initialHessianScale);
			radius = Math.max(minTrustRadius, radius * trustShrink);
			history.push({ iteration, status: "no_descent", directional, radius });
			continue;
		}

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
			value
			+ (evaluated.Jh ?? []).reduce(
				(sum, row, j) => sum + row[i] * step.multipliers.equality[j], 0)
			+ (evaluated.Jg ?? []).reduce(
				(sum, row, j) => sum + row[i] * (step.multipliers.inequality[j] ?? 0), 0));
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
			qpStatus: step.qpStatus,
			activeRows: step.activeRows ?? [],
			inequalities: Object.freeze((state.g ?? []).map((value, j) => Object.freeze({
				residual: value,
				violated: value > 0,
				multiplier: step.multipliers.inequality[j] ?? 0,
				weight: weights.inequality[j],
			}))),
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
