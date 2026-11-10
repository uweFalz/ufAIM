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
new vm.Script(`${html.slice(begin, end)}\nglobalThis.api = { einordnen, einordnungUmfeld, einordnungEigene, einordnungSuchtext, einordnungAbschnitte, einordnungVarianten, einordnungUeberdeckt, VARIANTE_MIN_OVERLAP_M, VARIANTE_MIN_SHARE, EINORDNUNG_VERSION };`, { filename: "einordnung.js" }).runInContext(context);
const { einordnen, einordnungUmfeld, einordnungEigene, einordnungSuchtext, einordnungAbschnitte, einordnungVarianten, einordnungUeberdeckt, VARIANTE_MIN_OVERLAP_M, VARIANTE_MIN_SHARE, EINORDNUNG_VERSION } = context.api;
const json = (value) => JSON.parse(JSON.stringify(value));

// A fact with defaults: no references, no home, no frame.
const fact = (key, kind, extra = {}) => ({
	key, kind, name: key, file: `${key}.f`, family: { alignment: "TRA", profile: "GRA", cant: "EU", staEq: "EK" }[kind], label: kind, route: "",
	gnd: false, gndSequence: false, gndFamily: null, gndRoute: null, organized: false, hidden: false, lsys: null, hsys: null,
	frame: null, side: "unknown", range: null, refKeys: [], homeKey: null, role: "UNASSIGNED", section: "", ...extra,
});
const frame = (track, direction, source, segment = null, lsys = null) => ({ track, direction, segment, source, lsys });

