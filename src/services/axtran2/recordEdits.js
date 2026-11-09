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
// records are "7+1a" and "7+1b"; both are held, as a turnout is. ":auf-800"
// bends it onto a main track of R -800 (the file's sign): the branch's
// curvature is the turnout's plus the line's, an Innenbogenweiche where
// both turn the same way, an Außenbogenweiche where they turn against each
// other (TurnoutCatalogue.bentOnto). A crossing turnout is one route:
// "+7=K:DKW:190-1/9:R" the curved route of a DKW 190-1:9 onto the crossing
// track to the right (the arc R * atan(1/n)), ":gerade" the straight route
// over the crossing (2 R tan(alpha/2)); an EKW reads the same from its entry.
//
// A turnout of the file has a type too: "3W=300-1/9" says that record 3, an
// arc, is the branch of an EW 300-1:9 - the turnout the recognition found
// there is re-typed, or a plain arc becomes one; its values (radius, branch
// length, end piece) are the catalogue's from then on (heldRecords.js,
// declareTurnouts). ":auf-800" bends it onto a main track of that radius,
// ":WA", ":WE" or ":Bogen" say where its end piece is where the lengths do
// not; "3W=keine" says the arc is no turnout, whatever the recognition found.

export const RECORD_EDITS_VERSION = "axtran2/record-edits/0.9";

import { turnoutShape, TURNOUT_SHAPES } from "./heldRecords.js";
import { RIL_800_0120_A01, CROSSING_KINDS } from "../../domain/optimization/alignment/TurnoutCatalogue.js";

/**
 * the crossing turnouts of the annex, and the plain crossings (Kr, no
 * turnout: two straight tracks crossing at 1:n, the track through it a
 * straight of the annex's lw): { kind, designation, radius, ratio, length,
 * branchSpeedKmh, mainSpeedKmh }; radius and branchSpeedKmh are null for a Kr
 */
export const CROSSING_SHAPES = Object.freeze(RIL_800_0120_A01.rows.filter((r) => (CROSSING_KINDS.includes(r.kind) && Number.isFinite(r.radius)) || (r.kind === "Kr" && Number.isFinite(r.lw)))
	.map((r) => Object.freeze({ kind: r.kind, designation: r.kind === "Kr" ? `Kr 1:${r.ratio}` : `${r.kind} ${r.radius}-1:${r.ratio}`, radius: r.radius ?? null, ratio: r.ratio, length: r.kind === "Kr" ? r.lw : null, branchSpeedKmh: r.vBranch ?? null, mainSpeedKmh: typeof r.vMain === "object" ? Math.min(...Object.values(r.vMain)) : r.vMain ?? null })));
/** the catalogue crossing turnout of a kind, radius and ratio (the radius null for a Kr), or null */
export const crossingShape = (kind, radius, ratio) => CROSSING_SHAPES.find((s) => s.kind.toUpperCase() === String(kind).toUpperCase() && Math.abs(s.ratio - Number(ratio)) <= 1e-9
	&& (s.radius === null ? radius === null || radius === undefined : Math.abs(s.radius - Number(radius)) <= 2e-3)) ?? null;
/** the two routes through a crossing turnout */
export const CROSSING_ROUTES_WORDS = Object.freeze({ curved: "Bogenfahrt auf das kreuzende Gleis", straight: "gerade Fahrt über die Kreuzung" });

/** the kinds a record may be inserted as, with their letters and words */
export const INSERT_TYPES = Object.freeze({ straight: "Gerade", arc: "Bogen", transition: "Übergangsbogen", turnout: "Weiche", crossing: "Kreuzungsweiche" });
const INSERT_LETTERS = Object.freeze({ g: "straight", b: "arc", u: "transition", "ü": "transition", w: "turnout", k: "crossing" });
/** how an inserted turnout lies in the track */
export const TURNOUT_ORIENTATIONS = Object.freeze({ WA: "Bogen, dann Endstück", WE: "Endstück, dann Bogen", arc: "nur der Bogen" });
/** the key of the i-th record inserted after record n; `part` for the a/b/c/d of a turnout's pieces */
export const insertKey = (after, index, part = "") => `${after}+${index}${part}`;
/** true for the key of an inserted record */
export const isInsertKey = (key) => /^\d+\+\d+[a-d]?$/.test(String(key));
/** the record an insert key follows, the index of the insert and its part, or null */
export function insertOf(key) {
	const m = /^(\d+)\+(\d+)([a-d]?)$/.exec(String(key));
	return m ? { after: Number(m[1]), index: Number(m[2]), part: m[3] || null } : null;
}
/** "EW 190-1:9" of a turnout spec, "EW 7000/6000-1:42" where the branch has two radii */
export const turnoutDesignation = (spec) => `EW ${spec.radius}${Number.isFinite(spec.radiusEnd) ? `/${spec.radiusEnd}` : ""}-1:${spec.ratio}`;
/** "190-1/9" of a turnout spec, as the token writes it */
export const turnoutRef = (spec) => `${spec.radius}${Number.isFinite(spec.radiusEnd) ? `/${spec.radiusEnd}` : ""}-1/${spec.ratio}`;
export { TURNOUT_SHAPES };
/** the words that say a record is no turnout: "3W=keine" */
const RELEASE_WORDS = /^(keine|none|frei|-|–|—)$/i;

