import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import MDBReader from "../../../src/import/parsers/technet/gndEdit/mdb/node_modules/mdb-reader/lib/node/index.js";
import { extractGndMdb } from "../../../src/import/parsers/technet/gndEdit/gnd/extractGndMdb.js";
import { createImportSessionService } from "../../../src/shared/messaging/service/ImportSessionService.js";
import { buildGndRelationReviewModel } from "../../../app/domain/workspace/buildGndRelationReviewModel.js";
import { buildPromotedGndWorkspaceEvidence } from "../../../app/domain/workspace/buildPromotedGndWorkspaceEvidence.js";
import { createPromotedAlignmentWorkspaceJourneyController } from "../../../app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js";
import { createExistingAlignmentIntelligenceJourneyController } from "../../../app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js";
import { withSpotEvidenceSnapshot } from "../../../src/import/evidence/importResultEvidence.js";
import { promoteImportItems } from "../../../src/model/spot/mutate/promoteImportItems.js";
import { createSpotStore } from "../../../src/model/spot/model/SpotStore.js";
import { createSpotService } from "../../../src/shared/messaging/service/SpotService.js";
import { createImportResultEvidencePublication } from "../../../src/import/evidence/importResultEvidence.js";

const repositoryUrl = new URL("../../../", import.meta.url);
const aliases = { "@src/": "src/", "@kimport/": "src/import/", "@spot/": "src/model/spot/", "@kgeom/": "src/lib/geom/", "@kmath/": "src/lib/math/", "@utils/": "src/lib/utils/" };
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "sheetjs") return nextResolve(new URL("test/gnd-mdb-spike/node_modules/xlsx/xlsx.mjs", repositoryUrl).href, context); for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), repositoryUrl).href, context); return nextResolve(specifier, context); } });
globalThis.Worker = class NodeFixtureWorker { postMessage(message) { queueMicrotask(async () => { try { const envelope = await extractGndMdb({ ...message.payload, bytes: Buffer.from(message.payload.bytes), MDBReader }); this.onmessage?.({ data: { type: "result", envelope } }); } catch (error) { this.onmessage?.({ data: { type: "error", error: { code: error.code, message: error.message } } }); } }); } terminate() {} };
const { runImportPipeline } = await import("../../../src/import/runImportPipeline.js");

function fixture() {
	const snapshot = { schema: "ufAIM.spot-import-evidence", evidenceId: "E1", relationEvidence: { status: "open-candidates", candidateCount: 2, candidates: [] } };
	return { sessionId: "S1", phase: "ready", source: null, items: [{ id: "A1", kind: "alignment", evidenceId: "E1", source: { fileName: "gnd.mdb", parserId: "gndEdit" }, payload: { name: "A1" }, status: { valid: true, promotable: true, stage: "derived" }, derived: { sourceEvidenceSnapshot: snapshot, sparseAlignment: { type: "sparseAlignment", startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }, sparse: [{ id: "EL1", type: "fixed", poseA: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }, arcLength: 100, curvature: 0 }] } } }], rejectedItems: [], resultEvidence: [{ schema: "ufAIM.import-result-evidence", version: 1, evidenceId: "E1", source: { fileName: "gnd.mdb", parserId: "gndEdit", sha256: "a".repeat(64) }, inventory: [{ name: "X_ASC11_EL", rowCount: 2 }], relationCandidates: [{ id: "R1", from: "EH1", to: "A1", type: "gndSourceEvidenceAssociation", claimScope: "source-association-only", intrinsicMappingStatus: "not-established", domainRelationStatus: "not-established", provenance: { source: { fileName: "gnd.mdb", parserId: "gndEdit", objectName: "EH" }, method: "parser-qualified-exact-source-context" } }, { id: "R2", from: "EU1", to: "A1", type: "gndSourceEvidenceAssociation", claimScope: "source-association-only", intrinsicMappingStatus: "not-established", domainRelationStatus: "not-established", provenance: { source: { fileName: "gnd.mdb", parserId: "gndEdit", objectName: "EU" }, method: "parser-qualified-exact-source-context" } }] }], error: null };
}

