import assert from "node:assert/strict";
import test from "node:test";
import { createSpotStore } from "../../../src/model/spot/model/SpotStore.js";
import { createSpotService } from "../../../src/shared/messaging/service/SpotService.js";
import {
	buildHorizontalRealizationChangeReceipt,
	restoreHorizontalRealizationChangeReceipt,
} from "../../../app/domain/workspace/buildHorizontalRealizationChangeReceipt.js";

function legacyFixture() {
	const before = { id: "A1", sparseAlignment: { elements: [
		{ id: "ARC", curvature: .01, arcLength: 100, sStart: 0, sEnd: 100 },
	] } };
	const after = structuredClone(before);
	after.meta = { modifiedAt: "r2" };
	after.sparseAlignment.elements[0].curvature = .02;
	const evidence = {
		type: "axtran2-consequence-evidence", status: "evidence-only", admissible: false,
		version: "alignment-axtran-evidence/0.3", fitMode: "keep-plan", planSigma: .05,
		diagnostics: { iterations: 0 }, undetermined: [],
	};
	// Literal shape verified against the builder at 0d4ee77: this historical
	// receipt has no holdSentence. Do not derive it from today's builder.
	const receipt = {
		status: "verified", objectId: "A1", elementId: "ARC", revision: "r2",
		changes: [{ elementId: "ARC", target: true, fields: [{ field: "curvature", before: .01, after: .02 }] }],
		diagnostics: {
			status: "evidence-only",
			message: "AXTRAN2 consequence evidence · evidence-only · not an admissible engineering answer.",
			fitMode: "keep-plan",
			sentence: "Fit hielt den bearbeiteten Plan (σ 5 %), wo die Proben gleichgültig waren; jede Länge von den Proben bestimmt.",
			evidence,
		},
	};
	const entry = { version: 1, receipt, beforeSparseAlignment: structuredClone(before.sparseAlignment), afterSparseAlignment: structuredClone(after.sparseAlignment) };
	const object = {
		id: "A1", type: "alignment", data: { alignmentData: after, extended: { horizontalRealizationReceipts: [entry] } },
		meta: { modifiedAt: "r2" },
	};
	const change = { objectId: "A1", elementId: "ARC", revision: "r2", alignmentData: after, spotObject: object };
	return { before, after, evidence, receipt, entry, object, change };
}

const restore = (object) => restoreHorizontalRealizationChangeReceipt({ spotObject: object, elementId: "ARC" });
const currentReceipt = (f, evidence = f.evidence) => buildHorizontalRealizationChangeReceipt({
	beforeAlignmentData: f.before, alignmentChange: f.change,
	activeObjectId: "A1", activeElementId: "ARC", axtranEvidence: evidence,
});

test("a literal 0d4 receipt missing only a null hold sentence restores as a current read-only projection", () => {
	const f = legacyFixture();
	const before = structuredClone(f.object), bytes = JSON.stringify(f.object);
	assert.equal(Object.hasOwn(f.receipt.diagnostics, "holdSentence"), false);
	const actual = restore(f.object);
	assert.deepEqual(actual, currentReceipt(f));
	assert.equal(actual.diagnostics.holdSentence, null);
	assert.equal(Object.isFrozen(actual), true);
	assert.notStrictEqual(actual, f.receipt);
	assert.deepEqual(f.object, before);
	assert.equal(JSON.stringify(f.object), bytes);
	assert.equal(Object.hasOwn(f.receipt.diagnostics, "holdSentence"), false, "no archive rewrite or migration");
});

test("an explicit current null hold sentence still follows the existing exact-match path", () => {
	const f = legacyFixture();
	f.entry.receipt = currentReceipt(f);
	assert.deepEqual(restore(f.object), f.entry.receipt);
});

