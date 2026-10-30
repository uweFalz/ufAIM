import assert from "node:assert/strict";
import test from "node:test";
import { createSpotStore } from "../../../src/model/spot/model/SpotStore.js";
import { createSpotService } from "../../../src/shared/messaging/service/SpotService.js";
import { createMetricContext } from "../../../src/domain/optimization/alignment/MetricContext.js";
import { createAlignmentPointObservationService } from "../../../src/services/alignment/AlignmentPointObservationService.js";
import { validatePointObservationRecord } from "../../../src/services/alignment/AlignmentPointObservationRecord.js";
import { IndexedDbSpotStateAdapter } from "../../../src/shared/persistence/IndexedDbSpotStateAdapter.js";

function fixture() {
	const context = createMetricContext({
		id: "survey:local", lengthAuthority: "ground", unit: "m", referenceFrame: "local-survey-plane",
		distanceOperator: "euclidean", angleConvention: "mathematical",
		provenance: { source: "fixture:093" }, tolerancePolicy: { unit: "m" },
	});
	const data = {
		type: "AlignmentData", id: "A1", name: "A1", meta: { modifiedAt: "r1" },
		source: { kind: "editor", native: true },
		editModel: {
			startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
			elements: [
				{ id: "S1", type: "straight", parameters: { length: 100 } },
				{ id: "T1", type: "transition", parameters: { length: 60, transitionType: "bloss" } },
				{ id: "A1", type: "arc", parameters: { length: 100, curvature: 1 / 300 } },
			],
		},
	};
	const object = {
		id: "A1", type: "alignment", data: { alignmentData: data, kernel: { preserve: true }, extended: { other: { preserve: true } } },
		meta: { modifiedAt: "r1" }, refs: { sourceId: "source-A1" },
	};
	const draft = {
		runId: "run:093", objectId: "A1",
		pointObservationInput: {
			observationSet: {
				version: "point-observation-set/1", id: "survey:093", revision: "s1",
				source: { kind: "survey-import", reference: "fixture:093", observedAt: null, note: "synthetic offline fixture, not a field survey" },
				metricContext: context,
				points: [
					{ id: "P1", x: 20, y: 2, quality: { status: "not-declared" } },
					{ id: "P2", x: 40, y: -1, quality: { status: "not-declared" } },
					{ id: "P3", x: 70, y: 3, quality: { status: "not-declared" } },
				],
			},
			assignments: ["P1", "P2", "P3"].map((pointId) => ({ pointId, target: 0, tolerance: 0.1, enforcement: "soft" })),
			alignmentMetricContext: context,
		},
		options: { maxIterations: 0 },
	};
	let disk = { meta: { project: "test" }, objects: { A1: object }, coordContexts: { local: { id: "local", type: "local", preserve: true } } };
	let failSave = false, saves = 0;
	const persistence = {
		async load() { return structuredClone(disk); },
		async save(state) {
			if (failSave) throw new Error("write failed");
			saves++;
			disk = structuredClone(state);
		},
	};
	const spotService = createSpotService({ spotStore: createSpotStore(), persistence });
	const service = createAlignmentPointObservationService({ spotService });
	return { object, draft, persistence, spotService, service, fail: () => { failSave = true; }, get saves() { return saves; } };
}

test("external source -> real solver -> durable snapshot -> fresh read, without canonical mutation", async () => {
	const f = fixture();
	const original = structuredClone(f.draft);
	const entry = await f.service.run(f.draft);
	assert.equal(entry.result.pointObservation.mode, "external-observations");
	assert.equal(entry.result.proposalStatus, "max_iterations");
	assert.equal(entry.result.admissible, false);
	assert.ok(entry.result.diagnostics.softResidualRms > 0);
	assert.deepEqual(entry.request.pointObservationInput, original.pointObservationInput);
	assert.deepEqual(f.draft, original);
	const stored = f.spotService.getState().objects.A1;
	assert.deepEqual(stored.data.alignmentData, f.object.data.alignmentData);
	assert.deepEqual(stored.refs, f.object.refs);
	assert.deepEqual(stored.meta, f.object.meta);
	assert.deepEqual(stored.data.kernel, f.object.data.kernel);
	assert.deepEqual(stored.data.extended.other, f.object.data.extended.other);
	const fresh = createAlignmentPointObservationService({
		spotService: createSpotService({ spotStore: createSpotStore(), persistence: f.persistence }),
	});
	const reopened = await fresh.read({ objectId: "A1", runId: f.draft.runId });
	assert.equal(reopened.current, true);
	assert.deepEqual(reopened.entry, entry);
	assert.equal(f.saves, 1, "read has no write or reevaluation");
	entry.request.pointObservationInput.observationSet.points[0].x = 999;
	assert.notEqual((await fresh.read({ objectId: "A1", runId: f.draft.runId })).entry.request.pointObservationInput.observationSet.points[0].x, 999);
});

