// test/axtran2/gradient-fit.test.mjs
//
// The gradient adjusted to measured heights: the GRA as it is read, the
// profile its grade breaks make, the least squares on their heights, and
// the file that goes back out.

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

await import("./corpus/loadTraAlignment.mjs");
const SERVICE = new URL("../../src/services/axtran2/", import.meta.url);
const KERNEL = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const { readGra, stationAt, shapeOf, heightAt, fitGradient, writeGraHeights, parseBreakHold, GradientProfileError, GRA_RECORD_BYTES } = await import(new URL("gradientProfile.js", SERVICE));
const { fitGraFromBytes, distanceOfStation, FitGraError } = await import(new URL("fitGraCore.js", SERVICE));
const { parsePointList } = await import(new URL("pointLists.js", SERVICE));
const { writeTra } = await import(new URL("traWriter.js", SERVICE));
const { traAlignmentFromBytes } = await import(new URL("../../src/import/parsers/technet/vermEsn/traAlignment.js", import.meta.url));
const { createAlignmentPoseJacobian } = await import(new URL("AlignmentPoseJacobian.js", KERNEL));
const { momentsFor } = await import(new URL("SolverDependencies.js", KERNEL));

/** a GRA from rows [station, height, radius, tangent]: the head, the rows, and rows behind them the head does not count */
function graBytes(rows, trailing = []) {
	const all = [[rows.length, 0, 0, 999, 1], ...rows.map((r) => [...r, 0]), ...trailing.map((r) => [...r, 400])];
	const bytes = new Uint8Array(all.length * GRA_RECORD_BYTES);
	const view = new DataView(bytes.buffer);
	all.forEach((r, k) => { for (let c = 0; c < 4; c++) view.setFloat64(k * GRA_RECORD_BYTES + 8 * c, r[c], true); view.setUint32(k * GRA_RECORD_BYTES + 32, r[4], true); });
	return bytes;
}
const close = (a, b, tolerance, what) => assert.ok(Math.abs(a - b) <= tolerance, `${what ?? ""}: ${a} against ${b}`);

// a gradient of six grade breaks over 1000 m: +4, -2, -2 (no break of grade at 3), +6, 0 per mille;
// R held at break 2 (-10000, a crest), T held at break 4 (30 m: the round one of the two, its R is what followed)
const STATIONS = [12400, 12600, 12800, 13000, 13200, 13400];
const TRUE_HEIGHTS = [50, 50.8, 50.4, 50, 51.2, 51.2];
const rowsOf = (heights) => STATIONS.map((s, i) => [s, heights[i], i === 1 ? -10000 : i === 3 ? 7400.3 : 0, i === 1 ? 30 : i === 3 ? 30 : 0]);

