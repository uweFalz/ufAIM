import assert from "node:assert/strict";
import test from "node:test";
import { buildSparseFromEditModel, makeAlignment2DFromSparse } from "alignment-os/aim-core";
import { deps } from "alignment-os/domain/optimization/alignment/SolverDependencies.js";
import { createMetricContext } from "alignment-os/domain/optimization/alignment/MetricContext.js";
import { buildProductionAlignment } from "alignment-os/domain/optimization/alignment/ProductionAlignment.js";
import { traAlignmentFromBytes } from "alignment-os/vermEsn/traAlignment";
import { createSpotStore } from "alignment-os/model/spot/model/SpotStore.js";
import { createSpotService } from "alignment-os/shared/messaging/service/SpotService.js";
import { createAlignmentPointObservationService } from "alignment-os/services/alignment/AlignmentPointObservationService.js";
import { AlignmentAxtranEvidenceService } from "alignment-os/services/alignment/AlignmentAxtranEvidenceService.js";
import { importPointObservationList, preparePointListEvidenceInput } from "../../../tools/axtran2/pointObservationAdapter.mjs";
import { writeTra } from "../../../src/services/axtran2/traWriter.js";
import {
	buildHorizontalRealizationChangeReceipt,
	archiveHorizontalRealizationChangeReceipt,
	restoreHorizontalRealizationChangeReceipt,
} from "../../../app/domain/workspace/buildHorizontalRealizationChangeReceipt.js";

// New combined integration fixture, not a field survey or a convergence test.
// Package self-references exercise the current src-only export boundary; the
// point-list adapter and TRA writer deliberately remain repository tools.
const SOURCE = "# synthetic consolidation 099\r\nname;easting;northing\r\nP1;20;2\r\nP2;40;3\r\nP3;70;-1\r\n";
const context = createMetricContext({
	id: "fixture:099:plane", lengthAuthority: "ground", unit: "m",
	referenceFrame: "synthetic-local-plane", distanceOperator: "euclidean",
	angleConvention: "mathematical", provenance: { source: "synthetic fixture 099" },
	tolerancePolicy: { unit: "m" },
});

function nativeData(family, curvature, revision) {
	const arc = { id: "C", type: "arc", parameters: { length: 100, curvature } };
	const straight = { id: "S", type: "straight", parameters: { length: 100 } };
	const transition = { id: "T8", type: "transition", parameters: { length: 60, transitionType: family } };
	const data = {
		type: "AlignmentData", id: "A099", name: "Combined fixture", meta: { modifiedAt: revision },
		source: { kind: "editor", native: true },
		editModel: {
			startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
			elements: family.endsWith("_in") ? [straight, transition, arc] : [arc, transition, straight],
		},
	};
	data.sparseAlignment = buildSparseFromEditModel(data, deps);
	return data;
}

function fixture(family) {
	const before = nativeData(family, 1 / 300, "r1");
	const after = nativeData(family, 1 / 310, "r2");
	const object = {
		id: "A099", type: "alignment", meta: { modifiedAt: "r2" },
		refs: { fixtureSource: "synthetic:099" },
		data: { alignmentData: after, extended: { unrelated: { preserve: [0, null, ""] } } },
	};
	const change = { objectId: object.id, elementId: "C", revision: "r2", alignmentData: after, spotObject: object };
	// This explicitly declared refusal is an archive-contract fixture. It is
	// not asserted to be a refusal produced by the separate point calculation.
	const receipt = buildHorizontalRealizationChangeReceipt({
		beforeAlignmentData: before, alignmentChange: change,
		activeObjectId: object.id, activeElementId: "C",
		axtranRefusal: { code: "FIXTURE_REFUSAL", message: "Synthetic independent edit refusal" },
	});
	const refusal = archiveHorizontalRealizationChangeReceipt({ receipt, beforeAlignmentData: before, alignmentChange: change });
	let disk = { objects: { [object.id]: object }, meta: { fixture: "099" }, coordContexts: {} };
	let writes = 0, failNext = false;
	const persistence = {
		async load() { return structuredClone(disk); },
		async save(state) {
			if (failNext) { failNext = false; throw new Error("synthetic combined save failure"); }
			writes++;
			disk = structuredClone(state);
		},
	};
	const spot = createSpotService({ spotStore: createSpotStore(), persistence });
	const points = createAlignmentPointObservationService({ spotService: spot });
	const observationSet = importPointObservationList({
		text: SOURCE, id: "source:099", revision: "s1", metricContext: context,
		source: { kind: "survey-list", reference: "fixture:099", quality: { status: "synthetic" } },
		kind: "points", decimal: "dot",
	});
	const draft = {
		runId: "run:099", objectId: object.id, options: { maxIterations: 0 },
		pointObservationInput: preparePointListEvidenceInput({
			observationSet, alignmentMetricContext: context,
			assignments: observationSet.points.map(({ id }) => ({
				pointId: id, role: "axis", target: 0, tolerance: 0.2, enforcement: "soft",
			})),
		}),
	};
	return { before, after, object, receipt, refusal, persistence, spot, points, draft,
		get writes() { return writes; }, disk: () => structuredClone(disk), failNext() { failNext = true; } };
}

