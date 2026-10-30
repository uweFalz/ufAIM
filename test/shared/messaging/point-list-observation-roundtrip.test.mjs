import assert from "node:assert/strict";
import test from "node:test";
import { importPointObservationList, preparePointListEvidenceInput } from "../../../tools/axtran2/pointObservationAdapter.mjs";
import { createMetricContext } from "../../../src/domain/optimization/alignment/MetricContext.js";
import { createSpotStore } from "../../../src/model/spot/model/SpotStore.js";
import { createSpotService } from "../../../src/shared/messaging/service/SpotService.js";
import { createAlignmentPointObservationService } from "../../../src/services/alignment/AlignmentPointObservationService.js";
import { AlignmentAxtranEvidenceService } from "../../../src/services/alignment/AlignmentAxtranEvidenceService.js";

// A declared synthetic list, not evidence from a field survey. Keep CRLF,
// comments, numeric IDs and original comma decimals through the actual parser.
const SOURCE_TEXT = "# Synthetic point-list fixture 095\r\n\r\n"
	+ "name;easting;northing;distance;tolerance\r\n"
	+ "101;20,0;2,0;0,0;0,2\r\n"
	+ "// Point 102 is assigned a hard offset only by the separate request\r\n"
	+ "102;40,0;-1,0;-1,0;0,1\r\n"
	+ "103;70,0;3,0;1,0;0,5\r\n";

function fixture() {
	const context = createMetricContext({
		id: "fixture:095:plane", lengthAuthority: "ground", unit: "m",
		referenceFrame: "synthetic-local-plane", distanceOperator: "euclidean",
		angleConvention: "mathematical", provenance: { source: "synthetic fixture 095" },
		tolerancePolicy: { unit: "m" },
	});
	const importInput = {
		text: SOURCE_TEXT, id: "source:095", revision: "s1",
		source: { kind: "survey-list", reference: "fixture:095", quality: { status: "synthetic" } },
		metricContext: context, kind: "zwang", decimal: "comma",
	};
	const assignments = [
		{ pointId: "101", role: "axis", target: 0, tolerance: "source-tolerance", enforcement: "soft" },
		{ pointId: "102", role: "offset", target: "source-distance", tolerance: "source-tolerance", enforcement: "hard" },
		{ pointId: "103", role: "offset", target: "source-distance", tolerance: "source-tolerance", enforcement: "soft" },
	];
	const alignmentData = {
		type: "AlignmentData", id: "A1", name: "A1", meta: { modifiedAt: "r1" },
		source: { kind: "editor", native: true },
		editModel: {
			startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
			elements: [
				{ id: "S1", type: "straight", parameters: { length: 100 } },
				{ id: "T1", type: "transition", parameters: { length: 60, transitionType: "bloss" } },
				{ id: "C1", type: "arc", parameters: { length: 100, curvature: 1 / 300 } },
			],
		},
	};
	const object = {
		id: "A1", type: "alignment", meta: { modifiedAt: "r1" }, refs: { sourceId: "native:A1" },
		data: { alignmentData, extended: { unrelated: { preserve: true } } },
	};
	let disk = { objects: { A1: object }, meta: { fixture: "095" }, coordContexts: {} };
	let saves = 0, failWrites = false;
	const persistence = {
		async load() { return structuredClone(disk); },
		async save(state) {
			if (failWrites) throw new Error("fixture write failed");
			saves++;
			disk = structuredClone(state);
		},
	};
	const spotService = createSpotService({ spotStore: createSpotStore(), persistence });
	const service = createAlignmentPointObservationService({ spotService });
	function draft({ runId = "run:095", source = importInput, roles = assignments } = {}) {
		const observationSet = importPointObservationList(source);
		return {
			runId, objectId: "A1", options: { maxIterations: 0 },
			pointObservationInput: preparePointListEvidenceInput({
				observationSet, alignmentMetricContext: context, assignments: roles,
			}),
		};
	}
	return { context, importInput, assignments, object, persistence, spotService, service, draft,
		failWrites() { failWrites = true; }, get saves() { return saves; } };
}

test("source list can be imported without assigning it a solver role or causing a write", () => {
	const f = fixture();
	const set = importPointObservationList(f.importInput);
	assert.equal(set.source.pointList.originalText, SOURCE_TEXT);
	assert.deepEqual(set.points.map((point) => point.id), ["101", "102", "103"]);
	assert.deepEqual(set.points.map((point) => point.source.line), [4, 6, 7]);
	assert.equal(set.points[1].source.cells.northing, "-1,0");
	assert.equal(set.points[1].source.declaredDistance, -1);
	assert.equal(Object.hasOwn(set, "assignments"), false);
	assert.equal(Object.hasOwn(set.points[1], "enforcement"), false);
	assert.equal(Object.isFrozen(set.points[1].source.cells), true);
	assert.equal(f.saves, 0);
});

