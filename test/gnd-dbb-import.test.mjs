import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { extractGndDbb, looksLikeGndDbb } from "../src/import/parsers/technet/gndEdit/gnd/extractGndDbb.js";
import { envelopeToGndTables, digestGndEnvelope } from "../src/import/parsers/technet/gndEdit/gnd/gndSourceEnvelope.js";
import { validateGndSourceEnvelope } from "../src/import/parsers/technet/gndEdit/gnd/validateGndSourceEnvelope.js";

const root = new URL("../", import.meta.url);
const aliases = { "@src/": "src/", "@kimport/": "src/import/", "@spot/": "src/model/spot/", "@kgeom/": "src/lib/geom/", "@kmath/": "src/lib/math/", "@utils/": "src/lib/utils/" };
registerHooks({ resolve(specifier, context, next) {
	if (specifier === "sheetjs") return next(new URL("test/gnd-mdb-spike/node_modules/xlsx/xlsx.mjs", root).href, context);
	for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return next(new URL(target + specifier.slice(prefix.length), root).href, context);
	return next(specifier, context);
} });
const { parseGND_DBB } = await import("../src/import/parsers/technet/gndEdit/parseGND_DBB.js");
const { parseGNDSourceEnvelope } = await import("../src/import/parsers/technet/gndEdit/parseGND_XLSX.js");
const { runImportPipeline } = await import("../src/import/runImportPipeline.js");
const { buildImportResultFromParsed } = await import("../src/import/build/buildImportResultFromParsed.js");
const { installFileDrop } = await import("../app/io/input/fileDrop.js");
const encode = (text) => new TextEncoder().encode(text);
const HEADER = "00 6AGON GND-Edit Export";
const core = ["X_ASC11_PP", "X_ASC12_PL", "X_ASC13_PH", "X_ASC21_EL", "X_ASC22_EH", "X_ASC23_EU", "X_ASC24_EK"];

// Public synthetic writer uses explicit field positions, independently of the
// extractor schema. No private railway records are copied into this test.
function record(type, fields, width) {
	const chars = Array(width).fill(" ");
	for (const [start, size, value] of [[0, 2, type], ...fields]) {
		const text = String(value).padStart(size);
		assert.ok(text.length <= size, `Fixture field overflows at ${start}`);
		chars.splice(start, size, ...text);
	}
	return chars.join("");
}
function synthetic() {
	const lines = [HEADER];
	for (let i = 0; i < 3; i += 1) {
		const pad = `P${i + 1}`;
		lines.push(record("11", [[2, 11, pad], [13, 4, "BHPG"], [17, 3, 0], [20, 1, 1], [21, 13, (i * 100).toFixed(3)], [86, 4, "1234"], [90, 1, 1]], 91));
		lines.push(record("12", [[2, 11, pad], [13, 1, "R"], [14, 3, "DR0"], [31, 14, (3500000 + i * 100).toFixed(5)], [45, 14, "5400000.00000"], [59, 3, 300], [62, 2, -5]], 116));
		lines.push(record("13", [[2, 11, pad], [13, 1, "R"], [14, 3, "R00"], [31, 14, "100.00000"], [45, 3, 300], [48, 2, -5]], 102));
	}
	for (let i = 0; i < 2; i += 1) {
		const ends = [[2, 11, `P${i + 1}`], [13, 11, `P${i + 2}`]];
		for (const type of ["21", "22", "24"]) lines.push(record(type, [...ends, [24, 3, type === "22" ? "R00" : "DR0"], [27, 2, 0], [29, 12, "100.00000"], [41, 12, "0.00000"], [53, 12, "0.00000"], [65, 12, "0.00000"], ...(type !== "22" ? [[77, 10, "100.000000"]] : []), ...(type === "24" ? [[87, 13, (i * 100).toFixed(3)], [100, 13, ((i + 1) * 100).toFixed(3)]] : [])], type === "24" ? 174 : type === "21" ? 148 : 129));
		lines.push(record("23", [...ends, [24, 2, 0], [26, 12, "100.00000"], [38, 7, "0.0900"], [45, 7, "0.0900"], [52, 12, "0.00000"]], 116));
	}
	return lines.join("\r\n") + "\r\n";
}
const file = (name, bytes) => ({ name, size: bytes.length, arrayBuffer: async () => bytes });

