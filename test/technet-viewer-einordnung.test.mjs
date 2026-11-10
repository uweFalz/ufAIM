// The Viewer's Einordnung: from facts per object (raw data plus the
// decisions on them) to the model of the Bahn -- who owns what, where it
// lies, what shares the picture with it, and what is still on the pile.
// The block between the two markers in technetViewer.html is pure (no
// DOM), so it runs here as it is.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = await fs.readFile(new URL("technetViewer.html", root), "utf8");
const begin = html.indexOf("// BEGIN EINORDNUNG");
const end = html.indexOf("// END EINORDNUNG");
assert.ok(begin > 0 && end > begin, "Einordnung block present");
const context = vm.createContext({});
new vm.Script(`${html.slice(begin, end)}\nglobalThis.api = { einordnen, einordnungUmfeld, einordnungEigene, einordnungSuchtext, EINORDNUNG_VERSION };`, { filename: "einordnung.js" }).runInContext(context);
const { einordnen, einordnungUmfeld, einordnungEigene, einordnungSuchtext, EINORDNUNG_VERSION } = context.api;
const json = (value) => JSON.parse(JSON.stringify(value));

// A fact with defaults; `linked` defaults to itself, as relatedDiagramEntries gives for a lone object.
const fact = (key, kind, extra = {}) => ({
	key, kind, name: key, file: `${key}.f`, family: { alignment: "TRA", profile: "GRA", cant: "EU", staEq: "EK" }[kind], label: kind, route: "",
	gnd: false, gndSequence: false, gndFamily: null, gndRoute: null, organized: false, hidden: false, lsys: null, hsys: null,
	frame: null, side: "unknown", range: null, id: key, refIds: [], linked: [key], anchorKey: key, ...extra,
});
const frame = (track, direction, source, segment = null, lsys = null) => ({ track, direction, segment, source, lsys });

test("Zugehörigkeit: the first referenced Trasse owns a Gradiente; without one it is an orphan; the pile holds Trassen and orphans", () => {
	const model = einordnen([
		fact("T1", "alignment"),
		fact("G1", "profile", { refIds: ["T1"], linked: ["T1", "G1"], anchorKey: "T1" }),
		fact("U1", "cant", { refIds: ["T1"], linked: ["T1", "U1"], anchorKey: "T1" }),
		fact("G2", "profile"),
		fact("T2", "alignment", { organized: true, frame: frame("5500", "rechts", "vermesn-name", "074-082"), side: "right" }),
	]);
	assert.equal(model.version, EINORDNUNG_VERSION);
	assert.equal(model.objects.get("G1").trasse, "T1");
	assert.deepEqual(json(model.objects.get("T1").dependents), ["G1", "U1"]);
	assert.equal(model.objects.get("G2").orphan, true);
	assert.deepEqual(json(model.pile), ["T1", "G2"], "dependents go with their Trasse, organized objects are right");
	assert.deepEqual(json([...model.strecken.keys()]), ["5500"]);
	assert.deepEqual(json(model.strecken.get("5500").sides.right), ["T2"]);
	assert.deepEqual(json(einordnungEigene(model, "T1")), ["G1", "U1"]);
	// GND repeats ids across files: a Gradiente belongs to every Trasse of that id, the first stands for it
	const twice = einordnen([
		fact("A|T", "alignment", { id: "T", file: "A.MDB" }),
		fact("B|T", "alignment", { id: "T", file: "B.MDB" }),
		fact("B|G", "profile", { id: "G", file: "B.MDB", refIds: ["T"] }),
	]);
	assert.equal(twice.objects.get("B|G").trasse, "A|T");
	assert.deepEqual(json(twice.objects.get("A|T").dependents), ["B|G"]);
	assert.deepEqual(json(twice.objects.get("B|T").dependents), ["B|G"]);
	assert.deepEqual(json(twice.pile), ["A|T", "B|T"]);
});

