// src/import/parsers/technet/gndEdit/gnd/readGndXlsxTables.js

import * as XLSX from "sheetjs";
import { normalizeGndRow } from "./normalizeGndRows.js";

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
	const tables = readRelevantSheets(wb, sheetNames);

	return {
		workbookInfo,
		tables,
	};
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
