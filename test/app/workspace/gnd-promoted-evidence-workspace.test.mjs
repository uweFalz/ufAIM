import assert from "node:assert/strict";
import test from "node:test";
import { buildPromotedGndWorkspaceEvidence } from "../../../app/domain/workspace/buildPromotedGndWorkspaceEvidence.js";
import { createPromotedAlignmentWorkspaceJourneyController } from "../../../app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js";

function promotedObject() {
	return { id: "GND-A1", meta: { importItemId: "GND-A1", sourceEvidence: { schema: "ufAIM.spot-import-evidence", evidenceId: "EV1", source: { fileName: "source.mdb" }, familyEvidence: [
		{ family: "EL", status: "constructive", rowCount: 3, sourceRefs: ["X_ASC_EL"] },
		{ family: "EH", status: "constructive", rowCount: 2, sourceRefs: ["X_ASC_EH"] },
		{ family: "EU", status: "partial-evidence", rowCount: 2, sourceRefs: ["X_ASC_EU"] },
		{ family: "EK", status: "partial-evidence", rowCount: 2, sourceRefs: ["X_ASC_EK"] },
	], constructiveStationFrame: { schema: "ufAIM.gnd-constructive-station-frame-evidence", status: "evidence-only", constructiveAdmission: "not-performed", claims: [{ claimId: "EK:1", claimKind: "kilometre-jump-candidate" }] }, relationEvidence: { status: "open-candidates", candidateCount: 1, candidates: [{ id: "R1", from: "EH1", to: "GND-A1" }] } } } };
}

test("promoted GND evidence keeps EL constructive while EH/EU/EK and relation remain qualified evidence", () => {
	const evidence = buildPromotedGndWorkspaceEvidence(promotedObject());
	assert.equal(evidence.EL.status, "constructive");
	assert.equal(evidence.EH.status, "partial-evidence");
	assert.equal(evidence.EU.status, "partial-evidence");
	assert.equal(evidence.EK.status, "partial-evidence");
	assert.equal(evidence.constructiveStationFrame.status, "evidence-only");
	assert.equal(evidence.EK.constructiveStationFrame.claims[0].claimKind, "kilometre-jump-candidate");
	assert.equal(evidence.relation.status, "partial-evidence");
	assert.equal(evidence.relation.candidateCount, 1);
});

test("exact promoted identity refreshes SPOT surfaces and receives persisted evidence", async () => {
	const state = { workspace_selection: { primaryId: null }, cursor: { s: 25 } };
	const calls = [];
	const controller = createPromotedAlignmentWorkspaceJourneyController({
		cockpit: { async activateSpotObject(id) { state.workspace_selection.primaryId = id; return true; }, async refreshSpotState() { return { objects: [promotedObject()] }; }, async refreshAll() { calls.push("refresh"); } },
		store: { getState: () => state },
		alignmentBimWorkspace: { activate(mode) { calls.push(mode); return true; } },
		viewController: { getDebugState: () => ({ objectId: "GND-A1" }) },
		alignmentIntelligence: { setPromotedEvidence(value) { calls.push(value.evidenceId); }, setActiveContext(value) { calls.push(value.objectId); } },
	});
	const result = await controller.activateCanonicalAlignment("GND-A1");
	assert.equal(result.objectId, "GND-A1");
	assert.equal(result.evidence.evidenceId, "EV1");
	assert.deepEqual(calls, ["main", "EV1", "GND-A1", "refresh"]);
});

test("reload or ordinary refocus rehydrates persisted GND evidence from the canonical SPOT object", async () => {
	const state = { workspace_selection: { primaryId: null }, cursor: { s: 40 } };
	let selectionObserver = null;
	const evidenceCalls = [];
	const controller = createPromotedAlignmentWorkspaceJourneyController({
		cockpit: { async activateSpotObject() { return true; }, async refreshSpotState() { return { state: { objects: [promotedObject()] } }; }, async refreshAll() {} },
		store: { getState: () => state, subscribe(observer) { selectionObserver = observer; return () => {}; } },
		alignmentBimWorkspace: { activate() { return true; } },
		viewController: { getDebugState: () => ({ objectId: "GND-A1" }) },
		alignmentIntelligence: { setPromotedEvidence(value) { evidenceCalls.push(value?.evidenceId ?? null); }, setActiveContext() {} },
	});
	state.workspace_selection.primaryId = "GND-A1";
	selectionObserver();
	const result = await controller.rehydrateCanonicalAlignment("GND-A1");
	assert.equal(result.ok, true);
	assert.deepEqual(evidenceCalls, ["EV1"]);
});
