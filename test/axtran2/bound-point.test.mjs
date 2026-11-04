import assert from "node:assert/strict";
import test from "node:test";

// A one-sided Zwangspunkt: the axis keeps at least, or at most, so far from a
// point, on the side the signed target names. Held as an inequality on the
// lateral offset, so a point with room to spare costs the fit nothing, and
// one without moves the axis exactly as far as it must.

const BASE = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const { solveAlignmentProblem } = await import(new URL("AlignmentSQPSolver.js", BASE));
const { solveAlignmentLexicographic, DEFAULT_TIERS } = await import(new URL("AlignmentLexicographicSolver.js", BASE));
const { createAlignmentResidualBuilder, boundViolation, POINT_ENFORCEMENT, BOUND_ENFORCEMENT } = await import(new URL("AlignmentResidualBuilder.js", BASE));
const { evaluateAlignmentOptimizationProblem } = await import(new URL("AlignmentOptimizationDiagnostics.js", BASE));
const { createIntrinsicMetricContext } = await import(new URL("MetricContext.js", BASE));
const { createNineElementScenario } = await import(new URL("fixtures/nineElementScenario.mjs", import.meta.url));

const START = { startLengths: [200, 92, 298, 88, 152, 82, 258, 78, 180], startCurvatures: [1 / 695, -1 / 905] };
const solve = (scenario, extra = {}) => solveAlignmentProblem({
	problem: scenario.problem, buildAlignment: scenario.buildAlignment, analyticJacobian: scenario.analyticJacobian,
	objective: "points", maxIterations: 400, ...extra,
});
const offsetOf = (scenario, run, name) => {
	const point = scenario.points.find((p) => p.name === name);
	return scenario.buildAlignment(run.candidate.overlay).worldToTrack(point.x, point.y).q;
};

test("the violation reads the side from the sign of the target", () => {
	assert.deepEqual(POINT_ENFORCEMENT, ["soft", "hard", "at-least", "at-most"]);
	assert.deepEqual(BOUND_ENFORCEMENT, ["at-least", "at-most"]);
	// a mast 2.2 m left, the axis 2.0 m from it: 0.2 m too close
	assert.ok(Math.abs(boundViolation("at-least", 2.2, 2.0) - 0.2) < 1e-12);
	// the same on the right: the offsets are negative there
	assert.ok(Math.abs(boundViolation("at-least", -2.2, -2.0) - 0.2) < 1e-12);
	// 2.5 m from it: 0.3 m of slack, as a negative violation
	assert.ok(Math.abs(boundViolation("at-least", 2.2, 2.5) + 0.3) < 1e-12);
	// at most 1.8 m right of the point, the axis 2.0 m right of it: 0.2 m too far
	assert.ok(Math.abs(boundViolation("at-most", -1.8, -2.0) - 0.2) < 1e-12);
	assert.equal(boundViolation("hard", 1, 2), null);
	assert.throws(
		() => createAlignmentResidualBuilder({ metricContext: createIntrinsicMetricContext(), points: [{ name: "Z", x: 1, y: 1, tolerance: 0.01, enforcement: "at-least", target: 0 }] }),
		(e) => e.code === "INVALID_TARGET"
	);
	const builder = createAlignmentResidualBuilder({ metricContext: createIntrinsicMetricContext(), points: [
		{ name: "M", x: 1, y: 1, tolerance: 0.1 },
		{ name: "Z", x: 2, y: 1, tolerance: 0.01, enforcement: "at-least", target: 2.2 },
	] });
	assert.deepEqual(builder.boundPoints.map((p) => p.name), ["Z"]);
	assert.deepEqual(builder.hardPoints, []);
	const evaluated = builder.evaluate(() => ({ q: 2.0, s: 1, u: 0, clamped: false }));
	assert.equal(evaluated[1].met, false);
	assert.ok(Math.abs(evaluated[1].violation - 0.2) < 1e-12);
	assert.equal(evaluated[0].violation, null);
});