test("one source association is explicitly reviewed and reversibly withdrawn with canonical persisted readback", () => {
	let state = fixture(), writes = 0;
	const service = createImportSessionService({ getState: () => state, setState: (next) => { state = next; writes += 1; } });
	assert.equal(buildGndRelationReviewModel(service.getResultEvidence({ evidenceId: "E1" }).record).status, "open-candidates");
	assert.equal(service.setRelationDecision({ evidenceId: "E1", candidateId: "R2", action: "review", expectedRevision: 0 }).ok, true);
	let record = service.getResultEvidence({ evidenceId: "E1" }).record;
	assert.equal(record.relationDecision.reviewedCandidateId, "R2");
	let promotedSnapshot = state.items[0].derived.sourceEvidenceSnapshot;
	assert.equal(promotedSnapshot.relationEvidence.reviewedCandidateId, "R2");
	const persistedCanonicalObject = structuredClone({ id: "A1", meta: { importItemId: "A1", sourceEvidence: promotedSnapshot } });
	let promotedEvidence = buildPromotedGndWorkspaceEvidence(persistedCanonicalObject);
	assert.equal(promotedEvidence.relation.status, "partial-evidence");
	assert.equal(promotedEvidence.relation.relationStatus, "reviewed");
	assert.equal(promotedEvidence.relation.reviewedCandidateId, "R2");
	assert.equal(promotedEvidence.relation.reviewRevision, 1);
	assert.equal(promotedEvidence.relation.reviewProvenance.kind, "explicit-user-import-session-source-association-review");
	assert.equal(promotedEvidence.relation.claimScope, "source-association-only");
	assert.equal(promotedEvidence.relation.intrinsicMappingStatus, "not-established");
	assert.equal(promotedEvidence.relation.domainRelationStatus, "not-established");
	assert.equal(promotedEvidence.relation.candidates.find((entry) => entry.id === "R2").provenance.source.objectName, "EU");
	assert.equal(service.setRelationDecision({ evidenceId: "E1", candidateId: "R2", action: "withdraw-review", expectedRevision: 1 }).ok, true);
	record = service.getResultEvidence({ evidenceId: "E1" }).record;
	assert.equal(record.relationDecision.reviewedCandidateId, null);
	promotedSnapshot = state.items[0].derived.sourceEvidenceSnapshot;
	assert.equal(promotedSnapshot.relationEvidence.status, "open-candidates");
	promotedEvidence = buildPromotedGndWorkspaceEvidence({ id: "A1", meta: { importItemId: "A1", sourceEvidence: promotedSnapshot } });
	assert.equal(promotedEvidence.relation.status, "partial-evidence");
	assert.equal(promotedEvidence.relation.relationStatus, "open-candidates");
	assert.equal(promotedEvidence.relation.reviewedCandidateId, null);
	assert.equal(promotedEvidence.relation.reviewRevision, 2);
	assert.equal(writes, 2);
});

test("stale unknown foreign and mismatched review withdrawal requests are zero-write", () => {
	let state = fixture(), writes = 0;
	const service = createImportSessionService({ getState: () => state, setState: (next) => { state = next; writes += 1; } });
	for (const request of [
		{ evidenceId: "FOREIGN", candidateId: "R1", action: "review", expectedRevision: 0 },
		{ evidenceId: "E1", candidateId: "UNKNOWN", action: "review", expectedRevision: 0 },
		{ evidenceId: "E1", candidateId: "R1", action: "review", expectedRevision: 9 },
		{ evidenceId: "E1", candidateId: "R1", action: "withdraw-review", expectedRevision: 0 },
	]) assert.equal(service.setRelationDecision(request).ok, false);
	assert.equal(writes, 0);
});

