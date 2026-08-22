import assert from "node:assert/strict";
import test from "node:test";
import { buildQLokEngineeringViewModel } from "../../../app/domain/workspace/buildQLokEngineeringViewModel.js";
import { createExistingAlignmentIntelligenceJourneyController } from "../../../app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js";

const intelligence = { mode: "q", context: { objectId: "A", s: 25, route: "1720", sourceRole: "1" }, capabilities: { chainage: { status: "constructive", value: { candidates: [{ address: 3025 }] }, provenancePresent: true }, horizontal: { status: "constructive", value: { curvature: 0.001, tangent: { x: 1, y: 0 } }, provenancePresent: true }, vertical: { status: "constructive", value: { elevation: 10.5, gradient: 0.01 }, provenancePresent: true }, cant: { status: "partial-evidence", reason: "EU source only", evidenceId: "E" } } };

test("q presents exact current canonical facts in local camera context", () => {
	const model = buildQLokEngineeringViewModel({ intelligence, profileProjection: { alignmentId: "A", cursor: { parameterKind: "intrinsic-s", s: 25 } } });
	assert.equal(model.visible, true); assert.equal(model.context.objectId, "A"); assert.equal(model.context.s, 25); assert.equal(model.context.cameraMode, "local-engineering");
	assert.deepEqual(model.fields.map((field) => field.id), ["chainage", "horizontal", "vertical", "cant"]);
	assert.equal(model.fields.at(-1).status, "partial-evidence"); assert.equal(model.fields.at(-1).provenancePresent, true);
});

test("ahead uses only the next already supplied profile boundary", () => {
	const profileProjection = { alignmentId: "A", cursor: { parameterKind: "intrinsic-s", s: 25 }, vertical: { boundaries: [0, 50, 100], domain: { endS: 100 } }, cant: { boundaries: [0, 75, 125], domain: { endS: 125 } } };
	assert.deepEqual(buildQLokEngineeringViewModel({ intelligence, profileProjection }).ahead, { s: 50, lanes: ["vertical"], status: "existing-boundary" });
	assert.equal(buildQLokEngineeringViewModel({ intelligence: { ...intelligence, context: { ...intelligence.context, s: 125 } }, profileProjection }).ahead, null);
});

test("foreign object projection and stale station projection never leak current profile facts", () => {
	const projectionA0 = { alignmentId: "A", cursor: { parameterKind: "intrinsic-s", s: 0 }, vertical: { boundaries: [0, 50], domain: { endS: 50 } } };
	const activeB = buildQLokEngineeringViewModel({ intelligence: { ...intelligence, context: { ...intelligence.context, objectId: "B", s: 25 } }, profileProjection: projectionA0 });
	assert.equal(activeB.ahead, null); for (const id of ["chainage", "vertical", "cant"]) { const field = activeB.fields.find((entry) => entry.id === id); assert.equal(field.status, "not-covered"); assert.equal(field.value, null); assert.equal(field.provenancePresent, false); }
	const activeA25 = buildQLokEngineeringViewModel({ intelligence, profileProjection: projectionA0 });
	assert.equal(activeA25.ahead.s, 50); assert.equal(activeA25.fields.find((entry) => entry.id === "vertical").value, null);
	const exact = buildQLokEngineeringViewModel({ intelligence, profileProjection: { ...projectionA0, cursor: { parameterKind: "intrinsic-s", s: 25 } } });
	assert.deepEqual(exact.fields.find((entry) => entry.id === "vertical").value, { elevation: 10.5, gradient: 0.01 });
});

test("Main and L hide foreground while retaining exact object and cursor", () => {
	for (const mode of ["main", "l"]) { const model = buildQLokEngineeringViewModel({ intelligence: { ...intelligence, mode } }); assert.equal(model.visible, false); assert.equal(model.context.objectId, "A"); assert.equal(model.context.s, 25); }
});

test("productive controller refreshes q facts and ahead from the shared store and profile projection", () => {
	let profileListener; const rendered = []; const state = { workspace_selection: { primaryId: "A" }, cursor: { s: 0 } };
	const controller = createExistingAlignmentIntelligenceJourneyController({ store: { getState: () => state, subscribe: () => () => {} }, workspace: { getActiveMode: () => "q" }, viewController: { getDebugState: () => ({ objectId: "A", segmentCount: 1, cursor: { curvature: 0, tangent: { x: 1, y: 0 } } }) }, profileSource: { getCurrentProjection: () => null, subscribeProjection(fn) { profileListener = fn; return () => {}; } }, view: { render: (model) => rendered.push(model) } });
	controller.start(); profileListener({ alignmentId: "A", cursor: { parameterKind: "intrinsic-s", s: 0 }, vertical: { status: "evaluated", value: { elevation: 10, gradient: 0 }, boundaries: [0, 50] }, cant: { status: "not-covered", boundaries: [] }, chainage: { status: "not-covered" } });
	assert.equal(rendered.at(-1).qLokEngineeringView.context.s, 0); assert.equal(rendered.at(-1).qLokEngineeringView.ahead.s, 50);
	state.cursor.s = 25; controller.render(); assert.equal(rendered.at(-1).qLokEngineeringView.context.s, 25); assert.equal(rendered.at(-1).qLokEngineeringView.fields.find((entry) => entry.id === "vertical").value, null);
	profileListener({ alignmentId: "A", cursor: { parameterKind: "intrinsic-s", s: 25 }, vertical: { status: "evaluated", value: { elevation: 10.5, gradient: 0.01 }, boundaries: [0, 50] }, cant: { status: "not-covered", boundaries: [] }, chainage: { status: "not-covered" } });
	assert.deepEqual(rendered.at(-1).qLokEngineeringView.fields.find((entry) => entry.id === "vertical").value, { elevation: 10.5, gradient: 0.01 });
});
