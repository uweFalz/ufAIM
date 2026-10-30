import assert from "node:assert/strict";
import test from "node:test";
import { createSpotStore } from "../../../src/model/spot/model/SpotStore.js";
import { createSpotService } from "../../../src/shared/messaging/service/SpotService.js";
import {
	buildHorizontalRealizationChangeReceipt,
	archiveHorizontalRealizationChangeReceipt,
	restoreHorizontalRealizationChangeReceipt,
} from "../../../app/domain/workspace/buildHorizontalRealizationChangeReceipt.js";

// The existing App builder and real store/service define the contract. Only
// the storage device is injected; no solver result or geometry is fabricated
// as evidence of an admissible engineering answer.
function fixture() {
	const before = { id: "A1", sparseAlignment: { elements: [
		{ id: "ARC", curvature: .01, arcLength: 100, sStart: 0, sEnd: 100 },
		{ id: "NEXT", curvature: 0, arcLength: 20, sStart: 100, sEnd: 120 },
	] } };
	const after = structuredClone(before);
	after.meta = { modifiedAt: "r2" };
	after.sparseAlignment.elements[0].curvature = .02;
	const object = {
		id: "A1", type: "alignment", data: {
			alignmentData: after,
			kernel: { preserve: true },
			extended: { other: { preserve: true } },
		},
		refs: { source: "synthetic-contract-fixture-080" },
		meta: { modifiedAt: "r2" },
	};
	const change = { objectId: "A1", elementId: "ARC", revision: "r2", alignmentData: after, spotObject: object };
	const receipt = buildHorizontalRealizationChangeReceipt({
		beforeAlignmentData: before, alignmentChange: change,
		activeObjectId: "A1", activeElementId: "ARC",
		axtranRefusal: { code: "OVER_CONSTRAINED", message: "6 equalities against 4 unknowns" },
	});
	const entry = archiveHorizontalRealizationChangeReceipt({ receipt, beforeAlignmentData: before, alignmentChange: change });
	let disk = { objects: { A1: object } };
	let writes = 0;
	let failSave = false;
	const persistence = {
		async load() { return structuredClone(disk); },
		async save(state) {
			writes += 1;
			if (failSave) throw new Error("refusal write failed");
			disk = structuredClone(state);
		},
	};
	const service = createSpotService({ spotStore: createSpotStore(), persistence });
	return {
		service, persistence, object, entry, receipt,
		writes: () => writes, readDisk: () => structuredClone(disk),
		fail: () => { failSave = true; },
	};
}

test("existing refused receipt persists and restores from a fresh service/store without changing geometry", async () => {
	const { service, persistence, entry, receipt, writes } = fixture();
	assert.equal(receipt.diagnostics.status, "refused");
	assert.deepEqual(receipt.diagnostics.refusal, { code: "OVER_CONSTRAINED", message: "6 equalities against 4 unknowns" });
	assert.equal(Object.hasOwn(receipt.diagnostics, "evidence"), false);
	assert.equal(Object.hasOwn(receipt.diagnostics, "admissible"), false);
	await service.hydrate();
	const beforeObject = service.getState().objects.A1;
	const result = await service.storeHorizontalReceipt({ objectId: "A1", entry });
	assert.equal(result.ok, true);
	assert.equal(writes(), 1);
	const reopened = createSpotService({ spotStore: createSpotStore(), persistence });
	await reopened.hydrate();
	const object = reopened.getState().objects.A1;
	assert.deepEqual(restoreHorizontalRealizationChangeReceipt({ spotObject: object, elementId: "ARC" }), receipt);
	assert.equal(restoreHorizontalRealizationChangeReceipt({ spotObject: object, elementId: "NEXT" }), null);
	assert.deepEqual(object.data.extended.horizontalRealizationReceipts, [entry]);
	assert.deepEqual(object.data.alignmentData, beforeObject.data.alignmentData);
	assert.deepEqual(object.data.kernel, beforeObject.data.kernel);
	assert.deepEqual(object.data.extended.other, beforeObject.data.extended.other);
	assert.deepEqual(object.refs, beforeObject.refs);
	assert.deepEqual(object.meta, beforeObject.meta);
});

