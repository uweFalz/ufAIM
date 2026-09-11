import assert from "node:assert/strict";
import test from "node:test";

const { solveBoxQP } = await import(new URL("../../src/lib/math/optim/qp/solveBoxQP.js", import.meta.url));

// A deterministic generator, so a failure names its trial.
function generator(seed) {
	let state = seed >>> 0;
	return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; };
}

function solveDense(M, r) {
	const a = M.map((row, i) => [...row, r[i]]);
	const k = r.length;
	for (let c = 0; c < k; c++) {
		let p = c;
		for (let i = c + 1; i < k; i++) if (Math.abs(a[i][c]) > Math.abs(a[p][c])) p = i;
		if (Math.abs(a[p][c]) < 1e-12) return null;
		[a[c], a[p]] = [a[p], a[c]];
		for (let i = 0; i < k; i++) {
			if (i === c) continue;
			const f = a[i][c] / a[c][c];
			for (let j = c; j <= k; j++) a[i][j] -= f * a[c][j];
		}
	}
	return a.map((row, i) => row[k] / row[i]);
}

const objective = (H, c, z) => z.reduce((s, v, i) => s + c[i] * v + 0.5 * v * z.reduce((t, w, j) => t + H[i][j] * w, 0), 0);

/** the optimum by enumerating every pattern of pinned variables */
function bruteForce({ H, c, A, b, lower, upper }) {
	const n = c.length;
	const m = A.length;
	let best = null;
	for (let code = 0; code < 3 ** n; code++) {
		const pattern = [];
		let x = code;
		for (let i = 0; i < n; i++) { pattern.push(x % 3); x = Math.floor(x / 3); }
		const free = pattern.map((p, i) => (p === 0 ? i : -1)).filter((i) => i >= 0);
		const k = free.length;
		const pinned = pattern.map((p, i) => (p === 1 ? lower[i] : p === 2 ? upper[i] : 0));
		const size = k + m;
		const M = Array.from({ length: size }, () => new Array(size).fill(0));
		const r = new Array(size).fill(0);
		for (let a = 0; a < k; a++) {
			for (let bb = 0; bb < k; bb++) M[a][bb] = H[free[a]][free[bb]];
			for (let row = 0; row < m; row++) { M[a][k + row] = A[row][free[a]]; M[k + row][a] = A[row][free[a]]; }
			r[a] = -c[free[a]] - pattern.reduce((s, p, i) => s + (p !== 0 ? H[free[a]][i] * pinned[i] : 0), 0);
		}
		for (let row = 0; row < m; row++) r[k + row] = b[row] - pattern.reduce((s, p, i) => s + (p !== 0 ? A[row][i] * pinned[i] : 0), 0);
		const solution = solveDense(M, r);
		if (!solution) continue;
		const z = pinned.slice();
		free.forEach((i, a) => { z[i] = solution[a]; });
		if (z.some((v, i) => v < lower[i] - 1e-9 || v > upper[i] + 1e-9)) continue;
		const f = objective(H, c, z);
		if (!best || f < best.f) best = { f, z };
	}
	return best;
}

test("the bound multipliers are the equalities' leftovers, so a solved subproblem is the optimum", () => {
	// Before this the multiplier of a pinned variable was read off the gradient
	// projected out of the row space of A over all coordinates - which is the
	// null-space part of the multiplier vector, not the multiplier, whenever a
	// pinned variable's column has a part in the row space. Measured on 5000
	// random problems with two equality rows: 8 % of the answers reported
	// "solved" sat above the optimum, by up to a tenth of the objective. With mu
	// fitted on the free block and nu_P = -(g_P + A_P' mu), none did.
	const random = generator(7);
	const n = 5;
	const m = 2;
	let trials = 0;
	let suboptimal = 0;
	for (let t = 0; t < 300; t++) {
		const G = Array.from({ length: n }, () => Array.from({ length: n }, () => random() - 0.5));
		const H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => G[i].reduce((s, v, k) => s + v * G[j][k], 0) + (i === j ? 0.1 : 0)));
		const c = Array.from({ length: n }, () => 2 * random() - 1);
		const A = Array.from({ length: m }, () => Array.from({ length: n }, () => 2 * random() - 1));
		const lower = Array.from({ length: n }, () => -random());
		const upper = Array.from({ length: n }, () => random());
		const z0 = lower.map((l, i) => l + (upper[i] - l) * random());
		const b = A.map((row) => row.reduce((s, v, i) => s + v * z0[i], 0));
		const best = bruteForce({ H, c, A, b, lower, upper });
		if (!best) continue;
		trials++;
		const run = solveBoxQP({ H, c, A, b, lower, upper, z0 });
		assert.equal(run.ok, true, `trial ${t}: ${run.status}`);
		if (objective(H, c, run.z) > best.f + 1e-7) suboptimal++;
	}
	assert.ok(trials > 250, `${trials} trials`);
	assert.equal(suboptimal, 0, `${suboptimal} of ${trials} answers above the optimum`);
});

test("a warm start lands on the same optimum with fewer iterations, and a wrong one costs one move", () => {
	// The previous subproblem's working set is handed in as { atLower, atUpper,
	// activeRows }; the solve still starts at z0 and makes one move towards
	// the optimum of that set. The answer is the optimum either way; what
	// changes is the walk.
	const random = generator(11);
	const n = 5;
	const m = 2;
	let cold = 0;
	let warm = 0;
	let trials = 0;
	for (let t = 0; t < 200; t++) {
		const G = Array.from({ length: n }, () => Array.from({ length: n }, () => random() - 0.5));
		const H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => G[i].reduce((s, v, k) => s + v * G[j][k], 0) + (i === j ? 0.1 : 0)));
		const c = Array.from({ length: n }, () => 2 * random() - 1);
		const A = Array.from({ length: m }, () => Array.from({ length: n }, () => 2 * random() - 1));
		const lower = Array.from({ length: n }, () => -random());
		const upper = Array.from({ length: n }, () => random());
		const z0 = lower.map((l, i) => l + (upper[i] - l) * random());
		const b = A.map((row) => row.reduce((s, v, i) => s + v * z0[i], 0));
		const first = solveBoxQP({ H, c, A, b, lower, upper, z0 });
		if (!first.ok) continue;
		// the same problem again, from its own answer's working set
		const again = solveBoxQP({ H, c, A, b, lower, upper, z0, warmStart: { atLower: first.activeLower, atUpper: first.activeUpper, activeRows: first.activeRows } });
		assert.equal(again.ok, true);
		assert.ok(Math.max(...again.z.map((v, i) => Math.abs(v - first.z[i]))) < 1e-8, `trial ${t}: warm answer differs`);
		// and from a working set that is wrong on purpose
		const wrong = solveBoxQP({ H, c, A, b, lower, upper, z0, warmStart: { atLower: first.activeUpper, atUpper: first.activeLower, activeRows: [] } });
		assert.equal(wrong.ok, true);
		assert.ok(Math.max(...wrong.z.map((v, i) => Math.abs(v - first.z[i]))) < 1e-8, `trial ${t}: answer after a wrong warm start differs`);
		trials++;
		cold += first.iterations;
		warm += again.iterations;
	}
	assert.ok(trials > 150, `${trials} trials`);
	assert.ok(warm < 0.6 * cold, `warm ${warm} against cold ${cold} iterations over ${trials} problems`);
});

