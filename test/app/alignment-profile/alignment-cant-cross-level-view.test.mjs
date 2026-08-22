import assert from "node:assert/strict";
import test from "node:test";

import { appendCantElement, createCantConstructiveState } from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";
import { createCantCrossLevelViewController } from "../../../app/controllers/alignment-profile/createCantCrossLevelViewController.js";

let cant = appendCantElement(createCantConstructiveState({ id: "CANT1", alignmentId: "A1" }), { id: "C1", type: "constant-cross-level", startS: 0, endS: 50, startCrossLevel: 0.05 });
cant = appendCantElement(cant, { id: "C2", type: "linear-cross-level", startS: 50, endS: 100, startCrossLevel: 0.05, crossLevelRate: 0.001 });

test("projects exact persisted boundaries and cursor through canonical evaluation", () => {
	const result = createCantCrossLevelViewController().project({ alignmentId: "A1", revision: 4, s: 75, profileState: { vertical: null, cant, chainageMappings: [] } });
	assert.equal(result.status, "projected");
	assert.deepEqual(result.domain, { parameterKind: "intrinsic-s", startS: 0, endS: 100 });
	assert.deepEqual(result.boundaries, [0, 50, 100]);
	assert.deepEqual(result.samples.map(({ s, elementId, crossLevel, twist }) => ({ s, elementId, crossLevel, twist })), [
		{ s: 0, elementId: "C1", crossLevel: 0.05, twist: 0 },
		{ s: 50, elementId: "C2", crossLevel: 0.05, twist: 0.001 },
		{ s: 75, elementId: "C2", crossLevel: 0.07500000000000001, twist: 0.001 },
		{ s: 100, elementId: "C2", crossLevel: 0.1, twist: 0.001 },
	]);
	assert.equal(result.cursor.crossLevel, 0.07500000000000001);
	assert.deepEqual(result.elements.map((element) => [element.id, element.startS, element.endS]), [["C1", 0, 50], ["C2", 50, 100]]);
	assert.equal(result.reference.workingReference, "midpointGoverningRailEdges");
	assert.equal(result.reference.pairedRails.status, "unknown");
	assert.ok(Object.isFrozen(result));
});

test("endpoint and outside cursor remain exact and truthful", () => {
	const controller = createCantCrossLevelViewController();
	const endpoint = controller.project({ alignmentId: "A1", revision: 4, s: 100, profileState: { cant } });
	assert.equal(endpoint.cursor.elementId, "C2");
	assert.equal(endpoint.cursor.crossLevel, 0.1);
	assert.equal(endpoint.cursor.twist, 0.001);
	const outside = controller.project({ alignmentId: "A1", revision: 4, s: 125, profileState: { cant } });
	assert.deepEqual(outside.cursor, { status: "not-covered", s: 125 });
	assert.deepEqual(outside.samples.map((sample) => sample.s), [0, 50, 100]);
});

test("absent malformed and evaluator failures never fabricate a view", () => {
	const controller = createCantCrossLevelViewController();
	assert.equal(controller.project({ alignmentId: "A1", revision: 1, s: 0, profileState: { cant: null } }).status, "absent");
	assert.equal(controller.project({ alignmentId: "A1", revision: 1, s: 0, profileState: { cant: { alignmentId: "A1", elements: [] } } }).status, "error");
	const broken = { ...cant, elements: [{ ...cant.elements[0], startCrossLevel: NaN }, cant.elements[1]] };
	assert.equal(controller.project({ alignmentId: "A1", revision: 1, s: 0, profileState: { cant: broken } }).status, "error");
	assert.throws(() => controller.project({ alignmentId: "", revision: 1, s: 0, profileState: { cant } }), { code: "INVALID_CONTEXT" });
});