test("malformed, empty, untyped and mixed refusal declarations fail before storage", async (t) => {
	const cases = [
		["null entry", () => null],
		["null receipt", (entry) => { entry.receipt = null; }],
		["array receipt", (entry) => { entry.receipt = Object.assign([], entry.receipt); }],
		["null diagnostics", (entry) => { entry.receipt.diagnostics = null; }],
		["array diagnostics", (entry) => { entry.receipt.diagnostics = Object.assign([], entry.receipt.diagnostics); }],
		["unknown status", (entry) => { entry.receipt.diagnostics.status = "failed-declared"; }],
		["missing refusal", (entry) => { delete entry.receipt.diagnostics.refusal; }],
		["null refusal", (entry) => { entry.receipt.diagnostics.refusal = null; }],
		["string refusal", (entry) => { entry.receipt.diagnostics.refusal = "refused"; }],
		["array refusal", (entry) => { entry.receipt.diagnostics.refusal = []; }],
	];
	for (const field of ["code", "message"]) {
		for (const [name, value] of [["undefined", undefined], ["null", null], ["number", 42], ["boolean", false], ["object", {}], ["array", ["value"]], ["empty", ""], ["whitespace", " \t\n"]]) {
			cases.push([`${field} ${name}`, (entry) => { entry.receipt.diagnostics.refusal[field] = value; }]);
		}
	}
	for (const [name, value] of [["missing", undefined], ["null", null], ["number", 42], ["empty", ""], ["whitespace", " \t"]]) {
		cases.push([`diagnostic message ${name}`, (entry) => { entry.receipt.diagnostics.message = value; }]);
	}
	for (const location of ["receipt", "diagnostics", "refusal"]) {
		for (const [field, value] of [
			["evidence", null], ["evidence", undefined],
			["evidence", { type: "axtran2-consequence-evidence", status: "evidence-only", admissible: false }],
			["admissible", true], ["admissible", false], ["admissible", null],
		]) {
			cases.push([`${location} mixed ${field} ${JSON.stringify(value)}`, (entry) => {
				const record = location === "receipt" ? entry.receipt : location === "diagnostics" ? entry.receipt.diagnostics : entry.receipt.diagnostics.refusal;
				record[field] = value;
			}]);
		}
	}
	for (const [name, corrupt] of cases) {
		await t.test(name, async () => {
			const { service, entry, writes, readDisk } = fixture();
			await service.hydrate();
			const before = service.getState();
			const diskBefore = readDisk();
			const candidate = structuredClone(entry);
			const corrupted = corrupt(candidate);
			await assert.rejects(service.storeHorizontalReceipt({ objectId: "A1", entry: corrupted === null ? null : candidate }), /stale or invalid evidence context/);
			assert.equal(writes(), 0);
			assert.deepEqual(service.getState(), before);
			assert.deepEqual(readDisk(), diskBefore);
		});
	}
});

test("refused receipts preserve the exact version, identity, revision and geometry guards", async (t) => {
	for (const [name, corrupt] of [
		["archive version", (entry) => { entry.version = 2; }],
		["unverified receipt", (entry) => { entry.receipt.status = "unverified"; }],
		["wrong object", (entry) => { entry.receipt.objectId = "OTHER"; }],
		["stale revision", (entry) => { entry.receipt.revision = "r1"; }],
		["null revision", (entry) => { entry.receipt.revision = null; }],
		["missing element", (entry) => { entry.receipt.elementId = "MISSING"; }],
		["missing before geometry", (entry) => { entry.beforeSparseAlignment = null; }],
		["mismatched after geometry", (entry) => { entry.afterSparseAlignment.elements[1].arcLength = 21; }],
		["no target change", (entry) => { entry.receipt.changes[0].target = false; }],
		["empty target fields", (entry) => { entry.receipt.changes[0].fields = []; }],
	]) {
		await t.test(name, async () => {
			const { service, entry, writes } = fixture();
			await service.hydrate();
			const before = service.getState();
			const candidate = structuredClone(entry);
			corrupt(candidate);
			await assert.rejects(service.storeHorizontalReceipt({ objectId: "A1", entry: candidate }), /stale or invalid evidence context/);
			assert.deepEqual(service.getState(), before);
			assert.equal(writes(), 0);
		});
	}
	const { service, entry, writes } = fixture();
	await service.removeObject({ objectId: "A1" });
	const writesBefore = writes();
	await assert.rejects(service.storeHorizontalReceipt({ objectId: "A1", entry }), /stale or invalid evidence context/);
	assert.deepEqual(service.getState().objects, {});
	assert.equal(writes(), writesBefore);
});

