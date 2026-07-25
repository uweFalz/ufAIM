import { createGndSourceEnvelope, encodeGndCell } from "./gndSourceEnvelope.js";

export const GND_MDB_EXTRACTOR = Object.freeze({ id: "mdb-reader", version: "3.2.0" });
export const DEFAULT_MDB_LIMITS = Object.freeze({
	maxFileBytes: 64 * 1024 * 1024,
	maxTables: 128,
	maxRowsPerTable: 1_000_000,
	maxTotalRows: 2_000_000,
	maxMemoBytes: 4 * 1024 * 1024,
	maxBinaryBytes: 4 * 1024 * 1024,
	batchRows: 2_000,
	maxExecutionMs: 30_000,
});

export async function extractGndMdb({ bytes, fileName, MDBReader, coreTableNames, limits = {} }) {
	const started = performance.now();
	const config = { ...DEFAULT_MDB_LIMITS, ...limits };
	const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	if (input.byteLength > config.maxFileBytes) throw coded("MDB_LIMIT_FILE_SIZE", "MDB exceeds configured file-size limit");
	const detectedFormat = classifyHeader(input);
	const sha256 = await hash(input);
	let reader;
	try { reader = new MDBReader(input); } catch (error) { throw classifyReaderError(error); }
	if (reader.getPassword?.()) throw coded("MDB_ENCRYPTED_UNSUPPORTED", "Password-protected MDB is outside this spike boundary");
	const names = reader.getTableNames();
	if (names.length > config.maxTables) throw coded("MDB_LIMIT_TABLE_COUNT", "MDB exceeds configured table-count limit");
	const inventory = [];
	const tables = [];
	let totalRows = 0;
	for (let tableOrdinal = 0; tableOrdinal < names.length; tableOrdinal += 1) {
		checkTime(started, config);
		const name = names[tableOrdinal];
		const table = reader.getTable(name);
		const columns = table.getColumns().map((column, columnOrdinal) => ({
			name: column.name, ordinal: columnOrdinal, declaredType: column.type,
			nullable: column.nullable ?? null, size: column.size ?? null,
			precision: column.precision ?? null, scale: column.scale ?? null,
			schemaEvidenceUnavailable: [],
		}));
		inventory.push({ name, ordinal: tableOrdinal, rowCount: table.rowCount, columnCount: columns.length, interpreted: coreTableNames.includes(name) });
		if (!coreTableNames.includes(name)) continue;
		if (table.rowCount > config.maxRowsPerTable) throw coded("MDB_LIMIT_ROW_COUNT", `Table ${name} exceeds configured row limit`);
		totalRows += table.rowCount;
		if (totalRows > config.maxTotalRows) throw coded("MDB_LIMIT_TOTAL_ROWS", "MDB exceeds configured total-row limit");
		const rows = [];
		for (let offset = 0; offset < table.rowCount; offset += config.batchRows) {
			checkTime(started, config);
			for (const [batchIndex, sourceRow] of table.getData({ rowOffset: offset, rowLimit: config.batchRows }).entries()) {
				const cells = columns.map((column) => {
					const value = sourceRow[column.name];
					if (value instanceof Uint8Array && value.byteLength > config.maxBinaryBytes) throw coded("MDB_LIMIT_BINARY_SIZE", `Binary value exceeds limit in ${name}`);
					if (column.declaredType === "memo" && typeof value === "string" && new TextEncoder().encode(value).byteLength > config.maxMemoBytes) throw coded("MDB_LIMIT_MEMO_SIZE", `Memo value exceeds limit in ${name}`);
					return { columnName: column.name, columnOrdinal: column.ordinal, ...encodeGndCell(value, { present: Object.hasOwn(sourceRow, column.name), declaredType: column.declaredType }) };
				});
				rows.push({ ordinal: offset + batchIndex, cells });
			}
			await Promise.resolve();
		}
		tables.push({ name, ordinal: tableOrdinal, columns, rows });
	}
	return createGndSourceEnvelope({
		source: { fileName, byteLength: input.byteLength, sha256, container: "Microsoft Access database", format: detectedFormat },
		extractor: GND_MDB_EXTRACTOR, inventory, tables,
		diagnostics: coreTableNames.filter((name) => !names.includes(name)).map((name) => ({ code: "GND_CORE_TABLE_ABSENT", table: name })),
	});
}

function classifyHeader(bytes) {
	if (bytes.byteLength < 32) throw coded("MDB_TRUNCATED", "MDB header is truncated");
	const signature = new TextDecoder("latin1").decode(bytes.slice(4, 19));
	if (signature !== "Standard Jet DB") throw coded("MDB_FORMAT_UNSUPPORTED", "Input is not an unencrypted Jet MDB");
	const version = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0x14, true);
	if (version === 0) return "Jet 3 MDB";
	if (version === 1) return "Jet 4 MDB";
	throw coded("MDB_FORMAT_UNSUPPORTED", "Access container is outside the supported Jet 3/4 MDB boundary");
}
function checkTime(started, limits) { if (performance.now() - started > limits.maxExecutionMs) throw coded("MDB_LIMIT_TIME", "MDB extraction timed out"); }
function coded(code, message) { const error = new Error(message); error.code = code; return error; }
function classifyReaderError(error) {
	const message = String(error?.message ?? error);
	if (/password|encrypt|codec/i.test(message)) return coded("MDB_ENCRYPTED_UNSUPPORTED", "Encrypted or password-protected MDB is unsupported");
	return coded("MDB_CORRUPT", `MDB extraction failed: ${message}`);
}
async function hash(bytes) { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