/**
 * A turnout declared on a record of the file, as "3W=..." carries it after
 * the "=": null for "keine" (no turnout there), else { radius, radiusEnd?,
 * ratio, mainRadius?, orientation? }; the shape has to be one of the annex.
 */
export function parseTurnoutDeclaration(text) {
	const t = String(text ?? "").trim();
	if (RELEASE_WORDS.test(t)) return null;
	const w = /^(?:EW\s*)?(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?-1[:/](\d+(?:[.,]\d+)?)((?::(?:WA|WE|Bogen|auf\s*[-+]?\d+(?:[.,]\d+)?))*)$/i.exec(t);
	if (!w) error("INVALID_EDIT", `"${t}": a turnout's type is written 300-1/9 (7000/6000-1/42 for a branch of two radii), then :auf-800 to bend it onto a main track of that radius, :WA, :WE or :Bogen for where its end piece is; "keine" for no turnout`);
	const spec = { radius: Number(w[1]), ratio: toNumber(w[3]) };
	if (w[2] !== undefined) spec.radiusEnd = Number(w[2]);
	if (!turnoutShape(spec.radius, spec.ratio, spec.radiusEnd ?? null)) error("INVALID_EDIT", `${turnoutDesignation(spec)} is not a turnout of Ril 800.0120A01: ${TURNOUT_SHAPES.map((s) => s.designation).join(", ")}`);
	for (const part of (w[4] ?? "").split(":").filter(Boolean)) {
		const main = /^auf\s*([-+]?\d+(?:[.,]\d+)?)$/i.exec(part);
		if (main) {
			spec.mainRadius = toNumber(main[1]);
			if (!(Math.abs(spec.mainRadius) > 0)) error("INVALID_EDIT", `"${t}": the main track's radius to bend onto is not zero`);
		} else spec.orientation = part.toLowerCase() === "bogen" ? "arc" : part.toUpperCase();
	}
	return spec;
}

/** a declaration as the token writes it after the "=": "300-1/9:auf-800:WE", "keine" */
export const formatTurnoutDeclaration = (spec) => spec === null ? "keine"
	: `${turnoutRef(spec)}${Number.isFinite(spec.mainRadius) ? `:auf${trim(spec.mainRadius, 3)}` : ""}${spec.orientation === "arc" ? ":Bogen" : spec.orientation === "WE" || spec.orientation === "WA" ? `:${spec.orientation}` : ""}`;

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
		if (field === "turnout") {
			// a string as typed, or a spec (null for "keine") as the report carries it: read through the words either way
			const turnout = typeof value === "string" ? parseTurnoutDeclaration(value) : value === null ? null : parseTurnoutDeclaration(formatTurnoutDeclaration(value));
			map.set(n, { ...(map.get(n) ?? {}), turnout });
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
			const m = /^(\d+)\s*([lrtw])\s*=\s*(.+)$/i.exec(token);
			if (!m) error("INVALID_EDIT", `cannot read "${token}": write the record number, L, R, T or W, "=" and the value, as in 7L=45,2, 7T=Bloss or 3W=300-1/9`);
			const kind = m[2].toUpperCase();
			if (kind === "T") { put(Number(m[1]), "family", m[3]); continue; }
			if (kind === "W") { put(Number(m[1]), "turnout", m[3]); continue; }
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
		if (e.turnout !== undefined) put(n, "turnout", e.turnout);
	}
	return map;
}