test("refused receipt duplicate is idempotent, conflicting refusal is rejected and later edits make restore stale", async () => {
	const { service, entry, receipt, writes, readDisk } = fixture();
	await service.storeHorizontalReceipt({ objectId: "A1", entry });
	await service.storeHorizontalReceipt({ objectId: "A1", entry });
	assert.deepEqual(service.getState().objects.A1.data.extended.horizontalRealizationReceipts, [entry]);
	const conflict = structuredClone(entry);
	conflict.receipt.diagnostics.refusal.message = "different refusal for the same revision";
	conflict.receipt.diagnostics.message = "AXTRAN2 hat die Deklaration verweigert: different refusal for the same revision";
	const before = service.getState(), diskBefore = readDisk(), writesBefore = writes();
	await assert.rejects(service.storeHorizontalReceipt({ objectId: "A1", entry: conflict }), /conflicting evidence for revision/);
	assert.deepEqual(service.getState(), before);
	assert.deepEqual(readDisk(), diskBefore);
	assert.equal(writes(), writesBefore);
	await service.renameObject({ objectId: "A1", name: "Renamed" });
	assert.deepEqual(restoreHorizontalRealizationChangeReceipt({ spotObject: service.getState().objects.A1, elementId: "ARC" }), receipt);
	const edited = service.getState().objects.A1;
	edited.data.alignmentData.meta.modifiedAt = "r3";
	edited.data.alignmentData.sparseAlignment.elements[0].curvature = .03;
	await service.addObjects({ objects: [edited] });
	const current = service.getState().objects.A1;
	assert.deepEqual(current.data.extended.horizontalRealizationReceipts, [entry]);
	assert.equal(restoreHorizontalRealizationChangeReceipt({ spotObject: current, elementId: "ARC" }), null);
});

test("failed refusal write rolls back only the archive and cannot claim durability without an adapter", async () => {
	const { service, entry, fail, readDisk } = fixture();
	await service.hydrate();
	const before = service.getState(), diskBefore = readDisk();
	fail();
	await assert.rejects(service.storeHorizontalReceipt({ objectId: "A1", entry }), /refusal write failed/);
	assert.deepEqual(service.getState(), before);
	assert.deepEqual(readDisk(), diskBefore);
	assert.equal(service.getState().objects.A1.data.alignmentData.sparseAlignment.elements[0].curvature, .02);
	const memoryOnly = createSpotService({ spotStore: createSpotStore(before) });
	await assert.rejects(memoryOnly.storeHorizontalReceipt({ objectId: "A1", entry }), /durable storage unavailable/);
	assert.deepEqual(memoryOnly.getState(), before);
});

test("failed pending refusal cannot erase a concurrently queued rename", async () => {
	const { object, entry } = fixture();
	let release;
	const gate = new Promise((resolve) => { release = resolve; });
	let started;
	const writing = new Promise((resolve) => { started = resolve; });
	let count = 0;
	let disk = { objects: { A1: object } };
	const persistence = {
		async load() { return structuredClone(disk); },
		async save(state) {
			if (++count === 1) { started(); await gate; throw new Error("refusal write failed"); }
			disk = structuredClone(state);
		},
	};
	const service = createSpotService({ spotStore: createSpotStore(), persistence });
	const save = service.storeHorizontalReceipt({ objectId: "A1", entry });
	await writing;
	const rename = service.renameObject({ objectId: "A1", name: "Other tab" });
	release();
	await assert.rejects(save, /refusal write failed/);
	await rename;
	const reopened = createSpotService({ spotStore: createSpotStore(), persistence });
	await reopened.hydrate();
	const current = reopened.getState().objects.A1;
	assert.equal(current.data.alignmentData.name, "Other tab");
	assert.equal(current.data.extended.horizontalRealizationReceipts, undefined);
	assert.equal(current.data.alignmentData.sparseAlignment.elements[0].curvature, .02);
});
