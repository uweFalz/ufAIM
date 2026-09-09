// src/lib/math/lina/symmetricEigen.js
//
// Eigenvalues and eigenvectors of a real symmetric matrix by cyclic Jacobi
// rotations. Every rotation zeroes one off-diagonal pair and is applied to
// the accumulated eigenvector matrix; sweeps continue until the off-diagonal
// mass is below the tolerance or the sweep budget is spent. O(n^3) a sweep,
// a handful of sweeps for the matrices this is used on (a few hundred
// variables at most). Pure numerics: no dependencies.

export const SYMMETRIC_EIGEN_VERSION = "lina/symmetricEigen/0.1";

/**
 * @param {number[][]} matrix  symmetric, n × n
 * @param {{tolerance?: number, maxSweeps?: number}} [options]
 * @returns {{ values: number[], vectors: number[][], sweeps: number, converged: boolean }}
 *          values descending; vectors[k] is the unit eigenvector of values[k]
 */
export function symmetricEigen(matrix, { tolerance = 1e-22, maxSweeps = 100 } = {}) {
	const n = matrix.length;
	const M = matrix.map((row) => row.slice());
	const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
	let sweeps = 0;
	let converged = false;
	const scale = Math.max(1e-300, ...M.map((row, i) => Math.abs(row[i])));
	for (; sweeps < maxSweeps; sweeps++) {
		let off = 0;
		for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += M[p][q] * M[p][q];
		if (off <= tolerance * scale * scale) { converged = true; break; }
		for (let p = 0; p < n; p++) {
			for (let q = p + 1; q < n; q++) {
				if (Math.abs(M[p][q]) < 1e-300) continue;
				const theta = (M[q][q] - M[p][p]) / (2 * M[p][q]);
				const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
				const c = 1 / Math.sqrt(t * t + 1);
				const s = t * c;
				for (let k = 0; k < n; k++) {
					const kp = M[k][p];
					const kq = M[k][q];
					M[k][p] = c * kp - s * kq;
					M[k][q] = s * kp + c * kq;
				}
				for (let k = 0; k < n; k++) {
					const pk = M[p][k];
					const qk = M[q][k];
					M[p][k] = c * pk - s * qk;
					M[q][k] = s * pk + c * qk;
				}
				for (let k = 0; k < n; k++) {
					const kp = V[k][p];
					const kq = V[k][q];
					V[k][p] = c * kp - s * kq;
					V[k][q] = s * kp + c * kq;
				}
			}
		}
	}
	const order = M.map((row, i) => [row[i], i]).sort((a, b) => b[0] - a[0]);
	return Object.freeze({
		values: order.map(([value]) => value),
		vectors: order.map(([, column]) => V.map((row) => row[column])),
		sweeps,
		converged,
	});
}
