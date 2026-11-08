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
const { recogniseTurnouts, parseHold, resolveHold, formatHold, HeldRecordsError } = await import(new URL("heldRecords.js", SERVICE));
const { parseEdits, formatEdits, resolveEdits, RecordEditsError } = await import(new URL("recordEdits.js", SERVICE));
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

test("a branch of two radii is two arcs split by the annex's tangent lengths, and is recognised in either order", async () => {
	const { TURNOUT_SHAPES, turnoutShape, compoundBranch } = await import(new URL("heldRecords.js", SERVICE));
	const compound = TURNOUT_SHAPES.filter((s) => s.radiusEnd !== null);
	assert.deepEqual(compound.map((s) => [s.designation, [...s.radii], s.branchSpeedKmh, [...s.endPieces]]), [["EW 6000/3700-1:32.5", [6000, 3700], 160, []], ["EW 7000/6000-1:42", [7000, 6000], 200, []]]);
	// the 7000/6000 meets both tangent lengths of the annex (80.1040 / 74.1620); the 6000/3700 misses the second by 0.31 m
	const w42 = turnoutShape(7000, 42, 6000);
	assert.deepEqual(w42.branchLengths.map((l) => Number(l.toFixed(3))), [80.001, 74.258]);
	assert.ok(Math.abs(w42.tangentResidual) < 2e-4, `residual ${w42.tangentResidual}`);
	assert.ok(Math.abs(turnoutShape(6000, 32.5, 3700).tangentResidual + 0.308) < 1e-3);
	const split = compoundBranch([7000, 6000], 42, 80.1040);
	assert.ok(Math.abs(split.angles[0] + split.angles[1] - Math.atan(1 / 42)) < 1e-12 && Math.abs(split.tangents[0] - 80.1040) < 1e-6);
	// a simple radius does not match a compound shape, nor the other way round
	assert.equal(turnoutShape(7000, 42), null);
	assert.equal(turnoutShape(190, 9, 300), null);
	const [l1, l2] = w42.branchLengths;
	const records = [{ number: 1, type: "straight", length: 50 }, { number: 2, type: "arc", length: l1, curvature: -1 / 7000 }, { number: 3, type: "arc", length: l2, curvature: -1 / 6000 },
		{ number: 4, type: "straight", length: 20 }, { number: 5, type: "arc", length: l2, curvature: 1 / 6000 }, { number: 6, type: "arc", length: l1, curvature: 1 / 7000 }, { number: 7, type: "arc", length: l1, curvature: 1 / 7000 }];
	assert.deepEqual(recogniseTurnouts(records).map((t) => [t.designation, t.side, t.arc, [...t.arcs], [...t.records]]), [["EW 7000/6000-1:42", "right", 2, [2, 3], [2, 3]], ["EW 7000/6000-1:42", "left", 6, [5, 6], [5, 6]]], "R1 then R2 from the toe, R2 then R1 from the end; a lone arc is none");
	// the two arcs must turn the same way
	assert.equal(recogniseTurnouts([{ number: 1, type: "arc", length: l1, curvature: -1 / 7000 }, { number: 2, type: "arc", length: l2, curvature: 1 / 6000 }]).length, 0);
});