test("DBB v6 preserves all seven GND families, raw evidence, precision, zero and empty", async () => {
	const bytes = encode(synthetic());
	assert.equal(looksLikeGndDbb(bytes), true);
	const one = await extractGndDbb({ bytes, fileName: "synthetic.DBB" });
	const two = await extractGndDbb({ bytes, fileName: "synthetic.DBB" });
	assert.equal(await digestGndEnvelope(one), await digestGndEnvelope(two));
	assert.equal(one.source.format, "DBB");
	assert.equal(one.dbb.cantParameterUnit, "meter");
	assert.equal(validateGndSourceEnvelope(one, { requireCompleteCore: true }).ok, true);
	assert.deepEqual(one.tables.map((table) => table.name), core);
	assert.equal(one.dbb.recordCount, 17);
	const pp = one.tables[0].rows[0];
	assert.equal(pp.sourceLine, 2);
	assert.equal(pp.rawRecord, synthetic().split("\r\n")[1]);
	assert.equal(pp.cells.find((c) => c.columnName === "STATION").state, "zero");
	assert.equal(pp.cells.find((c) => c.columnName === "PPROG").state, "empty");
	const cant = one.tables[5].rows[0].cells.find((c) => c.columnName === "EUPAR2");
	assert.equal(cant.value, 0.09);
	assert.equal(cant.printedScale, 4);
	assert.equal(cant.rawLexeme.trim(), "0.0900");
	const lf = await extractGndDbb({ bytes: encode(synthetic().replaceAll("\r\n", "\n").replace(/\n$/, "")) });
	assert.deepEqual(envelopeToGndTables(lf), envelopeToGndTables(one));
});

test("omitted DBB families stay empty; no heights or cant are fabricated", async () => {
	const lines = synthetic().split("\r\n").filter((line) => !/^(13|22|23)/.test(line));
	const envelope = await extractGndDbb({ bytes: encode(lines.join("\r\n")) });
	for (const name of [core[2], core[4], core[5]]) {
		assert.equal(envelope.tables.find((t) => t.name === name).rows.length, 0);
		assert.equal(envelope.inventory.find((t) => t.name === name).sourceRecordFamilyPresent, false);
	}
});

test("bad headers, non-ASCII, unknown records, truncated and malformed fields reject explicitly", async () => {
	for (const [text, code] of [
		[synthetic().replace("6AGON", "7AGON"), "DBB_FORMAT_UNSUPPORTED"],
		[synthetic() + "ä", "DBB_ENCODING_UNSUPPORTED"],
		[synthetic().replace("BHPG", "BH\rG"), "DBB_ENCODING_UNSUPPORTED"],
		[synthetic() + "31unimplemented\r\n", "DBB_RECORD_UNSUPPORTED"],
		[HEADER + "\n12short", "DBB_RECORD_TRUNCATED"],
		[synthetic().replace("3500000.00000", "3500000.x0000"), "DBB_FIELD_INVALID"],
		[HEADER + "\r\n", "DBB_EMPTY"],
	]) await assert.rejects(extractGndDbb({ bytes: encode(text) }), { code });
});

test("blank required coordinates are rejected, never converted into zero", async () => {
	await assert.rejects(parseGND_DBB({ file: { name: "missing.DBB" }, bytes: encode(synthetic().replace("3500000.00000", "             ")) }), { code: "GND_SOURCE_INCOMPLETE" });
});

test("DBB extraction supports preflight limits and cancellation between progress batches", async () => {
	const bytes = encode(synthetic());
	await assert.rejects(extractGndDbb({ bytes, limits: { maxFileBytes: 10 } }), { code: "DBB_LIMIT_FILE_SIZE" });
	await assert.rejects(extractGndDbb({ bytes, limits: { maxRows: 2 } }), { code: "DBB_LIMIT_ROW_COUNT" });
	await assert.rejects(extractGndDbb({ bytes, limits: { maxLineLength: 40 } }), { code: "DBB_LIMIT_LINE_LENGTH" });
	await assert.rejects(extractGndDbb({ bytes, limits: { batchRows: 0 } }), { code: "DBB_LIMIT_CONFIG" });
	const controller = new AbortController();
	let heartbeats = 0;
	await assert.rejects(extractGndDbb({ bytes, limits: { batchRows: 1 }, signal: controller.signal, onHeartbeat() { heartbeats += 1; controller.abort(); } }), { name: "AbortError", code: "IMPORT_JOB_CANCELLED" });
	assert.equal(heartbeats, 1);
	await assert.rejects(extractGndDbb({ bytes, signal: controller.signal }), { name: "AbortError" });
});

