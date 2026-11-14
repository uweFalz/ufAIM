import assert from "node:assert/strict";
import test from "node:test";

// The restoration where a filter method needs it (2026-11-13): a violated
// inequality that is curved brings its Newton term, and a search that finds
// no step beside the constraints hands over to the restoration instead of
// ending the solve. Measured on the largest alignments of the corpus in
// docs/app/architecture/AXTRAN2_LENGTH_TIER_STABILITY_2026-11-12.md, section
// 10; these are the same two statements on problems that need no corpus.

const OPTIM = new URL("../../src/lib/math/optim/", import.meta.url);
const { restoreFeasibility } = await import(new URL("sqp/restoreFeasibility.js", OPTIM));
const { solveSQP } = await import(new URL("sqp/solveSQP.js", OPTIM));
const { scaleEvaluator } = await import(new URL("scale/variableScaling.js", OPTIM));

// A corridor in small: g = (r1^2 + r2^2) / 2 - 1 with r1 = 1e4 x1 and r2 = x2,
// one residual stiff and one soft, as the squares of a long alignment are
// against a heading and a length. From (1e-6, 1.5) the row is 0.125 over.
const STIFF = 1e4;
const corridor = (withCurvature) => ([x1, x2]) => {
	const r1 = STIFF * x1;
	return {
		f: 0, gradF: [0, 0], h: [], Jh: [],
		g: [(r1 * r1 + x2 * x2) / 2 - 1],
		Jg: [[STIFF * r1, x2]],
		...(withCurvature ? { rowCurvature: () => [{ row: 0, hessian: [[STIFF * STIFF, 0], [0, 1]] }] } : {}),
	};
};
const START = [1e-6, 1.5];

test("a least-squares step on one strongly curved row is its gradient and stalls", () => {
	const run = restoreFeasibility({ evaluate: corridor(false), x: START });
	assert.equal(run.ok, false);
	assert.equal(run.status, "restoration_stalled");
	assert.ok(run.violationAfter > 0.5 * run.violationBefore, `from ${run.violationBefore} to ${run.violationAfter} in ${run.steps} steps`);
});

test("with the row's second derivative the restoration closes it along the soft residual", () => {
	const run = restoreFeasibility({ evaluate: corridor(true), x: START });
	assert.equal(run.ok, true, `${run.status}: from ${run.violationBefore} to ${run.violationAfter} in ${run.steps} steps`);
	assert.ok(run.steps <= 8, `${run.steps} steps`);
	assert.ok(run.violationAfter <= 1e-9, `violation ${run.violationAfter}`);
	// the stiff residual stayed where it was; the soft one came in to the row
	assert.ok(Math.abs(run.x[0]) < 1e-5, `x1 = ${run.x[0]}`);
	assert.ok(Math.abs(run.x[1] - Math.SQRT2) < 1e-3, `x2 = ${run.x[1]}`);
});

test("a row that is not violated brings no curvature, and one without a statement none either", () => {
	let asked = 0;
	const inside = ([x1, x2]) => ({ ...corridor(false)([x1, x2]), h: [x2 - 1], Jh: [[0, 1]], rowCurvature: () => { asked += 1; return [{ row: 0, hessian: [[STIFF * STIFF, 0], [0, 1]] }]; } });
	const run = restoreFeasibility({ evaluate: inside, x: [0, 0.5] });
	assert.equal(run.ok, true, run.status);
	assert.equal(asked, 0, "the second derivative is asked for only where a row is violated");
	assert.ok(Math.abs(run.x[1] - 1) < 1e-9);
});

test("the row's second derivative scales with the variables like the Hessian", () => {
	const scales = [1e-4, 1];
	const scaled = scaleEvaluator(corridor(true), scales)([START[0] / scales[0], START[1] / scales[1]]);
	assert.deepEqual(scaled.rowCurvature(), [{ row: 0, hessian: [[1, 0], [0, 1]] }]);
	assert.equal(scaleEvaluator(corridor(false), scales)([0, 0]).rowCurvature, undefined);
});

// A search that finds no step. The evaluator is a double: asked by the solve
// (with the subproblem's multipliers) it states the equality's derivative
// with the wrong sign, so every step the subproblem proposes raises the
// violation, and with an objective that offers nothing in exchange the filter
// refuses it at any length; asked by the restoration (without) it states the
// derivative as it is. The violation is small against the region's floor, so
// the subproblem never comes back fully relaxed, and the creep verdict is
// switched out of the way: what is left is the region halving to its floor
// beside the constraint, which is where the length tier of the largest
// alignments ended.
const misled = ([x], context) => ({ f: 0, gradF: [0], h: [x - 5e-8], Jh: [[context ? -1 : 1]], g: [], Jg: [] });
const collapse = { x0: [0], evaluate: misled, maxIterations: 200, feasibilityTolerance: 1e-12, creepWindow: 1000 };

test("a region that collapses beside the constraints is handed to the restoration", () => {
	const run = solveSQP({ ...collapse });
	const marks = run.history.filter((entry) => entry.status !== "trust_shrunk").map((entry) => entry.status);
	assert.deepEqual(marks, ["region_collapsed", "restored", "converged"], `ended ${run.status} ${run.reason ?? ""}`);
	assert.ok(run.history.filter((entry) => entry.status === "trust_shrunk").length > 30, "the region halved to its floor first");
	assert.equal(run.ok, true);
	assert.ok(Math.abs(run.x[0] - 5e-8) < 1e-12, `x = ${run.x[0]}`);
});

test("with the restoration off the collapse is the verdict it was", () => {
	const run = solveSQP({ ...collapse, restoration: "off" });
	assert.equal(run.ok, false);
	assert.equal(run.status, "line_search_failed");
	assert.ok(!run.history.some((entry) => entry.status === "region_collapsed" || entry.status === "restored"));
});

test("a collapse counts against the restoration limit", () => {
	const run = solveSQP({ ...collapse, restorationLimit: 0 });
	assert.equal(run.status, "line_search_failed");
	assert.ok(!run.history.some((entry) => entry.status === "region_collapsed" || entry.status === "restored"));
});

test("a collapse at a feasible point stays a verdict: there is nothing to restore", () => {
	// the same double from the constraint itself: the subproblem has no step
	// to propose and the solve ends where it stands, restoration or not
	const run = solveSQP({ ...collapse, x0: [5e-8] });
	assert.ok(!run.history.some((entry) => entry.status === "region_collapsed" || entry.status === "restored"), run.history.map((entry) => entry.status).join(", "));
});
