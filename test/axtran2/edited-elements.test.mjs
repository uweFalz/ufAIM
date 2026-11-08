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
	assert.deepEqual(insertOf("7+2"), { after: 7, index: 2, part: null });
	assert.deepEqual(insertOf("7+2b"), { after: 7, index: 2, part: "b" });
	assert.ok(isInsertKey("7+2a"));
	assert.equal(insertOf("7"), null);
	// a turnout from the catalogue: its designation, the branch's side, how it lies
	const w = parseStructure("+3=W:190-1/9 +3=W:EW500-1:12:L:WE +5=W:300-1/9:R:Bogen");
	assert.deepEqual(w.inserted.get(3), [{ type: "turnout", radius: 190, ratio: 9, side: "right", orientation: "WA" }, { type: "turnout", radius: 500, ratio: 12, side: "left", orientation: "WE" }]);
	assert.deepEqual(w.inserted.get(5), [{ type: "turnout", radius: 300, ratio: 9, side: "right", orientation: "arc" }]);
	assert.equal(formatEdits("+3=W:190-1/9 +3=W:EW500-1:12:L:WE +5=W:300-1/9:R:Bogen"), "+3=W:190-1/9:R +3=W:500-1/12:L:WE +5=W:300-1/9:R:Bogen");
	assert.throws(() => parseStructure("+3=W:250-1/9"), (e) => e.code === "INVALID_EDIT" && /Ril 800.0120A01/.test(e.message));
	assert.throws(() => parseStructure("+3=W:190"), (e) => e.code === "INVALID_EDIT");
});

