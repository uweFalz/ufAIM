import assert from "node:assert/strict";
import test from "node:test";
import { createSpotStore } from "../../../src/model/spot/model/SpotStore.js";
import { createSpotService } from "../../../src/shared/messaging/service/SpotService.js";
import { buildHorizontalRealizationChangeReceipt, archiveHorizontalRealizationChangeReceipt, restoreHorizontalRealizationChangeReceipt } from "../../../app/domain/workspace/buildHorizontalRealizationChangeReceipt.js";

function fixture() {
	const before = { id: "A1", sparseAlignment: { elements: [
		{ id: "ARC", curvature: .01, arcLength: 100, sStart: 0, sEnd: 100 },
		{ id: "NEXT", curvature: 0, arcLength: 20, sStart: 100, sEnd: 120 },
	] } };
	const after = structuredClone(before);
	after.meta = { modifiedAt: "r2" };
	after.sparseAlignment.elements[0].curvature = .02;
	const object = { id: "A1", type: "alignment", data: { alignmentData: after, kernel: { preserve: true }, extended: { other: { preserve: true } } }, refs: { source: "physical-source" }, meta: { modifiedAt: "r2" } };
	const change = { objectId: "A1", elementId: "ARC", revision: "r2", alignmentData: after, spotObject: object };
	const evidence = { type: "axtran2-consequence-evidence", status: "evidence-only", admissible: false, version: "test-producer", fitMode: "keep-plan", planSigma: .05, diagnostics: { iterations: 13, endPoseDistance: 1e-9 }, undetermined: [{ elementId: "NEXT", play: Infinity }] };
	const receipt = buildHorizontalRealizationChangeReceipt({ beforeAlignmentData: before, alignmentChange: change, activeObjectId: "A1", activeElementId: "ARC", axtranEvidence: evidence });
	const entry = archiveHorizontalRealizationChangeReceipt({ receipt, beforeAlignmentData: before, alignmentChange: change });
	let disk = { objects: { A1: object } };
	let failSave = false;
	const persistence = { async load() { return structuredClone(disk); }, async save(state) { if (failSave) throw new Error("disk failed"); disk = structuredClone(state); } };
	const service = createSpotService({ spotStore: createSpotStore(), persistence });
	return { service, persistence, object, entry, receipt, fail: () => { failSave = true; } };
}

test("durable receipt survives a fresh store without solver rerun or geometry mutation", async () => {
	const { service, persistence, entry, receipt } = fixture();
	await service.hydrate();
	const before = service.getState().objects.A1;
	const result = await service.storeHorizontalReceipt({ objectId: "A1", entry });
	assert.equal(result.ok, true);
	const reopened = createSpotService({ spotStore: createSpotStore(), persistence });
	await reopened.hydrate();
	const object = reopened.getState().objects.A1;
	assert.deepEqual(restoreHorizontalRealizationChangeReceipt({ spotObject: object, elementId: "ARC" }), receipt);
	assert.equal(object.data.extended.horizontalRealizationReceipts[0].receipt.diagnostics.evidence.undetermined[0].play, Infinity);
	assert.deepEqual(object.data.alignmentData, before.data.alignmentData);
	assert.deepEqual(object.meta, before.meta);
	assert.deepEqual(object.refs, before.refs);
	assert.deepEqual(object.data.kernel, before.data.kernel);
	assert.deepEqual(object.data.extended.other, before.data.extended.other);
	assert.equal(restoreHorizontalRealizationChangeReceipt({ spotObject: object, elementId: "NEXT" }), null);
});

test("old states have no fabricated receipt; malformed/stale/cross-object/admissible receipts fail closed", async () => {
	const { service, entry } = fixture();
	await service.hydrate();
	assert.equal(restoreHorizontalRealizationChangeReceipt({ spotObject: service.getState().objects.A1, elementId: "ARC" }), null);
	await service.storeHorizontalReceipt({ objectId: "A1", entry });
	for (const corrupt of [
		(o) => { o.id = "OTHER"; },
		(o) => { o.data.alignmentData.meta.modifiedAt = "r3"; },
		(o) => { o.data.alignmentData.sparseAlignment.elements[1].arcLength = 21; },
		(o) => { o.data.extended.horizontalRealizationReceipts[0].version = 2; },
		(o) => { o.data.extended.horizontalRealizationReceipts[0].receipt.changes[0].fields[0].after = .5; },
		(o) => { o.data.extended.horizontalRealizationReceipts[0].receipt.diagnostics.evidence.admissible = true; },
		(o) => { o.data.extended.horizontalRealizationReceipts[0].receipt.diagnostics.status = "admitted"; },
		(o) => { o.data.extended.horizontalRealizationReceipts = [null, {}]; },
	]) {
		const object = service.getState().objects.A1;
		corrupt(object);
		assert.equal(restoreHorizontalRealizationChangeReceipt({ spotObject: object, elementId: "ARC" }), null);
	}
});

