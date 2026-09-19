import { createGndSourceEnvelope, encodeGndCell } from "./gndSourceEnvelope.js";

// Initial, deliberately bounded DBB dialect: the version-6 AGON exports
// corroborated by the paired Brenzbahn MDBs. Unknown records never disappear.
const HEADER = /^00 6AGON GND-Edit Export *$/;
const FIELD = (name, start, width, numeric = false) => ({ name, start, width, numeric });
const PAD = FIELD("PAD", 2, 11);
const ENDS = [FIELD("PAD1", 2, 11), FIELD("PAD2", 13, 11)];
const metadata = (prefix, start) => [
	FIELD(`${prefix}DATUM`, start, 8), FIELD(`${prefix}BEARB`, start + 8, 8),
	FIELD(`${prefix}AUFTR`, start + 16, 8), FIELD(`${prefix}PROG`, start + 24, 8),
	FIELD(`${prefix}TEXT`, start + 32, 20),
];
const edgeFields = (family, withDirection = false) => [
	...ENDS, FIELD(`${family}SYS`, 24, 3), FIELD(`${family}TYP`, 27, 2, true),
	...[1, 2, 3, 4].map((i) => FIELD(`${family}PAR${i}`, 29 + (i - 1) * 12, 12, true)),
	...(withDirection ? [FIELD(`${family}ARIWI`, 77, 10, true)] : []),
];
const SCHEMAS = {
	11: { family: "PP", minimum: 91, fields: [PAD, FIELD("PART", 13, 4), FIELD("VERMART", 17, 3, true), FIELD("STABIL", 20, 1, true), FIELD("STATION", 21, 13, true), ...metadata("P", 34), FIELD("PSTRECKE", 86, 4), FIELD("PSTRRIKZ", 90, 1, true)] },
	12: { family: "PL", minimum: 64, fields: [PAD, FIELD("LSTAT", 13, 1), FIELD("LSYS", 14, 3), FIELD("LFREMD", 17, 14), FIELD("Y", 31, 14, true), FIELD("X", 45, 14, true), FIELD("MP", 59, 3, true), FIELD("MPEXP", 62, 2, true), ...metadata("L", 64)] },
	13: { family: "PH", minimum: 50, fields: [PAD, FIELD("HSTAT", 13, 1), FIELD("HSYS", 14, 3), FIELD("HFREMD", 17, 14), FIELD("H", 31, 14, true), FIELD("MH", 45, 3, true), FIELD("MHEXP", 48, 2, true), ...metadata("H", 50)] },
	21: { family: "EL", minimum: 87, fields: [...edgeFields("EL", true), ...metadata("EL", 87)] },
	22: { family: "EH", minimum: 77, fields: [...edgeFields("EH"), ...metadata("EH", 77)] },
	23: { family: "EU", minimum: 64, fields: [...ENDS, FIELD("EUTYP", 24, 2, true), FIELD("EUPAR1", 26, 12, true), FIELD("EUPAR2", 38, 7, true), FIELD("EUPAR3", 45, 7, true), FIELD("EUPAR4", 52, 12, true), ...metadata("EU", 64)] },
	24: { family: "EK", minimum: 113, fields: [...edgeFields("EK", true), FIELD("EKAKM", 87, 13, true), FIELD("EKEKM", 100, 13, true), ...metadata("EK", 113)] },
};

export const DEFAULT_DBB_LIMITS = Object.freeze({ maxFileBytes: 8 * 1024 * 1024, maxRows: 100_000, maxLineLength: 1024, batchRows: 1000, maxExecutionMs: 30_000 });

export function looksLikeGndDbb(bytes) {
	if (!(bytes instanceof Uint8Array)) return false;
	return HEADER.test(new TextDecoder().decode(bytes.subarray(0, 128)).split(/\r?\n/, 1)[0]);
}

