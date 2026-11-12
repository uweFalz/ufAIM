// The Viewer's Lage witness: where a Gleis lies relative to a
// Kilometerlinie, from coordinates alone. The block between the two
// markers in technetViewer.html is pure (no DOM), so it runs here as it is.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = await fs.readFile(new URL("technetViewer.html", root), "utf8");
const begin = html.indexOf("// BEGIN LAGE WITNESS");
const end = html.indexOf("// END LAGE WITNESS");
assert.ok(begin > 0 && end > begin, "witness block present");
const context = vm.createContext({});
new vm.Script(`${html.slice(begin, end)}\nglobalThis.api = { lageBounds, lageOffset, lageGrid, lageWitnessOf, lageAbstandOf, sideGradeOf };`, { filename: "lage-witness.js" }).runInContext(context);
const { lageBounds, lageOffset, lageGrid, lageWitnessOf, lageAbstandOf, sideGradeOf } = context.api;

// A line along the easting axis, one point every `step` metres. `offset`
// shifts it to the left (+) or right (-) of that direction; `reverse`
// digitises it against its own stationing.
function line({ from = 0, to = 1000, step = 10, offset = 0, stationAt = 100000, reverse = false } = {}) {
	const points = [];
	for (let x = from; x <= to; x += step) points.push({ easting: x, northing: offset, station: stationAt + x });
	return reverse ? points.reverse() : points;
}
const axis = (route, options) => {
	const polyline = line(options);
	return { route, polyline, bounds: lageBounds(polyline) };
};
const witness = (gleis, axes, preferred) => JSON.parse(JSON.stringify(lageWitnessOf(gleis, axes, preferred)));

test("a Gleis beside the Kilometerlinie: side, offset and km", () => {
	const left = witness(line({ from: 200, to: 600, offset: 2 }), [axis("5500")]);
	assert.equal(left.verdict, "left");
	assert.equal(left.route, "5500");
	assert.ok(Math.abs(left.median - 2) < 1e-9 && Math.abs(left.max - left.min) < 1e-9);
	assert.ok(left.stationFrom > 100200 && left.stationTo < 100600);
	assert.equal(left.hits, left.samples);
	const right = witness(line({ from: 200, to: 600, offset: -8.3 }), [axis("5500")]);
	assert.equal(right.verdict, "right");
	assert.ok(Math.abs(right.median - 8.3) < 1e-9);
});

test("the side follows the rising km, not the order of the points", () => {
	const reversed = axis("5500", { reverse: true });
	assert.equal(witness(line({ from: 200, to: 600, offset: 2 }), [reversed]).verdict, "left");
	assert.equal(witness(line({ from: 200, to: 600, offset: -2 }), [reversed]).verdict, "right");
	// The Gleis's own direction does not matter either.
	assert.equal(witness(line({ from: 200, to: 600, offset: 2, reverse: true }), [axis("5500")]).verdict, "left");
});

test("on the line, across it, out of reach", () => {
	assert.equal(witness(line({ from: 200, to: 600, offset: 0.1 }), [axis("5500")]).verdict, "axis");
	const crossing = line({ from: 200, to: 600 }).map((point, index, all) => ({ ...point, northing: -2 + 4 * index / (all.length - 1) }));
	assert.equal(witness(crossing, [axis("5500")]).verdict, "crossing");
	assert.equal(witness(line({ from: 200, to: 600, offset: 80 }), [axis("5500")]).verdict, "none");
	assert.equal(witness(line({ from: 200, to: 600, offset: 2 }), []).verdict, "none");
	assert.equal(lageWitnessOf([{ easting: 0, northing: 0, station: 0 }], [axis("5500")]), null);
});

test("mostly on the line with a stretch beside it is still on the line", () => {
	// A Neuplanung leaves its Kilometerlinie by 1,5 m over 40 % of its length.
	const gleis = line({ from: 0, to: 1000 }).map((point) => ({ ...point, northing: point.easting > 300 && point.easting < 700 ? 1.5 : 0 }));
	const result = witness(gleis, [axis("2631")]);
	assert.equal(result.verdict, "axis");
	assert.ok(Math.abs(result.max - 1.5) < 1e-9, "the detour stays visible in the offsets");
	assert.equal(sideGradeOf("right", result), "erklaert", "no contradiction to a declared side");
	// Beside it for most of its length, it is beside it.
	const beside = line({ from: 0, to: 1000 }).map((point) => ({ ...point, northing: point.easting > 200 ? 1.5 : 0 }));
	assert.equal(witness(beside, [axis("2631")]).verdict, "left");
});

test("the grid finds the same nearest point as the full search", () => {
	// A curved line with negative coordinates, cells crossed in both axes.
	const polyline = [];
	for (let i = 0; i <= 400; i += 1) polyline.push({ easting: -900 + i * 5, northing: 300 * Math.sin(i / 60) - 150, station: 5000 + i * 5 });
	const grid = lageGrid(polyline);
	for (let i = 0; i < 200; i += 1) {
		const base = polyline[(i * 37) % polyline.length];
		const point = { easting: base.easting + ((i * 13) % 80) - 40, northing: base.northing + ((i * 29) % 80) - 40 };
		const full = lageOffset(polyline, point);
		const fast = lageOffset(polyline, point, grid);
		if (full.distance > 60) continue;
		assert.ok(fast, `sample ${i} found`);
		assert.ok(Math.abs(full.distance - fast.distance) < 1e-9 && Math.abs(full.station - fast.station) < 1e-6 && full.side === fast.side, `sample ${i} agrees`);
	}
	assert.equal(lageOffset(polyline, { easting: 5000, northing: 5000 }, grid), null);
});