test("a GRA is its grade breaks on a distance of their own; a kilometre jump is one break with two stations", () => {
	const plain = readGra(graBytes(rowsOf(TRUE_HEIGHTS)));
	assert.deepEqual(plain.breaks.map((b) => [b.number, b.station, b.u, b.height, b.holds]), [[1, 12400, 0, 50, null], [2, 12600, 200, 50.8, "radius"], [3, 12800, 400, 50.4, null], [4, 13000, 600, 50, "tangent"], [5, 13200, 800, 51.2, null], [6, 13400, 1000, 51.2, null]]);
	assert.deepEqual([plain.jumps.length, plain.records, plain.trailing], [0, 6, 0]);
	// a jump of -9.471 m after 100 m: the marker carries the station before it (T = 1000, R = 0), the next record the one after
	const jumped = readGra(graBytes([[12400, 50, 0, 0], [12500, 50.4, 0, 1000], [12490.529, 50.4, 0, 0], [12590.529, 50.8, -10000, 30], [12790.529, 50.4, 0, 0]], [[1, 2, 3, 4]]));
	assert.deepEqual(jumped.breaks.map((b) => [b.number, [...b.cycles], b.station, Number(b.u.toFixed(3))]), [[1, [1], 12400, 0], [2, [2, 3], 12500, 100], [3, [4], 12590.529, 200], [4, [5], 12790.529, 400]]);
	assert.deepEqual(jumped.jumps.map((j) => [j.u, j.stationBefore, j.stationAfter, Number(j.delta.toFixed(3))]), [[100, 12500, 12490.529, -9.471]]);
	assert.deepEqual([jumped.records, jumped.trailing], [6, 1], "a record behind the grade breaks is carried, not read");
	close(stationAt(jumped, 50), 12450, 1e-9); close(stationAt(jumped, 150), 12540.529, 1e-9, "behind the jump the station is the one after it");
	// refused: a head that announces more than there is, a marker without its twin, grade breaks running backwards
	for (const bad of [new Uint8Array(40), graBytes([[1, 2, 0, 0]]), graBytes([[0, 1, 0, 0], [10, 1, 0, 1000], [8, 2, 0, 0], [20, 2, 0, 0]]), graBytes([[0, 1, 0, 0], [10, 1, 0, 0], [5, 1, 0, 0]])]) {
		assert.throws(() => readGra(bad), (e) => e instanceof GradientProfileError && e.code === "NO_GRA");
	}
});

test("the profile: straights between the grade breaks, a parabola over the tangent length at a rounding", () => {
	const gra = readGra(graBytes(rowsOf(TRUE_HEIGHTS)));
	const z = (u) => heightAt(gra.breaks, TRUE_HEIGHTS, u);
	const shape = shapeOf(gra.breaks, TRUE_HEIGHTS);
	assert.deepEqual(shape.grades.map((g) => Number((g * 1000).toFixed(6))), [4, -2, -2, 6, 0]);
	// break 2 holds R -10000: T = R |dn| / 2 = 10000 * 0.006 / 2 = 30; break 4 holds T 30: R = 2 T / dn = 60 / 0.008 = 7500
	close(shape.tangents[1], 30, 1e-9); close(shape.radii[1], -10000, 1e-9); close(shape.tangents[3], 30, 1e-9); close(shape.radii[3], 7500, 1e-9);
	close(z(100), 50.4, 1e-12, "on the first straight"); close(z(500), 50.2, 1e-12, "a break without a change of grade is a straight");
	// at the break the parabola lies R dn^2 / 8 = dn T / 4 below the corner of a crest
	close(z(200), 50.8 - (0.006 * 30) / 4, 1e-12, "the crest"); close(z(600), 50 + (0.008 * 30) / 4, 1e-12, "the sag");
	// tangent to both grades at the ends of the rounding
	const slope = (u) => (z(u + 1e-4) - z(u - 1e-4)) / 2e-4;
	close(slope(170 - 1e-3), 0.004, 1e-6); close(slope(230 + 1e-3), -0.002, 1e-6); close(slope(200), 0.001, 1e-6, "half way round");
	close(z(170), 50.8 - 0.004 * 30, 1e-12); close(z(230), 50.8 - 0.002 * 30, 1e-12);
	assert.equal(z(-1), null); assert.equal(z(1000.5), null);
	assert.deepEqual([...parseBreakHold("1, 4-6")], [1, 4, 5, 6]);
	assert.throws(() => parseBreakHold("3L"), (e) => e.code === "INVALID_HOLD");
});

// measured heights off the true profile, every 20 m
const truthGra = readGra(graBytes(rowsOf(TRUE_HEIGHTS)));
const measured = [];
for (let u = 10; u < 1000; u += 20) measured.push({ name: `H${measured.length + 1}`, u, height: heightAt(truthGra.breaks, TRUE_HEIGHTS, u) });
const PLAN_HEIGHTS = [50, 50.83, 50.36, 50.02, 51.17, 51.2];

