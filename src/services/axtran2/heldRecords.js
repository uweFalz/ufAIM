// src/services/axtran2/heldRecords.js
//
// What a fit may not touch: records of the TRA held as they stand.
//
// A station track runs from one turnout to another, and the turnouts are
// catalogue geometry: the branch arc of an EW 190-1:9 is 190 m * atan(1/9)
// long, whatever the survey says. Such a record is held whole, its length
// and its radius, and it is not merged with a neighbour of the same radius,
// because the file's boundary between the two is the Weichenanfang.
//
// Which records are held is the caller's declaration: by number, as the
// TRA's listing counts them, or by the word "turnouts", which holds every
// record this module recognises as a Regelbauart of Ril 800.0120A01. The
// recognition is reported either way; it holds nothing by itself.
//
// A record may also be held in one of its two quantities: "7L" holds its
// length and leaves the radius to the fit, "7R" holds the radius and leaves
// the length. A record held in either way keeps its own element, so the
// file's boundaries around it survive the fit. A turnout is held whole.
//
// The recognition may be told better (declareTurnouts): an arc of the file
// is the branch of this or that catalogue turnout, bent onto the main track
// or not, with its end piece here or there; or an arc the recognition took
// for a turnout is none. The values of a declared turnout are the
// catalogue's, the file keeps its own.

import { RIL_800_0120_A01, bentOnto, turnout as catalogueTurnout, compoundBranch } from "../../domain/optimization/alignment/TurnoutCatalogue.js";

export const HELD_RECORDS_VERSION = "axtran2/held-records/0.7";
/** the kernel's split of a branch of two radii, for callers that had it from here */
export { compoundBranch };

/** how far a record's length may lie from the catalogue's and still be the turnout, metres */
export const TURNOUT_MATCH_TOLERANCE = 2e-3;

export class HeldRecordsError extends Error {
	constructor(code, message, detail) {
		super(message);
		this.name = "HeldRecordsError";
		this.code = code;
		this.detail = detail;
	}
}
const error = (code, message, detail) => { throw new HeldRecordsError(code, message, detail); };

// the simple turnouts: R, 1:n, and the straight end pieces (d) the annex
// lists for that pair; and those whose branch has two radii (R1/R2), split
// by the kernel from the annex's tangent lengths (TurnoutCatalogue.turnout):
// two arcs, with a clothoid between them where the lengths ask for one
const SHAPES = (() => {
	const shapes = new Map();
	for (const row of RIL_800_0120_A01.rows) {
		if (row.kind !== "EW" || !Number.isFinite(row.radius)) continue;
		const compound = Number.isFinite(row.radiusEnd);
		const key = `${row.radius}${compound ? `/${row.radiusEnd}` : ""}-1:${row.ratio}`;
		let shape = shapes.get(key);
		if (!shape) {
			const spec = catalogueTurnout({ designation: `EW ${row.rails[0]}-${key}${row.suffix ? `-${row.suffix}` : ""}`, side: "right" });
			// the branch from the toe: arcs by their radius (an arc of no length carries the curvature a
			// clothoid starts from), the clothoid by its length; `branchLengths` the arcs' lengths in the order of the radii
			const branchParts = spec.branchParts.map((p) => (p.type === "arc" ? { type: "arc", radius: Math.round(1 / Math.abs(p.curvature) * 1e6) / 1e6, length: p.length } : { type: "transition", family: p.family, length: p.length }));
			const radii = compound ? [row.radius, row.radiusEnd] : [row.radius];
			shape = { designation: `EW ${key}`, radius: row.radius, radiusEnd: compound ? row.radiusEnd : null, ratio: row.ratio, radii,
				branchParts, branchLengths: branchParts.filter((p) => p.type === "arc").map((p) => p.length), branchLength: spec.branchLength,
				transitionLength: spec.transitionLength > 0 ? spec.transitionLength : null, tangentResidual: spec.tangentResidual, endPieces: [], branchSpeedKmh: row.vBranch };
		}
		if (Number.isFinite(row.d) && !shape.endPieces.includes(row.d)) shape.endPieces.push(row.d);
		// zul. v in the branch; the slowest where the annex lists the pair twice
		if (Number.isFinite(row.vBranch)) shape.branchSpeedKmh = Math.min(shape.branchSpeedKmh ?? Infinity, row.vBranch);
		shapes.set(key, shape);
	}
	return [...shapes.values()];
})();

