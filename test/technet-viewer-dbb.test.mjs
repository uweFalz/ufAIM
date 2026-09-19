import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import MDBReader from "../src/import/parsers/technet/gndEdit/mdb/node_modules/mdb-reader/lib/node/index.js";
import { extractGndMdb } from "../src/import/parsers/technet/gndEdit/gnd/extractGndMdb.js";

const root = new URL("../", import.meta.url);
const html = await fs.readFile(new URL("technetViewer.html", root), "utf8");
const begin = html.indexOf("(() => {", html.indexOf("<script>"));
const entry = "globalThis.runTechnetImport = runImportPipeline;";
const end = html.indexOf("})();", html.indexOf(entry, begin)) + 5;
assert.ok(begin > 0 && end > begin);
const originalBundle = html.slice(begin, end);
// Execute the actual standalone import bundle. Only the browser Worker
// transport is replaced by the same production MDB extractor for this Node
// contract test. This is not a file-picker or visible browser acceptance.
assert.equal(originalBundle.split("function runGndMdbWorker(").length, 2);
const bundle = originalBundle.replace("function runGndMdbWorker(", "function browserMdbTransportNotUsedInNode(").replace(entry,
	`async function runGndMdbWorker(payload) { return globalThis.extractMdbForNode(payload); }\n${entry}`);
const context = vm.createContext({
	console, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView, Blob, URL,
	crypto: globalThis.crypto, performance, setTimeout, clearTimeout, structuredClone,
	extractMdbForNode: (payload) => extractGndMdb({ ...payload, bytes: Buffer.from(payload.bytes), MDBReader }),
});
new vm.Script(bundle, { filename: "technetViewer-import.js" }).runInContext(context);
const importFile = async (name, bytes) => JSON.parse(JSON.stringify(await context.runTechnetImport({ name, arrayBuffer: async () => bytes }, { bytes })));

