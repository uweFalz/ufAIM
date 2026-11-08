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

import { RIL_800_0120_A01 } from "../../domain/optimization/alignment/TurnoutCatalogue.js";

export const HELD_RECORDS_VERSION = "axtran2/held-records/0.4";

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

// the simple turnouts with one radius: R, 1:n, and the straight end pieces
// (d) the annex lists for that pair
const SHAPES = (() => {
	const shapes = new Map();
	for (const row of RIL_800_0120_A01.rows) {
		if (row.kind !== "EW" || !Number.isFinite(row.radius) || Number.isFinite(row.radiusEnd)) continue;
		const key = `${row.radius}-1:${row.ratio}`;
		const shape = shapes.get(key) ?? { designation: `EW ${key}`, radius: row.radius, ratio: row.ratio, branchLength: row.radius * Math.atan(1 / row.ratio), endPieces: [], branchSpeedKmh: row.vBranch };
		if (Number.isFinite(row.d) && !shape.endPieces.includes(row.d)) shape.endPieces.push(row.d);
		// zul. v in the branch; the slowest where the annex lists the pair twice
		if (Number.isFinite(row.vBranch)) shape.branchSpeedKmh = Math.min(shape.branchSpeedKmh ?? Infinity, row.vBranch);
		shapes.set(key, shape);
	}
	return [...shapes.values()];
})();

/** the simple turnouts of the annex, for a list to choose from: { designation, radius, ratio, branchLength, endPieces, branchSpeedKmh } */
export const TURNOUT_SHAPES = Object.freeze(SHAPES.map((s) => Object.freeze({ ...s, endPieces: Object.freeze([...s.endPieces]) })));

/** the catalogue turnout of a radius and a crossing ratio, or null */
export function turnoutShape(radius, ratio) {
	return TURNOUT_SHAPES.find((s) => Math.abs(s.radius - Number(radius)) <= TURNOUT_MATCH_TOLERANCE && Math.abs(s.ratio - Number(ratio)) <= 1e-9) ?? null;
}

/**
 * The records that are a catalogue turnout's branch: an arc of the
 * turnout's radius whose length is R * atan(1/n), and beside it the
 * straight end piece where the Regelbauart has one.
 *
 * @param {Array<{number:number,type:string,length:number,curvature?:number}>} records  as traAlignment gives them
 * @returns {Array<{designation,radius,ratio,side,arc,endPiece,branchSpeedKmh,records}>}
 */
export function recogniseTurnouts(records, { tolerance = TURNOUT_MATCH_TOLERANCE } = {}) {
	const found = [];
	records.forEach((record, i) => {
		if (record.type !== "arc" || !(Math.abs(record.curvature) > 0)) return;
		const radius = 1 / Math.abs(record.curvature);
		const shape = SHAPES.find((s) => Math.abs(s.radius - radius) <= tolerance && Math.abs(s.branchLength - record.length) <= tolerance);
		if (!shape) return;
		const isEndPiece = (r) => r?.type === "straight" && shape.endPieces.some((d) => Math.abs(d - r.length) <= tolerance);
		const endPiece = isEndPiece(records[i + 1]) ? records[i + 1].number : isEndPiece(records[i - 1]) ? records[i - 1].number : null;
		found.push(Object.freeze({
			designation: shape.designation, radius: shape.radius, ratio: shape.ratio,
			// the kernel's heading grows to the left
			side: record.curvature > 0 ? "left" : "right",
			arc: record.number, endPiece,
			// what the annex allows in the branch, km/h: the track through it runs no faster
			branchSpeedKmh: shape.branchSpeedKmh ?? null,
			records: Object.freeze([record.number, ...(endPiece === null ? [] : [endPiece])].sort((a, b) => a - b)),
			source: RIL_800_0120_A01.source,
		}));
	});
	return Object.freeze(found);
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
