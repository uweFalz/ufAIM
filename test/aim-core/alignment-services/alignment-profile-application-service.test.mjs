import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	appendVerticalElement,
	createVerticalConstructiveState,
} from "../../../src/aim-core/alignment/profile/VerticalConstructiveState.js";
import {
	appendCantElement,
	createCantConstructiveState,
} from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";
import {
	appendChainageSegment,
	createChainageMapping,
} from "../../../src/aim-core/alignment/profile/ChainageMapping.js";
import {
	AlignmentProfileEvaluationServiceError,
} from "../../../src/aim-core/alignment/profile/AlignmentProfileEvaluationService.js";
import AlignmentProfileApplicationService, {
	ALIGNMENT_PROFILE_APPLICATION_SERVICE_VERSION,
	ALIGNMENT_PROFILE_BATCH_RESULT_VERSION,
	AlignmentProfileApplicationServiceError,
} from "../../../src/services/alignment/AlignmentProfileApplicationService.js";

const alignmentId = "alignment-A";

function vertical(owner = alignmentId, { empty = false } = {}) {
	const state = createVerticalConstructiveState({
		id: `vertical-${owner}`,
		alignmentId: owner,
	});
	return empty
		? state
		: appendVerticalElement(state, {
				id: "V",
				type: "constant-gradient",
				startS: 0,
				endS: 100,
				startElevation: 10,
				gradient: 0.01,
			});
}

function cant(owner = alignmentId, { empty = false } = {}) {
	const state = createCantConstructiveState({
		id: `cant-${owner}`,
		alignmentId: owner,
	});
	return empty
		? state
		: appendCantElement(state, {
				id: "C",
				type: "linear-cross-level",
				startS: 0,
				endS: 100,
				startCrossLevel: 0,
				crossLevelRate: 0.001,
			});
}

function mapping({
	owner = alignmentId,
	id = "mapping-K",
	schemeId = "K",
	schemeVersion = "v1",
	segments = [
		{
			id: "S",
			startS: 0,
			endS: 100,
			startAddress: 1000,
			direction: 1,
		},
	],
} = {}) {
	let value = createChainageMapping({
		id,
		alignmentId: owner,
		schemeId,
		schemeVersion,
	});
	for (const segment of segments) {
		value = appendChainageSegment(value, segment);
	}
	return value;
}

function record(owner = alignmentId, overrides = {}) {
	return {
		alignmentId: owner,
		vertical: vertical(owner),
		cant: cant(owner),
		chainageMappings: [mapping({ owner })],
		...overrides,
	};
}

function expectApplicationCode(code, operation) {
	return assert.rejects(operation, (error) => {
		assert.equal(error instanceof AlignmentProfileApplicationServiceError, true);
		assert.equal(error.code, code);
		return true;
	});
}

test("constructs from explicit valid records and exposes the fixed service version", () => {
	const service = new AlignmentProfileApplicationService({
		records: [record()],
	});
	assert.equal(service instanceof AlignmentProfileApplicationService, true);
	assert.equal(
		ALIGNMENT_PROFILE_APPLICATION_SERVICE_VERSION,
		"app-service/alignment-profile-evaluation/0.1"
	);
});

test("evaluateAt returns the Core result for vertical, cant, and chainage without reshaping", async () => {
	const service = new AlignmentProfileApplicationService({
		records: [record()],
	});
	const result = await service.evaluateAt({ alignmentId, s: 50 });
	assert.equal(result.contractVersion, "aim-core/alignment-profile-evaluation-result/0.1");
	assert.equal(result.vertical.value.elevation, 10.5);
	assert.equal(result.cant.value.crossLevel, 0.05);
	assert.equal(result.chainage.mappings[0].candidates[0].address, 1050);
	assert.equal(Object.isFrozen(result), true);
});

test("evaluateAt preserves Core errors unchanged by identity", async () => {
	const service = new AlignmentProfileApplicationService();
	let observed;
	try {
		await service.evaluateAt({ alignmentId: "", s: 0 });
	} catch (error) {
		observed = error;
	}
	assert.equal(observed instanceof AlignmentProfileEvaluationServiceError, true);
	assert.equal(observed instanceof AlignmentProfileApplicationServiceError, false);
	assert.equal(observed.code, "INVALID_REQUEST");
	assert.equal(await Promise.reject(observed).catch((error) => error), observed);
});

