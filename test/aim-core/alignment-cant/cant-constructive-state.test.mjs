import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const moduleUrl = new URL(
	"../../../src/aim-core/alignment/profile/CantConstructiveState.js",
	import.meta.url
);
const docUrl = new URL(
	"../../../docs/app/architecture/aim-core/cant/CANT-CONSTRUCTIVE-STATE-v0.1.md",
	import.meta.url
);
const {
	CANT_CONSTRUCTIVE_STATE_VERSION,
	CantConstructiveStateError,
	isCantConstructiveState,
	assertCantConstructiveState,
	createCantConstructiveState,
	appendCantElement,
	evaluateCantAt,
} = await import(moduleUrl);

const constant = {
	id: "C0",
	type: "constant-cross-level",
	startS: 0,
	endS: 100,
	startCrossLevel: 0.05,
};
const linear = {
	id: "L0",
	type: "linear-cross-level",
	startS: 0,
	endS: 100,
	startCrossLevel: 0,
	crossLevelRate: 0.001,
};

function emptyState() {
	return createCantConstructiveState({
		id: "cant-A",
		alignmentId: "alignment-A",
	});
}

function expectCode(code, operation) {
	assert.throws(operation, (error) => {
		assert.equal(error instanceof CantConstructiveStateError, true);
		assert.equal(error.code, code);
		return true;
	});
}

function near(actual, expected) {
	assert.ok(Math.abs(actual - expected) <= 1e-12);
}

test("creates an empty valid frozen state with stable state and Alignment identities and fixed convention metadata", () => {
	const state = emptyState();
	assert.equal(state.contractVersion, CANT_CONSTRUCTIVE_STATE_VERSION);
	assert.equal(state.type, "CantConstructiveState");
	assert.equal(state.id, "cant-A");
	assert.equal(state.alignmentId, "alignment-A");
	assert.equal(state.longitudinalParameter, "intrinsic-s");
	assert.equal(state.quantity, "cross-level");
	assert.equal(state.unit, "alignment-length-unit");
	assert.equal(
		state.signConvention,
		"left-minus-right-viewed-in-increasing-s"
	);
	assert.equal(isCantConstructiveState(state), true);
	assert.equal(assertCantConstructiveState(state), state);
	assert.equal(Object.isFrozen(state), true);
	assert.equal(Object.isFrozen(state.elements), true);
});

test("rejects invalid state and Alignment identities with INVALID_ID", () => {
	expectCode("INVALID_ID", () =>
		createCantConstructiveState({ id: " ", alignmentId: "A" })
	);
	expectCode("INVALID_ID", () =>
		createCantConstructiveState({ id: "C", alignmentId: null })
	);
});

test("appends a constant-cross-level law immutably and freezes owned records", () => {
	const state = { ...emptyState(), extension: { retain: true } };
	const before = structuredClone(state);
	const appended = appendCantElement(state, {
		...constant,
		elementExtension: { zero: 0 },
	});
	assert.deepEqual(state, before);
	assert.notEqual(appended, state);
	assert.notEqual(appended.elements, state.elements);
	assert.equal(appended.extension, state.extension);
	assert.equal(Object.isFrozen(appended), true);
	assert.equal(Object.isFrozen(appended.elements), true);
	assert.equal(Object.isFrozen(appended.elements[0]), true);
});

test("evaluates constant cross-level and zero twist at start, interior, and end", () => {
	const state = appendCantElement(emptyState(), constant);
	for (const s of [0, 50, 100]) {
		const result = evaluateCantAt(state, { s });
		assert.equal(result.crossLevel, 0.05);
		assert.equal(result.twist, 0);
		assert.equal(result.elementId, "C0");
	}
});

test("appends and evaluates a linear-cross-level law using the fixed equations", () => {
	const state = appendCantElement(emptyState(), linear);
	for (const [s, expected] of [[0, 0], [50, 0.05], [100, 0.1]]) {
		const result = evaluateCantAt(state, { s });
		near(result.crossLevel, expected);
		assert.equal(result.twist, 0.001);
	}
});

test("composes constant and linear laws with continuous cross-level while allowing twist change", () => {
	let state = appendCantElement(emptyState(), constant);
	state = appendCantElement(state, {
		id: "L1",
		type: "linear-cross-level",
		startS: 100,
		endS: 200,
		startCrossLevel: 0.05,
		crossLevelRate: 0.001,
	});
	near(evaluateCantAt(state, { s: 200 }).crossLevel, 0.15);
	assert.equal(evaluateCantAt(state, { s: 100 }).twist, 0.001);
});

test("composes linear and constant laws with continuous cross-level while allowing twist change", () => {
	let state = appendCantElement(emptyState(), linear);
	state = appendCantElement(state, {
		id: "C1",
		type: "constant-cross-level",
		startS: 100,
		endS: 200,
		startCrossLevel: 0.1,
	});
	near(evaluateCantAt(state, { s: 100 }).crossLevel, 0.1);
	assert.equal(evaluateCantAt(state, { s: 100 }).twist, 0);
});

test("rejects duplicate element identity without mutation", () => {
	const state = appendCantElement(emptyState(), constant);
	const before = structuredClone(state);
	expectCode("ELEMENT_ALREADY_EXISTS", () =>
		appendCantElement(state, {
			...constant,
			startS: 100,
			endS: 200,
		})
	);
	assert.deepEqual(state, before);
});

