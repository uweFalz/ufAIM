// src/lib/math/optim/qp/solveBoxQP.js
//
// Quadratic programme with equality constraints and simple bounds:
//
//     minimise   1/2 z' H z + c' z
//     subject to A z = b
//                lower <= z <= upper
//
// Primal active-set method. The working set holds the variables currently
// pinned at a bound; the free block is solved as an equality-constrained QP by
// the null-space method, which needs no saddle-point factorisation and is what
// makes this reliable where a plain KKT elimination is not.
//
// It requires a feasible starting point. For the relaxed QP of Powell that is
// free: (d, delta) = (0, 1) always satisfies the relaxed equalities.
//
// Pure numerics: no domain knowledge, no dependencies.

export const SOLVE_BOX_QP_VERSION = "optim/qp/solveBoxQP/0.1";

const EPS = 1e-12;

function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}

function dot(a, b) {
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
	return sum;
}

/** Cholesky solve for a symmetric positive definite system; null when not SPD. */
function solveSpd(matrix, rhs) {
	const n = rhs.length;
	if (n === 0) return [];
	// The pivot test must be relative to the matrix, not an absolute epsilon:
	// a legitimately small but well-conditioned system would otherwise be
	// rejected, including one this file regularised itself.
	let magnitude = 0;
	for (let i = 0; i < n; i++) magnitude = Math.max(magnitude, Math.abs(matrix[i][i]));
	const pivotFloor = Math.max(magnitude, 1) * 1e-15;
	const lower = Array.from({ length: n }, () => new Array(n).fill(0));
	for (let i = 0; i < n; i++) {
		for (let j = 0; j <= i; j++) {
			let sum = matrix[i][j];
			for (let k = 0; k < j; k++) sum -= lower[i][k] * lower[j][k];
			if (i === j) {
				if (sum <= pivotFloor) return null;
				lower[i][i] = Math.sqrt(sum);
			} else {
				lower[i][j] = sum / lower[j][j];
			}
		}
	}
	const y = new Array(n).fill(0);
	for (let i = 0; i < n; i++) {
		let sum = rhs[i];
		for (let k = 0; k < i; k++) sum -= lower[i][k] * y[k];
		y[i] = sum / lower[i][i];
	}
	const x = new Array(n).fill(0);
	for (let i = n - 1; i >= 0; i--) {
		let sum = y[i];
		for (let k = i + 1; k < n; k++) sum -= lower[k][i] * x[k];
		x[i] = sum / lower[i][i];
	}
	return x.every(isFiniteNumber) ? x : null;
}

/** Orthonormal basis of the row space and of the null space of `rows`. */
function orthogonalDecomposition(rows, dimension) {
	const rowBasis = [];
	for (const row of rows) {
		let residual = row.slice();
		for (const basis of rowBasis) {
			const projection = dot(residual, basis);
			residual = residual.map((value, i) => value - projection * basis[i]);
		}
		const norm = Math.hypot(...residual);
		if (norm > 1e-10) rowBasis.push(residual.map((value) => value / norm));
	}
	const nullBasis = [];
	for (let axis = 0; axis < dimension && nullBasis.length < dimension - rowBasis.length; axis++) {
		let candidate = new Array(dimension).fill(0);
		candidate[axis] = 1;
		for (const basis of [...rowBasis, ...nullBasis]) {
			const projection = dot(candidate, basis);
			candidate = candidate.map((value, i) => value - projection * basis[i]);
		}
		const norm = Math.hypot(...candidate);
		if (norm > 1e-8) nullBasis.push(candidate.map((value) => value / norm));
	}
	return { rowBasis, nullBasis };
}

/**
 * Minimise the QP restricted to the free variables, holding the working set.
 * Returns the full-length target point, or null when the reduced system is
 * not solvable.
 */
function solveFreeBlock({ H, c, A, b, z, free, damping }) {
	const n = z.length;
	const freeIndex = free.map((isFree, i) => (isFree ? i : -1)).filter((i) => i >= 0);
	const m = freeIndex.length;
	if (m === 0) return z.slice();

	// residual of the equalities caused by the pinned variables
	const rhs = b.map((value, r) => {
		let fixed = 0;
		for (let i = 0; i < n; i++) if (!free[i]) fixed += A[r][i] * z[i];
		return value - fixed;
	});
	const Af = A.map((row) => freeIndex.map((i) => row[i]));

	// particular solution of Af * y = rhs, minimum norm
	const { nullBasis } = orthogonalDecomposition(Af, m);
	let particular = new Array(m).fill(0);
	if (Af.length > 0) {
		const gram = Af.map((rowA) => Af.map((rowB) => dot(rowA, rowB)));
		const gramScale = Math.max(...gram.map((row, r) => Math.abs(row[r])), 1);
		for (let r = 0; r < gram.length; r++) gram[r][r] += 1e-12 * gramScale;
		const weights = solveSpd(gram, rhs);
		if (!weights) return null;
		for (let r = 0; r < Af.length; r++) {
			for (let i = 0; i < m; i++) particular[i] += Af[r][i] * weights[r];
		}
	}

	if (nullBasis.length === 0) {
		const target = z.slice();
		freeIndex.forEach((index, i) => { target[index] = particular[i]; });
		return target;
	}

	// gradient of the objective at the particular point, in full coordinates
	const trial = z.slice();
	freeIndex.forEach((index, i) => { trial[index] = particular[i]; });
	const gradient = new Array(n).fill(0);
	for (let i = 0; i < n; i++) {
		let sum = c[i];
		for (let j = 0; j < n; j++) sum += H[i][j] * trial[j];
		gradient[i] = sum;
	}

	// reduce onto the null space of the free equalities
	const reducedH = nullBasis.map((left) => nullBasis.map((right) => {
		let sum = 0;
		for (let i = 0; i < m; i++) {
			for (let j = 0; j < m; j++) sum += left[i] * H[freeIndex[i]][freeIndex[j]] * right[j];
		}
		return sum;
	}));
	const reducedG = nullBasis.map((basis) => {
		let sum = 0;
		for (let i = 0; i < m; i++) sum += basis[i] * gradient[freeIndex[i]];
		return sum;
	});
	const scale = reducedH.reduce((sum, row, i) => sum + row[i], 0) / Math.max(reducedH.length, 1);
	for (let i = 0; i < reducedH.length; i++) {
		reducedH[i][i] += Math.max(damping * Math.abs(scale), 1e-10);
	}
	const step = solveSpd(reducedH, reducedG.map((value) => -value));
	if (!step) return null;

	const target = trial.slice();
	nullBasis.forEach((basis, k) => {
		for (let i = 0; i < m; i++) target[freeIndex[i]] += basis[i] * step[k];
	});
	return target.every(isFiniteNumber) ? target : null;
}

