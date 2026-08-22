import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const moduleUrl = new URL(
	"../../../src/aim-core/alignment/profile/ChainageMapping.js",
	import.meta.url
);
const docUrl = new URL(
	"../../../docs/app/architecture/aim-core/chainage/CHAINAGE-MAPPING-v0.1.md",
	import.meta.url
);
const {
	CHAINAGE_MAPPING_VERSION,
	ChainageMappingError,
	isChainageMapping,
	assertChainageMapping,
	createChainageMapping,
	appendChainageSegment,
	mapIntrinsicToChainage,
	mapChainageToIntrinsic,
} = await import(moduleUrl);

const increasing = {
	id: "A",
	startS: 0,
	endS: 100,
	startAddress: 1000,
	direction: 1,
};
const decreasing = {
	id: "D",
	startS: 0,
	endS: 100,
	startAddress: 2000,
	direction: -1,
};

function emptyMapping() {
	return createChainageMapping({
		id: "mapping-A",
		alignmentId: "alignment-A",
		schemeId: "scheme-A",
		schemeVersion: "version-1",
	});
}

function expectCode(code, operation) {
	assert.throws(operation, (error) => {
		assert.equal(error instanceof ChainageMappingError, true);
		assert.equal(error.code, code);
		return true;
	});
}

test("creates an empty valid frozen mapping with four distinct identities/version fields", () => {
	const mapping = emptyMapping();
	assert.equal(mapping.contractVersion, CHAINAGE_MAPPING_VERSION);
	assert.equal(mapping.type, "ChainageMapping");
	assert.equal(mapping.id, "mapping-A");
	assert.equal(mapping.alignmentId, "alignment-A");
	assert.equal(mapping.schemeId, "scheme-A");
	assert.equal(mapping.schemeVersion, "version-1");
	assert.equal(mapping.longitudinalParameter, "intrinsic-s");
	assert.equal(mapping.addressQuantity, "chainage");
	assert.equal(mapping.unit, "alignment-length-unit");
	assert.equal(isChainageMapping(mapping), true);
	assert.equal(assertChainageMapping(mapping), mapping);
	assert.equal(Object.isFrozen(mapping), true);
	assert.equal(Object.isFrozen(mapping.segments), true);
});

test("rejects invalid mapping, Alignment, scheme, and version identities with INVALID_ID", () => {
	for (const field of [
		"id",
		"alignmentId",
		"schemeId",
		"schemeVersion",
	]) {
		const input = {
			id: "mapping-A",
			alignmentId: "alignment-A",
			schemeId: "scheme-A",
			schemeVersion: "version-1",
			[field]: " ",
		};
		expectCode("INVALID_ID", () => createChainageMapping(input));
	}
});

test("appends an increasing segment immutably and freezes owned records", () => {
	const mapping = { ...emptyMapping(), extension: { retain: true } };
	const before = structuredClone(mapping);
	const appended = appendChainageSegment(mapping, {
		...increasing,
		evidence: { zero: 0 },
	});
	assert.deepEqual(mapping, before);
	assert.notEqual(appended, mapping);
	assert.notEqual(appended.segments, mapping.segments);
	assert.equal(appended.extension, mapping.extension);
	assert.equal(Object.isFrozen(appended), true);
	assert.equal(Object.isFrozen(appended.segments), true);
	assert.equal(Object.isFrozen(appended.segments[0]), true);
});

test("maps intrinsic start/interior/end to increasing addresses", () => {
	const mapping = appendChainageSegment(emptyMapping(), increasing);
	for (const [s, address] of [[0, 1000], [50, 1050], [100, 1100]]) {
		const result = mapIntrinsicToChainage(mapping, { s });
		assert.equal(result.length, 1);
		assert.equal(result[0].s, s);
		assert.equal(result[0].address, address);
		assert.equal(Object.isFrozen(result), true);
		assert.equal(Object.isFrozen(result[0]), true);
	}
});

test("reverse-maps increasing start/interior/end addresses", () => {
	const mapping = appendChainageSegment(emptyMapping(), increasing);
	for (const [address, s] of [[1000, 0], [1050, 50], [1100, 100]]) {
		const result = mapChainageToIntrinsic(mapping, { address });
		assert.equal(result.length, 1);
		assert.equal(result[0].address, address);
		assert.equal(result[0].s, s);
	}
});

