import assert from "node:assert/strict";
import test from "node:test";
import { deriveGndAttachmentRelationCandidates } from "../src/import/relations/deriveGndAttachmentRelationCandidates.js";

function fixture(overrides = {}) {
	const key = "route|1|LSYS|0|100";
	const alignment = {
		id: "A", name: "Exact A",
		extras: { gndSequence: { attachmentKey: key, strecke: "route", strRikz: 1, lsys: "LSYS", hsys: "HSYS", edgeChain: [{ extras: { rowRef: "X_ASC21_EL:1" } }] }, unresolvedAttachments: {
			profile: { kind: "profile", attachmentStatus: "uniquely-attachable", attachmentKey: key, constructive: false, source: { fileName: "source.mdb" }, sourceReferenceRequirements: { requiredHsys: "HSYS" }, candidateHorizontalReferenceSystems: ["LSYS"], candidateVerticalReferenceSystems: ["HSYS"], candidateStationContexts: [{ strecke: "route", strRikz: 1 }], sourceElements: [{ family: "EH", rowRef: "X_ASC22_EH:1" }] },
			cant: { kind: "cant", attachmentStatus: "uniquely-attachable", attachmentKey: key, constructive: false, source: { fileName: "source.mdb" }, candidateHorizontalReferenceSystems: ["LSYS"], candidateStationContexts: [{ strecke: "route", strRikz: 1 }], sourceElements: [{ family: "EU", rowRef: "X_ASC23_EU:1" }] },
		} },
	};
	const item = { id: "alignment_A", kind: "alignment", source: { index: 0, objectName: "Exact A", parserId: "gndEdit", fileName: "source.mdb" }, payload: { id: "A", name: "Exact A" } };
	const record = (family, sheet, row, normalized) => ({ family, sheet, row, sourceId: `fp:${sheet}:${row}`, normalized });
	const records = [
		record("EL", "X_ASC21_EL", 1, { PAD1: "P1", PAD2: "P2" }),
		record("EH", "X_ASC22_EH", 1, { PAD1: "P1", PAD2: "P2" }),
		record("EU", "X_ASC23_EU", 1, { PAD1: "P1", PAD2: "P2" }),
		record("PP", "X_ASC11_PP", 1, { PAD: "P1", STRECKE: "route", STRRIKZ: 1, STATION: 0 }),
		record("PP", "X_ASC11_PP", 2, { PAD: "P2", STRECKE: "route", STRRIKZ: 1, STATION: 100 }),
		record("PL", "X_ASC12_PL", 1, { PAD: "P1", LSYS: "LSYS", Y: 0, X: 0 }),
		record("PL", "X_ASC12_PL", 2, { PAD: "P2", LSYS: "LSYS", Y: 100, X: 0 }),
		record("PH", "X_ASC13_PH", 1, { PAD: "P1", HSYS: "HSYS", H: 10 }),
		record("PH", "X_ASC13_PH", 2, { PAD: "P2", HSYS: "HSYS", H: 11 }),
	];
	const sourceLayer = { sourceDocument: { fingerprint: "fp", fileName: "source.mdb", parserId: "MDBReader" }, records };
	return { alignments: [alignment], items: [item], sourceLayer, source: { fileName: "source.mdb", parserId: "gndEdit" }, key, alignment, item, ...overrides };
}

test("ambiguous rejected unattached, missing row refs and wrong family yield zero", () => {
	for (const mutate of [
		(e, key) => { e.attachmentStatus = "ambiguous-unattached"; },
		(e, key) => { e.attachmentStatus = "rejected-unattached"; },
		(e) => { e.sourceElements[0].rowRef = null; },
		(e) => { e.sourceElements[0].family = "EU"; },
	]) {
		const data = fixture();
		mutate(data.alignment.extras.unresolvedAttachments.profile, data.key);
		delete data.alignment.extras.unresolvedAttachments.cant;
		assert.deepEqual(deriveGndAttachmentRelationCandidates(data), []);
	}
});

