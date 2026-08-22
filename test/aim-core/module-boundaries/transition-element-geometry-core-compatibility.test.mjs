import assert from "node:assert/strict";
import test from "node:test";

import { AlignmentElement } from "../../../src/aim-core/geometry/AlignmentElement.js";
import * as canonical from "../../../src/aim-core/geometry/TransitionElement.js";
import * as geometry from "../../../src/aim-core/geometry/index.js";
import * as legacy from "../../../src/domain/alignment/elements/TransitionElement.js";
import { romberg } from "../../../src/aim-core/geometry/romberg.js";
import * as root from "../../../src/aim-core/index.js";

const linearRuntime = {
	kappa: (u) => u,
	kappaInt: (u) => u * u / 2,
	kappa1: () => 1,
	kappa2: () => 0,
};

function snapshotRomberg() {
	return {
		abs: romberg.abs,
		rel: romberg.rel,
		NMAX: romberg.NMAX,
		integrateFresnel: romberg.integrateFresnel,
	};
}

function restoreRomberg(saved) {
	romberg.abs = saved.abs;
	romberg.rel = saved.rel;
	romberg.NMAX = saved.NMAX;
	romberg.integrateFresnel = saved.integrateFresnel;
}

test("legacy canonical Geometry and Root share one TransitionElement authority", () => {
	assert.deepEqual(Object.keys(legacy), ["TransitionElement"]);
	assert.deepEqual(Object.keys(canonical), ["TransitionElement"]);
	assert.strictEqual(legacy.TransitionElement, canonical.TransitionElement);
	assert.strictEqual(geometry.TransitionElement, canonical.TransitionElement);
	assert.strictEqual(root.TransitionElement, canonical.TransitionElement);
	assert.strictEqual(
		Object.getPrototypeOf(canonical.TransitionElement.prototype),
		AlignmentElement.prototype
	);
});

test("constructor preserves defaults coercion aliasing and mutability", () => {
	const meta = { source: "fixture" };
	const runtime = { ...linearRuntime };
	const element = new canonical.TransitionElement({
		id: "T",
		arcLength: "10",
		runtimePreset: runtime,
		kappaA: "0.1",
		kappaB: "invalid",
		meta,
	});
	assert.equal(element.id, undefined);
	assert.equal(element.arcLength, 10);
	assert.strictEqual(element.runtime, runtime);
	assert.equal(element.meta, undefined);
	assert.equal(element.kappaA, 0.1);
	assert.equal(element.kappaB, 0);
	assert.equal(Object.isFrozen(element), false);
	element.kappaB = 0.3;
	assert.equal(element.kappaB, 0.3);
});

test("invalid runtime preserves exact logs timing payloads and error", () => {
	const calls = [];
	const originalLog = console.log;
	console.log = (...args) => calls.push(args);
	try {
		assert.throws(
			() => new canonical.TransitionElement({ runtimePreset: { kappa: () => 0 } }),
			{
				name: "Error",
				message: "TransitionElement: missing runtimePreset.kappa/kappaInt",
			}
		);
		assert.equal(calls.length, 2);
		assert.deepEqual(calls[0], [
			"[TransitionElement] incoming runtimePreset",
			calls[0][1],
		]);
		assert.equal(typeof calls[0][1].kappa, "function");
		assert.equal(calls[1][0], "[TransitionElement] incoming typeof");
		assert.deepEqual(calls[1][1], {
			kappa: "function",
			kappaInt: "undefined",
			kappa1: "undefined",
			kappa2: "undefined",
			keys: ["kappa"],
		});
	} finally {
		console.log = originalLog;
	}
});

test("curvature and derivatives preserve clamps thresholds and runtime calls", () => {
	const calls = [];
	const runtime = {
		kappa: (u) => (calls.push(["k", u]), u),
		kappaInt: (u) => u * u / 2,
		kappa1: (u) => (calls.push(["k1", u]), 2 * u),
		kappa2: (u) => (calls.push(["k2", u]), 3 * u),
	};
	const element = new canonical.TransitionElement({
		arcLength: 10,
		runtimePreset: runtime,
		kappaA: 1,
		kappaB: 3,
	});
	assert.equal(element.curvatureAt(-1), 1);
	assert.equal(element.curvatureAt("5"), 2);
	assert.equal(element.curvatureAt(Infinity), 1);
	assert.equal(element.curvature1At(5), 0.2);
	assert.equal(element.curvature2At(5), 0.03);
	assert.deepEqual(calls, [
		["k", 0],
		["k", 0.5],
		["k", 0],
		["k1", 0.5],
		["k2", 0.5],
	]);

	const missing = new canonical.TransitionElement({
		arcLength: 10,
		runtimePreset: { kappa: (u) => u, kappaInt: (u) => u },
		kappaA: 1,
		kappaB: 3,
	});
	assert.equal(missing.curvature1At(5), 0);
	assert.equal(missing.curvature2At(5), 0);

	const short = new canonical.TransitionElement({
		arcLength: 1e-12,
		runtimePreset: runtime,
		kappaA: 1,
		kappaB: 3,
	});
	assert.equal(short.curvatureAt(1), 3);
	assert.equal(short.curvature1At(1), 0);
	assert.equal(short.curvature2At(1), 0);
});