test("Umfeld by VermEsn name: Kilometerlinie, both sides and their own Gradiente/Überhöhung; a Bahnhofsgleis stays unknown", () => {
	const named = (key, kind, side, direction, extra = {}) => fact(key, kind, { organized: side !== "unknown", side, frame: frame("5500", direction, "vermesn-name", "074-082", "CR0"), lsys: "CR0", ...extra });
	const facts = [
		named("S", "alignment", "kilometer", "Kilometerlinie", { range: { from: 73860, to: 82361 } }),
		named("R", "alignment", "right", "rechts", { range: { from: 73900, to: 82300 } }),
		named("RG", "profile", "right", "rechts", { refIds: ["R"], linked: ["R", "RG"], anchorKey: "R", hsys: "NHN" }),
		named("RU", "cant", "right", "rechts", { refIds: ["R"], linked: ["R", "RU"], anchorKey: "R" }),
		named("L", "alignment", "left", "links", { range: { from: 73900, to: 82300 } }),
		named("LG", "profile", "left", "links", { refIds: ["L"], linked: ["L", "LG"], anchorKey: "L" }),
		named("EK", "staEq", "kilometer", "Kilometerlinie", { refIds: ["S"], linked: ["S", "EK"], anchorKey: "S" }),
		named("Gls404", "alignment", "unknown", "Bahnhofsgleis 404", { organized: false }),
	];
	facts.find((f) => f.key === "R").linked = ["R", "RG", "RU"];
	facts.find((f) => f.key === "L").linked = ["L", "LG"];
	facts.find((f) => f.key === "S").linked = ["S", "EK"];
	const model = einordnen(facts);
	const umfeld = einordnungUmfeld(model, "R");
	assert.equal(umfeld.anchor, "R");
	assert.deepEqual(json(umfeld.bySide), { kilometer: ["S", "EK"], right: ["R", "RG", "RU"], left: ["L", "LG"], unknown: ["Gls404"] });
	assert.equal(umfeld.kmAlignment, "S");
	assert.equal(umfeld.equations, "EK");
	assert.equal(umfeld.rightPresent, true);
	assert.equal(umfeld.leftPresent, true);
	assert.equal(umfeld.hasUnknown, true, "the Bahnhofsgleis shares the Strecke name and sits in unknown");
	assert.equal(umfeld.referenceRequired, true, "two tracks under a Streckennummer need the Kilometerlinie");
	assert.equal(umfeld.missingKilometerLine, false);
	assert.deepEqual(json(umfeld.segments("right")), [{ key: "R", range: { from: 73900, to: 82300 }, profile: "RG", cant: "RU" }]);
	assert.deepEqual(json(umfeld.segments("left")), [{ key: "L", range: { from: 73900, to: 82300 }, profile: "LG", cant: null }]);
	assert.deepEqual(json(model.pile), ["Gls404"]);
	// a different Abschnitt of the same Strecke stays out, a file without Abschnitt joins
	const other = einordnen([...facts, named("R2", "alignment", "right", "rechts", { frame: frame("5500", "rechts", "vermesn-name", "083-090", "CR0"), range: { from: 83000, to: 90000 } }), named("S0", "alignment", "kilometer", "Kilometerlinie", { frame: frame("5500", "Kilometerlinie", "vermesn-name", null, "CR0") })]);
	const wider = einordnungUmfeld(other, "R");
	assert.ok(!wider.keys.includes("R2"), "Abschnitt 083-090 is not in the picture of 074-082");
	assert.ok(wider.keys.includes("S0"), "a file without Abschnitt joins every Abschnitt");
});