const tokens = (text) => text.split(/[\s;]+|,(?=\s*[-+]?\d+\s*[lrtw=]|\s*[-+]\d)/i).map((t) => t.trim()).filter(Boolean);
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
			// "190-1/9", or "7000/6000-1/42" for a branch of two radii; the ratio may carry a comma (32,5)
			const w = /^(?:EW\s*)?(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?-1[:/](\d+(?:[.,]\d+)?)(?::(L|R|links|rechts))?(?::(WA|WE|Bogen))?(?::auf\s*([-+]?\d+(?:[.,]\d+)?))?$/i.exec(put[3].trim());
			if (!w) error("INVALID_EDIT", `"${token}": a turnout is written +7=W:190-1/9 (+7=W:7000/6000-1/42 for a branch of two radii), then :L or :R for the branch's side, then :WA, :WE or :Bogen, then :auf-800 to bend it onto a main track of that radius`);
			spec.radius = Number(w[1]); spec.ratio = toNumber(w[3]);
			if (w[2] !== undefined) spec.radiusEnd = Number(w[2]);
			if (!turnoutShape(spec.radius, spec.ratio, spec.radiusEnd ?? null)) error("INVALID_EDIT", `"${token}": ${turnoutDesignation(spec)} is not a turnout of Ril 800.0120A01: ${TURNOUT_SHAPES.map((s) => s.designation).join(", ")}`);
			spec.side = /^l/i.test(w[4] ?? "R") ? "left" : "right";
			spec.orientation = (w[5] ?? "WA").toLowerCase() === "bogen" ? "arc" : (w[5] ?? "WA").toUpperCase();
			if (w[6] !== undefined) {
				spec.mainRadius = toNumber(w[6]);
				if (!(Math.abs(spec.mainRadius) > 0)) error("INVALID_EDIT", `"${token}": the main track's radius to bend onto is not zero`);
			}
			if (!inserted.has(after)) inserted.set(after, []);
			inserted.get(after).push(spec);
			continue;
		}
		if (type === "crossing") {
			// a plain crossing: "+7=K:Kr:1/9", the straight over it; no side, no route
			const kr = /^Kr[:\s]*1[:/](\d+(?:[.,]\d+)?)$/i.exec(put[3].trim());
			if (kr) {
				spec.kind = "Kr"; spec.radius = null; spec.ratio = toNumber(kr[1]); spec.side = null; spec.route = "straight";
				if (!crossingShape("Kr", null, spec.ratio)) error("INVALID_EDIT", `"${token}": Kr 1:${kr[1]} is not a crossing of Ril 800.0120A01: ${CROSSING_SHAPES.filter((s) => s.kind === "Kr").map((s) => s.designation).join(", ")}`);
				if (!inserted.has(after)) inserted.set(after, []);
				inserted.get(after).push(spec);
				continue;
			}
			const k = /^(EKW|DKW)[:\s]*(\d+(?:\.\d+)?)-1[:/](\d+(?:\.\d+)?)(?::(L|R|links|rechts))?(?::(gerade|Bogen|Bogenfahrt))?$/i.exec(put[3].trim());
			if (!k) error("INVALID_EDIT", `"${token}": a crossing turnout is written +7=K:DKW:190-1/9, then :L or :R for the crossing track's side, then :Bogen (the curved route) or :gerade; a plain crossing +7=K:Kr:1/9`);
			spec.kind = k[1].toUpperCase(); spec.radius = Number(k[2]); spec.ratio = Number(k[3]);
			if (!crossingShape(spec.kind, spec.radius, spec.ratio)) error("INVALID_EDIT", `"${token}": ${spec.kind} ${k[2]}-1:${k[3]} is not a crossing turnout of Ril 800.0120A01: ${CROSSING_SHAPES.filter((s) => s.kind !== "Kr").map((s) => s.designation).join(", ")}`);
			spec.side = /^l/i.test(k[4] ?? "R") ? "left" : "right";
			spec.route = /^g/i.test(k[5] ?? "Bogen") ? "straight" : "curved";
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

const insertToken = (after, spec) => spec.type === "turnout" ? `+${after}=W:${turnoutRef(spec)}:${spec.side === "left" ? "L" : "R"}${spec.orientation === "arc" ? ":Bogen" : spec.orientation === "WE" ? ":WE" : ""}${Number.isFinite(spec.mainRadius) ? `:auf${trim(spec.mainRadius, 3)}` : ""}`
	: spec.type === "crossing" && spec.kind === "Kr" ? `+${after}=K:Kr:1/${spec.ratio}`
	: spec.type === "crossing" ? `+${after}=K:${spec.kind}:${turnoutRef(spec)}:${spec.side === "left" ? "L" : "R"}${spec.route === "straight" ? ":gerade" : ""}`
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
			...(e.turnout !== undefined ? [`${n}W=${formatTurnoutDeclaration(e.turnout)}`] : []),
			...(all.removed.has(n) ? [`-${n}`] : []),
			...(all.inserted.get(n) ?? []).map((spec) => insertToken(n, spec)),
		];
	}).join(" ");
}

/**
 * The edits checked against the file's records: the record exists and
 * carries a length, a length is positive, a radius belongs to an arc and is
 * not zero. A turnout's type goes on an arc, "keine" on a record of a
 * turnout the recognition found (`turnouts`); a record declared a turnout
 * takes no length or radius beside it, its values are the catalogue's.
 * Returns a Map of record number to frozen { length?, radius?, family?, turnout? }.
 */
export function resolveEdits(edits, records, turnouts = []) {
	const map = parseEdits(edits);
	const out = new Map();
	for (const [n, e] of map) {
		if (n > records.length) error("INVALID_EDIT", `record ${n} does not exist: the file has ${records.length}`);
		const r = records[n - 1];
		if (r.type === "kink" || !(r.length > 0)) error("INVALID_EDIT", `record ${n} carries no length to change`);
		if (e.turnout !== undefined) {
			const of = turnouts.find((t) => t.records.includes(n));
			if (e.turnout === null && !of) error("INVALID_EDIT", `record ${n} is no turnout the file shows: nothing to take the type from`);
			if (e.turnout !== null && r.type !== "arc") error("INVALID_EDIT", `record ${n} is a ${r.type}: a turnout's type goes on the arc of its branch`);
			if (e.turnout !== null && (e.length !== undefined || e.radius !== undefined)) error("INVALID_EDIT", `record ${n} is declared a turnout: its length and radius are the catalogue's, not to be changed beside it`);
		}
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
