import test from "node:test";
import assert from "node:assert/strict";
import {
	createImportResultEvidencePublication,
	withSpotEvidenceSnapshot,
} from "../src/import/evidence/importResultEvidence.js";
import { createImportSessionService } from "../src/shared/messaging/service/ImportSessionService.js";
import { promoteImportItems } from "../src/model/spot/mutate/promoteImportItems.js";
import { AppRuntimeLocal } from "../src/shared/runtime/AppRuntimeLocal.js";
import { validatePayload } from "../src/shared/messaging/CommandContract_v1.js";

function item(id = "candidate-1", overrides = {}) {
	return {
		id,
		kind: "alignment",
		source: { fileName: "synthetic.gnd", parserId: "gnd-edit-xlsx" },
		payload: {
			kind: "alignment",
			name: id,
			coordGeom: { elements: [{ id: "e1", type: "straight", length: 10 }] },
			extended: { unresolvedAttachments: [{
				kind: "cant",
				evidenceClass: "ambiguous-unattached-source-evidence",
				padStart: "P1",
				padEnd: "P2",
				ambiguityReason: "multiple-coordinate-reference-candidates",
				candidateReferenceSystems: ["SYNTH_A", "SYNTH_B"],
				sourceElements: [{ family: "EU", rowRef: "X_ASC23_EU:2", typeCode: 999, parameters: { EUPAR1: 10.123456789 } }],
			}] },
		},
		status: { valid: true, promotable: true, stage: "derived", reason: null },
		meta: {},
		derived: {
			sparseAlignment: { type: "sparseAlignment", startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }, sparse: [{ id: "e1", type: "fixed", poseA: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }, arcLength: 10, curvature: 0 }] },
			spatialRef: { status: "declared", crsId: "SYNTH_A", resolutionState: "local-cartesian" },
			importAssessment: { sourceTrustClass: "authoritative_context" },
		},
		annotations: [],
		...overrides,
	};
}

function result(format = "XLSX", overrides = {}) {
	const parserId = format.includes("MDB") ? "gnd-edit-mdb" : "gnd-edit-xlsx";
	return {
		ok: true,
		status: "ok",
		reason: null,
		items: [item()],
		rejected: [item("rejected-1", { status: { valid: false, promotable: false, stage: "rejected", reason: "synthetic-rejection" } })],
		relationCandidates: [{ id: "relation-1", from: "candidate-1", to: "rejected-1" }],
		meta: {
			sourceFormat: parserId,
			diagnostics: [{ code: "cant-context-ambiguous-unattached", family: "EU", rowRef: "X_ASC23_EU:2", geometryUsable: true }],
		},
		sourceEnvelope: {
			type: "GndTypedSourceEnvelope",
			version: 1,
			source: { fileName: `synthetic.${format.includes("MDB") ? "mdb" : "xlsx"}`, format, container: format.includes("MDB") ? "Microsoft Access database" : "ZIP/OOXML", sha256: "a".repeat(64) },
			extractor: { id: format.includes("MDB") ? "mdb-reader" : "SheetJS", version: "test" },
			inventory: [{ name: "X_ASC11_PP", rowCount: 2, columnCount: 2, interpreted: true }],
			tables: [{ name: "X_ASC11_PP", rows: [{ ordinal: 0, cells: [{ columnName: "PAD", value: "PRIVATE-ROW-MUST-NOT-LOG" }] }] }],
			diagnostics: [],
		},
		...overrides,
	};
}

function publication(format = "XLSX", overrides = {}) {
	return createImportResultEvidencePublication({
		result: result(format, overrides),
		fileName: format.includes("MDB") ? "synthetic.mdb" : "synthetic.xlsx",
		idFactory: () => "fixed",
		completedAt: "2026-07-24T00:00:00.000Z",
	});
}

function service() {
	let state = null;
	const events = [];
	const api = createImportSessionService({ getState: () => state, setState: (next) => { state = next; }, router: { broadcastEvt: (name, payload) => events.push({ name, payload }) } });
	return { api, events, internal: () => state };
}

test("XLSX and MDB produce equivalent immutable evidence records with stable references", () => {
	for (const format of ["XLSX", "Jet 4 MDB"]) {
		const pub = publication(format);
		assert.equal(pub.evidence.schema, "ufAIM.import-result-evidence");
		assert.equal(pub.evidence.version, 1);
		assert.equal(pub.evidence.evidenceId, `evidence_v1_${"a".repeat(16)}_fixed`);
		assert.equal(pub.evidence.source.sha256, "a".repeat(64));
		assert.equal(pub.evidence.inventory[0].name, "X_ASC11_PP");
		assert.equal(pub.evidence.diagnostics[0].code, "cant-context-ambiguous-unattached");
		assert.equal(pub.evidence.relationCandidates[0].id, "relation-1");
		assert.equal(pub.evidence.sourceEnvelope.tables[0].rows[0].cells[0].value, "PRIVATE-ROW-MUST-NOT-LOG");
		assert.equal(pub.evidence.truthfulnessStatus, "ambiguous-evidence-retained");
		assert.ok(Object.isFrozen(pub.evidence));
		assert.ok(pub.items.every((entry) => entry.evidenceId === pub.evidence.evidenceId));
	}
});

