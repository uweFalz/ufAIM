import { GND_CELL_STATES } from "./gndSourceEnvelope.js";
import { TECHNET_SHEET_NAMES } from "../../sharedTechnet.js";

const REQUIRED = Object.freeze({
	[TECHNET_SHEET_NAMES.PP]: ["PAD"],
	[TECHNET_SHEET_NAMES.PL]: ["PAD", "LSYS", "Y", "X"],
	[TECHNET_SHEET_NAMES.PH]: ["PAD", "HSYS", "H"],
	[TECHNET_SHEET_NAMES.EL]: ["PAD1", "PAD2", "ELTYP"],
	[TECHNET_SHEET_NAMES.EH]: ["PAD1", "PAD2", "EHTYP"],
	[TECHNET_SHEET_NAMES.EU]: ["PAD1", "PAD2", "EUTYP"],
	[TECHNET_SHEET_NAMES.EK]: ["PAD1", "PAD2", "EKTYP"],
});

export function validateGndSourceEnvelope(envelope, { requireCompleteCore = false } = {}) {
	if (envelope?.type !== "GndTypedSourceEnvelope") throw coded("GND_ENVELOPE_INVALID", "Typed GND source envelope is missing");
	const byName = new Map((envelope.tables ?? []).map((table) => [table.name, table]));
	const diagnostics = [];
	for (const [tableName, fields] of Object.entries(REQUIRED)) {
		const table = byName.get(tableName);
		if (!table) { diagnostics.push({ code: "GND_CORE_TABLE_ABSENT", table: tableName }); continue; }
		const columns = new Set(table.columns.map((column) => column.name));
		for (const field of fields) {
			if (!columns.has(field)) { diagnostics.push({ code: "GND_REQUIRED_FIELD_ABSENT", table: tableName, field }); continue; }
			for (const row of table.rows) {
				const cell = row.cells.find((candidate) => candidate.columnName === field);
				if (!cell || [GND_CELL_STATES.ABSENT, GND_CELL_STATES.UNREADABLE, GND_CELL_STATES.NULL, GND_CELL_STATES.EMPTY].includes(cell.state)) diagnostics.push({ code: "GND_REQUIRED_FIELD_UNREADABLE", table: tableName, field, rowOrdinal: row.ordinal });
			}
		}
	}
	if (requireCompleteCore && diagnostics.length) {
		const error = coded("GND_SOURCE_INCOMPLETE", "MDB does not contain complete readable GND core evidence");
		error.diagnostics = diagnostics;
		throw error;
	}
	return { ok: diagnostics.length === 0, diagnostics };
}

function coded(code, message) { const error = new Error(message); error.code = code; return error; }