test("assignment order is independent of original source order", async () => {
	const f = fixture();
	f.draft.pointObservationInput.assignments.reverse();
	const entry = await f.service.run(f.draft);
	assert.deepEqual(entry.result.pointObservation.pointIds, ["P3", "P2", "P1"]);
	assert.deepEqual(entry.request.pointObservationInput.observationSet.points.map((p) => p.id), ["P1", "P2", "P3"]);
});

test("different raw points change real residuals; no substitution by derived samples", async () => {
	const a = fixture(), b = fixture();
	b.draft.pointObservationInput.observationSet.points[0].y = 8;
	const first = await a.service.run(a.draft), second = await b.service.run(b.draft);
	assert.notEqual(first.result.diagnostics.softResidualRms, second.result.diagnostics.softResidualRms);
});

test("caller mutation while hydrate is pending cannot alter input snapshot", async () => {
	const f = fixture();
	const promise = f.service.run(f.draft);
	f.draft.pointObservationInput.observationSet.points[0].x = 999;
	const entry = await promise;
	assert.equal(entry.request.pointObservationInput.observationSet.points[0].x, 20);
});

test("same run replay is idempotent, conflicting run or source revisions fail closed", async () => {
	const f = fixture();
	const entry = await f.service.run(f.draft);
	await f.spotService.storePointObservationEvidence({ objectId: "A1", entry });
	assert.equal(f.spotService.getState().objects.A1.data.extended.pointObservationEvidence.length, 1);
	const changed = structuredClone(f.draft);
	changed.options.maxIterations = 1;
	await assert.rejects(f.service.run(changed), /conflicting run identity/);
	changed.runId = "run:next";
	changed.pointObservationInput.observationSet.points[0].y = 9;
	await assert.rejects(f.service.run(changed), /conflicting observation set revision/);
	changed.pointObservationInput.observationSet.revision = "s2";
	await f.service.run(changed);
	assert.equal(f.spotService.getState().objects.A1.data.extended.pointObservationEvidence.length, 2);
});

test("result swaps and input tampering are rejected on full evaluated-input binding", async () => {
	const f = fixture(), entry = await f.service.run(f.draft);
	for (const alter of [
		(e) => { e.request.pointObservationInput.assignments[0].target = 5; },
		(e) => { e.request.pointObservationInput.assignments[0].tolerance = 2; },
		(e) => { e.request.pointObservationInput.assignments[0].enforcement = "hard"; },
		(e) => { e.request.pointObservationInput.observationSet.points[0].x += 1; },
		(e) => { e.request.afterAlignmentData.editModel.elements[0].parameters.length += 1; },
		(e) => { e.request.options.maxIterations = 2; },
		(e) => { e.request.options.heldPoses = [{ afterElement: "S1", hold: ["x"] }]; },
		(e) => { e.result.admissible = true; },
	]) {
		const invalid = structuredClone(entry);
		alter(invalid);
		assert.throws(() => validatePointObservationRecord(invalid), /invalid|unbound/);
		await assert.rejects(f.spotService.storePointObservationEvidence({ objectId: "A1", entry: invalid }), /invalid|unbound/);
	}
});

test("same-revision geometry/meta/refs changes, deletion and cross-object writes are stale", async () => {
	for (const alter of [
		(o) => { o.data.alignmentData.meta.modifiedAt = "r2"; },
		(o) => { o.data.alignmentData.editModel.elements[0].parameters.length += 1; },
		(o) => { o.refs.sourceId = "different-source"; },
		(o) => { o.meta.modifiedAt = "r2"; },
	]) {
		const f = fixture(), entry = await f.service.run(f.draft);
		const object = f.spotService.getState().objects.A1;
		alter(object);
		await f.spotService.addObjects({ objects: [object] });
		await assert.rejects(f.spotService.storePointObservationEvidence({ objectId: "A1", entry }), /stale or invalid/);
		const old = await f.service.read({ objectId: "A1", runId: entry.request.id });
		assert.equal(old.current, false);
		assert.deepEqual(old.entry, entry);
	}
	const f = fixture(), entry = await f.service.run(f.draft);
	await assert.rejects(f.spotService.storePointObservationEvidence({ objectId: "OTHER", entry }), /stale or invalid/);
	await f.spotService.removeObject({ objectId: "A1" });
	await assert.rejects(f.spotService.storePointObservationEvidence({ objectId: "A1", entry }), /stale or invalid/);
	assert.equal(await f.service.read({ objectId: "A1", runId: entry.request.id }), null);
});

test("queued deletion wins over a computation based on the previous snapshot", async () => {
	const f = fixture();
	await f.spotService.hydrate();
	const remove = f.spotService.removeObject({ objectId: "A1" });
	const run = f.service.run(f.draft);
	await remove;
	await assert.rejects(run, /stale|alignment.*required|revision.*required/);
	assert.deepEqual(f.spotService.getState().objects, {});
});

