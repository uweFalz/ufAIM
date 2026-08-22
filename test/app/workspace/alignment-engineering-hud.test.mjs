import assert from "node:assert/strict";
import test from "node:test";
import { buildAlignmentEngineeringHudModel } from "../../../app/domain/workspace/buildAlignmentEngineeringHudModel.js";
import { createExistingAlignmentIntelligenceJourneyController } from "../../../app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js";

test("Main q and L prioritize one unchanged engineering fact set", () => {
	const base = { context: { objectId: "A", route: "1720", sourceRole: "1", s: 25 }, capabilities: { horizontal: { status: "constructive", value: { tangent: { x: 1, y: 0 }, curvature: null }, provenancePresent: true }, vertical: { status: "partial-evidence", evidenceId: "E" }, cant: { status: "partial-evidence", evidenceId: "E" }, chainage: { status: "missing" }, crs: { status: "not-covered", reason: "local-cartesian" }, speed: { status: "missing" }, section: { status: "not-covered" } } };
	const main = buildAlignmentEngineeringHudModel({ ...base, mode: "main" });
	const q = buildAlignmentEngineeringHudModel({ ...base, mode: "q" });
	const l = buildAlignmentEngineeringHudModel({ ...base, mode: "l" });
	assert.equal(main.fields[0].id, "spatial"); assert.equal(q.fields[0].id, "horizontal"); assert.equal(l.fields[0].id, "chainage");
	for (const model of [main, q, l]) { assert.equal(model.context.objectId, "A"); assert.equal(model.context.s, 25); assert.equal(model.fields.find((field) => field.id === "vertical").status, "partial-evidence"); }
});

test("canonical profile projection supplies only evaluated values and retains honest absences", () => {
	let profileListener;
	const rendered = [];
	const state = { workspace_selection: { primaryId: "A" }, cursor: { s: 75 } };
	const controller = createExistingAlignmentIntelligenceJourneyController({
		store: { getState: () => state, subscribe() { return () => {}; } }, workspace: { getActiveMode: () => "q" },
		viewController: { getDebugState: () => ({ objectId: "A", segmentCount: 2, cursor: { tangent: { x: 0.8, y: 0.6 } }, georeference: { fallbackReason: "local-cartesian" } }) },
		profileSource: { getCurrentProjection: () => null, subscribeProjection(fn) { profileListener = fn; return () => {}; } }, view: { render(model) { rendered.push(model); } },
	});
	controller.start(); controller.setPromotedEvidence({ evidenceId: "E", routeContext: { route: "1720", sourceRole: "1" }, EH: { status: "partial-evidence", evidenceId: "E" }, EU: { status: "partial-evidence", evidenceId: "E" }, EK: { status: "missing" }, relation: { status: "partial-evidence", relationStatus: "open-candidates" } });
	profileListener({ vertical: { status: "evaluated", value: { elevation: 10, gradient: 0.01 } }, cant: { status: "evaluated", value: { crossLevel: 0.04, twist: 0.001 } }, chainage: { status: "unique", candidates: [{ address: 3025 }] } });
	const model = rendered.at(-1);
	assert.deepEqual(model.capabilities.vertical.value, { elevation: 10, gradient: 0.01 });
	assert.deepEqual(model.capabilities.cant.value, { crossLevel: 0.04, twist: 0.001 });
	assert.equal(model.capabilities.speed.status, "missing"); assert.equal(model.capabilities.section.status, "not-covered");
	assert.equal(model.context.route, "1720"); assert.equal(model.context.sourceRole, "1");
});

test("fresh window cursor starts at deterministic s0 while all modes continue to share it", () => {
	const freshContext = { objectId: "A", s: 0 };
	for (const mode of ["main", "q", "l"]) {
		const hud = buildAlignmentEngineeringHudModel({ mode, context: freshContext, capabilities: {} });
		assert.equal(hud.context.s, 0);
		assert.equal(hud.context.objectId, "A");
	}
});

test("malformed source CRS remains secondary while primary coordinate mode is truthful local-cartesian", () => {
	const rendered = [];
	const controller = createExistingAlignmentIntelligenceJourneyController({ store: { getState: () => ({ workspace_selection: { primaryId: "A" }, cursor: { s: 0 } }), subscribe() { return () => {}; } }, workspace: { getActiveMode: () => "main" }, viewController: { getDebugState: () => ({ objectId: "A", segmentCount: 1, georeference: { fallbackReason: "malformed-crs" } }) }, view: { render(model) { rendered.push(model); } } });
	controller.start();
	const spatial = rendered.at(-1).hud.fields.find((field) => field.id === "spatial");
	assert.equal(spatial.status, "not-covered");
	assert.deepEqual(spatial.value, { mode: "local-cartesian", context: "local engineering" });
	assert.match(spatial.reason, /CRS evidence requires review/);
});