test("persisted reviewed source evidence rehydrates into fresh main q and l intelligence controllers", async () => {
	let importState = fixture();
	const service = createImportSessionService({ getState: () => importState, setState: (next) => { importState = next; } });
	assert.equal(service.setRelationDecision({ evidenceId: "E1", candidateId: "R2", action: "review", expectedRevision: 0 }).ok, true);
	const persisted = structuredClone({ id: "A1", meta: { importItemId: "A1", sourceEvidence: importState.items[0].derived.sourceEvidenceSnapshot } });
	const storeState = { workspace_selection: { primaryId: "A1" }, cursor: { s: 25 } };
	let mode = "main";
	const rendered = [];
	const intelligence = createExistingAlignmentIntelligenceJourneyController({
		store: { getState: () => storeState, subscribe: () => () => {} },
		workspace: { getActiveMode: () => mode },
		viewController: { getDebugState: () => ({ objectId: "A1", segmentCount: 1 }) },
		view: { render(model) { rendered.push(model); }, wireModeChanges: () => () => {} },
	});
	intelligence.start();
	const journey = createPromotedAlignmentWorkspaceJourneyController({
		cockpit: { async activateSpotObject() { return true; }, async refreshSpotState() { return { objects: [structuredClone(persisted)] }; }, async refreshAll() {} },
		store: { getState: () => storeState, subscribe: () => () => {} },
		alignmentBimWorkspace: { activate(next) { mode = next; return true; } },
		viewController: { getDebugState: () => ({ objectId: "A1", segmentCount: 1 }) },
		alignmentIntelligence: intelligence,
	});
	const hydrated = await journey.rehydrateCanonicalAlignment("A1");
	assert.equal(hydrated.evidence.relation.status, "partial-evidence");
	assert.equal(hydrated.evidence.relation.relationStatus, "reviewed");
	assert.equal(hydrated.evidence.relation.reviewedCandidateId, "R2");
	assert.equal(hydrated.evidence.relation.reviewRevision, 1);
	for (const nextMode of ["main", "q", "l"]) {
		mode = nextMode;
		const model = intelligence.render();
		assert.equal(model.mode, nextMode);
		assert.equal(model.context.objectId, "A1");
		assert.equal(model.capabilities.topology.status, "partial-evidence");
	}
	assert.ok(rendered.length >= 4);
});

test("productive review promotion save and fresh SPOT hydration retain reviewed evidence", async () => {
	let importState = fixture();
	const importService = createImportSessionService({ getState: () => importState, setState: (next) => { importState = next; } });
	assert.equal(importService.setRelationDecision({ evidenceId: "E1", candidateId: "R1", action: "review", expectedRevision: 0 }).ok, true);
	const record = importService.getResultEvidence({ evidenceId: "E1" }).record;
	const enriched = withSpotEvidenceSnapshot(importService.getState().items[0], record);
	assert.equal(enriched.derived.sourceEvidenceSnapshot.relationEvidence.status, "reviewed");
	const firstStore = createSpotStore();
	let serialized = null;
	const persistence = { async load() { return null; }, async save(state) { serialized = structuredClone(state); return structuredClone(state); } };
	const firstSpot = createSpotService({ spotStore: firstStore, persistence });
	const promoted = await firstSpot.promoteItems({ items: [enriched] });
	assert.equal(promoted.count.addedObjects, 1);
	assert.equal(serialized.objects.A1.meta.sourceEvidence.relationEvidence.status, "reviewed");
	assert.equal(serialized.objects.A1.meta.sourceEvidence.relationEvidence.reviewedCandidateId, "R1");
	const freshStore = createSpotStore();
	const freshSpot = createSpotService({ spotStore: freshStore, persistence: { async load() { return structuredClone(serialized); }, async save() {} } });
	await freshSpot.hydrate();
	const persistedObject = freshSpot.getState().objects.A1;
	const evidence = buildPromotedGndWorkspaceEvidence(persistedObject);
	assert.equal(evidence.relation.status, "partial-evidence");
	assert.equal(evidence.relation.relationStatus, "reviewed");
	assert.equal(evidence.relation.reviewedCandidateId, "R1");
	assert.equal(evidence.relation.reviewRevision, 1);
	assert.equal(evidence.relation.claimScope, "source-association-only");
	assert.equal(evidence.relation.intrinsicMappingStatus, "not-established");
	assert.equal(evidence.relation.domainRelationStatus, "not-established");
});

