// The Viewer's GRA reader: a GRA carries, after its grade breaks, the
// Überhöhungsrampen (Rampenanfang, Schnittpunkt, Rampenende, Form·1000 + u1,
// u2·10); the header counts both. The block between the two markers in
// technetViewer.html is a copy of the shared source and must stay one.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

import { decodeBinary } from "../src/import/parsers/technet/vermEsn/sharedVermesn.js";

const root = new URL("../", import.meta.url);
const html = await fs.readFile(new URL("technetViewer.html", root), "utf8");
const begin = html.indexOf("  // BEGIN GENERATED GRA SOURCE RECORDS");
const end = html.indexOf("  // END GENERATED GRA SOURCE RECORDS");
assert.ok(begin > 0 && end > begin, "GRA source records block present");
const block = html.slice(begin, end);

test("the embedded block is the shared source, export keyword and indentation aside", async () => {
	const source = await fs.readFile(new URL("src/import/parsers/technet/vermEsn/extractGraSourceRecords.js", root), "utf8");
	const body = source.replace(/^export /gm, "").trim();
	const expected = body.split("\n").map((line) => line ? `    ${line.replace(/\t/g, "  ")}` : "").join("\n");
	assert.ok(block.includes(expected), "viewer copy of extractGraSourceRecords differs from the shared source");
});

const context = vm.createContext({});
new vm.Script(`${block}\nglobalThis.api = graSourceRecords;`, { filename: "gra-source-records.js" }).runInContext(context);
const { extractGraSourceRecords } = context.api;
// Values cross the vm boundary as JSON so deepEqual compares structure, not realms.
const json = (value) => JSON.parse(JSON.stringify(value));

test("Eifel 2631R139: 47 grade breaks, then 8 Überhöhungsrampen", async () => {
	const file = await fs.readFile(new URL("test/samples/eifel/2631R139_Bestand_VR_DBREF03_A.GRA", root));
	const decoded = decodeBinary(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), "GRA");
	const [header, ...rows] = decoded.rowsRaw;
	assert.equal(rows.length, 55);
	const result = extractGraSourceRecords(header, rows);
	assert.deepEqual(json(result.diagnostics), []);
	assert.equal(result.profileRows.length, 47);
	assert.equal(result.trackScissorClaims.length, 8);
	assert.ok(result.profileRows.every((row) => row.height > 100 && row.height < 300), "every grade break has a height in metres");
	const first = result.trackScissorClaims[0].construction;
	assert.equal(Math.round(first.rampEnd1Station * 100) / 100, 139858.49);
	assert.equal(Math.round(first.rampIntersectionStation * 100) / 100, 139944.29);
	assert.equal(Math.round(first.rampEnd2Station * 100) / 100, 140044.39);
	assert.equal(first.rampCode, 2);
	assert.equal(first.cant1Millimetres, 120);
	assert.equal(first.cant2Millimetres, 140);
});

test("a header whose counts do not add up leaves the rows unclassified, with a diagnostic", () => {
	const rows = [{ station: 1, height: 2, radius: 0, tangentL: 0, pointNumber: 0 }, { station: 3, height: 4, radius: 0, tangentL: 0, pointNumber: 0 }];
	const result = extractGraSourceRecords({ station: 1, pointNumber: 0 }, rows);
	assert.deepEqual(json(result.diagnostics.map((diagnostic) => diagnostic.code)), ["GRA_HEADER_DATA_COUNT_MISMATCH"]);
	assert.deepEqual(json(result.profileRows), []);
	assert.equal(result.unclassifiedRows.length, 2);
});

// The Überhöhungsband: sign from the Trasse's Krümmung, the GRA's Rampen as
// one straight line through the Wendepunkt, and the footnote that measures
// them against the Trasse's own Überhöhung.
const rampBegin = html.indexOf("// BEGIN GRA CANT RAMPS");
const rampEnd = html.indexOf("// END GRA CANT RAMPS");
assert.ok(rampBegin > 0 && rampEnd > rampBegin, "cant ramp block present");
const rampContext = vm.createContext({});
new vm.Script(`${html.slice(rampBegin, rampEnd)}\nglobalThis.api = { bandValueAt, signedCantSeries, cantRampSeries, rampPoints, cantRampFootnote, CANT_RAMP_CANT_TOLERANCE_MM };`, { filename: "gra-cant-ramps.js" }).runInContext(rampContext);
const ramps = rampContext.api;

