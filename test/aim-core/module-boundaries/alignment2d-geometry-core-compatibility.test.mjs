import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/geometry/Alignment2D.js";
import * as geometry from "../../../src/aim-core/geometry/index.js";
import * as legacy from "../../../src/domain/alignment/Alignment2D.js";
import * as root from "../../../src/aim-core/index.js";

function makeElement({ id, arcLength, curvature = 0, calls = [] }) {
	return {
		id,
		arcLength,
		curvatureAt(localS) {
			calls.push(["curvatureAt", id, localS]);
			return curvature + localS;
		},
		poseAt(localS, pose, opts) {
			calls.push(["poseAt", id, localS, opts]);
			return {
				p: {
					x: pose.p.x + pose.t.x * localS,
					y: pose.p.y + pose.t.y * localS,
				},
				t: pose.t,
			};
		},
		poseE(pose, opts) {
			calls.push(["poseE", id, opts]);
			return this.poseAt(arcLength, pose, opts);
		},
		reverse() {
			calls.push(["reverse", id]);
			return makeElement({
				id: `${id}-reverse`,
				arcLength,
				curvature: -curvature,
				calls,
			});
		},
		parallel(offset) {
			calls.push(["parallel", id, offset]);
			return makeElement({
				id: `${id}-parallel-${offset}`,
				arcLength,
				curvature,
				calls,
			});
		},
	};
}

function makeFixture(api = canonical) {
	const calls = [];
	const elements = [
		makeElement({ id: "A", arcLength: 10, curvature: 1, calls }),
		makeElement({ id: "B", arcLength: 5, curvature: 20, calls }),
	];
	const pose0 = { p: { x: 3, y: 4 }, t: { x: 2, y: 0 } };
	return {
		calls,
		elements,
		pose0,
		alignment: new api.Alignment2D(elements, pose0),
	};
}

test("legacy canonical Geometry and Root share one Alignment2D authority", () => {
	assert.deepEqual(Object.keys(legacy), ["Alignment2D"]);
	assert.deepEqual(Object.keys(canonical), ["Alignment2D"]);
	assert.strictEqual(legacy.Alignment2D, canonical.Alignment2D);
	assert.strictEqual(geometry.Alignment2D, canonical.Alignment2D);
	assert.strictEqual(root.Alignment2D, canonical.Alignment2D);
});

test("constructor preserves element alias pose copy normalization and index order", () => {
	const { alignment, elements, pose0 } = makeFixture();
	assert.strictEqual(alignment.elements, elements);
	assert.notStrictEqual(alignment.pose0.p, pose0.p);
	assert.deepEqual(alignment.pose0, {
		p: { x: 3, y: 4 },
		t: { x: 1, y: 0 },
	});
	assert.equal(alignment.arcLength, 15);
	assert.deepEqual(alignment._offsets, [0, 10]);
	elements.push(makeElement({ id: "C", arcLength: 2 }));
	assert.equal(alignment.elements.length, 3);
	assert.equal(alignment.arcLength, 15);
});

test("curvature dispatch clamps and assigns shared boundary backward", () => {
	const { alignment, calls } = makeFixture();
	assert.equal(alignment.curvatureAt(-4), 1);
	assert.equal(alignment.curvatureAt(9), 10);
	assert.equal(alignment.curvatureAt(10), 20);
	assert.equal(alignment.curvatureAt(40), 25);
	assert.deepEqual(
		calls.filter(([name]) => name === "curvatureAt"),
		[
			["curvatureAt", "A", 0],
			["curvatureAt", "A", 9],
			["curvatureAt", "B", 0],
			["curvatureAt", "B", 5],
		]
	);
});

test("pose point and tangent preserve forward boundary ownership and opts", () => {
	const { alignment, calls } = makeFixture();
	const opts = { quality: "exact", marker: {} };
	assert.deepEqual(alignment.poseAt(10, opts), {
		p: { x: 13, y: 4 },
		t: { x: 1, y: 0 },
	});
	assert.deepEqual(alignment.pointAt(12, opts), { x: 15, y: 4 });
	assert.deepEqual(alignment.tangentAt(12, opts), { x: 1, y: 0 });
	assert.equal(
		calls.some(
			(call) => call[0] === "poseAt" && call[1] === "A" && call[2] === 10
		),
		true
	);
	for (const call of calls.filter(([name]) => name === "poseAt" || name === "poseE")) {
		assert.strictEqual(call.at(-1), opts);
	}
});

test("empty alignment preserves exact curvature pose and world2Track results", () => {
	const pose0 = { p: { x: 2, y: 5 }, t: { x: 0, y: 3 } };
	const alignment = new canonical.Alignment2D([], pose0);
	assert.equal(alignment.arcLength, 0);
	assert.equal(alignment.curvatureAt(8), 0);
	assert.strictEqual(alignment.poseAt(8), alignment.pose0);
	assert.strictEqual(alignment.pointAt(8), alignment.pose0.p);
	assert.strictEqual(alignment.tangentAt(8), alignment.pose0.t);
	assert.equal(alignment.world2Track(2, 5), null);
});

test("reverse preserves order calls end pose and tangent negation", () => {
	const { alignment, calls } = makeFixture();
	const reversed = alignment.reverse();
	assert.ok(reversed instanceof canonical.Alignment2D);
	assert.deepEqual(
		reversed.elements.map(({ id }) => id),
		["B-reverse", "A-reverse"]
	);
	assert.deepEqual(reversed.pose0, {
		p: { x: 18, y: 4 },
		t: { x: -1, y: -0 },
	});
	assert.deepEqual(
		calls.filter(([name]) => name === "reverse"),
		[
			["reverse", "B"],
			["reverse", "A"],
		]
	);
});

