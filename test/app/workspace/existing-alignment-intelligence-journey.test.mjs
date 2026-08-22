import assert from "node:assert/strict";
import test from "node:test";
import { buildExistingAlignmentIntelligenceModel } from "../../../app/domain/workspace/buildExistingAlignmentIntelligenceModel.js";
import { createExistingAlignmentIntelligenceJourneyController } from "../../../app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js";

test("one finding becomes one active Alignment context without losing evidence", () => {
	const model = buildExistingAlignmentIntelligenceModel({
		mode: "q",
		context: { objectId: "A7", revision: 3, s: 24.5, evidenceId: "EV-GND-1", provenance: { sha256: "abc" } },
		evidence: {
			EL: { status: "partial-evidence", evidenceId: "EV-GND-1" },
			EH: { status: "partial-evidence", code: "EH_UNRESOLVED" },
			EU: { status: "partial-evidence", code: "EU_UNRESOLVED" },
			EK: { status: "partial-evidence", code: "EK_EVIDENCE_ONLY" },
		},
		projections: {
			horizontal: { status: "constructive", evidenceId: "EV-GND-1" },
			topology: { status: "partial-evidence", relationStatus: "reviewed", reviewedCandidateId: "R1", reviewRevision: 2, claimScope: "source-association-only", intrinsicMappingStatus: "not-established", domainRelationStatus: "not-established", reviewProvenance: { kind: "explicit-review" } },
			crs: { status: "not-covered", reason: "local-cartesian" },
			section: { status: "not-covered", reason: "Reference frame only · no qualified rail or section evidence" },
		},
	});
	assert.equal(model.status, "active");
	assert.deepEqual(model.context, { objectId: "A7", revision: 3, s: 24.5, evidenceId: "EV-GND-1", provenance: { sha256: "abc" } });
	assert.equal(model.capabilities.horizontal.status, "constructive");
	assert.equal(model.capabilities.vertical.code, "EH_UNRESOLVED");
	assert.equal(model.capabilities.speed.status, "missing");
	assert.equal(model.capabilities.topology.status, "partial-evidence");
	assert.equal(model.capabilities.topology.relationStatus, "reviewed");
	assert.equal(model.capabilities.topology.reviewedCandidateId, "R1");
	assert.equal(model.capabilities.topology.reviewRevision, 2);
	assert.equal(model.capabilities.topology.claimScope, "source-association-only");
	assert.equal(model.capabilities.topology.intrinsicMappingStatus, "not-established");
	assert.equal(model.capabilities.topology.domainRelationStatus, "not-established");
	assert.equal(model.capabilities.topology.reviewProvenancePresent, true);
});

test("invalid supplied states cannot become constructive", () => {
	const model = buildExistingAlignmentIntelligenceModel({ evidence: { EH: { status: "available" } } });
	assert.equal(model.capabilities.vertical.status, "missing");
	assert.equal(model.context.objectId, null);
	assert.equal(model.context.s, null);
});

test("journey follows explicit family evidence, canonical identity and common cursor", () => {
	const rendered = [];
	let listener;
	const state = { workspace_selection: { primaryId: null }, cursor: { s: 0 } };
	const controller = createExistingAlignmentIntelligenceJourneyController({
		store: { getState: () => state, subscribe(fn) { listener = fn; return () => {}; } },
		workspace: { getActiveMode: () => "main" },
		viewController: { getDebugState: () => ({ objectId: state.workspace_selection.primaryId, segmentCount: state.workspace_selection.primaryId ? 2 : 0, georeference: { fallbackReason: "local-cartesian" } }) },
		view: { render(model) { rendered.push(model); } },
	});
	controller.start();
	controller.setFinding({ evidenceId: "EV1", inventory: [{ family: "EH", status: "partial-evidence", code: "EH_UNRESOLVED" }] });
	state.workspace_selection.primaryId = "A1";
	state.cursor.s = 12.5;
	listener();
	const model = rendered.at(-1);
	assert.equal(model.context.objectId, "A1");
	assert.equal(model.context.s, 12.5);
	assert.equal(model.capabilities.horizontal.status, "constructive");
	assert.equal(model.capabilities.vertical.code, "EH_UNRESOLVED");
	assert.equal(model.capabilities.crs.reason, "local-cartesian");
});

test("retained GND table inventory exposes EL constructively and EH EU only as partial evidence", () => {
	const rendered = [];
	const controller = createExistingAlignmentIntelligenceJourneyController({
		store: { getState: () => ({ workspace_selection: { primaryId: null }, cursor: { s: 0 } }), subscribe() { return () => {}; } },
		workspace: { getActiveMode: () => "main" },
		viewController: { getDebugState: () => ({ georeference: { fallbackReason: "local-cartesian" } }) },
		view: { render(model) { rendered.push(model); } },
	});
	controller.setFinding({
		evidenceId: "EV-GND",
		truthfulnessStatus: "safe-construction-available",
		inventory: [
			{ name: "X_ASC21_EL", rowCount: 2 },
			{ name: "X_ASC22_EH", rowCount: 2 },
			{ name: "X_ASC23_EU", rowCount: 1 },
			{ name: "X_ASC24_EK", rowCount: 0 },
		],
	});
	const model = rendered.at(-1);
	assert.equal(model.capabilities.horizontal.status, "constructive");
	assert.equal(model.capabilities.vertical.status, "partial-evidence");
	assert.equal(model.capabilities.cant.status, "partial-evidence");
	assert.equal(model.capabilities.chainage.status, "missing");
});