test("Umfeld by GND: same Strecke only with the same Lage and an overlapping km range", () => {
	const gnd = (key, kind, side, extra = {}) => fact(key, kind, { gnd: true, gndSequence: true, gndFamily: kind === "alignment" ? "EL" : "EH", organized: true, side, frame: frame("1720", side === "right" ? "rechts" : "links", "gnd", null, "CR0"), lsys: "CR0", ...extra });
	const facts = [
		gnd("A", "alignment", "right", { gndRoute: "1", range: { from: 211000, to: 223000 } }),
		gnd("B", "alignment", "left", { gndRoute: "2", range: { from: 212000, to: 222000 } }),
		gnd("C", "alignment", "left", { gndRoute: "2", range: { from: 228600, to: 273000 } }),
		gnd("D", "alignment", "right", { gndRoute: "1", range: { from: 215000, to: 220000 }, lsys: "DR0", frame: frame("1720", "rechts", "gnd", null, "DR0") }),
	];
	const model = einordnen(facts);
	const umfeld = einordnungUmfeld(model, "A");
	assert.deepEqual(json(umfeld.keys), ["A", "B"], "C lies beyond the range, D in another Lage");
	assert.equal(umfeld.referenceRequired, true, "GND Streckengleise need their Kilometerlinie");
	assert.equal(umfeld.missingKilometerLine, true);
	assert.equal(umfeld.kmAlignment, null);
});

test("a singleton (Weiche without Strecke) shows only its own relations; two alignments on one side pair by their own references", () => {
	const facts = [
		fact("W", "alignment", { linked: ["W", "WG"], side: "unknown" }),
		fact("WG", "profile", { refIds: ["W"], linked: ["W", "WG"], anchorKey: "W" }),
		fact("X", "alignment", { side: "unknown" }),
	];
	const model = einordnen(facts);
	const umfeld = einordnungUmfeld(model, "WG");
	assert.equal(umfeld.anchor, "W");
	assert.deepEqual(json(umfeld.keys), ["W", "WG"]);
	assert.equal(umfeld.referenceRequired, false, "no Streckennummer, no Kilometerlinie demanded");
	// SCx: two Gegenrichtungsgleise on the left, each with its own Gradiente
	const two = einordnen([
		fact("K", "alignment", { organized: true, side: "kilometer", frame: frame("1720", "Kilometerlinie", "landXML-7L"), linked: ["K", "L1", "L2", "G1", "G2"] }),
		fact("L1", "alignment", { organized: true, side: "left", frame: frame("1720", "links", "landXML-7L"), range: { from: 210700, to: 223100 }, refIds: ["K"], linked: ["K", "L1", "L2", "G1", "G2"], anchorKey: "L1" }),
		fact("L2", "alignment", { organized: true, side: "left", frame: frame("1720", "links", "landXML-7L"), range: { from: 228600, to: 273000 }, refIds: ["K"], linked: ["K", "L1", "L2", "G1", "G2"], anchorKey: "L2" }),
		fact("G1", "profile", { organized: true, side: "left", refIds: ["L1"], linked: ["K", "L1", "L2", "G1", "G2"], anchorKey: "L1" }),
		fact("G2", "profile", { organized: true, side: "left", refIds: ["L2"], linked: ["K", "L1", "L2", "G1", "G2"], anchorKey: "L2" }),
	]);
	assert.deepEqual(json(einordnungUmfeld(two, "L1").segments("left")), [
		{ key: "L1", range: { from: 210700, to: 223100 }, profile: "G1", cant: null },
		{ key: "L2", range: { from: 228600, to: 273000 }, profile: "G2", cant: null },
	], "no first-of-kind fallback with two alignments on a side");
	assert.equal(einordnungUmfeld(two, "L1").referenceRequired, false, "landXML with one Gegenrichtungsgleis only: no two-track demand");
});

test("Suchtext carries the states as words", () => {
	const placed = { kind: "alignment", name: "Gls404", file: "Gls404.TRA", family: "TRA", label: "Trasse", lsys: null, hsys: null, frame: frame("5500", "rechts", "vermesn-name"), route: "5500", hidden: true };
	const text = einordnungSuchtext(placed);
	assert.match(text, /ohne lage/);
	assert.match(text, /ausgeblendet/);
	assert.match(text, /strecke 5500/);
	assert.doesNotMatch(text, /sichtbar/);
	assert.match(einordnungSuchtext({ ...placed, lsys: "CR0", hidden: false }), /sichtbar/);
	assert.match(einordnungSuchtext({ kind: "profile", name: "G", file: "", family: "GRA", label: "Gradiente", hsys: null, hidden: false }), /ohne höhe/);
});
