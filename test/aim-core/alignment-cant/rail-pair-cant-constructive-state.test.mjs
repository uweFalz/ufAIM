import assert from "node:assert/strict";
import test from "node:test";

import {
	RailPairCantConstructiveStateError,
	appendRailOffsetElement,
	createRailPairCantConstructiveState,
	evaluateRailPairCantAt,
	isRailPairCantConstructiveState,
} from "../../../src/aim-core/alignment/profile/RailPairCantConstructiveState.js";
import {
	RailPairRealizationError,
	realizeRailPairAt,
} from "../../../src/aim-core/alignment/profile/RailPairRealization.js";

const railPair = {
	leftRailId: "L",
	rightRailId: "R",
	separation: {
		kind: "horizontal-projection-between-governing-references",
		unit: "alignment-length-unit",
		value: 1.5,
		measurementDefinition: "synthetic-horizontal-reference-distance",
		provenance: { sourceId: "gauge-rule" },
	},
};
const anchorRule = {
	id: "anchor-mid",
	version: "1.0.0",
	kind: "midpoint",
	provenance: { sourceId: "design-rule" },
};

function state(status = "complete") {
	return createRailPairCantConstructiveState({
		id: `cant-${status}`,
		alignmentId: "A",
		coverage: {
			status,
			startS: 0,
			endS: 100,
			...(status === "complete" ? { authority: "admitted-construction" } : {}),
		},
		railPair,
		anchorRule,
	});
}

function expectStateCode(code, operation) {
	assert.throws(operation, (error) => error instanceof RailPairCantConstructiveStateError && error.code === code);
}

test("complete sparse coverage evaluates missing rail entries as zero", () => {
	const value = evaluateRailPairCantAt(state(), { s: 50 });
	assert.equal(value.status, "known");
	assert.equal(value.left.offset, 0);
	assert.equal(value.right.offset, 0);
	assert.equal(value.crossLevel, 0);
	assert.equal(value.commonOffset, 0);
});

test("creation owns and freezes copies without freezing caller inputs", () => {
	const inputRailPair = structuredClone(railPair);
	const inputAnchor = structuredClone(anchorRule);
	const inputCoverage = { status: "complete", authority: "admitted-construction", startS: 0, endS: 100 };
	const value = createRailPairCantConstructiveState({
		id: "owned", alignmentId: "A", coverage: inputCoverage,
		railPair: inputRailPair, anchorRule: inputAnchor,
	});
	assert.equal(Object.isFrozen(value), true);
	assert.equal(Object.isFrozen(value.railPair.separation), true);
	assert.equal(Object.isFrozen(inputRailPair), false);
	assert.equal(Object.isFrozen(inputAnchor), false);
	assert.equal(Object.isFrozen(inputCoverage), false);
	inputRailPair.separation.value = 2;
	assert.equal(value.railPair.separation.value, 1.5);
});

test("incomplete evidence coverage evaluates missing entries as unknown", () => {
	const value = evaluateRailPairCantAt(state("incomplete"), { s: 50 });
	assert.equal(value.status, "unknown");
	assert.equal(value.crossLevel, null);
	assert.equal(value.left.offset, null);
});

test("standard cant needs only one nonzero rail element", () => {
	const value = appendRailOffsetElement(state(), {
		id: "right-ramp",
		railId: "R",
		type: "linear-rail-offset",
		startS: 0,
		endS: 100,
		startOffset: 0,
		offsetRate: 0.0015,
	});
	const result = evaluateRailPairCantAt(value, { s: 50 });
	assert.equal(result.left.offset, 0);
	assert.equal(result.right.offset, 0.075);
	assert.equal(result.crossLevel, 0.075);
});

