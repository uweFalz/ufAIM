import assert from "node:assert/strict";
import test from "node:test";

// Held records: a station track between two turnouts. The turnouts are
// catalogue geometry and stay as the file has them; the radii between
// them may be held as designed, so that only the lengths are fitted. The
// scenario is invented - a real one (Bf-Gleis-10, 2026-11-06) is customer
// data and is measured in docs/app/architecture/AXTRAN2_DEMO_ADAPTER.

const SERVICE = new URL("../../src/services/axtran2/", import.meta.url);
const KERNEL = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const { fitTraFromBytes, FitTraError } = await import(new URL("fitTraCore.js", SERVICE));
const { recogniseTurnouts, parseHold, resolveHold, HeldRecordsError } = await import(new URL("heldRecords.js", SERVICE));
const { writeTra } = await import(new URL("traWriter.js", SERVICE));
const { traAlignmentFromBytes } = await import(new URL("../../src/import/parsers/technet/vermEsn/traAlignment.js", import.meta.url));
const { createAlignmentPoseJacobian } = await import(new URL("AlignmentPoseJacobian.js", KERNEL));
const { momentsFor } = await import(new URL("SolverDependencies.js", KERNEL));

const ALPHA = Math.atan(1 / 9);
const ORIGIN = { x: 3476000, y: 5474000 };
const startPose = { x: 0, y: 0, theta: -0.4 };
// a right-hand curve has negative curvature in the kernel's frame
const track = (lengths) => [
	{ id: "E0", type: "arc", length: 190 * ALPHA, curvature: -1 / 190 },      // EW 190-1:9, the branch
	{ id: "E1", type: "straight", length: 6.0917 },                           // its straight end piece
	{ id: "E2", type: "straight", length: lengths[0] },
	{ id: "E3", type: "arc", length: lengths[1], curvature: -1 / 300 },
	{ id: "E4", type: "straight", length: lengths[2] },
	{ id: "E5", type: "arc", length: lengths[3], curvature: 1 / 500 },
	{ id: "E6", type: "straight", length: lengths[4] },
	{ id: "E7", type: "arc", length: lengths[5], curvature: -1 / 300 },
	{ id: "E8", type: "arc", length: 300 * ALPHA, curvature: -1 / 300 },      // EW 300-1:9, a full branch
];
const TRUE_LENGTHS = [60, 40, 30, 50, 120, 30];
const world = (p) => ({ x: p.x + ORIGIN.x, y: p.y + ORIGIN.y, theta: p.theta });
const chainOf = (elements) => createAlignmentPoseJacobian({ elements, startPose, momentsFor });
const traOf = (elements) => {
	const chain = chainOf(elements);
	return writeTra({ elements, poseOfElement: (i) => world(chain.entryPose(i)), poseAtStation: (s) => world(chain.poseAt(s)), endPose: world(chain.endPose) }).bytes;
};

const truth = track(TRUE_LENGTHS);
const truthChain = chainOf(truth);
const total = truth.reduce((s, e) => s + e.length, 0);
const points = [];
for (let s = 30; s < total - 20; s += 10) {
	const p = world(truthChain.poseAt(s));
	points.push({ name: `P${points.length + 1}`, x: p.x, y: p.y });
}
const truthBytes = traOf(truth);
// the start: the same radii, the free lengths off by decimetres
const startBytes = traOf(track([60.6, 39.5, 30.4, 50.5, 119.6, 30.3]));
const fit = (input) => fitTraFromBytes({ bytes: startBytes, name: "station-track.TRA", points, tolerance: 0.003, speedKmh: 40, endPose: world(truthChain.endPose), maxIterations: 300, ...input });

test("a catalogue turnout is recognised by its radius and its branch length, with its end piece", () => {
	const arc = (number, radius, length, sign = -1) => ({ number, type: "arc", length, curvature: sign / radius });
	const straight = (number, length) => ({ number, type: "straight", length });
	const seen = recogniseTurnouts([arc(1, 190, 190 * ALPHA), straight(2, 6.09235), straight(3, 61.9), arc(4, 300, 37.4), arc(5, 300, 300 * ALPHA, 1)]);
	assert.deepEqual(seen.map((t) => [t.designation, t.side, t.arc, t.endPiece, [...t.records]]), [["EW 190-1:9", "right", 1, 2, [1, 2]], ["EW 300-1:9", "left", 5, null, [5]]]);
	// the end piece before the arc, for a track that runs from the Weichenende to the Weichenanfang
	assert.deepEqual([...recogniseTurnouts([straight(1, 6.0917), arc(2, 190, 190 * ALPHA)])[0].records], [1, 2]);
	// 5 mm off is a designed arc, not a turnout; so is the right length on another radius
	assert.equal(recogniseTurnouts([arc(1, 190, 190 * ALPHA + 0.005)]).length, 0);
	assert.equal(recogniseTurnouts([arc(1, 250, 250 * ALPHA)]).length, 0);
	assert.equal(recogniseTurnouts([arc(1, 500, 500 * Math.atan(1 / 12))])[0].designation, "EW 500-1:12");
});

test("the words that hold: numbers, ranges and turnouts", () => {
	assert.deepEqual(parseHold("1,2, 13"), { turnouts: false, records: [1, 2, 13] });
	assert.deepEqual(parseHold("Weichen 4-6"), { turnouts: true, records: [4, 5, 6] });
	assert.deepEqual(parseHold([3, "turnouts"]), { turnouts: true, records: [3] });
	assert.deepEqual(parseHold(""), { turnouts: false, records: [] });
	assert.throws(() => parseHold("alle"), (e) => e instanceof HeldRecordsError && e.code === "INVALID_HOLD");
	assert.throws(() => parseHold("5-3"), (e) => e.code === "INVALID_HOLD");
	const records = [{ number: 1, type: "straight", length: 10 }, { number: 2, type: "arc", length: 20, curvature: 0.01 }];
	assert.throws(() => resolveHold("3", records, []), (e) => e.code === "INVALID_HOLD");
	assert.throws(() => resolveHold("turnouts", records, []), (e) => e.code === "NO_TURNOUT");
	assert.deepEqual([...resolveHold("2", records, [])], [[2, "named"]]);
});

