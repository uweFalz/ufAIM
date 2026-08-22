import assert from "node:assert/strict";
import test from "node:test";
import { appendCantElement, createCantConstructiveState, evaluateCantAt } from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";
import { createTerminalConstantCantCrossLevelEditController } from "../../../app/controllers/alignment-profile/createTerminalConstantCantCrossLevelEditController.js";

let cant = appendCantElement(createCantConstructiveState({ id: "CANT1", alignmentId: "A1" }), { id: "C1", type: "constant-cross-level", startS: 0, endS: 50, startCrossLevel: 0.05, elementExtension: { kept: true } });
cant = Object.freeze({ ...cant, referenceEvidence: { scalarCrossLevelStatus: "partial-evidence", workingReference: "midpointGoverningRailEdges", pairedRails: "unknown", sourceReference: "unknown", transformation: "not-performed" } });
const vertical = { alignmentId: "A1", id: "V1" }, mapping = { alignmentId: "A1", id: "CH1" }, profileExtension = { kept: true };
const profileState = { vertical, cant, chainageMappings: [mapping], profileExtension };
const projection = (revision, s) => ({ alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s }, cant: { status: s > 50 ? "not-covered" : "evaluated" } });

function harness({ stale = false, mismatch = false, failure = null } = {}) {
	let writes = 0;
	const controller = createTerminalConstantCantCrossLevelEditController({
		alignmentProfileApplicationService: { async saveProfileState({ profileState: next }) { writes += 1; if (failure) throw failure; return { presence: "present", revision: 2, vertical: next.vertical, cant: mismatch ? profileState.cant : next.cant, chainageMappings: next.chainageMappings }; } },
		projectionController: { async projectAt({ revision, s }) { return projection(stale ? 99 : revision, s); } },
	});
	return { controller, writes: () => writes };
}
const request = { alignmentId: "A1", revision: 1, s: 25, profileState, elementId: "C1", crossLevel: 0.04 };

test("rebuilds CANT1 and changes only exact terminal C1 crossLevel", async () => {
	const h = harness(), result = await h.controller.update(request);
	assert.equal(h.writes(), 1);
	assert.strictEqual(result.profileState.vertical, vertical);
	assert.strictEqual(result.profileState.chainageMappings, profileState.chainageMappings);
	assert.strictEqual(result.profileState.profileExtension, profileExtension);
	assert.strictEqual(result.cant.referenceEvidence, cant.referenceEvidence);
	assert.deepEqual(result.cant.elements[0], { ...cant.elements[0], startCrossLevel: 0.04 });
	for (const [position, evidence] of [[0, result.evaluation.start], [25, result.evaluation.interior], [50, result.evaluation.end]]) {
		assert.deepEqual(evidence, { elementId: "C1", s: position, crossLevel: 0.04, twist: 0, quantity: "cross-level", unit: "alignment-length-unit", signConvention: "left-minus-right-viewed-in-increasing-s" });
	}
	assert.throws(() => evaluateCantAt(result.cant, { s: 75 }), { code: "POSITION_OUTSIDE_DOMAIN" });
});

test("invalid no-op wrong type nonterminal duplicate and stale targets are zero-write", async () => {
	for (const changes of [{ elementId: "" }, { crossLevel: "" }, { crossLevel: "   " }, { crossLevel: "bad" }, { crossLevel: Infinity }, { crossLevel: 0.05 }, { elementId: "missing" }]) {
		const h = harness(); await assert.rejects(h.controller.update({ ...request, ...changes })); assert.equal(h.writes(), 0);
	}
	let linear = appendCantElement(createCantConstructiveState({ id: "CANT1", alignmentId: "A1" }), { id: "C1", type: "linear-cross-level", startS: 0, endS: 50, startCrossLevel: 0.05, crossLevelRate: 0.001 });
	const wrongType = harness(); await assert.rejects(wrongType.controller.update({ ...request, profileState: { ...profileState, cant: linear } }), { code: "CANT_ELEMENT_NOT_CONSTANT" }); assert.equal(wrongType.writes(), 0);
	let two = appendCantElement(createCantConstructiveState({ id: "CANT1", alignmentId: "A1" }), { id: "C0", type: "constant-cross-level", startS: 0, endS: 25, startCrossLevel: 0.05 });
	two = appendCantElement(two, { id: "C1", type: "constant-cross-level", startS: 25, endS: 50, startCrossLevel: 0.05 });
	const nonterminal = harness(); await assert.rejects(nonterminal.controller.update({ ...request, profileState: { ...profileState, cant: two }, elementId: "C0" }), { code: "CANT_ELEMENT_NOT_TERMINAL" }); assert.equal(nonterminal.writes(), 0);
	const duplicateCant = Object.freeze({ ...cant, elements: Object.freeze([cant.elements[0], cant.elements[0]]) });
	const duplicate = harness(); await assert.rejects(duplicate.controller.update({ ...request, profileState: { ...profileState, cant: duplicateCant } }), { code: "CANT_ELEMENT_IDENTITY_MISMATCH" }); assert.equal(duplicate.writes(), 0);
	const stale = harness({ stale: true }); await assert.rejects(stale.controller.update(request), { code: "PROFILE_READBACK_MISMATCH" }); assert.equal(stale.writes(), 0);
});

test("numeric and string zero are valid while save/readback failures remain truthful", async () => {
	for (const crossLevel of [0, "0"]) { const h = harness(); const result = await h.controller.update({ ...request, crossLevel }); assert.equal(h.writes(), 1); assert.equal(result.cant.elements[0].startCrossLevel, 0); }
	const mismatch = harness({ mismatch: true }); await assert.rejects(mismatch.controller.update(request), { code: "PROFILE_READBACK_MISMATCH" }); assert.equal(mismatch.writes(), 1);
	const failure = harness({ failure: new Error("offline") }); await assert.rejects(failure.controller.update(request), { code: "TERMINAL_CONSTANT_CANT_SAVE_FAILED" }); assert.equal(failure.writes(), 1);
});
