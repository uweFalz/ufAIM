import assert from "node:assert/strict";
import test from "node:test";
import { appendCantElement, createCantConstructiveState, evaluateCantAt } from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";
import { createTerminalCantElementRemoveController } from "../../../app/controllers/alignment-profile/createTerminalCantElementRemoveController.js";

let cant = appendCantElement(createCantConstructiveState({ id: "CANT1", alignmentId: "A1" }), { id: "C1", type: "constant-cross-level", startS: 0, endS: 50, startCrossLevel: 0.05, prefixExtension: "kept" });
cant = appendCantElement(cant, { id: "C2", type: "linear-cross-level", startS: 50, endS: 100, startCrossLevel: 0.05, crossLevelRate: 0.002, terminalExtension: true });
cant = Object.freeze({ ...cant, referenceEvidence: { scalarCrossLevelStatus: "partial-evidence", workingReference: "midpointGoverningRailEdges", pairedRails: "unknown", sourceReference: "unknown", transformation: "not-performed" } });
const vertical = { alignmentId: "A1", id: "V1" }, mapping = { alignmentId: "A1", id: "CH1" }, profileExtension = { kept: true };
const profileState = { vertical, cant, chainageMappings: [mapping], profileExtension };
const projection = (revision, s) => ({ alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s }, cant: { status: s > 50 ? "not-covered" : "evaluated" } });

function harness({ stale = false, mismatch = false, failure = null } = {}) {
	let writes = 0;
	const controller = createTerminalCantElementRemoveController({
		alignmentProfileApplicationService: { async saveProfileState({ profileState: next }) { writes += 1; if (failure) throw failure; return { presence: "present", revision: 2, vertical: next.vertical, cant: mismatch ? profileState.cant : next.cant, chainageMappings: next.chainageMappings }; } },
		projectionController: { async projectAt({ revision, s }) { return projection(stale ? 99 : revision, s); } },
	});
	return { controller, writes: () => writes };
}

const request = { alignmentId: "A1", revision: 1, s: 75, profileState, elementId: "C2" };

test("removes only terminal C2 and canonically retains C1", async () => {
	const h = harness(), result = await h.controller.remove(request);
	assert.equal(h.writes(), 1);
	assert.strictEqual(result.profileState.vertical, vertical);
	assert.strictEqual(result.profileState.chainageMappings, profileState.chainageMappings);
	assert.strictEqual(result.profileState.profileExtension, profileExtension);
	assert.strictEqual(result.cant.referenceEvidence, cant.referenceEvidence);
	assert.deepEqual(result.cant.elements, [cant.elements[0]]);
	assert.deepEqual(result.cant.elements[0], cant.elements[0]);
	assert.deepEqual(result.validation, { elementId: "C1", s: 50, crossLevel: 0.05, twist: 0, quantity: "cross-level", unit: "alignment-length-unit", signConvention: "left-minus-right-viewed-in-increasing-s" });
	assert.equal(result.cursorEvaluation, null);
	assert.deepEqual(evaluateCantAt(result.cant, { s: 25 }), { elementId: "C1", s: 25, crossLevel: 0.05, twist: 0, quantity: "cross-level", unit: "alignment-length-unit", signConvention: "left-minus-right-viewed-in-increasing-s" });
	assert.throws(() => evaluateCantAt(result.cant, { s: 75 }), { code: "POSITION_OUTSIDE_DOMAIN" });
});

test("wrong missing duplicate nonterminal sole and stale targets are zero-write", async () => {
	for (const changes of [{ elementId: "" }, { elementId: "missing" }, { elementId: "C1" }]) {
		const h = harness(); await assert.rejects(h.controller.remove({ ...request, ...changes })); assert.equal(h.writes(), 0);
	}
	const duplicateCant = Object.freeze({ ...cant, elements: Object.freeze([...cant.elements, cant.elements[1]]) });
	const duplicate = harness(); await assert.rejects(duplicate.controller.remove({ ...request, profileState: { ...profileState, cant: duplicateCant } }), { code: "CANT_ELEMENT_IDENTITY_MISMATCH" }); assert.equal(duplicate.writes(), 0);
	const soleCant = Object.freeze({ ...cant, elements: Object.freeze([cant.elements[1]]) });
	const sole = harness(); await assert.rejects(sole.controller.remove({ ...request, profileState: { ...profileState, cant: soleCant } }), { code: "CANT_ELEMENT_REMOVE_WOULD_EMPTY_STATE" }); assert.equal(sole.writes(), 0);
	const stale = harness({ stale: true }); await assert.rejects(stale.controller.remove(request), { code: "PROFILE_READBACK_MISMATCH" }); assert.equal(stale.writes(), 0);
});

test("save and readback failures never report removal", async () => {
	const mismatch = harness({ mismatch: true }); await assert.rejects(mismatch.controller.remove(request), { code: "PROFILE_READBACK_MISMATCH" }); assert.equal(mismatch.writes(), 1);
	const failure = harness({ failure: new Error("offline") }); await assert.rejects(failure.controller.remove(request), { code: "TERMINAL_CANT_REMOVE_SAVE_FAILED" }); assert.equal(failure.writes(), 1);
});