test("the reader keeps a fixed record apart from its neighbour and says which element carries it", async () => {
	const merged = await traAlignmentFromBytes(truthBytes, "t.TRA");
	assert.equal(merged.recordCount, 9);
	assert.equal(merged.elements.length, 7, "two straights and two arcs of one radius are one element each");
	assert.equal(merged.mergedRecords, 2);
	assert.deepEqual([...merged.recordElements], ["E0", "E1", "E1", "E2", "E3", "E4", "E5", "E6", "E6"]);
	assert.deepEqual(merged.records.map((r) => r.type), ["arc", "straight", "straight", "arc", "straight", "arc", "straight", "arc", "arc"]);
	const kept = await traAlignmentFromBytes(truthBytes, "t.TRA", { fixedRecords: [1, 2, 9] });
	assert.equal(kept.elements.length, 9);
	assert.equal(kept.mergedRecords, 0);
	assert.deepEqual(kept.elements.map((e) => Boolean(e.fixed)), [true, true, false, false, false, false, false, false, true]);
	assert.deepEqual([...kept.recordElements], ["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"]);
});

test("without a word the turnouts are seen and not held; the fit bends them", async () => {
	const free = await fit({});
	const { input } = free.report;
	assert.deepEqual(input.turnouts.map((t) => [t.designation, [...t.records], t.held]), [["EW 190-1:9", [1, 2], false], ["EW 300-1:9", [9], false]]);
	assert.deepEqual(input.heldRecords, []);
	assert.equal(input.holdRadii, false);
	assert.equal(free.report.elements.length, 7);
	assert.equal(free.report.output.records, 7, "the turnouts' boundaries are gone from the written file");
});

test("held turnouts keep their length and radius, their records and their place in the file", async () => {
	const held = await fit({ hold: "turnouts" });
	const { report } = held;
	assert.ok(report.verdict.ok, `${report.verdict.status} ${report.verdict.reason ?? ""}`);
	assert.deepEqual(report.input.heldRecords, [{ record: 1, element: "E0", why: "EW 190-1:9" }, { record: 2, element: "E1", why: "EW 190-1:9" }, { record: 9, element: "E8", why: "EW 300-1:9" }]);
	assert.ok(report.input.turnouts.every((t) => t.held));
	assert.equal(report.elements.length, 9);
	for (const e of report.elements.filter((e) => e.fixed)) {
		assert.equal(e.after.length, e.before.length, `${e.id} keeps its length`);
		assert.equal(e.after.radius, e.before.radius, `${e.id} keeps its radius`);
	}
	assert.deepEqual(report.elements.filter((e) => e.fixed).map((e) => e.id), ["E0", "E1", "E8"]);
	assert.equal(report.output.records, 9);
	// the written file still shows both turnouts
	const back = await traAlignmentFromBytes(held.tra, "back.TRA");
	assert.deepEqual(recogniseTurnouts(back.records).map((t) => [t.designation, [...t.records]]), [["EW 190-1:9", [1, 2]], ["EW 300-1:9", [9]]]);
	// naming the records says the same
	const named = await fit({ hold: [1, 2, 9] });
	assert.deepEqual(named.report.input.heldRecords.map((h) => [h.record, h.why]), [[1, "named"], [2, "named"], [9, "named"]]);
	assert.ok(Math.abs(named.report.fit.rms - report.fit.rms) < 1e-9);
});

test("held radii leave the lengths to the fit, and with the turnouts held it finds the design again", async () => {
	const result = await fit({ hold: "turnouts", holdRadii: true });
	const { report } = result;
	assert.ok(report.verdict.ok, `${report.verdict.status} ${report.verdict.reason ?? ""}`);
	assert.equal(report.input.holdRadii, true);
	for (const e of report.elements.filter((e) => e.type === "arc")) assert.equal(e.after.radius, e.before.radius, `${e.id} keeps its radius`);
	const free = report.elements.filter((e) => !e.fixed);
	assert.ok(free.some((e) => Math.abs(e.after.length - e.before.length) > 0.1), "the lengths moved");
	free.forEach((e, i) => assert.ok(Math.abs(e.after.length - TRUE_LENGTHS[i]) < 2e-3, `${e.id}: ${e.after.length} against ${TRUE_LENGTHS[i]}`));
	const worst = Math.max(...report.points.filter((p) => p.offset !== null).map((p) => Math.abs(p.offset)));
	assert.ok(worst < 1e-3, `the worst point lies ${worst} m off`);
	// radii alone, the turnouts not named: the first arc's radius is held with the rest
	const radii = await fit({ holdRadii: true });
	for (const e of radii.report.elements.filter((e) => e.type === "arc")) assert.equal(e.after.radius, e.before.radius);
	assert.deepEqual(radii.report.input.heldRecords, []);
});

test("a hold that cannot be met is refused", async () => {
	await assert.rejects(fit({ hold: "12" }), (e) => e.code === "INVALID_HOLD");
	await assert.rejects(fit({ hold: "1-9" }), (e) => e instanceof FitTraError && e.code === "NOTHING_FREE");
	const noTurnout = traOf(track(TRUE_LENGTHS).slice(2, 7));
	await assert.rejects(fitTraFromBytes({ bytes: noTurnout, points, hold: "turnouts" }), (e) => e.code === "NO_TURNOUT");
});