const BOTH = { length: true, radius: true };
test("the words that hold: numbers, ranges, L or R behind them, and turnouts", () => {
	assert.deepEqual(parseHold("1,2, 13"), { turnouts: false, records: [1, 2, 13], quantities: { 1: BOTH, 2: BOTH, 13: BOTH } });
	assert.deepEqual(parseHold("Weichen 4-6"), { turnouts: true, records: [4, 5, 6], quantities: { 4: BOTH, 5: BOTH, 6: BOTH } });
	assert.deepEqual(parseHold([3, "turnouts"]), { turnouts: true, records: [3], quantities: { 3: BOTH } });
	assert.deepEqual(parseHold(""), { turnouts: false, records: [], quantities: {} });
	// one quantity: L the length, R the radius; named twice, the record is held in both
	assert.deepEqual(parseHold("7R 3-4l 7L"), { turnouts: false, records: [3, 4, 7], quantities: { 3: { length: true, radius: false }, 4: { length: true, radius: false }, 7: BOTH } });
	assert.throws(() => parseHold("alle"), (e) => e instanceof HeldRecordsError && e.code === "INVALID_HOLD");
	assert.throws(() => parseHold("5-3"), (e) => e.code === "INVALID_HOLD");
	assert.throws(() => parseHold("7X"), (e) => e.code === "INVALID_HOLD");
	const records = [{ number: 1, type: "straight", length: 10 }, { number: 2, type: "arc", length: 20, curvature: 0.01 }];
	assert.throws(() => resolveHold("3", records, []), (e) => e.code === "INVALID_HOLD");
	assert.throws(() => resolveHold("turnouts", records, []), (e) => e.code === "NO_TURNOUT");
	assert.deepEqual([...resolveHold("2", records, [])], [[2, { why: "named", ...BOTH }]]);
	assert.deepEqual([...resolveHold("2R 1", records, [])], [[1, { why: "named", ...BOTH }], [2, { why: "named", length: false, radius: true }]]);
	// a straight has no radius to hold alone
	assert.throws(() => resolveHold("1R", records, []), (e) => e.code === "INVALID_HOLD" && /no radius/.test(e.message));
	// a turnout is held whole, whatever a number beside it said
	assert.deepEqual(resolveHold("turnouts 2L", records, [{ designation: "EW 190-1:9", records: [2] }]).get(2), { why: "EW 190-1:9", ...BOTH });
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
	assert.deepEqual(report.input.heldRecords, [{ record: 1, element: "E0", why: "EW 190-1:9", ...BOTH }, { record: 2, element: "E1", why: "EW 190-1:9", ...BOTH }, { record: 9, element: "E8", why: "EW 300-1:9", ...BOTH }]);
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

test("a speed not given is an assumption with its reason: the slowest turnout's branch, else the profile", async () => {
	assert.deepEqual(recogniseTurnouts([{ number: 1, type: "arc", length: 190 * ALPHA, curvature: -1 / 190 }, { number: 2, type: "arc", length: 300 * ALPHA, curvature: -1 / 300 }, { number: 3, type: "arc", length: 500 * Math.atan(1 / 12), curvature: 1 / 500 }]).map((t) => t.branchSpeedKmh), [40, 50, 60]);
	// the track runs through an EW 190-1:9 and an EW 300-1:9: 40 km/h, whether the turnouts are held or not
	const assumed = await fit({ speedKmh: null });
	const { speed } = assumed.report.input;
	assert.equal(speed.kmh, 40);
	assert.equal(speed.basis, "turnout");
	assert.match(speed.why, /^assumed: the branch of EW 190-1:9 \(record 1\) allows 40 km\/h/);
	assert.deepEqual({ ...speed.turnout, records: [...speed.turnout.records] }, { designation: "EW 190-1:9", records: [1, 2], branchSpeedKmh: 40 });
	assert.equal(assumed.report.input.speedKmh, 40);
	assert.equal(assumed.report.cant.speedKmh, 40);
	// what the arcs admit: R 190 without cant reaches 130 mm of deficiency at 45.7 km/h
	const { cant } = assumed.report;
	assert.ok(Math.abs(cant.admissibleSpeedKmh - Math.sqrt(0.13 * 9.80665 * 190 / 1.5) * 3.6) < 0.05, `the arcs admit ${cant.admissibleSpeedKmh} km/h`);
	assert.equal(cant.limitingArc.id, "E0");
	assert.equal(cant.exceededAfter, 0, "the assumption stays below it");
	// given, the speed is the caller's, and the report says what that costs
	const given = await fit({ speedKmh: 60 });
	assert.equal(given.report.input.speed.basis, "given");
	assert.equal(given.report.input.speed.kmh, 60);
	assert.equal(given.report.input.speed.turnout, null);
	assert.ok(given.report.cant.exceededAfter > 0);
	// the geometry is the same either way here: the Hauptbahn floors do not move below 80 km/h
	assert.ok(Math.abs(given.report.fit.rms - assumed.report.fit.rms) < 1e-9);
	// no turnout in the file: the profile's own choice, and it says so
	const plain = track(TRUE_LENGTHS).slice(2, 8);
	const plainChain = chainOf(plain);
	const plainPoints = [];
	for (let st = 30; st < 300; st += 10) { const p = world(plainChain.poseAt(st)); plainPoints.push({ name: `Q${plainPoints.length + 1}`, x: p.x, y: p.y }); }
	const profile = await fitTraFromBytes({ bytes: traOf(plain), points: plainPoints, tolerance: 0.003, maxIterations: 50 });
	assert.equal(profile.report.input.speed.basis, "profile");
	assert.equal(profile.report.input.speed.kmh, profile.report.input.speedKmh);
	assert.match(profile.report.input.speed.why, /^assumed: the fastest Hauptbahn profile/);
});

test("a hold that cannot be met is refused", async () => {
	await assert.rejects(fit({ hold: "12" }), (e) => e.code === "INVALID_HOLD");
	await assert.rejects(fit({ hold: "1-9" }), (e) => e instanceof FitTraError && e.code === "NOTHING_FREE");
	const noTurnout = traOf(track(TRUE_LENGTHS).slice(2, 7));
	await assert.rejects(fitTraFromBytes({ bytes: noTurnout, points, hold: "turnouts" }), (e) => e.code === "NO_TURNOUT");
});

test("the report lists the file's records with the element that carries each, for a picture to offer them", async () => {
	// nothing held: the end piece merges into the straight behind it, the last arc into the turnout's branch
	const free = (await fit({})).report;
	assert.equal(free.planRecords.length, 9);
	assert.deepEqual(free.planRecords.map((r) => r.number), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
	assert.ok(free.planRecords.every((r) => r.element !== null && r.held === null));
	assert.deepEqual(free.planRecords.filter((r) => r.turnout).map((r) => [r.number, r.turnout]), [[1, "EW 190-1:9"], [2, "EW 190-1:9"], [9, "EW 300-1:9"]]);
	assert.deepEqual(free.elements.map((e) => [...e.records]), [[1], [2, 3], [4], [5], [6], [7], [8, 9]]);
	assert.equal(free.planRecords[0].radius, 190, "the radius carries the file's sign: a right-hand curve is positive");
	// each element's records add up to its length in the plan
	for (const e of free.elements) {
		const sum = e.records.reduce((s, n) => s + free.planRecords[n - 1].length, 0);
		assert.ok(Math.abs(sum - e.before.length) < 1e-6, `${e.id}: ${sum} against ${e.before.length}`);
	}
	// held: every record keeps its own element, and the record says why it is held
	const held = (await fit({ hold: "turnouts, 5" })).report;
	assert.deepEqual(held.elements.map((e) => [...e.records]), [[1], [2], [3], [4], [5], [6], [7], [8], [9]]);
	assert.deepEqual(held.planRecords.filter((r) => r.held).map((r) => [r.number, r.held]), [[1, "EW 190-1:9"], [2, "EW 190-1:9"], [5, "named"], [9, "EW 300-1:9"]]);
});

test("a hold is written back as a person would type it", () => {
	assert.equal(formatHold([13, 1, 2]), "1-2, 13");
	assert.equal(formatHold(new Set([3, 4, 5, 7, 9, 10])), "3-5, 7, 9-10");
	assert.equal(formatHold([2, 2, 0, -1, 1.5]), "2", "only record numbers, each once");
	assert.equal(formatHold([]), "");
	assert.deepEqual([...parseHold(formatHold([13, 1, 2, 7])).records], [1, 2, 7, 13]);
	// one quantity: the letter behind the number, a run only of equals
	const held = new Map([[1, BOTH], [2, BOTH], [4, { length: false, radius: true }], [5, { length: false, radius: true }], [6, { length: true, radius: false }], [7, { length: false, radius: false }]]);
	assert.equal(formatHold(held), "1-2, 4-5R, 6L");
	assert.equal(formatHold([{ record: 3, length: true, radius: false }, { number: 9, length: true, radius: true }, 10]), "3L, 9-10");
	assert.deepEqual(parseHold(formatHold(held)).quantities, { 1: BOTH, 2: BOTH, 4: { length: false, radius: true }, 5: { length: false, radius: true }, 6: { length: true, radius: false } });
});

test("a record held in one quantity keeps that one and leaves the other to the fit", async () => {
	// record 6 is the arc R 500 that the start has 50,5 m long where the truth is 50 m
	const radius = (await fit({ hold: "6R" })).report;
	assert.ok(radius.verdict.ok, `${radius.verdict.status} ${radius.verdict.reason ?? ""}`);
	assert.deepEqual(radius.input.heldRecords, [{ record: 6, element: "E4", why: "named", length: false, radius: true }]);
	const arc = radius.elements.find((e) => e.records.includes(6));
	assert.equal(arc.after.radius, arc.before.radius, "the radius stays");
	assert.ok(Math.abs(arc.after.length - 50) < 0.05, `the length is fitted: ${arc.after.length}`);
	assert.deepEqual(radius.planRecords.filter((r) => r.heldLength || r.heldRadius).map((r) => [r.number, r.held, r.heldLength, r.heldRadius]), [[6, "named", false, true]]);
	// the length alone: it stays at the start's 50,5 m and the radius gives
	const length = (await fit({ hold: "6L" })).report;
	assert.ok(length.verdict.ok, `${length.verdict.status} ${length.verdict.reason ?? ""}`);
	const held = length.elements.find((e) => e.records.includes(6));
	assert.equal(held.after.length, held.before.length, "the length stays");
	assert.ok(Math.abs(held.after.radius - held.before.radius) > 1, `the radius is fitted: ${held.after.radius}`);
	assert.equal(length.input.free, radius.input.free, "one quantity held either way");
	// a straight's radius cannot be held alone; a whole straight is its length
	await assert.rejects(fit({ hold: "3R" }), (e) => e.code === "INVALID_HOLD");
	const straight = (await fit({ hold: "3" })).report;
	assert.deepEqual(straight.planRecords.filter((r) => r.heldLength).map((r) => [r.number, r.heldLength, r.heldRadius]), [[3, true, false]]);
});

test("an edit is read as a person types it, and written back the same way", () => {
	assert.deepEqual([...parseEdits("7L=45,2 7R=-1250, 9L=10.5")], [[7, { length: 45.2, radius: -1250 }], [9, { length: 10.5 }]]);
	assert.deepEqual([...parseEdits([{ record: 3, length: 20 }, { number: 3, radius: 300 }])], [[3, { length: 20, radius: 300 }]]);
	assert.deepEqual([...parseEdits(new Map([["4", { radius: -480 }]]))], [[4, { radius: -480 }]]);
	assert.deepEqual([...parseEdits("")], []);
	// a transition's type, by any of its words
	assert.deepEqual([...parseEdits("9T=Bloss 9L=60, 4T=klothoide 5T=S-Form")], [[9, { family: "bloss", length: 60 }], [4, { family: "clothoid" }], [5, { family: "helmert" }]]);
	assert.equal(formatEdits("5T=helmert 9L=60 9T=bloss"), "5T=S-Form 9L=60 9T=Bloss");
	assert.throws(() => parseEdits("9T=Wiener"), (e) => e.code === "INVALID_EDIT" && /Klothoide, Bloss, S-Form/.test(e.message));
	assert.equal(formatEdits("9L=10.5 7R=-1250 7L=45,200"), "7L=45,2 7R=-1250 9L=10,5");
	assert.equal(formatEdits([]), "");
	for (const bad of ["7=45", "7X=1", "7L=abc", "L=4", "7L"]) assert.throws(() => parseEdits(bad), (e) => e instanceof RecordEditsError && e.code === "INVALID_EDIT", bad);
	const records = [{ number: 1, type: "straight", length: 10 }, { number: 2, type: "arc", length: 20, curvature: 0.01 }, { number: 3, type: "kink", length: 0 }];
	assert.deepEqual([...resolveEdits("2R=-150 1L=12", records)], [[2, { radius: -150 }], [1, { length: 12 }]]);
	for (const bad of ["1R=100", "2R=0", "2L=0", "2L=-3", "3L=5", "4L=5", "2T=Bloss"]) assert.throws(() => resolveEdits(bad, records), (e) => e.code === "INVALID_EDIT", bad);
});

test("an edited value is where the fit starts; the file is unchanged and the record keeps its element", async () => {
	// record 4 is the arc R 300 that the start has 39,5 m long: started at the truth's 40 m
	const edited = (await fit({ edits: "4L=40" })).report;
	assert.ok(edited.verdict.ok, `${edited.verdict.status} ${edited.verdict.reason ?? ""}`);
	assert.deepEqual(edited.input.edits, [{ record: 4, element: "E2", length: 40, radius: null, family: null }]);
	const arc = edited.elements.find((e) => e.records.includes(4));
	assert.equal(arc.before.length, 40, "the fit starts from the edited length");
	assert.equal(arc.fixed, true, "an edited record is one element");
	assert.deepEqual(edited.elements.map((e) => [...e.records]), [[1], [2, 3], [4], [5], [6], [7], [8, 9]]);
	const r4 = edited.planRecords[3];
	assert.deepEqual([r4.length, r4.fileLength, r4.radius, r4.fileRadius, r4.edited, r4.held, r4.heldLength], [40, 39.5, 300, 300, { length: true, radius: false, family: false }, null, false]);
	assert.ok(edited.planRecords.filter((r) => r.number !== 4).every((r) => r.edited === null && r.length === r.fileLength));
	// an edit holds nothing: the fit may move the value again; with the hold it keeps it
	const held = (await fit({ edits: "4L=40", hold: "4L" })).report;
	assert.equal(held.elements.find((e) => e.records.includes(4)).after.length, 40);
	assert.deepEqual(held.planRecords[3].heldLength, true);
	// the radius, with the file's sign: record 6 is the left-hand arc the file writes as R −500
	const radius = (await fit({ edits: "6R=-480" })).report;
	assert.equal(radius.planRecords[5].fileRadius, -500);
	assert.equal(radius.elements.find((e) => e.records.includes(6)).before.radius, -480);
	assert.ok(radius.verdict.ok);
	// refused: a straight's radius, a zero length, a record the file does not have
	for (const bad of ["3R=100", "4L=0", "12L=5"]) await assert.rejects(fit({ edits: bad }), (e) => e.code === "INVALID_EDIT", bad);
});
