import assert from "node:assert/strict";
import test from "node:test";

// A pose held at an element joint: the turnout's case. The tangent of a
// turnout - or its whole pose - at its start or end is a datum, and the
// elements on either side are fitted around it. Declared as heldPoses on
// the constraint builder, read off the chain at the joint's station, held
// as equalities like the end pose.

const BASE = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const { solveAlignmentProblem } = await import(new URL("AlignmentSQPSolver.js", BASE));
const { createAlignmentConstraintBuilder } = await import(new URL("AlignmentConstraintBuilder.js", BASE));
const { createNineElementScenario, build, TRUE_LENGTHS, TRUE_CURVATURES } = await import(new URL("fixtures/nineElementScenario.mjs", import.meta.url));

const solverInput = (scenario) => ({ problem: scenario.problem, buildAlignment: scenario.buildAlignment, analyticJacobian: scenario.analyticJacobian });
// the truth's pose at the joint after E4, the middle straight
const JOINT = 4;
const truth = build(TRUE_LENGTHS, TRUE_CURVATURES);
const jointStation = TRUE_LENGTHS.slice(0, JOINT + 1).reduce((a, b) => a + b, 0);
const jointPose = (() => { const p = truth.poseAt(jointStation); return { x: p.p.x, y: p.p.y, theta: Math.atan2(p.t.y, p.t.x) }; })();
const jointOf = (scenario, run) => {
	const chain = scenario.analyticJacobian(scenario.codec.decode(run.candidate.variables));
	return chain.poseAt(chain.stationAfter(JOINT));
};

test("a pose held at a joint is met by the fit, and the answer is the truth's", () => {
	const scenario = createNineElementScenario({ pointCount: 24, heldPoses: [{ afterElement: `E${JOINT}`, ...jointPose }] });
	assert.equal(scenario.problem.constraints.equalityCount, 6, "three end-pose rows and three of the joint");
	const run = solveAlignmentProblem({ ...solverInput(scenario), objective: "points", maxIterations: 300 });
	assert.ok(run.ok, `${run.status} ${run.diagnostics.reason ?? ""}`);
	const joint = jointOf(scenario, run);
	assert.ok(Math.hypot(joint.x - jointPose.x, joint.y - jointPose.y) < 1e-6, `joint ${Math.hypot(joint.x - jointPose.x, joint.y - jointPose.y)} m off`);
	assert.ok(Math.abs(joint.theta - jointPose.theta) < 1e-8, `joint heading ${joint.theta - jointPose.theta} rad off`);
	assert.ok(run.diagnostics.endPoseDistance < 1e-6);
	assert.ok(run.diagnostics.softResidualRms < 0.3, `rms ${run.diagnostics.softResidualRms}`);
});

test("the turnout's tangent alone: a heading held at the joint", () => {
	// a tangent held 2 mrad off the truth's bends the chain: the heading is
	// met exactly, the end pose still, and the points pay for it
	const straight = createNineElementScenario({ pointCount: 24 });
	const held = createNineElementScenario({ pointCount: 24, heldPoses: [{ afterElement: `E${JOINT}`, theta: jointPose.theta + 2e-3 }] });
	assert.equal(held.problem.constraints.equalityCount, 4);
	const free = solveAlignmentProblem({ ...solverInput(straight), objective: "points", maxIterations: 300 });
	const bent = solveAlignmentProblem({ ...solverInput(held), objective: "points", maxIterations: 300 });
	assert.ok(free.ok && bent.ok, `${free.status} / ${bent.status} ${bent.diagnostics.reason ?? ""}`);
	const joint = jointOf(held, bent);
	assert.ok(Math.abs(joint.theta - (jointPose.theta + 2e-3)) < 1e-8, `heading ${joint.theta - jointPose.theta - 2e-3} rad off the held one`);
	assert.ok(bent.diagnostics.endPoseDistance < 1e-6);
	assert.ok(bent.diagnostics.softResidualRms > free.diagnostics.softResidualRms, `bent ${bent.diagnostics.softResidualRms} against free ${free.diagnostics.softResidualRms}`);
	// and the length objective under the same tangent is a different chain from the free one
	const shortest = solveAlignmentProblem({ ...solverInput(held), objective: "accumulated-length", maxIterations: 300 });
	assert.ok(shortest.ok, `length: ${shortest.status}`);
	assert.ok(Math.abs(jointOf(held, shortest).theta - (jointPose.theta + 2e-3)) < 1e-8, "the tangent holds under the length objective too");
});

test("a held pose is declared, or refused", () => {
	const scenario = createNineElementScenario({ pointCount: 6 });
	const declare = (heldPoses) => createAlignmentConstraintBuilder({
		endPose: scenario.endPose, elementSequence: scenario.codec.elementSequence, minimumElementLength: 20, heldPoses,
	});
	assert.throws(() => declare([{ afterElement: "E99", theta: 0 }]), /INVALID_HELD_POSE|names an element/);
	assert.throws(() => declare([{ afterElement: "E4" }]), /holds nothing/);
	assert.throws(() => declare([{ afterElement: "E4", x: NaN }]), /non-finite/);
	const declared = declare([{ afterElement: "E4", theta: 0.1 }, { afterElement: "E2", x: 1, y: 2 }]);
	assert.deepEqual(declared.heldPoses.map((h) => h.afterElement), ["E4", "E2"]);
	assert.equal(declared.equalityCount, 6);
	assert.ok(declared.equalities.some((e) => e.id === "pose.E4.theta" && e.unit === "rad"));
});
