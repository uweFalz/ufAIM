// test/axtran2/edit-end-pose.test.mjs
//
// A value typed in the list changes where the fit starts, not where the
// track connects: the end the fit holds is the file's own end. Taken from
// the changed plan it moved with every edit - a radius typed 8 m larger on
// an arc of 400 m swung it by metres, and the fit was held to that end
// ("die geringe Radius-Änderung bedingt einen gravierenden Fehler der
// End-Pose", 2026-11-12). The other tests of edits give the end pose
// themselves and never saw it.

import assert from "node:assert/strict";
import test from "node:test";

const SERVICE = new URL("../../src/services/axtran2/", import.meta.url);
const KERNEL = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const { fitTraFromBytes } = await import(new URL("fitTraCore.js", SERVICE));
const { writeTra } = await import(new URL("traWriter.js", SERVICE));
const { createAlignmentPoseJacobian } = await import(new URL("AlignmentPoseJacobian.js", KERNEL));
const { momentsFor } = await import(new URL("SolverDependencies.js", KERNEL));

const ORIGIN = { x: 3476000, y: 5474000 };
const startPose = { x: 0, y: 0, theta: 0.3 };
// the file writes a radius with the sign against the kernel's curvature: this arc is R -900 in the list
const plan = [
	{ id: "E0", type: "straight", length: 300 },
	{ id: "E1", type: "transition", length: 90, family: "clothoid" },
	{ id: "E2", type: "arc", length: 400, curvature: 1 / 900 },
	{ id: "E3", type: "transition", length: 90, family: "clothoid" },
	{ id: "E4", type: "straight", length: 320 },
];
const world = (p) => ({ x: p.x + ORIGIN.x, y: p.y + ORIGIN.y, theta: p.theta });
const chain = createAlignmentPoseJacobian({ elements: plan, startPose, momentsFor });
const bytes = writeTra({ elements: plan, poseOfElement: (i) => world(chain.entryPose(i)), poseAtStation: (s) => world(chain.poseAt(s)), endPose: world(chain.endPose) }).bytes;
// the track is the plan: measured on it, every 20 m
const points = [];
for (let s = 20; s < 1180; s += 20) { const p = world(chain.poseAt(s)); points.push({ name: `P${points.length + 1}`, x: p.x, y: p.y }); }
// no end pose given: the file's own end is the one to hold
const fit = (input) => fitTraFromBytes({ bytes, name: "plan.TRA", points, tolerance: 0.15, speedKmh: 100, ...input });
// the fitted elements run from the same start: where their chain ends against where the file's does
const endMiss = (run) => {
	const end = createAlignmentPoseJacobian({ elements: run.fitted, startPose, momentsFor }).endPose;
	return Math.hypot(end.x - chain.endPose.x, end.y - chain.endPose.y) + Math.abs(end.theta - chain.endPose.theta);
};
const arc = (run) => run.report.elements.find((e) => e.id === "E2").after;
const worst = (run) => Math.max(...run.report.points.map((p) => Math.abs(p.residual)));

test("a typed radius leaves the end where the file has it", async () => {
	// what the typed value does to the plan before any fit: the end swings away by metres
	const typed = createAlignmentPoseJacobian({ elements: plan.map((e) => (e.id === "E2" ? { ...e, curvature: 1 / 908 } : e)), startPose, momentsFor });
	const swung = Math.hypot(typed.endPose.x - chain.endPose.x, typed.endPose.y - chain.endPose.y);
	assert.ok(swung > 1, `the plan's end moves ${swung.toFixed(2)} m with the typed radius`);

	const free = await fit({ edits: "3R=-908" });
	assert.ok(free.report.verdict.ok, `${free.report.verdict.status} ${free.report.verdict.reason ?? ""}`);
	assert.equal(free.report.input.endPose, "the TRA's own end");
	assert.ok(endMiss(free) < 1e-6, `the fitted end lies ${endMiss(free)} m from the file's`);
	// the radius is free and the points lie on R 900: the fit goes back to it
	assert.ok(Math.abs(arc(free).radius + 900) < 0.5, `R ${arc(free).radius}`);
	assert.ok(worst(free) < 0.01, `worst offset ${worst(free)} m`);
});

test("a typed radius that is held is kept, and the neighbours close the end", async () => {
	const held = await fit({ edits: "3R=-908", hold: "3R" });
	assert.ok(held.report.verdict.ok, `${held.report.verdict.status} ${held.report.verdict.reason ?? ""}`);
	assert.ok(Math.abs(arc(held).radius + 908) < 1e-6, `R ${arc(held).radius}`);
	assert.ok(endMiss(held) < 1e-6, `the fitted end lies ${endMiss(held)} m from the file's`);
	// two arcs of 400 m, R 900 and R 908, between the same tangents: decimetres apart, not metres
	assert.ok(worst(held) > 0.01 && worst(held) < 0.3, `worst offset ${worst(held)} m`);
});

test("a typed length and a record put in leave the end where the file has it too", async () => {
	for (const edits of ["3L=380", "5L=300", "+3=G:15"]) {
		const run = await fit({ edits });
		assert.ok(run.report.verdict.ok, `${edits}: ${run.report.verdict.status} ${run.report.verdict.reason ?? ""}`);
		assert.ok(endMiss(run) < 1e-6, `${edits}: the fitted end lies ${endMiss(run)} m from the file's`);
	}
});

test("without an edit nothing changes: the plan on its own points stays the plan", async () => {
	const run = await fit({});
	assert.ok(run.report.verdict.ok);
	assert.ok(endMiss(run) < 1e-9 && worst(run) < 1e-6, `end ${endMiss(run)} m, worst offset ${worst(run)} m`);
});
