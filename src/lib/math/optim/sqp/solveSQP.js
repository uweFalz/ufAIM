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
import { restoreFeasibility } from "./restoreFeasibility.js";

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
	// The feasibility test is relative to the point, like the step test: a
	// violation is measured in the constraints' units, and those grow with
	// the variables. Measured on a 20 km alignment the end pose stalled at
	// 1e-5 under every Hessian with full steps and no backtracking - the
	// residual (production geometry) and its Jacobian (moment chain)
	// disagree by that much over that length - and an absolute 1e-9 called
	// a fit at the noise floor unfinished, a restoration from 140 to 3.7e-9
	// failed, and a verdict fired at 2e-9. 1e-9 of ‖x‖ is 1e-5 there and
	// 1e-7 on a 100 m turnout.
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
	// The active-set subproblem's budget. Fixed at 200 it ran out on 82
	// variables with 74 of them on the box after a far start: 80 to 170
	// releases and blocks per subproblem, qp_failed at the 29th step. Ten per
	// variable, never under 200: the same two runs reach a fit instead.
	qpIterations: qpIterationsGiven = null,
	// How a trial step is accepted. "filter": a Fletcher-Leyffer filter on
	// (violation, f) with the switching condition below; "merit": the l1
	// merit's Armijo test. The filter is the default since the measurement in
	// docs/app/architecture/AXTRAN2_FILTER_MERIT_DESIGN.md: level or better
	// than the merit on the whole corpus (points objective 161 of 161
	// verdicts against 159, no row worse), half the iterations on the length
	// objective, and the only rule under which the shortest alignment over
	// 110 and 119 elements reaches a verdict - the merit prices a metre of
	// end miss at two metres of length there and walks kilometres off. The
	// merit keeps pricing the weights and the merit_stationary verdict.
	acceptance = "filter",
	filterMargin = 1e-5,
	// the violation may not exceed this multiple of max(1, its value at the
	// first subproblem): 1e4 in the literature; 1e2 measured, it keeps the
	// 110-element shortest alignment on its sample points where 1e4 let it
	// walk off them
	filterCeiling = 1e2,
	// The switching condition (Wächter-Biegler 2006, (19)-(20)): when the
	// model predicts a decrease of f that is large against the violation,
	// [-alpha ∇f'd]^sF · alpha^(1-sF) > delta · h^sTheta, the trial has to
	// satisfy Armijo on f (eta) and is an f-type step that leaves the filter
	// alone; otherwise the filter decides against the current point with the
	// margins, and an accepted h-type step adds the point left behind.
	filterSwitching = true,
	// The correction is also tried when the full step leaves more than this
	// fraction of the violation behind, not only when it raises it: a step
	// that closes the linearised constraints and leaves nine tenths of the
	// true residual is the Maratos effect at work whether or not the residual
	// grew. Measured at 0.1 on the corpus 0–161 against 1 (a rising violation
	// only): the strict lexicographic order unchanged at 120 of 161, the
	// single objectives 159 and 161 of 161 to 160 and 161 with 127 of 322
	// rows moving either way, and the creep on AHBI_Gl_033 (below) closed in
	// 74 iterations instead of ending as a verdict. Decided as the default on
	// 2026-09-10 (Uwe Falz).
	correctionClosure = 0.1,
	// A point that is stationary to stationarityTolerance and infeasible,
	// whose violation over this many consecutive such iterations shrinks at a
	// rate that will not reach the tolerance within the budget, is a creep
	// and is reported as one. Measured on AHBI_Gl_033 under the strict
	// lexicographic order: from iteration 40 to 1000 every step was full and
	// uncorrected, f fell by 5e-3 a step, the relative KKT residual sat at
	// 1.4e-5 and the violation at 1.5e-4 fell by one part in ten thousand a
	// step - the Maratos effect without its correction, since the correction
	// is only tried when the violation rises. Twenty iterations tell that
	// rate from the Newton closure of a converging run.
	creepWindow = 20,
	// Each subproblem starts from the working set the previous one ended with
	// (solveBoxQP's warmStart). Measured on a 64-element points fit the
	// active set was half of the solve's time, rebuilding much the same set
	// from nothing at every iteration. On the corpus (235 files, both
	// objectives and the strict order) the warm start halves the active-set
	// iterations (536k -> 248k and 1.31M -> 583k) and takes 8 % and 18 % off
	// the time, with the verdicts unchanged or better.
	qpWarmStart = true,
	filterSTheta = 1.1,
	filterSF = 2.3,
	filterDelta = 1,
	filterEta = 1e-4,
	initialHessianScale = 1,
	// Where the curvature estimate comes from. "bfgs" builds it from the
	// Lagrangian gradient differences, from the identity. "provided" takes the
	// evaluator's hessian at every point it has one - a Gauss-Newton J'J for a
	// least-squares objective - and falls back to BFGS where it has none. A
	// provided Hessian carries no constraint curvature; that is the trade.
	hessian: hessianSource = "bfgs",
	// the multiple of the identity the constraint-curvature estimate starts
	// from when the Hessian is provided (see below)
	structuredStart = 1e-4,
	// the relative decrease of the objective a step has to achieve for the
	// next subproblem to use the provided curvature again (Fletcher-Xu)
	hybridSwitch = 0.2,
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
	// How many consecutive iterations the subproblem may come back fully
	// relaxed and without a step before that is reported as the verdict it is.
	// The relaxation makes (d, delta) = (0, 1) feasible by construction, so a
	// subproblem that returns exactly that has said: no step within the bounds
	// meets the linearised constraints. Measured on a real turnout with a
	// transition on its floor - the only linearised way to close the end pose
	// was to shorten it - the solve returned that answer 199 times in a row and
	// was reported as max_iterations. It is not a step that ran out; it is a
	// point at which the model cannot move, and the caller needs to know which.
	relaxedStallLimit = 5,
	// What to do at that verdict. "on-verdict" restores feasibility - minimises
	// the violation alone under the bounds, by projected Gauss-Newton steps -
	// and continues from the feasible point it reaches; "off" stops with the
	// verdict as before. Measured on every small alignment the corpus had left
	// without a verdict: at most three restoration steps, landing on the file's
	// own geometry, after which the solve has nothing left to do. The design is
	// in docs/app/architecture/AXTRAN2_RESTORATION_PHASE_DESIGN.md.
	restoration = "on-verdict",
	// how often a solve may restore; a verdict, a restoration and a verdict
	// again is a loop, and the third verdict is reported as one
	restorationLimit = 2,
	// "eager" restores on the verdict too, and before the first subproblem
	// when the start violates the constraints by more than this many trust
	// radii. A linearisation is only good for a step the size of its region;
	// measured on 64 elements with the end pose 613 m off and a region of
	// 23 m, the merit took a tenth of every step, the region shrank to 3 m, and
	// the box-dominated subproblem ran out of iterations at the 29th step. One
	// radius, not ten: on 71 elements the same happened from 239 against 70,
	// while 41 elements from 83 against 91 solved.
	eagerViolationRadii = 1,
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
	const qpIterations = qpIterationsGiven ?? Math.max(200, 10 * n);
	if (acceptance !== "merit" && acceptance !== "filter") {
		throw new Error(`solveSQP: acceptance must be "merit" or "filter", got ${JSON.stringify(acceptance)}`);
	}
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
	let relaxedStalls = 0;
	const creep = [];
	let warmStart = null;
	let relaxedStallViolation = 0;
	let restorations = 0;
	let restorationSteps = 0;
	let radius = Number.isFinite(trustRadius)
		? trustRadius
		: Math.max(1, 0.1 * Math.max(...x.map(Math.abs), 0));
	let state = evaluate(x);
	// A provided Hessian is the objective's curvature only. The constraints'
	// share of the Lagrangian curvature is estimated alongside by BFGS on the
	// multiplier-weighted constraint gradient differences (structured secant,
	// Dennis-Gay-Welsch), from the identity BFGS itself starts from, and the
	// two are added. From a thousandth of it the sum was near singular where
	// the residuals were few (six points against eleven unknowns): the
	// subproblem cycled through 67 releases at the first step, and on another
	// file the region shrank 77 times to 1e-10. Measured without it on 41 elements: Gauss-Newton alone took
	// the objective down in a fifth of the iterations and then could not close
	// the end pose, rejecting every step at the finish.
	let B = identityMatrix(n, structuredStart * initialHessianScale);
	let hybridMode = hessianSource === "provided" ? "gauss-newton" : "bfgs";
	const curvatureOf = (evaluated) => {
		if (hessianSource !== "provided" || !evaluated.hessian) return null;
		return evaluated.hessian.map((row, i) => row.map((value, j) => value + B[i][j]));
	};
	let H = curvatureOf(state) ?? identityMatrix(n, initialHessianScale);
	let weights = createPenaltyWeights({
		equalityCount: state.h?.length ?? 0,
		inequalityCount: state.g?.length ?? 0,
	});
	const history = [];
	let previousMerit = null;
	let stalls = 0;
	const filter = [];
	let filterCeilingValue = null;

	// The 1-norm, not the 2-norm: the constraints' units grow with the sum of
	// the variables (an end pose over the whole length), and the 2-norm of a
	// hundred short lengths is a fifth of it. Measured on 110 elements over
	// 11 km the verdict fired at a violation of 2e-6 against a 2-norm scale of
	// 2e-6, with the objective flat and every step full.
	const feasibilityScale = () => Math.max(1, x.reduce((sum, value) => sum + Math.abs(value), 0));

	// Restore feasibility from x and continue as from a fresh start: the
	// curvature estimate and the penalty weights described the path to here,
	// not the path from the feasible point. Returns the failure to hand back,
	// or null when the solve may go on.
	function restoreFrom(iteration) {
		restorations += 1;
		const restored = restoreFeasibility({ evaluate, x, lower: lo, upper: up, feasibilityTolerance: feasibilityTolerance * feasibilityScale() });
		restorationSteps += restored.steps;
		// A restoration that stalls short of the tolerance but inside the
		// region is a start the solve can finish from; measured on 71 elements
		// over 20 km, three steps took the violation from 140 to 3.7e-9 and the
		// absolute 1e-9 then called that a failure. What the box genuinely
		// excludes stays one: the residual there is a distance, not a rounding.
		// A restoration that did not move is not one, whatever the region says:
		// measured on 110 elements, two of them returned in zero steps and were
		// counted as restored. Progress is required as well as the region.
		const withinRegion = restored.violationAfter <= eagerViolationRadii * radius
			&& restored.violationAfter < restored.violationBefore;
		history.push({
			iteration, status: restored.ok || withinRegion ? "restored" : restored.status, restoration: restorations,
			feasible: restored.ok,
			steps: restored.steps, violationBefore: restored.violationBefore, violationAfter: restored.violationAfter,
		});
		if (!restored.ok && !withinRegion) {
			return {
				ok: false, status: "restoration_failed", x: restored.x, state: restored.state, history,
				iterations: iteration, restorationSteps,
				reason: `${restored.status}: the violation went from ${restored.violationBefore.toExponential(2)} to ${restored.violationAfter.toExponential(2)} in ${restored.steps} steps`,
			};
		}
		x = restored.x;
		state = restored.state;
		B = identityMatrix(n, structuredStart * initialHessianScale);
		H = curvatureOf(state) ?? identityMatrix(n, initialHessianScale);
		weights = createPenaltyWeights({
			equalityCount: state.h?.length ?? 0,
			inequalityCount: state.g?.length ?? 0,
		});
		radius = Number.isFinite(trustRadius) ? trustRadius : Math.max(1, 0.1 * Math.max(...x.map(Math.abs), 0));
		relaxedStalls = 0;
		creep.length = 0;
		warmStart = null;
		previousMerit = null;
		stalls = 0;
		// the filter described the path to the verdict, not the path from here
		filter.length = 0;
		filterCeilingValue = null;
		return null;
	}

	if (restoration === "eager" && constraintViolation(state).total > eagerViolationRadii * radius) {
		const failure = restoreFrom(0);
		if (failure) return failure;
	}

	for (let iteration = 0; iteration < maxIterations; iteration++) {
		const violation = constraintViolation(state);
		const feasible = feasibilityTolerance * feasibilityScale();

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
			warmStart: qpWarmStart ? warmStart : null,
			pinnedVariables: heldByBounds(x),
			activeInequalities: (state.g ?? []).reduce((held, value, j) => {
				if (value > -activeTolerance * Math.max(1, Math.abs(value))) held.push(j);
				return held;
			}, []),
		});

		if (step.ok) warmStart = step.warmStart ?? null;
		if (!step.ok) {
			// A subproblem that ran out is the box overreaching as much as a
			// failed search is: at a degenerate vertex with an extra equality
			// (the lexicographic budget phase) the active set cycled through 67
			// releases and 66 blocks with Bland's rule running, on eight
			// variables. A smaller region changes the working set. Shrink and
			// try again; give up only once the region is too small to be the
			// explanation.
			if (step.status === "max_iterations" && radius > minTrustRadius) {
				radius = Math.max(minTrustRadius, radius * trustShrink);
				history.push({ iteration, status: "trust_shrunk", reason: "qp_failed", radius });
				continue;
			}
			history.push({
				iteration, status: "qp_failed", reason: step.status,
				detail: step.detail ?? step.reason ?? null,
			});
			return { ok: false, status: "qp_failed", x, state, history, iterations: iteration, restorationSteps };
		}

		const stepNorm = Math.hypot(...step.d);
		// "Fully relaxed" in practice is delta within a thousandth of one, and
		// "without progress" is measured on the violation, not on the step: the
		// subproblem hands back a step of 2.5e-4 every time, and the violation
		// creeps from 14.84 to 14.81 over sixty of them.
		{
			const violationNow = constraintViolation(state).total;
			// A fully relaxed subproblem at a feasible point is not a verdict
			// about feasibility: with h at 1e-12 any delta satisfies the relaxed
			// rows, and "no progress on the violation" is then true of noise.
			// Measured on 41 elements with a provided Hessian: the verdict fired
			// at a violation of 9e-13 and restored a point that needed nothing.
			if (step.delta >= 1 - 1e-3 && violationNow > feasible) {
				if (relaxedStalls === 0) relaxedStallViolation = violationNow;
				relaxedStalls += 1;
				const progress = relaxedStallViolation > 0 ? 1 - violationNow / relaxedStallViolation : 0;
				if (relaxedStalls >= relaxedStallLimit && progress < 0.01) {
					history.push({
						iteration, status: "infeasible_subproblem", delta: step.delta, violation: violationNow,
						reason: `the subproblem came back fully relaxed ${relaxedStalls} times in a row and the violation fell by ${(progress * 100).toFixed(2)} %`,
					});
					if ((restoration === "on-verdict" || restoration === "eager") && restorations < restorationLimit) {
						const failure = restoreFrom(iteration);
						if (failure) return failure;
						continue;
					}
					return {
						ok: false, status: "infeasible_subproblem", x, state, history, iterations: iteration, restorationSteps,
						reason: "no step within the bounds meets the linearised constraints",
					};
				}
				if (relaxedStalls >= relaxedStallLimit) { relaxedStalls = 0; }
			} else {
				relaxedStalls = 0;
			}
		}
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
		if (violation.total <= feasible && kkt <= kktTolerance * gradientScale) {
			history.push({
				iteration, status: "converged", kkt, violation: violation.total,
				relativeKkt: kkt / gradientScale,
				// the rows at the point that converged, not only their aggregate:
				// the accepted entries carry the rows of the point they started
				// from, and a last step that closes a row leaves that row's
				// closure recorded nowhere else
				inequalities: Object.freeze((state.g ?? []).map((value, j) => Object.freeze({
					residual: value, violated: value > 0, multiplier: step.multipliers.inequality[j] ?? 0, weight: weights.inequality[j],
				}))),
				equalities: Object.freeze((state.h ?? []).map((value, j) => Object.freeze({
					residual: value, multiplier: step.multipliers.equality[j] ?? 0, weight: weights.equality[j],
				}))),
			});
			return {
				ok: true, status: "converged", x, state, history,
				iterations: iteration, restorationSteps, multipliers: step.multipliers, hessian: H,
			};
		}
		// Stationary and infeasible, with the violation shrinking too slowly to
		// reach the tolerance within the budget: the objective is at rest on
		// the linearised constraints and the constraints themselves are not
		// closing, which no further step of the same kind will change. The
		// rate is read off the window as a geometric mean; a violation that
		// does not fall at all needs infinitely many iterations. The verdict
		// is handed to the restoration like the fully relaxed subproblem's,
		// and reported as such when it comes back.
		if (stationary && violation.total > feasible) {
			creep.push(violation.total);
			if (creep.length > creepWindow) creep.shift();
			if (creep.length === creepWindow) {
				const ratio = Math.pow(violation.total / creep[0], 1 / (creepWindow - 1));
				const needed = ratio < 1 ? Math.log(feasible / violation.total) / Math.log(ratio) : Infinity;
				if (needed > maxIterations - iteration) {
					history.push({
						iteration, status: "infeasible_stationary", reason: "creep", kkt, violation: violation.total,
						ratio, needed: Number.isFinite(needed) ? needed : null, remaining: maxIterations - iteration,
					});
					creep.length = 0;
					if ((restoration === "on-verdict" || restoration === "eager") && restorations < restorationLimit) {
						const failure = restoreFrom(iteration);
						if (failure) return failure;
						continue;
					}
					return {
						ok: false, status: "infeasible_stationary", reason: "creep", x, state, history,
						iterations: iteration, restorationSteps, multipliers: step.multipliers, hessian: H,
					};
				}
			}
		} else {
			creep.length = 0;
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
		if (stepNorm <= stepTolerance * stepScale && violation.total <= feasible
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
				iterations: iteration, restorationSteps, multipliers: step.multipliers, hessian: H,
			};
		}

		weights = updatePenaltyWeights(weights, step.multipliers, { rule: penaltyRule, safety: penaltySafety });

		const meritAt0 = l1Merit(state, weights);

		// Feasible, and the merit no longer moves: the iteration has reached what
		// this gradient can resolve. Report it as stationary rather than running
		// out of iterations, which reads like a failure and is not one.
		if (previousMerit !== null
			&& violation.total <= feasible
			&& stationary
			&& Math.abs(previousMerit - meritAt0) <= meritTolerance * (1 + Math.abs(meritAt0))) {
			stalls += 1;
			if (stalls >= stallLimit) {
				history.push({ iteration, status: "merit_stationary", kkt, violation: violation.total });
				return {
					ok: true, status: "stationary", x, state, history,
					iterations: iteration, restorationSteps, multipliers: step.multipliers, hessian: H,
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
		// The no-descent rule is the merit's: under the filter a step the merit
		// cannot fall along may still be an h-type step, and the filter decides.
		// Measured on the vertex tier of the nine-element scenario: the rule
		// shrank the region 36 times around a step the filter would have judged,
		// and the subproblem ran out.
		// A step of length zero has nothing for the filter to judge: the relaxed
		// subproblem is at a vertex the box holds, and the relaxed-stall verdict
		// above counts its way to infeasible_subproblem; sent to the search it
		// came back line_search_failed at once (the box-excluded equality of #18).
		if (acceptance === "filter" && stepNorm <= stepTolerance * Math.max(1, Math.hypot(...x))) {
			// A zero step with the relaxation at one is the relaxed-stall verdict's
			// case above. Any other zero step is the region: at a degenerate vertex
			// with an extra equality the subproblem came back with delta 0.57 and
			// no step 872 times in a row while the region sat at 1e-9 - a loop to
			// the budget, not a verdict. Shrink the region as after a failed
			// search, and stop at its floor.
			if (radius <= minTrustRadius) {
				history.push({ iteration, status: "line_search_failed", reason: "region_collapsed", delta: step.delta, violation: violation.total, radius });
				return { ok: false, status: "line_search_failed", reason: "region_collapsed", x, state, history, iterations: iteration, restorationSteps };
			}
			radius = Math.max(minTrustRadius, radius * trustShrink);
			history.push({ iteration, status: "no_step", delta: step.delta, violation: violation.total, radius });
			continue;
		}
		if (!(directional < 0) && acceptance !== "filter") {
			B = identityMatrix(n, structuredStart * initialHessianScale);
			H = curvatureOf(state) ?? identityMatrix(n, initialHessianScale);
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
		// filter acceptance: not dominated by any remembered (h, f), nor by the
		// current point, with the margins; and under the ceiling
		if (acceptance === "filter" && filterCeilingValue === null) filterCeilingValue = filterCeiling * Math.max(1, violation.total);
		let acceptedType = null;
		const filterAccepts = (evaluated, alpha) => {
			const h = constraintViolation(evaluated).total;
			const f = evaluated.f;
			if (!(h <= filterCeilingValue)) return false;
			const beats = (entry) => h <= (1 - filterMargin) * entry.h || f <= entry.f - filterMargin * entry.h;
			if (!filter.every(beats)) return false;
			const model = alpha * step.gradientAlongStep;
			const switching = filterSwitching && model < 0
				&& Math.pow(-model, filterSF) * Math.pow(alpha, 1 - filterSF) > filterDelta * Math.pow(violation.total, filterSTheta);
			if (switching) {
				if (f <= state.f + filterEta * model) { acceptedType = "f"; return true; }
				return false;
			}
			if (beats({ h: violation.total, f: state.f })) { acceptedType = "h"; return true; }
			return false;
		};
		const meritOfState = (evaluated, alpha) => acceptance === "filter"
			? (filterAccepts(evaluated, alpha) ? meritAt0 + alpha * predictedDecrease : Infinity)
			: l1Merit(evaluated, weights);
		const meritOf = (candidate) => {
			let evaluated;
			try { evaluated = evaluate(candidate); } catch { return null; }
			if (!Number.isFinite(evaluated?.f)) return null;
			return { merit: meritOfState(evaluated, 1), state: evaluated };
		};
		const clamp = (candidate) => candidate.map((value, i) =>
			Math.min(Math.max(value, lo[i]), up[i]));

		const full = meritOf(clamp(x.map((value, i) => value + step.d[i])));
		const armijo = (value, alpha) => value <= meritAt0 + 0.1 * alpha * predictedDecrease;

		let corrected = null;
		// Under the filter the correction is tried whenever the full step raises
		// the violation, not only when it is refused: measured on the
		// nine-element scenario, accepting the raw step at once crept to a vertex
		// 0.2 m longer than the one the corrected steps reach.
		const raisesViolation = acceptance === "filter" && full
			&& constraintViolation(full.state).total > correctionClosure * violation.total;
		if (full && (!armijo(full.merit, 1) || raisesViolation) && (state.h ?? []).length && (predictedDecrease < 0 || raisesViolation)) {
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
				return meritOfState(evaluated, alpha);
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
			return { ok: false, status: "line_search_failed", reason: search.status, x, state, history, iterations: iteration, restorationSteps };
		}

		if (acceptance === "filter") {
			// an h-type step adds the point left behind to the filter, with the
			// margins taken; an f-type step leaves the filter alone
			if (acceptedType !== "f") filter.push({ h: (1 - filterMargin) * violation.total, f: state.f - filterMargin * violation.total });
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
		const constraintGradient = (evaluated) => evaluated.gradF.map((_, i) =>
			(evaluated.Jh ?? []).reduce(
				(sum, row, j) => sum + row[i] * step.multipliers.equality[j], 0)
			+ (evaluated.Jg ?? []).reduce(
				(sum, row, j) => sum + row[i] * (step.multipliers.inequality[j] ?? 0), 0));
		const s = trialState.x.map((value, i) => value - x[i]);
		if (hessianSource === "provided" && trialState.state.hessian) {
			// Fletcher-Xu: the provided curvature is the objective's Gauss-Newton
			// part, good while the residuals fall and blind to their curvature
			// once they do not. Measured on 64 elements: in the valley the
			// subproblem predicted a decrease of 3e-4 a step and got 1e-8, a
			// thousand full steps with the gradient halving every hundred. So
			// the step decides. A step that took at least hybridSwitch of the
			// objective keeps Gauss-Newton with the constraints' secant; one
			// that did not updates the whole current matrix by BFGS on the
			// Lagrangian, which learns what the residuals' curvature adds. The
			// next large decrease hands back to Gauss-Newton.
			const decrease = (state.f - trialState.state.f) / Math.max(Math.abs(state.f), 1e-300);
			if (decrease >= hybridSwitch) {
				const before = constraintGradient(state);
				const yc = constraintGradient(trialState.state).map((value, i) => value - before[i]);
				B = modifiedBfgsUpdate(B, s, yc);
				H = curvatureOf(trialState.state);
				hybridMode = "gauss-newton";
			} else {
				const before = lagrangeGradient(state);
				const y = lagrangeGradient(trialState.state).map((value, i) => value - before[i]);
				H = modifiedBfgsUpdate(H, s, y);
				hybridMode = "bfgs";
			}
		} else {
			const before = lagrangeGradient(state);
			const y = lagrangeGradient(trialState.state).map((value, i) => value - before[i]);
			H = modifiedBfgsUpdate(H, s, y);
		}

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
			qpWarm: step.qpWarm ?? null,
			gradientScale,
			hessian: hybridMode,
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
		iterations: maxIterations, restorationSteps, hessian: H,
	};
}