test("standalone DBB adapter is generated from shared source; every input route recognizes DBB", () => {
	execFileSync(process.execPath, ["tools/sync-technet-dbb.mjs"], { cwd: root, stdio: "pipe" });
	assert.match(html, /SUPPORTED_DATA_EXTENSIONS = new Set\([^\n]*"dbb"/);
	assert.match(html, /if \(ext === "dbb"\) return gndDbbAdapter\.parseGND_DBB/);
	assert.match(html, /identity: "Identität \(PAD, GND\)"/);
	new vm.Script(originalBundle); // The untouched browser bundle must parse too.
});

test("standalone DBB rejection retains its explicit reason", async () => {
	const result = await importFile("invalid.DBB", new TextEncoder().encode("00 6AGON GND-Edit Export\n99not-supported\n"));
	assert.equal(result.ok, false);
	assert.equal(result.items.length, 0);
	assert.match(JSON.stringify(result), /DBB_RECORD_UNSUPPORTED/);
});

test("public standalone DBB produces linked profile/cant with declared metre units", async () => {
	const row = (type, width, fields) => {
		const chars = Array(width).fill(" ");
		for (const [start, size, value] of [[0, 2, type], ...fields]) chars.splice(start, size, ...String(value).padStart(size));
		return chars.join("");
	};
	const lines = ["00 6AGON GND-Edit Export"];
	for (let i = 0; i < 2; i += 1) {
		const pad = `PUBLIC${i}`;
		lines.push(row("11", 91, [[2, 11, pad], [13, 4, "BHPG"], [21, 13, 1000 + i * 100], [86, 4, "1234"], [90, 1, 1]]));
		lines.push(row("12", 116, [[2, 11, pad], [14, 3, "DR0"], [31, 14, 3500000 + i * 100], [45, 14, 5400000]]));
		lines.push(row("13", 102, [[2, 11, pad], [14, 3, "R00"], [31, 14, 100 + i]]));
	}
	const ends = [[2, 11, "PUBLIC0"], [13, 11, "PUBLIC1"]];
	lines.push(row("21", 148, [...ends, [24, 3, "DR0"], [27, 2, 0], [29, 12, 100], [41, 12, 0], [53, 12, 0], [65, 12, 0], [77, 10, 100]]));
	lines.push(row("22", 129, [...ends, [24, 3, "R00"], [27, 2, 0], [29, 12, 100], [41, 12, 10], [53, 12, 10], [65, 12, 0]]));
	lines.push(row("23", 116, [...ends, [24, 2, 0], [26, 12, 100], [38, 7, "0.0900"], [45, 7, "0.0900"], [52, 12, 0]]));
	const result = await importFile("public.DBB", new TextEncoder().encode(lines.join("\r\n") + "\r\n"));
	assert.equal(result.ok, true);
	assert.deepEqual(result.items.map((i) => i.kind), ["alignment", "profile", "cant"]);
	const alignment = result.items[0];
	assert.equal(alignment.payload.coordGeom.elements[0].staStart.value, 0);
	assert.equal(alignment.payload.coordGeom.elements[0].extras.externalStation.value, 1000);
	for (const item of result.items.slice(1)) {
		assert.ok(result.relationCandidates.some((r) => r.type === "stationReference" && r.fromId === item.id && r.toId === alignment.id));
		assert.equal(item.payload.extended.gndSequence.strecke, "1234");
	}
	for (const p of result.items[2].payload.points) assert.deepEqual(p.appliedCant, { value: 0.09, unit: "meter" });
});

const names = ["4760_2-3_DA0-V00", "4760_5-7_DA0-V00", "4760_10-16_DA0-V00", "4760_38,8-46,0_DR0-R00", "4760_48-65_DA0-V00"];
for (const name of names) test(`standalone full GND item/relationship parity: ${name}`, async (t) => {
	const dir = process.env.UFAIM_DBB_SAMPLE_DIR;
	if (!dir) return t.skip("Set UFAIM_DBB_SAMPLE_DIR for the private paired fixtures");
	const dbb = await importFile(`${name}.DBB`, await fs.readFile(path.join(dir, `${name}.DBB`)));
	const mdb = await importFile(`${name}.MDB`, await fs.readFile(path.join(dir, `${name}.MDB`)));
	assert.equal(dbb.ok, true); assert.equal(mdb.ok, true);
	assert.equal(dbb.sourceEnvelope.source.format, "DBB");
	assert.equal(dbb.sourceEnvelope.dbb.cantParameterUnit, "meter");
	assert.deepEqual(dbb.items.map((i) => [i.id, i.kind, i.payload.name]), mdb.items.map((i) => [i.id, i.kind, i.payload.name]));
	const alignments = new Map(dbb.items.filter((i) => i.kind === "alignment").map((i) => [i.id, i]));
	for (let i = 0; i < dbb.items.length; i += 1) {
		const item = dbb.items[i], reference = mdb.items[i];
		assert.equal(item.source.parserId, "gndEdit");
		const seq = item.payload.extended.gndSequence;
		for (const field of ["family", "strecke", "strRikz", "lsys", "hsys", "padStart", "padEnd"]) assert.equal(seq[field], reference.payload.extended.gndSequence[field]);
		assert.equal(seq.strecke, "4760");
		assert.equal(seq.lsys, name.includes("DR0") ? "DR0" : "DA0");
		for (const field of ["coordGeom", "points", "equations", "stationReference"]) compare(item.payload[field], reference.payload[field], field);
		compare(item.status, reference.status, "status");
		if (item.kind === "alignment") {
			assert.equal(item.payload.coordGeom.elements[0].staStart.value, 0);
			for (const element of item.payload.coordGeom.elements) {
				assert.ok(Number.isFinite(element.start.easting) && Number.isFinite(element.end.northing));
				assert.ok(Number.isFinite(element.extras.externalStation.value));
				assert.ok(element.staStart.value < 100000, "intrinsic length must not use packed PP station addresses");
			}
		}
		if (["profile", "cant"].includes(item.kind)) {
			const relation = dbb.relationCandidates.find((r) => r.type === "stationReference" && r.fromId === item.id);
			assert.ok(relation && alignments.has(relation.toId), `${item.kind} has no trace`);
			assert.equal(relation.status.accepted, false);
			if (item.kind === "cant") for (const point of item.payload.points) assert.equal(point.appliedCant.unit, "meter");
		}
	}
	const relations = (r) => r.relationCandidates.map(({ type, fromId, toId, method, status }) => ({ type, fromId, toId, method, status }));
	assert.deepEqual(relations(dbb), relations(mdb));
	assert.ok(dbb.items.some((i) => i.kind === "profile"));
	assert.ok(dbb.items.some((i) => i.kind === "cant"));
	if (name.includes("48-65")) assert.ok(dbb.items.some((i) => i.kind === "staEq"));
	t.diagnostic(JSON.stringify({ kinds: dbb.items.map((i) => i.kind), stationReferences: dbb.relationCandidates.filter((r) => r.type === "stationReference").length }));
});

function compare(a, b, field) {
	if (typeof a === "number" && typeof b === "number") return assert.ok(Math.abs(a - b) <= 0.00002, `${field}: ${a} != ${b}`);
	if (Array.isArray(a)) { assert.equal(a.length, b.length, field); return a.forEach((value, i) => compare(value, b[i], `${field}[${i}]`)); }
	if (a && typeof a === "object") {
		assert.deepEqual(Object.keys(a), Object.keys(b), field);
		for (const key of Object.keys(a)) compare(a[key], b[key], `${field}.${key}`);
		return;
	}
	assert.equal(a, b, field);
}
