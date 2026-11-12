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
new vm.Script(`${html.slice(begin, end)}\nglobalThis.api = { einordnungNebenArt, NEBEN_AUF_M, NEBEN_MIN_ANTEIL, NEBEN_MIN_TREFFER, einordnungStreckeAusName, einordnungBuendelVorschlag, einordnen, einordnungUmfeld, einordnungEigene, einordnungSuchtext, einordnungAbschnitte, einordnungVarianten, einordnungUeberdeckt, einordnungBezuege, einordnungVerbund, einordnungDateischluessel, einordnungBezugslinie, einordnungLaengentreu, einordnungNamensteile, einordnungGradientenVorschlag, einordnungBuendel, BUENDEL_REICHWEITE_M, BUENDEL_ANTEIL, BEZUGSLINIE_MIN_LAENGENTREUE, VARIANTE_MIN_OVERLAP_M, VARIANTE_MIN_SHARE, EINORDNUNG_VERSION };`, { filename: "einordnung.js" }).runInContext(context);
const { einordnungNebenArt, NEBEN_AUF_M, NEBEN_MIN_ANTEIL, NEBEN_MIN_TREFFER, einordnungStreckeAusName, einordnungBuendelVorschlag, einordnen, einordnungUmfeld, einordnungEigene, einordnungSuchtext, einordnungAbschnitte, einordnungVarianten, einordnungUeberdeckt, einordnungBezuege, einordnungVerbund, einordnungDateischluessel, einordnungBezugslinie, einordnungLaengentreu, einordnungNamensteile, einordnungGradientenVorschlag, einordnungBuendel, BUENDEL_REICHWEITE_M, BUENDEL_ANTEIL, BEZUGSLINIE_MIN_LAENGENTREUE, VARIANTE_MIN_OVERLAP_M, VARIANTE_MIN_SHARE, EINORDNUNG_VERSION } = context.api;
const json = (value) => JSON.parse(JSON.stringify(value));

