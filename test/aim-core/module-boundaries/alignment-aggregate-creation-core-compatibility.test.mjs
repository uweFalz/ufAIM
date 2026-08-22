import assert from "node:assert/strict";
import test from "node:test";

import * as authoring from "../../../src/aim-core/alignment/authoring/index.js";
import * as canonical from "../../../src/aim-core/alignment/authoring/createEmptyAlignmentData.js";
import * as legacy from "../../../src/domain/alignment/editor/createEmptyAlignmentData.js";
import * as root from "../../../src/aim-core/index.js";

const FIXED_NOW = "2026-07-27T00:00:00.000Z";

function expected({ id, name, now }) {
	return {
		type: "AlignmentData",
		id,
		name,
		source: {
			kind: "native",
			native: true,
		},
		placement: {
			mode: "local-cartesian",
			engineeringCrsId: "engineering-nullCRS",
			geographicOrigin: null,
		},
		editModel: {
			startPose: {
				p: { x: 0, y: 0 },
				t: { x: 1, y: 0 },
			},
			elements: [],
		},
		sparseAlignment: null,
		profileState: {
			vertical: null,
			cant: null,
			chainageMappings: [],
		},
		meta: {
			lifecycle: "draft",
			dirty: true,
			createdAt: now,
			modifiedAt: now,
		},
	};
}

test("legacy canonical Authoring and Root exports share one authority", () => {
	assert.deepEqual(Object.keys(legacy), Object.keys(canonical));
	assert.strictEqual(
		legacy.createEmptyAlignmentData,
		canonical.createEmptyAlignmentData
	);
	assert.strictEqual(
		authoring.createEmptyAlignmentData,
		canonical.createEmptyAlignmentData
	);
	assert.strictEqual(
		root.createEmptyAlignmentData,
		canonical.createEmptyAlignmentData
	);
});

test("explicit id name and now preserve exact result and key order", () => {
	const options = {
		id: "alignment-explicit",
		name: "Explicit Alignment",
		now: FIXED_NOW,
	};
	const before = structuredClone(options);
	const result = canonical.createEmptyAlignmentData(options);
	assert.deepEqual(result, expected(options));
	assert.deepEqual(options, before);
	assert.deepEqual(Object.keys(result), [
		"type",
		"id",
		"name",
		"source",
		"placement",
		"editModel",
		"sparseAlignment",
		"profileState",
		"meta",
	]);
	assert.deepEqual(Object.keys(result.source), ["kind", "native"]);
	assert.deepEqual(Object.keys(result.placement), [
		"mode",
		"engineeringCrsId",
		"geographicOrigin",
	]);
	assert.deepEqual(Object.keys(result.meta), [
		"lifecycle",
		"dirty",
		"createdAt",
		"modifiedAt",
	]);
});

test("defaults preserve Date Math call order identifier format and timestamp identity", () => {
	const RealDate = globalThis.Date;
	const realRandom = Math.random;
	const calls = [];
	class FixedDate extends RealDate {
		constructor(...args) {
			calls.push("Date");
			super(...(args.length ? args : [FIXED_NOW]));
		}
		static now() {
			calls.push("Date.now");
			return 1_700_000_000_000;
		}
	}
	try {
		globalThis.Date = FixedDate;
		Math.random = () => {
			calls.push("Math.random");
			return 0.123456789;
		};
		const result = canonical.createEmptyAlignmentData();
		assert.equal(result.id, "alignment_loyw3v28_4fzzzx");
		assert.equal(result.name, "New Alignment");
		assert.equal(result.meta.createdAt, FIXED_NOW);
		assert.equal(result.meta.modifiedAt, result.meta.createdAt);
		assert.deepEqual(calls, ["Date.now", "Math.random", "Date"]);
	} finally {
		globalThis.Date = RealDate;
		Math.random = realRandom;
	}
	assert.strictEqual(globalThis.Date, RealDate);
	assert.strictEqual(Math.random, realRandom);
});

test("provided id suppresses id defaults while omitted now still evaluates", () => {
	const RealDate = globalThis.Date;
	const realRandom = Math.random;
	let nowCalls = 0;
	let randomCalls = 0;
	class FixedDate extends RealDate {
		constructor(...args) {
			super(...(args.length ? args : [FIXED_NOW]));
		}
		static now() {
			nowCalls += 1;
			return 1;
		}
	}
	try {
		globalThis.Date = FixedDate;
		Math.random = () => {
			randomCalls += 1;
			return 0.5;
		};
		const result = canonical.createEmptyAlignmentData({
			id: "provided",
			name: "Provided",
		});
		assert.equal(result.id, "provided");
		assert.equal(result.meta.createdAt, FIXED_NOW);
		assert.equal(nowCalls, 0);
		assert.equal(randomCalls, 0);
	} finally {
		globalThis.Date = RealDate;
		Math.random = realRandom;
	}
});

test("repeated calls return fresh mutable records and independent element arrays", () => {
	const first = canonical.createEmptyAlignmentData({
		id: "first",
		now: FIXED_NOW,
	});
	const second = canonical.createEmptyAlignmentData({
		id: "second",
		now: FIXED_NOW,
	});
	assert.notStrictEqual(first, second);
	assert.notStrictEqual(first.source, second.source);
	assert.notStrictEqual(first.placement, second.placement);
	assert.notStrictEqual(first.editModel, second.editModel);
	assert.notStrictEqual(first.editModel.elements, second.editModel.elements);
	assert.notStrictEqual(first.profileState, second.profileState);
	assert.notStrictEqual(
		first.profileState.chainageMappings,
		second.profileState.chainageMappings
	);
	assert.equal(Object.isFrozen(first), false);
	first.editModel.elements.push({ id: "mutable" });
	first.profileState.chainageMappings.push({ id: "mutable" });
	first.name = "Changed";
	assert.deepEqual(second.editModel.elements, []);
	assert.deepEqual(second.profileState.chainageMappings, []);
	assert.equal(second.name, "New Alignment");
});

test("provided edge values retain identity without validation normalization or coercion", () => {
	const id = { object: "identity" };
	const name = null;
	const now = { timestamp: "opaque" };
	const result = canonical.createEmptyAlignmentData({ id, name, now });
	assert.strictEqual(result.id, id);
	assert.strictEqual(result.name, name);
	assert.strictEqual(result.meta.createdAt, now);
	assert.strictEqual(result.meta.modifiedAt, now);
});

test("legacy and canonical calls remain deeply identical on independent fixtures", () => {
	for (const options of [
		{ id: "a", name: "A", now: "one" },
		{ id: "", name: "", now: 0 },
		{ id: null, name: false, now: null },
	]) {
		const oldResult = legacy.createEmptyAlignmentData({ ...options });
		const newResult = canonical.createEmptyAlignmentData({ ...options });
		assert.deepEqual(newResult, oldResult);
		assert.notStrictEqual(newResult, oldResult);
		assert.notStrictEqual(
			newResult.editModel.elements,
			oldResult.editModel.elements
		);
	}
});
