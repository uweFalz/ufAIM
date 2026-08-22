import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/geometry/KinkElement.js";
import * as geometry from "../../../src/aim-core/geometry/index.js";
import * as legacy from "../../../src/domain/alignment/elements/KinkElement.js";
import { TransitionElement } from "../../../src/aim-core/geometry/TransitionElement.js";
import * as root from "../../../src/aim-core/index.js";

test("legacy canonical Geometry and Root share one KinkElement authority", () => {
	assert.deepEqual(Object.keys(legacy), ["KinkElement"]);
	assert.deepEqual(Object.keys(canonical), ["KinkElement"]);
	assert.strictEqual(legacy.KinkElement, canonical.KinkElement);
	assert.strictEqual(geometry.KinkElement, canonical.KinkElement);
	assert.strictEqual(root.KinkElement, canonical.KinkElement);
	assert.strictEqual(
		Object.getPrototypeOf(canonical.KinkElement.prototype),
		TransitionElement.prototype
	);
});

test("constructor preserves defaults zero runtime and current identity behavior", () => {
	const element = new canonical.KinkElement();
	assert.equal(element.arcLength, 0);
	assert.equal(element.kappaA, 0);
	assert.equal(element.kappaB, 0);
	assert.equal(element.deltaDir, 0);
	assert.equal(element.id, undefined);
	assert.equal(element.meta, undefined);
	assert.deepEqual(Object.keys(element), [
		"_arcLength",
		"runtime",
		"kappaA",
		"kappaB",
		"deltaDir",
	]);
	assert.deepEqual(Object.keys(element.runtime), [
		"kappa",
		"kappaInt",
		"kappa1",
		"kappa2",
	]);
	for (const name of Object.keys(element.runtime)) {
		assert.equal(element.runtime[name](123), 0);
	}
});

test("constructor preserves kappa delta coercion nonfinite and mutability", () => {
	for (const [options, expected] of [
		[{ kappaA: 1, kappaB: -2, deltaDir: 0.5 }, [1, -2, 0.5]],
		[{ kappaA: "0.25", kappaB: "0.5", deltaDir: "1.25" }, [0.25, 0.5, 1.25]],
		[{ kappaA: NaN, kappaB: Infinity, deltaDir: Infinity }, [0, Infinity, Infinity]],
		[{ kappaA: "x", kappaB: null, deltaDir: -0 }, [0, 0, 0]],
	]) {
		const element = new canonical.KinkElement(options);
		assert.deepEqual(
			[element.kappaA, element.kappaB, element.deltaDir],
			expected
		);
		element.deltaDir = "mutable";
		assert.equal(element.deltaDir, "mutable");
	}
});

test("curvatureAt ignores its argument and returns stored kappaB", () => {
	const element = new canonical.KinkElement({ kappaB: -0.75 });
	for (const s of [undefined, null, -1, 0, 1, "x", NaN, Infinity, {}]) {
		assert.equal(element.curvatureAt(s), -0.75);
	}
	element.kappaB = "stored";
	assert.equal(element.curvatureAt(Symbol("ignored")), "stored");
});

test("poseAt preserves result order point alias and tangent freshness", () => {
	const element = new canonical.KinkElement({ deltaDir: Math.PI / 2 });
	const pose = { p: { x: 2, y: 3 }, t: { x: 1, y: 0 } };
	const before = structuredClone(pose);
	const result = element.poseAt(99, pose, { ignored: true });
	assert.deepEqual(Object.keys(result), ["p", "t"]);
	assert.strictEqual(result.p, pose.p);
	assert.notStrictEqual(result.t, pose.t);
	assert.deepEqual(Object.keys(result.t), ["x", "y"]);
	assert.ok(Math.abs(result.t.x) < 1e-15);
	assert.equal(result.t.y, 1);
	assert.deepEqual(pose, before);
});