test("generic canonical object hydrates once with null evidence and keeps exact context", async () => {
	const state = { workspace_selection: { primaryId: "GENERIC" }, cursor: { s: 12 } };
	let observer = null, refreshCount = 0;
	const applied = [], contexts = [];
	const controller = createPromotedAlignmentWorkspaceJourneyController({
		cockpit: { async activateSpotObject() { return true; }, async refreshSpotState() { refreshCount += 1; return { objects: { GENERIC: { id: "GENERIC", meta: {} } } }; }, async refreshAll() {} },
		store: { getState: () => state, subscribe(fn) { observer = fn; return () => {}; } },
		alignmentBimWorkspace: { activate() { return true; } },
		viewController: { getDebugState: () => ({ objectId: "GENERIC" }) },
		alignmentIntelligence: { setPromotedEvidence(value) { applied.push(value); }, setActiveContext(value) { contexts.push(value); } },
	});
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(refreshCount, 1);
	assert.equal(applied.at(-1), null);
	assert.deepEqual(contexts.at(-1), { objectId: "GENERIC", s: 12 });
	observer();
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(refreshCount, 1);
	const explicit = await controller.activateCanonicalAlignment("GENERIC");
	assert.equal(explicit.ok, true);
	assert.equal(explicit.evidence, undefined);
	assert.equal(refreshCount, 2);
});

test("reviewed A and promoted B remain target-bound before and after canonical serialization", () => {
	let importState = fixture();
	const itemA = importState.items[0];
	const itemB = structuredClone(itemA);
	itemB.id = "B1";
	itemB.payload.name = "B1";
	importState.items = [itemA, itemB];
	importState.resultEvidence[0].relationCandidates[0].to = "A1";
	importState.resultEvidence[0].relationCandidates[1].to = "B1";
	const importService = createImportSessionService({ getState: () => importState, setState: (next) => { importState = next; } });
	assert.equal(importService.setRelationDecision({ evidenceId: "E1", candidateId: "R1", action: "review", expectedRevision: 0 }).ok, true);
	const record = importService.getResultEvidence({ evidenceId: "E1" }).record;
	const enriched = importService.getState().items.map((item) => withSpotEvidenceSnapshot(item, record));
	const store = createSpotStore();
	const result = promoteImportItems({ items: enriched, spotStore: store });
	assert.equal(result.count.addedObjects, 2);
	const before = store.getState();
	const beforeA = buildPromotedGndWorkspaceEvidence(before.objects.A1);
	const beforeB = buildPromotedGndWorkspaceEvidence(before.objects.B1);
	assert.equal(beforeA.relation.relationStatus, "reviewed");
	assert.equal(beforeA.relation.reviewedCandidateId, "R1");
	assert.equal(beforeB.relation.relationStatus, "open-candidates");
	assert.equal(beforeB.relation.candidates[0].id, "R2");
	assert.equal(beforeB.relation.reviewedCandidateId, null);
	const fresh = createSpotStore();
	fresh.replaceState(structuredClone(before));
	const after = fresh.getState();
	assert.equal(buildPromotedGndWorkspaceEvidence(after.objects.A1).relation.relationStatus, "reviewed");
	assert.equal(buildPromotedGndWorkspaceEvidence(after.objects.B1).relation.relationStatus, "open-candidates");
});

