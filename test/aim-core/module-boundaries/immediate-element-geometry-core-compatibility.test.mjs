import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/geometry/ImmediateElement.js";
import * as geometry from "../../../src/aim-core/geometry/index.js";
import * as legacy from "../../../src/domain/alignment/elements/ImmediateElement.js";
import { TransitionElement } from "../../../src/aim-core/geometry/TransitionElement.js";
import * as root from "../../../src/aim-core/index.js";

test("legacy canonical Geometry and Root share one ImmediateElement authority", () => {
	assert.deepEqual(Object.keys(legacy), ["ImmediateElement"]);
	assert.deepEqual(Object.keys(canonical), ["ImmediateElement"]);
	assert.strictEqual(legacy.ImmediateElement, canonical.ImmediateElement);
	assert.strictEqual(geometry.ImmediateElement, canonical.ImmediateElement);
	assert.strictEqual(root.ImmediateElement, canonical.ImmediateElement);
	assert.strictEqual(
		Object.getPrototypeOf(canonical.ImmediateElement.prototype),
		TransitionElement.prototype
	);
});

test("constructor preserves defaults zero length runtime and current identity behavior", () => {
	const element = new canonical.ImmediateElement();
	assert.equal(element.arcLength, 0);
	assert.equal(element.kappaA, 0);
	assert.equal(element.kappaB, 0);
	assert.equal(element.id, undefined);
	assert.equal(element.meta, undefined);
	assert.deepEqual(Object.keys(element), ["_arcLength", "runtime", "kappaA", "kappaB"]);
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

test("constructor preserves representative coercions references and mutability", () => {
	const meta = { source: "fixture" };
	for (const [kappaA, kappaB, expectedA, expectedB] of [
		[1, -2, 1, -2],
		["0.25", "0.5", 0.25, 0.5],
		[NaN, Infinity, 0, Infinity],
		["invalid", null, 0, 0],
	]) {
		const element = new canonical.ImmediateElement({
			id: "ignored-currently",
			kappaA,
			kappaB,
			meta,
		});
		assert.equal(element.kappaA, expectedA);
		assert.equal(element.kappaB, expectedB);
		assert.equal(element.id, undefined);
		assert.equal(element.meta, undefined);
		assert.equal(Object.isFrozen(element), false);
		element.kappaB = "mutable";
		assert.equal(element.kappaB, "mutable");
	}
});

test("zero runtime and inherited derivative short-element behavior remain exact", () => {
	const element = new canonical.ImmediateElement({ kappaA: 2, kappaB: 4 });
	assert.equal(element.runtime.kappa(-1), 0);
	assert.equal(element.runtime.kappaInt(0.5), 0);
	assert.equal(element.runtime.kappa1(Infinity), 0);
	assert.equal(element.runtime.kappa2(NaN), 0);
	assert.equal(element.curvature1At(-1), 0);
	assert.equal(element.curvature1At(Infinity), 0);
	assert.equal(element.curvature2At("3"), 0);
});

test("curvatureAt ignores its argument and returns stored kappaB exactly", () => {
	const element = new canonical.ImmediateElement({ kappaB: -0.75 });
	for (const s of [undefined, null, -1, 0, 1, "x", NaN, Infinity, {}]) {
		assert.equal(element.curvatureAt(s), -0.75);
	}
	element.kappaB = "stored";
	assert.equal(element.curvatureAt(Symbol("ignored")), "stored");
});

test("poseAt returns poseA by identity and ignores s and opts", () => {
	const element = new canonical.ImmediateElement();
	const pose = { p: { x: 1, y: 2 }, t: { x: 3, y: 4 } };
	const before = structuredClone(pose);
	for (const [s, opts] of [
		[0, undefined],
		[Infinity, { quality: "exact" }],
		[Symbol("ignored"), null],
	]) {
		assert.strictEqual(element.poseAt(s, pose, opts), pose);
	}
	assert.deepEqual(pose, before);
});

test("reverse preserves endpoint sign order class and fresh identity", () => {
	for (const [kappaA, kappaB] of [
		[1, 2],
		[-1, 3],
		["0.5", "-0.25"],
	]) {
		const element = new canonical.ImmediateElement({ kappaA, kappaB });
		const reversed = element.reverse();
		assert.ok(reversed instanceof canonical.ImmediateElement);
		assert.ok(reversed instanceof TransitionElement);
		assert.notStrictEqual(reversed, element);
		assert.equal(reversed.arcLength, 0);
		assert.equal(reversed.kappaA, -element.kappaB);
		assert.equal(reversed.kappaB, -element.kappaA);
	}
});

test("parallel ignores offset and preserves fields in a fresh canonical instance", () => {
	const element = new canonical.ImmediateElement({ kappaA: -1, kappaB: 2 });
	for (const offset of [undefined, 0, 4, "x", NaN, Symbol("ignored")]) {
		const parallel = element.parallel(offset);
		assert.ok(parallel instanceof canonical.ImmediateElement);
		assert.notStrictEqual(parallel, element);
		assert.equal(parallel.arcLength, 0);
		assert.equal(parallel.kappaA, -1);
		assert.equal(parallel.kappaB, 2);
	}
});

test("subclass prototype and inherited operations use canonical authority", () => {
	class SpecializedImmediate extends canonical.ImmediateElement {}
	const element = new SpecializedImmediate({ kappaA: 1, kappaB: 2 });
	assert.ok(element instanceof SpecializedImmediate);
	assert.ok(element instanceof canonical.ImmediateElement);
	assert.ok(element instanceof TransitionElement);
	assert.equal(element.curvatureAt(10), 2);
	assert.equal(element.clampS(10), 0);
});

test("legacy and canonical instances remain deeply identical on independent fixtures", () => {
	for (const options of [
		undefined,
		{},
		{ kappaA: 1, kappaB: 2 },
		{ kappaA: "0.1", kappaB: "0.4", meta: { extension: true } },
	]) {
		const oldElement = new legacy.ImmediateElement(options);
		const newElement = new canonical.ImmediateElement(options);
		assert.deepEqual(oldElement, newElement);
		assert.deepEqual(oldElement.reverse(), newElement.reverse());
		assert.deepEqual(oldElement.parallel(7), newElement.parallel(7));
	}
});

test("native malformed input and external input nonmutation remain exact", () => {
	assert.throws(() => new canonical.ImmediateElement(null), TypeError);
	assert.throws(() => new legacy.ImmediateElement(null), TypeError);
	const options = { kappaA: 1, kappaB: 2, meta: { source: "fixture" } };
	const before = structuredClone(options);
	new canonical.ImmediateElement(options);
	assert.deepEqual(options, before);
});
