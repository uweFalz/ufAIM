// The Viewer's GND topology helpers: Knoten keys and labels (Satzart 31),
// and how a Gleisstrang's point list (Satzart 33) is laid onto the Lage
// elements. The block between the two markers in technetViewer.html is
// pure (no DOM), so it runs here as it is.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = await fs.readFile(new URL("technetViewer.html", root), "utf8");
const begin = html.indexOf("// BEGIN GND TOPOLOGY");
const end = html.indexOf("// END GND TOPOLOGY");
assert.ok(begin > 0 && end > begin, "topology block present");
const context = vm.createContext({});
new vm.Script(`${html.slice(begin, end)}\nglobalThis.api = { gndKey, gndKnotenLabel, gndStrandPortions, gndBauart, weichenRoles, gndGleisNumber, gndUnnumbered, gndKnotenStation, gndNearestNode, gndGroupStations, gndLegTarget, gndStraightStamm, gndLegByRadius, gndStrandGleis, gndThroughGleis, GND_KNOTEN_KINDS, GND_KNOTEN_MATCH_M };`, { filename: "gnd-topology.js" }).runInContext(context);
const { gndKey, gndKnotenLabel, gndStrandPortions, gndBauart, weichenRoles, gndGleisNumber, gndUnnumbered, gndKnotenStation, gndNearestNode, gndGroupStations, gndLegTarget, gndStraightStamm, gndLegByRadius, gndStrandGleis, gndThroughGleis, GND_KNOTEN_KINDS, GND_KNOTEN_MATCH_M } = context.api;

test("fixed-width keys: blanks collapse, nothing else changes", () => {
	assert.equal(gndKey("203695    24"), "203695 24");
	assert.equal(gndKey("  5501HK40241 "), "5501HK40241");
	assert.equal(gndKey("5501HK 3118"), "5501HK 3118");
	assert.equal(gndKey("ABCH_2"), "ABCH_2");
	assert.equal(gndKey(null), "");
	assert.equal(gndKey(4120), "4120");
});

test("Knoten kinds and labels", () => {
	assert.deepEqual(json(GND_KNOTEN_KINDS), { 1: "Weiche", 2: "Ende", 3: "Fortsetzung", 4: "Kreuzung" });
	assert.equal(GND_KNOTEN_MATCH_M, 1);
	assert.equal(gndKnotenLabel({ knotenTyp: 1, knotenName: "24" }), "W 24");
	assert.equal(gndKnotenLabel({ knotenTyp: 1, knotenName: "EV_4" }), "W EV_4");
	assert.equal(gndKnotenLabel({ knotenTyp: 4, knotenName: "122K" }), "Kr 122K");
	assert.equal(gndKnotenLabel({ knotenTyp: 2, knotenName: "24E" }), null);
	assert.equal(gndKnotenLabel({ knotenTyp: 3, knotenName: "53201" }), null);
});

// Two Gleise: A runs p1→p2→p3→p4, B runs q1→q2→p3 (B ends on A's point p3).
const A = { name: "A" };
const B = { name: "B" };
const elementOf = new Map();
const chain = (entry, pads) => pads.slice(0, -1).forEach((pad, index) => {
	elementOf.set(`${pad}|${pads[index + 1]}`, { entry, index, forward: true });
	if (!elementOf.has(`${pads[index + 1]}|${pad}`)) elementOf.set(`${pads[index + 1]}|${pad}`, { entry, index, forward: false });
});
chain(A, ["p1", "p2", "p3", "p4"]);
chain(B, ["q1", "q2", "p3"]);
// Values cross the vm boundary as JSON so deepEqual compares structure, not realms.
const json = (value) => JSON.parse(JSON.stringify(value));
const plain = (portions) => json(portions).map(({ entry, forward, firstIndex, lastIndex, fromPad, toPad }) => ({ entry: entry.name, forward, firstIndex, lastIndex, fromPad, toPad }));

test("a Gleisstrang along one Gleis is one portion", () => {
	assert.deepEqual(plain(gndStrandPortions(["p1", "p2", "p3", "p4"], elementOf)), [{ entry: "A", forward: true, firstIndex: 0, lastIndex: 2, fromPad: "p1", toPad: "p4" }]);
	assert.deepEqual(plain(gndStrandPortions(["p2", "p3"], elementOf)), [{ entry: "A", forward: true, firstIndex: 1, lastIndex: 1, fromPad: "p2", toPad: "p3" }]);
});

