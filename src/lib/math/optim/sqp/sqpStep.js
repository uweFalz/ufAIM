// src/lib/math/optim/sqp/sqpStep.js
//
// One step of a globalised SQP method: Powell's modified BFGS update, and the
// relaxed QP subproblem.
//
// Modified BFGS. The exact Hessian of the Lagrangian is often unavailable, and
// where it is available it may be indefinite. A linear objective is the extreme
// case: its Hessian is exactly zero, the descent estimate
// l1'(x; d; eta) <= -d'Qd then reads <= 0, and the line search loses its
// guarantee entirely. Powell's update keeps H symmetric and positive definite
// regardless, which restores the guarantee:
//
//     H+ = H + q q' / (q'd) - H d d' H / (d' H d)
//     q  = theta y + (1 - theta) H d
//     y  = grad_x L(x+, lambda, mu) - grad_x L(x, lambda, mu)
//     theta = 1                                   if d'y >= 0.2 d'Hd
//             0.8 d'Hd / (d'Hd - d'y)             otherwise
//
// Relaxed QP. A QP subproblem can be infeasible even when the underlying
// problem is sound: g(x) = 1 - x^2 <= 0 at x = 0 linearises to 1 <= 0. Powell's
// relaxation scales the constraints by a slack delta in [0, 1] and penalises
// it, so that (d, delta) = (0, 1) is always feasible. A solution with delta = 0
// solves the original subproblem; delta > 0 measures how far the linearised
// constraints had to be given up.
//
// Deviation from Powell, stated deliberately: only the equalities are relaxed
// here. The inequalities of the intended caller are simple bounds that the line
// search keeps satisfied at every iterate, so their relaxation factor
// (1 - sigma_i delta) would always carry sigma_i = 0 and change nothing. A
// caller that can violate its inequalities needs the sigma_i branch added.
//
// Pure numerics: depends only on the QP solver.

import { solveBoxQP } from "../qp/solveBoxQP.js";

export const SQP_STEP_VERSION = "optim/sqp/sqpStep/0.2";

function dot(a, b) {
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
	return sum;
}

function matVec(M, v) {
	return M.map((row) => dot(row, v));
}

export function identityMatrix(n, scale = 1) {
	return Array.from({ length: n }, (_, i) =>
		Array.from({ length: n }, (_, j) => (i === j ? scale : 0)));
}

/**
 * Powell's modified BFGS update. Returns a new matrix; the input is untouched.
 * Falls back to the unchanged matrix when the update would be degenerate.
 */
export function modifiedBfgsUpdate(H, s, y) {
	const n = H.length;
	if (!s?.length || !y?.length) return H;

	const Hs = matVec(H, s);
	const sHs = dot(s, Hs);
	if (!(sHs > 1e-300) || !Number.isFinite(sHs)) return H;

	const sy = dot(s, y);
	const theta = sy >= 0.2 * sHs ? 1 : (0.8 * sHs) / (sHs - sy);
	const q = y.map((value, i) => theta * value + (1 - theta) * Hs[i]);

	const sq = dot(s, q);
	if (!(sq > 1e-300) || !Number.isFinite(sq)) return H;

	const next = Array.from({ length: n }, () => new Array(n).fill(0));
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			next[i][j] = H[i][j] + (q[i] * q[j]) / sq - (Hs[i] * Hs[j]) / sHs;
		}
	}
	// keep it exactly symmetric against round-off
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			const mean = 0.5 * (next[i][j] + next[j][i]);
			next[i][j] = mean;
			next[j][i] = mean;
		}
	}
	return next.every((row) => row.every(Number.isFinite)) ? next : H;
}