test("the heights of the grade breaks are adjusted to the measured heights; the ends join what lies beyond", () => {
	const plan = readGra(graBytes(rowsOf(PLAN_HEIGHTS)));
	const fit = fitGradient({ gra: plan, points: measured, tolerance: 0.005 });
	assert.deepEqual([fit.verdict.status, fit.verdict.ok], ["converged", true]);
	fit.heights.forEach((h, i) => close(h, TRUE_HEIGHTS[i], 1e-6, `grade break ${i + 1}`));
	assert.ok(fit.fit.rmsBefore > 0.01 && fit.fit.rmsAfter < 1e-6 && fit.fit.outsideAfter === 0 && fit.fit.outsideBefore > 20, JSON.stringify(fit.fit));
	assert.deepEqual(fit.breaks.map((b) => [b.number, b.free, b.why, b.determined]), [[1, false, "Anschluss", null], [2, true, null, true], [3, true, null, true], [4, true, null, true], [5, true, null, true], [6, false, "Anschluss", null]]);
	// the held quantity stays, the other follows the new grades: R -10000 at break 2 with T back at 30, T 30 at break 4 with R back at 7500
	const [b2, b4] = [fit.breaks[1], fit.breaks[3]];
	close(b2.radiusAfter, -10000, 1e-9); close(b2.tangentAfter, 30, 1e-3); assert.ok(Math.abs(b2.tangentBefore - 30) > 0.3, "the plan's grades made another tangent length");
	close(b4.tangentAfter, 30, 1e-12); close(b4.radiusAfter, 7500, 0.5);
	close(fit.checks.steepestPermille, 6, 1e-3); assert.deepEqual(fit.checks.overlaps, []);
	assert.deepEqual(fit.points.slice(0, 2).map((p) => [p.name, p.station, p.within]), [["H1", 12410, true], ["H2", 12430, true]]);

	// held by number: break 3 stays at the plan, the others take what the points leave
	const held = fitGradient({ gra: plan, points: measured, tolerance: 0.005, hold: "3" });
	assert.equal(held.heights[2], 50.36);
	assert.deepEqual(held.breaks.filter((b) => !b.free).map((b) => [b.number, b.why]), [[1, "Anschluss"], [3, "gehalten"], [6, "Anschluss"]]);
	assert.ok(held.fit.rmsAfter > fit.fit.rmsAfter && held.fit.rmsAfter < held.fit.rmsBefore);
	// the ends free: with points on both end straights they are found as well
	const free = fitGradient({ gra: readGra(graBytes(rowsOf([50.05, 50.83, 50.36, 50.02, 51.17, 51.15]))), points: measured, tolerance: 0.005, holdEnds: false });
	free.heights.forEach((h, i) => close(h, TRUE_HEIGHTS[i], 1e-5, `grade break ${i + 1}, ends free`));
	// measured on the rail 30 mm above the gradient: the offset is taken off
	const lifted = fitGradient({ gra: plan, points: measured.map((p) => ({ ...p, height: p.height + 0.03 })), tolerance: 0.005, heightOffset: 0.03 });
	lifted.heights.forEach((h, i) => close(h, TRUE_HEIGHTS[i], 1e-6));
});

