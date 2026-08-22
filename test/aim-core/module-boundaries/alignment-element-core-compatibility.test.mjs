import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/geometry/AlignmentElement.js";
import * as geometry from "../../../src/aim-core/geometry/index.js";
import * as legacy from "../../../src/domain/alignment/elements/AlignmentElement.js";
import * as root from "../../../src/aim-core/index.js";

class SyntheticElement extends canonical.AlignmentElement {
	constructor(options, calls = []) {
		super(options);
		this.calls = calls;
		this.pose = {
			p: { x: 10, y: -2 },
			t: { x: 0, y: 4 },
		};
	}

	curvatureAt(s) {
		this.calls.push(["curvatureAt", s]);
		return s;
	}

	poseAt(s, poseA, opts = {}) {
		this.calls.push(["poseAt", s, poseA, opts]);
		return this.pose;
	}

	reverse() {
		this.calls.push(["reverse"]);
		return this;
	}

	parallel(offset) {
		this.calls.push(["parallel", offset]);
		return this;
	}

	world2Track(x, y, poseA, opts = {}) {
		this.calls.push(["world2Track", x, y, poseA, opts]);
		return { x, y };
	}
}

test("legacy canonical Geometry and Root share one AlignmentElement authority", () => {
	assert.deepEqual(Object.keys(legacy), ["AlignmentElement"]);
	assert.deepEqual(Object.keys(canonical), ["AlignmentElement"]);
	assert.strictEqual(legacy.AlignmentElement, canonical.AlignmentElement);
	assert.strictEqual(geometry.AlignmentElement, canonical.AlignmentElement);
	assert.strictEqual(root.AlignmentElement, canonical.AlignmentElement);
});

test("constructor preserves default and Number-or-zero arcLength behavior", () => {
	for (const [value, expected] of [
		[undefined, 0],
		[null, 0],
		["", 0],
		["5.5", 5.5],
		[-3, -3],
		[NaN, 0],
		["invalid", 0],
		[Infinity, Infinity],
		[-Infinity, -Infinity],
	]) {
		const element = value === undefined
			? new canonical.AlignmentElement()
			: new canonical.AlignmentElement({ arcLength: value });
		assert.equal(element.arcLength, expected);
	}
});

test("arcLength storage remains directly mutable", () => {
	const element = new canonical.AlignmentElement({ arcLength: 5 });
	assert.equal(element.arcLength, 5);
	element._arcLength = "changed";
	assert.equal(element.arcLength, "changed");
	assert.equal(Object.isFrozen(element), false);
});

test("clampS preserves coercion finite fallback and Math clamp order", () => {
	const element = new canonical.AlignmentElement({ arcLength: 10 });
	for (const [value, expected] of [
		[-1, 0],
		["4.5", 4.5],
		[10, 10],
		[11, 10],
		[NaN, 0],
		[Infinity, 0],
		[-Infinity, 0],
		[null, 0],
	]) {
		assert.equal(element.clampS(value), expected);
	}
	const negative = new canonical.AlignmentElement({ arcLength: -3 });
	assert.equal(negative.clampS(1), 0);
	const infinite = new canonical.AlignmentElement({ arcLength: Infinity });
	assert.equal(infinite.clampS(12), 12);
});

test("abstract methods preserve exact Error type and text", () => {
	const element = new canonical.AlignmentElement();
	for (const [call, message] of [
		[() => element.curvatureAt(1), "AlignmentElement.curvatureAt(s) not implemented"],
		[() => element.poseAt(1, {}), "AlignmentElement.poseAt(s, poseA) not implemented"],
		[() => element.reverse(), "AlignmentElement.reverse() not implemented"],
		[() => element.parallel(2), "AlignmentElement.parallel(offset) not implemented"],
		[() => element.world2Track(1, 2, {}), "AlignmentElement.world2Track not implemented"],
	]) {
		assert.throws(call, { name: "Error", message });
	}
});

test("convenience methods forward exact arguments opts and returned identities", () => {
	const calls = [];
	const element = new SyntheticElement({ arcLength: 7 }, calls);
	const poseA = { identity: "poseA" };
	const opts = { quality: "exact" };
	assert.strictEqual(element.poseE(poseA, opts), element.pose);
	assert.strictEqual(element.pointAt(3, poseA, opts), element.pose.p);
	assert.strictEqual(element.tangentAt(4, poseA, opts), element.pose.t);
	assert.deepEqual(calls, [
		["poseAt", 7, poseA, opts],
		["poseAt", 3, poseA, opts],
		["poseAt", 4, poseA, opts],
	]);
});

test("track2World preserves normalized left normal and result key order", () => {
	const calls = [];
	const element = new SyntheticElement({ arcLength: 7 }, calls);
	const poseA = { identity: "poseA" };
	const opts = { quality: "balanced" };
	const result = element.track2World(3, 5, poseA, opts);
	assert.deepEqual(result, { x: 5, y: -2 });
	assert.deepEqual(Object.keys(result), ["x", "y"]);
	assert.deepEqual(calls, [["poseAt", 3, poseA, opts]]);
});

test("track2World preserves q defaults coercion and native arithmetic", () => {
	const element = new SyntheticElement({ arcLength: 7 });
	assert.deepEqual(element.track2World(0), { x: 10, y: -2 });
	assert.deepEqual(element.track2World(0, "3"), { x: 7, y: -2 });
	assert.deepEqual(element.track2World(0, NaN), { x: NaN, y: NaN });
	element.pose.t = { x: 0, y: 0 };
	assert.throws(
		() => element.track2World(0, 1),
		{ message: "vec2.normalize(): zero-length vector" }
	);
});

test("subclass prototype instanceof and overridden methods remain exact", () => {
	const element = new SyntheticElement({ arcLength: 2 });
	assert.ok(element instanceof SyntheticElement);
	assert.ok(element instanceof canonical.AlignmentElement);
	assert.ok(element instanceof legacy.AlignmentElement);
	assert.strictEqual(element.reverse(), element);
	assert.strictEqual(element.parallel(-4), element);
	assert.deepEqual(element.world2Track("1", "2", null), { x: "1", y: "2" });
});

test("legacy and canonical constructors and errors remain deeply identical", () => {
	for (const options of [
		undefined,
		{},
		{ arcLength: "4" },
		{ arcLength: -2 },
		{ arcLength: Infinity },
	]) {
		const oldElement = new legacy.AlignmentElement(options);
		const newElement = new canonical.AlignmentElement(options);
		assert.deepEqual(oldElement, newElement);
		for (const value of [-2, "1.5", 9, NaN]) {
			assert.equal(oldElement.clampS(value), newElement.clampS(value));
		}
	}
	assert.throws(
		() => new legacy.AlignmentElement().reverse(),
		{ message: "AlignmentElement.reverse() not implemented" }
	);
	assert.throws(
		() => new canonical.AlignmentElement().reverse(),
		{ message: "AlignmentElement.reverse() not implemented" }
	);
});
