const ENVELOPE_VERSION = 1;

export const GND_CELL_STATES = Object.freeze({
	NULL: "null", EMPTY: "empty", ZERO: "zero", FALSE: "false",
	VALUE: "value", UNREADABLE: "unreadable", ABSENT: "absent",
});

export function createGndSourceEnvelope({ source, extractor, inventory, tables, diagnostics = [] }) {
	return {
		type: "GndTypedSourceEnvelope",
		version: ENVELOPE_VERSION,
		derivedEvidence: true,
		originalSourceRetained: false,
		source: {
			fileName: String(source.fileName ?? ""),
			byteLength: Number(source.byteLength),
			sha256: String(source.sha256 ?? ""),
			container: String(source.container ?? "unknown"),
			format: String(source.format ?? "unknown"),
		},
		extractor: { id: String(extractor.id), version: String(extractor.version) },
		inventory,
		tables,
		diagnostics,
	};
}

export function encodeGndCell(value, { present = true, declaredType = null } = {}) {
	if (!present) return { state: GND_CELL_STATES.ABSENT, value: null };
	if (value === null || value === undefined) return { state: GND_CELL_STATES.NULL, value: null };
	if (typeof value === "string" && value.length === 0) return { state: GND_CELL_STATES.EMPTY, value: "" };
	if (value === false) return { state: GND_CELL_STATES.FALSE, value: false };
	if ((value === 0 || value === "0") && declaredType !== "text") return { state: GND_CELL_STATES.ZERO, value };
	if (value instanceof Uint8Array) return { state: GND_CELL_STATES.VALUE, value: value.slice(), binaryByteLength: value.byteLength };
	if (value instanceof Date) return { state: GND_CELL_STATES.VALUE, value: value.toISOString() };
	if (["string", "number", "boolean"].includes(typeof value)) return { state: GND_CELL_STATES.VALUE, value };
	return { state: GND_CELL_STATES.UNREADABLE, value: null, sourceKind: typeof value };
}

export function envelopeToGndTables(envelope) {
	const out = {};
	for (const table of envelope?.tables ?? []) {
		out[table.name] = table.rows.map((row) => {
			const record = {};
			for (const cell of row.cells) {
				if (cell.state !== GND_CELL_STATES.ABSENT && cell.state !== GND_CELL_STATES.UNREADABLE) {
					record[cell.columnName] = cell.value;
				}
			}
			record.__sheet = table.name;
			record.__rowIndex = row.ordinal;
			return record;
		});
	}
	return out;
}

export async function digestGndEnvelope(envelope) {
	const canonical = canonicalJson(envelope);
	const bytes = new TextEncoder().encode(canonical);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function canonicalJson(value) {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
	}
	return JSON.stringify(value);
}