test("physical GND commit bridges qualified evidence identity into canonical promotion and reload", async () => {
	const bytes = await readFile(new URL("../../fixtures/gnd-mdb/valid-minimal-jet4.mdb", import.meta.url));
	const result = await runImportPipeline({ name: "valid-minimal-jet4.mdb", size: bytes.length, async arrayBuffer() { return bytes; } }, { bytes: new Uint8Array(bytes) });
	const publication = createImportResultEvidencePublication({ result, fileName: "valid-minimal-jet4.mdb", parserId: result?.meta?.sourceFormat, idFactory: () => "C7" });
	let state = { sessionId: null, phase: "idle", items: [], rejectedItems: [], resultEvidence: [], error: null };
	const service = createImportSessionService({ getState: () => state, setState: (next) => { state = next; } });
	service.commitJob({ batchId: "C7", source: { fileName: "valid-minimal-jet4.mdb" }, files: [{ jobId: "J1", fileName: "valid-minimal-jet4.mdb", publication, items: result.items, rejectedItems: result.rejected ?? [] }] });
	const record = service.getResultEvidence().records[0];
	const candidate = record.relationCandidates.find((entry) => entry.type === "gndSourceEvidenceAssociation");
	assert.ok(candidate);
	const qualifiedTargetId = candidate.toId ?? candidate.to;
	const sessionTarget = service.getState().items.find((item) => item.evidenceItemId === qualifiedTargetId);
	assert.ok(sessionTarget);
	assert.equal(sessionTarget.id, sessionTarget.sourceItemId ?? sessionTarget.id);
	assert.notEqual(sessionTarget.id, sessionTarget.evidenceItemId);
	assert.equal(service.setRelationDecision({ evidenceId: record.evidenceId, candidateId: candidate.id, action: "review", expectedRevision: 0 }).ok, true);
	const reviewedRecord = service.getResultEvidence({ evidenceId: record.evidenceId }).record;
	const enriched = withSpotEvidenceSnapshot(service.getState().items.find((item) => item.id === sessionTarget.id), reviewedRecord);
	assert.equal(enriched.derived.sourceEvidenceSnapshot.candidate.itemId, qualifiedTargetId);
	const store = createSpotStore();
	const promotion = promoteImportItems({ items: [enriched], spotStore: store });
	assert.equal(promotion.count.addedObjects, 1);
	const promoted = store.getState().objects[sessionTarget.id];
	assert.ok(promoted);
	assert.equal(promoted.id, sessionTarget.id);
	assert.equal(promoted.meta.importItemId, qualifiedTargetId);
	const serialized = structuredClone(store.getState());
	const fresh = createSpotStore();
	fresh.replaceState(serialized);
	const rehydrated = buildPromotedGndWorkspaceEvidence(fresh.getState().objects[sessionTarget.id]);
	assert.equal(rehydrated.relation.relationStatus, "reviewed");
	assert.equal(rehydrated.relation.reviewedCandidateId, candidate.id);
	assert.equal(rehydrated.relation.claimScope, "source-association-only");
	assert.equal(rehydrated.relation.intrinsicMappingStatus, "not-established");
	assert.equal(rehydrated.relation.domainRelationStatus, "not-established");
});

test("ambiguous or mismatched qualified publication identities reject without mutation", () => {
	const base = fixture();
	const evidence = base.resultEvidence[0];
	const original = base.items[0];
	for (const publicationItems of [
		[{ ...original, id: "Q1", sourceItemId: original.id }, { ...original, id: "Q2", sourceItemId: original.id }],
		[{ ...original, id: "Q1", sourceItemId: "OTHER" }],
	]) {
		let state = { sessionId: null, phase: "idle", items: [], rejectedItems: [], resultEvidence: [], error: null };
		const service = createImportSessionService({ getState: () => state, setState: (next) => { state = next; } });
		const before = structuredClone(state);
		assert.throws(() => service.commitJob({ batchId: "BAD", files: [{ jobId: "J", fileName: "gnd.mdb", publication: { evidence, items: publicationItems }, items: [original], rejectedItems: [] }] }), /ambiguous publication sourceItemId|publication item identity missing/);
		assert.deepEqual(state, before);
	}
});