// Eifel 2631R139 around the first Rampe, in the Kilometerlinie's frame
// (TRA local 0 = km 139,2 + 37,78): Rechtsbogen r 387 (u 120), Übergangsbogen
// to the Gerade at 139944,29, Übergangsbogen into the Linksbogen r 323 (u 140).
const curvature = [
	{ x: 139808.49, y: 1 / 387 }, { x: 139858.49, y: 1 / 387 }, { x: 139944.29, y: 0 },
	{ x: 139944.29, y: 0 }, { x: 140044.39, y: -1 / 323 }, { x: 140132.4, y: -1 / 323 },
];
const cantPoints = [{ x: 139808.49, y: 120 }, { x: 139858.49, y: 120 }, { x: 139944.29, y: 0 }, { x: 140044.39, y: 140 }, { x: 140132.4, y: 140 }];
const eifelRamp = { rampEnd1Station: 139858.49, rampIntersectionStation: 139944.29, rampEnd2Station: 140044.39, rampCode: 2, cant1Millimetres: 120, cant2Millimetres: 140 };

test("the cant series takes the sign of the element it starts in; zero stays zero", () => {
	const signed = ramps.signedCantSeries(cantPoints, curvature);
	assert.deepEqual(json(signed.map((point) => point.y)), [120, 120, 0, -140, -140]);
	// a cant value on a Gerade keeps the sign of the element before it
	const onStraight = ramps.signedCantSeries([{ x: 139944.29, y: 10 }, { x: 139990, y: 10 }], [{ x: 139900, y: 1 / 387 }, { x: 139944.29, y: 0 }, { x: 139944.29, y: 0 }, { x: 140000, y: 0 }]);
	assert.deepEqual(json(onStraight.map((point) => point.y)), [10, 10]);
	assert.deepEqual(json(ramps.signedCantSeries(cantPoints, [])).map((point) => point.y), [120, 120, 0, 140, 140], "no Trasse: magnitudes unchanged");
});

test("a Rampe through the Wendepunkt is one line from +u1 to −u2 with equal legs", () => {
	const [ramp] = ramps.cantRampSeries([eifelRamp], curvature);
	assert.equal(ramp.sideKnown, true);
	assert.deepEqual(json(ramp.points), [{ x: 139858.49, y: 120, gap: true }, { x: 139944.29, y: 0 }, { x: 140044.39, y: -140 }]);
	assert.equal(Math.round(ramp.slope1), 715);
	assert.equal(Math.round(ramp.slope2), 715);
	assert.equal(Math.round(ramps.bandValueAt(ramp.points, 139901.39, false)), 60);
	// without a Trasse: positive first by convention, and the footnote says so
	const [blind] = ramps.cantRampSeries([eifelRamp], []);
	assert.equal(blind.sideKnown, false);
	assert.deepEqual(json(blind.points.map((point) => point.y)), [120, 0, -140]);
	assert.match(ramps.cantRampFootnote("Gleis", [blind], [], (value) => value.toFixed(2)).lines.at(-1), /ohne Trasse: Seite der Rampe unbestimmt/);
	// a record with an unreadable station is skipped, not drawn at NaN
	assert.deepEqual(json(ramps.cantRampSeries([{ ...eifelRamp, rampEnd2Station: null }], curvature)), []);
	assert.deepEqual(json(ramps.rampPoints(ramps.cantRampSeries([eifelRamp, { ...eifelRamp, rampEnd1Station: 139000, rampIntersectionStation: 139050, rampEnd2Station: 139100 }], curvature))).map((point) => point.x)[0], 139000, "sorted by Rampenanfang");
});

test("the footnote measures the Rampe against the Trasse's Überhöhung", () => {
	const [ramp] = ramps.cantRampSeries([eifelRamp], curvature);
	const format = (value) => value.toFixed(2);
	const agree = ramps.cantRampFootnote("Rechtes Gleis", [ramp], ramps.signedCantSeries(cantPoints, curvature), format);
	assert.equal(agree.head, "Rechtes Gleis · Überhöhungsrampen aus der GRA (1 · Form 2)");
	assert.equal(agree.lines.length, 2);
	assert.equal(agree.lines[0], "139858.49 → 140044.39 · u +120 → −140 mm · Wendepunkt 139944.29 · Neigung 1:715 | 1:715 · Trasse deckt sich");
	assert.match(agree.lines[1], /^Form 2: Kennzahl der GRA/);
	const shifted = cantPoints.map((point) => ({ ...point, x: point.x + 20 }));
	const differ = ramps.cantRampFootnote("Rechtes Gleis", [ramp], ramps.signedCantSeries(shifted, curvature), format);
	assert.match(differ.lines[0], /Trasse weicht ab: Δu [+−]\d+ mm am (Rampenanfang|Wendepunkt|Rampenende)$/);
	const silent = ramps.cantRampFootnote("Rechtes Gleis", [ramp], [], format);
	assert.match(silent.lines[0], /ohne Überhöhungsreihe der Trasse$/);
	const unequal = ramps.cantRampSeries([{ ...eifelRamp, rampEnd2Station: 140100 }], curvature);
	assert.match(ramps.cantRampFootnote("Gleis", unequal, [], format).lines[0], /Neigung 1:715 \| 1:1112 \(ungleich\)/);
	assert.equal(ramps.CANT_RAMP_CANT_TOLERANCE_MM, 5);
});