test("normal pipeline uses gndEdit and transports gndSequence, endpoints, external stations and PAD evidence", async () => {
	const bytes = encode(synthetic());
	const phases = [];
	const result = await runImportPipeline(file("synthetic.DBB", bytes), { bytes, onJobPhase: (phase) => phases.push(phase) });
	assert.equal(result.ok, true);
	assert.equal(result.sourceEnvelope.source.format, "DBB");
	assert.equal(result.items.length, 2);
	assert.deepEqual(phases.slice(0, 5), ["reading", "sniffing", "parser-loading", "extracting", "normalizing"]);
	for (const item of result.items) {
		assert.equal(item.source.parserId, "gndEdit");
		assert.equal(item.kind, "alignment");
		const seq = item.payload.extended.gndSequence;
		assert.ok(["EL", "EK"].includes(seq.family));
		assert.equal(seq.strecke, "1234");
		assert.equal(seq.strRikz, "1");
		assert.equal(seq.lsys, "DR0");
		assert.ok(Object.hasOwn(seq, "hsys"));
		assert.equal(seq.padStart, "P1");
		for (const element of item.payload.coordGeom.elements) {
			assert.ok(Number.isFinite(element.start.easting));
			assert.ok(Number.isFinite(element.end.northing));
			assert.deepEqual(element.extras.externalStation, element.staStart);
		}
	}
	const associations = result.relationCandidates.filter((r) => r.type === "gndSourceEvidenceAssociation");
	assert.ok(associations.some((r) => r.source.family === "EH"));
	assert.ok(associations.some((r) => r.source.family === "EU"));
	for (const relation of associations) {
		assert.equal(relation.constructive, false);
		assert.equal(relation.status.accepted, false);
		assert.equal(relation.domainRelationStatus, "not-established");
		assert.deepEqual(relation.source.directedPadChain, ["P1", "P2", "P3"]);
	}
	const parsed = await parseGND_DBB({ file: { name: "synthetic.DBB" }, bytes });
	assert.equal(parsed.meta.sourceBackend, "dbb");
	assert.ok(parsed.alignments.every((a) => a.extras.source.sourceBackend === "dbb"));
});

test("DBB failures return the standard rejection; cancellation preserves AbortError", async () => {
	const bytes = encode(synthetic() + "99unknown\r\n");
	const result = await runImportPipeline(file("bad.DBB", bytes), { bytes });
	assert.equal(result.ok, false);
	assert.equal(result.items.length, 0);
	assert.match(JSON.stringify(result), /DBB_RECORD_UNSUPPORTED/);
	const controller = new AbortController(); controller.abort();
	await assert.rejects(runImportPipeline(file("cancelled.DBB", bytes), { bytes, signal: controller.signal }), { name: "AbortError", code: "IMPORT_JOB_CANCELLED" });
	const running = new AbortController();
	const valid = encode(synthetic());
	await assert.rejects(runImportPipeline(file("cancelled.DBB", valid), { bytes: valid, signal: running.signal, dbbLimits: { batchRows: 1 }, onHeartbeat() { running.abort(); } }), { name: "AbortError", code: "IMPORT_JOB_CANCELLED" });
});

test("DBB file-drop dispatch follows the standard callback (synthetic event, not browser proof)", async () => {
	const listeners = new Map(); let received;
	installFileDrop({ element: { addEventListener: (name, fn) => listeners.set(name, fn) }, onFiles: async (files) => { received = files; } });
	const input = file("synthetic.DBB", encode(synthetic()));
	await listeners.get("drop")({ preventDefault() {}, stopPropagation() {}, dataTransfer: { files: [input] } });
	assert.deepEqual(received, [input]);
});

