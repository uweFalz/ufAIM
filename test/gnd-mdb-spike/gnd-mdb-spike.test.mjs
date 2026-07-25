import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import MDBReader from "mdb-reader";
import XLSX from "xlsx";
import { extractGndMdb } from "../../src/import/parsers/technet/gndEdit/gnd/extractGndMdb.js";
import { digestGndEnvelope, encodeGndCell } from "../../src/import/parsers/technet/gndEdit/gnd/gndSourceEnvelope.js";

const CORE = ["X_ASC11_PP", "X_ASC12_PL", "X_ASC13_PH", "X_ASC21_EL", "X_ASC22_EH", "X_ASC23_EU", "X_ASC24_EK"];
const PRIVATE_SAMPLE = new URL("../samples/2631KN-KX_3010GC-GD.MDB", import.meta.url);
const PRIVATE_XLSX = new URL("../samples/2631KN-KX_3010GC-GD.xlsx", import.meta.url);

test("cell evidence distinguishes null, empty, zero, false and absent", () => {
	assert.deepEqual([encodeGndCell(null).state, encodeGndCell("").state, encodeGndCell(0).state, encodeGndCell(false).state, encodeGndCell(null, { present: false }).state], ["null", "empty", "zero", "false", "absent"]);
	assert.equal(encodeGndCell("123.4500").value, "123.4500");
});

test("paired delivery exposes source-representation numeric differences rather than hiding them", async (t) => {
	let mdbBytes, xlsxBytes;
	try { [mdbBytes, xlsxBytes] = await Promise.all([readFile(PRIVATE_SAMPLE), readFile(PRIVATE_XLSX)]); } catch { return t.skip("local paired delivery unavailable"); }
	const reader = new MDBReader(mdbBytes);
	const workbook = XLSX.read(xlsxBytes, { type: "buffer", raw: false, cellDates: false });
	let differingRelevantNumericCells = 0;
	for (const tableName of ["X_ASC22_EH", "X_ASC23_EU"]) {
		const table = reader.getTable(tableName);
		const mdbRows = table.getData();
		const xlsxRows = XLSX.utils.sheet_to_json(workbook.Sheets[tableName], { defval: null, raw: false });
		assert.equal(mdbRows.length, xlsxRows.length);
		for (let row = 0; row < mdbRows.length; row += 1) {
			for (const column of table.getColumnNames().filter((name) => /^(EHTYP|EUTYP|EHPAR[1-4]|EUPAR[1-4])$/.test(name))) {
				if (Number(mdbRows[row][column]) !== Number(xlsxRows[row][column])) differingRelevantNumericCells += 1;
			}
		}
	}
	assert.ok(differingRelevantNumericCells > 0, "the paired sources unexpectedly became numerically identical");
});

test("truncated, corrupt and oversized inputs fail with visible classifications", async () => {
	await assert.rejects(extractGndMdb({ bytes: new Uint8Array(8), fileName: "truncated.mdb", MDBReader, coreTableNames: CORE }), { code: "MDB_TRUNCATED" });
	await assert.rejects(extractGndMdb({ bytes: new Uint8Array(64), fileName: "corrupt.mdb", MDBReader, coreTableNames: CORE }), { code: "MDB_FORMAT_UNSUPPORTED" });
	await assert.rejects(extractGndMdb({ bytes: new Uint8Array(65), fileName: "large.mdb", MDBReader, coreTableNames: CORE, limits: { maxFileBytes: 64 } }), { code: "MDB_LIMIT_FILE_SIZE" });
});

test("local private MDB extracts deterministically without logging values", async (t) => {
	let bytes;
	try { bytes = await readFile(PRIVATE_SAMPLE); } catch { return t.skip("local provenance-cleared paired sample unavailable"); }
	const first = await extractGndMdb({ bytes, fileName: "private-local.mdb", MDBReader, coreTableNames: CORE });
	const second = await extractGndMdb({ bytes, fileName: "private-local.mdb", MDBReader, coreTableNames: CORE });
	assert.equal(await digestGndEnvelope(first), await digestGndEnvelope(second));
	assert.deepEqual(first.inventory.filter((table) => table.interpreted).map((table) => table.name).sort(), CORE.slice().sort());
	assert.equal(first.tables.length, 7);
});
