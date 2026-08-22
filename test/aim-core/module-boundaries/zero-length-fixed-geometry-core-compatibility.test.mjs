import assert from "node:assert/strict";
import test from "node:test";

import { FixedElement } from "../../../src/aim-core/geometry/FixedElement.js";
import * as canonical from "../../../src/aim-core/geometry/ZeroLengthFixed.js";
import * as geometry from "../../../src/aim-core/geometry/index.js";
import * as legacy from "../../../src/domain/alignment/elements/ZeroLengthFixed.js";
import * as root from "../../../src/aim-core/index.js";

test("all entry points share one ZeroLengthFixed class", () => {
	assert.deepEqual(Object.keys(legacy), ["ZeroLengthFixed"]);
	assert.deepEqual(Object.keys(canonical), ["ZeroLengthFixed"]);
	assert.strictEqual(legacy.ZeroLengthFixed, canonical.ZeroLengthFixed);
	assert.strictEqual(geometry.ZeroLengthFixed, canonical.ZeroLengthFixed);
	assert.strictEqual(root.ZeroLengthFixed, canonical.ZeroLengthFixed);
});

test("constructor preserves defaults coercion zero length and mutability", () => {
	for (const [options, curvature] of [
		[undefined, 0],
		[{}, 0],
		[{ id: "ignored", curvature: "0.25", meta: { a: 1 } }, 0.25],
		[{ curvature: NaN }, 0],
		[{ curvature: Infinity }, Infinity],
		[{ curvature: -0 }, 0],
	]) {
		const value = new canonical.ZeroLengthFixed(options);
		assert.equal(value.arcLength, 0);
		assert.equal(value.curvature, curvature);
		assert.equal(Object.isFrozen(value), false);
		value.curvature = 7;
		assert.equal(value.curvature, 7);
	}
});

test("poseAt preserves exact input identity and ignores arguments", () => {
	const value = new canonical.ZeroLengthFixed({ curvature: 0.2 });
	const pose = { p: { x: 1, y: 2 }, t: { x: 1, y: 0 } };
	assert.strictEqual(value.poseAt(0, pose), pose);
	assert.strictEqual(value.poseAt(Infinity, pose, { quality: "x" }), pose);
	assert.strictEqual(value.poseAt(1, null), null);
});

test("inherited curvature and reverse behavior remain exact", () => {
	const value = new canonical.ZeroLengthFixed({ curvature: 0.25 });
	assert.equal(value.curvatureAt(-10), 0.25);
	assert.equal(value.curvatureAt(Infinity), 0.25);
	const reversed = value.reverse();
	assert.ok(reversed instanceof FixedElement);
	assert.equal(reversed instanceof canonical.ZeroLengthFixed, false);
	assert.equal(reversed.arcLength, 0);
	assert.equal(reversed.curvature, -0.25);
});

test("parallel ignores offset and returns a fresh canonical specialization", () => {
	const value = new canonical.ZeroLengthFixed({ curvature: -0.2 });
	for (const offset of [0, 5, "x", Infinity]) {
		const parallel = value.parallel(offset);
		assert.ok(parallel instanceof canonical.ZeroLengthFixed);
		assert.notStrictEqual(parallel, value);
		assert.equal(parallel.arcLength, 0);
		assert.equal(parallel.curvature, -0.2);
	}
});

test("prototype subclass and native malformed behavior remain exact", () => {
	class Derived extends canonical.ZeroLengthFixed {}
	const derived = new Derived({ curvature: 0.1 });
	assert.ok(derived instanceof canonical.ZeroLengthFixed);
	assert.ok(derived instanceof FixedElement);
	assert.throws(() => new canonical.ZeroLengthFixed(null), TypeError);
	assert.throws(() => new legacy.ZeroLengthFixed(null), TypeError);
});

test("legacy and canonical independent fixtures remain deeply identical", () => {
	for (const options of [
		undefined,
		{},
		{ curvature: "0.4" },
		{ id: "x", curvature: -0.2, meta: { source: "test" } },
	]) {
		const oldValue = new legacy.ZeroLengthFixed(options);
		const newValue = new canonical.ZeroLengthFixed(options);
		assert.deepEqual(oldValue, newValue);
		assert.deepEqual(oldValue.reverse(), newValue.reverse());
		assert.deepEqual(oldValue.parallel(3), newValue.parallel(3));
	}
});
