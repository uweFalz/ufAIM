import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentElement } from "../../../src/aim-core/geometry/AlignmentElement.js";
import * as canonical from "../../../src/aim-core/geometry/FixedElement.js";
import * as geometry from "../../../src/aim-core/geometry/index.js";
import * as legacy from "../../../src/domain/alignment/elements/FixedElement.js";
import * as root from "../../../src/aim-core/index.js";
import { ZeroLengthFixed } from "../../../src/domain/alignment/elements/ZeroLengthFixed.js";

test("legacy canonical Geometry and Root share one FixedElement authority", () => {
	assert.deepEqual(Object.keys(legacy), ["FixedElement"]);
	assert.deepEqual(Object.keys(canonical), ["FixedElement"]);
	assert.strictEqual(legacy.FixedElement, canonical.FixedElement);
	assert.strictEqual(geometry.FixedElement, canonical.FixedElement);
	assert.strictEqual(root.FixedElement, canonical.FixedElement);
});

test("constructor preserves defaults Number coercion and mutability", () => {
	for (const [options, arcLength, curvature] of [
		[undefined, 0, 0],
		[{}, 0, 0],
		[{ arcLength: "5", curvature: "0.25" }, 5, 0.25],
		[{ arcLength: -2, curvature: NaN }, -2, 0],
		[{ arcLength: Infinity, curvature: Infinity }, Infinity, Infinity],
		[{ arcLength: null, curvature: -0 }, 0, 0],
	]) {
		const element = new canonical.FixedElement(options);
		assert.equal(element.arcLength, arcLength);
		assert.equal(element.curvature, curvature);
		assert.equal(Object.isFrozen(element), false);
	}
});

test("curvatureAt clamps for side effect and returns stored curvature", () => {
	const element = new canonical.FixedElement({ arcLength: 10, curvature: 0.2 });
	for (const s of [-5, 0, "4", 20, NaN, Infinity]) {
		assert.equal(element.curvatureAt(s), 0.2);
	}
	element.curvature = "changed";
	assert.equal(element.curvatureAt(3), "changed");
});

test("poseAt clamps and delegates exact constant-curvature advance", () => {
	const element = new canonical.FixedElement({ arcLength: 5, curvature: 0.2 });
	const pose = { p: { x: 1, y: 2 }, t: { x: 1, y: 0 } };
	assert.deepEqual(element.poseAt(-1, pose), element.poseAt(0, pose));
	assert.deepEqual(element.poseAt(20, pose), element.poseAt(5, pose));
	const expected = geometry.advance(pose, 3, 0.2);
	assert.deepEqual(element.poseAt("3", pose, { ignored: true }), expected);
});

test("reverse preserves class arc length and curvature sign", () => {
	const element = new canonical.FixedElement({ arcLength: 8, curvature: 0.25 });
	const reversed = element.reverse();
	assert.ok(reversed instanceof canonical.FixedElement);
	assert.notStrictEqual(reversed, element);
	assert.equal(reversed.arcLength, 8);
	assert.equal(reversed.curvature, -0.25);
});

test("parallel preserves straight and near-straight threshold behavior", () => {
	for (const curvature of [0, 0.5e-12, -0.5e-12]) {
		const element = new canonical.FixedElement({ arcLength: 8, curvature });
		const parallel = element.parallel("3");
		assert.deepEqual(parallel, new canonical.FixedElement({
			arcLength: 8,
			curvature: 0,
		}));
	}
});

test("parallel preserves circular positive negative and offset coercion", () => {
	for (const [curvature, offset] of [
		[0.25, 1],
		[-0.25, 1],
		[0.25, -1],
		[0.25, "1"],
		[0.25, "invalid"],
	]) {
		const element = new canonical.FixedElement({ arcLength: 8, curvature });
		const d = Number(offset) || 0;
		const radius = 1 / curvature;
		const nextRadius = radius - d;
		const parallel = element.parallel(offset);
		assert.equal(parallel.arcLength, 8 * (nextRadius / radius));
		assert.equal(parallel.curvature, 1 / nextRadius);
	}
});

test("parallel preserves exact center-hit threshold and error text", () => {
	const element = new canonical.FixedElement({ arcLength: 8, curvature: 0.25 });
	assert.throws(
		() => element.parallel(4),
		{ name: "Error", message: "FixedElement.parallel: offset hits center" }
	);
	assert.throws(
		() => element.parallel(4 - 0.5e-12),
		{ name: "Error", message: "FixedElement.parallel: offset hits center" }
	);
	assert.doesNotThrow(() => element.parallel(4 - 1e-12));
});

test("prototype subclass and ZeroLengthFixed behavior share canonical authority", () => {
	const element = new legacy.FixedElement({ arcLength: 2, curvature: 0.1 });
	assert.ok(element instanceof canonical.FixedElement);
	assert.ok(element instanceof AlignmentElement);
	const zero = new ZeroLengthFixed({ curvature: 0.3 });
	assert.ok(zero instanceof canonical.FixedElement);
	assert.equal(zero.arcLength, 0);
	assert.equal(zero.curvature, 0.3);
});

test("old and canonical construction and operations remain deeply identical", () => {
	for (const options of [
		undefined,
		{},
		{ arcLength: "6", curvature: "0.2" },
		{ arcLength: -3, curvature: -0.1 },
	]) {
		const oldElement = new legacy.FixedElement(options);
		const newElement = new canonical.FixedElement(options);
		assert.deepEqual(oldElement, newElement);
		assert.deepEqual(oldElement.reverse(), newElement.reverse());
		for (const offset of [0, 1, -2, "invalid"]) {
			assert.deepEqual(oldElement.parallel(offset), newElement.parallel(offset));
		}
	}
});

test("native malformed behavior and input nonmutation remain shared", () => {
	assert.throws(() => new canonical.FixedElement(null), TypeError);
	assert.throws(() => new legacy.FixedElement(null), TypeError);
	const pose = { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } };
	const before = structuredClone(pose);
	new canonical.FixedElement({ arcLength: 2, curvature: 0.2 }).poseAt(1, pose);
	assert.deepEqual(pose, before);
	assert.throws(
		() => new canonical.FixedElement({ arcLength: 2 }).poseAt(1, null),
		TypeError
	);
});
