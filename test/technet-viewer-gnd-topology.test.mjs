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
new vm.Script(`${html.slice(begin, end)}\nglobalThis.api = { gndKey, gndKnotenLabel, gndStrandPortions, gndBauart, weichenRoles, GND_KNOTEN_KINDS, GND_KNOTEN_MATCH_M };`, { filename: "gnd-topology.js" }).runInContext(context);
const { gndKey, gndKnotenLabel, gndStrandPortions, gndBauart, weichenRoles, GND_KNOTEN_KINDS, GND_KNOTEN_MATCH_M } = context.api;

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
