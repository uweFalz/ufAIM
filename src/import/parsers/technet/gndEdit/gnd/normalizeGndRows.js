// src/import/parsers/technet/gndEdit/gnd/normalizeGndRows.js

export function normalizeGndRow(row, { sheetName, rowIndex } = {}) {
	const out = {};

	for (const [k, v] of Object.entries(row ?? {})) {
		out[String(k ?? "").trim()] = normalizeGndCellValue(v);
	}

	out.__sheet = sheetName ?? null;
	out.__rowIndex = rowIndex ?? null;

	return out;
}

export function normalizeGndCellValue(v) {
	if (v == null) return null;

	if (typeof v === "string") {
		const s = v.trim();
		if (!s) return null;

		if (/^[+-]?\d+(?:[.,]\d+)?$/.test(s)) {
			const n = Number(s.replace(",", "."));
			if (Number.isFinite(n)) return n;
		}

		return s;
	}

	if (typeof v === "number") return Number.isFinite(v) ? v : null;
	if (typeof v === "boolean") return v;

	return v;
}