test("a height no measurement reaches stays at the plan, and the report says so; what cannot be adjusted is refused", () => {
	const plan = readGra(graBytes(rowsOf(PLAN_HEIGHTS)));
	// points on the first 380 m only: breaks 4 and 5 see none
	const fit = fitGradient({ gra: plan, points: measured.filter((p) => p.u < 380), tolerance: 0.005 });
	assert.deepEqual(fit.breaks.map((b) => [b.number, b.points, b.determined]), [[1, 10, null], [2, 19, true], [3, 9, true], [4, 0, false], [5, 0, false], [6, 0, null]]);
	close(fit.heights[3], PLAN_HEIGHTS[3], 1e-9, "break 4 stays"); close(fit.heights[4], PLAN_HEIGHTS[4], 1e-9, "break 5 stays");
	close(fit.heights[1], TRUE_HEIGHTS[1], 1e-4, "break 2 is found");
	// points without a height or off the profile are listed, not lost
	const some = fitGradient({ gra: plan, points: [...measured, { name: "ohne", u: 100, height: NaN }, { name: "draussen", u: 1200, height: 50 }], tolerance: 0.005 });
	assert.deepEqual(some.excluded, [{ name: "ohne", why: "keine Höhe" }, { name: "draussen", why: "außerhalb der Gradiente" }]);
	for (const [input, code] of [[{ hold: "1-6" }, "NOTHING_FREE"], [{ hold: "9" }, "INVALID_HOLD"], [{ tolerance: 0 }, "INVALID_TOLERANCE"], [{ points: [{ name: "x", u: 5000, height: 1 }] }, "NO_POINTS"]]) {
		assert.throws(() => fitGradient({ gra: plan, points: measured, ...input }), (e) => e instanceof GradientProfileError && e.code === code, code);
	}
});

test("the GRA goes back out with the new heights, the following T or R, and everything else as the file had it", () => {
	const trailing = [[13100, 13150, 13180, 2090]];
	const rows = [[12400, 50, 0, 0], [12500, 50.43, 0, 1000], [12490.529, 50.43, 0, 0], [12590.529, 50.83, -10000, 30.7], [12790.529, 50.36, 0, 0], [12990.529, 50.02, 7400.3, 30], [13190.529, 51.17, 0, 0], [13390.529, 51.2, 0, 0]];
	const bytes = graBytes(rows, trailing);
	const gra = readGra(bytes);
	assert.equal(gra.breaks.length, 7);
	// break 3 holds R, break 5 holds T (the jump's two records are break 2): raise break 4 between them
	assert.deepEqual(gra.breaks.map((b) => b.holds), [null, null, "radius", null, "tangent", null, null]);
	const heights = gra.breaks.map((b) => b.height); heights[3] += 0.04;
	const out = writeGraHeights(bytes, gra, heights);
	assert.equal(out.length, bytes.length);
	const back = readGra(out);
	assert.deepEqual(back.breaks.map((b) => b.height), heights);
	const shape = shapeOf(gra.breaks, heights);
	close(back.breaks[2].tangentLength, shape.tangents[2], 1e-12, "R held at break 3: its T follows"); assert.equal(back.breaks[2].radius, -10000);
	close(back.breaks[2].tangentLength, 30.75, 1e-9, "10000 * 6,15 per mille / 2, no longer the file's 30.7");
	close(back.breaks[4].radius, shape.radii[4], 1e-9, "T held at break 5: its R follows"); assert.equal(back.breaks[4].tangentLength, 30);
	// the head, the jump's two records and the record behind the grade breaks are the file's, byte for byte but for the heights
	const view = (b) => new DataView(b.buffer, b.byteOffset);
	assert.deepEqual([...out.subarray(0, 36)], [...bytes.subarray(0, 36)]);
	assert.deepEqual([...out.subarray(9 * 36)], [...bytes.subarray(9 * 36)]);
	assert.equal(view(out).getFloat64(2 * 36 + 24, true), 1000, "the jump's marker stays a marker");
	// nothing moved: nothing is rewritten - the file's own T (30.7, from the designer's unrounded heights) stays
	assert.deepEqual([...writeGraHeights(bytes, gra, gra.breaks.map((b) => b.height))], [...bytes]);
	// a jump's break moved: both of its records carry the new height
	const lifted = gra.breaks.map((b) => b.height); lifted[1] += 0.01;
	const twice = writeGraHeights(bytes, gra, lifted);
	assert.deepEqual([view(twice).getFloat64(2 * 36 + 8, true), view(twice).getFloat64(3 * 36 + 8, true)], [50.44, 50.44]);
	assert.throws(() => writeGraHeights(bytes, gra, [1, 2]), (e) => e.code === "INVALID_HEIGHTS");
});

