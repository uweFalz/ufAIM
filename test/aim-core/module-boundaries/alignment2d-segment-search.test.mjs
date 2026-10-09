import assert from "node:assert/strict";
import test from "node:test";

import { Alignment2D } from "../../../src/aim-core/geometry/Alignment2D.js";

// The element a station belongs to is found by binary search over the
// offsets and ends. This pins the search to the linear walks it replaced:
// the boundary rules (curvature: the element that starts there; pose: the
// element that ends there), zero-length elements, clamping, and a long
// alignment at every station the walk could distinguish.

function element(id, arcLength) {
	return {
		id, arcLength,
		curvatureAt(localS) { return { id, localS }; },
		poseAt(localS, pose) { return { id, localS, from: pose }; },
		poseE(pose) { return { p: { x: pose.p.x + arcLength, y: 0 }, t: pose.t }; },
	};
}

function linearSegment(alignment, s) {
	const ss = Math.max(0, Math.min(alignment.arcLength, s));
	for (let i = alignment.elements.length - 1; i >= 0; i--) {
		if (ss >= alignment._offsets[i]) return { index: i, localS: ss - alignment._offsets[i] };
	}
	return { index: 0, localS: ss };
}

function linearPoseOwner(alignment, s) {
	const ss = Math.max(0, Math.min(alignment.arcLength, s));
	for (let i = 0; i < alignment.elements.length; i++) {
		const end = alignment._offsets[i] + alignment.elements[i].arcLength;
		if (ss <= end) return { index: i, localS: ss - alignment._offsets[i] };
	}
	return null;
}

function stationsOf(alignment) {
	const stations = [-1, 0, alignment.arcLength, alignment.arcLength + 1];
	for (const offset of alignment._offsets) stations.push(offset - 1e-9, offset, offset + 1e-9, offset + 0.5);
	return stations;
}

test("the search answers as the walks did, boundaries and zero-length elements included", () => {
	const lengths = [10, 0, 30, 0, 0, 5, 12.5, 0, 7];
	const alignment = new Alignment2D(lengths.map((length, i) => element(`E${i}`, length)));
	for (const s of stationsOf(alignment)) {
		assert.deepEqual(alignment._findSegment(s), linearSegment(alignment, s), `segment at ${s}`);
		const owner = linearPoseOwner(alignment, s);
		const pose = alignment.poseAt(s);
		assert.equal(pose.id, alignment.elements[owner.index].id, `pose owner at ${s}`);
		assert.equal(pose.localS, owner.localS, `pose local station at ${s}`);
	}
	// the published boundary rules, read off directly
	assert.equal(alignment.curvatureAt(10).id, "E2", "curvature at a boundary: the last element that starts there, past a zero-length one");
	assert.equal(alignment.poseAt(10).id, "E0", "pose at a boundary: the element that ends there");
	assert.equal(alignment.poseAt(40).id, "E2", "a run of zero-length elements ending at a station leaves the pose to the one before them");
	assert.equal(alignment.curvatureAt(40).id, "E5", "and the curvature to the first with length after them");
});

test("a long alignment is answered the same at every station, in logarithmic steps", () => {
	const lengths = Array.from({ length: 1000 }, (_, i) => 20 + (i % 7) * 13.37);
	const alignment = new Alignment2D(lengths.map((length, i) => element(`E${i}`, length)));
	for (const s of stationsOf(alignment)) {
		assert.deepEqual(alignment._findSegment(s), linearSegment(alignment, s), `segment at ${s}`);
		assert.deepEqual(linearPoseOwner(alignment, s).index, alignment.elements.indexOf(alignment.elements.find((e) => e.id === alignment.poseAt(s).id)), `pose owner at ${s}`);
	}
});

test("a single element and an empty alignment keep their answers", () => {
	const one = new Alignment2D([element("E0", 10)]);
	assert.deepEqual(one._findSegment(-3), { index: 0, localS: 0 });
	assert.deepEqual(one._findSegment(12), { index: 0, localS: 10 });
	assert.equal(one.poseAt(12).localS, 10);
	const none = new Alignment2D([]);
	assert.equal(none.curvatureAt(3), 0);
	assert.strictEqual(none.poseAt(3), none.pose0);
});
