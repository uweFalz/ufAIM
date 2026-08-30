import assert from "node:assert/strict";
import test from "node:test";

const OPTIM = new URL("../../src/lib/math/optim/", import.meta.url);
const { solveBoxQP } = await import(new URL("qp/solveBoxQP.js", OPTIM));
const { solveSQP } = await import(new URL("sqp/solveSQP.js", OPTIM));
const { modifiedBfgsUpdate, identityMatrix, solveRelaxedQpStep } =
	await import(new URL("sqp/sqpStep.js", OPTIM));
const { l1Merit, updatePenaltyWeights, createPenaltyWeights } =
	await import(new URL("sqp/merit.js", OPTIM));
const { lineSearchArmijo } = await import(new URL("sqp/lineSearchArmijo.js", OPTIM));
const { finiteDiffJacobian } = await import(new URL("diff/finiteDiffJacobian.js", OPTIM));

const close = (actual, expected, tolerance, what) =>
	assert.ok(
		Math.abs(actual - expected) <= tolerance,
		`${what}: expected ${expected}, got ${actual}, tolerance ${tolerance}`
	);
const closeAll = (actual, expected, tolerance, what) =>
	actual.forEach((value, i) => close(value, expected[i], tolerance, `${what}[${i}]`));

// ---------------------------------------------------------------- box QP

test("box QP reproduces analytically known solutions", () => {
	const unconstrained = solveBoxQP({
		H: [[1, 0], [0, 1]], c: [1, -2], lower: [-9, -9], upper: [9, 9], z0: [0, 0],
	});
	closeAll(unconstrained.z, [-1, 2], 1e-8, "unconstrained minimum is -H^-1 c");

	const bounded = solveBoxQP({
		H: [[1, 0], [0, 1]], c: [1, -2], lower: [0, -9], upper: [9, 9], z0: [0, 0],
	});
	closeAll(bounded.z, [0, 2], 1e-8, "a lower bound truncates the first component");

	const equality = solveBoxQP({
		H: [[1, 0], [0, 1]], c: [0, 0], A: [[1, 1]], b: [2],
		lower: [-9, -9], upper: [9, 9], z0: [2, 0],
	});
	closeAll(equality.z, [1, 1], 1e-8, "minimum norm point on z1 + z2 = 2");

	const coupled = solveBoxQP({
		H: [[2, 1], [1, 2]], c: [-1, -1], lower: [-9, -9], upper: [9, 9], z0: [0, 0],
	});
	closeAll(coupled.z, [1 / 3, 1 / 3], 1e-8, "coupled Hessian");
});

test("box QP releases a bound the starting point sat on", () => {
	const result = solveBoxQP({
		H: [[1, 0], [0, 1]], c: [1, -2], lower: [-9, -9], upper: [9, 9], z0: [-9, 9],
	});
	assert.equal(result.ok, true);
	closeAll(result.z, [-1, 2], 1e-8, "released both bounds");
	assert.ok(result.released >= 1, "at least one bound was released");
});

test("the relaxed QP trades its slack against the step", () => {
	// h + h_x d - h delta = 0 with h = 1, h_x = 1  =>  d - delta = -1
	// objective 1/2 d^2 + (eta/2) delta^2 with eta = 10  =>  d = -10/11, delta = 1/11
	const result = solveBoxQP({
		H: [[1, 0], [0, 10]], c: [0, 0], A: [[1, -1]], b: [-1],
		lower: [-1e9, 0], upper: [1e9, 1], z0: [0, 1],
	});
	assert.equal(result.ok, true);
	closeAll(result.z, [-10 / 11, 1 / 11], 1e-8, "relaxed QP");
});

test("(d, delta) = (0, 1) is feasible for the relaxed step by construction", () => {
	// Gerdts 3.3.1: g(x) = 1 - x^2 <= 0 at x = 0 linearises to 1 <= 0.
	// Written as an equality the same inconsistency appears, and the relaxation
	// is what keeps the subproblem solvable.
	const step = solveRelaxedQpStep({
		H: identityMatrix(1),
		gradF: [0],
		h: [1],
		Jh: [[0]],
		lower: [-10],
		upper: [10],
		relaxationWeight: 4,
	});
	assert.equal(step.ok, true, "an inconsistent linearisation still yields a step");
	close(step.delta, 1, 1e-8, "the slack absorbs the whole inconsistency");
});

