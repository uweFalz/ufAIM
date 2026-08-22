import assert from "node:assert/strict";
import test from "node:test";
import {
	appendVerticalElement, createVerticalConstructiveState, evaluateVerticalAt,
} from "../../../src/aim-core/alignment/profile/VerticalConstructiveState.js";
import { createTerminalParabolicVerticalCompositeEditController } from "../../../app/controllers/alignment-profile/createTerminalParabolicVerticalCompositeEditController.js";

let vertical = appendVerticalElement(createVerticalConstructiveState({ id: "VS1", alignmentId: "A1" }), {
	id: "V1", type: "constant-gradient", startS: 0, endS: 50,
	startElevation: 10, gradient: 0.01, prefixExtension: "kept",
});
vertical = appendVerticalElement(vertical, {
	id: "V2", type: "parabolic", startS: 50, endS: 120,
	startElevation: 10.5, startGradient: 0.01, gradientRate: 0.0004,
	terminalExtension: { retained: true },
});
vertical = Object.freeze({ ...vertical, stateExtension: { retained: true } });
const cant = { alignmentId: "A1", id: "CANT1" };
const chainageMappings = [{ alignmentId: "A1", id: "CH1" }];
const profileExtension = { retained: true };
const profileState = { vertical, cant, chainageMappings, profileExtension };
const projection = (revision, s) => ({ alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s } });

function harness({ stale = false, mismatch = false, failure = null } = {}) {
	let writes = 0;
	const controller = createTerminalParabolicVerticalCompositeEditController({
		alignmentProfileApplicationService: { async saveProfileState({ profileState: next }) {
			writes += 1;
			if (failure) throw failure;
			return { presence: "present", revision: 2,
				vertical: mismatch ? profileState.vertical : next.vertical,
				cant: next.cant, chainageMappings: next.chainageMappings };
		} },
		projectionController: { async projectAt({ revision, s }) { return projection(stale ? 99 : revision, s); } },
	});
	return { controller, writes: () => writes };
}

const request = { alignmentId: "A1", revision: 1, s: 75, profileState, elementId: "V2", gradientRate: "0.0002", endS: "150" };

test("atomically changes only terminal V2 gradientRate and endS", async () => {
	const current = harness();
	const result = await current.controller.update(request);
	assert.equal(current.writes(), 1);
	assert.strictEqual(result.profileState.cant, cant);
	assert.strictEqual(result.profileState.chainageMappings, chainageMappings);
	assert.strictEqual(result.profileState.profileExtension, profileExtension);
	assert.strictEqual(result.vertical.stateExtension, vertical.stateExtension);
	assert.deepEqual(result.vertical.elements[0], vertical.elements[0]);
	assert.deepEqual(result.vertical.elements[1], { ...vertical.elements[1], gradientRate: 0.0002, endS: 150 });
	assert.deepEqual(evaluateVerticalAt(result.vertical, { s: 75 }), { elementId: "V2", s: 75, elevation: 10.8125, gradient: 0.015 });
	assert.deepEqual(evaluateVerticalAt(result.vertical, { s: 120 }), { elementId: "V2", s: 120, elevation: 11.69, gradient: 0.024 });
	assert.deepEqual(evaluateVerticalAt(result.vertical, { s: 150 }), { elementId: "V2", s: 150, elevation: 12.5, gradient: 0.03 });
});

test("canonical start interior end validation is independent of active cursor", async () => {
	const current = harness();
	const result = await current.controller.update({ ...request, s: 0 });
	assert.equal(current.writes(), 1);
	assert.deepEqual(result.evaluation.start, { elementId: "V2", s: 50, elevation: 10.5, gradient: 0.01 });
	assert.deepEqual(result.evaluation.interior, { elementId: "V2", s: 100, elevation: 11.25, gradient: 0.02 });
	assert.deepEqual(result.evaluation.end, { elementId: "V2", s: 150, elevation: 12.5, gradient: 0.03 });
});

test("invalid no-op wrong type nonterminal duplicate and stale targets are zero-write", async () => {
	for (const changes of [
		{ elementId: "" }, { gradientRate: "" }, { gradientRate: " " }, { gradientRate: "bad" },
		{ gradientRate: Infinity }, { endS: "" }, { endS: " " }, { endS: "bad" }, { endS: Infinity },
		{ endS: 50 }, { endS: "0" }, { gradientRate: 0.0004, endS: 120 },
		{ elementId: "V1" }, { elementId: "missing" },
	]) {
		const current = harness();
		await assert.rejects(current.controller.update({ ...request, ...changes }));
		assert.equal(current.writes(), 0);
	}
	const zeroRate = await harness().controller.update({ ...request, gradientRate: "0" });
	assert.equal(zeroRate.vertical.elements.at(-1).gradientRate, 0);
	const duplicateVertical = Object.freeze({ ...vertical, elements: [...vertical.elements, vertical.elements[1]] });
	const duplicate = harness();
	await assert.rejects(duplicate.controller.update({ ...request, profileState: { ...profileState, vertical: duplicateVertical } }), { code: "VERTICAL_PROFILE_ELEMENT_IDENTITY_MISMATCH" });
	assert.equal(duplicate.writes(), 0);
	let nonterminal = appendVerticalElement(createVerticalConstructiveState({ id: "VS2", alignmentId: "A1" }), vertical.elements[0]);
	nonterminal = appendVerticalElement(nonterminal, { ...vertical.elements[1], endS: 100 });
	nonterminal = appendVerticalElement(nonterminal, { id: "V3", type: "parabolic", startS: 100, endS: 120, startElevation: 11.5, startGradient: 0.03, gradientRate: 0 });
	const nonterminalHarness = harness();
	await assert.rejects(nonterminalHarness.controller.update({ ...request, profileState: { ...profileState, vertical: nonterminal }, elementId: "V2" }), { code: "VERTICAL_PROFILE_ELEMENT_NOT_TERMINAL" });
	assert.equal(nonterminalHarness.writes(), 0);
	const stale = harness({ stale: true });
	await assert.rejects(stale.controller.update(request), { code: "PROFILE_READBACK_MISMATCH" });
	assert.equal(stale.writes(), 0);
});

test("save and readback failures never report success", async () => {
	const mismatch = harness({ mismatch: true });
	await assert.rejects(mismatch.controller.update(request), { code: "PROFILE_READBACK_MISMATCH" });
	assert.equal(mismatch.writes(), 1);
	const failure = harness({ failure: new Error("offline") });
	await assert.rejects(failure.controller.update(request), { code: "VERTICAL_PROFILE_COMPOSITE_SAVE_FAILED" });
	assert.equal(failure.writes(), 1);
});