test("one atomic publication stores one envelope and GetState exposes references only", () => {
	const { api, internal } = service();
	api.beginSession({ source: "synthetic-test" });
	const pub = publication();
	const state = api.publishResultEvidence(pub);
	assert.equal(state.items[0].evidenceId, pub.evidence.evidenceId);
	assert.equal(state.rejectedItems[0].evidenceId, pub.evidence.evidenceId);
	assert.equal(Object.hasOwn(state, "resultEvidence"), false);
	assert.equal(Object.hasOwn(state.items[0], "sourceEnvelope"), false);
	assert.equal(internal().resultEvidence.length, 1);
	assert.equal(internal().resultEvidence[0].sourceEnvelope.tables.length, 1);

	const all = api.getResultEvidence();
	const one = api.getResultEvidence({ evidenceId: pub.evidence.evidenceId });
	const missing = api.getResultEvidence({ evidenceId: "not-found" });
	assert.equal(all.records.length, 1);
	assert.equal(one.found, true);
	assert.equal(one.record.evidenceId, pub.evidence.evidenceId);
	assert.deepEqual(missing, { schema: "ufAIM.import-result-evidence", version: 1, found: false, evidenceId: "not-found", record: null });
	one.record.source.sha256 = "mutated-reader-copy";
	assert.equal(api.getResultEvidence({ evidenceId: pub.evidence.evidenceId }).record.source.sha256, "a".repeat(64));
});

test("session clearing removes items and complete evidence deterministically", () => {
	const { api, internal } = service();
	api.beginSession();
	api.publishResultEvidence(publication());
	api.beginSession({ source: "next" });
	assert.equal(api.getState().items.length, 0);
	assert.equal(api.getState().rejectedItems.length, 0);
	assert.equal(api.getResultEvidence().records.length, 0);
	assert.equal(internal().resultEvidence.length, 0);
});

test("missing-core and conflicting evidence retain explicit truthfulness states", () => {
	const missing = publication("Jet 4 MDB", {
		ok: false,
		status: "invalid",
		reason: "GND_SOURCE_INCOMPLETE",
		items: [],
		rejected: [],
		meta: { sourceFormat: "gnd-edit-mdb", diagnostics: [{ code: "GND_CORE_TABLE_ABSENT", table: "X_ASC13_PH" }] },
		sourceEnvelope: { ...result("Jet 4 MDB").sourceEnvelope, diagnostics: [{ code: "GND_CORE_TABLE_ABSENT", table: "X_ASC13_PH" }] },
	});
	assert.equal(missing.evidence.truthfulnessStatus, "incomplete-source");
	assert.equal(missing.items.length, 0);

	const conflict = publication("XLSX", {
		meta: { sourceFormat: "gnd-edit-xlsx", diagnostics: [{ code: "lsys-conflict", family: "PL" }] },
	});
	assert.equal(conflict.evidence.truthfulnessStatus, "conflicting-evidence");
});

test("SPOT promotion retains compact evidence after ImportSession clearing", () => {
	const { api } = service();
	api.beginSession();
	const pub = publication();
	api.publishResultEvidence(pub);
	const record = api.getResultEvidence({ evidenceId: pub.evidence.evidenceId }).record;
	const linked = api.getState().items[0];
	const enriched = withSpotEvidenceSnapshot(linked, record);
	const objects = [];
	const promoted = promoteImportItems({ items: [enriched], spotStore: { addObjects: (entries) => objects.push(...entries), addCrs: () => {} } });
	assert.equal(promoted.count.addedObjects, 1);
	assert.equal(objects[0].meta.sourceEvidence.evidenceId, pub.evidence.evidenceId);
	assert.equal(objects[0].meta.sourceEvidence.source.sha256, "a".repeat(64));
	assert.equal(Object.hasOwn(objects[0].meta.sourceEvidence, "sourceEnvelope"), false);
	assert.equal(objects[0].meta.sourceEvidence.unresolvedAttachments[0].evidenceClass, "ambiguous-unattached-source-evidence");
	api.beginSession({ source: "cleared" });
	assert.equal(api.getResultEvidence().records.length, 0);
	assert.equal(objects[0].meta.sourceEvidence.source.sha256, "a".repeat(64));
});

test("evidence publication and reads do not log raw source rows", () => {
	const original = console.log;
	const logs = [];
	console.log = (...args) => logs.push(args.map(String).join(" "));
	try {
		const { api } = service();
		api.beginSession();
		api.publishResultEvidence(publication());
		api.getResultEvidence();
	} finally {
		console.log = original;
	}
	assert.equal(logs.some((line) => line.includes("PRIVATE-ROW-MUST-NOT-LOG")), false);
});

test("local runtime exposes publish and read commands without parser execution", async () => {
	validatePayload("cmd", "Import.PublishResultEvidence", { evidence: {}, items: [] });
	validatePayload("cmd", "Import.GetResultEvidence", {});
	const logs = [];
	const original = console.log;
	console.log = (...args) => logs.push(JSON.stringify(args));
	const runtime = new AppRuntimeLocal({ windowId: "evidence-test", debug: true });
	const cmd = (name, payload = {}) => ({ type: "cmd", name, payload, id: `${name}-id`, src: { ctx: "win:evidence-test", role: "view" } });
	try {
		await runtime.handle(cmd("Import.BeginSession", { source: "test" }));
		const pub = publication();
		const published = await runtime.handle(cmd("Import.PublishResultEvidence", pub));
		assert.equal(published.type, "ack");
		assert.equal(published.payload.items[0].evidenceId, pub.evidence.evidenceId);
		const read = await runtime.handle(cmd("Import.GetResultEvidence", { evidenceId: pub.evidence.evidenceId }));
		assert.equal(read.type, "ack");
		assert.equal(read.payload.found, true);
		assert.equal(read.payload.record.source.sha256, "a".repeat(64));
		const ordinary = await runtime.handle(cmd("Import.GetState"));
		assert.equal(Object.hasOwn(ordinary.payload, "resultEvidence"), false);
	} finally {
		console.log = original;
	}
	assert.equal(logs.some((line) => line.includes("PRIVATE-ROW-MUST-NOT-LOG")), false);
});