test("poseAt preserves early input identity and representative straight result", () => {
	const pose = { p: { x: 2, y: 3 }, t: { x: 2, y: 0 } };
	const element = new canonical.TransitionElement({
		arcLength: 10,
		runtimePreset: {
			kappa: () => 0,
			kappaInt: () => 0,
		},
	});
	assert.strictEqual(element.poseAt(0, pose), pose);
	assert.strictEqual(
		new canonical.TransitionElement({
			arcLength: 1e-12,
			runtimePreset: linearRuntime,
		}).poseAt(1, pose),
		pose
	);
	const result = element.poseAt(4, pose);
	assert.deepEqual(Object.keys(result), ["p", "t"]);
	assert.deepEqual(Object.keys(result.p), ["x", "y"]);
	assert.deepEqual(Object.keys(result.t), ["x", "y"]);
	assert.ok(Math.abs(result.p.x - 6) < 1e-10);
	assert.ok(Math.abs(result.p.y - 3) < 1e-10);
	assert.deepEqual(result.t, { x: 1, y: 0 });
	assert.notStrictEqual(result, pose);
});

test("poseAt preserves curved output across legacy and canonical construction", () => {
	const options = {
		arcLength: 8,
		runtimePreset: linearRuntime,
		kappaA: 0,
		kappaB: 0.2,
	};
	const pose = { p: { x: 1, y: -2 }, t: { x: 0, y: 2 } };
	const oldResult = new legacy.TransitionElement(options).poseAt(5, pose);
	const newResult = new canonical.TransitionElement(options).poseAt(5, pose);
	assert.deepEqual(oldResult, newResult);
	assert.deepEqual(pose, { p: { x: 1, y: -2 }, t: { x: 0, y: 2 } });
});

test("quality modes expose exact Romberg settings and restore singleton state", () => {
	const saved = snapshotRomberg();
	const observed = [];
	try {
		romberg.abs = 7;
		romberg.rel = 8;
		romberg.NMAX = 9;
		romberg.integrateFresnel = (theta, a, b) => {
			observed.push({
				abs: romberg.abs,
				rel: romberg.rel,
				NMAX: romberg.NMAX,
				a,
				b,
				theta: theta(b),
			});
			return { intC: b, intS: 0 };
		};
		const element = new canonical.TransitionElement({
			arcLength: 10,
			runtimePreset: linearRuntime,
			kappaA: 0,
			kappaB: 0.2,
		});
		const pose = { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } };
		element.poseAt(5, pose, { quality: "exact" });
		element.poseAt(5, pose, { quality: "rough" });
		element.poseAt(5, pose);
		assert.deepEqual(
			observed.map(({ abs, rel, NMAX }) => ({ abs, rel, NMAX })),
			[
				{ abs: 1e-12, rel: 1e-12, NMAX: 24 },
				{ abs: 1e-6, rel: 1e-6, NMAX: 8 },
				{ abs: 1e-9, rel: 1e-9, NMAX: 16 },
			]
		);
		assert.deepEqual(
			{ abs: romberg.abs, rel: romberg.rel, NMAX: romberg.NMAX },
			{ abs: 7, rel: 8, NMAX: 9 }
		);
	} finally {
		restoreRomberg(saved);
	}
});

test("poseAt restores Romberg after integration and runtime failures", () => {
	const saved = snapshotRomberg();
	const element = new canonical.TransitionElement({
		arcLength: 10,
		runtimePreset: linearRuntime,
		kappaA: 0,
		kappaB: 1,
	});
	try {
		romberg.abs = 4;
		romberg.rel = 5;
		romberg.NMAX = 6;
		romberg.integrateFresnel = () => {
			throw new Error("fixture-integrator");
		};
		assert.throws(
			() => element.poseAt(2, { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }),
			/fixture-integrator/
		);
		assert.deepEqual(
			{ abs: romberg.abs, rel: romberg.rel, NMAX: romberg.NMAX },
			{ abs: 4, rel: 5, NMAX: 6 }
		);
	} finally {
		restoreRomberg(saved);
	}
});

test("reverse preserves identity data signs runtime alias and class", () => {
	const meta = { note: "same" };
	const element = new canonical.TransitionElement({
		id: "T",
		arcLength: 12,
		runtimePreset: linearRuntime,
		kappaA: 0.1,
		kappaB: -0.3,
		meta,
	});
	const reversed = element.reverse();
	assert.ok(reversed instanceof canonical.TransitionElement);
	assert.notStrictEqual(reversed, element);
	assert.equal(reversed.id, undefined);
	assert.equal(reversed.arcLength, 12);
	assert.strictEqual(reversed.runtime, linearRuntime);
	assert.equal(reversed.meta, undefined);
	assert.equal(reversed.kappaA, 0.3);
	assert.equal(reversed.kappaB, -0.1);
});

test("parallel preserves exact not-implemented error", () => {
	const element = new canonical.TransitionElement({
		runtimePreset: linearRuntime,
	});
	assert.throws(
		() => element.parallel(2),
		{
			name: "Error",
			message: "TransitionElement.parallel(offset) not implemented yet",
		}
	);
});

test("legacy and canonical construction remain deeply identical", () => {
	for (const options of [
		{ runtimePreset: linearRuntime },
		{
			id: "T",
			arcLength: "6",
			runtimePreset: linearRuntime,
			kappaA: "0.1",
			kappaB: "0.4",
			meta: { extension: true },
		},
	]) {
		const oldElement = new legacy.TransitionElement(options);
		const newElement = new canonical.TransitionElement(options);
		assert.deepEqual(oldElement, newElement);
		assert.deepEqual(oldElement.reverse(), newElement.reverse());
	}
});

test("native malformed behavior and input nonmutation remain shared", () => {
	const originalLog = console.log;
	console.log = () => {};
	try {
		assert.throws(() => new canonical.TransitionElement(null), TypeError);
		assert.throws(() => new legacy.TransitionElement(null), TypeError);
	} finally {
		console.log = originalLog;
	}
	const pose = { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } };
	const before = structuredClone(pose);
	new canonical.TransitionElement({
		arcLength: 2,
		runtimePreset: linearRuntime,
		kappaA: 0,
		kappaB: 0.2,
	}).poseAt(1, pose);
	assert.deepEqual(pose, before);
});
