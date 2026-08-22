import assert from "node:assert/strict";
import test from "node:test";
import { buildAlignmentEngineeringTaskRailModel } from "../../../app/domain/workspace/buildAlignmentEngineeringTaskRailModel.js";

test("Task Rail deep-links Vertical Cant and Chainage to exact lanes", () => {
	const rail = buildAlignmentEngineeringTaskRailModel({ mode: "l", context: { objectId: "A", s: 25 }, capabilities: { vertical: { status: "constructive" }, cant: { status: "partial-evidence" }, chainage: { status: "constructive" }, horizontal: { status: "constructive" } } });
	assert.equal(rail.tasks.find((task) => task.id === "vertical").action, "openVertical");
	assert.equal(rail.tasks.find((task) => task.id === "cant").action, "openCant");
	assert.equal(rail.tasks.find((task) => task.id === "chainage").action, "openChainage");
	assert.equal(rail.context.objectId, "A"); assert.equal(rail.context.s, 25);
});

test("EH and EU source-only states remain partial or review-only", () => {
	const rail = buildAlignmentEngineeringTaskRailModel({ mode: "l", context: { objectId: "A", s: 0 }, capabilities: { vertical: { status: "partial-evidence", reason: "EH source only" }, cant: { status: "review-required", reason: "EU association open" }, chainage: { status: "not-covered" }, horizontal: { status: "constructive" } } });
	assert.equal(rail.tasks.find((task) => task.id === "vertical").status, "partial-evidence");
	assert.equal(rail.tasks.find((task) => task.id === "cant").status, "review-required");
});
