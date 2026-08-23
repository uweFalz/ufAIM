import assert from "node:assert/strict";
import test from "node:test";
import { createGndEdgeIndex } from "../src/import/parsers/technet/gndEdit/gnd/createGndEdgeIndex.js";
import { buildGndSequences } from "../src/import/parsers/technet/gndEdit/gnd/buildGndSequences.js";

function row(ordinal, pad1, pad2) {
	return { __sheet: "X_ASC21_EL", __rowIndex: ordinal, PAD1: pad1, PAD2: pad2, ELSYS: "L1", ELTYP: 0, ELPAR1: 1 };
}

function sequences(rows) {
	const edges = createGndEdgeIndex({ elRows: rows }).EL;
	return buildGndSequences({
		edgesByFamily: { EL: edges }, edgeFamilies: ["EL"],
		helpers: {
			buildSequenceSeed: (edge) => ({
				id: `seq_${edge.id}`, family: edge.family, startPad: edge.padA, endPad: edge.padB,
				required: edge.required,
				candidates: { ppKeys: new Set(["pp"]), plKeys: new Set(["pl"]) },
				edgeChain: [edge],
			}),
			isValidSeedForFamily: () => true,
			finalizeMergedSequence: (sequence) => ({ family: sequence.family, edgeChain: sequence.edgeChain }),
		},
	}).sequencesByFamily.EL;
}

test("ordered source rows produce an immutable preserved witness", () => {
	const [sequence] = sequences([row(1, "A", "B"), row(2, "B", "C")]);
	assert.deepEqual(sequence.sourceOrderWitness, {
		sourceRows: [{ rowRef: "X_ASC21_EL:1", sourceOrdinal: 1 }, { rowRef: "X_ASC21_EL:2", sourceOrdinal: 2 }],
		assembledRows: [{ rowRef: "X_ASC21_EL:1", sourceOrdinal: 1 }, { rowRef: "X_ASC21_EL:2", sourceOrdinal: 2 }],
		classification: "preserved", blockAuthority: "not-available-in-table-export",
	});
	assert.equal(sequence.edgeChain[0].sourceOrdinal, 1);
	assert.ok(Object.isFrozen(sequence.sourceOrderWitness));
	assert.ok(Object.isFrozen(sequence.sourceOrderWitness.sourceRows[0]));
});

test("shuffled input remains preserved when assembly restores source ordinal order", () => {
	const [sequence] = sequences([row(2, "B", "C"), row(1, "A", "B")]);
	assert.deepEqual(sequence.sourceOrderWitness.assembledRows.map((entry) => entry.sourceOrdinal), [1, 2]);
	assert.equal(sequence.sourceOrderWitness.classification, "preserved");
});

test("prepend-required assembly exposes reversed source order without repairing it", () => {
	const [sequence] = sequences([row(1, "B", "C"), row(2, "A", "B")]);
	assert.deepEqual(sequence.sourceOrderWitness.sourceRows.map((entry) => entry.sourceOrdinal), [1, 2]);
	assert.deepEqual(sequence.sourceOrderWitness.assembledRows.map((entry) => entry.sourceOrdinal), [2, 1]);
	assert.equal(sequence.sourceOrderWitness.classification, "reordered");
});

test("repeated ordinals are non-monotone and branches retain separate witnesses", () => {
	const [repeated] = sequences([row(7, "A", "B"), row(7, "B", "C")]);
	assert.equal(repeated.sourceOrderWitness.classification, "non-monotone");

	const branched = sequences([row(1, "A", "B"), row(2, "B", "C"), row(3, "B", "D")]);
	assert.equal(branched.length, 2);
	assert.deepEqual(branched.map((sequence) => sequence.sourceOrderWitness.assembledRows.length).sort(), [1, 2]);
	assert.ok(branched.every((sequence) => sequence.sourceOrderWitness.blockAuthority === "not-available-in-table-export"));
});
