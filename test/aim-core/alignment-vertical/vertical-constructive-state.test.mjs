import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const moduleUrl = new URL(
	"../../../src/aim-core/alignment/profile/VerticalConstructiveState.js",
	import.meta.url
);
const docUrl = new URL(
	"../../../docs/app/architecture/aim-core/vertical/VERTICAL-CONSTRUCTIVE-STATE-v0.1.md",
	import.meta.url
);
const {
	VERTICAL_CONSTRUCTIVE_STATE_VERSION,
	VerticalConstructiveStateError,
	isVerticalConstructiveState,
	assertVerticalConstructiveState,
	createVerticalConstructiveState,
	appendVerticalElement,
	evaluateVerticalAt,
} = await import(moduleUrl);

const constant = {
	id: "V0",
	type: "constant-gradient",
	startS: 0,
	endS: 100,
	startElevation: 10,
	gradient: 0.01,
};

const parabolic = {
	id: "P0",
	type: "parabolic",
	startS: 0,
	endS: 100,
	startElevation: 10,
	startGradient: 0.01,
	gradientRate: 0.0001,
};

function emptyState() {
	return createVerticalConstructiveState({
		id: "vertical-A",
		alignmentId: "alignment-A",
	});
}

function expectCode(code, operation) {
	assert.throws(operation, (error) => {
		assert.equal(error instanceof VerticalConstructiveStateError, true);
		assert.equal(error.code, code);
		return true;
	});
}

function near(actual, expected) {
	assert.ok(
		Math.abs(actual - expected) <= 1e-12,
		`${actual} differs from ${expected}`
	);
}

test("creates an empty valid frozen state with stable state and Alignment identities", () => {
	const state = emptyState();
	assert.equal(
		state.contractVersion,
		VERTICAL_CONSTRUCTIVE_STATE_VERSION
	);
	assert.equal(state.type, "VerticalConstructiveState");
	assert.equal(state.id, "vertical-A");
	assert.equal(state.alignmentId, "alignment-A");
	assert.equal(state.longitudinalParameter, "intrinsic-s");
	assert.deepEqual(state.elements, []);
	assert.equal(isVerticalConstructiveState(state), true);
	assert.equal(assertVerticalConstructiveState(state), state);
	assert.equal(Object.isFrozen(state), true);
	assert.equal(Object.isFrozen(state.elements), true);
});

test("rejects invalid state and Alignment identities with INVALID_ID", () => {
	expectCode("INVALID_ID", () =>
		createVerticalConstructiveState({
			id: " ",
			alignmentId: "alignment-A",
		})
	);
	expectCode("INVALID_ID", () =>
		createVerticalConstructiveState({
			id: "vertical-A",
			alignmentId: null,
		})
	);
});