test("rounded-key collision never overrides raw route, chain, station or system conflicts", () => {
	for (const mutate of [
		(data) => { data.sourceLayer.records.find((record) => record.family === "EH").normalized = { PAD1: "P2", PAD2: "P1" }; },
		(data) => { data.sourceLayer.records.find((record) => record.family === "PP").normalized.STRECKE = "other"; },
		(data) => { data.sourceLayer.records.push({ ...structuredClone(data.sourceLayer.records.find((record) => record.family === "PP")), sourceId: "fp:PP:conflict", row: 9, normalized: { PAD: "P1", STRECKE: "route", STRRIKZ: 1, STATION: 0.001 } }); },
		(data) => { data.sourceLayer.records.find((record) => record.family === "PL").normalized.LSYS = "OTHER"; },
		(data) => { data.sourceLayer.records.find((record) => record.family === "PH").normalized.HSYS = "OTHER"; },
		(data) => { data.sourceLayer.sourceDocument.fingerprint = null; },
		(data) => { data.sourceLayer.sourceDocument.fingerprint = "other"; },
		(data) => { data.sourceLayer.sourceDocument.fileName = "other.mdb"; },
	]) {
		const data = fixture();
		delete data.alignment.extras.unresolvedAttachments.cant;
		mutate(data);
		assert.deepEqual(deriveGndAttachmentRelationCandidates(data), []);
	}
});

test("duplicate identical exact evidence claims yield zero independent of audit key", () => {
	const data = fixture();
	const duplicateAlignment = structuredClone(data.alignment);
	duplicateAlignment.extras.gndSequence.attachmentKey = "different-audit-key";
	duplicateAlignment.extras.unresolvedAttachments.profile.attachmentKey = "different-audit-key";
	duplicateAlignment.extras.unresolvedAttachments.cant.attachmentKey = "different-audit-key";
	data.alignments.push(duplicateAlignment);
	data.items.push({ ...structuredClone(data.item), id: "alignment_A_duplicate", source: { ...data.item.source, index: 1 } });
	assert.deepEqual(deriveGndAttachmentRelationCandidates(data), []);
});

test("duplicate-equal raw observations remain auditable and rounded key is corroboration only", () => {
	const first = fixture();
	const duplicate = structuredClone(first.sourceLayer.records.find((record) => record.family === "PP" && record.normalized.PAD === "P1"));
	duplicate.row = 8; duplicate.sourceId = "fp:X_ASC11_PP:8";
	first.sourceLayer.records.push(duplicate);
	const firstCandidate = deriveGndAttachmentRelationCandidates(first)[0];
	assert.equal(firstCandidate.source.contexts.pp[0].classification, "duplicate-equal");
	assert.equal(firstCandidate.source.contexts.pp[0].sourceIds.length, 2);

	const second = fixture();
	second.alignment.extras.gndSequence.attachmentKey = "different-rounded-audit-key";
	second.alignment.extras.unresolvedAttachments.profile.attachmentKey = "different-rounded-audit-key";
	second.alignment.extras.unresolvedAttachments.cant.attachmentKey = "different-rounded-audit-key";
	const secondCandidate = deriveGndAttachmentRelationCandidates(second)[0];
	assert.equal(firstCandidate.fromId.includes(first.key), false);
	assert.equal(secondCandidate.fromId.includes("different-rounded-audit-key"), false);
});

test("different rounded audit keys preserve the same raw-evidence decision and identity", () => {
	const first = fixture();
	const second = fixture();
	second.alignment.extras.gndSequence.attachmentKey = "another-rounded-key";
	second.alignment.extras.unresolvedAttachments.profile.attachmentKey = "unrelated-profile-key";
	second.alignment.extras.unresolvedAttachments.cant.attachmentKey = "unrelated-cant-key";
	const firstCandidates = deriveGndAttachmentRelationCandidates(first);
	const secondCandidates = deriveGndAttachmentRelationCandidates(second);
	assert.deepEqual(firstCandidates.map((candidate) => candidate.id), secondCandidates.map((candidate) => candidate.id));
	assert.deepEqual(firstCandidates.map((candidate) => candidate.fromId), secondCandidates.map((candidate) => candidate.fromId));
});