test("track-scissor laws overlap on different rails and retain common mode", () => {
	let value = appendRailOffsetElement(state(), {
		id: "outgoing-right",
		railId: "R",
		type: "linear-rail-offset",
		startS: 0,
		endS: 100,
		startOffset: 0.1,
		offsetRate: -0.001,
	});
	value = appendRailOffsetElement(value, {
		id: "incoming-left",
		railId: "L",
		type: "linear-rail-offset",
		startS: 0,
		endS: 100,
		startOffset: 0,
		offsetRate: 0.001,
	});
	const crossing = evaluateRailPairCantAt(value, { s: 50 });
	assert.equal(crossing.left.offset, 0.05);
	assert.equal(crossing.right.offset, 0.05);
	assert.equal(crossing.crossLevel, 0);
	assert.equal(crossing.commonOffset, 0.05);
});

test("same-rail overlap and redundant zero elements fail closed", () => {
	const value = appendRailOffsetElement(state(), {
		id: "L1", railId: "L", type: "constant-rail-offset",
		startS: 10, endS: 40, startOffset: 0.02,
	});
	expectStateCode("RAIL_DOMAIN_CONFLICT", () => appendRailOffsetElement(value, {
		id: "L2", railId: "L", type: "constant-rail-offset",
		startS: 30, endS: 60, startOffset: 0.03,
	}));
	expectStateCode("REDUNDANT_ZERO_ELEMENT", () => appendRailOffsetElement(state(), {
		id: "Z", railId: "R", type: "constant-rail-offset",
		startS: 0, endS: 100, startOffset: 0,
	}));
});

test("negative offsets represent geometry without inferring undertiefung meaning", () => {
	const value = appendRailOffsetElement(state(), {
		id: "negative-left", railId: "L", type: "constant-rail-offset",
		startS: 0, endS: 100, startOffset: -0.04,
		qualification: { status: "source-claimed", kind: "undertiefung-candidate" },
	});
	assert.equal(evaluateRailPairCantAt(value, { s: 20 }).left.offset, -0.04);
	assert.equal(isRailPairCantConstructiveState(value), true);
});

test("realization derives midpoint, cross-level and roll from construction", () => {
	let value = appendRailOffsetElement(state(), {
		id: "both-left", railId: "L", type: "constant-rail-offset",
		startS: 0, endS: 100, startOffset: 0.08,
	});
	value = appendRailOffsetElement(value, {
		id: "both-right", railId: "R", type: "constant-rail-offset",
		startS: 0, endS: 100, startOffset: 0.08,
	});
	const result = realizeRailPairAt({
		state: value,
		s: 20,
		referenceFrame: {
			contextId: "local-frame",
			origin: { x: 10, y: 20, z: 30 },
			lateral: { x: 0, y: 1, z: 0 },
			vertical: { x: 0, y: 0, z: 1 },
		},
	});
	assert.deepEqual(result.leftRail.point, { x: 10, y: 19.25, z: 30.08 });
	assert.deepEqual(result.rightRail.point, { x: 10, y: 20.75, z: 30.08 });
	assert.deepEqual(result.midpoint, { x: 10, y: 20, z: 30.08 });
	assert.equal(result.crossLevel, 0);
	assert.equal(result.commonOffset, 0.08);
	assert.equal(result.roll, 0);
	assert.equal(Object.isFrozen(result), true);
});

test("unknown cant and invalid frames stop realization", () => {
	assert.throws(() => realizeRailPairAt({
		state: state("incomplete"), s: 50,
		referenceFrame: { contextId: "F", origin: { x: 0, y: 0, z: 0 }, lateral: { x: 0, y: 1, z: 0 }, vertical: { x: 0, y: 0, z: 1 } },
	}), (error) => error instanceof RailPairRealizationError && error.code === "CANT_UNKNOWN");
	assert.throws(() => realizeRailPairAt({
		state: state(), s: 50,
		referenceFrame: { contextId: "F", origin: { x: 0, y: 0, z: 0 }, lateral: { x: 0, y: 2, z: 0 }, vertical: { x: 0, y: 0, z: 1 } },
	}), (error) => error instanceof RailPairRealizationError && error.code === "REFERENCE_FRAME_INVALID");
});