for (const [label, corrupt] of [
	["explicit undefined holdSentence", (f) => { f.receipt.diagnostics.holdSentence = undefined; }],
	["explicit false holdSentence", (f) => { f.receipt.diagnostics.holdSentence = false; }],
	["invented holdSentence", (f) => { f.receipt.diagnostics.holdSentence = "held"; }],
	["wrong object identity", (f) => { f.object.id = "OTHER"; }],
	["wrong alignment identity", (f) => { f.after.id = "OTHER"; }],
	["wrong receipt identity", (f) => { f.receipt.objectId = "OTHER"; }],
	["wrong element identity", (f) => { f.receipt.elementId = "MISSING"; }],
	["stale receipt revision", (f) => { f.receipt.revision = "r1"; }],
	["new alignment revision", (f) => { f.after.meta.modifiedAt = "r3"; }],
	["changed current geometry", (f) => { f.after.sparseAlignment.elements[0].curvature = .03; }],
	["changed archived after geometry", (f) => { f.entry.afterSparseAlignment.elements[0].arcLength = 101; }],
	["changed archived before geometry", (f) => { f.entry.beforeSparseAlignment.elements[0].curvature = .005; }],
	["forged observed change", (f) => { f.receipt.changes[0].fields[0].after = .05; }],
	["unsupported archive version", (f) => { f.entry.version = 2; }],
	["admissible evidence", (f) => { f.evidence.admissible = true; }],
	["wrong evidence status", (f) => { f.evidence.status = "admitted"; }],
	["wrong evidence type", (f) => { f.evidence.type = "other"; }],
	["missing evidence", (f) => { delete f.receipt.diagnostics.evidence; }],
	["missing fit sentence", (f) => { delete f.receipt.diagnostics.sentence; }],
	["missing fit mode", (f) => { delete f.receipt.diagnostics.fitMode; }],
	["additional diagnostic field", (f) => { f.receipt.diagnostics.unexpected = null; }],
	["additional receipt field", (f) => { f.receipt.unexpected = null; }],
	["wrong diagnostic message", (f) => { f.receipt.diagnostics.message = "approved"; }],
	["array diagnostics with named fields", (f) => { f.receipt.diagnostics = Object.assign([], f.receipt.diagnostics); }],
]) {
	test(`legacy compatibility still rejects ${label}`, () => {
		const f = legacyFixture();
		corrupt(f);
		const before = structuredClone(f.object);
		assert.equal(restore(f.object), null);
		assert.deepEqual(f.object, before);
	});
}

for (const [label, declaration] of [
	["held pose", { heldPoses: [{ afterElement: "ARC", theta: 0 }], diagnostics: { iterations: 0, heldPoseResiduals: [{ afterElement: "ARC", component: "theta", residual: 0 }] } }],
	["held element", { heldElements: ["ARC"] }],
	["catalogue turnout", { turnout: { elementId: "ARC", designation: "EW 60-500-1:12", side: "right" } }],
]) {
	test(`current ${label} retains its sentence and cannot use the null-only compatibility path`, () => {
		const f = legacyFixture();
		const receipt = currentReceipt(f, { ...f.evidence, ...declaration });
		assert.equal(typeof receipt.diagnostics.holdSentence, "string");
		f.entry.receipt = structuredClone(receipt);
		assert.deepEqual(restore(f.object), receipt);
		delete f.entry.receipt.diagnostics.holdSentence;
		assert.equal(restore(f.object), null);
		f.entry.receipt.diagnostics.holdSentence = null;
		assert.equal(restore(f.object), null);
	});
}

test("diagnostics without evidence are not upgraded or fabricated", () => {
	const f = legacyFixture();
	const receipt = currentReceipt(f, null);
	f.entry.receipt = receipt;
	assert.deepEqual(restore(f.object), receipt);
	assert.equal(Object.hasOwn(receipt.diagnostics, "holdSentence"), false);
});

test("fresh canonical hydration reads a legacy receipt without rewriting storage or archive", async () => {
	const f = legacyFixture();
	const disk = { objects: { A1: structuredClone(f.object) } };
	const snapshot = structuredClone(disk);
	let loads = 0, writes = 0;
	const service = createSpotService({ spotStore: createSpotStore(), persistence: {
		async load() { loads += 1; return structuredClone(disk); },
		async save() { writes += 1; throw new Error("readback must not write"); },
	} });
	await service.hydrate();
	const object = service.getState().objects.A1;
	const prior = structuredClone(object);
	assert.deepEqual(restore(object), currentReceipt(f));
	assert.equal(loads, 1);
	assert.equal(writes, 0);
	assert.deepEqual(disk, snapshot);
	assert.deepEqual(service.getState().objects.A1, prior);
	assert.deepEqual(object.data.extended.horizontalRealizationReceipts, [f.entry]);
});
