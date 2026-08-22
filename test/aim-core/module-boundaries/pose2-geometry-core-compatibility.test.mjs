import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/geometry/pose2.js";
import * as geometry from "../../../src/aim-core/geometry/index.js";
import * as legacy from "../../../src/lib/geom/frame/pose2.js";
import * as root from "../../../src/aim-core/index.js";

test("legacy canonical Geometry and Root share every pose2 function", () => {
	assert.deepEqual(Object.keys(legacy), Object.keys(canonical));
	for (const name of Object.keys(canonical)) {
		assert.strictEqual(legacy[name], canonical[name], name);
		assert.strictEqual(geometry[name], canonical[name], name);
		assert.strictEqual(root[name], canonical[name], name);
	}
});

test("pose constructors preserve formulas coercion and key order", () => {
	assert.deepEqual(
		canonical.poseFromTangent(1, 2, 3, 4),
		{ p: { x: 1, y: 2 }, t: { x: 0.6, y: 0.8 } }
	);
	assert.deepEqual(
		canonical.poseFromHeading(1, 2, Math.PI / 2),
		{ p: { x: 1, y: 2 }, t: { x: Math.cos(Math.PI / 2), y: 1 } }
	);
	assert.deepEqual(
		canonical.poseFromTwoPoints(1, 2, 4, 6),
		canonical.poseFromTangent(1, 2, 3, 4)
	);
	assert.deepEqual(
		Object.keys(canonical.poseFromHeading(0, 0, 0)),
		["p", "t"]
	);
	assert.throws(
		() => canonical.poseFromTangent(0, 0, 0, 0),
		{ name: "Error", message: "vec2.normalize(): zero-length vector" }
	);
});

test("point tangent accessors preserve aliases and optional fallbacks", () => {
	const pose = { p: { x: 2, y: 3 }, t: { x: 0, y: 1 } };
	assert.strictEqual(canonical.point(pose), pose.p);
	assert.strictEqual(canonical.tangent(pose), pose.t);
	assert.strictEqual(canonical.posePoint(pose), pose.p);
	assert.strictEqual(canonical.poseTangent(pose), pose.t);
	assert.equal(canonical.poseX(pose), 2);
	assert.equal(canonical.poseY(pose), 3);
	assert.equal(canonical.poseX(null), null);
	assert.equal(canonical.poseY({}), null);
	assert.equal(canonical.posePoint(null), null);
	assert.equal(canonical.poseTangent(undefined), null);
	assert.throws(() => canonical.point(null), TypeError);
	assert.throws(() => canonical.tangent(null), TypeError);
});

test("normal and heading preserve left orientation and native behavior", () => {
	const pose = { p: { x: 0, y: 0 }, t: { x: 3, y: 4 } };
	assert.deepEqual(canonical.normal(pose), { x: -4, y: 3 });
	assert.equal(canonical.heading(pose), Math.atan2(4, 3));
	assert.throws(() => canonical.normal(null), TypeError);
	assert.throws(() => canonical.heading({}), TypeError);
});

test("sanitizePose copies point normalizes tangent and preserves inputs", () => {
	const pose = { p: { x: 1, y: 2 }, t: { x: 3, y: 4 } };
	const before = structuredClone(pose);
	const result = canonical.sanitizePose(pose);
	assert.deepEqual(result, {
		p: { x: 1, y: 2 },
		t: { x: 0.6, y: 0.8 },
	});
	assert.notStrictEqual(result.p, pose.p);
	assert.notStrictEqual(result.t, pose.t);
	assert.deepEqual(pose, before);
	assert.throws(
		() =>
			canonical.sanitizePose({
				p: { x: 0, y: 0 },
				t: { x: 0, y: 0 },
			}),
		/vec2\.normalize\(\): zero-length vector/
	);
});

test("world and local transforms preserve formulas orientation and order", () => {
	const pose = { p: { x: 10, y: 20 }, t: { x: 1, y: 0 } };
	assert.deepEqual(canonical.worldFromLocal(pose, 3, 4), {
		x: 13,
		y: 24,
	});
	assert.deepEqual(canonical.localFromWorld(pose, 13, 24), {
		u: 3,
		v: 4,
	});
	assert.deepEqual(
		Object.keys(canonical.localFromWorld(pose, 10, 20)),
		["u", "v"]
	);
	assert.deepEqual(
		canonical.worldFromLocal(pose, "2", "3"),
		{ x: 12, y: 23 }
	);
});

test("isPose2 preserves shallow finite structural validation", () => {
	for (const valid of [
		{ p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
		{ p: { x: -1, y: 2 }, t: { x: 0, y: -2 } },
	]) {
		assert.equal(canonical.isPose2(valid), true);
	}
	for (const invalid of [
		null,
		{},
		{ p: {}, t: {} },
		{ p: { x: "0", y: 0 }, t: { x: 1, y: 0 } },
		{ p: { x: NaN, y: 0 }, t: { x: 1, y: 0 } },
		{ p: { x: 0, y: 0 }, t: { x: Infinity, y: 0 } },
	]) {
		assert.equal(canonical.isPose2(invalid), false);
	}
});

test("legacy and canonical APIs remain deeply identical on independent fixtures", () => {
	const poses = [
		{ p: { x: 1, y: 2 }, t: { x: 1, y: 0 } },
		{ p: { x: -2, y: 5 }, t: { x: 0, y: -1 } },
		{ p: { x: Infinity, y: 0 }, t: { x: 1, y: 0 } },
	];
	for (const pose of poses) {
		assert.deepEqual(legacy.normal(pose), canonical.normal(pose));
		assert.deepEqual(
			legacy.worldFromLocal(pose, 2, -3),
			canonical.worldFromLocal(pose, 2, -3)
		);
		assert.deepEqual(
			legacy.localFromWorld(pose, 4, 6),
			canonical.localFromWorld(pose, 4, 6)
		);
		assert.equal(legacy.isPose2(pose), canonical.isPose2(pose));
	}
});