/**
 * the turnouts of the annex, for a list to choose from: { designation, radius,
 * radiusEnd, ratio, radii, branchParts, branchLengths, branchLength,
 * transitionLength, tangentResidual, endPieces, branchSpeedKmh }; radiusEnd is
 * null but for a branch of two radii, transitionLength null without a clothoid
 */
export const TURNOUT_SHAPES = Object.freeze(SHAPES.map((s) => Object.freeze({ ...s, radii: Object.freeze([...s.radii]), branchParts: Object.freeze(s.branchParts.map((p) => Object.freeze({ ...p }))), branchLengths: Object.freeze([...s.branchLengths]), endPieces: Object.freeze([...s.endPieces]) })));

/** the catalogue turnout of a radius (and the branch's second radius, if it has one) and a crossing ratio, or null */
export function turnoutShape(radius, ratio, radiusEnd = null) {
	const end = Number.isFinite(Number(radiusEnd)) && radiusEnd !== null ? Number(radiusEnd) : null;
	return TURNOUT_SHAPES.find((s) => Math.abs(s.radius - Number(radius)) <= TURNOUT_MATCH_TOLERANCE && Math.abs(s.ratio - Number(ratio)) <= 1e-9
		&& (end === null ? s.radiusEnd === null : s.radiusEnd !== null && Math.abs(s.radiusEnd - end) <= TURNOUT_MATCH_TOLERANCE)) ?? null;
}

/**
 * The records a shape's branch is in a file, from the toe: its parts of a
 * length (a zero-length arc is a curvature a clothoid starts from, which the
 * file writes as the clothoid's R1, not as a record); `reversed` from the
 * Weichenende. A clothoid part names the radii it joins, as the file's
 * record does (radiusStart, radiusEnd).
 */
export function branchPattern(shape, reversed = false) {
	const parts = [];
	shape.branchParts.forEach((p, k) => {
		if (p.type === "arc") { if (p.length > 1e-9) parts.push({ type: "arc", radius: p.radius, length: p.length }); return; }
		const before = shape.branchParts[k - 1], after = shape.branchParts[k + 1];
		parts.push({ type: "transition", length: p.length, radiusStart: before?.radius ?? null, radiusEnd: after?.radius ?? null });
	});
	return reversed ? parts.slice().reverse().map((p) => (p.type === "transition" ? { ...p, radiusStart: p.radiusEnd, radiusEnd: p.radiusStart } : p)) : parts;
}

/**
 * The records that are a catalogue turnout's branch: an arc of the
 * turnout's radius whose length is R * atan(1/n), and beside it the
 * straight end piece where the Regelbauart has one; for a branch of two
 * radii its arcs, and the clothoid between them where the shape has one,
 * side by side in either order.
 *
 * @param {Array<{number:number,type:string,length:number,curvature?:number,radiusStart?:number,radiusEnd?:number}>} records  as traAlignment gives them
 * @returns {Array<{designation,radius,radiusEnd,ratio,side,arc,arcs,transition,endPiece,branchSpeedKmh,records}>}
 */
