import assert from "node:assert/strict";
import test from "node:test";

const { solveBoxQP } = await import(new URL("../../src/lib/math/optim/qp/solveBoxQP.js", import.meta.url));
const { solveSQP } = await import(new URL("../../src/lib/math/optim/sqp/solveSQP.js", import.meta.url));

// The relaxed subproblem of one real turnout, exactly as the solver assembled
// it: Billwerder/03_Büchen/ABCH_Gl_064 at iteration 7 of the length objective.
// Three free quantities (an arc's curvature, a transition's length, a
// straight's length) against three end-pose equalities, the transition's
// length sitting on its floor. The subproblem starts at (d, delta) = (0, 1),
// where delta costs eta/2 = 5e5, and a feasible step with delta = 0 exists
// inside the box at a cost of -6.9.
const CASE = {
	H: [[94.58794119, 6.770975376, -0.1649005549], [6.770975376, 0.8943766276, -0.02255916036], [-0.1649005549, -0.02255916036, 0.0005826849597]],
	gradF: [0, 1, 1],
	h: [-7.813341459, 2.071229695, 4.956754727],
	Jh: [[-121.9024576, -0.9234573925, -0.7167442118], [-118.7486196, 0.4849647865, 0.6973361706], [210.3139453, 0.4830024647, 0]],
	lower: [-4.606901851, 0, -422.0754306],
	upper: [2.059764816, 5702.60183, 5702.60183],
};
const ETA = 1e6;
const n = CASE.gradF.length;
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

function relaxed() {
	const size = n + 1;
	const H = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) =>
		(i < n && j < n ? CASE.H[i][j] : i === n && j === n ? ETA : 0)));
	const c = [...CASE.gradF, 0];
	return {
		H, c,
		A: CASE.Jh.map((row, j) => [...row, -CASE.h[j]]),
		b: CASE.h.map((value) => -value),
		lower: [...CASE.lower, 0],
		upper: [...CASE.upper, 1],
		z0: [...new Array(n).fill(0), 1],
		cost: (z) => 0.5 * dot(z, H.map((row) => dot(row, z))) + dot(c, z),
	};
}

test("with the transition on its floor the subproblem is right to relax fully", () => {
	// A step with delta = 0 and the pinned length held looks available: solve
	// the two remaining unknowns against the three equalities by least squares
	// and the cost comes out at -6.9. It is not available. The residual of that
	// fit is 0.03 against equalities of order 5; the exact solutions of the
	// linearised system form a line, and along it delta falls only as the
	// pinned length goes negative, which the floor forbids. So (0, 1) is the
	// subproblem's optimum, and an attempt to make the QP "leave the vertex"
	// - tried, and it broke Gerdts 3.2.3 - fixes the wrong thing.
	const qp = relaxed();
	const free = solveBoxQP({ ...qp, maxIterations: 2000 });
	assert.equal(free.status, "solved");
	assert.ok(free.z[n] > 1 - 1e-4, `delta ${free.z[n]}`);

	// the exact linearised system with the pinned length held: unique, at delta = 1
	const forced = solveBoxQP({ ...qp, lower: [...CASE.lower, 0], upper: [...CASE.upper, 0], z0: [...new Array(n).fill(0), 0], maxIterations: 2000 });
	const residual = qp.A.map((row, j) => dot(row, forced.z) - qp.b[j]);
	assert.ok(Math.max(...residual.map(Math.abs)) > 1e-3,
		`the delta = 0 point should violate the equalities, residual ${residual.map((v) => v.toExponential(1))}`);
});

test("a subproblem that cannot move is reported, not run out", () => {
	// The same situation stripped to one variable: an equality the bounds put
	// out of reach. The relaxation returns (0, 1) every time; the solve has to
	// say so instead of spending its whole budget on it.
	const evaluate = ([x]) => ({ f: x, gradF: [1], h: [x - 5], Jh: [[1]], g: [], Jg: [] });
	const run = solveSQP({ x0: [0], evaluate, lower: [-1], upper: [1], maxIterations: 60, restoration: "off" });
	assert.equal(run.status, "infeasible_subproblem");
	assert.equal(run.ok, false);
	assert.ok(run.iterations < 20, `took ${run.iterations} iterations to say so`);
	assert.match(run.reason, /linearised constraints/);
});

test("restoration must not fake a success where the box excludes feasibility", () => {
	// x = 5 is not in [-1, 1]. Restoration drives x to the bound and can go no
	// further; that is reported as restoration_failed with the violation it
	// reached, never as a feasible start.
	const evaluate = ([x]) => ({ f: x, gradF: [1], h: [x - 5], Jh: [[1]], g: [], Jg: [] });
	const run = solveSQP({ x0: [0], evaluate, lower: [-1], upper: [1], maxIterations: 60 });
	assert.equal(run.status, "restoration_failed");
	assert.equal(run.ok, false);
	assert.ok(Math.abs(run.x[0] - 1) < 1e-9, `restoration should reach the bound, x = ${run.x[0]}`);
	assert.match(run.reason, /restoration_stalled|violation went from/);
	assert.ok(run.history.some((entry) => entry.status === "restoration_stalled"));
});

test("eager restoration gets feasible first when the start is far outside the region", () => {
	// Minimise x² + y² on the circle of radius 100, the constraint row scaled
	// by 50 as the alignment's heading row is by its lever arm. From (95, 0)
	// the start violates it by 250 against a region of 9.5. Under "eager" the
	// run restores before its first subproblem and the history says so at
	// iteration 0; under the default it does not restore at all (the
	// subproblem never comes back fully relaxed here).
	const evaluate = ([x, y]) => ({
		f: 0.5 * (x * x + y * y), gradF: [x, y],
		h: [50 * (Math.hypot(x, y) - 100)], Jh: [[50 * x / Math.hypot(x, y), 50 * y / Math.hypot(x, y)]], g: [], Jg: [],
	});
	const eager = solveSQP({ x0: [95, 0], evaluate, maxIterations: 100, restoration: "eager" });
	assert.equal(eager.history[0]?.status, "restored", `eager: ${eager.history[0]?.status}`);
	assert.equal(eager.history[0].iteration, 0);
	assert.ok(eager.history[0].violationBefore > 200 && eager.history[0].violationAfter < 1e-9);
	assert.ok(eager.ok, `${eager.status} ${eager.reason ?? ""}`);
	assert.ok(Math.abs(Math.hypot(...eager.x) - 100) < 1e-6);

	const lazy = solveSQP({ x0: [95, 0], evaluate, maxIterations: 100 });
	assert.ok(!lazy.history.some((entry) => entry.status === "restored"), "on-verdict does not restore a start");

	// a start whose violation is within the region is not restored, eager or not
	const near = solveSQP({ x0: [99.9, 0], evaluate, maxIterations: 100, restoration: "eager" });
	assert.notEqual(near.history[0]?.status, "restored");
	assert.ok(near.ok, `${near.status}`);
});