/**
 * @param {object} problem
 * @param {number[][]} problem.H        symmetric, positive definite is assumed
 * @param {number[]}   problem.c
 * @param {number[][]} [problem.A]      equality matrix
 * @param {number[]}   [problem.b]      equality right-hand side
 * @param {number[]}   problem.lower
 * @param {number[]}   problem.upper
 * @param {number[]}   problem.z0       feasible starting point
 */
export function solveBoxQP({
	H,
	c,
	A = [],
	b = [],
	lower,
	upper,
	z0,
	maxIterations = 200,
	damping = 1e-10,
	tolerance = 1e-10,
} = {}) {
	const n = c?.length ?? 0;
	if (!n || !Array.isArray(z0) || z0.length !== n) {
		return { ok: false, status: "invalid", reason: "dimension mismatch" };
	}

	const lo = lower ?? new Array(n).fill(-Infinity);
	const up = upper ?? new Array(n).fill(Infinity);

	let z = z0.map((value, i) => Math.min(Math.max(value, lo[i]), up[i]));
	const atLower = z.map((value, i) => value <= lo[i] + EPS);
	const atUpper = z.map((value, i) => value >= up[i] - EPS);
	const working = z.map((_, i) => atLower[i] || atUpper[i]);

	let iterations = 0;
	let released = 0;
	let blocked = 0;
	// Anti-cycling: a bound that was just released and is immediately blocked
	// again at a zero-length step would loop forever. The point is stationary
	// within its working set, which is the answer.
	let lastReleased = -1;

	for (; iterations < maxIterations; iterations++) {
		const free = working.map((isPinned) => !isPinned);
		const target = solveFreeBlock({ H, c, A, b, z, free, damping });
		if (!target) return { ok: false, status: "reduced_system_failed", z, iterations };

		const direction = target.map((value, i) => (free[i] ? value - z[i] : 0));
		const norm = Math.hypot(...direction);

		if (norm <= tolerance) {
			// stationary on the free block: check whether a pinned variable wants out
			const gradient = new Array(n).fill(0);
			for (let i = 0; i < n; i++) {
				let sum = c[i];
				for (let j = 0; j < n; j++) sum += H[i][j] * z[j];
				gradient[i] = sum;
			}
			// remove the equality contribution so the bound multiplier is what remains
			if (A.length > 0) {
				const { rowBasis } = orthogonalDecomposition(A, n);
				for (const basis of rowBasis) {
					const projection = dot(gradient, basis);
					for (let i = 0; i < n; i++) gradient[i] -= projection * basis[i];
				}
			}
			let worst = -1;
			let worstValue = -tolerance;
			for (let i = 0; i < n; i++) {
				if (!working[i]) continue;
				// at a lower bound the gradient must be >= 0, at an upper bound <= 0
				const multiplier = z[i] <= lo[i] + EPS ? gradient[i] : -gradient[i];
				if (multiplier < worstValue) { worstValue = multiplier; worst = i; }
			}
			if (worst < 0) {
				return {
					ok: true, status: "solved", z, iterations,
					activeBounds: working.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
					released, blocked,
				};
			}
			working[worst] = false;
			released++;
			lastReleased = worst;
			continue;
		}

		// longest step along `direction` that keeps every bound
		let alpha = 1;
		let blocking = -1;
		for (let i = 0; i < n; i++) {
			if (direction[i] > EPS && Number.isFinite(up[i])) {
				const limit = (up[i] - z[i]) / direction[i];
				if (limit < alpha) { alpha = limit; blocking = i; }
			} else if (direction[i] < -EPS && Number.isFinite(lo[i])) {
				const limit = (lo[i] - z[i]) / direction[i];
				if (limit < alpha) { alpha = limit; blocking = i; }
			}
		}
		alpha = Math.max(0, Math.min(1, alpha));

		if (alpha <= EPS && blocking === lastReleased && blocking >= 0) {
			// released, then immediately blocked again without moving
			working[blocking] = true;
			return {
				ok: true, status: "stationary_on_working_set", z, iterations,
				activeBounds: working.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
				released, blocked,
			};
		}

		z = z.map((value, i) => value + alpha * direction[i]);
		for (let i = 0; i < n; i++) {
			z[i] = Math.min(Math.max(z[i], lo[i]), up[i]);
		}
		if (blocking >= 0 && alpha < 1) { working[blocking] = true; blocked++; lastReleased = -1; }
	}

	return { ok: false, status: "max_iterations", z, iterations };
}