export function recogniseTurnouts(records, { tolerance = TURNOUT_MATCH_TOLERANCE } = {}) {
	const found = [];
	const taken = new Set();
	const near = (a, b) => Math.abs(a - b) <= tolerance;
	const isArcOf = (r, radius, length) => r?.type === "arc" && Math.abs(r.curvature) > 0 && near(1 / Math.abs(r.curvature), radius) && near(r.length, length);
	// a file's clothoid record carries the radii it joins where the reader hands them on; checked where it does
	const isTransitionOf = (r, part) => r?.type === "transition" && near(r.length, part.length)
		&& (!Number.isFinite(r.radiusStart) || part.radiusStart === null || near(Math.abs(r.radiusStart), part.radiusStart))
		&& (!Number.isFinite(r.radiusEnd) || part.radiusEnd === null || near(Math.abs(r.radiusEnd), part.radiusEnd));
	const matches = (i, pattern) => {
		if (i < 0 || i + pattern.length > records.length) return false;
		let sign = 0;
		return pattern.every((part, k) => {
			const r = records[i + k];
			if (taken.has(r.number)) return false;
			if (part.type === "transition") return isTransitionOf(r, part);
			if (!isArcOf(r, part.radius, part.length)) return false;
			if (sign === 0) sign = Math.sign(r.curvature);
			return Math.sign(r.curvature) === sign;
		});
	};
	// the longer patterns first: a branch of two radii before the arc that could be a simple turnout's
	const candidates = SHAPES.flatMap((s) => [false, true].filter((reversed) => !reversed || s.radiusEnd !== null).map((reversed) => ({ shape: s, reversed, pattern: branchPattern(s, reversed) })))
		.sort((a, b) => b.pattern.length - a.pattern.length);
	records.forEach((record, i) => {
		if (taken.has(record.number)) return;
		const hit = candidates.find((c) => matches(i, c.pattern));
		if (!hit) return;
		const { shape, pattern } = hit;
		const own = pattern.map((_, k) => records[i + k]);
		const arcs = own.filter((r) => r.type === "arc");
		const transition = own.find((r) => r.type === "transition") ?? null;
		// `arc` is the record of the first radius with a length from the toe (R1, or R2 where R1 is but a curvature)
		const fromToe = hit.reversed ? own.slice().reverse() : own;
		const firstArc = fromToe.find((r) => r.type === "arc");
		const isEndPiece = (r) => r?.type === "straight" && shape.endPieces.some((d) => near(d, r.length));
		const after = records[i + own.length], before = records[i - 1];
		const endPiece = isEndPiece(after) ? after.number : isEndPiece(before) ? before.number : null;
		own.forEach((r) => taken.add(r.number));
		found.push(Object.freeze({
			designation: shape.designation, radius: shape.radius, radiusEnd: shape.radiusEnd, ratio: shape.ratio,
			// the kernel's heading grows to the left
			side: firstArc.curvature > 0 ? "left" : "right",
			arc: firstArc.number, arcs: Object.freeze(arcs.map((a) => a.number)), transition: transition?.number ?? null, endPiece,
			// what the annex allows in the branch, km/h: the track through it runs no faster
			branchSpeedKmh: shape.branchSpeedKmh ?? null,
			records: Object.freeze([...own.map((r) => r.number), ...(endPiece === null ? [] : [endPiece])].sort((a, b) => a - b)),
			source: RIL_800_0120_A01.source,
		}));
	});
	return Object.freeze(found);
}

/**
 * The turnouts of the file as declared: the recognition's list with the
 * declarations (recordEdits.js, "3W=300-1/9", "3W=keine") worked in.
 *
 * A type on record n: n is the arc of the branch (the first radius where
 * there are two; the second is the arc beside it, as the turnout that was
 * recognised there has it, else the next or the previous arc turning the
 * same way). The turnout recognised on n, if any, is replaced whole. The
 * end piece is the record the recognised turnout had, re-measured to the
 * new type's d; without one, the straight beside the arcs whose length is
 * a d of the type (as the recognition looks); `orientation` "WA" or "WE"
 * names the record after or before the arcs outright, "arc" none. A type
 * without an end piece in the annex releases the one the turnout had.
 * ":auf-800" bends every arc by the main track's curvature (bentOnto); an
 * end piece that is an arc in the file follows, a straight stays one.
 *
 * The values a declared turnout starts from are the catalogue's: for each
 * of its arcs the radius (the file's sign, the record's side) and the
 * branch length, for the end piece its d. "keine" takes the turnout off
 * the list; its records keep the file's values.
 *
 * @param {Array} records      the file's records [{ number, type, length, curvature? }]
 * @param {Array} recognised   from recogniseTurnouts
 * @param {Map<number, object|null>} declarations  record -> spec { radius, radiusEnd?, ratio, mainRadius?, orientation? } or null
 * @returns {{ turnouts: Array, values: Map<number, {length?: number, radius?: number}> }}
 */
