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
new vm.Script(`${html.slice(begin, end)}\nglobalThis.api = { lageBounds, lageOffset, lageGrid, lageWitnessOf, lageGanzDaneben, lageLinienwahl, lageAbstandOf, lageAbstandReihe, sideGradeOf };`, { filename: "lage-witness.js" }).runInContext(context);
const { lageBounds, lageOffset, lageGrid, lageWitnessOf, lageGanzDaneben, lageLinienwahl, lageAbstandOf, lageAbstandReihe, sideGradeOf } = context.api;

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

test("a Gleis beside a Trasse as a line over the Trasse's stations: side, distance, and a break where it is away", () => {
	const strecke = line();
	const reihe = (gleis, other = strecke) => JSON.parse(JSON.stringify(lageAbstandReihe(gleis, { polyline: other })));
	// Left of the rising stations is +, right is -, x is the station on the Trasse.
	const links = reihe(line({ from: 200, to: 600, offset: 4.5 }));
	assert.equal(links.length, 41);
	assert.ok(links.every((point) => point.y === 4.5));
	assert.equal(links[0].x, 100200);
	assert.equal(links[links.length - 1].x, 100600);
	assert.equal(links[0].gap, true);
	assert.ok(links.slice(1).every((point) => !point.gap));
	assert.ok(reihe(line({ from: 200, to: 600, offset: -9 })).every((point) => point.y === -9));
	// A Trasse digitised against its stations keeps left and right by the stations.
	assert.ok(reihe(line({ from: 200, to: 600, offset: 4.5 }), line({ reverse: true })).every((point) => point.y === 4.5));
	// A Gleis that leaves the reach and comes back is two pieces.
	const weg = [];
	for (let x = 200; x <= 600; x += 10) weg.push({ easting: x, northing: x > 350 && x < 450 ? 80 : 5, station: x });
	const stuecke = reihe(weg);
	assert.equal(stuecke.filter((point) => point.gap).length, 2);
	assert.ok(stuecke.every((point) => point.y === 5));
	assert.ok(!stuecke.some((point) => point.x > 100350 && point.x < 100450));
	// Past the end of the Trasse there is nothing beside it; nothing to measure gives no line.
	assert.equal(reihe(line({ from: 1200, to: 1400, offset: 4 })).length, 0);
	assert.equal(lageAbstandReihe(line(), null).length, 0);
	assert.equal(lageAbstandReihe([{ easting: 0, northing: 0, station: 0 }], { polyline: strecke }).length, 0);
});

test("beside the nearest line in part, beside another from end to end: the other is named", () => {
	const gleis = line({ from: 200, to: 600 });
	const near = axis("5634", { from: 0, to: 470, offset: -2 });
	const whole = axis("5500", { from: 0, to: 1000, offset: -20 });
	const lage = witness(gleis, [near, whole]);
	assert.equal(lage.route, "5634");
	assert.ok(lage.hits < lage.samples && lage.hits >= 0.6 * lage.samples);
	assert.equal(lage.eigen, false);
	assert.deepEqual(lage.weitere.map((linie) => [linie.route, linie.hits === lage.samples, Math.round(linie.median)]), [["5500", true, 20]]);
	assert.equal(lageGanzDaneben(lage).route, "5500");
	// Picked, the other line stands as the Gleis's own: nothing is in doubt.
	const picked = witness(gleis, [near, whole], "5500");
	assert.equal(picked.route, "5500");
	assert.equal(picked.eigen, true);
	assert.equal(picked.hits, picked.samples);
	assert.equal(lageGanzDaneben(picked), null);
	// Beside both from end to end, or beside the nearest alone: no doubt.
	assert.equal(lageGanzDaneben(witness(gleis, [axis("5634", { offset: -2 }), whole])), null);
	assert.equal(lageGanzDaneben(witness(gleis, [near])), null);
	assert.equal(lageGanzDaneben(witness(gleis, [])), null);
	// One sample past the line's end is the grain of the measure, not a doubt.
	const almost = witness(gleis, [axis("5632", { from: 0, to: 570, offset: -2 }), whole]);
	assert.equal(almost.route, "5632");
	assert.equal(almost.samples - almost.hits, 1);
	assert.equal(almost.weitere[0].route, "5500");
	assert.equal(lageGanzDaneben(almost), null);
	// The number of missing samples that makes a doubt is an Annahme the user can change.
	assert.equal(lageGanzDaneben(almost, 1).route, "5500");
	assert.equal(lageLinienwahl(almost).zweifel, false);
	assert.equal(lageLinienwahl(almost, (route) => route, 1).zweifel, true);
	assert.equal(lageGanzDaneben(lage, 5), null);
	assert.equal(lageGanzDaneben(null), null);
});

