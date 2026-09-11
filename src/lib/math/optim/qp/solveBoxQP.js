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
/**
 * An orthonormal basis of the row space, and one of its null space.
 *
 * Two things here are not incidental.
 *
 * The rank test is relative. Deciding independence by comparing a residual
 * against an absolute 1e-10 asks a question about units, not about rank: the
 * rows this solver is handed are a position in metres, a position in metres and
 * a heading in radians, with norms measured at 141, 376 and 0.51. A residual of
 * 1e-9 is noise under the first and meaningful under the third. Each row is
 * normalised before it is orthogonalised, which changes neither the row space
 * nor the null space and makes the test scale-free.
 *
 * And the bases are orthogonal to working precision. One pass of modified
 * Gram-Schmidt lost orthogonality when the rows were close to dependent, and a
 * null basis that is not quite null yields directions along which the
 * objective does not fall. Measured then: an active set cycling among nine
 * working sets, one of them visited forty-four times, with Bland's rule
 * running - which cannot happen to a correct implementation, so the fault was
 * never in the pivot rule. A second pass was the remedy; Householder
 * reflections give the same guarantee without it, and without the cost.
 */
function orthogonalDecomposition(rows, dimension) {
	// Householder QR of A', the rows as columns: r reflectors, each applied to
	// the columns still to come and later to the unit vectors that make up
	// the bases. The first r columns of Q span the rows, the rest their null
	// space, orthogonal to working precision by construction. Modified
	// Gram-Schmidt against every basis vector found so far, twice, cost
	// O(d^3) with an array allocated per projection: two thirds of a 3.7 s
	// SQP step at 151 variables, against O(r d^2) here with r the row count.
	const columns = rows.map((row) => row.slice());
	const reflectors = [];   // { offset, v } for H = I - 2 v v' on indices >= offset
	const kept = [];         // which rows carry a reflector (rank)
	const apply = (vector, reflector) => {
		const { offset, v } = reflector;
		let projection = 0;
		for (let i = 0; i < v.length; i++) projection += v[i] * vector[offset + i];
		if (projection === 0) return;
		for (let i = 0; i < v.length; i++) vector[offset + i] -= 2 * projection * v[i];
	};
	for (let c = 0; c < columns.length; c++) {
		const column = columns[c];
		const scale = Math.hypot(...column);
		if (!(scale > 0) || !Number.isFinite(scale)) continue;
		for (const reflector of reflectors) apply(column, reflector);
		const offset = reflectors.length;
		let norm = 0;
		for (let i = offset; i < dimension; i++) norm += column[i] * column[i];
		norm = Math.sqrt(norm);
		// relative to the row, so this is a rank test and not a question about
		// the units the caller happened to use
		if (!(norm / scale > 1e-10)) continue;
		const v = column.slice(offset);
		v[0] += (v[0] >= 0 ? 1 : -1) * norm;
		const vNorm = Math.hypot(...v);
		for (let i = 0; i < v.length; i++) v[i] /= vNorm;
		reflectors.push({ offset, v });
		kept.push(c);
	}
	const rank = reflectors.length;
	const rowBasis = [];
	const nullBasis = [];
	for (let j = 0; j < dimension; j++) {
		const vector = new Array(dimension).fill(0);
		vector[j] = 1;
		for (let k = rank - 1; k >= 0; k--) apply(vector, reflectors[k]);
		(j < rank ? rowBasis : nullBasis).push(vector);
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

	// reduce onto the null space of the free equalities: Z' (H Z), in two
	// products. Written as one quadruple loop this was O(m^4) - 5e8 operations
	// per active-set iteration at 151 variables, half of a 48 s SQP step.
	const k = nullBasis.length;
	const HZ = Array.from({ length: m }, (_, i) => {
		const row = H[freeIndex[i]];
		const out = new Array(k).fill(0);
		for (let j = 0; j < m; j++) {
			const hij = row[freeIndex[j]];
			if (hij === 0) continue;
			for (let q = 0; q < k; q++) out[q] += hij * nullBasis[q][j];
		}
		return out;
	});
	const reducedH = nullBasis.map((left) => {
		const out = new Array(k).fill(0);
		for (let i = 0; i < m; i++) {
			const li = left[i];
			if (li === 0) continue;
			const hz = HZ[i];
			for (let q = 0; q < k; q++) out[q] += li * hz[q];
		}
		return out;
	});
	// exactly symmetric, as the quadruple loop was up to round-off
	for (let a = 0; a < k; a++) {
		for (let b = a + 1; b < k; b++) {
			const mean = 0.5 * (reducedH[a][b] + reducedH[b][a]);
			reducedH[a][b] = mean;
			reducedH[b][a] = mean;
		}
	}
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
	// The previous subproblem's working set, as { atLower, atUpper, activeRows }
	// in the declared coordinates (rows are inequality rows). The solve still
	// starts at z0, which is what it can prove feasible, and makes one move
	// towards the optimum of that working set: the target satisfies the
	// equalities and so does z0, so every point between them does, and the
	// ratio test on the bounds decides how far the move goes. Landing on it
	// replaces the release-and-block walk that rebuilds the same set from
	// nothing every iteration. A working set that no longer fits costs one
	// free-block solve and leaves the walk where the ratio test stopped it.
	warmStart = null,
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
		// which side each pinned declared variable sits on, for the next warm start
		activeLower: working && result.z
			? working.map((v, i) => (v && i < declared && result.z[i] <= lower[i] + EPS ? i : -1)).filter((i) => i >= 0)
			: [],
		activeUpper: working && result.z
			? working.map((v, i) => (v && i < declared && !(result.z[i] <= lower[i] + EPS) && result.z[i] >= upper[i] - EPS ? i : -1)).filter((i) => i >= 0)
			: [],
		warm: result.warm ?? null,
	});

	const lo = lower;
	const up = upper;

	let z = z0.map((value, i) => Math.min(Math.max(value, lo[i]), up[i]));
	const atLower = z.map((value, i) => value <= lo[i] + EPS);
	const atUpper = z.map((value, i) => value >= up[i] - EPS);
	const working = z.map((_, i) => atLower[i] || atUpper[i]);

	let warm = null;
	if (warmStart && typeof warmStart === "object") {
		const pinnedValue = new Array(n).fill(null);
		for (const index of warmStart.atLower ?? []) if (index >= 0 && index < declared && Number.isFinite(lo[index])) pinnedValue[index] = lo[index];
		for (const index of warmStart.atUpper ?? []) if (index >= 0 && index < declared && Number.isFinite(up[index])) pinnedValue[index] = up[index];
		for (const row of warmStart.activeRows ?? []) { const index = declared + row; if (row >= 0 && index < n) pinnedValue[index] = lo[index]; }
		const pinnedCount = pinnedValue.filter((value) => value !== null).length;
		if (pinnedCount > 0 || (warmStart.atLower ?? []).length + (warmStart.atUpper ?? []).length + (warmStart.activeRows ?? []).length === 0) {
			const seeded = z.map((value, i) => (pinnedValue[i] === null ? value : pinnedValue[i]));
			const target = solveFreeBlock({ H, c, A, b, z: seeded, free: pinnedValue.map((value) => value === null), damping });
			if (target) {
				const direction = target.map((value, i) => value - z[i]);
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
				if (alpha > EPS) {
					z = z.map((value, i) => Math.min(Math.max(value + alpha * direction[i], lo[i]), up[i]));
					for (let i = 0; i < n; i++) working[i] = z[i] <= lo[i] + EPS || z[i] >= up[i] - EPS;
					warm = Object.freeze({ alpha, pinned: pinnedCount, blocking });
				}
			}
		}
	}

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
	// Zero-length steps in a row: a release that is blocked at once by another
	// bound swaps two members of the working set without moving the point.
	// Bland's rule bounds that in exact arithmetic; with the multipliers of a
	// degenerate vertex it does not, measured on the lexicographic vertex tier
	// as 101 releases and 98 blocks in 200 iterations at one and the same z.
	// More such swaps than there are variables, with Bland already running,
	// is the vertex: the point is reported stationary on its working set.
	let zeroSteps = 0;

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
			// The bound multipliers. The equality multipliers come from the free
			// block's own stationarity, g_F + A_F' mu = 0 in least squares (exact
			// at the free block's optimum, where g_F lies in the row space of
			// A_F), and what a pinned variable's gradient component leaves after
			// the equalities have had theirs is its bound multiplier:
			// nu_P = -(g_P + A_P' mu). Projecting the whole gradient off the row
			// space of A, over all n coordinates, was the test before this: it
			// returns -(I - P) nu, the null-space part of nu, and where a pinned
			// variable's column has a part in the row space that is not the
			// multiplier. Measured on the lexicographic vertex tier: a subproblem
			// reported solved with an objective 1.8e-6 above what another working
			// set reaches, and answers at degenerate vertices that depended on
			// the path taken to them.
			//
			// At a degenerate vertex the free columns do not determine mu: A_F
			// is rank-deficient and the multipliers form a set, not a point,
			// so a pinned variable's nu depends on which mu is picked. The
			// pinned columns are given a millionth of the weight in the fit.
			// Where A_F determines mu that is invisible; where it does not,
			// the pinned columns decide, which is what the old test did with
			// full weight. Measured on the strict lexicographic order, whose
			// held phase lives at such vertices, with the exact fit alone:
			// 129 -> 124 of 235.
			if (A.length > 0) {
				const freeIndex = [];
				const pinnedIndex = [];
				for (let i = 0; i < n; i++) (working[i] ? pinnedIndex : freeIndex).push(i);
				const Af = A.map((row) => freeIndex.map((i) => row[i]));
				const Ap = A.map((row) => pinnedIndex.map((i) => row[i]));
				const pinnedWeight = 1e-6;
				const gram = Af.map((rowA, r) => Af.map((rowB, q) => dot(rowA, rowB) + pinnedWeight * dot(Ap[r], Ap[q])));
				const gramScale = Math.max(...gram.map((row, r) => Math.abs(row[r])), 1);
				for (let r = 0; r < gram.length; r++) gram[r][r] += 1e-12 * gramScale;
				const rhs = Af.map((row, r) => -row.reduce((sum, value, k) => sum + value * gradient[freeIndex[k]], 0)
					- pinnedWeight * Ap[r].reduce((sum, value, k) => sum + value * gradient[pinnedIndex[k]], 0));
				const mu = solveSpd(gram, rhs);
				if (mu) {
					for (let i = 0; i < n; i++) {
						let sum = 0;
						for (let r = 0; r < A.length; r++) sum += A[r][i] * mu[r];
						gradient[i] += sum;
					}
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
				return finish({ ok: true, status: "solved", z, iterations, released, blocked, warm }, working);
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
		zeroSteps = alpha <= EPS ? zeroSteps + 1 : 0;
		if (zeroSteps > n && degenerate >= blandAfter) {
			if (blocking >= 0) working[blocking] = true;
			return finish({ ok: true, status: "stationary_on_working_set", z, iterations, released, blocked, warm }, working);
		}

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
					{ ok: true, status: "stationary_on_working_set", z, iterations, released, blocked, warm },
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
		ok: false, status: "max_iterations", z, iterations, warm,
		detail: Object.freeze({
			variables: n,
			declaredVariables: declared,
			slacks: slackCount,
			equalities: A.length,
			workingSet: working.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
			released, blocked, degenerate,
			bland: degenerate >= blandAfter,
		}),
	}, working);
}