export function declareTurnouts(records, recognised, declarations, { tolerance = TURNOUT_MATCH_TOLERANCE } = {}) {
	const turnouts = [...recognised];
	const values = new Map();
	if (!declarations || declarations.size === 0) return { turnouts, values };
	const at = (n) => records[n - 1] ?? null;
	const sameWayArc = (r, sign) => r?.type === "arc" && Math.sign(r.curvature ?? 0) === sign;
	for (const [n, spec] of declarations) {
		const record = at(n);
		if (!record) error("INVALID_EDIT", `record ${n} does not exist: the file has ${records.length}`);
		const wasAt = turnouts.findIndex((t) => t.records.includes(n));
		const was = wasAt >= 0 ? turnouts[wasAt] : null;
		if (spec === null) {
			if (!was) error("INVALID_EDIT", `record ${n} is no turnout the file shows: nothing to take the type from`);
			turnouts.splice(wasAt, 1);
			continue;
		}
		if (record.type !== "arc" || !(Math.abs(record.curvature) > 0)) error("INVALID_EDIT", `record ${n} is a ${record.type}: a turnout's type goes on the arc of its branch`);
		const shape = turnoutShape(spec.radius, spec.ratio, spec.radiusEnd ?? null);
		if (!shape) error("INVALID_EDIT", `record ${n}: EW ${spec.radius}${Number.isFinite(spec.radiusEnd) ? `/${spec.radiusEnd}` : ""}-1:${spec.ratio} is not a turnout of Ril 800.0120A01`);
		if (was) turnouts.splice(wasAt, 1);
		const sign = Math.sign(record.curvature);
		const side = sign > 0 ? "left" : "right";
		// the records of the branch around n, as the shape's pattern has them from the toe or from the end:
		// n is the arc the pattern names first (R1, or R2 where R1 is but the curvature a clothoid starts from)
		const laid = [false, true].filter((reversed) => !reversed || shape.radiusEnd !== null).map((reversed) => {
			const pattern = branchPattern(shape, reversed);
			const fromToe = reversed ? pattern.slice().reverse() : pattern;
			const firstArc = fromToe.find((p) => p.type === "arc");
			const start = n - pattern.indexOf(firstArc);
			const own = pattern.map((_, k) => start + k);
			const fits = pattern.every((p, k) => { const r = at(own[k]); return r && (p.type === "transition" ? r.type === "transition" : sameWayArc(r, sign)) && (own[k] === n || !turnouts.some((t) => t.records.includes(own[k]))); });
			return { pattern, own, fits, preferred: was ? own.every((m) => was.records.includes(m)) : false };
		}).filter((l) => l.fits).sort((a, b) => Number(b.preferred) - Number(a.preferred));
		if (!laid.length) error("INVALID_EDIT", `record ${n}: the branch of ${shape.designation} is ${branchPattern(shape).map((p) => (p.type === "arc" ? `an arc R ${p.radius}` : `a clothoid of ${p.length.toFixed(2)} m`)).join(", then ")}; the records beside ${n} are not that`);
		const { pattern, own: branchRecords } = laid[0];
		const arcs = branchRecords.filter((m, k) => pattern[k].type === "arc");
		const transitionRecord = branchRecords.find((m, k) => pattern[k].type === "transition") ?? null;
		// the kernel's heading grows to the left; bent onto the main track, every arc by the line's curvature
		let curvatures = shape.radii.map((r) => sign / r);
		let bent = null;
		if (Number.isFinite(spec.mainRadius)) {
			const mainCurvature = -1 / spec.mainRadius;
			const bentArcs = curvatures.map((c, k) => bentOnto({ id: `${shape.designation}[${k}]`, curvature: c }, mainCurvature));
			curvatures = bentArcs.map((b) => b.curvature);
			bent = Object.freeze({ kind: bentArcs[0].bent.kind, mainRadius: spec.mainRadius, branchRadii: Object.freeze(curvatures.map((c) => (Math.abs(c) > 1e-15 ? -1 / c : null))) });
		}
		const kind = bent ? bent.kind : "EW";
		const designation = bent ? `${kind} ${shape.radius}${shape.radiusEnd !== null ? `/${shape.radiusEnd}` : ""}-1:${shape.ratio} auf R ${spec.mainRadius}` : shape.designation;
		if (curvatures.some((c) => !(Math.abs(c) > 1e-15))) error("INVALID_EDIT", `record ${n}: bent onto R ${spec.mainRadius} the branch of ${shape.designation} would be straight; the file's arc cannot carry that`);
		const curvatureOfRadius = (r) => curvatures[shape.radii.indexOf(r)];
		pattern.forEach((p, k) => {
			const m = branchRecords[k];
			if (p.type === "arc") { values.set(m, { length: p.length, radius: -1 / curvatureOfRadius(p.radius) }); return; }
			// the clothoid: its length and family; the kernel reads the curvature it starts from off the record before it,
			// which the reader carries from the file's R1 - so the file's clothoid has to start at that radius already
			const r = at(m);
			const outer = p.radiusStart !== null && !arcs.includes(m - 1) ? ["radiusStart", p.radiusStart] : p.radiusEnd !== null && !arcs.includes(m + 1) ? ["radiusEnd", p.radiusEnd] : null;
			if (outer && Number.isFinite(r[outer[0]]) && !(Math.abs(Math.abs(r[outer[0]]) - outer[1]) <= 0.5)) error("INVALID_EDIT", `record ${m}: the clothoid of ${shape.designation} starts at R ${outer[1]}, the file's at R ${Math.abs(r[outer[0]])}; the reader carries the file's radius, so this record cannot be that clothoid${bent ? " (nor a bent one)" : ""}`);
			if (bent) error("INVALID_EDIT", `record ${n}: ${shape.designation} bent onto R ${spec.mainRadius} would start its clothoid at another radius than the file's record ${m}; not from here`);
			values.set(m, { length: p.length, family: "clothoid" });
		});
		// the end piece: where the recognised turnout had it, where the orientation says, or where a length fits
		const first = Math.min(...branchRecords), lastArc = Math.max(...branchRecords);
		const d = shape.endPieces.length ? Math.min(...shape.endPieces) : null;
		const fits = (m) => { const r = at(m); return r && (r.type === "straight" || (bent && sameWayArc(r, sign))) && !branchRecords.includes(m) && !turnouts.some((t) => t.records.includes(m)); };
		let endPiece = null;
		if (d !== null && spec.orientation !== "arc") {
			const wanted = spec.orientation === "WA" ? lastArc + 1 : spec.orientation === "WE" ? first - 1 : null;
			if (wanted !== null) {
				if (!fits(wanted)) error("INVALID_EDIT", `record ${n}: the end piece of ${designation} would be record ${wanted}, which is ${at(wanted) ? `a ${at(wanted).type}${turnouts.some((t) => t.records.includes(wanted)) ? " of another turnout" : ""}` : "not in the file"}`);
				endPiece = wanted;
			} else if (was && was.endPiece !== null && fits(was.endPiece)) endPiece = was.endPiece;
			else {
				const byLength = (m) => fits(m) && shape.endPieces.some((dd) => Math.abs(dd - at(m).length) <= tolerance);
				endPiece = byLength(lastArc + 1) ? lastArc + 1 : byLength(first - 1) ? first - 1 : null;
			}
		}
		if (endPiece !== null) values.set(endPiece, { length: d, ...(at(endPiece).type === "arc" ? { radius: -1 / curvatures[curvatures.length - 1] } : {}) });
		const own = [...branchRecords, ...(endPiece === null ? [] : [endPiece])].sort((a, b) => a - b);
		const clash = turnouts.find((t) => t.records.some((m) => own.includes(m)));
		if (clash) error("INVALID_EDIT", `record ${n}: ${designation} would take record ${clash.records.find((m) => own.includes(m))} from the turnout ${clash.designation}`);
		turnouts.push(Object.freeze({
			designation, kind, radius: shape.radius, radiusEnd: shape.radiusEnd, ratio: shape.ratio, side,
			arc: n, arcs: Object.freeze(arcs.slice().sort((a, b) => a - b)), transition: transitionRecord, endPiece,
			// the annex speaks for the straight turnout; a bent branch has another radius and no row
			branchSpeedKmh: bent ? null : shape.branchSpeedKmh ?? null,
			records: Object.freeze(own), source: RIL_800_0120_A01.source,
			declared: Object.freeze({ record: n, was: was?.designation ?? null, mainRadius: spec.mainRadius ?? null, orientation: spec.orientation ?? null, bent }),
		}));
	}
	turnouts.sort((a, b) => a.records[0] - b.records[0]);
	return { turnouts: Object.freeze(turnouts), values };
}