test("parallel preserves mapping order offset and normalized starting pose", () => {
	const { alignment, calls } = makeFixture();
	const shifted = alignment.parallel(-2.5);
	assert.ok(shifted instanceof canonical.Alignment2D);
	assert.deepEqual(
		shifted.elements.map(({ id }) => id),
		["A-parallel--2.5", "B-parallel--2.5"]
	);
	assert.deepEqual(shifted.pose0, alignment.pose0);
	assert.notStrictEqual(shifted.pose0.p, alignment.pose0.p);
	assert.deepEqual(
		calls.filter(([name]) => name === "parallel"),
		[
			["parallel", "A", -2.5],
			["parallel", "B", -2.5],
		]
	);
});

test("world2Track preserves sampling refinement correction and result order", () => {
	const calls = [];
	const alignment = new canonical.Alignment2D([
		makeElement({ id: "straight", arcLength: 10, calls }),
	]);
	const result = alignment.world2Track(4, 3, {
		samples: 8,
		refineSteps: 4,
	});
	// u and clamped joined this list by decision, not by accident: without them
	// nothing in the result says whether the foot station was pinned to an end,
	// and a caller who does not know to ask is the one who reads q as a distance
	// from the track when it is a distance from a line the track does not occupy.
	assert.deepEqual(Object.keys(result), [
		"s",
		"q",
		"dist",
		"point",
		"tangent",
		"elementIndex",
		"u",
		"clamped",
	]);
	assert.equal(result.s, 4);
	assert.equal(result.q, 3);
	assert.equal(result.dist, 3);
	assert.deepEqual(result.point, { x: 4, y: 0 });
	assert.deepEqual(result.tangent, { x: 1, y: 0 });
	assert.equal(result.elementIndex, 0);
	for (const call of calls.filter(([name]) => name === "poseAt")) {
		assert.deepEqual(call[3], { quality: "balanced" });
	}
});

test("the foot report needs no asking for", () => {
	// It was an opt-in when it was added. Nobody has to remember it now, which is
	// the whole point of the change: the caller who does not know to ask is the
	// one who most needs the answer.
	const alignment = new canonical.Alignment2D([
		makeElement({ id: "straight", arcLength: 10 }),
	]);
	const plain = alignment.world2Track(4, 3);
	// (4, 3) sits beside the middle of a ten-metre straight: a real foot point
	assert.equal(plain.u, 0);
	assert.equal(plain.clamped, false);
});

test("world2Track says when it clamped the foot point to an end", () => {
	// A point past an end does not fail; it comes back with the offset from the
	// extended tangent. u is the distance past the end, exactly, and it is the
	// pair (clamped, u) that answers the question: at a point sitting exactly on
	// an end the station is clamped and u is zero, and that is a real foot point.
	const alignment = new canonical.Alignment2D([
		makeElement({ id: "straight", arcLength: 10 }),
	]);

	const beyond = alignment.world2Track(17, 3);
	assert.equal(beyond.s, 10, "the station was pinned to the end");
	assert.equal(beyond.q, 3, "and the offset is measured from the extended tangent");
	assert.equal(beyond.clamped, true);
	assert.equal(beyond.u, 7, "seven metres past the end");

	const atTheEnd = alignment.world2Track(10, 3);
	assert.equal(atTheEnd.clamped, true, "the station is on an end");
	assert.equal(atTheEnd.u, 0, "but the point is not past it: a genuine foot point");
});

test("world2Track retains invalid options coercion and tie behavior", () => {
	const alignment = new canonical.Alignment2D([
		makeElement({ id: "straight", arcLength: 10 }),
	]);
	assert.equal(alignment.world2Track(NaN, 0), null);
	assert.equal(alignment.world2Track(0, Infinity), null);
	const result = alignment.world2Track("5", "2", {
		samples: 0,
		refineSteps: -20,
	});
	assert.equal(result.s, 5);
	assert.equal(result.q, 2);
	assert.equal(result.dist, 2);
	assert.equal(result.elementIndex, 0);
});

test("old and canonical classes produce deeply identical independent results", () => {
	const oldFixture = makeFixture(legacy);
	const newFixture = makeFixture(canonical);
	for (const operation of [
		(alignment) => alignment.curvatureAt(10),
		(alignment) => alignment.poseAt(12, { quality: "balanced" }),
		(alignment) => alignment.pointAt(15),
		(alignment) => alignment.tangentAt(0),
		(alignment) => alignment.world2Track(6, -2),
		(alignment) => alignment.parallel(3).poseAt(4),
		(alignment) => alignment.reverse().poseAt(2),
	]) {
		assert.deepEqual(operation(oldFixture.alignment), operation(newFixture.alignment));
	}
});

test("constructor and method native errors and input mutation remain shared", () => {
	assert.throws(() => new legacy.Alignment2D(null));
	assert.throws(() => new canonical.Alignment2D(null));
	assert.throws(() => new legacy.Alignment2D([], null));
	assert.throws(() => new canonical.Alignment2D([], null));
	const pose0 = { p: { x: 1, y: 2 }, t: { x: 3, y: 4 } };
	const before = structuredClone(pose0);
	const oldAlignment = new legacy.Alignment2D([], pose0);
	const canonicalAlignment = new canonical.Alignment2D([], pose0);
	assert.deepEqual(pose0, before);
	assert.deepEqual(oldAlignment.pose0, canonicalAlignment.pose0);
});