test("evaluateMany preserves requested position order and duplicates", async () => {
	const positions = [0, 50, 50, 100];
	const service = new AlignmentProfileApplicationService({
		records: [record()],
	});
	const result = await service.evaluateMany({
		alignmentId: " alignment-A ",
		positions,
	});
	assert.equal(result.contractVersion, ALIGNMENT_PROFILE_BATCH_RESULT_VERSION);
	assert.equal(result.alignmentId, alignmentId);
	assert.deepEqual(result.positions, positions);
	assert.deepEqual(
		result.results.map((entry) => entry.s),
		positions
	);
	assert.notEqual(result.positions, positions);
});

test("batch results contain expected vertical, cant, and chainage values at multiple positions", async () => {
	const service = new AlignmentProfileApplicationService({
		records: [record()],
	});
	const result = await service.evaluateMany({
		alignmentId,
		positions: [0, 50, 50, 100],
	});
	assert.deepEqual(
		result.results.map((entry) => [
			entry.vertical.value.elevation,
			entry.cant.value.crossLevel,
			entry.chainage.mappings[0].candidates[0].address,
		]),
		[
			[10, 0, 1000],
			[10.5, 0.05, 1050],
			[10.5, 0.05, 1050],
			[11, 0.1, 1100],
		]
	);
});

test("empty positions return frozen empty arrays and perform no state mutation", async () => {
	const snapshot = record();
	const before = structuredClone(snapshot);
	const service = new AlignmentProfileApplicationService({
		records: [snapshot],
	});
	const result = await service.evaluateMany({ alignmentId, positions: [] });
	assert.deepEqual(result.positions, []);
	assert.deepEqual(result.results, []);
	assert.equal(Object.isFrozen(result.positions), true);
	assert.equal(Object.isFrozen(result.results), true);
	assert.deepEqual(snapshot, before);
});

test("rejects blank/non-string Alignment identity, non-array positions, and non-finite entries with INVALID_BATCH_REQUEST before evaluation", async () => {
	const snapshot = record();
	const before = structuredClone(snapshot);
	const service = new AlignmentProfileApplicationService({
		records: [snapshot],
	});
	for (const request of [
		{ alignmentId: "", positions: [] },
		{ alignmentId: 42, positions: [] },
		{ alignmentId, positions: null },
		{ alignmentId, positions: [0, Number.NaN] },
		{ alignmentId, positions: [Number.POSITIVE_INFINITY] },
	]) {
		await expectApplicationCode(
			"INVALID_BATCH_REQUEST",
			() => service.evaluateMany(request)
		);
	}
	assert.deepEqual(snapshot, before);
});

test("supports multiple explicit Alignment records and never falls back to another Alignment", async () => {
	const service = new AlignmentProfileApplicationService({
		records: [
			record("alignment-A"),
			record("alignment-B", {
				vertical: appendVerticalElement(
					createVerticalConstructiveState({
						id: "vertical-B",
						alignmentId: "alignment-B",
					}),
					{
						id: "VB",
						type: "constant-gradient",
						startS: 0,
						endS: 100,
						startElevation: 100,
						gradient: 0,
					}
				),
			}),
		],
	});
	const resultB = await service.evaluateMany({
		alignmentId: "alignment-B",
		positions: [50],
	});
	assert.equal(resultB.results[0].vertical.value.elevation, 100);
	const missing = await service.evaluateMany({
		alignmentId: "alignment-missing",
		positions: [50],
	});
	assert.equal(missing.results[0].vertical.status, "absent");
	assert.equal(missing.results[0].cant.status, "absent");
	assert.equal(missing.results[0].chainage.status, "absent");
});

