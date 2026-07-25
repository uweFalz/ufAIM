import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import MDBReader from "../src/import/parsers/technet/gndEdit/mdb/node_modules/mdb-reader/lib/node/index.js";
import { extractGndMdb } from "../src/import/parsers/technet/gndEdit/gnd/extractGndMdb.js";
import { comparePairedGndEnvelopes } from "../src/import/parsers/technet/gndEdit/gnd/comparePairedGndEnvelopes.js";
import { createGndSourceEnvelope, digestGndEnvelope } from "../src/import/parsers/technet/gndEdit/gnd/gndSourceEnvelope.js";
import { validateGndSourceEnvelope } from "../src/import/parsers/technet/gndEdit/gnd/validateGndSourceEnvelope.js";
import { installFileDrop } from "../app/io/input/fileDrop.js";

const CORE = ["X_ASC11_PP", "X_ASC12_PL", "X_ASC13_PH", "X_ASC21_EL", "X_ASC22_EH", "X_ASC23_EU", "X_ASC24_EK"];
const REQUIRED = {
	X_ASC11_PP: ["PAD"], X_ASC12_PL: ["PAD", "LSYS", "Y", "X"], X_ASC13_PH: ["PAD", "HSYS", "H"],
	X_ASC21_EL: ["PAD1", "PAD2", "ELTYP"], X_ASC22_EH: ["PAD1", "PAD2", "EHTYP"],
	X_ASC23_EU: ["PAD1", "PAD2", "EUTYP"], X_ASC24_EK: ["PAD1", "PAD2", "EKTYP"],
};

const FIXTURES = new URL("./fixtures/gnd-mdb/", import.meta.url);

async function extractFixture(name) {
	const bytes = await fs.readFile(new URL(name, FIXTURES));
	return extractGndMdb({ bytes, fileName: name, MDBReader, coreTableNames: CORE });
}

test("physical Jet fixtures extract through mdb-reader with stable typed evidence", async () => {
	const one = await extractFixture("valid-minimal-jet4.mdb");
	const two = await extractFixture("valid-minimal-jet4.mdb");
	assert.equal(validateGndSourceEnvelope(one, { requireCompleteCore: true }).ok, true);
	assert.equal(one.inventory.length, 7);
	assert.equal(await digestGndEnvelope(one), await digestGndEnvelope(two));
	const cells = one.tables.flatMap((table) => table.rows.flatMap((row) => row.cells));
	assert.ok(["null", "empty", "zero", "false"].every((state) => cells.some((cell) => cell.state === state)));
	assert.ok(cells.some((cell) => cell.columnName === "EHPAR1" && cell.value === 100.12345678901234));
	assert.ok(cells.some((cell) => cell.columnName === "EUPAR3" && cell.value === 0.12000000000000002));
	assert.ok(one.tables.flatMap((table) => table.columns).some((column) => column.declaredType === "boolean"));
	assert.ok(cells.some((cell) => cell.columnName === "EHTYP" && cell.value === 999));
});

test("physical missing-core and conflicting-evidence fixtures retain structural truth", async () => {
	const missing = await extractFixture("missing-core-jet4.mdb");
	assert.equal(missing.inventory.length, 6);
	assert.deepEqual(missing.diagnostics, [{ code: "GND_CORE_TABLE_ABSENT", table: "X_ASC13_PH" }]);
	assert.throws(() => validateGndSourceEnvelope(missing, { requireCompleteCore: true }), { code: "GND_SOURCE_INCOMPLETE" });
	const conflict = await extractFixture("conflicting-evidence-jet4.mdb");
	assert.equal(validateGndSourceEnvelope(conflict, { requireCompleteCore: true }).ok, true);
	const pl = conflict.tables.find((table) => table.name === "X_ASC12_PL");
	assert.deepEqual([...new Set(pl.rows.map((row) => row.cells.find((cell) => cell.columnName === "LSYS")?.value))].sort(), ["CONFLICT_LSYS", "SYNTH_LSYS"]);
});

test("physical valid fixture yields deterministic corrupt, size-limit and timeout failures", async () => {
	const original = await fs.readFile(new URL("valid-minimal-jet4.mdb", FIXTURES));
	const corrupt = Buffer.from(original);
	corrupt.fill(0xff, 6144, 10240);
	await assert.rejects(extractGndMdb({ bytes: corrupt, fileName: "corrupt-page.mdb", MDBReader, coreTableNames: CORE }), { code: "MDB_CORRUPT" });
	await assert.rejects(extractGndMdb({ bytes: original, fileName: "over-limit.mdb", MDBReader, coreTableNames: CORE, limits: { maxFileBytes: 32 } }), { code: "MDB_LIMIT_FILE_SIZE" });
	await assert.rejects(extractGndMdb({ bytes: original, fileName: "timeout.mdb", MDBReader, coreTableNames: CORE, limits: { maxExecutionMs: -1 } }), { code: "MDB_LIMIT_TIME" });
});

function jetBytes(version = 1, length = 64) {
	const bytes = new Uint8Array(length); bytes.set(new TextEncoder().encode("Standard Jet DB"), 4); new DataView(bytes.buffer).setUint32(0x14, version, true); return bytes;
}

