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
//
// The structure changes the same way: "-7" takes record 7 out, "+7=G:20"
// puts a straight of 20 m in after it, "+7=B:-500:30" an arc R -500 of
// 30 m (the file's sign), "+7=U:40" a clothoid of 40 m, "+7=U:40:Bloss" a
// Bloss. Inserted records are named after the record they follow, "7+1",
// "7+2"; a value of one of them is changed by changing its token.
//
// A turnout from the catalogue (Ril 800.0120A01) goes in as its branch:
// "+7=W:190-1/9:R" is an EW 190-1:9, the branch to the right, the arc
// first and its straight end piece after it (the track enters at the
// Weichenanfang); ":L" the branch to the left, ":WE" the end piece first
// (the track enters at the Weichenende), ":Bogen" the arc alone. Its two
// records are "7+1a" and "7+1b"; both are held, as a turnout is.

export const RECORD_EDITS_VERSION = "axtran2/record-edits/0.4";

import { turnoutShape, TURNOUT_SHAPES } from "./heldRecords.js";

/** the kinds a record may be inserted as, with their letters and words */
export const INSERT_TYPES = Object.freeze({ straight: "Gerade", arc: "Bogen", transition: "Übergangsbogen", turnout: "Weiche" });
const INSERT_LETTERS = Object.freeze({ g: "straight", b: "arc", u: "transition", "ü": "transition", w: "turnout" });
/** how an inserted turnout lies in the track */
export const TURNOUT_ORIENTATIONS = Object.freeze({ WA: "Bogen, dann Endstück", WE: "Endstück, dann Bogen", arc: "nur der Bogen" });
/** the key of the i-th record inserted after record n; `part` for the a/b of a turnout */
export const insertKey = (after, index, part = "") => `${after}+${index}${part}`;
/** true for the key of an inserted record */
export const isInsertKey = (key) => /^\d+\+\d+[ab]?$/.test(String(key));
/** the record an insert key follows, the index of the insert and its part, or null */
export function insertOf(key) {
	const m = /^(\d+)\+(\d+)([ab]?)$/.exec(String(key));
	return m ? { after: Number(m[1]), index: Number(m[2]), part: m[3] || null } : null;
}
/** "190-1/9" of a turnout spec, as the token writes it */
export const turnoutDesignation = (spec) => `EW ${spec.radius}-1:${spec.ratio}`;
const turnoutRef = (spec) => `${spec.radius}-1/${spec.ratio}`;
export { TURNOUT_SHAPES };

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
	if (edits && typeof edits === "object" && edits.values instanceof Map) return parseEdits(edits.values);
	if (typeof edits === "string") {
		for (const token of tokens(edits)) {
			if (/^[-+]/.test(token)) continue; // the structure: parseStructure reads it
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

const tokens = (text) => text.split(/[\s;]+|,(?=\s*[-+]?\d+\s*[lrt=]|\s*[-+]\d)/i).map((t) => t.trim()).filter(Boolean);
const trim = (value, digits) => value.toFixed(digits).replace(/\.?0+$/, "").replace(".", ",");

/**
 * What is taken out and what is put in: "-7" removes record 7, "+7=G:20"
 * inserts after it. From a string, or from { removed, inserted } as this
 * returns it.
 * @returns {{removed: Set<number>, inserted: Map<number, Array<{type: string, length: number, radius?: number, family?: string}>>}}
 */
export function parseStructure(edits) {
	const removed = new Set();
	const inserted = new Map();
	if (edits === null || edits === undefined) return { removed, inserted };
	if (typeof edits === "object" && !(typeof edits === "string")) {
		for (const n of edits.removed ?? []) removed.add(Number(n));
		for (const [n, list] of edits.inserted instanceof Map ? edits.inserted : Object.entries(edits.inserted ?? {})) inserted.set(Number(n), list.map((spec) => ({ ...spec })));
		return { removed, inserted };
	}
	for (const token of tokens(edits)) {
		const out = /^-(\d+)$/.exec(token);
		if (out) { removed.add(Number(out[1])); continue; }
		const put = /^\+(\d+)\s*=\s*([a-zäöü])[^:]*:(.+)$/i.exec(token);
		if (!put) { if (/^[-+]/.test(token)) error("INVALID_EDIT", `cannot read "${token}": write -7 to take a record out, or +7=G:20, +7=B:-500:30, +7=U:40:Bloss to put one in after it`); continue; }
		const after = Number(put[1]);
		const type = INSERT_LETTERS[put[2].toLowerCase()];
		if (!type) error("INVALID_EDIT", `"${token}": the kind is G (Gerade), B (Bogen) or U (Übergangsbogen)`);
		const parts = put[3].split(":").map((t) => t.trim());
		const spec = { type };
		if (type === "turnout") {
			const w = /^(?:EW\s*)?(\d+(?:\.\d+)?)-1[:/](\d+(?:\.\d+)?)(?::(L|R|links|rechts))?(?::(WA|WE|Bogen))?$/i.exec(put[3].trim());
			if (!w) error("INVALID_EDIT", `"${token}": a turnout is written +7=W:190-1/9, then :L or :R for the branch's side, then :WA, :WE or :Bogen`);
			spec.radius = Number(w[1]); spec.ratio = Number(w[2]);
			if (!turnoutShape(spec.radius, spec.ratio)) error("INVALID_EDIT", `"${token}": EW ${w[1]}-1:${w[2]} is not a simple turnout of Ril 800.0120A01: ${TURNOUT_SHAPES.map((s) => s.designation).join(", ")}`);
			spec.side = /^l/i.test(w[3] ?? "R") ? "left" : "right";
			spec.orientation = (w[4] ?? "WA").toLowerCase() === "bogen" ? "arc" : (w[4] ?? "WA").toUpperCase();
			if (!inserted.has(after)) inserted.set(after, []);
			inserted.get(after).push(spec);
			continue;
		}
		if (type === "arc") {
			spec.radius = toNumber(parts[0]); spec.length = toNumber(parts[1] ?? "");
			if (!Number.isFinite(spec.radius) || !(Math.abs(spec.radius) > 0)) error("INVALID_EDIT", `"${token}": an arc needs its radius, not zero, then its length: +7=B:-500:30`);
		} else {
			spec.length = toNumber(parts[0]);
			if (type === "transition") {
				const family = parts[1] ? familyOf(parts[1]) : "clothoid";
				if (!family) error("INVALID_EDIT", `"${token}": the type of a transition is ${Object.values(TRANSITION_FAMILIES).join(", ")}`);
				spec.family = family;
			}
		}
		if (!Number.isFinite(spec.length) || !(spec.length > 0)) error("INVALID_EDIT", `"${token}": a record needs a positive length`);
		if (!inserted.has(after)) inserted.set(after, []);
		inserted.get(after).push(spec);
	}
	return { removed, inserted };
}

/** values, removals and insertions in one: { values, removed, inserted } */
export function parseAllEdits(edits) {
	if (edits && typeof edits === "object" && edits.values instanceof Map) return { values: parseEdits(edits.values), ...parseStructure(edits) };
	return { values: parseEdits(edits), ...parseStructure(typeof edits === "string" ? edits : null) };
}

const insertToken = (after, spec) => spec.type === "turnout" ? `+${after}=W:${turnoutRef(spec)}:${spec.side === "left" ? "L" : "R"}${spec.orientation === "arc" ? ":Bogen" : spec.orientation === "WE" ? ":WE" : ""}`
	: spec.type === "arc" ? `+${after}=B:${trim(spec.radius, 3)}:${trim(spec.length, 3)}`
	: spec.type === "transition" ? `+${after}=U:${trim(spec.length, 3)}${spec.family && spec.family !== "clothoid" ? `:${TRANSITION_FAMILIES[spec.family]}` : ""}`
	: `+${after}=G:${trim(spec.length, 3)}`;

/**
 * The edits as a person would type them, "7L=45,2 7R=-1250 -9 +9=G:20",
 * record by record; the inverse of parseAllEdits (and of parseEdits for
 * values alone).
 */
export function formatEdits(edits) {
	const all = parseAllEdits(edits);
	const numbers = [...new Set([...all.values.keys(), ...all.removed, ...all.inserted.keys()])].sort((a, b) => a - b);
	return numbers.flatMap((n) => {
		const e = all.values.get(n) ?? {};
		return [
			...(e.length !== undefined ? [`${n}L=${trim(e.length, 3)}`] : []), ...(e.radius !== undefined ? [`${n}R=${trim(e.radius, 3)}`] : []), ...(e.family !== undefined ? [`${n}T=${TRANSITION_FAMILIES[e.family]}`] : []),
			...(all.removed.has(n) ? [`-${n}`] : []),
			...(all.inserted.get(n) ?? []).map((spec) => insertToken(n, spec)),
		];
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
