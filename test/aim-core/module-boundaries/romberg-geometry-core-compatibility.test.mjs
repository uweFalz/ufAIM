import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/geometry/romberg.js";
import * as geometry from "../../../src/aim-core/geometry/index.js";
import * as legacy from "../../../src/lib/math/numeric/romberg.js";
import * as root from "../../../src/aim-core/index.js";

const DEFAULTS = { NMAX: 32, abs: 1e-12, rel: 1e-12 };

function restore() {
	Object.assign(canonical.romberg, DEFAULTS);
}

test.afterEach(restore);

test("legacy canonical Geometry and Root share one mutable authority", () => {
	assert.deepEqual(Object.keys(legacy), ["romberg"]);
	assert.deepEqual(Object.keys(canonical), ["romberg"]);
	assert.strictEqual(legacy.romberg, canonical.romberg);
	assert.strictEqual(geometry.romberg, canonical.romberg);
	assert.strictEqual(root.romberg, canonical.romberg);
});

test("API key order descriptors defaults and public mutability remain exact", () => {
	assert.deepEqual(Object.keys(canonical.romberg), [
		"NMAX",
		"abs",
		"rel",
		"integrate",
		"integrateFresnel",
	]);
	assert.deepEqual(
		{
			NMAX: canonical.romberg.NMAX,
			abs: canonical.romberg.abs,
			rel: canonical.romberg.rel,
		},
		DEFAULTS
	);
	for (const key of Object.keys(canonical.romberg)) {
		const descriptor = Object.getOwnPropertyDescriptor(canonical.romberg, key);
		assert.equal(descriptor.enumerable, true);
		assert.equal(descriptor.configurable, true);
		assert.equal(descriptor.writable, true);
	}
	canonical.romberg.NMAX = 2;
	legacy.romberg.abs = 3;
	geometry.romberg.rel = 4;
	assert.deepEqual(
		[root.romberg.NMAX, root.romberg.abs, root.romberg.rel],
		[2, 3, 4]
	);
});

test("scalar constant linear polynomial and trigonometric integrals remain exact", () => {
	assert.equal(canonical.romberg.integrate(() => 3, 0, 2), 6);
	assert.equal(canonical.romberg.integrate((x) => x, 0, 2), 2);
	assert.ok(Math.abs(canonical.romberg.integrate((x) => x * x, 0, 3) - 9) < 1e-12);
	assert.ok(Math.abs(canonical.romberg.integrate(Math.sin, 0, Math.PI) - 2) < 1e-12);
});

test("scalar reversed zero and coercible bounds retain behavior", () => {
	assert.equal(canonical.romberg.integrate(() => 2, 3, 1), -4);
	assert.equal(canonical.romberg.integrate(() => 2, 4, 4), 0);
	assert.equal(canonical.romberg.integrate((x) => Number(x), "0", "2"), 2);
});

test("NMAX tolerance fallback and invocation order remain observable", () => {
	canonical.romberg.NMAX = 0;
	const calls = [];
	const result = canonical.romberg.integrate((x) => {
		calls.push(x);
		return x * x;
	}, 0, 2);
	assert.deepEqual(calls, [0, 2]);
	assert.equal(result, 4);

	canonical.romberg.NMAX = 1;
	canonical.romberg.abs = -1;
	canonical.romberg.rel = -1;
	const calls2 = [];
	canonical.romberg.integrate((x) => {
		calls2.push(x);
		return x;
	}, 0, 2);
	assert.deepEqual(calls2, [0, 2, 1]);
});

test("scalar nonfinite native errors and thrown integrands remain unchanged", () => {
	canonical.romberg.NMAX = 1;
	assert.ok(Number.isNaN(canonical.romberg.integrate(() => 1, 0, NaN)));
	assert.throws(
		() => canonical.romberg.integrate(() => { throw new Error("integrand"); }, 0, 1),
		{ message: "integrand" }
	);
	assert.throws(() => canonical.romberg.integrate(null, 0, 1), TypeError);
});

test("Fresnel constant heading preserves exact shape order and orientation", () => {
	for (const [angle, a, b] of [
		[0, 0, 2],
		[Math.PI / 2, 0, 2],
		[Math.PI, 2, 0],
	]) {
		const result = canonical.romberg.integrateFresnel(() => angle, a, b);
		assert.deepEqual(Object.keys(result), ["intC", "intS"]);
		assert.ok(Math.abs(result.intC - (b - a) * Math.cos(angle)) < 1e-12);
		assert.ok(Math.abs(result.intS - (b - a) * Math.sin(angle)) < 1e-12);
	}
});

test("Fresnel varying heading reversed and zero interval remain exact", () => {
	const forward = canonical.romberg.integrateFresnel((x) => x, 0, 1);
	const reverse = canonical.romberg.integrateFresnel((x) => x, 1, 0);
	assert.ok(Math.abs(forward.intC + reverse.intC) < 1e-12);
	assert.ok(Math.abs(forward.intS + reverse.intS) < 1e-12);
	assert.deepEqual(
		canonical.romberg.integrateFresnel((x) => x, 2, 2),
		{ intC: 0, intS: 0 }
	);
});

test("Fresnel NMAX fallback call order and thrown errors remain exact", () => {
	canonical.romberg.NMAX = 0;
	const calls = [];
	const result = canonical.romberg.integrateFresnel((x) => {
		calls.push(x);
		return x;
	}, 0, 2);
	assert.deepEqual(calls, [0, 2]);
	assert.deepEqual(result, {
		intC: Math.cos(0) + Math.cos(2),
		intS: Math.sin(0) + Math.sin(2),
	});
	assert.throws(
		() => canonical.romberg.integrateFresnel(() => { throw new Error("tau"); }, 0, 1),
		{ message: "tau" }
	);
});

test("legacy and canonical method calls are identical without leaked config", () => {
	const methods = [
		() => legacy.romberg.integrate((x) => x * x, -1, 2),
		() => canonical.romberg.integrate((x) => x * x, -1, 2),
	];
	assert.equal(methods[0](), methods[1]());
	assert.deepEqual(
		legacy.romberg.integrateFresnel((x) => 0.5 * x, -1, 2),
		canonical.romberg.integrateFresnel((x) => 0.5 * x, -1, 2)
	);
	restore();
	assert.deepEqual(
		{
			NMAX: root.romberg.NMAX,
			abs: root.romberg.abs,
			rel: root.romberg.rel,
		},
		DEFAULTS
	);
});