// ---------------------------------------------------------------- BFGS

test("modified BFGS keeps a zero Hessian positive definite", () => {
	// A linear objective has no curvature at all; the update must still deliver
	// a matrix that gives d' H d > 0, or the line search loses its guarantee.
	let H = identityMatrix(2);
	const s = [0.3, -0.2];
	const y = [0, 0];               // linear objective: gradient never changes
	H = modifiedBfgsUpdate(H, s, y);
	const quadratic = s.reduce((sum, value, i) =>
		sum + value * H[i].reduce((inner, h, j) => inner + h * s[j], 0), 0);
	assert.ok(quadratic > 0, `d' H d must stay positive, got ${quadratic}`);
	assert.ok(H.every((row) => row.every(Number.isFinite)), "no NaN entered the matrix");
});

test("modified BFGS stays symmetric", () => {
	let H = identityMatrix(3, 2);
	H = modifiedBfgsUpdate(H, [1, 0.5, -0.25], [0.4, -0.1, 0.6]);
	for (let i = 0; i < 3; i++) {
		for (let j = i + 1; j < 3; j++) close(H[i][j], H[j][i], 1e-15, `symmetry (${i},${j})`);
	}
});

// ---------------------------------------------------------------- merit

test("Powell weights dominate the multipliers and weigh each constraint on its own", () => {
	let weights = createPenaltyWeights({ equalityCount: 2 });
	weights = updatePenaltyWeights(weights, { equality: [10, 0.1], inequality: [] });
	assert.ok(weights.equality[0] >= 10, "the weight dominates the large multiplier");
	assert.ok(weights.equality[1] < weights.equality[0], "weights are per constraint");
});

test("the l1 merit charges objective and violation together", () => {
	const weights = { inequality: [2], equality: [3] };
	close(l1Merit({ f: 1, g: [0.5], h: [-2] }, weights), 1 + 2 * 0.5 + 3 * 2, 1e-12, "l1 merit");
	close(l1Merit({ f: 1, g: [-5], h: [] }, weights), 1, 1e-12, "a satisfied inequality costs nothing");
});

// ---------------------------------------------------------------- line search

test("the line search refuses a direction with no guaranteed descent", () => {
	// predicted decrease -d'Qd is zero exactly when Q is singular in that
	// direction, which is the linear-objective case
	const result = lineSearchArmijo({ meritAt0: 1, predictedDecrease: 0, meritAt: () => 0 });
	assert.equal(result.ok, false);
	assert.equal(result.status, "no_descent_direction");
});

test("the line search backtracks until Armijo is satisfied", () => {
	const result = lineSearchArmijo({
		meritAt0: 10,
		predictedDecrease: -1,
		meritAt: (alpha) => (alpha > 0.3 ? 11 : 9),
	});
	assert.equal(result.ok, true);
	assert.ok(result.alpha <= 0.3, "it stepped back into the accepting region");
	assert.ok(result.backtracks >= 1);
});

// ---------------------------------------------------------------- Jacobian

test("the finite-difference Jacobian steps in each variable's own magnitude", () => {
	// f(x) = [x0 * x1, x1^2] with x = (2, 1e-3)
	const result = finiteDiffJacobian({
		x: [2, 1e-3],
		scales: [1, 1e-3],
		residual: ([a, b]) => [a * b, b * b],
	});
	assert.equal(result.ok, true);
	closeAll(result.J[0], [1e-3, 2], 1e-9, "row 0");
	closeAll(result.J[1], [0, 2e-3], 1e-9, "row 1");
});

// ---------------------------------------------------------------- SQP