// A fact with defaults: no references, no home, no frame.
const fact = (key, kind, extra = {}) => ({
	key, kind, name: key, file: `${key}.f`, family: { alignment: "TRA", profile: "GRA", cant: "EU", staEq: "EK" }[kind], label: kind, route: "",
	gnd: false, gndSequence: false, gndFamily: null, gndRoute: null, organized: false, hidden: false, lsys: null, hsys: null,
	frame: null, side: "unknown", range: null, refKeys: [], homeKey: null, role: "UNASSIGNED", section: "", kmFrame: false, ...extra,
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

test("Bezüge allein: the Verbund needs only kind and references, and is the same in the full model", () => {
	const nodes = [
		{ key: "K", kind: "alignment", refKeys: [], homeKey: "K" },
		{ key: "L", kind: "alignment", refKeys: ["K"], homeKey: "K" },
		{ key: "R", kind: "alignment", refKeys: ["K"], homeKey: "K" },
		{ key: "LG", kind: "profile", refKeys: ["L"], homeKey: "K" },
		{ key: "EK", kind: "staEq", refKeys: [], homeKey: "K" },
		{ key: "other", kind: "alignment", refKeys: [], homeKey: "other" },
		{ key: "otherG", kind: "profile", refKeys: ["other"], homeKey: "other" },
	];
	const bezuege = einordnungBezuege(nodes);
	assert.deepEqual(json(bezuege.referrers.get("K")), ["L", "R"]);
	assert.deepEqual(json(bezuege.referrers.get("L")), ["LG"]);
	assert.equal(bezuege.referrers.get("LG"), undefined);
	const verbund = einordnungVerbund(bezuege, "LG");
	assert.equal(verbund.anchor.key, "L");
	assert.deepEqual(json(verbund.keys), ["K", "L", "R", "LG"], "the whole 7L from one Gradiente, nothing of the other file");
	assert.equal(einordnungVerbund(bezuege, "EK").anchor.key, "K", "no reference: the first Trasse of its file");
	assert.deepEqual(json(einordnungVerbund(bezuege, "otherG").keys), ["other", "otherG"]);
	assert.deepEqual(json(einordnungEigene(bezuege, "other")), ["otherG"]);
	// a reference to something that is not there is ignored
	const dangling = einordnungBezuege([{ key: "G", kind: "profile", refKeys: ["gone"], homeKey: null }]);
	assert.equal(einordnungVerbund(dangling, "G").anchor.key, "G");
	assert.deepEqual(json(einordnungVerbund(dangling, "G").keys), ["G"]);
	// the full model answers the same
	const full = einordnen(nodes.map((node) => fact(node.key, node.kind, { refKeys: node.refKeys, homeKey: node.homeKey })));
	assert.deepEqual(json(einordnungVerbund(full, "LG").keys), json(verbund.keys));
	assert.deepEqual(json([...full.referrers.entries()]), json([...bezuege.referrers.entries()]));
});

test("Dateischlüssel: the first file keeps its name, later files of that name get their turn", () => {
	const loaded = [];
	const keys = ["6100_246-289.MDB", "5500R.TRA", "6100_246-289.MDB", "6100_246-289.MDB", "5500R.GRA"].map((name) => {
		const key = einordnungDateischluessel(name, loaded);
		loaded.push(name);
		return key;
	});
	assert.deepEqual(keys, ["6100_246-289.MDB", "5500R.TRA", "6100_246-289.MDB (2)", "6100_246-289.MDB (3)", "5500R.GRA"]);
	assert.equal(new Set(keys).size, keys.length);
	assert.equal(einordnungDateischluessel("x.tra", ["X.TRA"]), "x.tra", "names are compared as they are delivered");
});

test("Bezugslinie: only a line both ends lie on; then the one that holds the Gradiente, then the nearest, then the first offered", () => {
	const line = (key, distanceStart, distanceEnd, holdsProfile = false) => ({ key, distanceStart, distanceEnd, holdsProfile });
	// metroB 5904_R_R00 against the first Kilometerlinie that happened to be loaded: 3 and 13 km off
	assert.equal(einordnungBezugslinie([line("5904S", 3216.2, 13021.6)], 60), null, "the Strecke in the name is no proof of the Lage");
	assert.equal(einordnungBezugslinie([line("5904S", 3216.2, 13021.6), line("5904_S_R00", 2.1, 4.4)], 60), "5904_S_R00");
	// Landshut W403-404 between two Strecken: 5632 is nearer, 5500 holds the Gradiente
	assert.equal(einordnungBezugslinie([line("5632S", 3, 5), line("5500S", 20, 31, true)], 60), "5500S");
	assert.equal(einordnungBezugslinie([line("5632S", 3, 5), line("5500S", 20, 31)], 60), "5632S", "without a Gradiente the nearer line");
	assert.equal(einordnungBezugslinie([line("long", 0, 0), line("short", 0, 0)], 60), "long", "a tie goes to the first offered, the longest");
	assert.equal(einordnungBezugslinie([line("oneEnd", 2, 400)], 60), null, "one end on the line is not lying along it");
	assert.equal(einordnungBezugslinie([line("unmeasured", NaN, NaN), line("gap", 5, undefined)], 60), null, "what could not be measured does not qualify");
	assert.equal(einordnungBezugslinie([line("edge", 60, 60)], 60), "edge");
	assert.equal(einordnungBezugslinie([], 60), null);
});

test("Längentreue: a projection that collapses the Gleis is none", () => {
	assert.equal(BEZUGSLINIE_MIN_LAENGENTREUE, 0.5);
	assert.equal(einordnungLaengentreu(10000, 0), false, "10 km clamped onto km 67,5");
	assert.equal(einordnungLaengentreu(10000, 10000), true);
	assert.equal(einordnungLaengentreu(8500, -8497), true, "a Gleis stationed against the line");
	assert.equal(einordnungLaengentreu(2000, 1100), true);
	assert.equal(einordnungLaengentreu(2000, 900), false);
	assert.equal(einordnungLaengentreu(0, 0), true, "nothing to keep");
});

test("Umfeld in km: where both are stationed in the Strecke's km, the km decide, not the Abschnitt in the name", () => {
	const f = (key, kind, side, segment, range, extra = {}) => fact(key, kind, { organized: side !== "unknown", side, range, kmFrame: true, frame: frame("2631", side, "vermesn-name", segment, "CR0"), lsys: "CR0", ...extra });
	// Eifel: one Kilometerlinie named 139 through all of it, Neuplanungen named after their start km
	const eifel = einordnen([
		f("K139", "alignment", "kilometer", "139", { from: 139237, to: 150517 }),
		f("R139", "alignment", "right", "139", { from: 139237, to: 150517 }),
		f("R142", "alignment", "right", "142", { from: 141929, to: 145245 }),
		f("R142G", "profile", "right", "142", { from: 141950, to: 145200 }, { refKeys: ["R142"], kmFrame: false }),
		f("R148", "alignment", "right", "148", { from: 147510, to: 150517 }),
	]);
	const picture = einordnungUmfeld(eifel, "R142");
	assert.deepEqual(json(picture.bySide.kilometer), ["K139"], "the Kilometerlinie is in the picture though the names say 142 and 139");
	assert.deepEqual(json(picture.bySide.right), ["R142", "R142G"]);
	assert.deepEqual(json(picture.varianten), [{ key: "R139", wegen: "R142", side: "right" }], "the Bestand stands back as the Variante it is");
	assert.ok(!picture.keys.includes("R148"), "another km, another picture");
	assert.equal(einordnungUmfeld(eifel, "R142G").kmAlignment, "K139", "a Gradiente is placed by its Trasse");
	assert.deepEqual(json(einordnungUmfeld(eifel, "R139").varianten.map((item) => item.key)), ["R142", "R148"]);
	// metroB: names without an Abschnitt used to join every picture of their Strecke
	const metro = einordnen([
		f("5904067S", "alignment", "kilometer", "067", { from: 67400, to: 72154 }, { frame: frame("5904", "kilometer", "vermesn-name", "067", "ER0"), lsys: "ER0" }),
		f("5904067R", "alignment", "right", "067", { from: 67400, to: 72154 }, { frame: frame("5904", "right", "vermesn-name", "067", "ER0"), lsys: "ER0" }),
		f("5904L", "alignment", "left", null, { from: 65500, to: 67399 }, { frame: frame("5904", "left", "vermesn-name", null, "ER0"), lsys: "ER0" }),
		f("5904_S_R00", "alignment", "kilometer", null, { from: 72000, to: 82000 }, { frame: frame("5904", "kilometer", "vermesn-name", null, "ER0"), lsys: "ER0" }),
	]);
	const metroPicture = einordnungUmfeld(metro, "5904067R");
	assert.ok(!metroPicture.keys.includes("5904L"), "km 65,5-67,4 does not meet km 67,4-72,2");
	assert.ok(metroPicture.keys.includes("5904_S_R00"), "the next Abschnitt laps 154 m: its stub is in the picture");
	assert.equal(metroPicture.leftPresent, false);
	// without stations in km on one side the name decides, as before
	const local = einordnen([
		f("S", "alignment", "kilometer", "074-082", { from: 73860, to: 82361 }, { frame: frame("5500", "kilometer", "vermesn-name", "074-082", "CR0") }),
		f("G", "alignment", "unknown", "074-082", { from: 0, to: 800 }, { kmFrame: false, organized: false, frame: frame("5500", "Bahnhofsgleis", "vermesn-name", "074-082", "CR0") }),
		f("other", "alignment", "unknown", "083-090", { from: 0, to: 700 }, { kmFrame: false, organized: false, frame: frame("5500", "Bahnhofsgleis", "vermesn-name", "083-090", "CR0") }),
	]);
	assert.deepEqual(json(einordnungUmfeld(local, "G").keys), ["G", "S"]);
});

test("Namensteile: system, stationing, date and revision are not what a Gleis is called; the side is read from the name", () => {
	assert.deepEqual(json(einordnungNamensteile("5904080R_O00_lokal.GRA")), { stem: "5904080r_o00_lokal", kern: ["5904080r"], side: "r" });
	assert.deepEqual(json(einordnungNamensteile("5904080R_ER0.TRA")), { stem: "5904080r_er0", kern: ["5904080r"], side: "r" });
	assert.deepEqual(json(einordnungNamensteile("3250_4-11_L_O00_260402.GRA").kern), ["3250", "4", "11", "l"]);
	assert.equal(einordnungNamensteile("3250_4-11_L_CR0_260402.TRA").side, "l");
	assert.equal(einordnungNamensteile("AIT_5904S_b.Tra").side, "s");
	assert.equal(einordnungNamensteile("2631K139_Bestand_VR_DBREF03.TRA").side, "s", "K is the Kilometerlinie");
	assert.equal(einordnungNamensteile("5500R074-082.GRA").side, "r");
	assert.equal(einordnungNamensteile("5500S074-082_Gls404.TRA").side, "s");
	assert.equal(einordnungNamensteile("1280_043-049_DBREF2016_RE.TRA").side, "r");
	assert.equal(einordnungNamensteile("6100_236-246_DBREF2016_KM.TRA").side, "s");
	assert.equal(einordnungNamensteile("Gleis_3_Bf_Freihöls_O00.GRA").side, null);
	assert.deepEqual(json(einordnungNamensteile("AIT_RöWV203_204_GlStat_b.Gra").kern), ["ait", "röwv203", "204"]);
	assert.deepEqual(json(einordnungNamensteile("folder/sub/ALBG_Gl302_DHHN92.GRA").kern), ["albg", "gl302"]);
});

test("Gradienten-Vorschlag: the name without system and variant, never across sides, a choice where several lead", () => {
	const k = (...names) => names.map((name) => ({ key: name, name }));
	const metro = k("5904080R_ER0.TRA", "5904072S_ER0.TRA", "5904_R-DR0-210323.TRA", "5904_R_DBREF2003.TRA", "5904_R_R00.TRA", "5904_S-DR0-210323.TRA", "AIT_5904S_b.Tra", "AIT_5904R_b.Tra", "AIT_5904L_c_mitW207.Tra", "AIT_RöWV203_204_b.Tra", "AIT_RöWV244_245_b.Tra", "Gl3_DBREF2003.TRA");
	const pick = (name, kandidaten = metro) => { const v = einordnungGradientenVorschlag(name, kandidaten); return v ? `${v.stem}|${v.grund}|${v.eindeutig}|${v.auswahl.length}` : null; };
	assert.equal(pick("5904080R_O00.GRA"), "5904080r_er0|system|true|0");
	assert.equal(pick("5904080R_O00_lokal.GRA"), "5904080r_er0|system|true|0");
	// the trap a plain similarity fell into: the Gradiente of the left Gleis is not the Kilometerlinie's
	assert.equal(pick("AIT_5904L_c.Gra"), "ait_5904l_c_mitw207|system|true|0");
	assert.equal(pick("AIT_5904R_Febr26.Gra"), "ait_5904r_b|system|true|0");
	// two ways of stationing the same Gradiente both go to their one Trasse
	assert.equal(pick("AIT_RöWV203_204_GlStat_b.Gra"), "ait_röwv203_204_b|system|true|0");
	assert.equal(pick("AIT_RöWV203_204_KmL_b.Gra"), "ait_röwv203_204_b|system|true|0");
	// three deliveries of one Gleis: a choice, not a decision
	const choice = einordnungGradientenVorschlag("5904_R-R16-210323.Gra", metro);
	assert.equal(choice.eindeutig, false);
	assert.deepEqual(json(choice.auswahl.map((item) => item.stem)), ["5904_r-dr0-210323", "5904_r_dbref2003", "5904_r_r00"]);
	// a prefix more: weak, shown, never taken in a batch
	assert.equal(pick("GGP_Gl3_DBREF2003.GRA"), "gl3_dbref2003|schwach|false|0");
	// a typo in the system part and one in the name
	assert.equal(pick("AHRO_W_146-147_DBREF206.GRA", k("AHRO_W_146-147_DBREF2016.TRA", "AHRO_W_148-149_DBREF2016.TRA")), "ahro_w_146-147_dbref2016|system|true|0");
	assert.equal(pick("Ka_5811R_km2.6-3.0_kurz.GRA", k("Ka_5811R_km2.6_4.0_kurz.TRA", "Ka_5803R_km0-1.TRA")), "ka_5811r_km2.6_4.0_kurz|zeichen|true|0");
	// the same TRA loaded twice is one name with two keys
	const twice = einordnungGradientenVorschlag("ALBG_Gl302_DHHN92.GRA", [{ key: "a", name: "ALBG_Gl302_DBREF.TRA" }, { key: "b", name: "ALBG_Gl302_DBREF.TRA" }]);
	assert.equal(twice.eindeutig, true);
	assert.deepEqual(json(twice.keys), ["a", "b"]);
	// nothing alike: no proposal
	assert.equal(pick("W401-402.GRA", k("5500R074-082.TRA", "Gls404.TRA")), null);
	assert.equal(einordnungGradientenVorschlag("x.GRA", []), null);
});

test("Bündel: the longest line leads, what runs along it within reach belongs to it, the rest leads its own", () => {
	assert.equal(BUENDEL_REICHWEITE_M, 60);
	assert.equal(BUENDEL_ANTEIL, 0.5);
	const straight = (key, x0, x1, y) => { const points = []; for (let x = x0; x <= x1; x += 50) points.push([x, y]); return { key, length: x1 - x0, points, line: points }; };
	const lines = [
		straight("Gls401", 4000, 4800, 9),
		straight("km", 0, 10000, 0),
		straight("rechts", 0, 10000, -4.5),
		straight("Anschluss", 9000, 9900, 300),
		straight("halb", 9000, 11000, 20),
		straight("Nachbarstrecke", 0, 6000, 2000),
		straight("NS-Gleis", 1000, 2000, 2004),
	];
	const bundles = einordnungBuendel(lines);
	assert.deepEqual(json(bundles.map((b) => [b.leader, b.members])), [
		["km", ["Gls401", "rechts", "halb"]],
		["Nachbarstrecke", ["NS-Gleis"]],
		["Anschluss", []],
	], "leaders by length, members in the order delivered; half alongside is enough, 300 m off is not");
	assert.deepEqual(json(einordnungBuendel([])), []);
	// a short line between two leaders goes to the one it lies nearer to
	const between = einordnungBuendel([straight("A", 0, 5000, 0), straight("B", 0, 5000, 100), straight("x", 1000, 1500, 45)]);
	assert.deepEqual(json(between.map((b) => [b.leader, b.members])), [["A", ["x"]], ["B", []]]);
});


test("Sortiervorschlag: the Strecke from the Kilometerlinie, the side from the Lage beside it; what the Lage cannot say stays", () => {
	// the Strecke a name states: four digits standing alone
	assert.deepEqual(["6100_247-289_DBREF2016_KM", "Ka_5810S_km-", "Str_5801_R_184,0-190,0_(ER0_O00)", "3250_4-11_S_CR0_260402", "Kilometrierungslinie 1720"].map(einordnungStreckeAusName), ["6100", "5810", "5801", "3250", "1720"]);
	assert.deepEqual(["AHBI_Gl_041_DBREF2016", "A705904R", "Gleis2_Bf_Auw", "", null].map(einordnungStreckeAusName), ["", "", "", "", ""], "not the year in DBREF2016, not six digits");
	const g = (key, verdict, route, declared = "unknown", nameSide = null) => ({ key, verdict, route, declared, nameSide });
	const KM = "6100_247-289_DBREF2016_KM";
	const plan = einordnungBuendelVorschlag([
		g("km", "self", KM, "kilometer"),
		g("re", "right", KM, "unknown", "right"),
		g("li", "left", KM, "unknown", "left"),
		g("Gl 041", "left", KM),
		g("verdreht", "left", KM, "unknown", "right"),
		g("Weichenstraße", "crossing", KM),
		g("Variante", "axis", KM),
		g("fern", "none", ""),
		g("Nachbar", "right", "5500"),
		g("Nachbar R", "axis", "5500", "right"),
	]);
	assert.deepEqual(json(plan.ziele.map((ziel) => [ziel.id, ziel.track, ziel.trackAusName, ziel.bezug, ziel.counts])), [
		["6100", "6100", true, [KM], { kilometer: 1, left: 2, right: 1 }],
		["5500", "5500", false, ["5500"], { kilometer: 0, left: 0, right: 2 }],
	], "one target per Strecke; a Strecke read from a name is marked as such");
	assert.deepEqual(json(plan.ziele[0].items.map((item) => [item.key, item.side, item.grund])), [
		["km", "kilometer", "name"], ["re", "right", "name+lage"], ["li", "left", "name+lage"], ["Gl 041", "left", "lage"],
	]);
	assert.deepEqual(json(plan.ziele[1].items.map((item) => [item.key, item.side, item.grund])), [["Nachbar", "right", "lage"], ["Nachbar R", "right", "name"]], "a declared side on its own Kilometerlinie keeps the side");
	assert.deepEqual(json(plan.bleiben), { kreuzt: ["Weichenstraße"], achse: ["Variante"], ohne: ["fern"], widerspruch: ["verdreht"] });
	// a Kilometerlinie whose name states no Strecke: a target without one, for the user to name
	const open = einordnungBuendelVorschlag([g("Achse", "self", "Hauptachse", "kilometer"), g("G1", "right", "Hauptachse")]);
	assert.deepEqual(json(open.ziele.map((ziel) => [ziel.id, ziel.track, ziel.trackAusName, ziel.items.length])), [["Hauptachse", "", false, 2]]);
	// two pieces of one Kilometerlinie are one target
	const pieces = einordnungBuendelVorschlag([g("a", "self", "6100_236-246_KM", "kilometer"), g("b", "self", "6100_247-289_KM", "kilometer"), g("c", "left", "6100_236-246_KM")]);
	assert.deepEqual(json(pieces.ziele.map((ziel) => [ziel.track, ziel.counts, ziel.bezug])), [["6100", { kilometer: 2, left: 1, right: 0 }, ["6100_236-246_KM"]]]);
	assert.deepEqual(json(einordnungBuendelVorschlag([])), { ziele: [], bleiben: { kreuzt: [], achse: [], ohne: [], widerspruch: [] } });
});

test("Umfeld: what the user sorted into a Strecke shares its picture through the km, never through a name", () => {
	const sorted = (key, track, direction, source, range, kmFrame) => fact(key, "alignment", {
		organized: true, frame: frame(track, direction, source), range, kmFrame,
		side: { Kilometerlinie: "kilometer", rechts: "right", links: "left" }[direction],
		role: { Kilometerlinie: "curvatureKilometer", rechts: "curvatureRight", links: "curvatureLeft" }[direction],
	});
	const model = einordnen([
		sorted("km", "6100", "Kilometerlinie", "user", { from: 247000, to: 289000 }, true),
		sorted("re", "6100", "rechts", "user", { from: 247100, to: 288900 }, true),
		sorted("lokal", "6100", "rechts", "user", { from: 0, to: 300 }, false),
		sorted("name", "6100", "links", "vermesn-name", { from: 250000, to: 260000 }, true),
		sorted("fremd", "1280", "rechts", "user", { from: 247100, to: 288900 }, true),
	]);
	const umfeld = (key) => { const u = einordnungUmfeld(model, key); return [json([...u.keys].sort()), u.kmAlignment]; };
	assert.deepEqual(umfeld("re"), [["km", "name", "re"], "km"], "by hand and by name meet where their km meet; another Strecke stays out");
	assert.deepEqual(umfeld("name"), [["km", "name", "re"], "km"]);
	assert.deepEqual(umfeld("lokal"), [["lokal"], null], "a Gleis still in its own stations stays alone");
	assert.equal(json([...einordnungUmfeld(model, "km").keys].sort()).includes("lokal"), false);
});

test("the same km are not the same Gleis: a Variante lies on the other, another Gleis beside it", () => {
	const m = (key, median, hits = 9, samples = 9, min = median, max = median) => ({ key, samples, hits, median, min, max });
	const art = (messungen, wegen) => json(einordnungNebenArt(messungen, wegen));
	const flat = (median) => ({ median, min: median, max: median });
	// a second delivery, a Neuplanung that leaves its Bestand for a stretch
	assert.deepEqual(art([m("Strecke", 0)], "Strecke"), { art: "variante", zu: "Strecke", abstand: flat(0), anteil: 1 });
	assert.equal(art([m("Bestand", 0.02, 9, 9, 0, 1.5)], "Bestand").art, "variante");
	// a Bahnhofsgleis beside the Streckengleis, with the distance to the one in the picture
	assert.deepEqual(art([m("Strecke", 4.5), m("Gl 2", 9)], "Strecke"), { art: "gleis", zu: "Strecke", abstand: flat(4.5), anteil: 1 });
	// the second delivery of a Bahnhofsgleis is a Variante of the first, not of the Streckengleis
	assert.deepEqual(art([m("Strecke", 4.5), m("Gl 2", 0)], "Strecke"), { art: "variante", zu: "Gl 2", abstand: flat(0), anteil: 1 });
	// a piece that runs with the other part of its way and lies on it there (metroB 5904080R)
	assert.deepEqual(art([m("Strecke", 0, 7, 25)], "Strecke"), { art: "variante", zu: "Strecke", abstand: flat(0), anteil: 7 / 25 });
	// a Weichenverbindung touching another Gleis with 3 of 22 samples is not its Variante
	assert.equal(art([m("Abzweig", 0.46, 3, 22, 0, 2.9), m("Strecke", 7)], "Strecke").art, "gleis");
	assert.equal(art([m("Gls", 0.32, 3, 9, 0.04, 0.96)], "Gls").art, "gleis");
	assert.equal(art([m("Gls", 0, 2, 25)], "Gls").art, "gleis", `fewer than ${NEBEN_MIN_TREFFER} samples say nothing`);
	assert.equal(art([m("Gls", NEBEN_AUF_M, 9, 9)], "Gls").art, "gleis", "the bound itself is beside");
	assert.equal(art([m("Gls", 0.1, 5, 9, 0, 3)], "Gls").art, "gleis", `below ${NEBEN_MIN_ANTEIL * 100} % of the samples and off the line elsewhere`);
	// out of reach of the one in the picture: the nearest other speaks; none in reach is still another Gleis
	assert.deepEqual(art([{ key: "Strecke", samples: 9, hits: 0 }, m("Gl 5", 5)], "Strecke"), { art: "gleis", zu: "Gl 5", abstand: flat(5), anteil: 1 });
	assert.deepEqual(art([{ key: "Strecke", samples: 9, hits: 0 }], "Strecke"), { art: "gleis", zu: "Strecke", abstand: null, anteil: null });
	// the Lage is silent (no coordinates, another Lagesystem): neither is claimed
	assert.deepEqual(art([], "Strecke"), { art: "offen", zu: "Strecke", abstand: null, anteil: null });
	assert.deepEqual(art(null, undefined), { art: "offen", zu: null, abstand: null, anteil: null });
});