test("a turnout put in is its branch arc and end piece, held, under keys a and b", () => {
	const { elements, recordElements } = reader([1]);
	const put = applyStructure({ elements, recordElements, records, inserted: new Map([[1, [{ type: "turnout", radius: 190, ratio: 9, side: "right", orientation: "WA" }]], [4, [{ type: "turnout", radius: 300, ratio: 9, side: "left", orientation: "WA" }]]]) });
	const alpha = Math.atan(1 / 9);
	const ins = put.elements.filter((e) => e.inserted);
	assert.deepEqual(ins.map((e) => [e.inserted.key, e.type, Number(e.length.toFixed(4)), e.curvature ?? null, e.heldTurnout, e.inserted.turnout, e.inserted.part]), [
		["1+1a", "arc", Number((190 * alpha).toFixed(4)), -1 / 190, true, "EW 190-1:9", "arc"],
		["1+1b", "straight", 6.0917, null, true, "EW 190-1:9", "endPiece"],
		["4+1", "arc", Number((300 * alpha).toFixed(4)), 1 / 300, true, "EW 300-1:9", "arc"],
	], "the right-hand branch is a negative curvature; the EW 300-1:9 has no end piece in the annex");
	assert.deepEqual(put.turnouts.map((t) => [t.designation, t.side, t.after, t.arc, t.endPiece, t.branchSpeedKmh, [...t.records]]), [["EW 190-1:9", "right", 1, "1+1a", "1+1b", 40, ["1+1a", "1+1b"]], ["EW 300-1:9", "left", 4, "4+1", null, 50, ["4+1"]]]);
	// the end piece first: the track enters at the Weichenende
	const we = applyStructure({ elements, recordElements, records, inserted: new Map([[1, [{ type: "turnout", radius: 190, ratio: 9, side: "left", orientation: "WE" }]]]) });
	assert.deepEqual(we.elements.filter((e) => e.inserted).map((e) => [e.inserted.key, e.type]), [["1+1a", "straight"], ["1+1b", "arc"]]);
	assert.equal(we.turnouts[0].arc, "1+1b");
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

test("a crossing turnout is one route, a bent turnout the branch's curvature plus the line's", () => {
	// written and read back
	const k = parseStructure("+3=K:DKW:190-1/9:L +4=K:EKW190-1:9:R:gerade +5=W:190-1/9:R:auf-800 +6=W:500-1/12:L:WE:auf1000");
	assert.deepEqual(k.inserted.get(3), [{ type: "crossing", kind: "DKW", radius: 190, ratio: 9, side: "left", route: "curved" }]);
	assert.deepEqual(k.inserted.get(4), [{ type: "crossing", kind: "EKW", radius: 190, ratio: 9, side: "right", route: "straight" }]);
	assert.deepEqual(k.inserted.get(5), [{ type: "turnout", radius: 190, ratio: 9, side: "right", orientation: "WA", mainRadius: -800 }]);
	assert.deepEqual(k.inserted.get(6), [{ type: "turnout", radius: 500, ratio: 12, side: "left", orientation: "WE", mainRadius: 1000 }]);
	assert.equal(formatEdits("+3=K:DKW:190-1/9:L +4=K:EKW190-1:9:R:gerade +5=W:190-1/9:R:auf-800 +6=W:500-1/12:L:WE:auf1000"), "+3=K:DKW:190-1/9:L +4=K:EKW:190-1/9:R:gerade +5=W:190-1/9:R:auf-800 +6=W:500-1/12:L:WE:auf1000");
	for (const bad of ["+3=K:DKW:300-1/9", "+3=K:XKW:190-1/9", "+3=W:190-1/9:R:auf0"]) assert.throws(() => parseStructure(bad), (e) => e.code === "INVALID_EDIT", bad);
	// the routes: the connecting arc R * alpha onto the crossing track, or 2 R tan(alpha/2) straight over the crossing
	const { elements, recordElements } = reader([1, 3]);
	const alpha = Math.atan(1 / 9);
	const put = applyStructure({ elements, recordElements, records, inserted: new Map([[1, [{ type: "crossing", kind: "DKW", radius: 190, ratio: 9, side: "left", route: "curved" }]], [3, [{ type: "crossing", kind: "DKW", radius: 190, ratio: 9, side: "right", route: "straight" }]]]) });
	const ins = put.elements.filter((e) => e.inserted);
	assert.deepEqual(ins.map((e) => [e.inserted.key, e.type, Number(e.length.toFixed(4)), e.curvature ?? null, e.heldTurnout, e.inserted.turnout]), [
		["1+1", "arc", Number((190 * alpha).toFixed(4)), 1 / 190, true, "DKW 190-1:9, Bogenfahrt"],
		["3+1", "straight", Number((2 * 190 * Math.tan(alpha / 2)).toFixed(4)), null, true, "DKW 190-1:9, gerade Fahrt"],
	]);
	assert.deepEqual(put.turnouts.map((t) => [t.designation, t.kind, t.route, t.branchSpeedKmh, [...t.records]]), [["DKW 190-1:9, Bogenfahrt", "DKW", "curved", 40, ["1+1"]], ["DKW 190-1:9, gerade Fahrt", "DKW", "straight", 100, ["3+1"]]]);
	// bent onto the line: the branch's curvature is the turnout's plus the line's; to the same side an IBW, against it an ABW
	const bent = applyStructure({ ...reader([1, 3]), records, inserted: new Map([[1, [{ type: "turnout", radius: 190, ratio: 9, side: "right", orientation: "WA", mainRadius: 800 }]], [3, [{ type: "turnout", radius: 190, ratio: 9, side: "left", orientation: "WA", mainRadius: 800 }]]]) });
	const b = bent.elements.filter((e) => e.inserted);
	assert.deepEqual(b.map((e) => [e.inserted.key, e.type, e.inserted.turnout, e.inserted.part]), [["1+1a", "arc", "IBW 190-1:9 auf R 800", "arc"], ["1+1b", "arc", "IBW 190-1:9 auf R 800", "endPiece"], ["3+1a", "arc", "ABW 190-1:9 auf R 800", "arc"], ["3+1b", "arc", "ABW 190-1:9 auf R 800", "endPiece"]], "a bent turnout's end piece follows the branch");
	assert.ok(Math.abs(b[0].curvature - (-1 / 190 - 1 / 800)) < 1e-15, "IBW to the right on a right-hand line: tighter");
	assert.ok(Math.abs(b[2].curvature - (1 / 190 - 1 / 800)) < 1e-15, "ABW to the left on a right-hand line: the branch turns against the line");
	assert.ok(Math.abs(b[0].length - 190 * alpha) < 1e-12 && Math.abs(b[1].length - 6.0917) < 1e-12);
	assert.deepEqual(bent.turnouts.map((t) => [t.kind, t.bent.kind, t.bent.mainRadius, Number(t.bent.branchRadius.toFixed(3)), t.branchSpeedKmh]), [["IBW", "IBW", 800, 153.535, null], ["ABW", "ABW", 800, -249.180, null]], "the annex speaks for the straight turnout only: no speed for the bent one");
});

test("a turnout whose branch has two radii goes in as two arcs, backwards from the Weichenende, and bends as a whole", () => {
	const k = parseStructure("+3=W:7000/6000-1/42:R +4=W:EW6000/3700-1:32,5:L:WE +5=W:7000/6000-1/42:L:auf-9000");
	assert.deepEqual(k.inserted.get(3), [{ type: "turnout", radius: 7000, radiusEnd: 6000, ratio: 42, side: "right", orientation: "WA" }]);
	assert.deepEqual(k.inserted.get(4), [{ type: "turnout", radius: 6000, radiusEnd: 3700, ratio: 32.5, side: "left", orientation: "WE" }]);
	assert.equal(formatEdits("+3=W:7000/6000-1/42:R +4=W:EW6000/3700-1:32,5:L:WE"), "+3=W:7000/6000-1/42:R +4=W:6000/3700-1/32.5:L:WE");
	for (const bad of ["+3=W:7000/6000-1/32,5", "+3=W:7000-1/42", "+3=W:6000/7000-1/42"]) assert.throws(() => parseStructure(bad), (e) => e.code === "INVALID_EDIT", bad);
	assert.ok(isInsertKey("7+1c") && insertOf("7+1c").part === "c");
	const put = applyStructure({ ...reader([1, 3]), records, inserted: new Map([[1, k.inserted.get(3)], [3, k.inserted.get(4)]]) });
	const ins = put.elements.filter((e) => e.inserted);
	assert.deepEqual(ins.map((e) => [e.inserted.key, e.type, Number(e.length.toFixed(3)), Number((1 / e.curvature).toFixed(0)), e.heldTurnout, e.inserted.turnout, e.inserted.part]), [
		["1+1a", "arc", 80.001, -7000, true, "EW 7000/6000-1:42", "arc"], ["1+1b", "arc", 74.258, -6000, true, "EW 7000/6000-1:42", "arc2"],
		["3+1a", "arc", 100.738, 3700, true, "EW 6000/3700-1:32.5", "arc2"], ["3+1b", "arc", 21.197, 6000, true, "EW 6000/3700-1:32.5", "arc"],
	], "from the toe R1 then R2; from the end R2 then R1");
	assert.deepEqual(put.turnouts.map((t) => [t.designation, t.kind, t.radiusEnd, t.arc, [...t.arcs], t.endPiece, t.branchSpeedKmh, [...t.records]]), [["EW 7000/6000-1:42", "EW", 6000, "1+1a", ["1+1a", "1+1b"], null, 200, ["1+1a", "1+1b"]], ["EW 6000/3700-1:32.5", "EW", 3700, "3+1b", ["3+1a", "3+1b"], null, 160, ["3+1a", "3+1b"]]]);
	// bent onto a line of R 9000 turning left: the branch to the left is the tighter IBW in both arcs
	const bent = applyStructure({ ...reader([1, 3]), records, inserted: new Map([[1, k.inserted.get(5)]]) });
	const b = bent.elements.filter((e) => e.inserted);
	assert.ok(Math.abs(b[0].curvature - (1 / 7000 + 1 / 9000)) < 1e-15 && Math.abs(b[1].curvature - (1 / 6000 + 1 / 9000)) < 1e-15);
	assert.deepEqual(bent.turnouts.map((t) => [t.designation, t.kind, t.bent.kind, t.bent.branchRadii.map((r) => Number(r.toFixed(1))), t.branchSpeedKmh]), [["IBW 7000/6000-1:42 auf R -9000", "IBW", "IBW", [-3937.5, -3600], null]]);
});
