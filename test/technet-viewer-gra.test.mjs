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
