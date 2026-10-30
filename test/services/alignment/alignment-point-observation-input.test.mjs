import test from "node:test";
import assert from "node:assert/strict";
import { createMetricContext } from "../../../src/domain/optimization/alignment/MetricContext.js";
import { preparePointObservationInput } from "../../../src/services/alignment/AlignmentPointEvidenceRequest.js";
import { AlignmentAxtranEvidenceService } from "../../../src/services/alignment/AlignmentAxtranEvidenceService.js";

function inputFixture() {
	const metricContext = createMetricContext({
		id: "survey:local", lengthAuthority: "ground", unit: "m", referenceFrame: "local-survey-plane",
		distanceOperator: "euclidean", angleConvention: "mathematical",
		provenance: { source: "fixture:093" }, tolerancePolicy: { unit: "m" },
	});
	return {
		observationSet: {
			id: "survey:1", revision: "revision:1", source: { kind: "survey-import", reference: "fixture:093" },
			metricContext, points: [{ id: "P1", x: 25, y: 2 }, { id: "P2", x: 50, y: 1 }],
		},
		assignments: [
			{ pointId: "P1", target: 0, tolerance: 0.1, enforcement: "soft", reason: "declared fit observation" },
			{ pointId: "P2", target: 1, tolerance: 0.05, enforcement: "hard", reason: "declared fixed offset" },
		],
		alignmentMetricContext: metricContext,
	};
}

