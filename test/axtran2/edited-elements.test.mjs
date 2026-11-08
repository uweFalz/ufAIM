// test/axtran2/edited-elements.test.mjs
//
// Records taken out and put in: how they are written, and what the start
// alignment becomes.

import assert from "node:assert/strict";
import test from "node:test";

const SERVICE = new URL("../../src/services/axtran2/", import.meta.url);
const { parseStructure, parseAllEdits, parseEdits, formatEdits, insertKey, isInsertKey, insertOf, RecordEditsError } = await import(new URL("recordEdits.js", SERVICE));
const { applyStructure, EditedElementsError } = await import(new URL("editedElements.js", SERVICE));

test("the structure is written as a person types it, beside the values", () => {
	const all = parseAllEdits("7L=45,2 -9 +3=G:20 +3=B:-500:30 +11=U:40:Bloss, +12=Ü:25 4T=Bloss");
	assert.deepEqual([...all.values], [[7, { length: 45.2 }], [4, { family: "bloss" }]]);
	assert.deepEqual([...all.removed], [9]);
	assert.deepEqual([...all.inserted], [[3, [{ type: "straight", length: 20 }, { type: "arc", radius: -500, length: 30 }]], [11, [{ type: "transition", length: 40, family: "bloss" }]], [12, [{ type: "transition", length: 25, family: "clothoid" }]]]);
	assert.equal(formatEdits("7L=45,2 -9 +3=G:20 +3=B:-500:30 +11=U:40:Bloss +12=Ü:25 4T=Bloss"), "+3=G:20 +3=B:-500:30 4T=Bloss 7L=45,2 -9 +11=U:40:Bloss +12=U:25");
	assert.equal(formatEdits(all), formatEdits("7L=45,2 -9 +3=G:20 +3=B:-500:30 +11=U:40:Bloss +12=Ü:25 4T=Bloss"), "the parsed form writes the same");
	// values alone ignore the structure; the structure alone ignores the values
	assert.deepEqual([...parseEdits("-9 +3=G:20 7L=1")], [[7, { length: 1 }]]);
	assert.deepEqual([...parseStructure("7L=1 -9").removed], [9]);
	for (const bad of ["-x", "+3", "+3=X:20", "+3=G:0", "+3=B:0:20", "+3=B:300", "+3=U:40:Wiener"]) assert.throws(() => parseStructure(bad), (e) => e instanceof RecordEditsError && e.code === "INVALID_EDIT", bad);
	assert.equal(insertKey(7, 2), "7+2");
	assert.ok(isInsertKey("7+2") && !isInsertKey("7") && !isInsertKey("7L"));
	assert.deepEqual(insertOf("7+2"), { after: 7, index: 2 });
	assert.equal(insertOf("7"), null);
});

// the reader's view of a small file: straight, straight (merged), arc, straight, transition, arc
const records = [
	{ number: 1, type: "straight", length: 10 }, { number: 2, type: "straight", length: 20 }, { number: 3, type: "arc", length: 30, curvature: 1 / 300 },
	{ number: 4, type: "straight", length: 40 }, { number: 5, type: "transition", length: 50 }, { number: 6, type: "arc", length: 60, curvature: 1 / 500 },
];
const reader = (apart = []) => {
	const fixed = new Set(apart);
	const elements = [];
	const recordElements = [];
	for (const r of records) {
		const last = elements[elements.length - 1];
		if (last && last.type === "straight" && r.type === "straight" && !fixed.has(r.number) && !last.fixed) { last.length += r.length; recordElements.push(last.id); continue; }
		const e = { id: `E${elements.length}`, type: r.type, length: r.length, ...(r.curvature !== undefined ? { curvature: r.curvature } : {}), ...(r.type === "transition" ? { family: "clothoid" } : {}), ...(fixed.has(r.number) ? { fixed: true } : {}) };
		elements.push(e); recordElements.push(e.id);
	}
	return { elements, recordElements };
};

