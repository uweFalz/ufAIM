// src/services/axtran2/editedElements.js
//
// The start alignment with records taken out and put in. The reader hands
// over the file's elements and which record each carries; this applies the
// structure edits (recordEdits.js) and hands back elements the fit can
// start from, with the record each carries, inserted ones under their key.
//
// What is refused: taking out the first or the last record (the file's
// start and end pose stand on them), a turnout's record (catalogue
// geometry), a kink; putting a record in before the first or after the
// last; two transitions side by side (the kernel reads a transition's ends
// from its neighbours, and two of them have none between).
//
// A record taken out leaves its length in the file: the element before it
// carries that span on (`fileSpan`), so that station equations and cants
// are still found by their distance in the file; an inserted element has
// no span there. Equal neighbours that meet where a record went out are
// one element again, as the reader makes them.

import { insertKey } from "./recordEdits.js";

export const EDITED_ELEMENTS_VERSION = "axtran2/edited-elements/0.1";

export class EditedElementsError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "EditedElementsError";
		this.code = code;
		this.detail = detail;
	}
}
const error = (code, message, detail) => { throw new EditedElementsError(code, message, detail); };

const equalNeighbours = (a, b) => a && b && !a.held && !b.held && !a.fixed && !b.fixed && !a.inserted && !b.inserted && a.type === b.type
	&& (a.type === "straight" || (a.type === "arc" && Math.abs(a.curvature - b.curvature) <= 1e-12 * Math.max(1, Math.abs(a.curvature))));

/**
 * @param {object} input
 * @param {Array} input.elements            the reader's elements, held and edited records already apart
 * @param {Array<string|null>} input.recordElements  the reader's record -> element id
 * @param {Array} input.records             the file's records [{ number, type, length }]
 * @param {Set<number>} [input.removed]
 * @param {Map<number, Array>} [input.inserted]   record -> specs put in after it
 * @param {Array} [input.turnouts]          [{ designation, records }]
 * @returns {{elements: Array, recordElements: Map, elementRecords: Map, inserted: Array, removed: number[]}}
 *          recordElements: record number or insert key -> element id (null where removed);
 *          elementRecords: element id -> its records (numbers and keys) in order
 */
export function applyStructure({ elements, recordElements, records, removed = new Set(), inserted = new Map(), turnouts = [] }) {
	const count = records.length;
	for (const n of removed) {
		if (!(n >= 1 && n <= count)) error("INVALID_EDIT", `record ${n} does not exist: the file has ${count}`);
		if (n === 1 || n === count) error("INVALID_EDIT", `record ${n} is the ${n === 1 ? "first" : "last"} of the file: the start and the end pose stand on it, it stays`);
		if (records[n - 1].type === "kink") error("INVALID_EDIT", `record ${n} is a kink: nothing to take out`);
		const turnout = turnouts.find((t) => t.records.includes(n));
		if (turnout) error("INVALID_EDIT", `record ${n} belongs to the turnout ${turnout.designation}: it stays`);
		if (recordElements[n - 1] === null) error("INVALID_EDIT", `record ${n} carries no element this adapter can take out`);
	}
	for (const n of inserted.keys()) {
		if (!(n >= 1 && n < count)) error("INVALID_EDIT", `a record goes in between two of the file's: after 1 to ${count - 1}, not after ${n}`);
		if (recordElements[n - 1] === null) error("INVALID_EDIT", `nothing can go in after record ${n}: it carries no element`);
	}
	// each element with its records, in order; an element of a removed record goes out
	const own = new Map();
	recordElements.forEach((id, i) => { if (id !== null) { if (!own.has(id)) own.set(id, []); own.get(id).push(i + 1); } });
	const out = [];
	const push = (e, keys) => out.push({ element: e, keys });
	let insertCount = 0;
	const addInserted = (after, list) => list.forEach((spec, i) => {
		const key = insertKey(after, i + 1);
		const id = `I${++insertCount}`;
		const e = { id, type: spec.type, length: spec.length, inserted: Object.freeze({ after, index: i + 1, key }), fileSpan: 0,
			...(spec.type === "arc" ? { curvature: -1 / spec.radius } : {}), ...(spec.type === "transition" ? { family: spec.family ?? "clothoid" } : {}) };
		push(e, [key]);
	});
	for (const e of elements) {
		const keys = own.get(e.id) ?? [];
		const gone = keys.length === 1 && removed.has(keys[0]);
		if (gone) {
			const previous = out[out.length - 1];
			if (previous) previous.element = { ...previous.element, fileSpan: (previous.element.fileSpan ?? previous.element.length) + e.length };
		} else {
			push({ ...e, fileSpan: e.fileSpan ?? e.length }, keys);
		}
		for (const n of keys) if (inserted.has(n)) addInserted(n, inserted.get(n));
	}
	// equal neighbours that now meet are one element
	const merged = [];
	for (const item of out) {
		const last = merged[merged.length - 1];
		if (last && equalNeighbours(last.element, item.element)) {
			last.element = { ...last.element, length: last.element.length + item.element.length, fileSpan: (last.element.fileSpan ?? 0) + (item.element.fileSpan ?? 0) };
			last.keys = [...last.keys, ...item.keys];
		} else merged.push({ element: { ...item.element }, keys: [...item.keys] });
	}
	// two transitions side by side: not by an edit. A file may have them (the reader
	// puts a junction arc between them where the curvature there is not zero)
	const wasBeside = new Set(elements.slice(1).map((e, i) => `${elements[i].id}|${e.id}`));
	for (let i = 1; i < merged.length; i++) {
		const a = merged[i - 1].element, b = merged[i].element;
		if (a.type === "transition" && b.type === "transition" && !wasBeside.has(`${a.id}|${b.id}`)) {
			error("INVALID_EDIT", `two transitions would meet (${merged[i - 1].keys.join(",")} and ${merged[i].keys.join(",")}): the kernel reads a transition's ends from its neighbours`);
		}
	}
	const recordElementsOut = new Map();
	const elementRecords = new Map();
	for (const { element, keys } of merged) { elementRecords.set(element.id, keys); for (const k of keys) recordElementsOut.set(k, element.id); }
	for (const n of removed) recordElementsOut.set(n, null);
	const insertedOut = merged.flatMap(({ element }) => (element.inserted ? [{ ...element.inserted, type: element.type, length: element.length, radius: element.type === "arc" ? -1 / element.curvature : null, family: element.family ?? null, element: element.id }] : []));
	return { elements: merged.map((m) => m.element), recordElements: recordElementsOut, elementRecords, inserted: insertedOut, removed: [...removed].sort((a, b) => a - b) };
}
