import assert from "node:assert/strict";
import test from "node:test";

import { createRailPairCantRailLawEditController } from "../../../app/controllers/alignment-profile/createRailPairCantRailLawEditController.js";
import { createAlignmentProfileProjectionController } from "../../../app/controllers/alignment-profile/createAlignmentProfileProjectionController.js";
import { appendRailOffsetElement, createRailPairCantConstructiveState } from "../../../src/aim-core/alignment/profile/RailPairCantConstructiveState.js";
import { AlignmentProfileApplicationService } from "../../../src/services/alignment/AlignmentProfileApplicationService.js";

function state({ admitted = true } = {}) {
	let cant = createRailPairCantConstructiveState({
		id: "RP1", alignmentId: "A1",
		coverage: admitted ? { status: "complete", startS: 0, endS: 100, authority: "admitted-construction" } : { status: "incomplete", startS: 0, endS: 100 },
		railPair: {
			leftRailId: "L", rightRailId: "R",
			separation: { kind: "horizontal-projection-between-governing-references", unit: "alignment-length-unit", value: 1.5, measurementDefinition: "governing-edges", provenance: { sourceId: "survey-1" } },
		},
		anchorRule: { id: "anchor-1", version: "1", kind: "midpoint", provenance: { sourceId: "design-1" } },
	});
	cant = appendRailOffsetElement(cant, { id: "L1", railId: "L", type: "linear-rail-offset", startS: 0, endS: 100, startOffset: 0.02, offsetRate: 0.001 });
	cant = appendRailOffsetElement(cant, { id: "R1", railId: "R", type: "constant-rail-offset", startS: 0, endS: 100, startOffset: -0.01 });
	return { vertical: null, cant, chainageMappings: [] };
}

function harness(profileState = state()) {
	let stored = { id: "A1", type: "AlignmentData", revision: 1, profileState: structuredClone(profileState), horizontal: { preserved: true } };
	let writes = 0;
	const repository = {
		async loadById() { return structuredClone(stored); },
		async saveById(id, value) { writes += 1; stored = structuredClone({ ...value, revision: stored.revision + 1 }); return structuredClone(stored); },
	};
	const service = new AlignmentProfileApplicationService({ alignmentRepository: repository });
	return { controller: createRailPairCantRailLawEditController({ alignmentProfileApplicationService: service, projectionController: createAlignmentProfileProjectionController({ alignmentProfileApplicationService: service }) }), stored: () => stored, writes: () => writes };
}

test("edits the explicitly selected left rail law and reopens one synchronized rail-pair projection", async () => {
	const fixture = harness();
	const result = await fixture.controller.update({ alignmentId: "A1", revision: 1, s: 40, profileState: fixture.stored().profileState, railSide: "left", elementId: "L1", startOffset: "0.03", offsetRate: "0.002" });
	assert.equal(fixture.writes(), 1);
	assert.equal(result.railId, "L");
	assert.equal(result.projection.cursor.s, 40);
	assert.equal(result.projection.cant.representation, "rail-pair");
	assert.deepEqual(result.projection.cant.left, { railId: "L", status: "known", offset: 0.11, elementId: "L1" });
	assert.deepEqual(result.projection.cant.right, { railId: "R", status: "known", offset: -0.01, elementId: "R1" });
	assert.equal(result.projection.cant.crossLevel, -0.12);
	assert.equal(result.projection.cant.commonOffset, 0.05);
	assert.deepEqual(fixture.stored().profileState.cant, result.cant);
	assert.deepEqual(fixture.stored().horizontal, { preserved: true });
});
test("legacy, unadmitted, wrong-side, malformed and unchanged edits fail before write", async () => {
	const cases = [
		{ profileState: { vertical: null, cant: null, chainageMappings: [] }, request: { railSide: "left", elementId: "L1", startOffset: 0.03, offsetRate: 0.002 }, code: "RAIL_PAIR_CANT_REQUIRED" },
		{ profileState: state({ admitted: false }), request: { railSide: "left", elementId: "L1", startOffset: 0.03, offsetRate: 0.002 }, code: "RAIL_PAIR_CANT_NOT_ADMITTED" },
		{ profileState: state(), request: { railSide: "right", elementId: "L1", startOffset: 0.03, offsetRate: 0.002 }, code: "RAIL_SIDE_IDENTITY_MISMATCH" },
		{ profileState: state(), request: { railSide: "left", elementId: "L1", startOffset: 0.02, offsetRate: 0.001 }, code: "RAIL_LAW_NO_CHANGE" },
		{ profileState: state(), request: { railSide: "left", elementId: "L1", startOffset: "", offsetRate: 0.002 }, code: "INVALID_RAIL_LAW_EDIT" },
	];
	for (const entry of cases) {
		const fixture = harness(entry.profileState);
		await assert.rejects(() => fixture.controller.update({ alignmentId: "A1", revision: 1, s: 40, profileState: entry.profileState, ...entry.request }), (error) => error.code === entry.code);
		assert.equal(fixture.writes(), 0);
	}
});