class SyntheticReader {
	constructor() { this.tables = new Map(CORE.map((name) => [name, new SyntheticTable(name)])); }
	getPassword() { return null; }
	getTableNames() { return [...this.tables.keys(), "EXTRA_INVENTORY_ONLY"]; }
	getTable(name) { return this.tables.get(name) ?? new SyntheticTable(name); }
}
class SyntheticTable {
	constructor(name) { this.name = name; this.fields = REQUIRED[name] ?? ["IGNORED"]; this.rowCount = 1; }
	getColumns() { return this.fields.map((name) => ({ name, type: /TYP$/.test(name) ? "integer" : "double", nullable: false, size: 8 })); }
	getData() { return [Object.fromEntries(this.fields.map((name, index) => [name, /PAD/.test(name) ? `P${index}` : /SYS/.test(name) ? "L1" : /TYP$/.test(name) ? 999 : index === 0 ? 0 : index + 0.123456789]))]; }
}

test("synthetic Jet 4 extraction is deterministic, precise and inventory-complete", async () => {
	const one = await extractGndMdb({ bytes: jetBytes(), fileName: "synthetic.mdb", MDBReader: SyntheticReader, coreTableNames: CORE });
	const two = await extractGndMdb({ bytes: jetBytes(), fileName: "synthetic.mdb", MDBReader: SyntheticReader, coreTableNames: CORE });
	assert.equal(one.source.format, "Jet 4 MDB"); assert.equal(one.inventory.length, 8); assert.equal(one.tables.length, 7);
	assert.equal(validateGndSourceEnvelope(one, { requireCompleteCore: true }).ok, true);
	assert.equal(await digestGndEnvelope(one), await digestGndEnvelope(two));
	assert.ok(one.tables.flatMap((table) => table.rows).flatMap((row) => row.cells).some((cell) => cell.value === 2.123456789));
});

test("null, empty, missing core, corrupt, encrypted, limits and timeout reject visibly", async () => {
	class Protected extends SyntheticReader { getPassword() { return "detected"; } }
	await assert.rejects(extractGndMdb({ bytes: jetBytes(), fileName: "protected.mdb", MDBReader: Protected, coreTableNames: CORE }), { code: "MDB_ENCRYPTED_UNSUPPORTED" });
	await assert.rejects(extractGndMdb({ bytes: new Uint8Array(8), MDBReader: SyntheticReader, coreTableNames: CORE }), { code: "MDB_TRUNCATED" });
	await assert.rejects(extractGndMdb({ bytes: jetBytes(2), MDBReader: SyntheticReader, coreTableNames: CORE }), { code: "MDB_FORMAT_UNSUPPORTED" });
	await assert.rejects(extractGndMdb({ bytes: jetBytes(), MDBReader: SyntheticReader, coreTableNames: CORE, limits: { maxFileBytes: 32 } }), { code: "MDB_LIMIT_FILE_SIZE" });
	await assert.rejects(extractGndMdb({ bytes: jetBytes(), MDBReader: SyntheticReader, coreTableNames: CORE, limits: { maxExecutionMs: -1 } }), { code: "MDB_LIMIT_TIME" });
	const envelope = await extractGndMdb({ bytes: jetBytes(), MDBReader: SyntheticReader, coreTableNames: CORE });
	envelope.tables.pop();
	assert.throws(() => validateGndSourceEnvelope(envelope, { requireCompleteCore: true }), { code: "GND_SOURCE_INCOMPLETE" });
	const cell = envelope.tables[0].rows[0].cells[0]; cell.state = "empty"; cell.value = "";
	assert.throws(() => validateGndSourceEnvelope(envelope, { requireCompleteCore: true }), { code: "GND_SOURCE_INCOMPLETE" });
});

test("verified pair comparison classifies 297 round-6 transformations without mutation", () => {
	const make = (format, rounded) => createGndSourceEnvelope({ source: { fileName: format, byteLength: 1, sha256: format, container: format, format }, extractor: { id: format, version: "1" }, inventory: [], tables: [
		{ name: "X_ASC22_EH", ordinal: 0, columns: [], rows: Array.from({ length: 297 }, (_, ordinal) => ({ ordinal, cells: [
			{ columnName: "PAD1", value: `P${ordinal}`, state: "value" }, { columnName: "PAD2", value: `Q${ordinal}`, state: "value" },
			{ columnName: "EHPAR1", value: rounded ? Number((ordinal + 0.123456789).toFixed(6)) : ordinal + 0.123456789, state: "value" },
		] })) },
	] });
	const mdb = make("Jet 4 MDB", false), xlsx = make("XLSX", true), before = structuredClone({ mdb, xlsx });
	assert.throws(() => comparePairedGndEnvelopes({ mdb, xlsx }), /pairing evidence/i);
	const result = comparePairedGndEnvelopes({ mdb, xlsx, pairingEvidence: { verified: true } });
	assert.equal(result.transformations.length, 297); assert.deepEqual({ mdb, xlsx }, before);
});

test("MDB drop is handed to the normal local import callback", async () => {
	const listeners = new Map();
	const element = { addEventListener: (name, handler) => listeners.set(name, handler) };
	let received = null;
	installFileDrop({ element, onFiles: async (files) => { received = files; } });
	const file = { name: "synthetic.mdb", arrayBuffer: async () => jetBytes().buffer };
	await listeners.get("drop")({ preventDefault() {}, stopPropagation() {}, dataTransfer: { files: [file] } });
	assert.deepEqual(received, [file]);
});
