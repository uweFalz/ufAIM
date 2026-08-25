import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	assertAlignmentProfileStateReaderPort,
} from "../../../src/aim-core/alignment/profile/AlignmentProfileStateReaderPort.js";
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
	AlignmentProfileEvaluationService,
} from "../../../src/aim-core/alignment/profile/AlignmentProfileEvaluationService.js";
import StaticAlignmentProfileStateReaderAdapter, {
	STATIC_ALIGNMENT_PROFILE_STATE_READER_ADAPTER_VERSION,
	StaticAlignmentProfileStateReaderAdapterError,
} from "../../../src/services/alignment/StaticAlignmentProfileStateReaderAdapter.js";

const alignmentId = "alignment-A";

function vertical(id = alignmentId) {
	return appendVerticalElement(
		createVerticalConstructiveState({ id: `vertical-${id}`, alignmentId: id }),
		{
			id: "V",
			type: "constant-gradient",
			startS: 0,
			endS: 100,
			startElevation: 10,
			gradient: 0.01,
		}
	);
}

function cant(id = alignmentId) {
	return appendCantElement(
		createCantConstructiveState({ id: `cant-${id}`, alignmentId: id }),
		{
			id: "C",
			type: "linear-cross-level",
			startS: 0,
			endS: 100,
			startCrossLevel: 0,
			crossLevelRate: 0.001,
		}
	);
}

function chainage({
	id = "mapping-K",
	owner = alignmentId,
	schemeId = "K",
	schemeVersion = "v1",
} = {}) {
	return appendChainageSegment(
		createChainageMapping({
			id,
			alignmentId: owner,
			schemeId,
			schemeVersion,
		}),
		{
			id: `segment-${id}`,
			startS: 0,
			endS: 100,
			startAddress: 1000,
			direction: 1,
		}
	);
}

function completeRecord(overrides = {}) {
	return {
		alignmentId,
		vertical: vertical(),
		cant: cant(),
		chainageMappings: [chainage()],
		...overrides,
	};
}

function expectCode(code, operation) {
	assert.throws(operation, (error) => {
		assert.equal(
			error instanceof StaticAlignmentProfileStateReaderAdapterError,
			true
		);
		assert.equal(error.code, code);
		return true;
	});
}

test("constructs a conforming port from one complete explicit snapshot record", () => {
	const adapter = new StaticAlignmentProfileStateReaderAdapter({
		records: [completeRecord()],
	});
	assert.equal(assertAlignmentProfileStateReaderPort(adapter), adapter);
	assert.equal(
		STATIC_ALIGNMENT_PROFILE_STATE_READER_ADAPTER_VERSION,
		"app-adapter/static-alignment-profile-state-reader/0.1"
	);
});

test("returns vertical and cant by identical reference and a frozen copied chainage array", () => {
	const record = completeRecord();
	const callerMappings = record.chainageMappings;
	const adapter = new StaticAlignmentProfileStateReaderAdapter({
		records: [record],
	});
	assert.equal(adapter.loadVerticalByAlignmentId(alignmentId), record.vertical);
	assert.equal(adapter.loadCantByAlignmentId(alignmentId), record.cant);
	const mappings = adapter.loadChainageMappingsByAlignmentId(alignmentId);
	assert.notEqual(mappings, callerMappings);
	assert.equal(mappings[0], callerMappings[0]);
	assert.equal(Object.isFrozen(mappings), true);
	assert.equal(adapter.loadChainageMappingsByAlignmentId(alignmentId), mappings);
});

test("returns null, null, and frozen empty array for an unknown Alignment", () => {
	const adapter = new StaticAlignmentProfileStateReaderAdapter();
	assert.equal(adapter.loadVerticalByAlignmentId("missing"), null);
	assert.equal(adapter.loadCantByAlignmentId("missing"), null);
	const mappings = adapter.loadChainageMappingsByAlignmentId("missing");
	assert.deepEqual(mappings, []);
	assert.equal(Object.isFrozen(mappings), true);
});

test("trims a valid requested Alignment ID and rejects blank/non-string requests with INVALID_ALIGNMENT_ID", () => {
	const record = completeRecord();
	const adapter = new StaticAlignmentProfileStateReaderAdapter({
		records: [record],
	});
	assert.equal(adapter.loadVerticalByAlignmentId(" alignment-A "), record.vertical);
	for (const value of ["", "   ", null, 42]) {
		expectCode("INVALID_ALIGNMENT_ID", () =>
			adapter.loadCantByAlignmentId(value)
		);
	}
});

