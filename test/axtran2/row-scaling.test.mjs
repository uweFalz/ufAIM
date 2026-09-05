import assert from "node:assert/strict";
import test from "node:test";

// The end pose is three rows in two units. Two positions in metres and a
// heading in radians are not comparable, and a solve that treats them as if
// they were inherits the difference everywhere: in how accurately the
// subproblem meets each row, in the size of each multiplier, and through those
// in what the merit charges for.

const BASE = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const { solveAlignmentProblem } = await import(new URL("AlignmentSQPSolver.js", BASE));
const { createNineElementScenario } =
	await import(new URL("fixtures/nineElementScenario.mjs", import.meta.url));

const START = {
	pointCount: 12,
	startLengths: [200, 92, 298, 88, 152, 82, 258, 78, 180],
	startCurvatures: [1 / 695, -1 / 905],
};
const solve = (rampLengthAs, objective, maxIterations = 200) => {
	const sc = createNineElementScenario({ ...START, rampLengthAs });
	return {
		sc,
		run: solveAlignmentProblem({
			problem: sc.problem,
			buildAlignment: sc.buildAlignment,
			analyticJacobian: sc.analyticJacobian,
			objective,
			maxIterations,
		}),
	};
};

test("the heading is reported as an angle, whatever the solve had to do to weigh it", () => {
	// Weighed as a distance the heading row is multiplied by the lever arm, which
	// is around 1400 m here. If that ever reached the diagnostics, a heading
	// residual would be reported three orders of magnitude too large and nobody
	// reading it would know.
	const { sc, run } = solve("bound", "accumulated-length", 2);
	const built = sc.buildAlignment(sc.codec.decode(run.candidate.variables));
	const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
	const raw = wrap(built.endPose.theta - sc.endPose.theta);
	assert.ok(
		Math.abs(run.diagnostics.endPoseResidual[2] - raw) < 1e-12,
		`reported ${run.diagnostics.endPoseResidual[2]}, actual angle ${raw}`,
	);
	// and the two position rows are untouched
	assert.ok(Math.abs(run.diagnostics.endPoseResidual[0] - (built.endPose.x - sc.endPose.x)) < 1e-12);
	assert.ok(Math.abs(run.diagnostics.endPoseResidual[1] - (built.endPose.y - sc.endPose.y)) < 1e-12);
});

test("the exact ramp rule reaches the same answer as the bound, and reaches it", () => {
	// Before the rows were made comparable this pair was the one thing this
	// kernel could never finish: max_iterations at 200 for the length objective
	// and qp_failed at 90 for the points, against a bound form that converged in
	// 91 and 45. The subproblem was meeting the heading row two hundred times
	// less accurately than the positions, and the merit - weighting that row at
	// 367 - refused every step the subproblem called feasible.
	// The length objective only. The points objective shows the same repair -
	// qp_failed at 90 becomes stationary at 73 on the twelve-point scenario - but
	// one such solve costs two minutes, and a suite that takes two minutes to say
	// what this one says in a second is a suite people stop running.
	const bound = solve("bound", "accumulated-length").run;
	const exact = solve("constraint", "accumulated-length").run;

	assert.equal(bound.ok, true, `bound: ${bound.status}`);
	assert.ok(exact.ok, `constraint did not finish: ${exact.status}`);
	assert.ok(
		Math.abs(bound.diagnostics.accumulatedLength - exact.diagnostics.accumulatedLength) < 1e-3,
		`bound ${bound.diagnostics.accumulatedLength}, exact ${exact.diagnostics.accumulatedLength}`,
	);
});

test("the heading is met, and met as tightly as the positions", () => {
	// The point of weighing it as a distance: it stops being the row the solve
	// can afford to leave loose.
	for (const rampLengthAs of ["bound", "constraint"]) {
		const { run } = solve(rampLengthAs, "accumulated-length");
		const [dx, dy, dtheta] = run.diagnostics.endPoseResidual;
		const leverArm = run.diagnostics.alignmentLength;
		assert.ok(leverArm > 1000, `expected a lever arm of order the alignment, got ${leverArm}`);
		assert.ok(
			Math.abs(dtheta) * leverArm <= Math.max(1e-9, 1e3 * Math.hypot(dx, dy)),
			`${rampLengthAs}: heading ${Math.abs(dtheta) * leverArm} m against position ${Math.hypot(dx, dy)} m`,
		);
	}
});

test("the exact ramp rule fits the points as fast as the bound does", () => {
	// A step along which the merit does not fall is not searched along. Before
	// that rule the exact form spent eight backtracking episodes on the twelve
	// point scenario and stopped at 73 iterations; the bound form took 43. Now
	// both take 44, and this run is cheap enough to keep in the suite.
	const bound = solve("bound", "points", 60).run;
	const exact = solve("constraint", "points", 60).run;
	assert.ok(bound.ok, `bound: ${bound.status} @${bound.diagnostics.iterations}`);
	assert.ok(exact.ok, `constraint: ${exact.status} @${exact.diagnostics.iterations}`);
	assert.ok(
		Math.abs(bound.diagnostics.softResidualRms - exact.diagnostics.softResidualRms) < 1e-4,
		`rms: bound ${bound.diagnostics.softResidualRms}, exact ${exact.diagnostics.softResidualRms}`,
	);
	assert.equal(
		(exact.diagnostics.history ?? []).filter((e) => e.backtracks >= 10).length, 0,
		"the exact form should no longer backtrack its way along the ramp row",
	);
});