export async function extractGndDbb({ bytes, fileName = "unknown.dbb", limits = {}, signal, onHeartbeat } = {}) {
	const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? 0);
	const config = { ...DEFAULT_DBB_LIMITS, ...limits };
	for (const [key, value] of Object.entries(config)) {
		if (!Number.isFinite(value) || value <= 0 || (key !== "maxExecutionMs" && !Number.isInteger(value))) throw coded("DBB_LIMIT_CONFIG", `Invalid DBB limit: ${key}`);
	}
	const started = performance.now();
	const check = () => {
		if (signal?.aborted) { const error = coded("IMPORT_JOB_CANCELLED", "DBB import cancelled"); error.name = "AbortError"; throw error; }
		if (performance.now() - started > config.maxExecutionMs) throw coded("DBB_LIMIT_TIME", "DBB extraction timed out");
	};
	check();
	if (input.byteLength > config.maxFileBytes) throw coded("DBB_LIMIT_FILE_SIZE", "DBB exceeds configured file-size limit");
	if (input.some((byte, index) => byte >= 127 || (byte < 32 && byte !== 10 && byte !== 13) || (byte === 13 && input[index + 1] !== 10))) throw coded("DBB_ENCODING_UNSUPPORTED", "DBB requires ASCII text with LF or CRLF line endings");
	const text = new TextDecoder().decode(input);
	const lines = text.split(/\r?\n/);
	if (!HEADER.test(lines[0])) throw coded("DBB_FORMAT_UNSUPPORTED", "Expected version-6 AGON GND-Edit DBB export header", { line: 1 });
	if (lines.length > config.maxRows + 2) throw coded("DBB_LIMIT_ROW_COUNT", "DBB exceeds configured record-count limit");
	const digest = await crypto.subtle.digest("SHA-256", input);
	check();
	const tables = Object.entries(SCHEMAS).map(([recordType, schema], ordinal) => ({
		name: `X_ASC${recordType}_${schema.family}`, ordinal,
		columns: schema.fields.map((field, columnOrdinal) => ({ name: field.name, ordinal: columnOrdinal, declaredType: field.numeric ? "number" : "text", size: field.width, nullable: null, precision: null, scale: null, schemaEvidenceUnavailable: ["nullability"], sourceColumn: field.start + 1 })),
		rows: [],
	}));
	const byType = new Map(tables.map((table) => [table.name.slice(5, 7), table]));
	let count = 0;
	for (let index = 1; index < lines.length; index += 1) {
		check();
		const line = lines[index];
		if (index === lines.length - 1 && line === "") continue;
		if (line.length > config.maxLineLength) throw coded("DBB_LIMIT_LINE_LENGTH", "DBB record exceeds configured width", { line: index + 1 });
		const recordType = line.slice(0, 2);
		const schema = SCHEMAS[recordType];
		if (!schema) throw coded("DBB_RECORD_UNSUPPORTED", `Unsupported DBB record type ${JSON.stringify(recordType)}`, { line: index + 1, recordType });
		if (line.length < schema.minimum) throw coded("DBB_RECORD_TRUNCATED", `Truncated DBB record ${recordType}`, { line: index + 1, recordType });
		const table = byType.get(recordType);
		const cells = schema.fields.map((field, ordinal) => {
			const raw = line.slice(field.start, field.start + field.width);
			const token = raw.trim();
			if (field.numeric && token && (!/^[+-]?\d+(?:\.\d+)?$/.test(token) || !Number.isFinite(Number(token)))) throw coded("DBB_FIELD_INVALID", `Invalid DBB number in ${field.name}`, { line: index + 1, field: field.name });
			const value = field.numeric && token ? Number(token) : token;
			return { columnName: field.name, columnOrdinal: ordinal, ...encodeGndCell(value, { present: field.start < line.length, declaredType: field.numeric ? "number" : "text" }), rawLexeme: raw, sourceColumn: field.start + 1, ...(field.numeric && token ? { printedScale: (token.split(".")[1] ?? "").length } : {}) };
		});
		table.rows.push({ ordinal: table.rows.length, sourceLine: index + 1, rawRecord: line, cells });
		count += 1;
		if (count > config.maxRows) throw coded("DBB_LIMIT_ROW_COUNT", "DBB exceeds configured record-count limit");
		if (count % config.batchRows === 0) {
			onHeartbeat?.({ code: "dbb-records-extracting", rows: count });
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}
	check();
	if (!count) throw coded("DBB_EMPTY", "DBB export contains no data records");
	const envelope = createGndSourceEnvelope({
		source: { fileName, byteLength: input.byteLength, sha256: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""), container: "ASCII fixed-width", format: "DBB" },
		extractor: { id: "gnd-dbb-ascii-v6", version: "1" },
		inventory: tables.map((table) => ({ name: table.name, ordinal: table.ordinal, rowCount: table.rows.length, columnCount: table.columns.length, interpreted: true, sourceRecordFamilyPresent: table.rows.length > 0 })),
		tables,
	});
	// Absent record families have empty arrays, not invented records. Keep the
	// raw header/records and lexical precision; never fill in missing metadata.
	envelope.dbb = { header: lines[0], version: 6, encoding: "US-ASCII", recordCount: count, cantParameterUnit: "meter" };
	return envelope;
}

function coded(code, message, location = {}) { return Object.assign(new Error(message), { code, ...location }); }