/** a quantity pair, both held */
const BOTH = Object.freeze({ length: true, radius: true });
const NONE = Object.freeze({ length: false, radius: false });
const join = (a, b) => Object.freeze({ length: a.length || b.length, radius: a.radius || b.radius });

/**
 * The caller's words: record numbers, ranges ("3-5"), either with L or R
 * behind it for the length or the radius alone ("7R", "3-5L"), and the
 * word "turnouts" ("Weichen"), in a list or in one string.
 * @returns {{turnouts: boolean, records: number[], quantities: Object<number,{length:boolean,radius:boolean}>}}
 *          records sorted; quantities per record, what of it is held
 */
export function parseHold(hold) {
	const tokens = (Array.isArray(hold) ? hold : String(hold ?? "").split(/[,;\s]+/)).map((t) => String(t).trim()).filter((t) => t !== "");
	const records = new Map();
	let turnouts = false;
	for (const token of tokens) {
		if (/^(turnouts?|weichen?)$/i.test(token)) { turnouts = true; continue; }
		const range = /^(\d+)(?:-(\d+))?([lr])?$/i.exec(token);
		if (!range) error("INVALID_HOLD", `cannot read "${token}" as a record number, a range, one of them with L or R behind it, or "turnouts"`);
		const from = Number(range[1]);
		const to = range[2] === undefined ? from : Number(range[2]);
		if (from < 1 || to < from) error("INVALID_HOLD", `"${token}" is not a range of record numbers`);
		const part = (range[3] ?? "").toUpperCase();
		const want = part === "" ? BOTH : Object.freeze({ length: part === "L", radius: part === "R" });
		for (let n = from; n <= to; n++) records.set(n, join(records.get(n) ?? NONE, want));
	}
	const sorted = [...records.keys()].sort((a, b) => a - b);
	return Object.freeze({ turnouts, records: Object.freeze(sorted), quantities: Object.freeze(Object.fromEntries(sorted.map((n) => [n, records.get(n)]))) });
}