test("appends a constant-gradient law immutably and freezes owned records", () => {
	const state = {
		...emptyState(),
		extension: { preserve: true },
	};
	const before = structuredClone(state);
	const appended = appendVerticalElement(state, {
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
	assert.equal(appended.elements[0].elementExtension.zero, 0);
});

test("evaluates constant-gradient elevation and gradient at start, interior, and end", () => {
	const state = appendVerticalElement(emptyState(), constant);
	assert.deepEqual(evaluateVerticalAt(state, { s: 0 }), {
		elementId: "V0",
		s: 0,
		elevation: 10,
		gradient: 0.01,
	});
	assert.deepEqual(evaluateVerticalAt(state, { s: 50 }), {
		elementId: "V0",
		s: 50,
		elevation: 10.5,
		gradient: 0.01,
	});
	assert.deepEqual(evaluateVerticalAt(state, { s: 100 }), {
		elementId: "V0",
		s: 100,
		elevation: 11,
		gradient: 0.01,
	});
});

test("appends and evaluates a parabolic law using the fixed equations", () => {
	const state = appendVerticalElement(emptyState(), parabolic);
	const mid = evaluateVerticalAt(state, { s: 50 });
	const end = evaluateVerticalAt(state, { s: 100 });
	assert.equal(mid.elementId, "P0");
	near(mid.elevation, 10.625);
	near(mid.gradient, 0.015);
	near(end.elevation, 11.5);
	near(end.gradient, 0.02);
});

test("composes constant-gradient and parabolic laws with continuous elevation and gradient", () => {
	let state = appendVerticalElement(emptyState(), constant);
	state = appendVerticalElement(state, {
		id: "P1",
		type: "parabolic",
		startS: 100,
		endS: 200,
		startElevation: 11,
		startGradient: 0.01,
		gradientRate: 0.0001,
	});
	const end = evaluateVerticalAt(state, { s: 200 });
	near(end.elevation, 12.5);
	near(end.gradient, 0.02);
});

test("composes parabolic and constant-gradient laws with continuous elevation and gradient", () => {
	let state = appendVerticalElement(emptyState(), parabolic);
	state = appendVerticalElement(state, {
		id: "V1",
		type: "constant-gradient",
		startS: 100,
		endS: 200,
		startElevation: 11.5,
		gradient: 0.02,
	});
	const end = evaluateVerticalAt(state, { s: 200 });
	near(end.elevation, 13.5);
	near(end.gradient, 0.02);
});

test("rejects duplicate element identity without mutation", () => {
	const state = appendVerticalElement(emptyState(), constant);
	const before = structuredClone(state);
	expectCode("ELEMENT_ALREADY_EXISTS", () =>
		appendVerticalElement(state, {
			...constant,
			startS: 100,
			endS: 200,
			startElevation: 11,
		})
	);
	assert.deepEqual(state, before);
});

test("rejects unsupported element type without mutation", () => {
	const state = emptyState();
	const before = structuredClone(state);
	expectCode("UNSUPPORTED_ELEMENT_TYPE", () =>
		appendVerticalElement(state, {
			...constant,
			type: "circular",
		})
	);
	assert.deepEqual(state, before);
});

test("rejects missing/non-finite numeric fields with INVALID_ELEMENT without mutation", () => {
	const state = emptyState();
	const before = structuredClone(state);
	const missing = { ...constant };
	delete missing.gradient;
	expectCode("INVALID_ELEMENT", () =>
		appendVerticalElement(state, missing)
	);
	expectCode("INVALID_ELEMENT", () =>
		appendVerticalElement(state, {
			...parabolic,
			gradientRate: Infinity,
		})
	);
	assert.deepEqual(state, before);
});

test("rejects zero or negative element domains with INVALID_DOMAIN without mutation", () => {
	const state = emptyState();
	const before = structuredClone(state);
	expectCode("INVALID_DOMAIN", () =>
		appendVerticalElement(state, {
			...constant,
			endS: 0,
		})
	);
	expectCode("INVALID_DOMAIN", () =>
		appendVerticalElement(state, {
			...constant,
			endS: -1,
		})
	);
	assert.deepEqual(state, before);
});

test("rejects gaps and overlaps with NON_CONTIGUOUS_DOMAIN without mutation", () => {
	const state = appendVerticalElement(emptyState(), constant);
	const before = structuredClone(state);
	for (const startS of [101, 99]) {
		expectCode("NON_CONTIGUOUS_DOMAIN", () =>
			appendVerticalElement(state, {
				id: `V-${startS}`,
				type: "constant-gradient",
				startS,
				endS: 200,
				startElevation: 11,
				gradient: 0.01,
			})
		);
	}
	assert.deepEqual(state, before);
});

test("rejects elevation discontinuity with ELEVATION_DISCONTINUITY without mutation", () => {
	const state = appendVerticalElement(emptyState(), constant);
	const before = structuredClone(state);
	expectCode("ELEVATION_DISCONTINUITY", () =>
		appendVerticalElement(state, {
			id: "V1",
			type: "constant-gradient",
			startS: 100,
			endS: 200,
			startElevation: 12,
			gradient: 0.01,
		})
	);
	assert.deepEqual(state, before);
});

test("rejects gradient discontinuity with GRADIENT_DISCONTINUITY without mutation", () => {
	const state = appendVerticalElement(emptyState(), constant);
	const before = structuredClone(state);
	expectCode("GRADIENT_DISCONTINUITY", () =>
		appendVerticalElement(state, {
			id: "V1",
			type: "constant-gradient",
			startS: 100,
			endS: 200,
			startElevation: 11,
			gradient: 0.02,
		})
	);
	assert.deepEqual(state, before);
});

test("rejects empty evaluation and outside/non-finite positions with the specified codes", () => {
	expectCode("EMPTY_PROFILE", () =>
		evaluateVerticalAt(emptyState(), { s: 0 })
	);
	const state = appendVerticalElement(emptyState(), constant);
	expectCode("POSITION_OUTSIDE_DOMAIN", () =>
		evaluateVerticalAt(state, { s: -1 })
	);
	expectCode("POSITION_OUTSIDE_DOMAIN", () =>
		evaluateVerticalAt(state, { s: 101 })
	);
	expectCode("INVALID_ELEMENT", () =>
		evaluateVerticalAt(state, { s: NaN })
	);
});

test("deterministically assigns a shared boundary to the following element and the final endpoint to the final element", () => {
	let state = appendVerticalElement(emptyState(), constant);
	state = appendVerticalElement(state, {
		id: "P1",
		type: "parabolic",
		startS: 100,
		endS: 200,
		startElevation: 11,
		startGradient: 0.01,
		gradientRate: 0.0001,
	});
	assert.equal(
		evaluateVerticalAt(state, { s: 100 }).elementId,
		"P1"
	);
	assert.equal(
		evaluateVerticalAt(state, { s: 200 }).elementId,
		"P1"
	);
});

test("preserves unknown extension members while chainage-like, CRS-like, topology-like, and source-evidence extensions do not affect intrinsic evaluation", () => {
	const base = {
		...emptyState(),
		chainageEvidence: { km: 12.3 },
		crsEvidence: { id: "EPSG:none" },
		topologyEvidence: { edgeId: "E1" },
		sourceEvidence: { row: 42 },
	};
	const state = appendVerticalElement(base, {
		...constant,
		importEvidence: { source: "synthetic" },
	});
	assert.equal(state.chainageEvidence, base.chainageEvidence);
	assert.equal(state.crsEvidence, base.crsEvidence);
	assert.equal(state.topologyEvidence, base.topologyEvidence);
	assert.equal(state.sourceEvidence, base.sourceEvidence);
	assert.deepEqual(evaluateVerticalAt(state, { s: 50 }), {
		elementId: "V0",
		s: 50,
		elevation: 10.5,
		gradient: 0.01,
	});
});

test("source and documentation dependency scan confirms zero imports and no forbidden dependency", async () => {
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
		"cant",
		"chainage",
		"AXTRAN",
	]) {
		assert.equal(
			source.includes(forbidden),
			false,
			`forbidden source dependency: ${forbidden}`
		);
	}
	assert.match(documentation, /zero imports/);
  assert.match(documentation, /not this\s+Core state/);
	assert.match(documentation, /non-canonical Research comparison evidence/);
});
