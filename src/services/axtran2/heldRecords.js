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

import { RIL_800_0120_A01 } from "../../domain/optimization/alignment/TurnoutCatalogue.js";

export const HELD_RECORDS_VERSION = "axtran2/held-records/0.2";

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

/**
 * The caller's words: record numbers, ranges ("3-5") and the word
 * "turnouts" ("Weichen"), in a list or in one string.
 * @returns {{turnouts: boolean, records: number[]}}
 */
export function parseHold(hold) {
	const tokens = (Array.isArray(hold) ? hold : String(hold ?? "").split(/[,;\s]+/)).map((t) => String(t).trim()).filter((t) => t !== "");
	const records = new Set();
	let turnouts = false;
	for (const token of tokens) {
		if (/^(turnouts?|weichen?)$/i.test(token)) { turnouts = true; continue; }
		const range = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
		if (!range) error("INVALID_HOLD", `cannot read "${token}" as a record number, a range or "turnouts"`);
		const from = Number(range[1]);
		const to = range[2] === undefined ? from : Number(range[2]);
		if (from < 1 || to < from) error("INVALID_HOLD", `"${token}" is not a range of record numbers`);
		for (let n = from; n <= to; n++) records.add(n);
	}
	return Object.freeze({ turnouts, records: Object.freeze([...records].sort((a, b) => a - b)) });
}

/**
 * Which records are held, and why.
 * @returns {Map<number,string>} record number -> "named" or the turnout's designation
 */
export function resolveHold(hold, records, turnouts) {
	const wanted = parseHold(hold);
	const held = new Map();
	for (const n of wanted.records) {
		if (n > records.length) error("INVALID_HOLD", `record ${n} does not exist: the file has ${records.length}`);
		held.set(n, "named");
	}
	if (wanted.turnouts) {
		if (turnouts.length === 0) error("NO_TURNOUT", "no record of the file is a catalogue turnout (Ril 800.0120A01): name the records to hold by number");
		for (const t of turnouts) for (const n of t.records) if (!held.has(n)) held.set(n, t.designation);
	}
	return held;
}
