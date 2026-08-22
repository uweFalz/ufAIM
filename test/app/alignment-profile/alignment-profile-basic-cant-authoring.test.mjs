import assert from "node:assert/strict";
import test from "node:test";

import { createBasicCantCrossLevelAuthoringController } from "../../../app/controllers/alignment-profile/createBasicCantCrossLevelAuthoringController.js";
import { createAlignmentProfileProjectionController } from "../../../app/controllers/alignment-profile/createAlignmentProfileProjectionController.js";
import { AlignmentProfileApplicationService } from "../../../src/services/alignment/AlignmentProfileApplicationService.js";
import { appendVerticalElement, createVerticalConstructiveState } from "../../../src/aim-core/alignment/profile/VerticalConstructiveState.js";
import { appendChainageSegment, createChainageMapping } from "../../../src/aim-core/alignment/profile/ChainageMapping.js";

function profileState() {
	const vertical = appendVerticalElement(createVerticalConstructiveState({ id: "VP1", alignmentId: "A1" }), {
		id: "V1", type: "constant-gradient", startS: 0, endS: 50, startElevation: 10, gradient: 0.01,
	});
	const mapping = appendChainageSegment(createChainageMapping({ id: "CH1", alignmentId: "A1", schemeId: "scheme-demo", schemeVersion: "v1" }), {
		id: "CHS1", startS: 0, endS: 50, startAddress: 1000, direction: 1,
	});
	return { vertical, cant: null, chainageMappings: [mapping] };
}

function setup() {
	let stored = { id: "A1", type: "AlignmentData", revision: 1, profileState: profileState() };
	const saves = [];
	const repository = {
		async loadById() { return structuredClone(stored); },
		async saveById(id, next) {
			assert.equal(id, "A1");
			stored = structuredClone({ ...next, revision: stored.revision + 1 });
			saves.push(structuredClone(stored));
			return structuredClone(stored);
		},
	};
	const service = new AlignmentProfileApplicationService({ alignmentRepository: repository });
	const projectionController = createAlignmentProfileProjectionController({ alignmentProfileApplicationService: service });
	return { saves, stored: () => stored, controller: createBasicCantCrossLevelAuthoringController({ alignmentProfileApplicationService: service, projectionController }) };
}

const REQUEST = Object.freeze({
	alignmentId: "A1", revision: 1, s: 25, profileState: null,
	cantStateId: "CANT1", elementId: "C1", startS: 0, endS: 50, startCrossLevel: 0.05,
});

test("saves one canonical constant cross-level law while preserving vertical and chainage", async () => {
	const fixture = setup();
	const original = fixture.stored().profileState;
	const result = await fixture.controller.submit({ ...REQUEST, profileState: original });
	assert.equal(fixture.saves.length, 1);
	assert.strictEqual(result.profileState.vertical, original.vertical);
	assert.strictEqual(result.profileState.chainageMappings, original.chainageMappings);
	assert.deepEqual(result.evaluation, {
		elementId: "C1", s: 25, crossLevel: 0.05, twist: 0,
		quantity: "cross-level", unit: "alignment-length-unit",
		signConvention: "left-minus-right-viewed-in-increasing-s",
	});
	assert.deepEqual(result.projection.vertical.value, { elementId: "V1", s: 25, elevation: 10.25, gradient: 0.01 });
	assert.equal(result.projection.chainage.mappings[0].candidates[0].address, 1025);
	assert.equal(result.projection.cant.status, "evaluated");
	assert.equal(result.projection.cant.value.crossLevel, 0.05);
	assert.deepEqual(result.projection.cant.reference, {
		status: "partial", workingReference: "midpointGoverningRailEdges",
		scalarCrossLevelStatus: "partial-evidence",
		pairedRails: { status: "unknown", reason: "PAIRED_RAIL_STATE_NOT_AVAILABLE" },
		sourceReference: { status: "unknown", reason: "SOURCE_REFERENCE_NOT_AVAILABLE" },
		transformation: { status: "not-performed", reason: "COMPLETE_SOURCE_CONVENTION_NOT_AVAILABLE" },
	});
});

test("empty and whitespace numeric fields reject zero-write while explicit zero remains valid", async () => {
	for (const field of ["startS", "endS", "startCrossLevel"]) {
		for (const value of ["", " \t "]) {
			const fixture = setup();
			await assert.rejects(() => fixture.controller.submit({ ...REQUEST, profileState: fixture.stored().profileState, [field]: value }), (error) => error.code === "INVALID_CANT_STATE");
			assert.equal(fixture.saves.length, 0);
		}
	}
	const fixture = setup();
	const result = await fixture.controller.submit({ ...REQUEST, profileState: fixture.stored().profileState, startS: "0", startCrossLevel: "0" });
	assert.equal(fixture.saves.length, 1);
	assert.equal(result.profileState.cant.elements[0].startS, 0);
	assert.equal(result.profileState.cant.elements[0].startCrossLevel, 0);
});

test("invalid stale existing and mismatched states never claim another save", async () => {
	const fixture = setup();
	const initial = fixture.stored().profileState;
	for (const invalid of [
		{ ...REQUEST, profileState: initial, cantStateId: "" },
		{ ...REQUEST, profileState: initial, endS: 0 },
		{ ...REQUEST, profileState: initial, startCrossLevel: Infinity },
	]) await assert.rejects(() => fixture.controller.submit(invalid));
	await assert.rejects(() => fixture.controller.submit({ ...REQUEST, profileState: initial, revision: 99 }), (error) => error.code === "REVISION_MISMATCH");
	assert.equal(fixture.saves.length, 0);
	await fixture.controller.submit({ ...REQUEST, profileState: initial });
	await assert.rejects(() => fixture.controller.submit({ ...REQUEST, revision: 2, profileState: fixture.stored().profileState }), (error) => error.code === "CANT_STATE_ALREADY_PRESENT");
	assert.equal(fixture.saves.length, 1);
});
