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

import { insertKey, turnoutDesignation, crossingShape } from "./recordEdits.js";
import { turnoutShape } from "./heldRecords.js";
import { bentOnto, turnout as turnoutSpec, crossing as crossingSpec, crossingElement } from "../../domain/optimization/alignment/TurnoutCatalogue.js";

// the file's sign (R > 0 a right-hand curve) and the kernel's (heading grows to the left)
const curvatureOfRadius = (r) => (Number.isFinite(r) && r !== 0 ? -1 / r : 0);
const radiusOfCurvature = (k) => (Math.abs(k) > 1e-15 ? -1 / k : null);

export const EDITED_ELEMENTS_VERSION = "axtran2/edited-elements/0.3";

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
	const turnoutsOut = [];
	const addInserted = (after, list) => list.forEach((spec, i) => {
		if (spec.type === "crossing") {
			// one route through a crossing turnout: the connecting arc onto the crossing track, or the straight over the crossing
			const shape = crossingShape(spec.kind, spec.radius ?? null, spec.ratio);
			if (!shape) error("INVALID_EDIT", `after record ${after}: ${spec.kind} ${spec.radius === null || spec.radius === undefined ? `1:${spec.ratio}` : `${spec.radius}-1:${spec.ratio}`} is not a crossing${spec.kind === "Kr" ? "" : " turnout"} of Ril 800.0120A01`);
			// a plain crossing (Kr) is the straight over it, the annex's lw; a crossing turnout one of its two routes
			const route = shape.kind === "Kr" ? "straight" : spec.route ?? "curved";
			const element = shape.kind === "Kr" ? { type: "straight", length: shape.length } : crossingElement(crossingSpec({ kind: spec.kind, radius: spec.radius, ratio: spec.ratio, side: spec.side }), { route });
			const designation = shape.kind === "Kr" ? shape.designation : `${shape.designation}, ${route === "curved" ? "Bogenfahrt" : "gerade Fahrt"}`;
			const key = insertKey(after, i + 1);
			const id = `I${++insertCount}`;
			push({ id, type: element.type, length: element.length, ...(element.curvature !== undefined ? { curvature: element.curvature } : {}), fileSpan: 0, heldTurnout: true,
				inserted: Object.freeze({ after, index: i + 1, key, turnout: designation, part: route === "curved" ? "arc" : "straight" }) }, [key]);
			turnoutsOut.push({ designation, kind: shape.kind, route, radius: shape.radius, ratio: shape.ratio, side: shape.kind === "Kr" ? null : spec.side, orientation: null, after, index: i + 1,
				arc: route === "curved" ? key : null, endPiece: null, endPieceLength: null,
				// what the annex allows: in the curved route the branch's, over the crossing the main's
				branchSpeedKmh: route === "curved" ? shape.branchSpeedKmh : shape.mainSpeedKmh, records: [key] });
			return;
		}
		if (spec.type === "turnout") {
			// the branch of a catalogue turnout: the arc R * atan(1/n) - two arcs where the
			// branch has two radii, split by the annex's tangent lengths - and the straight
			// end piece the annex lists
			const shape = turnoutShape(spec.radius, spec.ratio, spec.radiusEnd ?? null);
			if (!shape) error("INVALID_EDIT", `after record ${after}: ${turnoutDesignation(spec)} is not a turnout of Ril 800.0120A01`);
			const endPiece = spec.orientation !== "arc" && shape.endPieces.length ? Math.min(...shape.endPieces) : null;
			// the kernel's heading grows to the left: a branch to the right is a negative curvature
			const sign = spec.side === "left" ? 1 : -1;
			let curvatures = shape.radii.map((r) => sign / r);
			let designation = turnoutDesignation(spec);
			let bent = null;
			if (Number.isFinite(spec.mainRadius)) {
				// bent onto the main track's curvature: Innen- or Außenbogenweiche (TurnoutCatalogue.bentOnto),
				// every arc of the branch by the same line curvature
				const mainCurvature = curvatureOfRadius(spec.mainRadius);
				const bentArcs = curvatures.map((c, k) => bentOnto(k === 0 && shape.radiusEnd === null ? turnoutSpec({ radius: shape.radius, ratio: shape.ratio, side: spec.side }) : { id: `${shape.designation}[${k}]`, curvature: c }, mainCurvature));
				curvatures = bentArcs.map((b) => b.curvature);
				const branchRadii = curvatures.map((c) => radiusOfCurvature(c));
				bent = Object.freeze({ kind: bentArcs[0].bent.kind, mainRadius: spec.mainRadius, branchRadius: branchRadii[0], branchRadii: Object.freeze(branchRadii) });
				designation = `${bent.kind} ${shape.radius}${shape.radiusEnd !== null ? `/${shape.radiusEnd}` : ""}-1:${shape.ratio} auf R ${spec.mainRadius}`;
			}
			// the end piece of a bent turnout follows the branch's curvature where it joins it
			const bendable = (p, curvature) => (bent && Math.abs(curvature) > 1e-15 ? { ...p, type: "arc", curvature } : p);
			const arcs = curvatures.map((curvature, k) => Math.abs(curvature) > 1e-15 ? { type: "arc", length: shape.branchLengths[k], curvature, part: k === 0 ? "arc" : "arc2" } : { type: "straight", length: shape.branchLengths[k], part: k === 0 ? "arc" : "arc2" });
			// entered at the Weichenende the branch runs backwards: the end piece, then the last radius first
			const parts = spec.orientation === "WE"
				? [...(endPiece === null ? [] : [bendable({ type: "straight", length: endPiece, part: "endPiece" }, curvatures[curvatures.length - 1])]), ...arcs.slice().reverse()]
				: [...arcs, ...(endPiece === null ? [] : [bendable({ type: "straight", length: endPiece, part: "endPiece" }, curvatures[curvatures.length - 1])])];
			const keys = parts.map((_, k) => insertKey(after, i + 1, parts.length > 1 ? "abc"[k] : ""));
			parts.forEach((p, k) => {
				const id = `I${++insertCount}`;
				push({ id, type: p.type, length: p.length, ...(p.curvature !== undefined ? { curvature: p.curvature } : {}), fileSpan: 0, heldTurnout: true,
					inserted: Object.freeze({ after, index: i + 1, key: keys[k], turnout: designation, part: p.part }) }, [keys[k]]);
			});
			turnoutsOut.push({ designation, kind: bent ? bent.kind : "EW", radius: shape.radius, radiusEnd: shape.radiusEnd, ratio: shape.ratio, side: spec.side, orientation: spec.orientation ?? "WA", after, index: i + 1,
				// `arc` the record of the first radius, `arcs` the branch's arcs in the track's order
				arc: keys[parts.indexOf(arcs[0])], arcs: parts.map((p, k) => (arcs.includes(p) ? keys[k] : null)).filter((k) => k !== null),
				endPiece: endPiece === null ? null : keys[parts.findIndex((p) => p.part === "endPiece")], endPieceLength: endPiece,
				// the annex speaks for the straight turnout; a bent branch has another radius and no row
				branchSpeedKmh: bent ? null : shape.branchSpeedKmh ?? null, bent, records: keys });
			return;
		}
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
	const byKey = new Map(insertedOut.map((i) => [i.key, i.element]));
	const insertedTurnouts = turnoutsOut.map((t) => Object.freeze({ ...t, records: Object.freeze(t.records), elements: Object.freeze(t.records.map((k) => byKey.get(k))) }));
	return { elements: merged.map((m) => m.element), recordElements: recordElementsOut, elementRecords, inserted: insertedOut, turnouts: insertedTurnouts, removed: [...removed].sort((a, b) => a - b) };
}
