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
	lower,
	upper,
	relaxationWeight = 1e4,
	damping = 1e-10,
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

	const qp = solveBoxQP({ H: Hz, c: cz, A, b, lower: lo, upper: up, z0, damping });
	if (!qp.ok) return { ok: false, status: qp.status, reason: qp.reason ?? null };

	const d = qp.z.slice(0, n);
	const delta = qp.z[n];

	// multipliers of the equalities, from the stationarity condition
	// H d + c + Jh' mu = 0, solved in least squares
	const stationarity = matVec(H, d).map((value, i) => -(value + gradF[i]));
	let mu = new Array(m).fill(0);
	if (m > 0) {
		const gram = Jh.map((rowA) => Jh.map((rowB) => dot(rowA, rowB)));
		for (let i = 0; i < m; i++) gram[i][i] += 1e-12;
		const rhs = Jh.map((row) => dot(row, stationarity));
		// small symmetric solve by Gaussian elimination with partial pivoting
		const M = gram.map((row, i) => [...row, rhs[i]]);
		for (let k = 0; k < m; k++) {
			let pivot = k;
			for (let i = k + 1; i < m; i++) if (Math.abs(M[i][k]) > Math.abs(M[pivot][k])) pivot = i;
			if (Math.abs(M[pivot][k]) < 1e-300) { mu = new Array(m).fill(0); break; }
			[M[k], M[pivot]] = [M[pivot], M[k]];
			for (let i = 0; i < m; i++) {
				if (i === k) continue;
				const factor = M[i][k] / M[k][k];
				for (let j = k; j <= m; j++) M[i][j] -= factor * M[k][j];
			}
		}
		if (mu.every((value) => value === 0)) {
			mu = M.map((row, i) => (Math.abs(row[i]) > 1e-300 ? row[m] / row[i] : 0));
		}
		if (!mu.every(Number.isFinite)) mu = new Array(m).fill(0);
	}

	// predicted decrease of the merit: l1'(x; d; eta) <= -d' H d
	const predictedDecrease = -dot(d, matVec(H, d));

	return {
		ok: true,
		status: "solved",
		d,
		delta,
		multipliers: { equality: mu, inequality: [] },
		predictedDecrease,
		activeBounds: qp.activeBounds,
		qpIterations: qp.iterations,
	};
}
