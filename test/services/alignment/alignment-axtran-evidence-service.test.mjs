import test from "node:test";
import assert from "node:assert/strict";

import { AlignmentAxtranEvidenceService } from "../../../src/services/alignment/AlignmentAxtranEvidenceService.js";

function alignment(curvature) {
	return {
		type: "AlignmentData",
		id: "A1",
		name: "A1",
		source: { kind: "editor", native: true },
		editModel: {
			startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
			elements: [
				{ id: "S1", type: "straight", parameters: { length: 100 } },
				{ id: "T1", type: "transition", parameters: { length: 60, transitionType: "bloss" } },
				{ id: "A1", type: "arc", parameters: { length: 100, curvature } },
			],
		},
	};
}

test("reports a real AXTRAN2 proposal as explicit non-admissible evidence", () => {
	const service = new AlignmentAxtranEvidenceService();
	const result = service.evaluateChange({
		beforeAlignmentData: alignment(1 / 300),
		afterAlignmentData: alignment(1 / 350),
		sampleCount: 8,
		maxIterations: 4,
	});

	assert.equal(result.type, "axtran2-consequence-evidence");
	assert.equal(result.status, "evidence-only");
	assert.equal(result.admission, "evidence-only");
	assert.equal(result.admissible, false);
	assert.equal(result.objective, "points");
	assert.equal(typeof result.proposalStatus, "string");
	assert.equal(Number.isInteger(result.candidate.variables.length), true);
	assert.equal(result.candidate.names.includes("A1.curvature"), true);
	assert.equal(Number.isFinite(result.diagnostics.iterations), true);
	assert.equal(result.diagnostics.softResidualRms === null || Number.isFinite(result.diagnostics.softResidualRms), true);
});

test("fails closed when the visible alignment has too few free quantities", () => {
	const single = alignment(1 / 300);
	single.editModel.elements = [{ id: "S1", type: "straight", parameters: { length: 100 } }];
	assert.throws(
		() => new AlignmentAxtranEvidenceService().evaluateChange({ beforeAlignmentData: single, afterAlignmentData: single }),
		/at least three free quantities/,
	);
});