// ---- from the files: a kilometre line, a gradient stationed along it, points of the right track beside it

const ORIGIN = { x: 3476000, y: 5474000 };
const startPose = { x: 0, y: 0, theta: 0.3 };
const LINE = [{ id: "E0", type: "straight", length: 300 }, { id: "E1", type: "transition", length: 90, family: "clothoid" }, { id: "E2", type: "arc", length: 400, curvature: 1 / 900 }, { id: "E3", type: "transition", length: 90, family: "clothoid" }, { id: "E4", type: "straight", length: 320 }];
const chain = createAlignmentPoseJacobian({ elements: LINE, startPose, momentsFor });
const world = (p) => ({ x: p.x + ORIGIN.x, y: p.y + ORIGIN.y, theta: p.theta });
const lineBytes = writeTra({ elements: LINE, poseOfElement: (i) => world(chain.entryPose(i)), poseAtStation: (s) => world(chain.poseAt(s)), endPose: world(chain.endPose), startStation: 12300 }).bytes;
// the right track runs 2.25 m right of the kilometre line; its points carry the true profile's heights
const pointAt = (s, right = 2.25) => { const p = chain.poseAt(s); return { x: ORIGIN.x + p.x + right * Math.sin(p.theta), y: ORIGIN.y + p.y - right * Math.cos(p.theta) }; };
const surveyed = [];
for (let s = 110; s < 1100; s += 20) surveyed.push({ name: `P${surveyed.length + 1}`, ...pointAt(s), height: heightAt(truthGra.breaks, TRUE_HEIGHTS, s - 100) });

test("from the files: points are placed by their foot on the stationing line, the gradient is adjusted and written", async () => {
	const { report, gra, csv } = await fitGraFromBytes({ graBytes: graBytes(rowsOf(PLAN_HEIGHTS)), graName: "P_RE.GRA", lineBytes, lineName: "P_KM.TRA", points: surveyed, tolerance: 0.005 });
	assert.deepEqual([report.verdict.status, report.input.breaks, report.input.free, report.input.points, report.input.listed], ["converged", 6, 4, 50, 50]);
	assert.deepEqual(report.input.stationing, { line: "P_KM.TRA", startStation: 12300, length: 1200, jumps: 0, gradientBeginsAt: 100 }, "the gradient begins 100 m into the kilometre line");
	report.breaks.forEach((b, i) => close(b.heightAfter, TRUE_HEIGHTS[i], 1e-5, `grade break ${i + 1}`));
	assert.ok(report.fit.rmsAfter < 1e-5 && report.fit.outsideAfter === 0);
	// the points lie 2.25 m to the right (negative offset); their station is the kilometre line's
	close(report.points[0].lateral, -2.25, 1e-6); close(report.points[0].station, 12410, 1e-6);
	readGra(gra).breaks.forEach((b, i) => close(b.height, TRUE_HEIGHTS[i], 1e-5));
	assert.match(csv, /^Punkt;Station;Hoehe;vorher;nachher;innerhalb\nP1;12410\.000;50\.0400;-?0\.\d{4};-?0\.0000;ja\n/);
	// the same from a list as the page reads it: a CSV whose header names the height
	const text = ["Nr;Rechtswert;Hochwert;H", ...surveyed.map((p) => `${p.name};${p.x.toFixed(4)};${p.y.toFixed(4)};${p.height.toFixed(4)}`)].join("\n");
	assert.deepEqual(Object.keys(parsePointList(text)[0]).sort(), ["height", "name", "tolerance", "x", "y"]);
	const fromText = await fitGraFromBytes({ graBytes: graBytes(rowsOf(PLAN_HEIGHTS)), lineBytes, points: text, tolerance: 0.005 });
	fromText.report.breaks.forEach((b, i) => close(b.heightAfter, TRUE_HEIGHTS[i], 2e-4, `grade break ${i + 1}, from text`));
	assert.throws(() => parsePointList("Nr;Rechtswert;Hochwert;H\nA;1;2;hoch"), (e) => e.code === "INVALID_HEIGHT");
	// a point beyond the line's end, and one without a height, are listed
	const more = await fitGraFromBytes({ graBytes: graBytes(rowsOf(PLAN_HEIGHTS)), lineBytes, points: [...surveyed, { name: "ohne", ...pointAt(500) }, { name: "weit", x: ORIGIN.x - 500, y: ORIGIN.y - 500, height: 50 }], tolerance: 0.005 });
	assert.deepEqual(more.report.input.excluded, [{ name: "ohne", why: "keine Höhe" }, { name: "weit", why: "kein Fußpunkt auf der Stationierungsachse" }]);
});

