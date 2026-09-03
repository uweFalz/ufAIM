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
 * @param {number[][]} [problem.C]      inequality matrix, C z <= d
 * @param {number[]}   [problem.d]      inequality right-hand side
 * @param {number[]}   problem.lower
 * @param {number[]}   problem.upper
 * @param {number[]}   problem.z0       feasible starting point
 */
/**
 * General inequalities enter as slacks: C z <= d becomes C z + s = d with
 * s >= 0, which is one equality row and one bound - both of which this solver
 * already handles, so the active set needs no second kind of member and no
 * second multiplier convention.
 *
 * The reduced Hessian stays positive definite under the transformation. A null
 * direction of the extended equality block satisfies A p = 0 and C p + q = 0,
 * so q is determined by p and contributes nothing of its own; the curvature
 * along it is p' H p, which is what it was before.
 */
function withSlacks({ H, c, A, b, C, d, lower, upper, z0 }) {
	const n = c.length;
	const k = C.length;
	if (k === 0) return { H, c, A, b, lower, upper, z0, n, k };

	const zero = (rows, cols) => Array.from({ length: rows }, () => new Array(cols).fill(0));
	const N = n + k;
	const Hx = zero(N, N);
	for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Hx[i][j] = H[i][j];
	const cx = [...c, ...new Array(k).fill(0)];

	const Ax = A.map((row) => [...row, ...new Array(k).fill(0)]);
	const bx = [...b];
	C.forEach((row, i) => {
		const extended = [...row, ...new Array(k).fill(0)];
		extended[n + i] = 1;
		Ax.push(extended);
		bx.push(d[i]);
	});

	// the slack starts where the constraint currently stands, clipped into its
	// own bound, so a starting point that already violates a row does not put the
	// extended problem outside its box
	const slack0 = C.map((row, i) => {
		let value = d[i];
		for (let j = 0; j < n; j++) value -= row[j] * z0[j];
		return Math.max(0, value);
	});

	return {
		H: Hx, c: cx, A: Ax, b: bx,
		lower: [...lower, ...new Array(k).fill(0)],
		upper: [...upper, ...new Array(k).fill(Infinity)],
		z0: [...z0, ...slack0],
		n, k,
	};
}