test("against the Gleis's direction the portion runs backwards", () => {
	assert.deepEqual(plain(gndStrandPortions(["p4", "p3", "p2"], elementOf)), [{ entry: "A", forward: false, firstIndex: 2, lastIndex: 1, fromPad: "p4", toPad: "p2" }]);
});

test("a Gleisstrang over two Gleise gives two portions, in order", () => {
	assert.deepEqual(plain(gndStrandPortions(["q1", "q2", "p3", "p4"], elementOf)), [
		{ entry: "B", forward: true, firstIndex: 0, lastIndex: 1, fromPad: "q1", toPad: "p3" },
		{ entry: "A", forward: true, firstIndex: 2, lastIndex: 2, fromPad: "p3", toPad: "p4" },
	]);
});

test("a pair no element answers to leaves a gap; nothing matched, nothing returned", () => {
	assert.deepEqual(plain(gndStrandPortions(["p1", "p2", "x", "p3", "p4"], elementOf)), [
		{ entry: "A", forward: true, firstIndex: 0, lastIndex: 0, fromPad: "p1", toPad: "p2" },
		{ entry: "A", forward: true, firstIndex: 2, lastIndex: 2, fromPad: "p3", toPad: "p4" },
	]);
	assert.deepEqual(json(gndStrandPortions(["x", "y"], elementOf)), []);
	assert.deepEqual(json(gndStrandPortions([], elementOf)), []);
	assert.deepEqual(json(gndStrandPortions(["p1"], elementOf)), []);
});

test("Bauart: form, rail profile, radius, slope", () => {
	assert.deepEqual(json(gndBauart("EW 49-190-1:9")), { text: "EW 49-190-1:9", form: "EW", rail: "49", radius: 190, slope: "1:9" });
	assert.deepEqual(json(gndBauart("ABW 60-500-1:12")), { text: "ABW 60-500-1:12", form: "ABW", rail: "60", radius: 500, slope: "1:12" });
	assert.equal(gndBauart("IBW 60-760-1:18,5-fb").radius, 760);
	assert.equal(gndBauart("IBW 60-760-1:18,5-fb").slope, "1:18,5");
	assert.equal(gndBauart("DKW 54-190-1:9").form, "DKW");
	assert.equal(gndBauart("DBKW 54-500-1:9/1:12u.1:9").form, "DBKW");
	assert.equal(gndBauart("Kr 60-1:18.5").form, "Kr");
	assert.equal(gndBauart("Kr 60-1:18.5").radius, null);
	assert.equal(gndBauart("60-500-1:12").form, null);
	assert.equal(gndBauart("60-500-1:12").radius, 500);
	assert.equal(gndBauart("  "), null);
	assert.equal(gndBauart(null), null);
});

test("Spitze, Stamm, Zweig of a Weiche from its legs", () => {
	// Spitze leg points west, Stamm straight east, Zweig east bending left (+).
	const legs = [
		{ name: "spitze", away: { x: -1, y: 0 }, deviation: 0, length: 25 },
		{ name: "stamm", away: { x: 1, y: 0 }, deviation: 0.0005, length: 25 },
		{ name: "zweig", away: { x: 1, y: 0 }, deviation: 25 / (2 * 190), length: 25 },
	];
	const roles = json(weichenRoles(legs));
	assert.equal(roles.spitze.name, "spitze");
	assert.equal(roles.stamm.name, "stamm");
	assert.equal(roles.zweig.name, "zweig");
	assert.equal(roles.side, "links");
	assert.ok(Math.abs(roles.radius - 1 / (2 * (25 / (2 * 190)) / 25 - 2 * 0.0005 / 25)) < 1e-6);
	assert.ok(Math.abs(roles.radius - 191.5) < 1, `relative radius ${roles.radius}`);
	assert.equal(roles.certain, true);
	// Bending right gives a Rechtsweiche; a curved Stamm keeps the relative radius.
	const right = json(weichenRoles(legs.map((leg) => ({ ...leg, deviation: -leg.deviation }))));
	assert.equal(right.side, "rechts");
	const curved = json(weichenRoles([legs[0], { ...legs[1], deviation: 25 / (2 * 1000) }, { ...legs[2], deviation: 25 / (2 * 1000) + 25 / (2 * 190) }]));
	assert.equal(curved.zweig.name, "zweig");
	assert.ok(Math.abs(curved.radius - 190) < 1e-6);
});