const pairedNames = ["4760_2-3_DA0-V00", "4760_5-7_DA0-V00", "4760_10-16_DA0-V00", "4760_38,8-46,0_DR0-R00", "4760_48-65_DA0-V00"];
for (const name of pairedNames) test(`local paired DBB/MDB contract: ${name}`, async (t) => {
	if (!process.env.UFAIM_DBB_SAMPLE_DIR) return t.skip("Set UFAIM_DBB_SAMPLE_DIR to the private paired Brenzbahn fixture directory");
	const dir = process.env.UFAIM_DBB_SAMPLE_DIR;
	const dbbBytes = await fs.readFile(path.join(dir, `${name}.DBB`));
	const mdbBytes = await fs.readFile(path.join(dir, `${name}.MDB`));
	const { default: MDBReader } = await import("../src/import/parsers/technet/gndEdit/mdb/node_modules/mdb-reader/lib/node/index.js");
	const { extractGndMdb } = await import("../src/import/parsers/technet/gndEdit/gnd/extractGndMdb.js");
	const dbb = await extractGndDbb({ bytes: dbbBytes, fileName: `${name}.DBB` });
	const mdb = await extractGndMdb({ bytes: mdbBytes, fileName: `${name}.MDB`, MDBReader, coreTableNames: core });
	const mdbTables = envelopeToGndTables(mdb);
	let roundedFields = 0;
	for (const table of dbb.tables) {
		assert.equal(table.rows.length, mdbTables[table.name].length, table.name);
		for (const row of table.rows) {
			const keys = row.cells.filter((c) => ["PAD", "PAD1", "PAD2", "LSYS", "HSYS", "ELSYS", "EHSYS", "EKSYS"].includes(c.columnName));
			const candidates = mdbTables[table.name].filter((m) => keys.every((c) => String(m[c.columnName]).trim() === c.value));
			assert.equal(candidates.length, 1, `${table.name}:${row.ordinal}`);
			for (const c of row.cells.filter((c) => /^(PAD[12]?|PART|PSTRECKE|PSTRRIKZ|STATION|[LEH]SYS|[YXH]|E[LHKU](SYS|TYP|PAR[1-4]|ARIWI|AKM|EKM))$/.test(c.columnName))) {
				const v = candidates[0][c.columnName];
				if (typeof c.value === "number") {
					const delta = Math.abs(c.value - Number(v));
					if (delta > 1e-8) roundedFields += 1;
					assert.ok(delta <= 0.5 * 10 ** -c.printedScale + 4 * Number.EPSILON * Math.max(1, Math.abs(c.value), Math.abs(v)), `${table.name}:${row.ordinal}:${c.columnName}`);
				} else assert.equal(String(v).trim(), c.value);
			}
		}
	}
	const a = parseGNDSourceEnvelope({ envelope: dbb }), b = parseGNDSourceEnvelope({ envelope: mdb });
	assert.deepEqual(a.alignments.map((x) => x.name), b.alignments.map((x) => x.name));
	assert.equal(a.extras.unresolvedAttachments.length, b.extras.unresolvedAttachments.length);
	for (let i = 0; i < a.alignments.length; i += 1) {
		const left = a.alignments[i], right = b.alignments[i];
		for (const key of ["family", "strecke", "strRikz", "lsys", "hsys", "padStart", "padEnd"]) assert.equal(left.extras.gndSequence[key], right.extras.gndSequence[key]);
		compareGeometry(left.coordGeom, right.coordGeom);
	}
	const input = file(`${name}.DBB`, dbbBytes);
	const result = await runImportPipeline(input, { bytes: dbbBytes });
	assert.equal(result.ok, true);
	const reference = buildImportResultFromParsed({ parsed: b, source: { parserId: "gndEdit", fileName: `${name}.MDB` } });
	const relationContract = (r) => r.relationCandidates.map((x) => ({ type: x.type, family: x.source?.family, pads: x.source?.directedPadChain, toId: x.toId }));
	assert.deepEqual(relationContract(result), relationContract(reference));
	assert.deepEqual(result.items.map((x) => [x.kind, x.payload.name]), reference.items.map((x) => [x.kind, x.payload.name]));
	t.diagnostic(`${dbb.dbb.recordCount} records; ${result.items.length} items; ${roundedFields} rounded source fields; ${result.relationCandidates.length} source-association candidates`);
});

function compareGeometry(a, b) {
	if (typeof a === "number" && typeof b === "number") return assert.ok(Math.abs(a - b) <= 0.00002, `${a} != ${b}`);
	if (Array.isArray(a)) { assert.equal(a.length, b.length); return a.forEach((value, i) => compareGeometry(value, b[i])); }
	if (a && typeof a === "object") { assert.deepEqual(Object.keys(a), Object.keys(b)); return Object.keys(a).forEach((key) => compareGeometry(a[key], b[key])); }
	assert.equal(a, b);
}
