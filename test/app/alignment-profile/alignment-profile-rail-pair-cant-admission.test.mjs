import assert from "node:assert/strict";
import test from "node:test";

import { createRailPairCantAdmissionController } from "../../../app/controllers/alignment-profile/createRailPairCantAdmissionController.js";
import { createAlignmentProfileProjectionController } from "../../../app/controllers/alignment-profile/createAlignmentProfileProjectionController.js";
import { AlignmentProfileApplicationService } from "../../../src/services/alignment/AlignmentProfileApplicationService.js";

const REQUEST = Object.freeze({
	alignmentId: "A1", revision: 1, s: 40,
	profileState: { vertical: null, cant: null, chainageMappings: [] },
	cantStateId: "RP1", leftRailId: "rail-L", rightRailId: "rail-R",
	separationKind: "horizontal-projection-between-governing-references",
	separationUnit: "alignment-length-unit", separationValue: "1.506",
	separationMeasurementDefinition: "governing-running-edges",
	separationProvenanceSourceId: "design-rule-47",
	anchorRuleId: "anchor-9", anchorRuleVersion: "2", anchorKind: "left-reference",
	anchorRailId: "rail-L", anchorProvenanceSourceId: "design-axis-binding-4",
	coverageStartS: "0", coverageEndS: "100", admitCompleteConstruction: true,
	railSide: "right", elementId: "rail-law-R-1", lawType: "linear-rail-offset",
	elementStartS: "0", elementEndS: "100", startOffset: "-0.015", offsetRate: "0.0005",
});

function harness() {
	let stored = { id: "A1", type: "AlignmentData", revision: 1, horizontal: { preserved: true }, profileState: structuredClone(REQUEST.profileState) };
	let writes = 0;
	const repository = {
		async loadById(id) { return id === "A1" ? structuredClone(stored) : null; },
		async saveById(id, value) { writes += 1; stored = structuredClone({ ...value, revision: stored.revision + 1 }); return structuredClone(stored); },
	};
	const service = new AlignmentProfileApplicationService({ alignmentRepository: repository });
	const projectionController = createAlignmentProfileProjectionController({ alignmentProfileApplicationService: service });
	return { controller: createRailPairCantAdmissionController({ alignmentProfileApplicationService: service, projectionController }), service, projectionController, stored: () => structuredClone(stored), writes: () => writes };
}

test("creates one fully explicit admitted Rail-Pair state and reopens it losslessly", async () => {
	const fixture = harness();
	const result = await fixture.controller.admit(REQUEST);
	assert.equal(fixture.writes(), 1);
	assert.equal(result.status, "saved");
	assert.equal(result.railSide, "right");
	assert.equal(result.railId, "rail-R");
	assert.equal(result.elementId, "rail-law-R-1");
	assert.deepEqual(result.cant.railPair, {
		leftRailId: "rail-L", rightRailId: "rail-R",
		separation: { kind: REQUEST.separationKind, unit: REQUEST.separationUnit, value: 1.506, measurementDefinition: REQUEST.separationMeasurementDefinition, provenance: { sourceId: REQUEST.separationProvenanceSourceId } },
	});
	assert.deepEqual(result.cant.anchorRule, { id: "anchor-9", version: "2", kind: "left-reference", provenance: { sourceId: "design-axis-binding-4" }, railId: "rail-L" });
	assert.deepEqual(result.cant.coverage, { status: "complete", startS: 0, endS: 100, authority: "admitted-construction" });
	assert.deepEqual(result.cant.elements, [{ id: "rail-law-R-1", railId: "rail-R", type: "linear-rail-offset", startS: 0, endS: 100, startOffset: -0.015, offsetRate: 0.0005 }]);
	assert.equal(result.projection.cursor.s, 40);
	assert.equal(result.projection.cant.left.offset, 0);
	assert.ok(Math.abs(result.projection.cant.right.offset - 0.005) < 1e-12);
	assert.ok(Math.abs(result.projection.cant.crossLevel - 0.005) < 1e-12);
	assert.ok(Math.abs(result.projection.cant.commonOffset - 0.0025) < 1e-12);
	assert.deepEqual(fixture.stored().horizontal, { preserved: true });

	const reopenedProjection = await fixture.projectionController.projectAt({ alignmentId: "A1", revision: 2, s: 40 });
	assert.deepEqual(reopenedProjection.state.cant, result.cant);
	assert.deepEqual(reopenedProjection.cant, result.projection.cant);
});

test("refuses missing constructive facts, implicit admission, legacy replacement and malformed laws before write", async () => {
	const cases = [
		[{ leftRailId: "" }, "INVALID_RAIL_PAIR_ADMISSION"],
		[{ separationValue: "" }, "INVALID_RAIL_PAIR_ADMISSION"],
		[{ separationUnit: "m" }, "INVALID_RAIL_PAIR_ADMISSION"],
		[{ anchorKind: "" }, "INVALID_RAIL_PAIR_ADMISSION"],
		[{ anchorRailId: "rail-R" }, "INVALID_RAIL_PAIR_ADMISSION"],
		[{ admitCompleteConstruction: false }, "ADMISSION_CONFIRMATION_REQUIRED"],
		[{ coverageEndS: "40", s: 50 }, "CURSOR_OUTSIDE_COVERAGE"],
		[{ railSide: "" }, "INVALID_RAIL_PAIR_ADMISSION"],
		[{ lawType: "linear-rail-offset", offsetRate: "" }, "INVALID_RAIL_PAIR_ADMISSION"],
		[{ startOffset: "0", offsetRate: "0" }, "INVALID_RAIL_PAIR_ADMISSION"],
		[{ profileState: { vertical: null, cant: { type: "CantConstructiveState" }, chainageMappings: [] } }, "CANT_STATE_ALREADY_PRESENT"],
	];
	for (const [override, code] of cases) {
		const fixture = harness();
		await assert.rejects(() => fixture.controller.admit({ ...REQUEST, ...override }), (error) => error.code === code);
		assert.equal(fixture.writes(), 0);
	}
});
