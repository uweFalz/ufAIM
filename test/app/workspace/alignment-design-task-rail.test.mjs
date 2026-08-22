import assert from "node:assert/strict";
import test from "node:test";
import { buildAlignmentEngineeringTaskRailModel } from "../../../app/domain/workspace/buildAlignmentEngineeringTaskRailModel.js";

const intelligence = { mode: "main", context: { objectId: "A", s: 25 }, capabilities: { horizontal: { status: "constructive", value: { elementCount: 3 }, provenancePresent: true }, vertical: { status: "partial-evidence", reason: "EH source only", provenancePresent: true }, cant: { status: "missing" }, chainage: { status: "constructive", value: { segments: [{}, {}] } }, topology: { status: "review-required", relationStatus: "open-candidates" }, speed: { status: "not-covered" }, section: { status: "not-covered" } } };

test("task rail answers what is operable using only current Intelligence facts", () => {
	const rail = buildAlignmentEngineeringTaskRailModel(intelligence);
	assert.equal(rail.context.objectId, "A"); assert.equal(rail.context.s, 25);
	assert.deepEqual(rail.tasks.map((task) => task.id), ["horizontal", "source", "objects", "vertical", "cant", "chainage"]);
	assert.equal(rail.tasks.find((task) => task.id === "horizontal").count, 3);
	assert.equal(rail.tasks.find((task) => task.id === "chainage").count, 2);
	assert.equal(rail.tasks.find((task) => task.id === "source").action, "openReview");
	assert.equal(rail.tasks.find((task) => task.id === "cant").status, "missing");
});

test("Main q and L only reorder emphasis and retain identity status and cursor", () => {
	const rails = ["main", "q", "l"].map((mode) => buildAlignmentEngineeringTaskRailModel({ ...intelligence, mode }));
	for (const rail of rails) { assert.equal(rail.context.objectId, "A"); assert.equal(rail.context.s, 25); assert.deepEqual([...rail.tasks].map((task) => [task.id, task.status]).sort(), [...rails[0].tasks].map((task) => [task.id, task.status]).sort()); }
	assert.equal(rails[1].tasks[1].id, "cant"); assert.equal(rails[2].tasks[0].id, "chainage");
});

test("unavailable horizontal action is disabled with an honest reason", () => {
	const rail = buildAlignmentEngineeringTaskRailModel({ mode: "main", context: { objectId: "A", s: 0 }, capabilities: { horizontal: { status: "partial-evidence" } } });
	const horizontal = rail.tasks.find((task) => task.id === "horizontal");
	assert.equal(horizontal.enabled, false); assert.match(horizontal.reason, /Keine konstruktive/);
});
