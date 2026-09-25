import assert from "node:assert/strict";
import test from "node:test";

const { createFootMemory } = await import(new URL("../../src/domain/optimization/alignment/AlignmentPointProjection.js", import.meta.url));
const { build, TRUE_LENGTHS, TRUE_CURVATURES } = await import(new URL("fixtures/nineElementScenario.mjs", import.meta.url));

const scan = (alignment, x, y) => alignment.world2Track(x, y, { samples: 400, refineSteps: 40 });

test("a remembered foot is found again by Newton while the geometry moves a little", () => {
	const feet = createFootMemory();
	const before = build(TRUE_LENGTHS, TRUE_CURVATURES);
	const pose = before.poseAt(0.6 * before.arcLength);
	const point = { x: pose.p.x - 0.05 * pose.t.y, y: pose.p.y + 0.05 * pose.t.x };
	const first = feet.project(before, point.x, point.y);
	assert.ok(Math.abs(first.s - 0.6 * before.arcLength) < 1e-6, `foot at ${first.s}`);
	assert.equal(feet.scans, 1, "the first time is a scan");
	// the second element a metre longer: every station downstream shifts a metre
	const after = build(TRUE_LENGTHS.map((l, i) => (i === 1 ? l + 1 : l)), TRUE_CURVATURES);
	const remembered = feet.project(after, point.x, point.y);
	const scanned = scan(after, point.x, point.y);
	assert.ok(Math.abs(remembered.s - scanned.s) < 1e-6 && Math.abs(remembered.q - scanned.q) < 1e-9, `memory ${remembered.s}/${remembered.q}, scan ${scanned.s}/${scanned.q}`);
	assert.equal(feet.scans, 1, "a metre's move is Newton's, not a scan");
});

test("a memory made on a wreck is not trusted: a station that moved far means a full scan", () => {
	// The first attempt of a solve may leave the geometry hundreds of metres
	// from where it started; the next evaluation, at the start again, reads
	// every foot through that memory. Newton on a 200 m window then finds a
	// local foot that is not the nearest, and the residuals lie. Measured on
	// 2631R139: a thousand iterations for a retry where a fresh solve took 63,
	// and the first attempt itself collapsing on feet gone stale within its
	// own box-sized steps. A foot is remembered with the place the alignment
	// had at its station; moved by more than staleDistance, it is forgotten.
	const feet = createFootMemory({ staleDistance: 50 });
	// the same lengths bending the other way: every station keeps its number
	// and the alignment downstream of the first arc lies hundreds of metres
	// from where it was
	const wreck = build(TRUE_LENGTHS, TRUE_CURVATURES.map((k) => -k));
	const truth = build(TRUE_LENGTHS, TRUE_CURVATURES);
	const pose = truth.poseAt(0.7 * truth.arcLength);
	const point = { x: pose.p.x + 0.03 * pose.t.y, y: pose.p.y - 0.03 * pose.t.x };
	// the memory is made on the wreck
	const onWreck = feet.project(wreck, point.x, point.y);
	assert.ok(onWreck, "the wreck has a foot for the point");
	assert.equal(feet.scans, 1);
	// and asked on the truth, where that station lies elsewhere: a scan, not
	// Newton from the wreck's station
	const remembered = feet.project(truth, point.x, point.y);
	const scanned = scan(truth, point.x, point.y);
	assert.equal(feet.scans, 2, "the stale foot was trusted");
	assert.ok(Math.abs(remembered.s - scanned.s) < 1e-6, `memory ${remembered.s}, scan ${scanned.s}`);
	assert.ok(Math.abs(remembered.q) < 0.031, `lateral ${remembered.q} where the point sits 3 cm off`);
});