test("snapshots record membership and mapping order so later caller record/array replacement, append, or reorder cannot change reads", () => {
	const first = chainage({ id: "mapping-first" });
	const second = chainage({ id: "mapping-second" });
	const mappings = [first, second];
	const record = completeRecord({ chainageMappings: mappings });
	const originalVertical = record.vertical;
	const adapter = new StaticAlignmentProfileStateReaderAdapter({
		records: [record],
	});
	mappings.reverse();
	mappings.push(chainage({ id: "mapping-third" }));
	record.chainageMappings = [];
	record.vertical = null;
	record.alignmentId = "alignment-B";
	assert.equal(adapter.loadVerticalByAlignmentId(alignmentId), originalVertical);
	assert.deepEqual(
		adapter
			.loadChainageMappingsByAlignmentId(alignmentId)
			.map((mapping) => mapping.id),
		["mapping-first", "mapping-second"]
	);
	assert.deepEqual(adapter.loadChainageMappingsByAlignmentId("alignment-B"), []);
});

test("supports explicit absent vertical/cant and empty chainage without fabrication", () => {
	const adapter = new StaticAlignmentProfileStateReaderAdapter({
		records: [
			completeRecord({
				vertical: null,
				cant: null,
				chainageMappings: [],
			}),
		],
	});
	assert.equal(adapter.loadVerticalByAlignmentId(alignmentId), null);
	assert.equal(adapter.loadCantByAlignmentId(alignmentId), null);
	assert.deepEqual(adapter.loadChainageMappingsByAlignmentId(alignmentId), []);
});

test("rejects non-array records with INVALID_RECORDS without mutation", () => {
	const records = { preserved: true };
	const before = structuredClone(records);
	expectCode(
		"INVALID_RECORDS",
		() => new StaticAlignmentProfileStateReaderAdapter({ records })
	);
	assert.deepEqual(records, before);
});

test("rejects non-object records, missing members, invalid state shapes, null/non-array chainage, and invalid mappings with INVALID_RECORD without mutation", () => {
	const cases = [
		null,
		{},
		completeRecord({ vertical: {} }),
		completeRecord({ cant: {} }),
		completeRecord({ chainageMappings: null }),
		completeRecord({ chainageMappings: {} }),
		completeRecord({ chainageMappings: [{}] }),
	];
	for (const record of cases) {
		const before = structuredClone(record);
		expectCode(
			"INVALID_RECORD",
			() => new StaticAlignmentProfileStateReaderAdapter({ records: [record] })
		);
		assert.deepEqual(record, before);
	}
});

test("rejects blank record identity with INVALID_ALIGNMENT_ID and duplicate records with DUPLICATE_ALIGNMENT_ID", () => {
	expectCode(
		"INVALID_ALIGNMENT_ID",
		() =>
			new StaticAlignmentProfileStateReaderAdapter({
				records: [completeRecord({ alignmentId: " " })],
			})
	);
	expectCode(
		"DUPLICATE_ALIGNMENT_ID",
		() =>
			new StaticAlignmentProfileStateReaderAdapter({
				records: [completeRecord(), completeRecord()],
			})
	);
});

test("rejects vertical, cant, or mapping Alignment mismatch with ALIGNMENT_ID_MISMATCH", () => {
	for (const record of [
		completeRecord({ vertical: vertical("alignment-B") }),
		completeRecord({ cant: cant("alignment-B") }),
		completeRecord({
			chainageMappings: [chainage({ owner: "alignment-B" })],
		}),
	]) {
		expectCode(
			"ALIGNMENT_ID_MISMATCH",
			() => new StaticAlignmentProfileStateReaderAdapter({ records: [record] })
		);
	}
});

test("rejects duplicate mapping identity within one record with DUPLICATE_MAPPING_ID", () => {
	const mapping = chainage();
	expectCode(
		"DUPLICATE_MAPPING_ID",
		() =>
			new StaticAlignmentProfileStateReaderAdapter({
				records: [
					completeRecord({ chainageMappings: [mapping, mapping] }),
				],
			})
	);
});

test("integration and dependency test: AlignmentProfileEvaluationService evaluates the adapter’s synthetic vertical/cant/chainage state correctly, and source scan confirms only authorized Core imports with no forbidden dependency", async () => {
	const adapter = new StaticAlignmentProfileStateReaderAdapter({
		records: [completeRecord()],
	});
	const service = new AlignmentProfileEvaluationService({
		stateReader: adapter,
	});
	const result = await service.evaluateAt({ alignmentId, s: 50 });
	assert.equal(result.vertical.value.elevation, 10.5);
	assert.equal(result.vertical.value.gradient, 0.01);
	assert.equal(result.cant.value.crossLevel, 0.05);
	assert.equal(result.cant.value.twist, 0.001);
	assert.equal(result.chainage.mappings[0].candidates[0].address, 1050);

	const source = await readFile(
		new URL(
			"../../../src/services/alignment/StaticAlignmentProfileStateReaderAdapter.js",
			import.meta.url
		),
		"utf8"
	);
	const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
		(match) => match[1]
	);
	assert.deepEqual(imports, [
		"../../aim-core/alignment/profile/AlignmentProfileStateReaderPort.js",
		"../../aim-core/alignment/profile/VerticalConstructiveState.js",
		"../../aim-core/alignment/profile/CantConstructiveState.js",
		"../../aim-core/alignment/profile/RailPairCantConstructiveState.js",
		"../../aim-core/alignment/profile/ChainageMapping.js",
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
		"harness",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});
