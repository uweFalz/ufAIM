// src/import/parsers/technet/gndEdit/gnd/readGndXlsxTables.js

import * as XLSX from "sheetjs";
import { normalizeGndRow } from "./normalizeGndRows.js";
import { createGndSourceEnvelope, encodeGndCell, envelopeToGndTables } from "./gndSourceEnvelope.js";

export async function readGndXlsxTables({
	file,
	bytes,
	sheetNames,
} = {}) {
	const arrayBuffer =
		bytes instanceof Uint8Array
			? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
			: bytes instanceof ArrayBuffer
				? bytes
				: file
					? await file.arrayBuffer()
					: null;

	if (!arrayBuffer) {
		throw new Error("readGndXlsxTables: missing bytes/arrayBuffer");
	}

	const wb = XLSX.read(arrayBuffer, {
		type: "array",
		cellDates: false,
		raw: false,
	});

	const workbookInfo = summarizeWorkbook(wb);
	const envelope = await workbookToEnvelope({ wb, arrayBuffer, fileName: file?.name ?? "unknown.xlsx", sheetNames });
	const tables = Object.fromEntries(Object.entries(envelopeToGndTables(envelope)).map(([name, rows]) => [name, rows.map((row) => normalizeGndRow(row, { sheetName: name, rowIndex: row.__rowIndex }))]));

	return {
		workbookInfo,
		tables,
		envelope,
	};
}

async function workbookToEnvelope({ wb, arrayBuffer, fileName, sheetNames }) {
	const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
	const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
	const wanted = new Set(Object.values(sheetNames ?? {}));
	const inventory = wb.SheetNames.map((name, ordinal) => ({ name, ordinal, interpreted: wanted.has(name) }));
	const tables = wb.SheetNames.filter((name) => wanted.has(name)).map((name) => {
		const matrix = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true, blankrows: false });
		const names = (matrix[0] ?? []).map((value) => String(value ?? "").trim());
		const columns = names.map((columnName, ordinal) => ({ name: columnName, ordinal, declaredType: "xlsx-formatted", nullable: null, size: null, precision: null, scale: null, schemaEvidenceUnavailable: ["nullability", "size", "precision", "scale"] }));
		const rows = matrix.slice(1).map((values, index) => ({ ordinal: index + 2, cells: columns.map((column) => ({ columnName: column.name, columnOrdinal: column.ordinal, ...encodeGndCell(values[column.ordinal], { present: column.ordinal < values.length }) })) }));
		return { name, ordinal: wb.SheetNames.indexOf(name), columns, rows };
	});
	return createGndSourceEnvelope({ source: { fileName, byteLength: arrayBuffer.byteLength, sha256, container: "ZIP/OOXML", format: "XLSX" }, extractor: { id: "SheetJS", version: "external-runtime" }, inventory, tables });
}

function summarizeWorkbook(wb) {
	const sheetNames = Array.isArray(wb?.SheetNames) ? wb.SheetNames.slice() : [];
	return { sheetNames, sheetCount: sheetNames.length };
}

function readRelevantSheets(wb, sheetNames = {}) {
	const out = {};

	for (const name of Object.values(sheetNames)) {
		const ws = wb?.Sheets?.[name] ?? null;
		out[name] = ws ? sheetToObjects(ws, name) : [];
	}

	return out;
}

function sheetToObjects(ws, sheetName) {
	const rows = XLSX.utils.sheet_to_json(ws, {
		defval: null,
		raw: false,
		blankrows: false,
	});

	return rows.map((row, index) =>
		normalizeGndRow(row, { sheetName, rowIndex: index + 2 })
	);
}
