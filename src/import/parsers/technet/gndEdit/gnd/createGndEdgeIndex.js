// src/import/parsers/technet/gndEdit/gnd/createGndEdgeIndex.js

export function createGndEdgeIndex({
	elRows = [],
	ehRows = [],
	euRows = [],
	ekRows = [],
} = {}) {
	return {
		EL: buildEdgesFromSheet(elRows, "EL"),
		EH: buildEdgesFromSheet(ehRows, "EH"),
		EU: buildEdgesFromSheet(euRows, "EU"),
		EK: buildEdgesFromSheet(ekRows, "EK"),
	};
}

function buildEdgesFromSheet(rows, family) {
	return arr(rows)
		.map((row, i) => buildEdge(row, family, i))
		.filter(Boolean);
}

function buildEdge(row, family, rowIndex) {
	const padA = readPad(row, "PAD1");
	const padB = readPad(row, "PAD2");
	const typeCode = readFamilyTypeCode(row, family);

	if (!padA || !padB) return null;

	return {
		id: `${family}_${rowIndex + 1}`,

		family,

		padA,
		padB,

		required: {
			requiredLsys:
				family === "EL" ? valOrNull(row.ELSYS)
				: family === "EK" ? valOrNull(row.EKSYS)
				: null,

			requiredHsys:
				family === "EH" ? valOrNull(row.EHSYS)
				: null,
		},

		typeCode,

		arcLength:
			family === "EL" ? toFiniteNumber(row.ELPAR1)
			: family === "EK" ? toFiniteNumber(row.EKPAR1)
			: null,

		radiusA:
			family === "EL" ? toFiniteNumber(row.ELPAR2)
			: family === "EK" ? toFiniteNumber(row.EKPAR2)
			: null,

		radiusE:
			family === "EL" ? toFiniteNumber(row.ELPAR3)
			: family === "EK" ? toFiniteNumber(row.EKPAR3)
			: null,

		direction:
			family === "EL" ? toFiniteNumber(row.ELARIWI)
			: family === "EK" ? toFiniteNumber(row.EKARIWI)
			: null,

		parameters: readFamilyParameters(row, family),

		extras: {
			rowRef: refOf(row),

			kmStart:
				family === "EK"
					? toFiniteNumber(row.EKAKM)
					: null,

			kmEnd:
				family === "EK"
					? toFiniteNumber(row.EKEKM)
					: null,
		},
	};
}

function readFamilyParameters(row, family) {
	const prefix = family === "EL" ? "ELPAR" : family === "EK" ? "EKPAR" : family === "EH" ? "EHPAR" : family === "EU" ? "EUPAR" : null;
	if (!prefix) return {};
	return {
		par1: toFiniteNumber(row?.[`${prefix}1`]),
		par2: toFiniteNumber(row?.[`${prefix}2`]),
		par3: toFiniteNumber(row?.[`${prefix}3`]),
		par4: toFiniteNumber(row?.[`${prefix}4`]),
	};
}

function readFamilyTypeCode(row, family) {
	const field = family === "EL" ? "ELTYP" : family === "EK" ? "EKTYP" : family === "EH" ? "EHTYP" : family === "EU" ? "EUTYP" : null;
	return field ? toFiniteNumber(row?.[field]) : null;
}

function arr(x) {
	return Array.isArray(x) ? x : [];
}

function valOrNull(v) {
	return v == null || v === "" ? null : v;
}

function asTrimmedString(v) {
	if (v == null) return null;

	const s = String(v).trim();

	return s || null;
}

function readPad(row, key) {
	return asTrimmedString(row?.[key]);
}

function refOf(row) {
	return `${row?.__sheet ?? "?"}:${row?.__rowIndex ?? "?"}`;
}

function toFiniteNumber(v) {
	if (typeof v === "number" && Number.isFinite(v)) {
		return v;
	}

	if (typeof v === "string") {
		const n = Number(v.replace(",", "."));

		if (Number.isFinite(n)) {
			return n;
		}
	}

	return null;
}
