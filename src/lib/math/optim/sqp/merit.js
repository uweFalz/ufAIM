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
// Powell's update, which weighs every constraint on its own rather than using a
// single global penalty, is used here:
//
//     eta_i     <- max{ |lambda_i|, (eta_i + |lambda_i|) / 2 }
//     etaHat_j  <- max{ |mu_j|,     (etaHat_j + |mu_j|) / 2 }
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

/** Powell's per-constraint weight update from the QP multipliers. */
export function updatePenaltyWeights(weights, multipliers) {
	const step = (previous = [], current = []) => current.map((value, i) => {
		const magnitude = Math.abs(value);
		const old = previous[i] ?? 0;
		return Math.max(magnitude, 0.5 * (old + magnitude));
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