test("maps and reverse-maps a decreasing segment", () => {
	const mapping = appendChainageSegment(emptyMapping(), decreasing);
	assert.equal(
		mapIntrinsicToChainage(mapping, { s: 25 })[0].address,
		1975
	);
	assert.equal(
		mapChainageToIntrinsic(mapping, { address: 1975 })[0].s,
		25
	);
});

test("returns empty frozen arrays for finite unmapped intrinsic positions and addresses", () => {
	const mapping = appendChainageSegment(emptyMapping(), increasing);
	const forward = mapIntrinsicToChainage(mapping, { s: 200 });
	const reverse = mapChainageToIntrinsic(mapping, { address: 2000 });
	assert.deepEqual(forward, []);
	assert.deepEqual(reverse, []);
	assert.equal(Object.isFrozen(forward), true);
	assert.equal(Object.isFrozen(reverse), true);
});

test("permits intrinsic gaps and leaves the gap unmapped", () => {
	let mapping = appendChainageSegment(emptyMapping(), {
		...increasing,
		endS: 50,
	});
	mapping = appendChainageSegment(mapping, {
		id: "B",
		startS: 100,
		endS: 150,
		startAddress: 2000,
		direction: 1,
	});
	assert.deepEqual(mapIntrinsicToChainage(mapping, { s: 75 }), []);
});

test("permits overlapping address ranges and returns multiple reverse candidates in segment order", () => {
	let mapping = appendChainageSegment(emptyMapping(), increasing);
	mapping = appendChainageSegment(mapping, {
		id: "B",
		startS: 200,
		endS: 300,
		startAddress: 1050,
		direction: 1,
	});
	const result = mapChainageToIntrinsic(mapping, { address: 1075 });
	assert.deepEqual(result.map(({ segmentId, s }) => ({ segmentId, s })), [
		{ segmentId: "A", s: 75 },
		{ segmentId: "B", s: 225 },
	]);
});

test("represents a touching-boundary address jump with both back/ahead forward candidates", () => {
	let mapping = appendChainageSegment(emptyMapping(), {
		...increasing,
		id: "BACK",
	});
	mapping = appendChainageSegment(mapping, {
		id: "AHEAD",
		startS: 100,
		endS: 200,
		startAddress: 1200,
		direction: 1,
	});
	assert.deepEqual(
		mapIntrinsicToChainage(mapping, { s: 100 }).map(
			({ segmentId, address }) => ({ segmentId, address })
		),
		[
			{ segmentId: "BACK", address: 1100 },
			{ segmentId: "AHEAD", address: 1200 },
		]
	);
});

test("reverse-maps both sides of an address jump to the shared intrinsic boundary", () => {
	let mapping = appendChainageSegment(emptyMapping(), {
		...increasing,
		id: "BACK",
	});
	mapping = appendChainageSegment(mapping, {
		id: "AHEAD",
		startS: 100,
		endS: 200,
		startAddress: 1200,
		direction: 1,
	});
	assert.deepEqual(
		mapChainageToIntrinsic(mapping, { address: 1100 }).map(
			({ segmentId, s }) => ({ segmentId, s })
		),
		[{ segmentId: "BACK", s: 100 }]
	);
	assert.deepEqual(
		mapChainageToIntrinsic(mapping, { address: 1200 }).map(
			({ segmentId, s }) => ({ segmentId, s })
		),
		[{ segmentId: "AHEAD", s: 100 }]
	);
});

test("rejects duplicate segment identity without mutation", () => {
	const mapping = appendChainageSegment(emptyMapping(), increasing);
	const before = structuredClone(mapping);
	expectCode("SEGMENT_ALREADY_EXISTS", () =>
		appendChainageSegment(mapping, {
			...increasing,
			startS: 100,
			endS: 200,
		})
	);
	assert.deepEqual(mapping, before);
});

test("rejects invalid/missing numeric fields with INVALID_SEGMENT without mutation", () => {
	const mapping = emptyMapping();
	const before = structuredClone(mapping);
	const missing = { ...increasing };
	delete missing.startAddress;
	expectCode("INVALID_SEGMENT", () =>
		appendChainageSegment(mapping, missing)
	);
	expectCode("INVALID_SEGMENT", () =>
		appendChainageSegment(mapping, { ...increasing, startS: NaN })
	);
	assert.deepEqual(mapping, before);
});