test("a record taken out leaves its span with the element before it; a record put in has none", () => {
	const { elements, recordElements } = reader([3]);
	const out = applyStructure({ elements, recordElements, records, removed: new Set([3]) });
	assert.deepEqual(out.elements.map((e) => [e.id, e.type, e.length, e.fileSpan]), [["E0", "straight", 70, 100], ["E3", "transition", 50, 50], ["E4", "arc", 60, 60]], "the straights around the arc are one element again, the arc's 30 m span with them");
	assert.deepEqual([...out.recordElements], [[1, "E0"], [2, "E0"], [4, "E0"], [5, "E3"], [6, "E4"], [3, null]]);
	assert.deepEqual([...out.elementRecords], [["E0", [1, 2, 4]], ["E3", [5]], ["E4", [6]]]);
	assert.deepEqual(out.removed, [3]);
	const put = applyStructure({ ...reader([2]), records, inserted: new Map([[2, [{ type: "transition", length: 25, family: "bloss" }, { type: "arc", radius: -400, length: 12 }]]]) });
	assert.deepEqual(put.elements.map((e) => [e.id, e.type, e.length, e.fileSpan, e.family ?? null]), [["E0", "straight", 10, 10, null], ["E1", "straight", 20, 20, null], ["I1", "transition", 25, 0, "bloss"], ["I2", "arc", 12, 0, null], ["E2", "arc", 30, 30, null], ["E3", "straight", 40, 40, null], ["E4", "transition", 50, 50, "clothoid"], ["E5", "arc", 60, 60, null]]);
	assert.equal(put.elements[3].curvature, 1 / 400, "the radius with the file's sign: R -400 is a left-hand curve, curvature positive");
	assert.deepEqual(put.inserted, [{ after: 2, index: 1, key: "2+1", type: "transition", length: 25, radius: null, family: "bloss", element: "I1" }, { after: 2, index: 2, key: "2+2", type: "arc", length: 12, radius: -400, family: null, element: "I2" }]);
	assert.deepEqual([...put.recordElements].slice(0, 4), [[1, "E0"], [2, "E1"], ["2+1", "I1"], ["2+2", "I2"]]);
	assert.deepEqual(put.elementRecords.get("I1"), ["2+1"]);
	// nothing changed: nothing changes
	const same = applyStructure({ ...reader(), records });
	assert.deepEqual(same.elements.map((e) => e.id), ["E0", "E1", "E2", "E3", "E4"]);
	assert.deepEqual([...same.elementRecords], [["E0", [1, 2]], ["E1", [3]], ["E2", [4]], ["E3", [5]], ["E4", [6]]]);
});

test("what is refused: the ends, a turnout, a kink, a place outside, two transitions side by side", () => {
	const r = reader([2, 4, 5]);
	const refuse = (input, pattern) => assert.throws(() => applyStructure({ ...r, records, ...input }), (e) => e instanceof EditedElementsError && e.code === "INVALID_EDIT" && pattern.test(e.message), String(pattern));
	refuse({ removed: new Set([1]) }, /first/);
	refuse({ removed: new Set([6]) }, /last/);
	refuse({ removed: new Set([9]) }, /does not exist/);
	refuse({ removed: new Set([2]), turnouts: [{ designation: "EW 190-1:9", records: [2, 3] }] }, /turnout/);
	refuse({ inserted: new Map([[6, [{ type: "straight", length: 5 }]]]) }, /after 1 to 5/);
	refuse({ inserted: new Map([[0, [{ type: "straight", length: 5 }]]]) }, /after 1 to 5/);
	refuse({ inserted: new Map([[5, [{ type: "transition", length: 5, family: "clothoid" }]]]) }, /two transitions/);
	refuse({ removed: new Set([4]), inserted: new Map([[3, [{ type: "transition", length: 5, family: "clothoid" }]]]) }, /two transitions/);
	// a file that has two transitions side by side keeps them: only an edit may not make such a pair
	const beside = { elements: [{ id: "E0", type: "straight", length: 10 }, { id: "E1", type: "transition", length: 20, family: "clothoid" }, { id: "E2", type: "transition", length: 20, family: "clothoid" }, { id: "E3", type: "straight", length: 10 }], recordElements: ["E0", "E1", "E2", "E3"] };
	const besideRecords = [{ number: 1, type: "straight", length: 10 }, { number: 2, type: "transition", length: 20 }, { number: 3, type: "transition", length: 20 }, { number: 4, type: "straight", length: 10 }];
	assert.equal(applyStructure({ ...beside, records: besideRecords }).elements.length, 4);
	assert.throws(() => applyStructure({ ...beside, records: besideRecords, inserted: new Map([[1, [{ type: "transition", length: 5, family: "clothoid" }]]]) }), /two transitions/);
	const kinked = { elements: [{ id: "E0", type: "straight", length: 10 }, { id: "E1", type: "kink", length: 0, held: true }, { id: "E2", type: "straight", length: 10 }], recordElements: ["E0", "E1", "E2"] };
	assert.throws(() => applyStructure({ ...kinked, records: [{ number: 1, type: "straight", length: 10 }, { number: 2, type: "kink", length: 0 }, { number: 3, type: "straight", length: 10 }], removed: new Set([2]) }), /kink/);
});