test("preserves absent/not-covered component states and multiple chainage candidates in batch results", async () => {
	const jumping = mapping({
		segments: [
			{
				id: "BACK",
				startS: 0,
				endS: 100,
				startAddress: 1000,
				direction: 1,
			},
			{
				id: "AHEAD",
				startS: 100,
				endS: 200,
				startAddress: 1200,
				direction: 1,
			},
		],
	});
	const service = new AlignmentProfileApplicationService({
		records: [
			record(alignmentId, {
				vertical: null,
				cant: cant(alignmentId, { empty: true }),
				chainageMappings: [jumping],
			}),
		],
	});
	const result = await service.evaluateMany({
		alignmentId,
		positions: [100],
	});
	const entry = result.results[0];
	assert.deepEqual(entry.vertical, { status: "absent" });
	assert.deepEqual(entry.cant, {
		status: "not-covered",
		code: "EMPTY_CANT",
	});
	assert.deepEqual(
		entry.chainage.mappings[0].candidates.map((candidate) => candidate.address),
		[1100, 1200]
	);
});

test("batch envelope, positions, and results arrays are frozen while input positions and Core states remain byte-identical", async () => {
	const snapshot = record();
	const before = structuredClone(snapshot);
	const positions = [0, 50];
	const service = new AlignmentProfileApplicationService({
		records: [snapshot],
	});
	const result = await service.evaluateMany({ alignmentId, positions });
	assert.equal(Object.isFrozen(result), true);
	assert.equal(Object.isFrozen(result.positions), true);
	assert.equal(Object.isFrozen(result.results), true);
	assert.equal(Object.isFrozen(result.results[0]), true);
	assert.deepEqual(positions, [0, 50]);
	assert.equal(Object.isFrozen(positions), false);
	assert.deepEqual(snapshot, before);
});

test("wraps a deterministic Core failure with BATCH_EVALUATION_FAILED, original cause, exact failing index, stops before later entries, and leaves inputs unchanged", async () => {
	const mutableVertical = structuredClone(vertical());
	const snapshot = record(alignmentId, { vertical: mutableVertical });
	const service = new AlignmentProfileApplicationService({
		records: [snapshot],
	});
	mutableVertical.type = "InvalidAfterConstruction";
	const positions = [25, 50, 75];
	const positionsBefore = structuredClone(positions);
	const snapshotBefore = structuredClone(snapshot);
	let observed;
	try {
		await service.evaluateMany({ alignmentId, positions });
	} catch (error) {
		observed = error;
	}
	assert.equal(observed instanceof AlignmentProfileApplicationServiceError, true);
	assert.equal(observed.code, "BATCH_EVALUATION_FAILED");
	assert.equal(observed.index, 0);
	assert.equal(
		observed.cause instanceof AlignmentProfileEvaluationServiceError,
		true
	);
	assert.equal(observed.cause.code, "INVALID_PORT_RESULT");
	assert.deepEqual(positions, positionsBefore);
	assert.deepEqual(snapshot, snapshotBefore);
});

test("source/document dependency scan proves exactly the three authorized service imports and no App UI, browser, DOM, Worker, Messaging, SPOT, storage, persistence, import, GND, LandXML, selection, focus, adapter translation, or harness dependency", async () => {
	const sourceUrl = new URL(
		"../../../src/services/alignment/AlignmentProfileApplicationService.js",
		import.meta.url
	);
	const documentUrl = new URL(
		"../../../docs/app/architecture/aim-core/services/ALIGNMENT-PROFILE-APPLICATION-SERVICE-v0.1.md",
		import.meta.url
	);
	const [source, document] = await Promise.all([
		readFile(sourceUrl, "utf8"),
		readFile(documentUrl, "utf8"),
	]);
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
		(match) => match[1]
	);
	assert.deepEqual(imports, [
		"./StaticAlignmentProfileStateReaderAdapter.js",
		"../../aim-core/alignment/profile/AlignmentProfileEvaluationService.js",
		"./createSynchronizedAlignmentProfileProjection.js",
	]);
	for (const forbidden of [
		"app/",
		"document",
		"window",
		"Worker",
		"Messaging",
		"SPOT",
		"storage",
		"persistence",
		"LandXML",
		"GND",
		"selection",
		"focus",
		"harness",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
	assert.equal(document.includes("adapter translation"), false);
});