function alignment(curvature = 1 / 300) {
	return {
		type: "AlignmentData", id: "A1", name: "A1", source: { kind: "editor", native: true },
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

test("explicit roles are mapped once to consistent residual and hard-constraint names", () => {
	const input = inputFixture();
	input.observationSet.points[0].quality = { tolerance: 500, enforcement: "hard", target: 999 };
	const original = structuredClone(input);
	const prepared = preparePointObservationInput(input);
	assert.deepEqual(input, original);
	assert.deepEqual(prepared.assignments, original.assignments);
	assert.deepEqual(prepared.hardPoints, [{ name: "P2" }]);
	assert.equal(prepared.points[0].target, 0);
	assert.equal(prepared.points[0].tolerance, 0.1);
	assert.equal(prepared.points[0].enforcement, "soft", "source quality is not solver policy");
	assert.equal(prepared.points[0].kind, "external-observation");
	assert.deepEqual(prepared.observationSet.points[0].quality, input.observationSet.points[0].quality);
	assert.deepEqual(preparePointObservationInput(JSON.parse(JSON.stringify(prepared))), prepared);
	assert.equal(Object.isFrozen(prepared.assignments[0]), true);
	assert.equal(Object.isFrozen(prepared.points[0]), true);
	assert.equal(Object.isFrozen(prepared.hardPoints[0]), true);
	input.assignments[0].target = 10;
	assert.equal(prepared.assignments[0].target, 0);
});

for (const [name, change] of [
	["missing assignment", (x) => { x.assignments.pop(); }],
	["duplicate assignment", (x) => { x.assignments[1].pointId = "P1"; }],
	["orphan assignment", (x) => { x.assignments[1].pointId = "unknown"; }],
	["missing target", (x) => { delete x.assignments[0].target; }],
	["string target", (x) => { x.assignments[0].target = "0"; }],
	["missing tolerance", (x) => { delete x.assignments[0].tolerance; }],
	["zero tolerance", (x) => { x.assignments[0].tolerance = 0; }],
	["nonfinite tolerance", (x) => { x.assignments[0].tolerance = Infinity; }],
	["missing role", (x) => { delete x.assignments[0].enforcement; }],
	["unknown role", (x) => { x.assignments[0].enforcement = "measured"; }],
	["missing alignment context", (x) => { delete x.alignmentMetricContext; }],
	["same-ID unit disagreement", (x) => { x.alignmentMetricContext = { ...x.alignmentMetricContext, unit: "ft" }; }],
	["same-ID frame disagreement", (x) => { x.alignmentMetricContext = { ...x.alignmentMetricContext, referenceFrame: "another-frame" }; }],
	["same-ID angle disagreement", (x) => { x.alignmentMetricContext = { ...x.alignmentMetricContext, angleConvention: "bearing" }; }],
	["same-ID authority disagreement", (x) => { x.alignmentMetricContext = { ...x.alignmentMetricContext, lengthAuthority: "grid" }; }],
	["same-ID operator disagreement", (x) => { x.alignmentMetricContext = { ...x.alignmentMetricContext, distanceOperator: "arc-length" }; }],
	["same-ID provenance disagreement", (x) => { x.alignmentMetricContext = { ...x.alignmentMetricContext, provenance: { source: "other" } }; }],
	["same-ID tolerance-policy disagreement", (x) => { x.alignmentMetricContext = { ...x.alignmentMetricContext, tolerancePolicy: null }; }],
	["unrecognized outer field", (x) => { x.externalPoints = []; }],
]) {
	test(`explicit point mapping refuses ${name}`, () => {
		const input = inputFixture();
		change(input);
		assert.throws(() => preparePointObservationInput(input));
	});
}

for (const key of ["points", "hardPoints"]) {
	test(`roundtripped ${key} cannot override the source and assignments`, () => {
		const input = structuredClone(preparePointObservationInput(inputFixture()));
		input[key][0].name = "forged";
		assert.throws(() => preparePointObservationInput(input), { code: "FORGED_POINT_MAPPING" });
	});
}

test("the real zero-iteration solver uses external coordinates, reports source binding, and respects hard points", () => {
	const service = new AlignmentAxtranEvidenceService();
	const geometry = alignment();
	const input = inputFixture();
	const original = structuredClone({ input, geometry });
	const first = service.evaluateChange({ beforeAlignmentData: geometry, afterAlignmentData: geometry, maxIterations: 0, pointObservationInput: input });
	assert.equal(first.status, "evidence-only");
	assert.equal(first.admissible, false);
	assert.equal(first.diagnostics.iterations, 0);
	assert.equal(first.diagnostics.interactiveBudget.effectiveMaxIterations, 0);
	assert.ok(Math.abs(first.diagnostics.softResidualRms - 20) < 1e-6);
	assert.deepEqual(first.diagnostics.hardPointResiduals.map((p) => p.name), ["P2"]);
	assert.ok(Math.abs(first.diagnostics.hardPointResiduals[0].residual) < 1e-6);
	const { evaluatedInput, ...binding } = first.pointObservation;
	assert.deepEqual(binding, {
		mode: "external-observations", setId: "survey:1", setRevision: "revision:1", pointIds: ["P1", "P2"], metricContext: input.alignmentMetricContext,
	});
	assert.deepEqual(evaluatedInput, {
		beforeAlignmentData: geometry, afterAlignmentData: geometry,
		pointObservationInput: { observationSet: preparePointObservationInput(input).observationSet, assignments: input.assignments, alignmentMetricContext: input.alignmentMetricContext },
		options: { maxIterations: 0, hessian: "gauss-newton", fitMode: "keep-plan", planSigma: 0.05, heldPoses: [], heldElements: [], turnout: null },
	});
	assert.equal(Object.isFrozen(evaluatedInput.afterAlignmentData.editModel.elements[0]), true);
	assert.match(first.note, /external point observations/);
	assert.doesNotMatch(first.note, /Derived from the pre-edit/);
	assert.deepEqual({ input, geometry }, original);
	input.observationSet.points[0].y = 3;
	input.observationSet.revision = "revision:2";
	const changed = service.evaluateChange({ beforeAlignmentData: geometry, afterAlignmentData: geometry, maxIterations: 0, pointObservationInput: input });
	assert.ok(Math.abs(changed.diagnostics.softResidualRms - 30) < 1e-6);
	assert.notEqual(first.diagnostics.softResidualRms, changed.diagnostics.softResidualRms);
	assert.equal(changed.pointObservation.setRevision, "revision:2");
	assert.equal(first.pointObservation.setRevision, "revision:1");
	assert.equal(first.pointObservation.evaluatedInput.pointObservationInput.observationSet.points[0].y, 2);
});

test("only an omitted external property preserves the original pre-edit sample path", () => {
	const service = new AlignmentAxtranEvidenceService();
	const ordinary = { beforeAlignmentData: alignment(), afterAlignmentData: alignment(), maxIterations: 0 };
	const sampled = service.evaluateChange(ordinary);
	assert.equal(Object.hasOwn(sampled, "pointObservation"), false);
	assert.match(sampled.note, /Derived from the pre-edit canonical realization/);
	for (const invalid of [null, undefined, false, {}, { observationSet: {} }]) {
		assert.throws(() => service.evaluateChange({ ...ordinary, pointObservationInput: invalid }));
	}
});

test("external overconstraint and extrapolated-point cases stay truthful, with no sample fallback", () => {
	const service = new AlignmentAxtranEvidenceService();
	const input = inputFixture();
	input.assignments[0].enforcement = "hard";
	assert.throws(() => service.evaluateChange({ beforeAlignmentData: alignment(), afterAlignmentData: alignment(), maxIterations: 0, pointObservationInput: input }), /over.constrain|equalit/i);
	input.assignments[0].enforcement = "soft";
	input.observationSet.points[0].x = -100;
	assert.throws(
		() => service.evaluateChange({ beforeAlignmentData: alignment(), afterAlignmentData: alignment(), maxIterations: 0, pointObservationInput: input }),
		{ code: "EXTRAPOLATED_PROJECTION" },
	);
});