test("same rounded audit key does not block two disjoint exact raw-source chains", () => {
	const data = fixture();
	const second = structuredClone(data.alignment);
	second.id = "B"; second.name = "Exact B";
	second.extras.gndSequence.edgeChain[0].extras.rowRef = "X_ASC21_EL:2";
	second.extras.gndSequence.strecke = "route-B";
	second.extras.unresolvedAttachments.profile.sourceElements[0].rowRef = "X_ASC22_EH:2";
	second.extras.unresolvedAttachments.profile.candidateStationContexts = [{ strecke: "route-B", strRikz: 1 }];
	second.extras.unresolvedAttachments.cant.sourceElements[0].rowRef = "X_ASC23_EU:2";
	second.extras.unresolvedAttachments.cant.candidateStationContexts = [{ strecke: "route-B", strRikz: 1 }];
	data.alignments.push(second);
	data.items.push({ id: "alignment_B", kind: "alignment", source: { index: 1, objectName: "Exact B", parserId: "gndEdit", fileName: "source.mdb" }, payload: { id: "B", name: "Exact B" } });
	const add = (family, sheet, row, normalized) => data.sourceLayer.records.push({ family, sheet, row, sourceId: `fp:${sheet}:${row}`, normalized });
	add("EL", "X_ASC21_EL", 2, { PAD1: "P3", PAD2: "P4" });
	add("EH", "X_ASC22_EH", 2, { PAD1: "P3", PAD2: "P4" });
	add("EU", "X_ASC23_EU", 2, { PAD1: "P3", PAD2: "P4" });
	add("PP", "X_ASC11_PP", 3, { PAD: "P3", STRECKE: "route-B", STRRIKZ: 1, STATION: 0 });
	add("PP", "X_ASC11_PP", 4, { PAD: "P4", STRECKE: "route-B", STRRIKZ: 1, STATION: 100 });
	add("PL", "X_ASC12_PL", 3, { PAD: "P3", LSYS: "LSYS", Y: 200, X: 0 });
	add("PL", "X_ASC12_PL", 4, { PAD: "P4", LSYS: "LSYS", Y: 300, X: 0 });
	add("PH", "X_ASC13_PH", 3, { PAD: "P3", HSYS: "HSYS", H: 20 });
	add("PH", "X_ASC13_PH", 4, { PAD: "P4", HSYS: "HSYS", H: 21 });
	const candidates = deriveGndAttachmentRelationCandidates(data);
	assert.equal(candidates.length, 4);
	assert.deepEqual(new Set(candidates.map((candidate) => candidate.toId)), new Set(["alignment_A", "alignment_B"]));
});

test("duplicate or mismatched exact targets and filename/name/order decoys never infer", () => {
	const duplicate = fixture();
	duplicate.items.push(structuredClone(duplicate.item));
	assert.deepEqual(deriveGndAttachmentRelationCandidates(duplicate), []);

	for (const mutate of [
		(data) => { data.item.source.index = 1; },
		(data) => { data.item.source.objectName = "Exact A copy"; },
		(data) => { data.item.payload.id = "B"; },
		(data) => { data.item.payload.name = "Similar Exact A"; },
	]) {
		const data = fixture(); mutate(data);
		assert.deepEqual(deriveGndAttachmentRelationCandidates(data), []);
	}
	const decoy = fixture();
	decoy.items = [{ ...decoy.item, id: "decoy", source: { ...decoy.item.source, index: 4, fileName: "Exact A.mdb" }, payload: { id: "OTHER", name: "Exact A" } }];
	assert.deepEqual(deriveGndAttachmentRelationCandidates(decoy), []);
});