// The Ausschnitt of the band figures (IVMG, GWB, FZK): pure window
// arithmetic, run together with the ramp block for bandValueAt.
const windowBegin = html.indexOf("// BEGIN DIAGRAM WINDOW");
const windowEnd = html.indexOf("// END DIAGRAM WINDOW");
assert.ok(windowBegin > rampEnd && windowEnd > windowBegin, "diagram window block present");
const windowContext = vm.createContext({});
new vm.Script(`${html.slice(rampBegin, rampEnd)}\n${html.slice(windowBegin, windowEnd)}\nglobalThis.api = { windowWithin, windowZoomed, windowShifted, seriesRangeIn, DIAGRAM_MIN_WINDOW_M };`, { filename: "diagram-window.js" }).runInContext(windowContext);
const ausschnitt = windowContext.api;

test("an Ausschnitt stays inside the picture, keeps the station under the mouse, and ends at the whole", () => {
	const full = { xMin: 1000, xMax: 23000 };
	assert.deepEqual(json(ausschnitt.windowWithin(full, null)), { xMin: 1000, xMax: 23000, zoomed: false });
	assert.deepEqual(json(ausschnitt.windowWithin(full, { xMin: 10000, xMax: 11500 })), { xMin: 10000, xMax: 11500, zoomed: true });
	// the same window on a Gleis of the Strecke that is shorter than it: the whole Gleis
	assert.deepEqual(json(ausschnitt.windowWithin({ xMin: 10200, xMax: 10900 }, { xMin: 10000, xMax: 11500 })), { xMin: 10200, xMax: 10900, zoomed: false });
	// on a longer one it is pushed inside, with its width
	assert.deepEqual(json(ausschnitt.windowWithin({ xMin: 10500, xMax: 20000 }, { xMin: 10000, xMax: 11500 })), { xMin: 10500, xMax: 12000, zoomed: true });
	// another Abschnitt of the Strecke: no Ausschnitt there
	assert.equal(ausschnitt.windowWithin({ xMin: 30000, xMax: 40000 }, { xMin: 10000, xMax: 11500 }).zoomed, false);
	// a window narrower than the minimum is widened to it
	assert.equal(ausschnitt.windowWithin(full, { xMin: 5000, xMax: 5010 }).xMax - 5000, ausschnitt.DIAGRAM_MIN_WINDOW_M);

	const shown = { xMin: 1000, xMax: 23000 };
	const once = ausschnitt.windowZoomed(shown, full, 12000, 0.5);
	assert.deepEqual(json(once), { xMin: 6500, xMax: 17500 }, "km 12,0 keeps its place in the middle");
	const edge = ausschnitt.windowZoomed(shown, full, 1000, 0.5);
	assert.deepEqual(json(edge), { xMin: 1000, xMax: 12000 }, "the left edge stays the left edge");
	assert.equal(ausschnitt.windowZoomed(once, full, 12000, 2), null, "zoomed out to the whole: no Ausschnitt");
	let narrow = once;
	for (let step = 0; step < 40; step += 1) narrow = ausschnitt.windowZoomed(narrow, full, 12000, 0.5);
	assert.equal(Math.round((narrow.xMax - narrow.xMin) * 1000) / 1000, ausschnitt.DIAGRAM_MIN_WINDOW_M, "never narrower than the minimum");
	assert.ok(narrow.xMin <= 12000 && narrow.xMax >= 12000);

	assert.deepEqual(json(ausschnitt.windowShifted(once, full, 2000)), { xMin: 8500, xMax: 19500 });
	assert.deepEqual(json(ausschnitt.windowShifted(once, full, 99999)), { xMin: 12000, xMax: 23000 }, "a drag ends at the picture's end");
	assert.deepEqual(json(ausschnitt.windowShifted(once, full, -99999)), { xMin: 1000, xMax: 12000 });
});

test("a band in an Ausschnitt is scaled to what it shows there, edges included", () => {
	const series = [{ x: 0, y: 0 }, { x: 100, y: 10 }, { x: 200, y: -4 }, { x: 300, y: 2, gap: true }, { x: 400, y: 6 }];
	assert.deepEqual(json(ausschnitt.seriesRangeIn(series, 0, 400)), { min: -4, max: 10 });
	// between two points: the values at the edges, not the points outside
	assert.deepEqual(json(ausschnitt.seriesRangeIn(series, 20, 50)), { min: 2, max: 5 });
	assert.deepEqual(json(ausschnitt.seriesRangeIn(series, 150, 200)), { min: -4, max: 3 });
	// across the gap the series is silent
	assert.equal(ausschnitt.seriesRangeIn(series, 220, 280), null);
	assert.deepEqual(json(ausschnitt.seriesRangeIn(series, 220, 320)), { min: 2, max: 2.8 });
	assert.equal(ausschnitt.seriesRangeIn([], 0, 100), null);
});