test("rejects unsupported element type without mutation", () => {
	const state = emptyState();
	const before = structuredClone(state);
	expectCode("UNSUPPORTED_ELEMENT_TYPE", () =>
		appendCantElement(state, { ...constant, type: "cosine" })
	);
	assert.deepEqual(state, before);
});

test("rejects missing/non-finite numeric fields with INVALID_ELEMENT without mutation", () => {
	const state = emptyState();
	const before = structuredClone(state);
	const missing = { ...constant };
	delete missing.startCrossLevel;
	expectCode("INVALID_ELEMENT", () => appendCantElement(state, missing));
	expectCode("INVALID_ELEMENT", () =>
		appendCantElement(state, { ...linear, crossLevelRate: Infinity })
	);
	assert.deepEqual(state, before);
});

test("rejects zero or negative domains with INVALID_DOMAIN without mutation", () => {
	const state = emptyState();
	const before = structuredClone(state);
	for (const endS of [0, -1]) {
		expectCode("INVALID_DOMAIN", () =>
			appendCantElement(state, { ...constant, endS })
		);
	}
	assert.deepEqual(state, before);
});

test("rejects gaps and overlaps with NON_CONTIGUOUS_DOMAIN without mutation", () => {
	const state = appendCantElement(emptyState(), constant);
	const before = structuredClone(state);
	for (const startS of [101, 99]) {
		expectCode("NON_CONTIGUOUS_DOMAIN", () =>
			appendCantElement(state, {
				id: `C-${startS}`,
				type: "constant-cross-level",
				startS,
				endS: 200,
				startCrossLevel: 0.05,
			})
		);
	}
	assert.deepEqual(state, before);
});

test("rejects cross-level discontinuity with CROSS_LEVEL_DISCONTINUITY without mutation", () => {
	const state = appendCantElement(emptyState(), constant);
	const before = structuredClone(state);
	expectCode("CROSS_LEVEL_DISCONTINUITY", () =>
		appendCantElement(state, {
			id: "C1",
			type: "constant-cross-level",
			startS: 100,
			endS: 200,
			startCrossLevel: 0.06,
		})
	);
	assert.deepEqual(state, before);
});

test("validator rejects altered quantity, unit, sign convention, longitudinal parameter, duplicate IDs, or discontinuous prebuilt state", () => {
	const valid = appendCantElement(emptyState(), constant);
	for (const field of [
		"quantity",
		"unit",
		"signConvention",
		"longitudinalParameter",
	]) {
		assert.equal(
			isCantConstructiveState({ ...valid, [field]: "altered" }),
			false
		);
	}
	assert.equal(
		isCantConstructiveState({
			...valid,
			elements: [valid.elements[0], { ...valid.elements[0] }],
		}),
		false
	);
	assert.equal(
		isCantConstructiveState({
			...valid,
			elements: [
				valid.elements[0],
				{
					id: "C1",
					type: "constant-cross-level",
					startS: 100,
					endS: 200,
					startCrossLevel: 0.06,
				},
			],
		}),
		false
	);
});

test("rejects empty evaluation and outside/non-finite positions with specified codes", () => {
	expectCode("EMPTY_CANT", () => evaluateCantAt(emptyState(), { s: 0 }));
	const state = appendCantElement(emptyState(), constant);
	expectCode("POSITION_OUTSIDE_DOMAIN", () =>
		evaluateCantAt(state, { s: -1 })
	);
	expectCode("POSITION_OUTSIDE_DOMAIN", () =>
		evaluateCantAt(state, { s: 101 })
	);
	expectCode("INVALID_ELEMENT", () =>
		evaluateCantAt(state, { s: NaN })
	);
});

test("assigns shared boundary to following element and final endpoint to final element", () => {
	let state = appendCantElement(emptyState(), linear);
	state = appendCantElement(state, {
		id: "C1",
		type: "constant-cross-level",
		startS: 100,
		endS: 200,
		startCrossLevel: 0.1,
	});
	assert.equal(evaluateCantAt(state, { s: 100 }).elementId, "C1");
	assert.equal(evaluateCantAt(state, { s: 200 }).elementId, "C1");
});

test("preserves unknown extensions while chainage-, CRS-, topology-, horizontal-, vertical-, speed-, gauge-, and source-evidence-like extensions do not affect intrinsic evaluation", () => {
	const extensions = {
		chainage: { km: 1 },
		crs: { id: "none" },
		topology: { edge: "E" },
		horizontal: { curvature: 3 },
		vertical: { gradient: 4 },
		speed: 160,
		gauge: 1.435,
		sourceEvidence: { row: 5 },
	};
	const base = { ...emptyState(), ...extensions };
	const state = appendCantElement(base, {
		...linear,
		importEvidence: { source: "synthetic" },
	});
	for (const key of Object.keys(extensions)) {
		assert.equal(state[key], base[key]);
	}
	near(evaluateCantAt(state, { s: 50 }).crossLevel, 0.05);
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
		"chainage",
		"AXTRAN",
	]) {
		assert.equal(source.includes(forbidden), false);
	}
	assert.match(documentation, /zero imports/);
	assert.match(documentation, /not this Core state/);
	assert.match(documentation, /non-canonical comparison evidence/);
});
