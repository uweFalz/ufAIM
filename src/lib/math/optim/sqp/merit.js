// src/lib/math/optim/sqp/merit.js
//
// l1 merit function for constrained optimisation, with Powell's per-constraint
// penalty weights.
//
//     l1(x; eta) = f(x) + sum_i eta_i * max{0, g_i(x)} + sum_j etaHat_j * |h_j(x)|
//
// An iterate of an SQP method is in general infeasible, so "better" cannot be
// read off the objective alone: a better objective is easy to buy at the cost
// of feasibility. The merit function weighs both in one scalar.
//
// The weights must dominate the multipliers of the QP subproblem, otherwise the
// search direction is not guaranteed to be a descent direction of the merit.
// Two rules are offered:
//
//   "monotone" (Gerdts 3.8)  eta_i <- max{ eta_i, |lambda_i| + epsilon }
//   "powell"                 eta_i <- max{ |lambda_i|, (eta_i + |lambda_i|)/2 }
//
// Powell's is the practical refinement and lets a weight fall again once its
// multiplier drops. That is desirable when the multipliers are trustworthy and
// harmful when they are not: with a linear objective and active bounds the
// least-squares reconstruction of the multipliers understates them, the weights
// decay with them, and the iteration then buys objective by giving feasibility
// back. Measured on a nine-element alignment: the constraint violation was
// already at 7e-5 and grew back to 2.4 as the length kept falling.
//
// The monotone rule is therefore the default. It never lets a weight decay, so
// feasibility once bought stays bought.
//
// The weights also carry a safety factor. The estimate eta >= |lambda| is a
// local statement; away from the solution a nonlinear constraint can grow more
// than its linearisation promised, and a weight sitting just above its
// multiplier has no margin left. Measured: with eta = 1.05 against |mu| = 0.9
// the iteration still traded feasibility away, and a factor of two stopped it.
//
// Pure numerics: no dependencies.

export const MERIT_VERSION = "optim/sqp/merit/0.1";

function toArray(value) {
	return Array.isArray(value) ? value : [];
}

/** Constraint violation of the l1 merit, without the objective. */
export function constraintViolation({ g = [], h = [] } = {}) {
	let inequality = 0;
	for (const value of toArray(g)) inequality += Math.max(0, value);
	let equality = 0;
	for (const value of toArray(h)) equality += Math.abs(value);
	return { inequality, equality, total: inequality + equality };
}

/**
 * @param {object} state       { f, g, h } at the point
 * @param {object} weights     { inequality: number[], equality: number[] }
 */
export function l1Merit(state, weights) {
	const g = toArray(state?.g);
	const h = toArray(state?.h);
	const wg = toArray(weights?.inequality);
	const wh = toArray(weights?.equality);
	let penalty = 0;
	for (let i = 0; i < g.length; i++) penalty += (wg[i] ?? 0) * Math.max(0, g[i]);
	for (let j = 0; j < h.length; j++) penalty += (wh[j] ?? 0) * Math.abs(h[j]);
	return (state?.f ?? 0) + penalty;
}

/**
 * Per-constraint weight update from the QP multipliers.
 * @param {"monotone"|"powell"} [rule]
 */
export function updatePenaltyWeights(
	weights,
	multipliers,
	{ rule = "monotone", epsilon = 1e-6, safety = 2 } = {}
) {
	const step = (previous = [], current = []) => current.map((value, i) => {
		const magnitude = Math.abs(value) * safety;
		const old = previous[i] ?? 0;
		return rule === "powell"
			? Math.max(magnitude, 0.5 * (old + magnitude))
			: Math.max(old, magnitude + epsilon);
	});
	return Object.freeze({
		inequality: step(weights?.inequality, multipliers?.inequality),
		equality: step(weights?.equality, multipliers?.equality),
	});
}

export function createPenaltyWeights({ inequalityCount = 0, equalityCount = 0, initial = 1 } = {}) {
	return Object.freeze({
		inequality: new Array(inequalityCount).fill(initial),
		equality: new Array(equalityCount).fill(initial),
	});
}
