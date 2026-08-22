import assert from "node:assert/strict";
import test from "node:test";
import { appendCantElement, createCantConstructiveState, evaluateCantAt } from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";
import { createTerminalLinearCantDomainEditController } from "../../../app/controllers/alignment-profile/createTerminalLinearCantDomainEditController.js";

let cant = appendCantElement(createCantConstructiveState({ id: "CANT1", alignmentId: "A1" }), { id: "C1", type: "constant-cross-level", startS: 0, endS: 50, startCrossLevel: 0.04, prefixExtension: true });
cant = appendCantElement(cant, { id: "C2", type: "linear-cross-level", startS: 50, endS: 100, startCrossLevel: 0.04, crossLevelRate: 0.001, terminalExtension: { kept: true } });
cant = Object.freeze({ ...cant, referenceEvidence: { scalarCrossLevelStatus: "partial-evidence", workingReference: "midpointGoverningRailEdges", pairedRails: "unknown", sourceReference: "unknown", transformation: "not-performed" } });
const vertical = { alignmentId: "A1", id: "V1" }, mapping = { alignmentId: "A1", id: "CH1" }, profileExtension = { kept: true };
const profileState = { vertical, cant, chainageMappings: [mapping], profileExtension };
const projection = (revision, s) => ({ alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s }, cant: { status: s > 125 ? "not-covered" : "evaluated" } });
function harness({ stale = false, mismatch = false, failure = null } = {}) { let writes = 0; const controller = createTerminalLinearCantDomainEditController({ alignmentProfileApplicationService: { async saveProfileState({ profileState: next }) { writes += 1; if (failure) throw failure; return { presence: "present", revision: 2, vertical: next.vertical, cant: mismatch ? profileState.cant : next.cant, chainageMappings: next.chainageMappings }; } }, projectionController: { async projectAt({ revision, s }) { return projection(stale ? 99 : revision, s); } } }); return { controller, writes: () => writes }; }
const request = { alignmentId: "A1", revision: 1, s: 75, profileState, elementId: "C2", endS: 125 };

test("changes only terminal C2 endS and preserves canonical C1 and C2 fields", async () => {
	const h = harness(), result = await h.controller.update(request); assert.equal(h.writes(), 1); assert.strictEqual(result.profileState.vertical, vertical); assert.strictEqual(result.profileState.chainageMappings, profileState.chainageMappings); assert.strictEqual(result.profileState.profileExtension, profileExtension); assert.strictEqual(result.cant.referenceEvidence, cant.referenceEvidence);
	assert.deepEqual(result.cant.elements[0], cant.elements[0]); assert.deepEqual(result.cant.elements[1], { ...cant.elements[1], endS: 125 });
	assert.deepEqual(result.evaluation.start, { elementId: "C2", s: 50, crossLevel: 0.04, twist: 0.001, quantity: "cross-level", unit: "alignment-length-unit", signConvention: "left-minus-right-viewed-in-increasing-s" });
	assert.deepEqual(result.evaluation.interior, { elementId: "C2", s: 87.5, crossLevel: 0.0775, twist: 0.001, quantity: "cross-level", unit: "alignment-length-unit", signConvention: "left-minus-right-viewed-in-increasing-s" });
	assert.deepEqual(result.evaluation.end, { elementId: "C2", s: 125, crossLevel: 0.11499999999999999, twist: 0.001, quantity: "cross-level", unit: "alignment-length-unit", signConvention: "left-minus-right-viewed-in-increasing-s" });
	for (const [s, crossLevel] of [[50, 0.04], [75, 0.065], [100, 0.09], [125, 0.11499999999999999]]) assert.deepEqual(evaluateCantAt(result.cant, { s }), { elementId: "C2", s, crossLevel, twist: 0.001, quantity: "cross-level", unit: "alignment-length-unit", signConvention: "left-minus-right-viewed-in-increasing-s" });
	assert.throws(() => evaluateCantAt(result.cant, { s: 150 }), { code: "POSITION_OUTSIDE_DOMAIN" });
});

test("invalid no-op wrong type nonterminal duplicate and stale targets are zero-write", async () => {
	for (const changes of [{ elementId: "" }, { endS: "" }, { endS: " " }, { endS: "bad" }, { endS: Infinity }, { endS: 100 }, { endS: 50 }, { endS: 0 }, { endS: "0" }, { elementId: "missing" }]) { const h = harness(); await assert.rejects(h.controller.update({ ...request, ...changes })); assert.equal(h.writes(), 0); }
	const wrong = harness(); await assert.rejects(wrong.controller.update({ ...request, elementId: "C1" }), { code: "CANT_ELEMENT_NOT_LINEAR" }); assert.equal(wrong.writes(), 0);
	let three = appendCantElement(cant, { id: "C3", type: "linear-cross-level", startS: 100, endS: 120, startCrossLevel: 0.09, crossLevelRate: 0.001 }); const nonterminal = harness(); await assert.rejects(nonterminal.controller.update({ ...request, profileState: { ...profileState, cant: three } }), { code: "CANT_ELEMENT_NOT_TERMINAL" }); assert.equal(nonterminal.writes(), 0);
	const duplicateCant = Object.freeze({ ...cant, elements: Object.freeze([...cant.elements, cant.elements[1]]) }); const duplicate = harness(); await assert.rejects(duplicate.controller.update({ ...request, profileState: { ...profileState, cant: duplicateCant } }), { code: "CANT_ELEMENT_IDENTITY_MISMATCH" }); assert.equal(duplicate.writes(), 0);
	const stale = harness({ stale: true }); await assert.rejects(stale.controller.update(request), { code: "PROFILE_READBACK_MISMATCH" }); assert.equal(stale.writes(), 0);
});

test("save and readback failures never report success", async () => { const mismatch = harness({ mismatch: true }); await assert.rejects(mismatch.controller.update(request), { code: "PROFILE_READBACK_MISMATCH" }); assert.equal(mismatch.writes(), 1); const failure = harness({ failure: new Error("offline") }); await assert.rejects(failure.controller.update(request), { code: "TERMINAL_LINEAR_CANT_DOMAIN_SAVE_FAILED" }); assert.equal(failure.writes(), 1); });