test("actual parser -> explicit roles -> real evaluator -> fresh durable read preserves source and decisions", async () => {
	const f = fixture(), draft = f.draft();
	const before = structuredClone(draft);
	const entry = await f.service.run(draft);
	assert.deepEqual(draft, before);
	assert.equal(entry.result.pointObservation.mode, "external-observations");
	assert.equal(entry.result.status, "evidence-only");
	assert.equal(entry.result.admissible, false);
	assert.equal(entry.result.diagnostics.iterations, 0);
	assert.equal(entry.result.proposalStatus, "max_iterations");
	assert.deepEqual(entry.result.diagnostics.hardPointResiduals.map((point) => point.name), ["102"],
		"kind=zwang does not make all rows hard");
	assert.ok(Math.abs(entry.result.diagnostics.softResidualRms - Math.sqrt(58)) < 1e-6);
	const input = entry.request.pointObservationInput;
	assert.equal(input.observationSet.source.pointList.originalText, SOURCE_TEXT);
	assert.deepEqual(input.assignments.map(({ pointId, role, target, tolerance, enforcement }) =>
		({ pointId, role, target, tolerance, enforcement })), [
		{ pointId: "101", role: "axis", target: 0, tolerance: 0.2, enforcement: "soft" },
		{ pointId: "102", role: "offset", target: -1, tolerance: 0.1, enforcement: "hard" },
		{ pointId: "103", role: "offset", target: 1, tolerance: 0.5, enforcement: "soft" },
	]);
	assert.equal(input.assignments[1].declaration.target, "source-distance");
	assert.equal(input.assignments[1].declaration.tolerance, "source-tolerance");
	assert.equal(input.assignments[0].declaration.target, 0);
	assert.deepEqual(f.spotService.getState().objects.A1.data.alignmentData, f.object.data.alignmentData);
	assert.deepEqual(f.spotService.getState().objects.A1.data.extended.unrelated, { preserve: true });
	const fresh = createAlignmentPointObservationService({
		spotService: createSpotService({ spotStore: createSpotStore(), persistence: f.persistence }),
	});
	const originalEvaluate = AlignmentAxtranEvidenceService.prototype.evaluateChange;
	let restored;
	try {
		AlignmentAxtranEvidenceService.prototype.evaluateChange = () => assert.fail("read must not run evaluator");
		restored = await fresh.read({ objectId: "A1", runId: "run:095" });
	} finally {
		AlignmentAxtranEvidenceService.prototype.evaluateChange = originalEvaluate;
	}
	assert.equal(restored.current, true);
	assert.deepEqual(restored.entry, entry);
	assert.equal(f.saves, 1);
});

test("a changed explicit role/target changes evaluation while preserving the same observation source", async () => {
	const f = fixture();
	const first = await f.service.run(f.draft());
	const roles = structuredClone(f.assignments);
	roles[0] = { ...roles[0], role: "offset", target: 2 };
	const second = await f.service.run(f.draft({ runId: "run:095:offset", roles }));
	assert.deepEqual(second.request.pointObservationInput.observationSet, first.request.pointObservationInput.observationSet);
	assert.ok(second.result.diagnostics.softResidualRms < first.result.diagnostics.softResidualRms);
	assert.deepEqual(f.spotService.getState().objects.A1.data.alignmentData, f.object.data.alignmentData);
	assert.equal(f.saves, 2);
});

test("changed source text cannot reuse a stored source revision even when numerical coordinates match", async () => {
	const f = fixture();
	await f.service.run(f.draft());
	const source = { ...f.importInput, text: SOURCE_TEXT.replace("fixture 095", "fixture 095 with additional note") };
	await assert.rejects(f.service.run(f.draft({ runId: "run:095:changed-source", source })), /conflicting observation set revision/);
	assert.equal(f.saves, 1);
	const entry = await f.service.run(f.draft({ runId: "run:095:new-source-revision", source: { ...source, revision: "s2" } }));
	assert.equal(entry.request.pointObservationInput.observationSet.revision, "s2");
	assert.equal(f.saves, 2);
});

test("malformed source and undeclared/contradictory roles fail before storage; no sample fallback", async () => {
	for (const change of [
		(f) => { f.importInput.text = SOURCE_TEXT.replace("0,2", "not-a-tolerance"); },
		(f) => { f.importInput.text = SOURCE_TEXT.replace("easting;northing", "X;Y"); },
		(f) => { f.importInput.text = SOURCE_TEXT.replace("name;easting", "name;name;easting"); },
		(f) => { f.assignments[0].role = "rail-left"; },
		(f) => { f.assignments[0].target = 2; },
		(f) => { delete f.assignments[0].enforcement; },
		(f) => { f.assignments.pop(); },
	]) {
		const f = fixture();
		change(f);
		await assert.rejects(async () => f.service.run(f.draft()));
		assert.equal(f.saves, 0);
	}
});

test("failed archive write does not install list evidence or alter the canonical alignment", async () => {
	const f = fixture();
	await f.spotService.hydrate();
	const before = f.spotService.getState();
	f.failWrites();
	await assert.rejects(f.service.run(f.draft()), /fixture write failed/);
	assert.deepEqual(f.spotService.getState(), before);
	assert.equal(f.saves, 0);
});
