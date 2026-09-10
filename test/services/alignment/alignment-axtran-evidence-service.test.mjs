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

function longImportedAlignment(count = 331) {
	return {
		type: "AlignmentData",
		id: "A-LONG",
		name: "A-LONG",
		source: { kind: "landXML", native: true },
		editModel: {
			startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
			elements: Array.from({ length: count }, (_, index) => index % 2 === 0 ? ({
				id: `S${index + 1}`,
				type: "straight",
				parameters: { length: 10 },
			}) : ({
				id: `I${index + 1}`,
				type: "transition",
				parameters: { length: 0, transitionType: "immediate" },
			})),
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

test("reports evidence for imported alignments with zero-length immediate transitions", () => {
	const imported = (curvature) => ({
		type: "AlignmentData",
		id: "W467-468",
		name: "W467-468",
		source: { kind: "vermEsn", native: true },
		editModel: {
			startPose: { p: { x: 4510649.6, y: 5379185.5 }, t: { x: 0.46, y: 0.88 } },
			elements: [
				{ id: "A1", type: "arc", parameters: { length: 41.5, curvature } },
				{ id: "I1", type: "transition", parameters: { length: 0, transitionType: "immediate" } },
				{ id: "A2", type: "arc", parameters: { length: 19.7, curvature: -1 / 628.3 } },
				{ id: "I2", type: "transition", parameters: { length: 0, transitionType: "immediate" } },
				{ id: "A3", type: "arc", parameters: { length: 41.6, curvature: 1 / 3004.3 } },
			],
		},
	});
	const result = new AlignmentAxtranEvidenceService().evaluateChange({
		beforeAlignmentData: imported(-1 / 272.33),
		afterAlignmentData: imported(-1 / 280),
		sampleCount: 8,
		maxIterations: 4,
	});

	assert.equal(result.type, "axtran2-consequence-evidence");
	assert.equal(result.status, "evidence-only");
	assert.equal(result.admissible, false);
	assert.equal(result.candidate.names.includes("A1.curvature"), true);
	assert.equal(result.candidate.names.some((name) => name.startsWith("I1.") || name.startsWith("I2.")), false);
});

test("the fit mode is the user's answer to the length prior, and the evidence says which lengths the samples did not determine", () => {
	const service = new AlignmentAxtranEvidenceService();
	const input = { beforeAlignmentData: alignment(1 / 300), afterAlignmentData: alignment(1 / 350), sampleCount: 8, maxIterations: 40 };
	const kept = service.evaluateChange(input);
	assert.equal(kept.fitMode, "keep-plan", "keep-plan is the default, as decided");
	assert.equal(kept.planSigma, 0.05);
	assert.ok(Array.isArray(kept.undetermined));
	for (const entry of kept.undetermined) {
		assert.equal(typeof entry.elementId, "string");
		assert.ok(entry.play > 0);
	}
	const free = service.evaluateChange({ ...input, fitMode: "measurements-only" });
	assert.equal(free.fitMode, "measurements-only");
	assert.equal(free.planSigma, null);
	// the two modes are two different problems: the lengths differ
	const lengthsOf = (result) => result.candidate.names.map((name, i) => (name.endsWith(".length") ? result.candidate.variables[i] : null)).filter((v) => v !== null);
	const kl = lengthsOf(kept), fl = lengthsOf(free);
	assert.ok(kl.length >= 2 && kl.length === fl.length);
	assert.ok(kl.some((value, i) => Math.abs(value - fl[i]) > 1e-9), "keep-plan and measurements-only give different lengths");
	// the plan is the edited alignment: with the prior, the lengths stay nearer to it
	const plan = [100, 60, 100];
	const travel = (lengths) => lengths.reduce((sum, value, i) => sum + Math.abs(value - plan[i]) / plan[i], 0);
	assert.ok(travel(kl) <= travel(fl) + 1e-12, `kept ${travel(kl)} against free ${travel(fl)}`);
	assert.throws(() => service.evaluateChange({ ...input, fitMode: "guess" }), /fit mode must be one of/);
	assert.throws(() => service.evaluateChange({ ...input, planSigma: 0 }), /plan sigma must be positive/);
});

test("bounds interactive evidence for a 331-element imported alignment", () => {
	const imported = longImportedAlignment();
	const result = new AlignmentAxtranEvidenceService().evaluateChange({
		beforeAlignmentData: imported,
		afterAlignmentData: structuredClone(imported),
		sampleCount: 2,
		maxIterations: 12,
	});

	assert.equal(result.type, "axtran2-consequence-evidence");
	assert.equal(result.status, "evidence-only");
	assert.equal(result.admissible, false);
	assert.equal(result.diagnostics.determinacy, null);
	assert.equal(result.diagnostics.iterations, 0);
	assert.deepEqual(result.diagnostics.interactiveBudget, {
		mode: "observation-only",
		freeVariables: 166,
		threshold: 96,
		requestedMaxIterations: 12,
		effectiveMaxIterations: 0,
	});
});