async function assertTraRoundtrip(data, family) {
	const sparse = data.sparseAlignment;
	const { alignment } = makeAlignment2DFromSparse({ startPose: sparse.startPose, sparse: sparse.sparse, ...deps });
	const poseAt = (s) => {
		const { p, t } = alignment.poseAt(s, { quality: "exact" });
		return { x: p.x, y: p.y, theta: Math.atan2(t.y, t.x) };
	};
	const elements = data.editModel.elements.map(({ id, type, parameters: p }) => ({
		id, type, length: p.length,
		...(type === "arc" ? { curvature: p.curvature } : {}),
		...(type === "transition" ? { family: p.transitionType } : {}),
	}));
	const exported = writeTra({
		elements, poseOfElement: (i) => poseAt(sparse.elements[i].sStart),
		endPose: poseAt(alignment.arcLength), startStation: 1000,
	});
	assert.equal(new DataView(exported.bytes.buffer).getUint16(2 * 78 + 48, true), 8);
	const imported = await traAlignmentFromBytes(exported.bytes, "synthetic-consolidated.TRA");
	assert.deepEqual(imported.unsupported, []);
	assert.equal(imported.elements.find((e) => e.type === "transition").family, family);
	const rebuilt = buildProductionAlignment({ elements: imported.elements, startPose: imported.startPose, deps });
	assert.equal(rebuilt.arcLength, alignment.arcLength);
	for (const s of [0, 100, 115, 130, 145, 160, 260]) {
		const actual = rebuilt.poseAt(s, { quality: "exact" }), expected = alignment.poseAt(s, { quality: "exact" });
		assert.ok(Math.hypot(actual.p.x - expected.p.x, actual.p.y - expected.p.y) < 2e-8);
		assert.ok(Math.abs(rebuilt.curvatureAt(s) - alignment.curvatureAt(s)) < 1e-12);
	}
}

for (const family of ["bloss_halfwave_in", "bloss_halfwave_out"]) {
	for (const order of ["points-first", "refusal-first"]) {
		test(`${family}: ${order}, point evidence and refusal share one durable snapshot`, async () => {
			const f = fixture(family);
			const originalObject = structuredClone(f.object);
			const saveRefusal = () => f.spot.storeHorizontalReceipt({ objectId: "A099", entry: f.refusal });
			if (order === "refusal-first") await saveRefusal();
			const entry = await f.points.run(f.draft);
			if (order === "points-first") await saveRefusal();
			assert.equal(entry.result.status, "evidence-only");
			assert.equal(entry.result.admissible, false);
			assert.equal(entry.result.pointObservation.mode, "external-observations");
			assert.equal(entry.result.diagnostics.iterations, 0);
			assert.equal(entry.request.pointObservationInput.observationSet.source.pointList.originalText, SOURCE);
			assert.equal(entry.request.beforeAlignmentData.editModel.elements[1].parameters.transitionType, family);
			assert.equal(f.writes, 2);
			const freshSpot = createSpotService({ spotStore: createSpotStore(), persistence: f.persistence });
			const freshPoints = createAlignmentPointObservationService({ spotService: freshSpot });
			const originalEvaluate = AlignmentAxtranEvidenceService.prototype.evaluateChange;
			try {
				AlignmentAxtranEvidenceService.prototype.evaluateChange = () => assert.fail("read must not recompute");
				assert.deepEqual(await freshPoints.read({ objectId: "A099", runId: "run:099" }), { entry, current: true });
				const restored = freshSpot.getState().objects.A099;
				assert.deepEqual(restoreHorizontalRealizationChangeReceipt({ spotObject: restored, elementId: "C" }), f.receipt);
				assert.deepEqual(restored.data.extended.horizontalRealizationReceipts, [f.refusal]);
				assert.deepEqual(restored.data.extended.pointObservationEvidence, [entry]);
				assert.deepEqual(restored.data.alignmentData, originalObject.data.alignmentData);
				assert.deepEqual(restored.data.extended.unrelated, originalObject.data.extended.unrelated);
				assert.deepEqual(restored.refs, originalObject.refs);
				assert.deepEqual(restored.meta, originalObject.meta);
			} finally {
				AlignmentAxtranEvidenceService.prototype.evaluateChange = originalEvaluate;
			}
			assert.equal(f.writes, 2, "fresh read causes no writes");
			await assertTraRoundtrip(freshSpot.getState().objects.A099.data.alignmentData, family);
		});
	}
}

test("failed refusal save preserves the already archived halfwave point evidence and later retry", async () => {
	const f = fixture("bloss_halfwave_in");
	const entry = await f.points.run(f.draft);
	const before = f.spot.getState(), diskBefore = f.disk();
	f.failNext();
	await assert.rejects(f.spot.storeHorizontalReceipt({ objectId: "A099", entry: f.refusal }), /combined save failure/);
	assert.deepEqual(f.spot.getState(), before);
	assert.deepEqual(f.disk(), diskBefore);
	assert.equal(f.writes, 1);
	await f.spot.storeHorizontalReceipt({ objectId: "A099", entry: f.refusal });
	assert.deepEqual(f.spot.getState().objects.A099.data.extended.pointObservationEvidence, [entry]);
	assert.equal(f.writes, 2);
});

test("failed point save preserves the already archived refusal and later retry", async () => {
	const f = fixture("bloss_halfwave_out");
	await f.spot.storeHorizontalReceipt({ objectId: "A099", entry: f.refusal });
	const before = f.spot.getState(), diskBefore = f.disk();
	f.failNext();
	await assert.rejects(f.points.run(f.draft), /combined save failure/);
	assert.deepEqual(f.spot.getState(), before);
	assert.deepEqual(f.disk(), diskBefore);
	assert.equal(f.writes, 1);
	await f.points.run(f.draft);
	assert.deepEqual(f.spot.getState().objects.A099.data.extended.horizontalRealizationReceipts, [f.refusal]);
	assert.equal(f.writes, 2);
});