test("no Spitze without a leg facing the other two; a close call is uncertain", () => {
	assert.equal(json(weichenRoles([])).spitze, null);
	assert.equal(json(weichenRoles([{ away: { x: 1, y: 0 }, deviation: 0, length: 25 }, { away: { x: 0, y: 1 }, deviation: 0, length: 25 }, { away: { x: -1, y: 0 }, deviation: 0, length: 25 }])).spitze, null);
	const close = json(weichenRoles([
		{ away: { x: -1, y: 0 }, deviation: 0, length: 25 },
		{ away: { x: 1, y: 0 }, deviation: 0.001, length: 25 },
		{ away: { x: 1, y: 0 }, deviation: 0.002, length: 25 },
	]));
	assert.equal(close.certain, false);
});

test("a Gleis without a number of its own: 0 in GND, 9000 and up in LIRA", () => {
	assert.equal(gndGleisNumber("Gleis 0 · Nebengleis"), 0);
	assert.equal(gndGleisNumber("Gleis 9001"), 9001);
	assert.equal(gndGleisNumber("Gleis 15"), 15);
	assert.equal(gndGleisNumber("Strecke 5321 · rechts"), null);
	assert.equal(gndGleisNumber("5904072S_ER0"), null);
	assert.equal(gndGleisNumber(null), null);
	assert.equal(gndUnnumbered("Gleis 0 · Nebengleis"), true);
	assert.equal(gndUnnumbered("Gleis 9160"), true);
	assert.equal(gndUnnumbered("Gleis 15"), false);
	assert.equal(gndUnnumbered("Gleis 405"), false);
	assert.equal(gndUnnumbered("Strecke 5321 · rechts"), false);
});

// WueTreu Gleis 2: W 321 and W 322 sit 735.5 and 753.9 m into a Gerade that
// runs 435.6-811.5; Billwerder ADA_401 220 m into one of Strecke 1150.
test("a Knoten inside a Lage element takes its own point's station, not the element boundary", () => {
	assert.equal(gndKnotenStation(811.5, { station: 735.5, distance: 0 }, 435.6, 811.5, 0.3), 735.5);
	assert.equal(gndKnotenStation(435.6, { station: 753.9, distance: 0.1 }, 435.6, 811.5, 0.3), 753.9);
	assert.equal(gndKnotenStation(155639.9, { station: 155419.4, distance: 0 }, 143800, 155639.9, 0.3), 155419.4);
	// the point lies beside the Gleis, or outside the strand's elements (a Kilometersprung), or there is no hit
	assert.equal(gndKnotenStation(811.5, { station: 735.5, distance: 2 }, 435.6, 811.5, 0.3), 811.5);
	assert.equal(gndKnotenStation(811.5, { station: 1200, distance: 0 }, 435.6, 811.5, 0.3), 811.5);
	assert.equal(gndKnotenStation(811.5, null, 435.6, 811.5), 811.5);
	// half a metre of slack at the boundary, and the window works either way round
	assert.equal(gndKnotenStation(811.5, { station: 811.9, distance: 0 }, 811.5, 435.6), 811.9);
});

// Billwerder: two Satzart-31 rows "_403", 29 km apart; the strand ending at
// E 3564937 means the second.
test("a shared Knoten name resolves to the Knoten at the strand's end point", () => {
	const a = { knoten: "_403", own: { easting: 3593182.2, northing: 5933287.8 } };
	const b = { knoten: "_403", own: { easting: 3564937.0, northing: 5941644.1 } };
	const pointOf = (node) => node.own;
	assert.equal(gndNearestNode([a, b], { easting: 3564940, northing: 5941640 }, pointOf), b);
	assert.equal(gndNearestNode([a, b], { easting: 3593180, northing: 5933290 }, pointOf), a);
	assert.equal(gndNearestNode([a, b], null, pointOf), a);
	assert.equal(gndNearestNode([a], { easting: 0, northing: 0 }, pointOf), a);
	assert.equal(gndNearestNode([], { easting: 0, northing: 0 }, pointOf), null);
	// a candidate without a point of its own never wins against one with
	assert.equal(gndNearestNode([{ own: null }, b], { easting: 0, northing: 0 }, pointOf), b);
});

