export function comparePairedGndEnvelopes({ mdb, xlsx, pairingEvidence } = {}) {
	if (!pairingEvidence?.verified) throw new Error("Verified pairing evidence is required");
	const xTables = new Map((xlsx?.tables ?? []).map((table) => [table.name, table]));
	const transformations = [];
	for (const mt of mdb?.tables ?? []) {
		const xt = xTables.get(mt.name);
		if (!xt || mt.rows.length !== xt.rows.length) continue;
		for (let rowOrdinal = 0; rowOrdinal < mt.rows.length; rowOrdinal += 1) {
			const mr = mt.rows[rowOrdinal], xr = xt.rows[rowOrdinal];
			if (!samePadMapping(mr, xr)) continue;
			const xc = new Map(xr.cells.map((cell) => [cell.columnName, cell]));
			for (const mc of mr.cells) {
				if (!/^(EHPAR|EUPAR)[1-4]$/.test(mc.columnName)) continue;
				const candidate = xc.get(mc.columnName);
				if (!candidate || typeof mc.value !== "number" || typeof candidate.value !== "number") continue;
				if (candidate.value === Number(mc.value.toFixed(6)) && !Object.is(candidate.value, mc.value)) transformations.push({ table: mt.name, field: mc.columnName, rowOrdinal: mr.ordinal, classification: "transformation-equivalent: decimal-rounding-6", mdbValue: mc.value, xlsxValue: candidate.value });
			}
		}
	}
	return { paired: true, rawValueEqual: transformations.length === 0, transformations };
}

function samePadMapping(a, b) {
	for (const name of ["PAD", "PAD1", "PAD2"]) {
		const av = a.cells.find((cell) => cell.columnName === name)?.value;
		const bv = b.cells.find((cell) => cell.columnName === name)?.value;
		if ((av !== undefined || bv !== undefined) && av !== bv) return false;
	}
	return true;
}
