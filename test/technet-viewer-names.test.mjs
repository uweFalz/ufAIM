// The Viewer's VermEsn file-name conventions, run on every file name of
// the known deliveries. The block between the two markers in
// technetViewer.html is pure (no DOM), so it runs here as it is.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = await fs.readFile(new URL("technetViewer.html", root), "utf8");
const begin = html.indexOf("// BEGIN VERMESN NAME CONVENTIONS");
const end = html.indexOf("// END VERMESN NAME CONVENTIONS");
assert.ok(begin > 0 && end > begin, "convention block present");
const context = vm.createContext({});
new vm.Script(`${html.slice(begin, end)}\nglobalThis.frameOf = vermEsnNameFrameOf; globalThis.conventions = VERMESN_NAME_CONVENTIONS;`, { filename: "vermesn-names.js" }).runInContext(context);
// Values cross the vm boundary as JSON so deepEqual compares structure, not realms.
const frameOf = (name) => JSON.parse(JSON.stringify(context.frameOf(name) ?? null));

const landshut = `5500L074-082.GRA 5500L074-082.TRA 5500R074-082.GRA 5500R074-082.TRA 5500S074-082.TRA 5500S074-082_Gls404.TRA 5632R000-002.GRA 5632R000-002.TRA 5632S000-002.TRA 5634R000-007.GRA 5634R000-007.TRA 5634R000-007_Gls403.GRA 5634R000-007_Gls403.TRA 5634S000-007.TRA 5634S000-007_Gls403.TRA 5720R000_Gls403.GRA 5720R000_Gls403.TRA 5720S.TRA Abzw-li_DKW503.TRA Abzw-li_DKW510.TRA Abzw-re_DKW503.TRA Abzw-re_DKW510.TRA Abzw_EKW410.TRA Gls031.GRA Gls031.TRA Gls095.TRA Gls401.GRA Gls401.TRA Gls401v.GRA Gls401v.TRA Gls402.GRA Gls402.TRA Gls402v.TRA Gls404.GRA Gls404.TRA Gls404v.GRA Gls404v.TRA Gls407.GRA Gls407.TRA Gls408.GRA Gls408.TRA Gls409.GRA Gls409.TRA Gls410.GRA Gls410.TRA Gls413.TRA Gls416.GRA Gls416.TRA Gls418.GRA Gls418.TRA Gls432.GRA Gls432.TRA Gls433.GRA Gls433.TRA Gls490.TRA Gls534.GRA Gls534.TRA Gls591.GRA Gls591.TRA W401-402.GRA W401-402.TRA W403-404.GRA W403-404.TRA W413-414.GRA W413-414.TRA W422-423.TRA W424-426.TRA W424-W429.GRA W424-W429.TRA W463-465.GRA W463-465.TRA W466-476.GRA W466-476.TRA W467-468.GRA W467-468.TRA W475-464.GRA W475-464.TRA W477-478.GRA W477-478.TRA W538-462.GRA W538-462.TRA`.split(" ");
const eifel = `2631K139_Bestand_VR_DBREF03.TRA 2631R139_Bestand_VR_DBREF03_A.GRA 2631R139_Bestand_VR_DBREF03_A.TRA 2631R139_Philippsheimer+Friedrich-Wilhelm_Neuplanung_DBREF03.TRA 2631R139_Philippsheimer+Friedrich-Wilhelm_Neuplanung_DBREF03_A.GRA 2631R142_Loskyller+Heinzkyller_Neuplanung_DBREF03_A.GRA 2631R142_Loskyller+Heinzkyller_Neuplanung_DBREF03_A.TRA 2631R148_Kyller_mit_Weg_Neuplanung_DBREF03.GRA 2631R148_Kyller_mit_Weg_Neuplanung_DBREF03.TRA 2631R148_Kyller_ohne_Weg_Neuplanung_DBREF03.GRA 2631R148_Kyller_ohne_Weg_Neuplanung_DBREF03.TRA Gleis2_Bf_Auw_Bestand_VR_DBREF03.GRA Gleis2_Bf_Auw_Bestand_VR_DBREF03_A.TRA Gleis2_Bf_Speicher_Bestand_VR_DBREF03.GRA Gleis2_Bf_Speicher_Bestand_VR_DBREF03.TRA Gleis2_Bf_Speicher_Neuplanung_DBREF03.GRA Gleis2_Bf_Speicher_Neuplanung_DBREF03.TRA Gleis4_Bf_Speicher_Bestand_VR_DBREF03.GRA Gleis4_Bf_Speicher_Bestand_VR_DBREF03.TRA`.split(" ");