// A 33 m stub across the Strecke: both ends get nearly the same km by the
// perpendicular; along its own direction it keeps its 33 m around the mean km.
test("a far group keeps its lengths along its own main direction", () => {
	const across = gndGroupStations([{ easting: 0, northing: 0 }, { easting: 0, northing: 33 }], [1000, 1002]);
	assert.equal(Math.round(Math.abs(across[1] - across[0]) * 10) / 10, 33);
	assert.equal(Math.round((across[0] + across[1]) / 2 * 10) / 10, 1001);
	assert.ok(across[1] > across[0], "the km grow in the sense the perpendicular's km grow");
	// parallel to the Strecke nothing changes but rounding
	const along = gndGroupStations([{ easting: 0, northing: 0 }, { easting: 33, northing: 0 }], [1000, 1033]);
	assert.deepEqual(along.map((value) => Math.round(value * 10) / 10), [1000, 1033]);
	// decreasing km across the group keep their sense
	const reversed = gndGroupStations([{ easting: 0, northing: 0 }, { easting: 33, northing: 0 }], [1033, 1000]);
	assert.deepEqual(reversed.map((value) => Math.round(value * 10) / 10), [1033, 1000]);
	// a lone Knoten and mismatched input stay as they are
	assert.deepEqual(gndGroupStations([{ easting: 0, northing: 0 }], [5]), [5]);
	assert.deepEqual(gndGroupStations([{ easting: 0, northing: 0 }, { easting: 1, northing: 0 }], [5]), [5]);
});

// A leg's target: across seams of the data (Naht, Fortsetzung without
// Knoten) to the next Knoten; a Knoten of the data, a Gleisende or a
// branching node stops the walk, a loop does not run forever.
test("leg target crosses seams to the next Knoten", () => {
	const w38 = { knoten: "22532624 38", knotenTyp: 1 };
	const naht = { knoten: "Naht 5910FA 1006", knotenTyp: null };
	const naht2 = { knoten: "Naht x", knotenTyp: null };
	const w37 = { knoten: "22532624 37", knotenTyp: 1 };
	const ende = { knoten: null, knotenTyp: null };
	const e1 = { from: w38, to: naht };
	const e2 = { from: naht, to: naht2 };
	const e3 = { from: w37, to: naht2 };
	const edgesAt = new Map([[w38, [e1]], [naht, [e1, e2]], [naht2, [e2, e3]], [w37, [e3]]]);
	assert.equal(gndLegTarget(naht, e1, edgesAt), w37);
	assert.equal(gndLegTarget(w37, e3, edgesAt), w37);
	// A computed Ende (one edge) is its own target; a Fortsetzung of the data (Typ 3) too.
	assert.equal(gndLegTarget(ende, { from: w38, to: ende }, new Map([[ende, [{}]]])), ende);
	const typ3 = { knoten: "F", knotenTyp: 3 };
	assert.equal(gndLegTarget(typ3, e1, new Map([[typ3, [e1, e2]]])), typ3);
	// A seam branching into three edges is a node of its own.
	const fork = { knoten: null, knotenTyp: null };
	assert.equal(gndLegTarget(fork, e1, new Map([[fork, [e1, e2, e3]]])), fork);
	// A loop of seams ends where it started to repeat.
	const a = { knotenTyp: null };
	const b = { knotenTyp: null };
	const ab = { from: a, to: b };
	const ba = { from: b, to: a };
	const start = { from: w38, to: a };
	assert.ok([a, b].includes(gndLegTarget(a, start, new Map([[a, [start, ab]], [b, [ab, ba]]]))));
});

test("straight Stamm: EW and the halves of DKW/EKW, not in an Übergangsbogen", () => {
	assert.equal(gndStraightStamm(gndBauart("EW 49-190-1:9"), "EW 49-190-1:9"), true);
	assert.equal(gndStraightStamm(gndBauart("54-300-1:9"), "54-300-1:9"), true);
	assert.equal(gndStraightStamm(gndBauart("DKW 54-190-1:9"), "DKW 54-190-1:9"), true);
	assert.equal(gndStraightStamm(gndBauart("EKW 54-190-1:9"), "EKW 54-190-1:9"), true);
	assert.equal(gndStraightStamm(gndBauart("ABW 60-500-1:12"), "ABW 60-500-1:12"), false);
	assert.equal(gndStraightStamm(gndBauart("IBW 60-760-1:18,5-fb"), "IBW 60-760-1:18,5-fb"), false);
	assert.equal(gndStraightStamm(gndBauart("DBKW 54-500-1:9 iU"), "DBKW 54-500-1:9 iU"), false);
	assert.equal(gndStraightStamm(gndBauart("DBKW 49-500-1:9/1:12u.1:9 tlw.i.UB"), "DBKW 49-500-1:9/1:12u.1:9 tlw.i.UB"), false);
	assert.equal(gndStraightStamm(gndBauart("EW 60-1200-1:18.5 iU"), "EW 60-1200-1:18.5 iU"), false);
	assert.equal(gndStraightStamm(null, null), true);
});