test("Zugehörigkeit: the first referenced Trasse owns a Gradiente; without one it is an orphan; the pile holds Trassen and orphans", () => {
	const model = einordnen([
		fact("T1", "alignment"),
		fact("G1", "profile", { refKeys: ["T1"] }),
		fact("U1", "cant", { refKeys: ["T1"] }),
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
	// two deliveries reuse an id for different Gleise: the Gradiente belongs to the Trasse of its own file only
	const twice = einordnen([
		fact("A|T", "alignment", { file: "A.MDB" }),
		fact("B|T", "alignment", { file: "B.MDB" }),
		fact("B|G", "profile", { file: "B.MDB", refKeys: ["B|T"] }),
	]);
	assert.equal(twice.objects.get("B|G").trasse, "B|T");
	assert.deepEqual(json(twice.objects.get("A|T").dependents), []);
	assert.deepEqual(json(twice.objects.get("B|T").dependents), ["B|G"]);
	assert.deepEqual(json(twice.pile), ["A|T", "B|T"]);
	// a VermEsn pair by file stem, the TRA loaded twice: the GRA belongs to both, the first stands for it
	const paired = einordnen([fact("T#1", "alignment"), fact("T#2", "alignment"), fact("G", "profile", { refKeys: ["T#1", "T#2"] })]);
	assert.equal(paired.objects.get("G").trasse, "T#1");
	assert.deepEqual(json(paired.objects.get("T#2").dependents), ["G"]);
	assert.deepEqual(json(paired.referrers.get("T#1")), ["G"]);
});

test("Umfeld by VermEsn name: Kilometerlinie, both sides and their own Gradiente/Überhöhung; a Bahnhofsgleis stays unknown", () => {
	const named = (key, kind, side, direction, extra = {}) => fact(key, kind, { organized: side !== "unknown", side, frame: frame("5500", direction, "vermesn-name", "074-082", "CR0"), lsys: "CR0", ...extra });
	const facts = [
		named("S", "alignment", "kilometer", "Kilometerlinie", { range: { from: 73860, to: 82361 } }),
		named("R", "alignment", "right", "rechts", { range: { from: 73900, to: 82300 } }),
		named("RG", "profile", "right", "rechts", { refKeys: ["R"], hsys: "NHN" }),
		named("RU", "cant", "right", "rechts", { refKeys: ["R"] }),
		named("L", "alignment", "left", "links", { range: { from: 73900, to: 82300 } }),
		named("LG", "profile", "left", "links", { refKeys: ["L"] }),
		named("EK", "staEq", "kilometer", "Kilometerlinie", { refKeys: ["S"] }),
		named("Gls404", "alignment", "unknown", "Bahnhofsgleis 404", { organized: false }),
	];
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
		fact("W", "alignment", { side: "unknown" }),
		fact("WG", "profile", { refKeys: ["W"] }),
		fact("X", "alignment", { side: "unknown" }),
	];
	const model = einordnen(facts);
	const umfeld = einordnungUmfeld(model, "WG");
	assert.equal(umfeld.anchor, "W");
	assert.deepEqual(json(umfeld.keys), ["W", "WG"]);
	assert.equal(umfeld.referenceRequired, false, "no Streckennummer, no Kilometerlinie demanded");
	// SCx: two Gegenrichtungsgleise on the left, each with its own Gradiente
	const two = einordnen([
		fact("K", "alignment", { organized: true, side: "kilometer", frame: frame("1720", "Kilometerlinie", "landXML-7L") }),
		fact("L1", "alignment", { organized: true, side: "left", frame: frame("1720", "links", "landXML-7L"), range: { from: 210700, to: 223100 }, refKeys: ["K"] }),
		fact("L2", "alignment", { organized: true, side: "left", frame: frame("1720", "links", "landXML-7L"), range: { from: 228600, to: 273000 }, refKeys: ["K"] }),
		fact("G1", "profile", { organized: true, side: "left", refKeys: ["L1"] }),
		fact("G2", "profile", { organized: true, side: "left", refKeys: ["L2"] }),
	]);
	assert.deepEqual(json(einordnungUmfeld(two, "L1").segments("left")), [
		{ key: "L1", range: { from: 210700, to: 223100 }, profile: "G1", cant: null },
		{ key: "L2", range: { from: 228600, to: 273000 }, profile: "G2", cant: null },
	], "no first-of-kind fallback with two alignments on a side");
	assert.equal(einordnungUmfeld(two, "L1").referenceRequired, false, "landXML with one Gegenrichtungsgleis only: no two-track demand");
	assert.deepEqual(json(einordnungUmfeld(two, "G2").keys), ["L2", "K", "L1", "G1", "G2"], "one Gleis shows the whole 7L: the walk starts at the Kilometerlinie it references");
	assert.equal(einordnungUmfeld(two, "G2").anchor, "L2");
	// an object that references nothing falls back to the first Trasse of its file
	const lone = einordnen([fact("T", "alignment"), fact("E", "staEq", { homeKey: "T" })]);
	assert.equal(einordnungUmfeld(lone, "E").anchor, "T");
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

test("Abschnitte: explicit ids bundle, the rest chains in km order with a 5 m seam, objects without a range come last", () => {
	const members = [
		{ key: "b", section: "", range: { from: 1000, to: 2000 } },
		{ key: "x", section: "A1", range: { from: 0, to: 500 } },
		{ key: "a", section: "", range: { from: 0, to: 996 } },
		{ key: "c", section: "", range: { from: 2006, to: 3000 } },
		{ key: "y", section: "A1", range: { from: 400, to: 900 } },
		{ key: "n", section: "", range: null },
		{ key: "z", section: "A2", range: null },
	];
	assert.deepEqual(json(einordnungAbschnitte(members)), [
		{ sectionId: "A1", keys: ["x", "y"], range: { from: 0, to: 900 } },
		{ sectionId: "A2", keys: ["z"], range: null },
		{ sectionId: "", keys: ["a", "b"], range: { from: 0, to: 2000 } },
		{ sectionId: "", keys: ["c"], range: { from: 2006, to: 3000 } },
		{ sectionId: "", keys: ["n"], range: null },
	], "a (to 996) and b (from 1000) share a seam within 5 m; c starts 6 m behind b");
	assert.deepEqual(json(einordnungAbschnitte([])), []);
});

test("Ordnung: a Strecke lists the Abschnitte of each Lage, each with its Spuren; the pile is not in it", () => {
	const organized = (key, kind, role, side, range, extra = {}) => fact(key, kind, { organized: true, role, side, range, frame: frame("2631", "x", "gnd", null, "CR0"), lsys: "CR0", ...extra });
	const model = einordnen([
		organized("K", "alignment", "curvatureKilometer", "kilometer", { from: 139000, to: 142000 }),
		organized("R", "alignment", "curvatureRight", "right", { from: 139100, to: 141900 }),
		organized("RG", "profile", "gradientRight", "right", { from: 139100, to: 141900 }),
		organized("R2", "alignment", "curvatureRight", "right", { from: 148000, to: 150000 }),
		organized("D", "alignment", "curvatureRight", "right", { from: 139100, to: 141900 }, { lsys: "DR0", frame: frame("2631", "x", "gnd", null, "DR0") }),
		fact("naked", "alignment"),
		organized("other", "alignment", "curvatureLeft", "left", null, { frame: frame("Bf Auw", "links", "user") , lsys: null }),
	]);
	assert.deepEqual(json([...model.strecken.keys()]), ["2631", "Bf Auw"]);
	const strecke = model.strecken.get("2631");
	assert.deepEqual(json(strecke.abschnitte), [
		{ sectionId: "", keys: ["K", "R", "RG"], range: { from: 139000, to: 142000 }, lsys: "CR0", spuren: { curvatureKilometer: ["K"], curvatureRight: ["R"], gradientRight: ["RG"] } },
		{ sectionId: "", keys: ["R2"], range: { from: 148000, to: 150000 }, lsys: "CR0", spuren: { curvatureRight: ["R2"] } },
		{ sectionId: "", keys: ["D"], range: { from: 139100, to: 141900 }, lsys: "DR0", spuren: { curvatureRight: ["D"] } },
	], "two Abschnitte in CR0, then the DR0 Rahmen of the same Strecke");
	assert.deepEqual(json(strecke.sides.right), ["R", "RG", "R2", "D"]);
	assert.deepEqual(json(model.strecken.get("Bf Auw").abschnitte), [{ sectionId: "", keys: ["other"], range: null, lsys: "LSYS?", spuren: { curvatureLeft: ["other"] } }]);
	assert.deepEqual(json(model.pile), ["naked"]);
});

test("Überdeckung: a seam is no Variante, a shared stretch is", () => {
	assert.equal(VARIANTE_MIN_OVERLAP_M, 20);
	assert.equal(VARIANTE_MIN_SHARE, 0.2);
	const r = (from, to) => ({ from, to });
	assert.equal(einordnungUeberdeckt(r(0, 1000), r(1000, 2000)), false, "pieces that meet");
	assert.equal(einordnungUeberdeckt(r(0, 1000), r(990, 2000)), false, "a 10 m lap at a Weiche");
	assert.equal(einordnungUeberdeckt(r(0, 10000), r(9900, 20000)), false, "100 m of two 10 km pieces is under a fifth of the shorter");
	assert.equal(einordnungUeberdeckt(r(139237, 150517), r(139237, 142044)), true, "Bestand and Neuplanung");
	assert.equal(einordnungUeberdeckt(r(0, 80), r(0, 88)), true, "two short Gleise over the same stations");
	assert.equal(einordnungUeberdeckt(r(0, 100), null), false);
});

test("Varianten: the selected Trasse stands, else the longest; what it covers stands back, the rest stays", () => {
	const t = (key, from, to) => ({ key, range: { from, to } });
	const bestand = t("Bestand", 139237, 150517);
	const n139 = t("N139", 139237, 142044);
	const n142 = t("N142", 142300, 143400);
	const mit = t("mitWeg", 147700, 148700);
	const ohne = t("ohneWeg", 147700, 148700);
	const side = [bestand, n139, n142, mit, ohne];
	assert.deepEqual(json(einordnungVarianten(side, null)), { shown: ["Bestand"], hidden: [{ key: "N139", wegen: "Bestand" }, { key: "N142", wegen: "Bestand" }, { key: "mitWeg", wegen: "Bestand" }, { key: "ohneWeg", wegen: "Bestand" }] });
	assert.deepEqual(json(einordnungVarianten(side, "N142")), { shown: ["N139", "N142", "mitWeg"], hidden: [{ key: "Bestand", wegen: "N142" }, { key: "ohneWeg", wegen: "mitWeg" }] }, "the Neuplanung chain without the Bestand; of two equal ones the first delivered");
	assert.deepEqual(json(einordnungVarianten([t("L1", 210700, 223100), t("L2", 228600, 273000)], "L2")), { shown: ["L1", "L2"], hidden: [] }, "consecutive pieces are no Varianten");
	assert.deepEqual(json(einordnungVarianten([{ key: "a", range: null }, { key: "b", range: null }], null)), { shown: ["a", "b"], hidden: [] }, "without a range nothing is known to overlap");
	const on = (key, track) => ({ key, range: { from: 0, to: 1500 }, frame: { track } });
	assert.deepEqual(json(einordnungVarianten([on("km3300", "3300"), on("km3302", "3302")], null)), { shown: ["km3300", "km3302"], hidden: [] }, "Trassen of two Strecken are no Varianten, whatever their km");
	assert.deepEqual(json(einordnungVarianten([on("a", "3300"), on("b", "3300")], "b")), { shown: ["b"], hidden: [{ key: "a", wegen: "b" }] });
});

test("Umfeld with Varianten: the hidden Trasse takes its own Gradiente along; each copy of a doubled delivery keeps its own", () => {
	const f = (key, kind, extra = {}) => fact(key, kind, { organized: true, side: "right", frame: frame("2631", "rechts", "vermesn-name", "139", "CR0"), lsys: "CR0", ...extra });
	const facts = [
		f("K", "alignment", { side: "kilometer", range: { from: 139237, to: 150517 } }),
		f("B", "alignment", { range: { from: 139237, to: 150517 } }),
		f("BG", "profile", { refKeys: ["B"] }),
		f("N", "alignment", { range: { from: 139237, to: 142044 } }),
		f("NG", "profile", { refKeys: ["N"] }),
	];
	const model = einordnen(facts);
	const forBestand = einordnungUmfeld(model, "B");
	assert.deepEqual(json(forBestand.bySide.right), ["B", "BG"]);
	assert.deepEqual(json(forBestand.varianten), [{ key: "N", wegen: "B", side: "right" }]);
	assert.deepEqual(json(forBestand.segments("right")), [{ key: "B", range: { from: 139237, to: 150517 }, profile: "BG", cant: null }]);
	assert.ok(forBestand.keys.includes("N"), "the Variante is still linked, only not in the picture");
	const forNeu = einordnungUmfeld(model, "NG");
	assert.deepEqual(json(forNeu.bySide.right), ["N", "NG"], "selecting the Neuplanung's Gradiente shows the Neuplanung");
	assert.deepEqual(json(forNeu.varianten), [{ key: "B", wegen: "N", side: "right" }]);
	assert.deepEqual(json(einordnungUmfeld(model, "K").bySide.right), ["B", "BG"], "from the Kilometerlinie the longest stands");
	// one Gleis in two deliveries: each copy with the Gradiente of its own file
	const doubled = einordnen([
		f("A|T", "alignment", { range: { from: 0, to: 5000 } }),
		f("A|G", "profile", { refKeys: ["A|T"] }),
		f("B|T", "alignment", { range: { from: 0, to: 5000 } }),
		f("B|G", "profile", { refKeys: ["B|T"] }),
	]);
	assert.deepEqual(json(einordnungUmfeld(doubled, "A|T").bySide.right), ["A|T", "A|G"]);
	assert.deepEqual(json(einordnungUmfeld(doubled, "A|T").varianten), [{ key: "B|T", wegen: "A|T", side: "right" }]);
	assert.deepEqual(json(einordnungUmfeld(doubled, "B|T").bySide.right), ["B|T", "B|G"]);
	assert.deepEqual(json(einordnungUmfeld(doubled, "B|T").segments("right")), [{ key: "B|T", range: { from: 0, to: 5000 }, profile: "B|G", cant: null }]);
	// a Gradiente both copies reference (VermEsn pair, TRA loaded twice) stays with the copy shown
	const shared = einordnen([f("T#1", "alignment", { range: { from: 0, to: 900 } }), f("T#2", "alignment", { range: { from: 0, to: 900 } }), f("G", "profile", { refKeys: ["T#1", "T#2"] })]);
	assert.deepEqual(json(einordnungUmfeld(shared, "T#2").bySide.right), ["T#2", "G"]);
	// Gleise without a side are not Varianten of each other
	const station = (key, to) => fact(key, "alignment", { range: { from: 0, to }, frame: frame("5500", "Bahnhofsgleis", "vermesn-name", "074-082", "CR0"), lsys: "CR0" });
	const unknown = einordnen([station("G1", 80), station("G2", 88)]);
	assert.deepEqual(json(einordnungUmfeld(unknown, "G1").varianten), []);
	assert.deepEqual(json(einordnungUmfeld(unknown, "G1").bySide.unknown), ["G1", "G2"]);
});
