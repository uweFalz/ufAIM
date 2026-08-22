import assert from "node:assert/strict";
import test from "node:test";

import {
	appendCantElement,
	createCantConstructiveState,
	evaluateCantAt,
} from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";
import { createTerminalLinearCantRateEditController } from "../../../app/controllers/alignment-profile/createTerminalLinearCantRateEditController.js";

const c1 = { id: "C1", type: "constant-cross-level", startS: 0, endS: 50, startCrossLevel: 0.05, retained: "C1-extension" };
const c2 = { id: "C2", type: "linear-cross-level", startS: 50, endS: 100, startCrossLevel: 0.05, crossLevelRate: 0.001, retained: "C2-extension" };
let cant = appendCantElement(createCantConstructiveState({ id: "CANT1", alignmentId: "A1" }), c1);
cant = appendCantElement(cant, c2);
cant = Object.freeze({ ...cant, retainedState: { source: "persisted" } });
const vertical = { alignmentId: "A1", id: "V1" };
const mappings = [{ alignmentId: "A1", id: "CH1" }];
const profileState = { vertical, cant, chainageMappings: mappings };
const projection = (revision, s) => ({ alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s }, cant: { status: "evaluated" } });

function harness({ projectionRevision = null, mismatch = false, saveFailure = null } = {}) {
	let writes = 0;
	const controller = createTerminalLinearCantRateEditController({
		alignmentProfileApplicationService: {
			async saveProfileState({ profileState: next }) {
				writes += 1;
				if (saveFailure) throw saveFailure;
				return {
					presence: "present",
					revision: 2,
					vertical: next.vertical,
					cant: mismatch ? cant : next.cant,
					chainageMappings: next.chainageMappings,
				};
			},
		},
		projectionController: {
			async projectAt({ revision, s }) {
				return projection(projectionRevision ?? revision, s);
			},
		},
	});
	return { controller, writes: () => writes };
}

const request = {
	alignmentId: "A1",
	revision: 1,
	s: 75,
	profileState,
	elementId: "C2",
	crossLevelRate: "0.002",
};

test("rebuilds canonical Cant and replaces only the exact terminal linear rate", async () => {
	const { controller, writes } = harness();
	const result = await controller.update(request);
	assert.equal(writes(), 1);
	assert.strictEqual(result.profileState.vertical, vertical);
	assert.strictEqual(result.profileState.chainageMappings, mappings);
	assert.deepEqual(result.profileState.cant.elements[0], cant.elements[0]);
	assert.deepEqual(result.profileState.cant.elements[1], { ...cant.elements[1], crossLevelRate: 0.002 });
	assert.strictEqual(result.profileState.cant.retainedState, cant.retainedState);
	assert.equal(result.profileState.cant.id, "CANT1");
	assert.deepEqual(evaluateCantAt(result.profileState.cant, { s: 75 }), {
		elementId: "C2", s: 75, crossLevel: 0.1, twist: 0.002,
		quantity: "cross-level", unit: "alignment-length-unit", signConvention: "left-minus-right-viewed-in-increasing-s",
	});
	assert.deepEqual(evaluateCantAt(result.profileState.cant, { s: 100 }), {
		elementId: "C2", s: 100, crossLevel: 0.15000000000000002, twist: 0.002,
		quantity: "cross-level", unit: "alignment-length-unit", signConvention: "left-minus-right-viewed-in-increasing-s",
	});
	assert.deepEqual(result.evaluation, evaluateCantAt(result.profileState.cant, { s: 75 }));
});

test("invalid no-op wrong non-terminal duplicate and stale requests are zero-write", async () => {
	for (const changes of [
		{ elementId: "", crossLevelRate: 0.002 },
		{ elementId: "C2", crossLevelRate: " " },
		{ elementId: "C2", crossLevelRate: Number.NaN },
		{ elementId: "C2", crossLevelRate: 0.001 },
		{ elementId: "missing", crossLevelRate: 0.002 },
		{ elementId: "C1", crossLevelRate: 0.002 },
	]) {
		const { controller, writes } = harness();
		await assert.rejects(controller.update({ ...request, ...changes }));
		assert.equal(writes(), 0);
	}
	const duplicateState = { ...profileState, cant: { ...cant, elements: Object.freeze([...cant.elements, { ...cant.elements[1] }]) } };
	const duplicate = harness();
	await assert.rejects(duplicate.controller.update({ ...request, profileState: duplicateState }), { code: "CANT_ELEMENT_IDENTITY_MISMATCH" });
	assert.equal(duplicate.writes(), 0);
	const stale = harness({ projectionRevision: 99 });
	await assert.rejects(stale.controller.update(request), { code: "PROFILE_READBACK_MISMATCH" });
	assert.equal(stale.writes(), 0);
});

test("save failure and mismatched repository readback never report success", async () => {
	const mismatch = harness({ mismatch: true });
	await assert.rejects(mismatch.controller.update(request), { code: "PROFILE_READBACK_MISMATCH" });
	assert.equal(mismatch.writes(), 1);
	const failed = harness({ saveFailure: new Error("offline") });
	await assert.rejects(failed.controller.update(request), { code: "TERMINAL_LINEAR_CANT_SAVE_FAILED" });
	assert.equal(failed.writes(), 1);
});