test("SQP reproduces the published solution of Gerdts example 3.2.3", () => {
	// f = (x-2)^2 + (y-3)^2, h = y + x/2 - 1/2; solution (3/5, 1/5), mu = 28/5
	const evaluate = ([x, y]) => ({
		f: (x - 2) ** 2 + (y - 3) ** 2,
		gradF: [2 * (x - 2), 2 * (y - 3)],
		h: [y + x / 2 - 0.5],
		Jh: [[0.5, 1]],
	});
	for (const start of [[0, 0], [3, 3], [-5, 8]]) {
		const run = solveSQP({ x0: start, evaluate, maxIterations: 60 });
		assert.equal(run.ok, true, `start ${start}`);
		// the KKT test is relative to the gradient, so it stops a little earlier
		// than an absolute one would; 1e-7 on a solution of order 1 is still
		// seven digits
		closeAll(run.x, [0.6, 0.2], 1e-7, `solution from ${start}`);
		close(run.multipliers.equality[0], 28 / 5, 1e-6, `multiplier from ${start}`);
	}
});

test("SQP solves a linear objective, where a fixed zero Hessian cannot", () => {
	// min x + y on the unit circle: the objective Hessian is exactly zero, so
	// the descent estimate -d'Qd vanishes unless BFGS supplies curvature
	const evaluate = ([x, y]) => ({
		f: x + y,
		gradF: [1, 1],
		h: [x * x + y * y - 1],
		Jh: [[2 * x, 2 * y]],
	});
	const run = solveSQP({ x0: [1, 0], evaluate, maxIterations: 80 });
	assert.equal(run.ok, true);
	closeAll(run.x, [-Math.SQRT1_2, -Math.SQRT1_2], 1e-6, "minimum on the circle");

	// and the mechanism: a zero Hessian still yields a step, but one that
	// predicts no decrease at all, so the line search has nothing to accept
	const noCurvature = solveRelaxedQpStep({
		H: [[0, 0], [0, 0]], gradF: [1, 1], h: [0.5], Jh: [[2, 2]],
	});
	assert.equal(noCurvature.ok, true, "the subproblem is still solvable");
	// note: -0 is a legitimate result here, and strictEqual would reject it
	assert.ok(noCurvature.predictedDecrease === 0, "but it predicts no decrease");
});

test("SQP honours bounds on the variables", () => {
	const evaluate = ([x, y]) => ({
		f: (x - 5) ** 2 + (y - 5) ** 2,
		gradF: [2 * (x - 5), 2 * (y - 5)],
		h: [],
		Jh: [],
	});
	const run = solveSQP({ x0: [0, 0], evaluate, lower: [-10, -10], upper: [1, 2], maxIterations: 40 });
	assert.equal(run.ok, true);
	closeAll(run.x, [1, 2], 1e-6, "both bounds are active at the optimum");
});

// ---------------------------------------------------------------- globalisation

test("the trust region bounds the step, and a linear objective needs it to", () => {
	// min x + y on the unit circle: the objective supplies no curvature at all,
	// so the reduced Hessian is whatever BFGS scrapes from the constraint and
	// the Newton step can be enormous. Every step must stay inside the region.
	const evaluate = ([x, y]) => ({
		f: x + y, gradF: [1, 1],
		h: [x * x + y * y - 1], Jh: [[2 * x, 2 * y]],
	});
	const run = solveSQP({ x0: [1, 0], evaluate, trustRadius: 0.25, maxIterations: 200 });
	assert.equal(run.ok, true);
	closeAll(run.x, [-Math.SQRT1_2, -Math.SQRT1_2], 1e-6, "minimum on the circle");
	// The recorded radius is the one this iteration grew or shrank to, so the
	// step is checked against the region it was actually drawn from - the
	// previous entry's. The box is per component, so the norm may reach sqrt(n)
	// times the radius.
	const steps = run.history.filter((entry) => entry.stepNorm !== undefined);
	assert.ok(steps.length > 3, "there is something to check");
	steps.forEach((entry, i) => {
		const region = i === 0 ? 0.25 : steps[i - 1].radius;
		assert.ok(
			entry.stepNorm <= region * Math.SQRT2 + 1e-9,
			`iteration ${entry.iteration}: step ${entry.stepNorm} outside a region of ${region}`
		);
	});
	assert.ok(
		steps.some((entry) => entry.radius > 0.25),
		"and the region grows again once full steps are accepted"
	);
});