test("two conventions, each with a label", () => {
	assert.deepEqual(Array.from(context.conventions, (c) => c.id), ["strecke", "bahnhofsgleis"]);
	for (const c of Array.from(context.conventions)) assert.ok(c.label.length > 10);
});

test("Landshut: Strecke files frame, Bahnhofsgleise stay unknown, singletons yield nothing", () => {
	assert.deepEqual(frameOf("5500S074-082.TRA"), { track: "5500", side: "kilometer", segment: "074-082", gleis: null, variant: null, convention: "strecke" });
	assert.deepEqual(frameOf("5500R074-082.GRA"), { track: "5500", side: "right", segment: "074-082", gleis: null, variant: null, convention: "strecke" });
	assert.deepEqual(frameOf("5500L074-082.TRA"), { track: "5500", side: "left", segment: "074-082", gleis: null, variant: null, convention: "strecke" });
	assert.deepEqual(frameOf("5500S074-082_Gls404.TRA"), { track: "5500", side: "unknown", segment: "074-082", gleis: "Gls404", variant: null, convention: "strecke" });
	assert.deepEqual(frameOf("5720R000_Gls403.TRA"), { track: "5720", side: "unknown", segment: "000", gleis: "Gls403", variant: null, convention: "strecke" });
	assert.deepEqual(frameOf("5720S.TRA"), { track: "5720", side: "kilometer", segment: null, gleis: null, variant: null, convention: "strecke" });
	for (const name of ["Gls401.TRA", "Gls401v.GRA", "W403-404.TRA", "W424-W429.GRA", "Abzw-li_DKW503.TRA", "Abzw_EKW410.TRA"]) assert.equal(frameOf(name), null, name);
	const framed = landshut.filter((name) => frameOf(name));
	assert.equal(framed.length, 18, "18 of 81 Landshut files name a Strecke");
	assert.equal(landshut.length - framed.length, 63);
});

test("Eifel: K is the Kilometerlinie, a start-only km, descriptions are variants, Bahnhofsgleise frame by Bahnhof", () => {
	assert.deepEqual(frameOf("2631K139_Bestand_VR_DBREF03.TRA"), { track: "2631", side: "kilometer", segment: "139", gleis: null, variant: "Bestand_VR_DBREF03", convention: "strecke" });
	assert.deepEqual(frameOf("2631R139_Bestand_VR_DBREF03_A.TRA"), { track: "2631", side: "right", segment: "139", gleis: null, variant: "Bestand_VR_DBREF03_A", convention: "strecke" });
	assert.deepEqual(frameOf("2631R148_Kyller_mit_Weg_Neuplanung_DBREF03.GRA").segment, "148");
	assert.equal(frameOf("2631R139_Philippsheimer+Friedrich-Wilhelm_Neuplanung_DBREF03.TRA").side, "right");
	assert.deepEqual(frameOf("Gleis2_Bf_Auw_Bestand_VR_DBREF03_A.TRA"), { track: "Bf Auw", side: "unknown", segment: null, gleis: "2", variant: "Bestand_VR_DBREF03_A", convention: "bahnhofsgleis" });
	assert.deepEqual(frameOf("Gleis4_Bf_Speicher_Bestand_VR_DBREF03.GRA"), { track: "Bf Speicher", side: "unknown", segment: null, gleis: "4", variant: "Bestand_VR_DBREF03", convention: "bahnhofsgleis" });
	assert.equal(eifel.filter((name) => frameOf(name)).length, eifel.length, "every Eifel file frames");
	assert.equal(eifel.filter((name) => frameOf(name)?.side === "kilometer").length, 1, "one Kilometerlinie");
	assert.equal(eifel.filter((name) => frameOf(name)?.convention === "bahnhofsgleis").length, 8);
});

test("tolerated spellings resolve to the same frames; a description is never a Bahnhofsgleis", () => {
	for (const name of ["Str5500S074-082.TRA", "Strecke_5500_S_074-082.TRA", "5500-S-074-082.tra", "5500 S 074-082.TRA"]) {
		assert.deepEqual(frameOf(name), frameOf("5500S074-082.TRA"), name);
	}
	assert.equal(frameOf("2631R139_Gls403_Neu.TRA").gleis, "Gls403_Neu", "a suffix starting with Gls is a Bahnhofsgleis by the convention");
	assert.equal(frameOf("2631R139_Glashuette_Neuplanung.TRA").gleis, null, "Gla... is a description, not Gls");
	assert.equal(frameOf("2631R139_Bestand.TRA").gleis, null);
	assert.equal(frameOf("notes.txt"), null);
	assert.equal(frameOf(""), null);
	assert.equal(frameOf(undefined), null);
});
