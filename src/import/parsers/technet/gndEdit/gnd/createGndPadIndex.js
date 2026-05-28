// src/import/parsers/technet/gndEdit/gnd/createGndPadIndex.js

export function createGndPadIndex({ ppRows = [], plRows = [], phRows = [] } = {}) {
	const index = Object.create(null);

	for (const row of ppRows) {
		const pad = readPad(row, "PAD");
		if (!pad) continue;

		const entry = ensurePadEntry(index, pad);

		entry.ppRecords.push({
			strecke: asTrimmedString(row.STRECKE ?? row.PSTRECKE),
			strRikz: asTrimmedString(row.STRRIKZ ?? row.PSTRRIKZ),
			station: asTrimmedString(row.STATION),
			ref: refOf(row),
		});

		entry.refs.PP.push(refOf(row));
	}

	for (const row of plRows) {
		const pad = readPad(row, "PAD");
		if (!pad) continue;

		const entry = ensurePadEntry(index, pad);

		entry.plRecords.push({
			lsys: asTrimmedString(row.LSYS),
			easting: toFiniteNumber(row.Y),
			northing: toFiniteNumber(row.X),
			ref: refOf(row),
		});

		entry.refs.PL.push(refOf(row));
	}

	for (const row of phRows) {
		const pad = readPad(row, "PAD");
		if (!pad) continue;

		const entry = ensurePadEntry(index, pad);

		entry.phRecords.push({
			hsys: asTrimmedString(row.HSYS),
			elevation: toFiniteNumber(row.H),
			ref: refOf(row),
		});

		entry.refs.PH.push(refOf(row));
	}

	return index;
}

function ensurePadEntry(index, pad) {
	if (!index[pad]) {
		index[pad] = {
			pad,
			ppRecords: [],
			plRecords: [],
			phRecords: [],
			refs: { PP: [], PL: [], PH: [] },
		};
	}
	return index[pad];
}

function readPad(row, key) {
	return asTrimmedString(row?.[key]);
}

function refOf(row) {
	return `${row?.__sheet ?? "?"}:${row?.__rowIndex ?? "?"}`;
}

function asTrimmedString(v) {
	if (v == null) return null;
	const s = String(v).trim();
	return s || null;
}

function toFiniteNumber(v) {
	if (typeof v === "number" && Number.isFinite(v)) return v;

	if (typeof v === "string") {
		const n = Number(v.replace(",", "."));
		if (Number.isFinite(n)) return n;
	}

	return null;
}