test("a foot on a wreck is not remembered", () => {
	// A foot farther from its point than the stale distance is a foot on a
	// wreck. Remembered, it seeds Newton on the way back to sense, and Newton
	// stays on its branch: a stationary point of the distance at every step,
	// never the nearest. Forgotten, the next evaluation scans.
	const feet = createFootMemory();
	const truth = build(TRUE_LENGTHS, TRUE_CURVATURES);
	const pose = truth.poseAt(0.8 * truth.arcLength);
	const point = { x: pose.p.x + 0.03 * pose.t.y, y: pose.p.y - 0.03 * pose.t.x };
	feet.project(truth, point.x, point.y);
	assert.equal(feet.size, 1);
	// a wreck: the first straight run out to four kilometres, so the point of
	// the truth's last stretch lies far from anything the wreck has
	const wreck = build(TRUE_LENGTHS.map((l, i) => (i === 0 ? 4000 : l)), TRUE_CURVATURES.map((k) => -k));
	const onWreck = feet.project(wreck, point.x, point.y);
	assert.ok(onWreck.dist > 200, `the wreck's foot is ${onWreck.dist} m from the point`);
	assert.equal(feet.size, 0, "a foot on a wreck is not remembered");
	const scansBefore = feet.scans;
	const back = feet.project(truth, point.x, point.y);
	assert.equal(feet.scans, scansBefore + 1, "the next evaluation scans");
	assert.ok(Math.abs(back.s - 0.8 * truth.arcLength) < 1e-6 && Math.abs(back.q) < 0.031, `back on the truth: s ${back.s}, q ${back.q}`);
	assert.equal(feet.size, 1);
});


test("a point in the wedge outside a kink measures its distance to the vertex, signed by side", async () => {
	// A straight, a kink of 0.3 rad to the left, a straight. A point beyond
	// the vertex in the wedge between the two normals has no perpendicular on
	// either line; its residual is its distance to the vertex, positive on the
	// left, and the foot says so with the direction the derivative runs along.
	// A point beside one of the lines keeps its ordinary foot.
	const { buildProductionAlignment } = await import(new URL("corpus/loadTraAlignment.mjs", import.meta.url));
	const { deps } = await import(new URL("corpus/createTraScenario.mjs", import.meta.url));
	const elements = [
		{ id: "E0", type: "straight", length: 100 },
		{ id: "E1", type: "kink", length: 0, deltaDir: 0.3, held: true },
		{ id: "E2", type: "straight", length: 100 },
	];
	const alignment = buildProductionAlignment({ elements, startPose: { x: 0, y: 0, theta: 0 }, deps });
	const feet = createFootMemory();
	// the vertex is (100, 0); the wedge on the outer (right) side runs between
	// the normal of the first line (pointing to -y) and that of the second
	// (rotated by 0.3): a point at (100.1, -2) lies inside it
	const wedge = feet.project(alignment, 100.1, -2);
	assert.equal(wedge.vertex, true, `foot ${JSON.stringify(wedge)}`);
	assert.ok(Math.abs(wedge.s - 100) < 1e-9);
	const distance = Math.hypot(0.1, 2);
	assert.ok(Math.abs(wedge.q + distance) < 1e-9, `q ${wedge.q} against -${distance}`);
	assert.ok(Math.abs(wedge.direction.x - (-0.1 / distance)) < 1e-9 && Math.abs(wedge.direction.y - 2 / distance) < 1e-9, `direction ${JSON.stringify(wedge.direction)}`);
	// remembered and asked again, the same answer
	const again = feet.project(alignment, 100.1, -2);
	assert.ok(again.vertex && Math.abs(again.q - wedge.q) < 1e-12);
	// beside the first line: the ordinary foot, no vertex
	const beside = feet.project(alignment, 50, -0.03);
	assert.ok(!beside.vertex && Math.abs(beside.s - 50) < 1e-6 && Math.abs(beside.q + 0.03) < 1e-9, JSON.stringify(beside));
	// on the inner side near the vertex both lines have a foot, and the
	// nearer one is taken
	const inner = feet.project(alignment, 100.5, 0.5);
	assert.ok(!inner.vertex, JSON.stringify(inner));
});