test("failed write rolls back and cannot erase a subsequently queued rename", async () => {
	const f = fixture();
	let release, started;
	const gate = new Promise((resolve) => { release = resolve; });
	const writing = new Promise((resolve) => { started = resolve; });
	let writes = 0;
	const spot = createSpotService({ spotStore: createSpotStore(), persistence: {
		load: () => f.persistence.load(),
		async save() { if (++writes === 1) { started(); await gate; throw new Error("archive write failed"); } },
	} });
	const service = createAlignmentPointObservationService({ spotService: spot });
	const run = service.run(f.draft);
	await writing;
	const rename = spot.renameObject({ objectId: "A1", name: "Later name" });
	release();
	await assert.rejects(run, /archive write failed/);
	await rename;
	assert.equal(spot.getState().objects.A1.data.alignmentData.name, "Later name");
	assert.equal(spot.getState().objects.A1.data.extended.pointObservationEvidence, undefined);
	assert.deepEqual(spot.getState().objects.A1.data.extended.other, { preserve: true });
});

test("no durable success on unavailable persistence, failed load or failed write", async () => {
	const f = fixture();
	await f.spotService.hydrate();
	const before = f.spotService.getState();
	f.fail();
	await assert.rejects(f.service.run(f.draft), /write failed/);
	assert.deepEqual(f.spotService.getState(), before);
	const memoryOnly = createAlignmentPointObservationService({ spotService: createSpotService({ spotStore: createSpotStore({ objects: { A1: f.object } }) }) });
	await assert.rejects(memoryOnly.run(f.draft), /durable storage unavailable/);
	const failed = createAlignmentPointObservationService({ spotService: createSpotService({
		spotStore: createSpotStore(),
		persistence: { async load() { throw new Error("load failed"); }, async save() { assert.fail("must not save"); } },
	}) });
	await assert.rejects(failed.run(f.draft), /load failed/);
	await assert.rejects(failed.read({ objectId: "A1", runId: "run:093" }), /load failed/);
});

test("explicit invalid input or unsupported options never create an archive", async () => {
	for (const alter of [
		(d) => { d.pointObservationInput = null; },
		(d) => { d.options.sampleCount = 5; },
		(d) => { d.options.maxIterations = NaN; },
		(d) => { d.options.heldElements = ["missing"]; },
		(d) => { d.result = { admissible: true }; },
		(d) => { d.afterAlignmentData = { ...fixture().object.data.alignmentData, id: "OTHER" }; },
	]) {
		const f = fixture();
		alter(f.draft);
		await assert.rejects(f.service.run(f.draft));
		assert.equal(f.saves, 0);
		assert.equal(f.spotService.getState().objects.A1?.data?.extended?.pointObservationEvidence, undefined);
	}
});

test("restore rejects malformed or duplicate archived records, rather than presenting fabricated evidence", async () => {
	const f = fixture(), entry = await f.service.run(f.draft);
	for (const archive of [
		"not-an-array",
		[entry, entry],
		[{ ...entry, result: { ...entry.result, admissible: true } }],
	]) {
		const object = f.spotService.getState().objects.A1;
		object.data.extended.pointObservationEvidence = archive;
		await f.spotService.addObjects({ objects: [object] });
		await assert.rejects(f.service.read({ objectId: "A1", runId: entry.request.id }), /archive|duplicate|invalid|unbound/);
	}
});

// Small injected device double; this exercises the real adapter's snapshot
// serialization, not a browser engine, physical IndexedDB or multi-writer CAS.
function fakeIndexedDb() {
	const values = new Map(), names = new Set();
	const request = (action) => {
		const req = {};
		queueMicrotask(() => { req.result = action(); req.onsuccess?.(); });
		return req;
	};
	const database = {
		objectStoreNames: { contains: (name) => names.has(name) },
		createObjectStore: (name) => names.add(name),
		transaction() {
			const transaction = { objectStore: () => ({
				get: (key) => request(() => structuredClone(values.get(key))),
				put: (value, key) => request(() => {
					values.set(key, structuredClone(value));
					queueMicrotask(() => transaction.oncomplete?.());
					return key;
				}),
			}) };
			return transaction;
		},
	};
	return { open() {
		const req = {};
		queueMicrotask(() => { req.result = database; req.onupgradeneeded?.(); req.onsuccess?.(); });
		return req;
	} };
}

test("actual IndexedDbSpotStateAdapter preserves the complete real run with a fresh store (injected device)", async () => {
	const f = fixture(), device = fakeIndexedDb();
	const adapter = new IndexedDbSpotStateAdapter({ indexedDB: device, dbName: "point-observation-093-test" });
	const spot = createSpotService({ spotStore: createSpotStore(), persistence: adapter });
	await spot.addObjects({ objects: [f.object] });
	const service = createAlignmentPointObservationService({ spotService: spot });
	const entry = await service.run(f.draft);
	const freshAdapter = new IndexedDbSpotStateAdapter({ indexedDB: device, dbName: "point-observation-093-test" });
	const fresh = createAlignmentPointObservationService({
		spotService: createSpotService({ spotStore: createSpotStore(), persistence: freshAdapter }),
	});
	assert.deepEqual(await fresh.read({ objectId: "A1", runId: f.draft.runId }), { entry, current: true });
});
