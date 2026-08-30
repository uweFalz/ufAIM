// src/lib/math/optim/sqp/lineSearchArmijo.js
//
// Backtracking Armijo line search on the l1 merit function.
//
// The exact l1 merit is not differentiable at a local minimum whenever the
// objective gradient does not vanish, which is the normal case in constrained
// optimisation. It is still directionally differentiable, and for a KKT point
// of the QP subproblem the directional derivative obeys
//
//     l1'(x; d; eta) <= -d' Q d < 0
//
// provided Q is positive definite and the weights dominate the multipliers.
// That upper bound is what this search uses as the predicted decrease, so it
// never needs a gradient of a function that has none.
//
// Pure numerics: no dependencies.

export const LINE_SEARCH_ARMIJO_VERSION = "optim/sqp/lineSearchArmijo/0.1";

/**
 * @param {object} input
 * @param {number} input.meritAt0            merit at the current point
 * @param {number} input.predictedDecrease   -d'Qd, must be negative
 * @param {(alpha: number) => number|null} input.meritAt  evaluates the merit; null when the trial point cannot be built
 */
export function lineSearchArmijo({
	meritAt0,
	predictedDecrease,
	meritAt,
	beta = 0.5,
	sigma = 0.1,
	maxBacktracks = 40,
	minAlpha = 1e-12,
} = {}) {
	if (typeof meritAt !== "function") {
		return { ok: false, status: "invalid", reason: "meritAt is required" };
	}
	// A non-negative prediction means the direction carries no guaranteed
	// descent; the caller has to fix the Hessian, not the line search.
	if (!(predictedDecrease < 0)) {
		return { ok: false, status: "no_descent_direction", predictedDecrease };
	}

	let alpha = 1;
	for (let backtracks = 0; backtracks <= maxBacktracks; backtracks++) {
		const value = meritAt(alpha);
		if (typeof value === "number" && Number.isFinite(value)
			&& value <= meritAt0 + sigma * alpha * predictedDecrease) {
			return { ok: true, status: "accepted", alpha, backtracks, merit: value };
		}
		alpha *= beta;
		if (alpha < minAlpha) break;
	}
	return { ok: false, status: "step_too_small", alpha };
}