test("stationarity is measured on the free variables, not against a bound", () => {
	// At (1, 2) the gradient is (-8, -6) and nothing is left to do: both bounds
	// hold it. A plain gradient test would call that a residual of 10 and refuse
	// to stop; only the projected one sees an optimum.
	const evaluate = ([x, y]) => ({
		f: (x - 5) ** 2 + (y - 5) ** 2,
		gradF: [2 * (x - 5), 2 * (y - 5)], h: [], Jh: [],
	});
	const run = solveSQP({ x0: [0, 0], evaluate, lower: [-10, -10], upper: [1, 2], maxIterations: 40 });
	assert.equal(run.ok, true, `status ${run.status}`);
	closeAll(run.x, [1, 2], 1e-6, "both bounds are active at the optimum");
	assert.ok(run.iterations < 10, `took ${run.iterations} iterations for a two-step walk`);
});

test("a collapsed step is not reported as stationary while the gradient says otherwise", () => {
	// A trust region small enough to freeze the iteration must not be allowed to
	// look like convergence: the step goes to zero either because the point is
	// stationary or because the region collapsed onto it, and only the KKT
	// residual tells the two apart. Measured before this guard, a run reported
	// merit_stationary at a KKT residual of 3.09.
	const evaluate = ([x, y]) => ({
		f: (x - 5) ** 2 + (y - 5) ** 2,
		gradF: [2 * (x - 5), 2 * (y - 5)], h: [], Jh: [],
	});
	const run = solveSQP({
		x0: [0, 0], evaluate, trustRadius: 1e-9, minTrustRadius: 1e-9, maxIterations: 5,
	});
	assert.equal(run.ok, false, "a frozen iteration is not a solved one");
	assert.equal(run.status, "max_iterations");
	assert.ok(Math.hypot(run.x[0] - 5, run.x[1] - 5) > 1, "and it is nowhere near the optimum");
});

test("the second-order correction rescues the step the l1 kink would reject", () => {
	// min x on the unit circle, solution (-1, 0). Near it the constraint curves
	// away from every descent direction, so a step that lowers the objective
	// raises the violation at second order and the merit charges for it at once.
	// That is the Maratos effect; the correction re-closes the constraint at the
	// trial point instead of backtracking to nothing.
	const evaluate = ([x, y]) => ({
		f: x, gradF: [1, 0],
		h: [x * x + y * y - 1], Jh: [[2 * x, 2 * y]],
	});
	const from = [Math.cos(2.9), Math.sin(2.9)];
	const run = solveSQP({ x0: from, evaluate, maxIterations: 120 });
	assert.equal(run.ok, true, `status ${run.status}`);
	closeAll(run.x, [-1, 0], 1e-5, "minimum on the circle");
	assert.ok(
		run.history.some((entry) => entry.correction === true),
		"the correction was actually used, so this test measures it"
	);
});

// ---------------------------------------------------------------- boundary

test("the optimisation library stays free of domain and platform dependencies", async () => {
	const { readFile } = await import("node:fs/promises");
	const files = [
		"qp/solveBoxQP.js", "sqp/solveSQP.js", "sqp/sqpStep.js",
		"sqp/merit.js", "sqp/lineSearchArmijo.js",
		"diff/finiteDiffJacobian.js", "scale/variableScaling.js",
	];
	for (const name of files) {
		const source = await readFile(new URL(name, OPTIM), "utf8");
		const code = source
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
		for (const forbidden of [
			/\bdocument\b/, /\bwindow\b/, /localStorage|indexedDB/,
			/\balignment/i, /\bSpot\b/, /\bkappa\b/,
		]) {
			assert.doesNotMatch(code, forbidden, `${name} must not contain ${forbidden}`);
		}
		for (const [, spec] of code.matchAll(/^\s*(?:import|export)\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm)) {
			assert.match(spec, /^\.{1,2}\//, `${name} imports outside the library: ${spec}`);
		}
	}
});