/**
 * Solve the relaxed QP subproblem.
 *
 * @param {object} input
 * @param {number[][]} input.H       positive definite approximation of the Lagrangian Hessian
 * @param {number[]}   input.gradF
 * @param {number[]}   input.h       equality residuals at the current point
 * @param {number[][]} input.Jh      their Jacobian
 * @param {number[]}   input.lower   lower bounds on the step d
 * @param {number[]}   input.upper   upper bounds on the step d
 * @param {number}     input.relaxationWeight  the eta penalising the slack
 */
export function solveRelaxedQpStep({
	H,
	gradF,
	h = [],
	Jh = [],
	g = [],
	Jg = [],
	lower,
	upper,
	relaxationWeight = 1e4,
	damping = 1e-10,
	qpIterations = 200,
} = {}) {
	const n = gradF.length;
	const m = h.length;

	// z = [d, delta]
	const size = n + 1;
	const Hz = Array.from({ length: size }, (_, i) =>
		Array.from({ length: size }, (_, j) => {
			if (i < n && j < n) return H[i][j];
			if (i === n && j === n) return relaxationWeight;
			return 0;
		}));
	const cz = [...gradF, 0];

	// h_j (1 - delta) + grad h_j' d = 0   =>   grad h_j' d - h_j delta = -h_j
	const A = Jh.map((row, j) => [...row, -h[j]]);
	const b = h.map((value) => -value);

	const lo = [...(lower ?? new Array(n).fill(-Infinity)), 0];
	const up = [...(upper ?? new Array(n).fill(Infinity)), 1];

	// (d, delta) = (0, 1) is feasible for the relaxed problem by construction
	const z0 = [...new Array(n).fill(0), m > 0 ? 1 : 0];

	// Inequalities are relaxed only where they are violated:
	//
	//     g + Jg d <= 0   relaxed to   Jg d - max(0, g) delta <= -g
	//
	// The obvious form, mirroring the equalities as Jg d - g delta <= -g, is
	// wrong, and wrong in the direction that hurts. For a satisfied constraint
	// g < 0 it reads Jg d <= -g at delta = 0 - the true linearisation, with all
	// the room the slack allows - and Jg d <= 0 at delta = 1. So raising the
	// slack TIGHTENS every constraint that was not the problem. Measured on the
	// alignment ramp rules, three rows slack by 22.6, 11.5 and 3.6 m were being
	// squeezed to nothing while the one violated row went uncorrected: the
	// subproblem sat at delta = 1 with the violation stuck at 0.39 and the active
	// set churning through 66 releases.
	//
	// A relaxation may only ever loosen. With max(0, g) the violated rows behave
	// as before - at delta = 1 a violated one becomes Jg d <= 0, which is "do not
	// make it worse" - and the satisfied ones keep their full room at every
	// delta. (d, delta) = (0, 1) is still feasible for all of them, which is what
	// the relaxation is for.
	const p = g.length;
	const C = [];
	const dRhs = [];
	for (let i = 0; i < p; i++) {
		C.push([...(Jg[i] ?? new Array(n).fill(0)), -Math.max(0, g[i])]);
		dRhs.push(-g[i]);
	}

	const qp = solveBoxQP({ H: Hz, c: cz, A, b, C, d: dRhs, lower: lo, upper: up, z0, damping, maxIterations: qpIterations });
	if (!qp.ok) return { ok: false, status: qp.status, reason: qp.reason ?? null, detail: qp.detail ?? null };

	const d = qp.z.slice(0, n);
	const delta = qp.z[n];

	// Multipliers of the equalities from the stationarity condition
	//
	//     H d + c + Jh' mu + (bound multipliers) = 0
	//
	// restricted to the variables that are NOT sitting on a bound. A bound in
	// the working set absorbs part of the gradient, and attributing that part to
	// the equalities understates mu. The penalty weights are then too small and
	// the merit lets feasibility be traded back for objective, which is exactly
	// what a linear objective will do given the chance.
	const pinned = new Set(qp.activeBounds ?? []);
	const freeRows = [];
	for (let i = 0; i < n; i++) if (!pinned.has(i)) freeRows.push(i);

	// The active set carries both kinds: the equalities always, and the
	// inequality rows the subproblem ended up holding. An inactive row carries
	// no multiplier at all, and fitting one to it would put weight on a
	// constraint that is not binding.
	const activeRows = new Set(qp.activeRows ?? []);
	const inequalityActive = [];
	for (let i = 0; i < p; i++) if (activeRows.has(i)) inequalityActive.push(i);
	const fitted = [...Jh, ...inequalityActive.map((i) => Jg[i])];
	const fittedCount = fitted.length;

	const stationarity = matVec(H, d).map((value, i) => -(value + gradF[i]));
	let mu = new Array(m).fill(0);
	let lambda = new Array(p).fill(0);
	if (fittedCount > 0 && freeRows.length > 0) {
		const JhFree = fitted.map((row) => freeRows.map((i) => row[i]));
		const stationarityFree = freeRows.map((i) => stationarity[i]);
		const gram = JhFree.map((rowA) => JhFree.map((rowB) => dot(rowA, rowB)));
		const gramScale = Math.max(...gram.map((row, i) => Math.abs(row[i])), 1);
		for (let i = 0; i < fittedCount; i++) gram[i][i] += 1e-12 * gramScale;
		const rhs = JhFree.map((row) => dot(row, stationarityFree));
		// small symmetric solve by Gaussian elimination with partial pivoting
		const M = gram.map((row, i) => [...row, rhs[i]]);
		let solved = new Array(fittedCount).fill(0);
		let singular = false;
		for (let k = 0; k < fittedCount; k++) {
			let pivot = k;
			for (let i = k + 1; i < fittedCount; i++) {
				if (Math.abs(M[i][k]) > Math.abs(M[pivot][k])) pivot = i;
			}
			if (Math.abs(M[pivot][k]) < 1e-300) { singular = true; break; }
			[M[k], M[pivot]] = [M[pivot], M[k]];
			for (let i = 0; i < fittedCount; i++) {
				if (i === k) continue;
				const factor = M[i][k] / M[k][k];
				for (let j = k; j <= fittedCount; j++) M[i][j] -= factor * M[k][j];
			}
		}
		if (!singular) {
			solved = M.map((row, i) =>
				(Math.abs(row[i]) > 1e-300 ? row[fittedCount] / row[i] : 0));
		}
		if (!solved.every(Number.isFinite)) solved = new Array(fittedCount).fill(0);
		mu = solved.slice(0, m);
		// An inequality multiplier is one-sided: a negative one says the row
		// should not be held at all, and reporting it as negative would let the
		// penalty weights grow on a constraint that wants releasing.
		inequalityActive.forEach((row, k) => {
			lambda[row] = Math.max(0, solved[m + k]);
		});
	}

	// Gerdts' bound l1'(x; d; eta) <= -d'Hd is a guarantee, not the value. Using
	// it as the Armijo reference is far too weak: it accepts a step that barely
	// dips the merit, which for a linear objective means trading feasibility
	// away. The caller gets both, and should use the exact directional
	// derivative
	//
	//     l1'(x; d; eta) = grad f . d - (1 - delta) * sum_j eta_j |h_j|
	//
	// which is exact for the relaxed step, since the linearised constraints are
	// met up to the slack.
	const curvature = -dot(d, matVec(H, d));

	return {
		ok: true,
		// whether the subproblem reached its own optimum, as opposed to being
		// truncated. A zero step from a solved subproblem means no admissible
		// descent direction exists; a zero step from a truncated one means
		// nothing at all.
		qpStatus: qp.status,
		status: "solved",
		d,
		delta,
		multipliers: { equality: mu, inequality: lambda },
		activeRows: Object.freeze([...inequalityActive]),
		curvature,
		gradientAlongStep: dot(gradF, d),
		predictedDecrease: curvature,
		activeBounds: qp.activeBounds,
		qpIterations: qp.iterations,
	};
}