test("a one-sided Zwangspunkt with room to spare costs the fit nothing", () => {
	const free = createNineElementScenario({ pointCount: 24, ...START });
	// a mast 2.0 m left of the truth, at least 1.5 m wanted: 0.5 m of slack
	const slack = createNineElementScenario({ pointCount: 24, ...START, boundPoints: [{ name: "Mast", fraction: 0.45, clearance: 2.0, target: 1.5, enforcement: "at-least" }] });
	assert.equal(slack.problem.budget.boundedPoints, 1);
	assert.equal(slack.problem.budget.degreesOfFreedom, free.problem.budget.degreesOfFreedom, "an inequality costs no degree of freedom");
	const a = solve(free);
	const b = solve(slack);
	assert.ok(a.ok && b.ok, `${a.status} / ${b.status} ${b.diagnostics.reason ?? ""}`);
	assert.ok(Math.abs(a.diagnostics.softResidualRms - b.diagnostics.softResidualRms) < 1e-3, `rms ${a.diagnostics.softResidualRms} against ${b.diagnostics.softResidualRms}`);
	const row = b.diagnostics.boundPointResiduals[0];
	assert.equal(row.name, "Mast");
	assert.equal(row.enforcement, "at-least");
	assert.ok(row.violation < -0.4, `slack ${-row.violation} m`);
});

test("a one-sided Zwangspunkt the start breaks is met exactly, and the fit pays for it", () => {
	const free = createNineElementScenario({ pointCount: 24, ...START });
	// a mast 2.0 m left of the truth, at least 2.2 m wanted: the axis has to
	// move 0.2 m right there, against the measured points
	const mast = createNineElementScenario({ pointCount: 24, ...START, boundPoints: [{ name: "Mast", fraction: 0.45, clearance: 2.0, target: 2.2, enforcement: "at-least" }] });
	const a = solve(free);
	const b = solve(mast);
	assert.ok(a.ok && b.ok, `${a.status} / ${b.status} ${b.diagnostics.reason ?? ""}`);
	const row = b.diagnostics.boundPointResiduals[0];
	assert.ok(row.violation <= 1e-6, `violation ${row.violation} m`);
	const q = offsetOf(mast, b, "Mast");
	assert.ok(q >= 2.2 - 1e-6 && q < 2.2 + 0.05, `the axis keeps ${q} m, 2.2 wanted and no more than it must`);
	assert.ok(b.diagnostics.softResidualRms > a.diagnostics.softResidualRms + 0.05, `rms ${b.diagnostics.softResidualRms} against ${a.diagnostics.softResidualRms}`);
	assert.ok(b.diagnostics.endPoseDistance < 1e-6);
	// the diagnostics see the same
	const built = mast.buildAlignment(b.candidate.overlay);
	const report = evaluateAlignmentOptimizationProblem({ problem: mast.problem, worldToTrack: built.worldToTrack });
	assert.equal(report.summary.bound, 1);
	assert.deepEqual(report.summary.boundViolated, []);

	// the mirror: a pier 2.0 m right, at most 1.8 m away
	const pier = createNineElementScenario({ pointCount: 24, ...START, boundPoints: [{ name: "Pfeiler", fraction: 0.45, clearance: -2.0, target: -1.8, enforcement: "at-most" }] });
	const c = solve(pier);
	assert.ok(c.ok, `${c.status} ${c.diagnostics.reason ?? ""}`);
	const qp = offsetOf(pier, c, "Pfeiler");
	assert.ok(qp <= -1.8 + 1e-6 && qp > -1.8 - 0.05, `the axis keeps ${-qp} m, 1.8 wanted`);
});

test("the one-sided Zwangspunkt holds through finite differences and through the priority order", () => {
	const mast = createNineElementScenario({ pointCount: 12, ...START, boundPoints: [{ name: "Mast", fraction: 0.45, clearance: 2.0, target: 2.2, enforcement: "at-least" }] });
	const fd = solve(mast, { analyticJacobian: null });
	assert.ok(fd.ok, `${fd.status} ${fd.diagnostics.reason ?? ""}`);
	assert.ok(fd.diagnostics.boundPointResiduals[0].violation <= 1e-6, `violation ${fd.diagnostics.boundPointResiduals[0].violation} m`);

	const run = solveAlignmentLexicographic({
		problem: mast.problem, buildAlignment: mast.buildAlignment, analyticJacobian: mast.analyticJacobian,
		tiers: DEFAULT_TIERS, maxIterations: 400,
	});
	assert.ok(run.ok, `${run.status}`);
	for (const phase of run.phases) {
		const violation = phase.diagnostics?.boundPointResiduals?.[0]?.violation;
		assert.ok(violation === undefined || violation <= 1e-6, `${phase.label}: violation ${violation} m`);
	}
});