test("the choice of line: one per Strecke, the doubt only between Strecken", () => {
	const plain = (value) => JSON.parse(JSON.stringify(value));
	const gleis = line({ from: 200, to: 600 });
	const near = axis("5634", { from: 0, to: 470, offset: -2 });
	const whole = axis("5500", { from: 0, to: 1000, offset: -20 });
	const far = axis("5632", { from: 0, to: 1000, offset: -40 });
	const wahl = plain(lageLinienwahl(witness(gleis, [near, whole, far])));
	assert.deepEqual(wahl.linien.map((linie) => linie.route), ["5634", "5500", "5632"]);
	assert.equal(wahl.naechste, "5634");
	assert.equal(wahl.zweifel, true);
	assert.equal(wahl.ganz, "5500");
	// Beside both from end to end: a choice, no doubt.
	const quiet = plain(lageLinienwahl(witness(gleis, [axis("5634", { offset: -2 }), whole])));
	assert.deepEqual(quiet.linien.map((linie) => linie.route), ["5634", "5500"]);
	assert.equal(quiet.zweifel, false);
	assert.equal(quiet.ganz, null);
	// Two lines of one Strecke are no choice; with a third of another Strecke one of them stays.
	const strecke = (route) => route.slice(0, 4);
	assert.equal(lageLinienwahl(witness(gleis, [axis("5810S", { offset: -2 }), axis("5810R", { offset: -6 })]), strecke), null);
	assert.deepEqual(plain(lageLinienwahl(witness(gleis, [axis("5810S", { offset: -2 }), axis("5810R", { offset: -6 }), whole]), strecke)).linien.map((linie) => linie.route), ["5810S", "5500"]);
	// The nearest piece covers part, another piece of the same Strecke all of it: no doubt about the Strecke.
	const pieces = plain(lageLinienwahl(witness(gleis, [axis("6100_a", { from: 0, to: 470, offset: -2 }), axis("6100_b", { from: 300, to: 1000, offset: -2 }), axis("6100_c", { offset: -3 }), whole]), strecke));
	assert.equal(pieces.zweifel, false);
	assert.deepEqual(pieces.linien.map((linie) => linie.route), ["6100_a", "5500"]);
	// One line, the Gleis's own line, no line: nothing to choose.
	assert.equal(lageLinienwahl(witness(gleis, [near])), null);
	assert.equal(lageLinienwahl(witness(gleis, [near, whole], "5500")), null);
	assert.equal(lageLinienwahl(witness(gleis, [])), null);
	assert.equal(lageLinienwahl(null), null);
});

test("the Gleis's own lines by a test: the nearest of its Strecke wins over a nearer line of another", () => {
	const gleis = line({ from: 200, to: 600 });
	const other = axis("6100_236-246_KM", { offset: -9 });
	const ownFar = axis("1150_160-161_KM", { offset: 14 });
	const ownFarther = axis("1150_150-160_KM", { offset: 30 });
	const own = (route) => route.startsWith("1150");
	assert.equal(witness(gleis, [other, ownFar, ownFarther]).route, "6100_236-246_KM");
	const lage = witness(gleis, [other, ownFar, ownFarther], own);
	assert.equal(lage.route, "1150_160-161_KM");
	assert.equal(lage.verdict, "right");
	assert.equal(lage.eigen, true);
	assert.deepEqual(lage.weitere.map((linie) => linie.route), ["6100_236-246_KM", "1150_150-160_KM"]);
	assert.equal(lageLinienwahl(lage), null);
	// No line of its own in reach: the nearest, and not its own.
	const none = witness(gleis, [other], own);
	assert.equal(none.route, "6100_236-246_KM");
	assert.equal(none.eigen, false);
});

test("the reach is an Annahme: a line farther than 60 m counts when the reach says so", () => {
	const gleis = line({ from: 200, to: 600, offset: 80 });
	const km = axis("1280");
	assert.equal(witness(gleis, [km]).verdict, "none");
	const reached = (reach) => JSON.parse(JSON.stringify(lageWitnessOf(gleis, [km], "", reach)));
	const wide = reached(100);
	assert.equal(wide.verdict, "left");
	assert.equal(wide.route, "1280");
	assert.ok(Math.abs(wide.median - 80) < 1e-9);
	assert.equal(reached(79).verdict, "none");
	// The share beside a line follows the same reach.
	const other = { polyline: km.polyline };
	assert.equal(lageAbstandOf(gleis, other).hits, 0);
	const beside = lageAbstandOf(gleis, other, 100);
	assert.equal(beside.hits, beside.samples);
	assert.ok(Math.abs(beside.median - 80) < 1e-9);
});

test("a reach beyond the grid's cells is honoured: 200 m beside the line is found at 250 m", () => {
	const gleis = line({ from: 200, to: 600, offset: 200 });
	const km = axis("1280");
	const reached = (reach) => JSON.parse(JSON.stringify(lageWitnessOf(gleis, [km], "", reach)));
	assert.equal(reached(150).verdict, "none");
	const far = reached(250);
	assert.equal(far.verdict, "left");
	assert.equal(far.hits, far.samples);
	assert.ok(Math.abs(far.median - 200) < 1e-9);
	const other = { polyline: km.polyline, grid: lageGrid(km.polyline) };
	assert.equal(lageAbstandOf(gleis, other, 150).hits, 0);
	assert.equal(lageAbstandOf(gleis, other, 250).hits, lageAbstandOf(gleis, other, 250).samples);
	// The standard ring is unchanged: 60 m, found as before.
	assert.equal(witness(line({ from: 200, to: 600, offset: 59 }), [km]).verdict, "left");
});