export function solveBoxQP({
	H,
	c,
	A = [],
	b = [],
	C = [],
	d = [],
	lower,
	upper,
	z0,
	maxIterations = 200,
	blandAfter = 6,
	damping = 1e-10,
	tolerance = 1e-10,
} = {}) {
	const declaredN = c?.length ?? 0;
	if (!declaredN || !Array.isArray(z0) || z0.length !== declaredN) {
		return { ok: false, status: "invalid", reason: "dimension mismatch" };
	}
	if (C.length !== d.length) {
		return { ok: false, status: "invalid", reason: "C and d disagree in length" };
	}
	const extended = withSlacks({
		H, c, A, b, C, d,
		lower: lower ?? new Array(declaredN).fill(-Infinity),
		upper: upper ?? new Array(declaredN).fill(Infinity),
		z0,
	});
	({ H, c, A, b, lower, upper, z0 } = extended);
	const slackCount = extended.k;
	const n = c.length;
	const declared = n - slackCount;
	// Every exit truncates z back to the declared variables and separates the two
	// kinds of working-set member: a pinned variable is a bound, a pinned slack
	// is an active inequality row. Leaving slack indices in activeBounds would
	// have the caller treat a row as a variable.
	const finish = (result, working) => Object.freeze({
		...result,
		z: result.z ? result.z.slice(0, declared) : result.z,
		slacks: result.z ? result.z.slice(declared) : [],
		activeBounds: working
			? working.map((v, i) => (v ? i : -1)).filter((i) => i >= 0 && i < declared)
			: (result.activeBounds ?? []),
		activeRows: working
			? working.map((v, i) => (v ? i - declared : -1)).filter((i) => i >= 0)
			: [],
	});

	const lo = lower;
	const up = upper;

	let z = z0.map((value, i) => Math.min(Math.max(value, lo[i]), up[i]));
	const atLower = z.map((value, i) => value <= lo[i] + EPS);
	const atUpper = z.map((value, i) => value >= up[i] - EPS);
	const working = z.map((_, i) => atLower[i] || atUpper[i]);

	let iterations = 0;
	let released = 0;
	let blocked = 0;
	// A stalled active set is one whose OBJECTIVE stops falling, and that is the
	// test, because it is the only one that catches every way of stalling. Steps
	// of length zero were the first guess and they are only the loudest case: a
	// cycle that moves a little each time walks straight past a step-length test
	// and past a step-length test made relative too, since the movement is real
	// and only the progress is not. Measured on the alignment ramp rules, this
	// solver ran 4000 iterations with 65 releases and never once registered a
	// degenerate step, while returning the identical answer it had after 200.
	//
	// After enough iterations without progress the rule for choosing what to
	// release and what to block switches to Bland's: always the lowest index that
	// qualifies. It is a poor rule for speed and the only one that provably
	// cannot cycle, so it is the fallback it is, never the default.
	let degenerate = 0;
	let bestObjective = Infinity;
	const objectiveAt = (point) => {
		let value = 0;
		for (let i = 0; i < n; i++) {
			value += c[i] * point[i];
			for (let j = 0; j < n; j++) value += 0.5 * point[i] * H[i][j] * point[j];
		}
		return value;
	};
	// Anti-cycling: a bound that was just released and is immediately blocked
	// again at a zero-length step would loop forever. The point is stationary
	// within its working set, which is the answer.
	let lastReleased = -1;

	for (; iterations < maxIterations; iterations++) {
		const free = working.map((isPinned) => !isPinned);
		const target = solveFreeBlock({ H, c, A, b, z, free, damping });
		if (!target) return finish({ ok: false, status: "reduced_system_failed", z, iterations }, working);

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
			const bland = degenerate >= blandAfter;
			let worst = -1;
			let worstValue = -tolerance;
			for (let i = 0; i < n; i++) {
				if (!working[i]) continue;
				// at a lower bound the gradient must be >= 0, at an upper bound <= 0
				const multiplier = z[i] <= lo[i] + EPS ? gradient[i] : -gradient[i];
				if (bland) {
					if (multiplier < -tolerance) { worst = i; break; }
				} else if (multiplier < worstValue) {
					worstValue = multiplier;
					worst = i;
				}
			}
			if (worst < 0) {
				return finish({ ok: true, status: "solved", z, iterations, released, blocked }, working);
			}
			working[worst] = false;
			released++;
			lastReleased = worst;
			continue;
		}

		// longest step along `direction` that keeps every bound
		let alpha = 1;
		let blocking = -1;
		// Under Bland's rule the blocking variable is the lowest index attaining
		// the shortest step, not the last one found to attain it.
		const strictlyShorter = degenerate >= blandAfter
			? (limit) => limit < alpha - EPS
			: (limit) => limit < alpha;
		for (let i = 0; i < n; i++) {
			if (direction[i] > EPS && Number.isFinite(up[i])) {
				const limit = (up[i] - z[i]) / direction[i];
				if (strictlyShorter(limit)) { alpha = limit; blocking = i; }
			} else if (direction[i] < -EPS && Number.isFinite(lo[i])) {
				const limit = (lo[i] - z[i]) / direction[i];
				if (strictlyShorter(limit)) { alpha = limit; blocking = i; }
			}
		}
		alpha = Math.max(0, Math.min(1, alpha));

		if (alpha <= EPS && blocking === lastReleased && blocking >= 0) {
			// Released, then immediately blocked again without moving - the
			// shortest cycle there is. This used to end the solve, which gave up
			// before Bland's rule had been tried at all, and handed back a
			// direction the subproblem could not vouch for; the caller's line
			// search then backtracked it into the ground.
			//
			// So try Bland, once. Not "after twelve more rounds of the same
			// two-cycle" - that was the first attempt and it cost a solve that ran
			// in seventy seconds fifteen minutes, because each round is a full
			// null-space solve. Bland is switched on immediately, and if the same
			// thing happens with it already running then there really is nothing
			// left to try.
			working[blocking] = true;
			if (degenerate >= blandAfter) {
				return finish(
					{ ok: true, status: "stationary_on_working_set", z, iterations, released, blocked },
					working
				);
			}
			degenerate = blandAfter;
			continue;
		}

		z = z.map((value, i) => value + alpha * direction[i]);
		for (let i = 0; i < n; i++) {
			z[i] = Math.min(Math.max(z[i], lo[i]), up[i]);
		}
		if (blocking >= 0 && alpha < 1) { working[blocking] = true; blocked++; lastReleased = -1; }

		// Progress, or the lack of it. Everything above may have changed the
		// working set; what decides whether that was progress is the objective.
		const objective = objectiveAt(z);
		if (objective < bestObjective - tolerance * Math.max(1, Math.abs(bestObjective))) {
			bestObjective = objective;
			degenerate = 0;
		} else {
			degenerate++;
			if (objective < bestObjective) bestObjective = objective;
		}
	}

	// An exhausted active set is not self-explanatory, and the caller cannot see
	// the working set from outside. Report what it was doing when it ran out.
	return finish({
		ok: false, status: "max_iterations", z, iterations,
		detail: Object.freeze({
			variables: n,
			declaredVariables: declared,
			slacks: slackCount,
			equalities: A.length,
			workingSet: working.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
			released, blocked, degenerate,
		}),
	}, working);
}
