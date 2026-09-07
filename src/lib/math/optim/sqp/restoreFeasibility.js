// src/lib/math/optim/sqp/restoreFeasibility.js
//
// Feasibility restoration: minimise the constraint violation alone, under the
// bounds, until the point is feasible, and hand the SQP a feasible start.
//
// This exists for the point where the relaxed subproblem cannot move. Powell's
// relaxation scales every equality row by one slack delta, and (d, delta) =
// (0, 1) is feasible by construction; when no step inside the bounds meets the
// linearised constraints, that is what the subproblem returns, and the solve
// stops with infeasible_subproblem. Measured on every three-element turnout
// of the corpus whose truth has an element on a bound: the linearisation at
// the perturbed start says the only way to close the end pose is to shorten
// the transition, and its floor forbids that. The problem is feasible - the
// truth sits exactly on the floor - but not along that linearisation.
//
// A least-squares step on the violation does what the single slack cannot: it
// reduces the residual as far as the box allows, relinearises there, and the
// next linearisation allows more. Measured on the same turnouts, from the
// point the solve stopped at: the first projected Gauss-Newton step takes |h|
// from 9.5 to 0.03 with the transition still on its floor, the second lifts
// it off and reaches 8e-7, the third is at 7e-10 - on the file's own geometry
// to 0.00 %. The ordinary solve then has nothing left to do.
//
//     minimise   1/2 |r(x)|^2,   r = [h; max(0, g)]
//     subject to lo <= x <= up
//
// each step   minimise 1/2 |J d + r|^2 + 1/2 mu |d|^2   in the box, by
// solveBoxQP with H = J'J + mu I and c = J'r, then Armijo on |r| with the
// trial point projected into the box. mu is Levenberg-Marquardt damping.
//
// Pure numerics: depends only on the box QP.

import { solveBoxQP } from "../qp/solveBoxQP.js";

export const RESTORE_FEASIBILITY_VERSION = "optim/sqp/restoreFeasibility/0.1";

function dot(a, b) {
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
	return sum;
}

/** the violated part of the constraints and its Jacobian */
function residualOf(state) {
	const rows = [];
	const jacobian = [];
	(state.h ?? []).forEach((value, j) => { rows.push(value); jacobian.push(state.Jh[j]); });
	(state.g ?? []).forEach((value, j) => {
		if (value > 0) { rows.push(value); jacobian.push(state.Jg[j]); }
	});
	return { rows, jacobian };
}

/**
 * @param {object} input
 * @param {(x: number[]) => object} input.evaluate  the same evaluator the SQP uses
 * @param {number[]} input.x
 * @param {number[]} [input.lower]
 * @param {number[]} [input.upper]
 * @param {number} [input.feasibilityTolerance]  on |r|, the same as the SQP's
 * @param {number} [input.maxSteps]
 * @param {number} [input.radius]   initial box half-width on the step
 * @param {number} [input.damping]  initial Levenberg-Marquardt term
 * @returns {{ ok: boolean, status: string, x: number[], state: object, steps: number,
 *             violationBefore: number, violationAfter: number, history: object[] }}
 */
export function restoreFeasibility({
	evaluate,
	x: x0,
	lower,
	upper,
	feasibilityTolerance = 1e-9,
	maxSteps = 30,
	radius: initialRadius,
	damping = 1e-6,
} = {}) {
	const n = x0.length;
	const lo = lower ?? new Array(n).fill(-Infinity);
	const up = upper ?? new Array(n).fill(Infinity);
	const clamp = (candidate) => candidate.map((value, i) => Math.min(Math.max(value, lo[i]), up[i]));

	let x = clamp(x0);
	let state = evaluate(x);
	let { rows, jacobian } = residualOf(state);
	let norm = Math.hypot(...rows);
	const violationBefore = norm;
	let radius = Number.isFinite(initialRadius) ? initialRadius : Math.max(1, 0.1 * Math.max(...x.map(Math.abs), 0));
	let mu = damping;
	const history = [];
	let steps = 0;

	const done = (ok, status) => ({
		ok, status, x, state, steps, violationBefore, violationAfter: norm, history,
	});

	for (let step = 0; step < maxSteps; step++) {
		if (norm <= feasibilityTolerance) return done(true, "restored");
		if (rows.length === 0) return done(true, "restored");

		const H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
			let sum = 0;
			for (const row of jacobian) sum += row[i] * row[j];
			return sum + (i === j ? mu : 0);
		}));
		const c = Array.from({ length: n }, (_, i) => jacobian.reduce((sum, row, r) => sum + row[i] * rows[r], 0));
		const qp = solveBoxQP({
			H, c, A: [], b: [],
			lower: x.map((value, i) => Math.max(lo[i] - value, -radius)),
			upper: x.map((value, i) => Math.min(up[i] - value, radius)),
			z0: new Array(n).fill(0),
			maxIterations: 500,
		});
		if (!qp.ok) return done(false, "restoration_qp_failed");
		const d = qp.z.slice(0, n);
		const length = Math.hypot(...d);
		if (!(length > 0)) return done(false, "restoration_stalled");

		// Armijo on |r|, the trial projected into the box
		let alpha = 1;
		let accepted = null;
		for (let t = 0; t < 20; t++) {
			const trial = clamp(x.map((value, i) => value + alpha * d[i]));
			let evaluated;
			try { evaluated = evaluate(trial); } catch { alpha /= 2; continue; }
			const trialResidual = residualOf(evaluated);
			const trialNorm = Math.hypot(...trialResidual.rows);
			if (trialNorm < norm * (1 - 1e-4 * alpha)) {
				accepted = { trial, evaluated, trialResidual, trialNorm, alpha };
				break;
			}
			alpha /= 2;
		}
		if (!accepted) {
			// the model overreached: damp harder and shrink the box, then try again
			mu *= 10;
			radius /= 2;
			history.push({ step, status: "rejected", mu, radius, violation: norm });
			if (mu > 1e3) return done(false, "restoration_stalled");
			continue;
		}
		steps += 1;
		history.push({ step, alpha: accepted.alpha, stepNorm: length, violation: norm, violationAfter: accepted.trialNorm, mu, radius });
		x = accepted.trial;
		state = accepted.evaluated;
		rows = accepted.trialResidual.rows;
		jacobian = accepted.trialResidual.jacobian;
		norm = accepted.trialNorm;
		mu = Math.max(1e-10, mu / 3);
	}
	return done(norm <= feasibilityTolerance, norm <= feasibilityTolerance ? "restored" : "restoration_stalled");
}
