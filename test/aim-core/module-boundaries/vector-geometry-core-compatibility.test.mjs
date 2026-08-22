import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/geometry/vec2.js";
import * as geometry from "../../../src/aim-core/geometry/index.js";
import * as legacy from "../../../src/lib/geom/vec2.js";
import * as root from "../../../src/aim-core/index.js";

const API = [
	"add",
	"dot",
	"len",
	"len2",
	"normalize",
	"rot",
	"rot90",
	"scale",
	"sub",
	"vec",
].sort();

test("legacy canonical Geometry and Root exports share one authority", () => {
	assert.deepEqual(Object.keys(legacy).sort(), API);
	assert.deepEqual(Object.keys(canonical).sort(), API);
	for (const name of API) {
		assert.strictEqual(legacy[name], canonical[name], name);
		assert.strictEqual(geometry[name], canonical[name], name);
		assert.strictEqual(root[name], canonical[name], name);
	}
});

test("vec preserves defaults values key order and fresh mutable identities", () => {
	const first = canonical.vec();
	const second = canonical.vec();
	assert.deepEqual(first, { x: 0, y: 0 });
	assert.deepEqual(Object.keys(first), ["x", "y"]);
	assert.notStrictEqual(first, second);
	assert.equal(Object.isFrozen(first), false);
	first.x = 3;
	assert.equal(second.x, 0);
	const x = { identity: "x" };
	const y = null;
	const retained = canonical.vec(x, y);
	assert.strictEqual(retained.x, x);
	assert.strictEqual(retained.y, y);
});

test("dot len2 and len preserve operation order coercion and nonfinite behavior", () => {
	assert.equal(canonical.dot({ x: 3, y: 4 }, { x: 2, y: -1 }), 2);
	assert.equal(canonical.len2({ x: 3, y: 4 }), 25);
	assert.equal(canonical.len({ x: 3, y: 4 }), 5);
	assert.equal(canonical.dot({ x: "3", y: "4" }, { x: 2, y: 1 }), 10);
	assert.equal(canonical.len2({ x: -3, y: 4 }), 25);
	assert.equal(canonical.len({ x: Infinity, y: 1 }), Infinity);
	assert.equal(Number.isNaN(canonical.len({ x: NaN, y: 1 })), true);
});

test("scale add and sub preserve formulas coercion key order and input nonmutation", () => {
	const a = { x: 1.5, y: -2 };
	const b = { x: 0.5, y: 3 };
	const beforeA = structuredClone(a);
	const beforeB = structuredClone(b);
	assert.deepEqual(canonical.scale(a, -2), { x: -3, y: 4 });
	assert.deepEqual(canonical.add(a, b), { x: 2, y: 1 });
	assert.deepEqual(canonical.sub(a, b), { x: 1, y: -5 });
	assert.deepEqual(canonical.add({ x: "1", y: "2" }, { x: 3, y: 4 }), {
		x: "13",
		y: "24",
	});
	assert.deepEqual(canonical.sub({ x: "5", y: "2" }, { x: 3, y: 4 }), {
		x: 2,
		y: -2,
	});
	assert.deepEqual(Object.keys(canonical.scale(a, 1)), ["x", "y"]);
	assert.deepEqual(a, beforeA);
	assert.deepEqual(b, beforeB);
});

test("rot90 and rot preserve exact orientation formulas and fresh results", () => {
	const value = { x: 2, y: -3 };
	assert.deepEqual(canonical.rot90(value), { x: 3, y: 2 });
	assert.deepEqual(canonical.rot({ x: 1, y: 0 }, Math.PI / 2), {
		x: Math.cos(Math.PI / 2),
		y: Math.sin(Math.PI / 2),
	});
	assert.deepEqual(canonical.rot(value, 0), value);
	assert.notStrictEqual(canonical.rot(value, 0), value);
	assert.deepEqual(value, { x: 2, y: -3 });
});

test("normalize preserves default custom and strict threshold behavior", () => {
	assert.deepEqual(canonical.normalize({ x: 3, y: 4 }), { x: 0.6, y: 0.8 });
	assert.deepEqual(canonical.normalize({ x: 1e-12, y: 0 }), {
		x: 1,
		y: 0,
	});
	assert.throws(
		() => canonical.normalize({ x: 1e-13, y: 0 }),
		{
			name: "Error",
			message: "vec2.normalize(): zero-length vector",
		}
	);
	assert.throws(
		() => canonical.normalize({ x: 1, y: 0 }, 2),
		{
			message: "vec2.normalize(): zero-length vector",
		}
	);
	assert.deepEqual(canonical.normalize({ x: 1, y: 0 }, 1), { x: 1, y: 0 });
});

test("normalize retains negative NaN and nonfinite edge behavior", () => {
	const negativeEps = canonical.normalize({ x: 0, y: 0 }, -1);
	assert.equal(Number.isNaN(negativeEps.x), true);
	assert.equal(Number.isNaN(negativeEps.y), true);
	const nanEps = canonical.normalize({ x: 0, y: 0 }, NaN);
	assert.equal(Number.isNaN(nanEps.x), true);
	assert.equal(Number.isNaN(nanEps.y), true);
	const infinity = canonical.normalize({ x: Infinity, y: 1 });
	assert.equal(Number.isNaN(infinity.x), true);
	assert.equal(infinity.y, 0);
});

test("every primitive remains deeply identical through old and canonical APIs", () => {
	const calls = [
		(api) => api.vec(-1.25, 2.5),
		(api) => api.dot({ x: -2, y: 3 }, { x: 4, y: 0.5 }),
		(api) => api.len2({ x: 0.25, y: -0.75 }),
		(api) => api.len({ x: 0.25, y: -0.75 }),
		(api) => api.scale({ x: -2, y: 3 }, 0.25),
		(api) => api.add({ x: -2, y: 3 }, { x: 4, y: -1 }),
		(api) => api.sub({ x: -2, y: 3 }, { x: 4, y: -1 }),
		(api) => api.rot90({ x: -2, y: 3 }),
		(api) => api.rot({ x: -2, y: 3 }, -0.25),
		(api) => api.normalize({ x: -2, y: 3 }, 0),
	];
	for (const call of calls) {
		assert.deepEqual(call(legacy), call(canonical));
	}
});

test("native malformed operand behavior remains shared", () => {
	for (const call of [
		(api) => api.dot(null, { x: 1, y: 2 }),
		(api) => api.scale(undefined, 2),
		(api) => api.rot90(null),
		(api) => api.normalize(null),
	]) {
		assert.throws(() => call(legacy));
		assert.throws(() => call(canonical));
	}
});

test("returned records are fresh and inputs are never mutated", () => {
	const input = { x: 8, y: 6 };
	const before = structuredClone(input);
	for (const result of [
		canonical.scale(input, 2),
		canonical.add(input, { x: 1, y: 1 }),
		canonical.sub(input, { x: 1, y: 1 }),
		canonical.rot90(input),
		canonical.rot(input, 0.5),
		canonical.normalize(input),
	]) {
		assert.notStrictEqual(result, input);
		assert.deepEqual(Object.keys(result), ["x", "y"]);
	}
	assert.deepEqual(input, before);
});
