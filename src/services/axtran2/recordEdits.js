// src/services/axtran2/recordEdits.js
//
// What the caller changes before the fit: a record's length or radius as
// the fit is to start from it. The file stays what it is; the fit begins
// from the changed value, and an edited record keeps its own element, so
// the boundaries around it survive. An edit holds nothing: what is held is
// the hold's business (heldRecords.js), and the two combine, "7L=45,2" with
// "7L" starts from 45,2 m and keeps it.
//
// Written as a person types it: the record number, L or R for the quantity,
// "=" and the value, several apart by space or comma: "7L=45,2 7R=-1250".
// A decimal comma is read; the radius carries the file's sign. A transition
// may change its type: "7T=Bloss", with Klothoide, Bloss or S-Form (Helmert),
// the three the TRA writer carries as Kz 2, 4 and 3.

export const RECORD_EDITS_VERSION = "axtran2/record-edits/0.2";

/** the transition families a record may be changed to, with the words for them */
export const TRANSITION_FAMILIES = Object.freeze({ clothoid: "Klothoide", bloss: "Bloss", helmert: "S-Form" });
const FAMILY_WORDS = Object.freeze({
	klothoide: "clothoid", klotoide: "clothoid", clothoid: "clothoid", clothoide: "clothoid",
	bloss: "bloss", "s-form": "helmert", sform: "helmert", helmert: "helmert", "üb s-form": "helmert", "ueb s-form": "helmert",
});
/** a word for a transition family to the family, or null */
export function familyOf(word) {
	return FAMILY_WORDS[String(word ?? "").trim().toLowerCase()] ?? null;
}

export class RecordEditsError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "RecordEditsError";
		this.code = code;
		this.detail = detail;
	}
}
const error = (code, message, detail) => { throw new RecordEditsError(code, message, detail); };

const toNumber = (text) => {
	const t = String(text).trim().replace("−", "-");
	if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) return NaN;
	return Number(t.replace(",", "."));
};

/**
 * The caller's edits as a Map of record number to { length?, radius? }:
 * from a string ("7L=45,2 7R=-1250"), an array of { record|number, length?, radius? },
 * or such a Map. Values are checked for being numbers here, against the file in resolveEdits.
 */
export function parseEdits(edits) {
	const map = new Map();
	const put = (n, field, value) => {
		if (!Number.isInteger(n) || n < 1) error("INVALID_EDIT", `"${n}" is not a record number`);
		if (field === "family") {
			const family = familyOf(value) ?? (TRANSITION_FAMILIES[value] ? value : null);
			if (!family) error("INVALID_EDIT", `record ${n}: "${value}" is not a transition type: ${Object.values(TRANSITION_FAMILIES).join(", ")}`);
			map.set(n, { ...(map.get(n) ?? {}), family });
			return;
		}
		if (!Number.isFinite(value)) error("INVALID_EDIT", `record ${n}: no readable ${field}: "${value}"`);
		map.set(n, { ...(map.get(n) ?? {}), [field]: value });
	};
	if (edits === null || edits === undefined) return map;
	if (typeof edits === "string") {
		for (const token of edits.split(/[\s;]+|,(?=\s*\d+\s*[lrt]\s*=)/i).map((t) => t.trim()).filter(Boolean)) {
			const m = /^(\d+)\s*([lrt])\s*=\s*(.+)$/i.exec(token);
			if (!m) error("INVALID_EDIT", `cannot read "${token}": write the record number, L, R or T, "=" and the value, as in 7L=45,2 or 7T=Bloss`);
			const kind = m[2].toUpperCase();
			if (kind === "T") { put(Number(m[1]), "family", m[3]); continue; }
			const value = toNumber(m[3]);
			if (Number.isNaN(value)) error("INVALID_EDIT", `cannot read the value in "${token}"`);
			put(Number(m[1]), kind === "L" ? "length" : "radius", value);
		}
		return map;
	}
	const entries = edits instanceof Map ? [...edits].map(([n, e]) => ({ record: Number(n), ...e })) : [...edits];
	for (const e of entries) {
		const n = Number(e.record ?? e.number);
		if (e.length !== undefined && e.length !== null) put(n, "length", Number(e.length));
		if (e.radius !== undefined && e.radius !== null) put(n, "radius", Number(e.radius));
		if (e.family !== undefined && e.family !== null) put(n, "family", e.family);
	}
	return map;
}

const trim = (value, digits) => value.toFixed(digits).replace(/\.?0+$/, "").replace(".", ",");

/** The edits as a person would type them, "7L=45,2 7R=-1250"; the inverse of parseEdits. */
export function formatEdits(edits) {
	const map = parseEdits(edits);
	return [...map.keys()].sort((a, b) => a - b).flatMap((n) => {
		const e = map.get(n);
		return [...(e.length !== undefined ? [`${n}L=${trim(e.length, 3)}`] : []), ...(e.radius !== undefined ? [`${n}R=${trim(e.radius, 3)}`] : []), ...(e.family !== undefined ? [`${n}T=${TRANSITION_FAMILIES[e.family]}`] : [])];
	}).join(" ");
}

/**
 * The edits checked against the file's records: the record exists and
 * carries a length, a length is positive, a radius belongs to an arc and is
 * not zero. Returns a Map of record number to frozen { length?, radius? }.
 */
export function resolveEdits(edits, records) {
	const map = parseEdits(edits);
	const out = new Map();
	for (const [n, e] of map) {
		if (n > records.length) error("INVALID_EDIT", `record ${n} does not exist: the file has ${records.length}`);
		const r = records[n - 1];
		if (r.type === "kink" || !(r.length > 0)) error("INVALID_EDIT", `record ${n} carries no length to change`);
		if (e.length !== undefined && !(e.length > 0)) error("INVALID_EDIT", `record ${n}: a length has to be positive, not ${e.length}`);
		if (e.radius !== undefined) {
			if (r.type !== "arc") error("INVALID_EDIT", `record ${n} is a ${r.type}: it has no radius to change`);
			if (!(Math.abs(e.radius) > 0)) error("INVALID_EDIT", `record ${n}: a radius cannot be zero`);
		}
		if (e.family !== undefined && r.type !== "transition") error("INVALID_EDIT", `record ${n} is a ${r.type}: only a transition has a type to change`);
		out.set(n, Object.freeze({ ...e }));
	}
	return out;
}
