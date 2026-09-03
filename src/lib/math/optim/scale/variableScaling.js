// src/lib/math/optim/scale/variableScaling.js
//
// Diagonal variable scaling by engineering magnitude.
//
// The obvious alternative, normalising each Jacobian column to unit norm, was
// measured to make an alignment fit substantially worse: it changes from
// iteration to iteration and interacts with the damping, so a uniform damping
// term then over-damps exactly the high-leverage directions. A fixed diagonal,
// known before the solve, does not have that failure mode.
//
// Pure numerics: no dependencies.

export const VARIABLE_SCALING_VERSION = "optim/scale/variableScaling/0.1";

/** Map scaled coordinates back to the caller's units. */
export function unscale(scaled, scales) {
	return scaled.map((value, i) => value * (scales[i] ?? 1));
}

/** Map the caller's units into scaled coordinates. */
export function scale(values, scales) {
	return values.map((value, i) => value / (scales[i] ?? 1));
}

/**
 * Wrap an evaluator so that it works in scaled coordinates while the caller's
 * functions keep seeing physical units.
 *
 * Every derivative with respect to x has to be transformed, and the spread below
 * is a trap for exactly that reason: it passes anything new straight through,
 * transformed or not. Jg went through it untransformed once, which left the
 * inequality Jacobian in physical units while the step it multiplied was in
 * scaled ones - a factor of a thousand on the curvature columns, and an active
 * set that churned through 66 releases without ever settling.
 *
 * Values are not derivatives: f, h and g are the same number in either
 * coordinate system and are passed through as they are.
 */
export function scaleEvaluator(evaluate, scales) {
	const scaleRow = (row) => row.map((value, i) => value * (scales[i] ?? 1));
	return (scaledX) => {
		const x = unscale(scaledX, scales);
		const state = evaluate(x);
		return {
			...state,
			gradF: state.gradF?.map((value, i) => value * (scales[i] ?? 1)),
			Jh: state.Jh?.map(scaleRow),
			Jg: state.Jg?.map(scaleRow),
		};
	};
}
