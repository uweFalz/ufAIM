import test from "node:test";
import assert from "node:assert/strict";
import { buildHorizontalRealizationChangeReceipt } from "../../../app/domain/workspace/buildHorizontalRealizationChangeReceipt.js";

function alignment(curvature, downstreamStart = 100) {
	return { id: "A1", sparseAlignment: { elements: [
		{ id: "ARC", curvature, arcLength: 100, sStart: 0, sEnd: 100, poseA: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } } },
		{ id: "NEXT", curvature: 0, arcLength: 20, sStart: downstreamStart, sEnd: downstreamStart + 20, poseA: { p: { x: downstreamStart, y: 4 }, t: { x: 0.9, y: 0.1 } } },
	] } };
}

test("builds a receipt only from exact persisted before/readback differences", () => {
	const receipt = buildHorizontalRealizationChangeReceipt({
		beforeAlignmentData: alignment(0.01),
		alignmentChange: { objectId: "A1", elementId: "ARC", revision: 7, alignmentData: alignment(0.02, 101), spotObject: { id: "A1" } },
		activeObjectId: "A1", activeElementId: "ARC",
	});
	assert.equal(receipt.status, "verified");
	assert.deepEqual(receipt.changes[0].fields, [{ field: "curvature", before: 0.01, after: 0.02 }]);
	assert.deepEqual(receipt.changes[1].fields.map((entry) => entry.field), ["sStart", "sEnd", "poseA"]);
	assert.equal(receipt.diagnostics.status, "not-available");
	assert.match(receipt.diagnostics.message, /AXTRAN diagnostics are not available/);
});

test("fails closed for unverifiable identity, revision, sparse identity, target, and no-op", () => {
	const valid = { objectId: "A1", elementId: "ARC", revision: 7, alignmentData: alignment(0.02), spotObject: { id: "A1" } };
	for (const change of [
		{ ...valid, revision: null },
		{ ...valid, spotObject: { id: "OTHER" } },
		{ ...valid, alignmentData: { ...alignment(0.02), id: "OTHER" } },
		{ ...valid, elementId: "MISSING" },
		{ ...valid, alignmentData: { id: "A1", sparseAlignment: { elements: [{ id: "ARC", curvature: .02 }, { id: "ARC", curvature: .03 }] } } },
	]) assert.throws(() => buildHorizontalRealizationChangeReceipt({ beforeAlignmentData: alignment(.01), alignmentChange: change, activeObjectId: "A1", activeElementId: change.elementId }));
	assert.throws(() => buildHorizontalRealizationChangeReceipt({ beforeAlignmentData: alignment(.01), alignmentChange: { ...valid, alignmentData: alignment(.01) }, activeObjectId: "A1", activeElementId: "ARC" }), /no verified/);
});
