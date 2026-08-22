import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/geometry/poseAdvance2.js";
import * as geometry from "../../../src/aim-core/geometry/index.js";
import * as legacy from "../../../src/lib/geom/frame/poseAdvance2.js";
import * as root from "../../../src/aim-core/index.js";

function evaluate(api, pose, ds, kappa) {
	return kappa === undefined
		? api.advance(pose, ds)
		: api.advance(pose, ds, kappa);
}

test("legacy canonical Geometry and Root share one advance authority", () => {
	assert.deepEqual(Object.keys(legacy), ["advance"]);
	assert.deepEqual(Object.keys(canonical), ["advance"]);
	assert.strictEqual(legacy.advance, canonical.advance);
	assert.strictEqual(geometry.advance, canonical.advance);
	assert.strictEqual(root.advance, canonical.advance);
});

test("straight advance preserves formula key order tangent copy and input", () => {
	const pose = { p: { x: 2, y: -3 }, t: { x: 4, y: 5 } };
	const before = structuredClone(pose);
	const result = canonical.advance(pose, 2);
	assert.deepEqual(result, { p: { x: 10, y: 7 }, t: { x: 4, y: 5 } });
	assert.deepEqual(Object.keys(result), ["p", "t"]);
	assert.deepEqual(Object.keys(result.p), ["x", "y"]);
	assert.deepEqual(Object.keys(result.t), ["x", "y"]);
	assert.notStrictEqual(result.p, pose.p);
	assert.notStrictEqual(result.t, pose.t);
	assert.deepEqual(pose, before);
});

test("strict curvature threshold preserves below and at-boundary behavior", () => {
	const pose = { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } };
	const below = canonical.advance(pose, 3, 0.9999999999999999e-15);
	const at = canonical.advance(pose, 3, 1e-15);
	assert.deepEqual(below, { p: { x: 3, y: 0 }, t: { x: 1, y: 0 } });
	assert.notDeepEqual(at, below);
	assert.equal(at.t.y, Math.sin(1e-15 * 3));
});

test("positive and negative curvature preserve orientation and formulas", () => {
	const pose = { p: { x: 3, y: 7 }, t: { x: 1, y: 0 } };
	for (const kappa of [0.25, -0.25]) {
		const result = canonical.advance(pose, 2, kappa);
		const dpsi = kappa * 2;
		assert.deepEqual(result, {
			p: {
				x: 3 + Math.sin(dpsi) / kappa,
				y: 7 + (1 - Math.cos(dpsi)) / kappa,
			},
			t: { x: Math.cos(dpsi), y: Math.sin(dpsi) },
		});
	}
});

test("negative distance preserves existing signed operation order", () => {
	const pose = { p: { x: -1, y: 4 }, t: { x: 0, y: 1 } };
	const result = canonical.advance(pose, -2, 0.5);
	const dpsi = -1;
	assert.deepEqual(result, {
		p: {
			x: -1 - (1 - Math.cos(dpsi)) / 0.5,
			y: 4 + Math.sin(dpsi) / 0.5,
		},
		t: { x: -Math.sin(dpsi), y: Math.cos(dpsi) },
	});
});

test("zero negative-zero and coercible values preserve native coercion", () => {
	const pose = { p: { x: 1, y: 2 }, t: { x: 3, y: 4 } };
	assert.deepEqual(canonical.advance(pose, "2", "0"), {
		p: { x: 7, y: 10 },
		t: { x: 3, y: 4 },
	});
	assert.deepEqual(canonical.advance(pose, 2, -0), {
		p: { x: 7, y: 10 },
		t: { x: 3, y: 4 },
	});
});

test("nonfinite values retain existing NaN and Infinity behavior", () => {
	const pose = { p: { x: 1, y: 2 }, t: { x: 3, y: 4 } };
	for (const [ds, kappa] of [
		[NaN, 0],
		[Infinity, 0],
		[1, NaN],
		[1, Infinity],
	]) {
		const result = canonical.advance(pose, ds, kappa);
		assert.ok(Number.isNaN(result.p.x) || !Number.isFinite(result.p.x));
	}
});

test("rot90 is evaluated before straight-branch malformed arithmetic", () => {
	assert.throws(() => canonical.advance({ p: { x: 0, y: 0 } }, 1, 0));
	assert.throws(() => canonical.advance(null, 1, 0), TypeError);
});

test("old and canonical functions remain deeply identical across fixtures", () => {
	const fixtures = [
		[{ p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }, 0, 0],
		[{ p: { x: 1, y: 2 }, t: { x: 0, y: 1 } }, 5, 0],
		[{ p: { x: -2, y: 3 }, t: { x: 1, y: 0 } }, 4, 0.2],
		[{ p: { x: -2, y: 3 }, t: { x: 1, y: 0 } }, -4, -0.2],
		[{ p: { x: 1, y: 2 }, t: { x: 3, y: 4 } }, "2", "0"],
	];
	for (const [pose, ds, kappa] of fixtures) {
		const before = structuredClone(pose);
		assert.deepEqual(
			evaluate(legacy, pose, ds, kappa),
			evaluate(canonical, pose, ds, kappa)
		);
		assert.deepEqual(pose, before);
	}
});
