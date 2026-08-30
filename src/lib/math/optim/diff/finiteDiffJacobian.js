// src/lib/math/optim/diff/finiteDiffJacobian.js
//
// Central-difference Jacobian with per-variable step sizes.
//
// The step must be chosen in the variable's own magnitude, not as one global
// number: a length in metres and a curvature near 1e-3 1/m cannot share a
// perturbation. The caller supplies the scale, which is the same engineering
// magnitude used for the variable scaling.
//
// Pure numerics: no dependencies.

export const FINITE_DIFF_JACOBIAN_VERSION = "optim/diff/finiteDiffJacobian/0.1";

/**
 * @param {object} input
 * @param {number[]} input.x
 * @param {(x: number[]) => number[]} input.residual
 * @param {number[]} [input.scales]   magnitude of each variable
 * @param {number}   [input.relative] relative step within that magnitude
 * @returns {{ ok: boolean, J?: number[][], status?: string, column?: number }}
 *          J[row][column]
 */
export function finiteDiffJacobian({ x, residual, scales, relative = 1e-6 } = {}) {
	if (!Array.isArray(x) || typeof residual !== "function") {
		return { ok: false, status: "invalid" };
	}
	const n = x.length;
	const scale = scales ?? new Array(n).fill(1);
	const columns = [];

	for (let j = 0; j < n; j++) {
		const step = Math.max(Math.abs(scale[j]), 1e-30) * relative;
		const forward = x.slice();
		const backward = x.slice();
		forward[j] += step;
		backward[j] -= step;

		let plus;
		let minus;
		try {
			plus = residual(forward);
			minus = residual(backward);
		} catch {
			return { ok: false, status: "residual_threw", column: j };
		}
		if (!Array.isArray(plus) || !Array.isArray(minus) || plus.length !== minus.length) {
			return { ok: false, status: "residual_shape", column: j };
		}
		const column = plus.map((value, i) => (value - minus[i]) / (2 * step));
		if (!column.every(Number.isFinite)) {
			return { ok: false, status: "non_finite", column: j };
		}
		columns.push(column);
	}

	const rows = columns[0]?.length ?? 0;
	const J = Array.from({ length: rows }, (_, i) => columns.map((column) => column[i]));
	return { ok: true, J };
}