test("rejects invalid direction with INVALID_DIRECTION and zero/negative domains with INVALID_DOMAIN without mutation", () => {
	const mapping = emptyMapping();
	const before = structuredClone(mapping);
	expectCode("INVALID_DIRECTION", () =>
		appendChainageSegment(mapping, { ...increasing, direction: 0 })
	);
	for (const endS of [0, -1]) {
		expectCode("INVALID_DOMAIN", () =>
			appendChainageSegment(mapping, { ...increasing, endS })
		);
	}
	assert.deepEqual(mapping, before);
});

test("rejects out-of-order and interior-overlapping intrinsic domains with their exact codes without mutation", () => {
	const mapping = appendChainageSegment(emptyMapping(), {
		...increasing,
		startS: 100,
		endS: 200,
	});
	const before = structuredClone(mapping);
	expectCode("OUT_OF_ORDER_DOMAIN", () =>
		appendChainageSegment(mapping, {
			...increasing,
			id: "B",
			startS: 99,
			endS: 250,
		})
	);
	expectCode("OVERLAPPING_INTRINSIC_DOMAIN", () =>
		appendChainageSegment(mapping, {
			...increasing,
			id: "B",
			startS: 150,
			endS: 250,
		})
	);
	assert.deepEqual(mapping, before);
});

test("validator rejects altered contract metadata, duplicate IDs, invalid directions, invalid domains, or overlapping prebuilt segments", () => {
	const valid = appendChainageSegment(emptyMapping(), increasing);
	for (const field of [
		"contractVersion",
		"type",
		"longitudinalParameter",
		"addressQuantity",
		"unit",
	]) {
		assert.equal(
			isChainageMapping({ ...valid, [field]: "altered" }),
			false
		);
	}
	assert.equal(
		isChainageMapping({
			...valid,
			segments: [valid.segments[0], { ...valid.segments[0] }],
		}),
		false
	);
	assert.equal(
		isChainageMapping({
			...valid,
			segments: [{ ...valid.segments[0], direction: 0 }],
		}),
		false
	);
	assert.equal(
		isChainageMapping({
			...valid,
			segments: [{ ...valid.segments[0], endS: 0 }],
		}),
		false
	);
	assert.equal(
		isChainageMapping({
			...valid,
			segments: [
				valid.segments[0],
				{ ...valid.segments[0], id: "B", startS: 50, endS: 150 },
			],
		}),
		false
	);
});

test("preserves unknown extensions while chainage source evidence, CRS, topology, horizontal, vertical, cant, speed, and UI-like extensions do not affect lookup", () => {
	const extensions = {
		sourceEvidence: { row: 7 },
		crs: { id: "none" },
		topology: { edge: "E" },
		horizontal: { curvature: 3 },
		vertical: { gradient: 4 },
		cant: { crossLevel: 5 },
		speed: 160,
		ui: { label: "km" },
	};
	const base = { ...emptyMapping(), ...extensions };
	const mapping = appendChainageSegment(base, {
		...increasing,
		segmentEvidence: { source: "synthetic" },
	});
	for (const key of Object.keys(extensions)) {
		assert.equal(mapping[key], base[key]);
	}
	assert.equal(
		mapIntrinsicToChainage(mapping, { s: 50 })[0].address,
		1050
	);
});

test("source/document dependency scan proves zero imports and no forbidden dependency", async () => {
	const source = await readFile(moduleUrl, "utf8");
	const documentation = await readFile(docUrl, "utf8");
	assert.equal(/^\s*import\s/m.test(source), false);
	for (const forbidden of [
		"app/",
		"window",
		"document",
		"Worker",
		"Messaging",
		"SPOT",
		"GND",
		"src/import",
		"TrackNetworkTopology",
		"HorizontalConstructiveState",
		"VerticalConstructiveState",
		"CantConstructiveState",
		"AXTRAN",
	]) {
		assert.equal(source.includes(forbidden), false);
	}
	assert.match(documentation, /zero imports/);
	assert.match(documentation, /not this Core mapping/);
	assert.match(
		documentation,
		/non-canonical\s+comparison\s+evidence/
	);
});