test("what the files do not carry is refused: a gradient off the line, a list without heights; a station finds its place across a jump", async () => {
	const off = graBytes(STATIONS.map((s, i) => [s + 5000, PLAN_HEIGHTS[i], 0, 0]));
	await assert.rejects(fitGraFromBytes({ graBytes: off, lineBytes, points: surveyed }), (e) => e instanceof FitGraError && e.code === "GRADIENT_OFF_LINE" && /does not carry it/.test(e.message));
	await assert.rejects(fitGraFromBytes({ graBytes: graBytes(rowsOf(PLAN_HEIGHTS)), lineBytes, points: surveyed.map(({ height, ...p }) => p) }), (e) => e.code === "NO_HEIGHTS");
	await assert.rejects(fitGraFromBytes({ graBytes: graBytes(rowsOf(PLAN_HEIGHTS)), lineBytes: null, points: surveyed }), (e) => e.code === "NO_LINE");
	// a line of 1000 m from station 100 with a jump of -10 after 300 m and one of +50 after 600 m
	const line = { startStation: 100, length: 1000, jumps: [{ distance: 300, delta: -10 }, { distance: 600, delta: 50 }] };
	assert.deepEqual([150, 400, 395, 750, 760, 1140].map((s) => distanceOfStation(s, line)), [50, 300, 295, 610, 620, 1000], "a station the jump repeats is the place before it; behind the jumps the stations run on");
	assert.deepEqual([50, 1200].map((s) => distanceOfStation(s, line)), [null, null]);
	assert.equal(distanceOfStation(720, line), null, "the stations a forward jump leaves out lie nowhere");
});

test("a corpus gradient and its kilometre line carry the same kilometre jumps at the same places", async (context) => {
	const dir = new URL("../samples/Billwerder/2024-11-23 Trassierungsdaten/6100_Trassierung_DBREF2016/", import.meta.url);
	let graFile, kmFile;
	try { [graFile, kmFile] = await Promise.all(["6100_247-289_DBREF2016_RE.GRA", "6100_247-289_DBREF2016_KM.TRA"].map(async (name) => new Uint8Array(await readFile(new URL(name, dir))))); }
	catch (error) { if (error.code === "ENOENT") return context.skip("local TRA corpus unavailable"); throw error; }
	const gra = readGra(graFile);
	const km = await traAlignmentFromBytes(kmFile, "KM.TRA");
	assert.deepEqual([gra.breaks.length, gra.jumps.length, gra.trailing], [143, 6, 1]);
	assert.deepEqual(gra.jumps.map((j) => [Number(j.u.toFixed(3)), Number(j.delta.toFixed(4))]), km.kilometreJumps.map((j) => [Number(j.distance.toFixed(3)), Number(j.delta.toFixed(4))]));
	assert.deepEqual(gra.breaks.reduce((m, b) => { m[b.holds ?? "none"] += 1; return m; }, { none: 0, radius: 0, tangent: 0 }), { none: 63, radius: 48, tangent: 32 });
	// unchanged heights give the file back byte for byte
	assert.deepEqual([...writeGraHeights(graFile, gra, gra.breaks.map((b) => b.height))], [...graFile]);
});