/**
 * The hold as a person would type it: runs as ranges, L or R behind what is
 * held in one quantity, "1-2, 7R, 13". The inverse of parseHold. Takes
 * record numbers (held whole), objects { record|number, length, radius },
 * or a Map of number to { length, radius }; an empty hold is an empty string.
 */
export function formatHold(items) {
	const entries = items instanceof Map ? [...items.entries()].map(([n, q]) => ({ record: n, ...q })) : [...items].map((it) => (typeof it === "object" && it !== null ? { record: it.record ?? it.number, length: it.length, radius: it.radius } : { record: it, ...BOTH }));
	const held = new Map();
	for (const e of entries) {
		const n = Number(e.record);
		if (!Number.isInteger(n) || n < 1) continue;
		const want = Object.freeze({ length: e.length !== false, radius: e.radius !== false });
		if (!want.length && !want.radius) continue;
		held.set(n, join(held.get(n) ?? NONE, want));
	}
	const suffix = (q) => (q.length && q.radius ? "" : q.length ? "L" : "R");
	const runs = [];
	for (const n of [...held.keys()].sort((a, b) => a - b)) {
		const last = runs[runs.length - 1];
		const tag = suffix(held.get(n));
		if (last && n === last[1] + 1 && tag === last[2]) last[1] = n;
		else runs.push([n, n, tag]);
	}
	return runs.map(([from, to, tag]) => `${from === to ? String(from) : `${from}-${to}`}${tag}`).join(", ");
}

/**
 * Which records are held, in what, and why.
 * @returns {Map<number,{why: string, length: boolean, radius: boolean}>}
 *          record number -> why ("named" or the turnout's designation) and the quantities held
 */
export function resolveHold(hold, records, turnouts, { tolerateNoTurnout = false } = {}) {
	const wanted = parseHold(hold);
	const held = new Map();
	for (const n of wanted.records) {
		if (n > records.length) error("INVALID_HOLD", `record ${n} does not exist: the file has ${records.length}`);
		const q = wanted.quantities[n];
		if (q.radius && !q.length && records[n - 1].type !== "arc") error("INVALID_HOLD", `record ${n} is a ${records[n - 1].type}: it has no radius to hold`);
		held.set(n, Object.freeze({ why: "named", ...q }));
	}
	if (wanted.turnouts) {
		// a turnout put in by an edit is held by itself: the word may stand without one in the file
		if (turnouts.length === 0 && !tolerateNoTurnout) error("NO_TURNOUT", "no record of the file is a catalogue turnout (Ril 800.0120A01): name the records to hold by number");
		// a turnout is catalogue geometry: held whole, whatever a number beside it said
		for (const t of turnouts) for (const n of t.records) held.set(n, Object.freeze({ why: t.designation, ...BOTH }));
	}
	return held;
}