test("poseAt preserves rotation orientation coercion and nonfinite behavior", () => {
	const pose = { p: { x: 0, y: 0 }, t: { x: 2, y: -3 } };
	for (const angle of [0, 0.25, -0.5, "0.75"]) {
		const a = Number(angle) || 0;
		const result = new canonical.KinkElement({ deltaDir: angle }).poseAt(0, pose);
		assert.deepEqual(result.t, {
			x: pose.t.x * Math.cos(a) - pose.t.y * Math.sin(a),
			y: pose.t.x * Math.sin(a) + pose.t.y * Math.cos(a),
		});
	}
	for (const angle of [NaN, Infinity]) {
		const result = new canonical.KinkElement({ deltaDir: angle }).poseAt(0, pose);
		if (Number.isNaN(angle)) {
			assert.deepEqual(result.t, { x: 2, y: -3 });
		} else {
			assert.equal(Number.isNaN(result.t.x), true);
			assert.equal(Number.isNaN(result.t.y), true);
		}
	}
});

test("poseAt preserves native malformed input errors", () => {
	const element = new canonical.KinkElement({ deltaDir: 0.2 });
	assert.throws(() => element.poseAt(0, null), TypeError);
	assert.throws(() => element.poseAt(0, {}), TypeError);
	assert.throws(
		() => element.poseAt(0, { p: {}, t: { x: Symbol("x"), y: 0 } }),
		TypeError
	);
});

test("reverse preserves signs angle class and fresh identity", () => {
	for (const options of [
		{ kappaA: 1, kappaB: 2, deltaDir: 0.5 },
		{ kappaA: -1, kappaB: 3, deltaDir: -0.25 },
		{ kappaA: "0.5", kappaB: "-0.25", deltaDir: "1.5" },
	]) {
		const element = new canonical.KinkElement(options);
		const reversed = element.reverse();
		assert.ok(reversed instanceof canonical.KinkElement);
		assert.ok(reversed instanceof TransitionElement);
		assert.notStrictEqual(reversed, element);
		assert.equal(reversed.kappaA, -element.kappaB);
		assert.equal(reversed.kappaB, -element.kappaA);
		assert.equal(reversed.deltaDir, -element.deltaDir);
	}
});

test("parallel ignores offset and preserves stored fields in a fresh instance", () => {
	const element = new canonical.KinkElement({
		kappaA: -1,
		kappaB: 2,
		deltaDir: 0.75,
	});
	for (const offset of [undefined, 0, 4, "x", NaN, Symbol("ignored")]) {
		const parallel = element.parallel(offset);
		assert.ok(parallel instanceof canonical.KinkElement);
		assert.notStrictEqual(parallel, element);
		assert.equal(parallel.arcLength, 0);
		assert.equal(parallel.kappaA, -1);
		assert.equal(parallel.kappaB, 2);
		assert.equal(parallel.deltaDir, 0.75);
	}
});

test("subclass and prototype behavior use canonical authority", () => {
	class SpecializedKink extends canonical.KinkElement {}
	const element = new SpecializedKink({ kappaB: 2, deltaDir: 0.1 });
	assert.ok(element instanceof SpecializedKink);
	assert.ok(element instanceof canonical.KinkElement);
	assert.ok(element instanceof TransitionElement);
	assert.equal(element.curvatureAt(10), 2);
	assert.equal(element.clampS(10), 0);
});

test("legacy and canonical results remain identical on independent fixtures", () => {
	for (const options of [
		undefined,
		{},
		{ kappaA: 1, kappaB: 2, deltaDir: 0.4 },
		{ kappaA: "0.1", kappaB: "0.4", deltaDir: "-0.2" },
	]) {
		const oldElement = new legacy.KinkElement(options);
		const newElement = new canonical.KinkElement(options);
		assert.deepEqual(oldElement, newElement);
		const pose = { p: { x: 1, y: 2 }, t: { x: 3, y: 4 } };
		assert.deepEqual(oldElement.poseAt(0, pose), newElement.poseAt(0, pose));
		assert.deepEqual(oldElement.reverse(), newElement.reverse());
		assert.deepEqual(oldElement.parallel(7), newElement.parallel(7));
	}
});

test("native malformed construction and external input nonmutation remain exact", () => {
	assert.throws(() => new canonical.KinkElement(null), TypeError);
	assert.throws(() => new legacy.KinkElement(null), TypeError);
	const options = {
		kappaA: 1,
		kappaB: 2,
		deltaDir: 0.3,
		meta: { source: "fixture" },
	};
	const before = structuredClone(options);
	new canonical.KinkElement(options);
	assert.deepEqual(options, before);
});
