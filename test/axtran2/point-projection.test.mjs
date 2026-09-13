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