test("one leg against the Zweigradius: Zweig within 25 %, Stamm beyond twice the radius", () => {
	// 25 m along, bend = length / (2 r): r 190 → 0.0658, r 500 → 0.025, straight → 0.
	const leg = (deviation, length = 25) => ({ deviation, length });
	assert.equal(gndLegByRadius(leg(0.0658), 190), "zweig");
	assert.equal(gndLegByRadius(leg(-0.0658), 190), "zweig");
	assert.equal(gndLegByRadius(leg(0.0391, 25.4), 300), "zweig"); // metroB W 2 → W 1: r 325
	assert.equal(gndLegByRadius(leg(0), 190), "stamm");
	assert.equal(gndLegByRadius(leg(0.0004, 25.2), 1200), "stamm"); // r 31 500
	assert.equal(gndLegByRadius(leg(0.025), 190), "stamm"); // r 500 > 2 · 190
	assert.equal(gndLegByRadius(leg(0.025), 300), null); // r 500: neither 300 nor straight enough
	assert.equal(gndLegByRadius(leg(0.0381, 25.2), 190), null); // Lüneburg EKW half: r 331
	assert.equal(gndLegByRadius(leg(0.0235, 26.6), 190), "stamm"); // r 566 > 380
	assert.equal(gndLegByRadius(null, 190), null);
	assert.equal(gndLegByRadius(leg(0), null), null);
});

test("the Gleis of a Gleisstrang: Streckengleis by Strecke and side, Bahnhofsgleis by number, a Verbindung none", () => {
	assert.deepEqual(json(gndStrandGleis({ STRECKE: "5501", STRRIKZ: "1" })), { key: "S 5501/1", label: "Strecke 5501 · rechts" });
	assert.deepEqual(json(gndStrandGleis({ STRECKE: "1244 ", STRRIKZ: "2" })), { key: "S 1244/2", label: "Strecke 1244 · links" });
	assert.deepEqual(json(gndStrandGleis({ STRECKE: "2631", STRRIKZ: "0" })), { key: "S 2631/0", label: "Strecke 2631 · Kilometerlinie" });
	assert.deepEqual(json(gndStrandGleis({ STRECKE: "23", STRRIKZ: "4" })), { key: "G 23", label: "Gleis 23" });
	assert.deepEqual(json(gndStrandGleis({ STRECKE: "0", STRRIKZ: "5", LIRA_GLSNR: "9038" })), { key: "G 9038", label: "Gleis 9038" });
	assert.equal(gndStrandGleis({ STRECKE: "0", STRRIKZ: "4" }), null);
	assert.equal(gndStrandGleis({ STRECKE: "", STRRIKZ: "1" }), null);
});

test("the Spitze's Gleis runs on to exactly one neighbour, or the data say nothing", () => {
	const s = { key: "S 5501/1" };
	const g0 = { key: "G 0" };
	assert.equal(gndThroughGleis([s, s, null]), 1);
	assert.equal(gndThroughGleis([s, null, s]), 2);
	assert.equal(gndThroughGleis([s, { key: "G 2" }, s]), 2);
	assert.equal(gndThroughGleis([s, s, s]), null, "both neighbours on the Gleis");
	assert.equal(gndThroughGleis([s, { key: "G 1" }, g0]), null, "neither");
	assert.equal(gndThroughGleis([null, s, s]), null, "Spitze on a Verbindung");
	assert.equal(gndThroughGleis([{ key: null, ambiguous: true }, s, null]), null, "ambiguous Spitze strand");
	assert.equal(gndThroughGleis([s, undefined, s]), 2, "a strand the file does not list");
});