test("writer rejects stale revision, exact geometry mismatch, missing object, or admissible evidence", async () => {
	const { service, entry } = fixture();
	await service.hydrate();
	const before = service.getState();
	for (const corrupt of [
		(e) => { e.receipt.objectId = "OTHER"; },
		(e) => { e.receipt.revision = "r1"; },
		(e) => { e.receipt.elementId = "MISSING"; },
		(e) => { e.afterSparseAlignment.elements[1].arcLength = 21; },
		(e) => { e.receipt.diagnostics.evidence.admissible = true; },
	]) {
		const invalid = structuredClone(entry);
		corrupt(invalid);
		await assert.rejects(service.storeHorizontalReceipt({ objectId: "A1", entry: invalid }), /stale or invalid/);
		assert.deepEqual(service.getState(), before);
	}
	await service.removeObject({ objectId: "A1" });
	await assert.rejects(service.storeHorizontalReceipt({ objectId: "A1", entry }), /stale or invalid/);
	assert.deepEqual(service.getState().objects, {});
});

test("failed evidence write preserves already committed geometry, and cannot claim durable evidence without storage", async () => {
	const { service, entry, fail } = fixture();
	await service.hydrate();
	const before = service.getState();
	fail();
	await assert.rejects(service.storeHorizontalReceipt({ objectId: "A1", entry }), /disk failed/);
	assert.deepEqual(service.getState(), before);
	const memoryOnly = createSpotService({ spotStore: createSpotStore(before) });
	await assert.rejects(memoryOnly.storeHorizontalReceipt({ objectId: "A1", entry }), /durable storage unavailable/);
});

test("archive retains old evidence across edits, rejects conflicts, and avoids duplicate receipts", async () => {
	const { service, entry } = fixture();
	await service.storeHorizontalReceipt({ objectId: "A1", entry });
	await service.storeHorizontalReceipt({ objectId: "A1", entry });
	assert.equal(service.getState().objects.A1.data.extended.horizontalRealizationReceipts.length, 1);
	const conflict = structuredClone(entry);
	conflict.receipt.diagnostics.evidence.diagnostics.iterations = 999;
	await assert.rejects(service.storeHorizontalReceipt({ objectId: "A1", entry: conflict }), /conflicting evidence/);
	await service.renameObject({ objectId: "A1", name: "Renamed" });
	assert.ok(restoreHorizontalRealizationChangeReceipt({ spotObject: service.getState().objects.A1, elementId: "ARC" }));
	const edited = service.getState().objects.A1;
	edited.data.alignmentData.meta.modifiedAt = "r3";
	edited.data.alignmentData.sparseAlignment.elements[0].curvature = .03;
	await service.addObjects({ objects: [edited] });
	assert.equal(restoreHorizontalRealizationChangeReceipt({ spotObject: service.getState().objects.A1, elementId: "ARC" }), null);
	assert.deepEqual(service.getState().objects.A1.data.extended.horizontalRealizationReceipts, [entry]);
});

test("pending receipt rollback cannot erase a concurrently queued rename", async () => {
	const { object, entry } = fixture();
	let release;
	const gate = new Promise((resolve) => { release = resolve; });
	let started;
	const writing = new Promise((resolve) => { started = resolve; });
	let count = 0;
	const service = createSpotService({ spotStore: createSpotStore(), persistence: {
		async load() { return { objects: { A1: object } }; },
		async save() { if (++count === 1) { started(); await gate; throw new Error("receipt write failed"); } },
	} });
	const save = service.storeHorizontalReceipt({ objectId: "A1", entry });
	await writing;
	const rename = service.renameObject({ objectId: "A1", name: "Other tab" });
	release();
	await assert.rejects(save, /receipt write failed/);
	await rename;
	assert.equal(service.getState().objects.A1.data.alignmentData.name, "Other tab");
	assert.equal(service.getState().objects.A1.data.extended.horizontalRealizationReceipts, undefined);
	assert.equal(service.getState().objects.A1.data.alignmentData.sparseAlignment.elements[0].curvature, .02);
});
