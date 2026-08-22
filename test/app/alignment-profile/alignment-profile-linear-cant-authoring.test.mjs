import assert from "node:assert/strict";
import test from "node:test";

import {
	appendCantElement,
	createCantConstructiveState,
	evaluateCantAt,
} from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";
import { createLinearCantElementAuthoringController } from "../../../app/controllers/alignment-profile/createLinearCantElementAuthoringController.js";

const baseCant = appendCantElement(createCantConstructiveState({ id: "CANT1", alignmentId: "A1" }), {
	id: "C1", type: "constant-cross-level", startS: 0, endS: 50, startCrossLevel: 0.05,
});
const vertical = { alignmentId: "A1", id: "V" };
const mapping = { alignmentId: "A1", id: "CH1" };
const profileState = { vertical, cant: baseCant, chainageMappings: [mapping] };
const projection = (revision, s) => ({ alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s }, cant: { status: "evaluated" } });

function harness({ mismatch = false, stale = false } = {}) {
	let writes = 0;
	const controller = createLinearCantElementAuthoringController({
		alignmentProfileApplicationService: { async saveProfileState({ profileState: next }) {
			writes += 1;
			return { presence: "present", revision: 2, vertical: next.vertical, cant: mismatch ? baseCant : next.cant, chainageMappings: next.chainageMappings };
		} },
		projectionController: { async projectAt({ revision, s }) { return projection(stale ? 99 : revision, s); } },
	});
	return { controller, writes: () => writes };
}

test("appends one canonical linear element from the terminal evaluator result", async () => {
	const { controller, writes } = harness();
	const result = await controller.append({ alignmentId: "A1", revision: 1, s: 75, profileState, elementId: "C2", endS: "100", crossLevelRate: "0.001" });
	assert.equal(writes(), 1);
	assert.strictEqual(result.profileState.vertical, vertical);
	assert.strictEqual(result.profileState.chainageMappings, profileState.chainageMappings);
	assert.strictEqual(result.profileState.cant.elements[0], baseCant.elements[0]);
	assert.deepEqual(result.profileState.cant.elements[1], { id: "C2", type: "linear-cross-level", startS: 50, endS: 100, startCrossLevel: 0.05, crossLevelRate: 0.001 });
	assert.deepEqual(evaluateCantAt(result.profileState.cant, { s: 75 }), { elementId: "C2", s: 75, crossLevel: 0.07500000000000001, twist: 0.001, quantity: "cross-level", unit: "alignment-length-unit", signConvention: "left-minus-right-viewed-in-increasing-s" });
	assert.deepEqual(evaluateCantAt(result.profileState.cant, { s: 100 }), { elementId: "C2", s: 100, crossLevel: 0.1, twist: 0.001, quantity: "cross-level", unit: "alignment-length-unit", signConvention: "left-minus-right-viewed-in-increasing-s" });
});

test("invalid duplicate domain no-op and stale requests are zero-write", async () => {
	for (const changes of [
		{ elementId: "", endS: 100, crossLevelRate: 0.001 },
		{ elementId: "C2", endS: " ", crossLevelRate: 0.001 },
		{ elementId: "C2", endS: 100, crossLevelRate: "" },
		{ elementId: "C2", endS: 100, crossLevelRate: 0 },
		{ elementId: "C2", endS: 50, crossLevelRate: 0.001 },
		{ elementId: "C1", endS: 100, crossLevelRate: 0.001 },
	]) {
		const { controller, writes } = harness();
		await assert.rejects(controller.append({ alignmentId: "A1", revision: 1, s: 75, profileState, ...changes }));
		assert.equal(writes(), 0);
	}
	const staleHarness = harness({ stale: true });
	await assert.rejects(staleHarness.controller.append({ alignmentId: "A1", revision: 1, s: 75, profileState, elementId: "C2", endS: 100, crossLevelRate: 0.001 }), { code: "PROFILE_READBACK_MISMATCH" });
	assert.equal(staleHarness.writes(), 0);
});

test("save and repository readback failures never report success", async () => {
	const mismatch = harness({ mismatch: true });
	await assert.rejects(mismatch.controller.append({ alignmentId: "A1", revision: 1, s: 75, profileState, elementId: "C2", endS: 100, crossLevelRate: 0.001 }), { code: "PROFILE_READBACK_MISMATCH" });
	assert.equal(mismatch.writes(), 1);
	let writes = 0;
	const controller = createLinearCantElementAuthoringController({ alignmentProfileApplicationService: { async saveProfileState() { writes += 1; throw new Error("offline"); } }, projectionController: { async projectAt({ revision, s }) { return projection(revision, s); } } });
	await assert.rejects(controller.append({ alignmentId: "A1", revision: 1, s: 75, profileState, elementId: "C2", endS: 100, crossLevelRate: 0.001 }), { code: "LINEAR_CANT_SAVE_FAILED" });
	assert.equal(writes, 1);
});