test("past the end of the line is not beside it", () => {
	// 1000 m of Kilometerlinie, the Gleis runs from 900 to 1900.
	assert.equal(witness(line({ from: 900, to: 1900, offset: 2 }), [axis("5500")]).verdict, "none");
	// Two pieces of one Kilometerlinie cover it together.
	const pieces = [axis("5500"), axis("5500", { from: 1000, to: 2000 })];
	const covered = witness(line({ from: 900, to: 1900, offset: 2 }), pieces);
	assert.equal(covered.verdict, "left");
	assert.equal(covered.hits, covered.samples);
});

test("one folded sample does not turn a side into a crossing", () => {
	const gleis = line({ from: 0, to: 2000, step: 10, offset: 2 });
	const folded = line({ from: 0, to: 2000, step: 10 });
	// A TRA restarting its stations: one stretch runs backwards in station.
	for (let index = 100; index < 104; index += 1) folded[index].station = folded[100].station - (index - 100) * 10;
	const result = witness(gleis, [{ route: "6100", polyline: folded, bounds: lageBounds(folded) }]);
	assert.equal(result.verdict, "left");
});

test("between two Kilometerlinien: the nearest, unless the Gleis names its own", () => {
	const axes = [axis("6100"), axis("1121", { offset: 12 })];
	const gleis = line({ from: 200, to: 600, offset: 8 });
	const nearest = witness(gleis, axes);
	assert.equal(nearest.route, "1121");
	assert.equal(nearest.verdict, "right");
	const own = witness(gleis, axes, "6100");
	assert.equal(own.route, "6100");
	assert.equal(own.verdict, "left");
	assert.ok(Math.abs(own.median - 8) < 1e-9);
});

test("lageOffset: distance, station, side, end", () => {
	const polyline = line();
	const hit = lageOffset(polyline, { easting: 505, northing: -3 });
	assert.ok(Math.abs(hit.distance - 3) < 1e-9);
	assert.ok(Math.abs(hit.station - 100505) < 1e-9);
	assert.equal(hit.side, -1);
	assert.equal(hit.atEnd, false);
	assert.equal(lageOffset(polyline, { easting: -20, northing: 0 }).atEnd, true);
	assert.equal(lageOffset(polyline, { easting: 1020, northing: 0 }).atEnd, true);
});

test("two witnesses grade a Gleisseite", () => {
	assert.equal(sideGradeOf("right", { verdict: "right" }), "belegt");
	assert.equal(sideGradeOf("right", { verdict: "left" }), "widerspruch");
	assert.equal(sideGradeOf("left", { verdict: "axis" }), "erklaert");
	assert.equal(sideGradeOf("left", { verdict: "crossing" }), "erklaert");
	assert.equal(sideGradeOf("left", { verdict: "none" }), "erklaert");
	assert.equal(sideGradeOf("left", null), "erklaert");
	assert.equal(sideGradeOf("unknown", { verdict: "right" }), "lage");
	assert.equal(sideGradeOf("unknown", { verdict: "crossing" }), "lage");
	assert.equal(sideGradeOf("unknown", { verdict: "none" }), "offen");
	assert.equal(sideGradeOf("unknown", null), "offen");
});

test("how far one line runs from another: beside it, on it, leaving it, out of reach", () => {
	const abstand = (gleis, other) => JSON.parse(JSON.stringify(lageAbstandOf(gleis, { polyline: other })));
	const strecke = line();
	const beside = abstand(line({ from: 200, to: 600, offset: -4.5 }), strecke);
	assert.equal(beside.hits, beside.samples);
	assert.ok(Math.abs(beside.median - 4.5) < 1e-9 && Math.abs(beside.max - beside.min) < 1e-9);
	// a second delivery lies on the line
	assert.ok(abstand(line({ from: 200, to: 600 }), strecke).max < 1e-9);
	// a Weichenverbindung starts on the line and leaves it
	const leaving = line({ from: 200, to: 300 }).map((point, index, all) => ({ ...point, northing: 5 * index / (all.length - 1) }));
	const left = abstand(leaving, strecke);
	assert.ok(left.min < 1 && left.max > 4 && left.median > 1 && left.median < 4);
	// only the part beside the other counts; its ends are not "beside"
	const lapping = abstand(line({ from: 900, to: 1400, offset: 3 }), strecke);
	assert.ok(lapping.hits > 0 && lapping.hits < lapping.samples && Math.abs(lapping.median - 3) < 1e-9);
	assert.deepEqual(abstand(line({ from: 200, to: 600, offset: 80 }), strecke), { samples: 10, hits: 0 });
	assert.equal(lageAbstandOf([{ easting: 0, northing: 0, station: 0 }], { polyline: strecke }), null);
	assert.equal(lageAbstandOf(line(), null), null);
});
