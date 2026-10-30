import assert from "node:assert/strict";
import test from "node:test";
import { writeTra, KZ, TRA_RECORD_BYTES } from "../../src/services/axtran2/traWriter.js";
import { traAlignmentFromBytes, buildProductionAlignment } from "./corpus/loadTraAlignment.mjs";
import { deps } from "../../src/domain/optimization/alignment/SolverDependencies.js";
import { decodeBinary } from "../../src/import/parsers/technet/vermEsn/sharedVermesn.js";

const startPose = { x: 2400000, y: 5500000, theta: 0.3 };
const poseOf = (alignment, s) => {
	const { p, t } = alignment.poseAt(s, { quality: "exact" });
	return { x: p.x, y: p.y, theta: Math.atan2(t.y, t.x) };
};
const close = (a, b, tolerance = 2e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const curvature = (radius) => radius === 0 ? 0 : -1 / radius;
const fixed = (id, length, kappa) => kappa === 0
	? { id, type: "straight", length }
	: { id, type: "arc", length, curvature: kappa };

function sequence(family, kappaA, kappaB, extra = {}) {
	return [
		fixed("A", 20, kappaA),
		{ id: "T8", type: "transition", family, length: 80, ...extra },
		fixed("B", 30, kappaB),
	];
}

function exportInput(elements) {
	const alignment = buildProductionAlignment({ elements, startPose, deps });
	return {
		elements,
		poseOfElement: (index) => poseOf(alignment, elements.slice(0, index).reduce((s, e) => s + e.length, 0)),
		endPose: poseOf(alignment, alignment.arcLength),
		startStation: 1234,
	};
}

// Encode the documented 78-byte source layout independently of writeTra.
// In particular, the source discriminator is literally 8, never inferred
// from the writer's family table.
function binaryType8Fixture(radiusA, radiusE, family) {
	const elements = sequence(family, curvature(radiusA), curvature(radiusE));
	const input = exportInput(elements);
	const rows = elements.map((element, index) => ({
		...input.poseOfElement(index),
		kz: index === 1 ? 8 : (element.type === "arc" ? 1 : 0),
		r1: index === 1 ? radiusA : (index === 0 ? radiusA : radiusE),
		r2: index === 1 ? radiusE : (index === 0 ? radiusA : radiusE),
		length: element.length,
		station: 1234 + elements.slice(0, index).reduce((s, e) => s + e.length, 0),
	}));
	rows.push({ ...input.endPose, kz: radiusE === 0 ? 0 : 1, r1: radiusE, r2: radiusE, length: 0, station: 1364 });
	const bytes = new Uint8Array(5 * 78);
	const view = new DataView(bytes.buffer);
	view.setUint16(48, 3, true);
	rows.forEach((row, i) => {
		const at = (i + 1) * 78;
		const direction = ((Math.PI / 2 - row.theta) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
		for (const [offset, value] of [[0, row.r1], [8, row.r2], [16, row.x], [24, row.y],
			[32, direction], [40, row.station], [50, row.length], [58, 27], [66, 29]]) {
			view.setFloat64(at + offset, value, true);
		}
		view.setUint16(at + 48, row.kz, true);
		view.setFloat32(at + 74, 0, true);
	});
	return { bytes, elements };
}

for (const [radiusA, radiusE, family] of [
	[0, 500, "bloss_halfwave_in"], [500, 0, "bloss_halfwave_out"],
	[0, -500, "bloss_halfwave_in"], [-500, 0, "bloss_halfwave_out"],
	[1000, 500, "bloss_halfwave_in"], [500, 1000, "bloss_halfwave_out"],
	[-1000, -500, "bloss_halfwave_in"], [-500, -1000, "bloss_halfwave_out"],
]) {
	test(`TRA Kz8 ${radiusA} -> ${radiusE}: binary import, realization and Kz8 reimport`, async () => {
		const { bytes, elements } = binaryType8Fixture(radiusA, radiusE, family);
		const sourceCopy = bytes.slice();
		const loaded = await traAlignmentFromBytes(bytes, "synthetic-type8.TRA");
		assert.deepEqual(loaded.unsupported, []);
		const transition = loaded.elements.find((e) => e.type === "transition");
		assert.equal(transition.family, family);
		assert.equal(transition.length, 80);
		assert.equal(transition.entryCurvature, curvature(radiusA));
		assert.equal(transition.exitCurvature, curvature(radiusE));
		const expected = buildProductionAlignment({ elements, startPose, deps });
		const actual = buildProductionAlignment({ elements: loaded.elements, startPose: loaded.startPose, deps });
		assert.equal(actual.arcLength, 130);
		for (const s of [0, 20, 40, 60, 80, 100, 130]) {
			const a = poseOf(actual, s), e = poseOf(expected, s);
			close(a.x, e.x); close(a.y, e.y); close(a.theta, e.theta, 1e-12);
			close(actual.curvatureAt(s), expected.curvatureAt(s), 1e-12);
		}
		const exported = writeTra(exportInput(loaded.elements));
		assert.equal(KZ.blossHalfwave, 8);
		assert.equal(TRA_RECORD_BYTES, 78);
		assert.equal(new DataView(exported.bytes.buffer).getUint16(2 * 78 + 48, true), 8);
		const decoded = decodeBinary(exported.bytes.buffer, "TRA").rowsRaw;
		assert.equal(decoded[2].radiusA, radiusA);
		assert.equal(decoded[2].radiusE, radiusE);
		const reloaded = await traAlignmentFromBytes(exported.bytes, "reexport-type8.TRA");
		assert.deepEqual(reloaded.unsupported, []);
		assert.equal(reloaded.elements.find((e) => e.type === "transition").family, family);
		assert.deepEqual(bytes, sourceCopy);
	});
}

// Error cases use explicit finite dummy poses: they exercise representation
// refusal before any file is returned, not geometry/solver correctness.
function attemptedWrite(elements) {
	return writeTra({ elements, poseOfElement: () => ({ x: 0, y: 0, theta: 0 }), endPose: { x: 0, y: 0, theta: 0 } });
}
const refuses = (elements) => assert.throws(() => attemptedWrite(elements), { code: "UNREPRESENTABLE_TYPE8" });

test("Kz8 export refuses direction changes, ambiguous curvature and invalid references", () => {
	for (const [family, a, b] of [
		["bloss_halfwave_in", 0.002, 0], ["bloss_halfwave_out", 0, 0.002],
		["bloss_halfwave_in", -0.001, 0.002], ["bloss_halfwave_out", 0.002, -0.001],
		["bloss_halfwave_in", 0.002, 0.002], ["bloss_halfwave_in", 0, 0],
		["bloss_halfwave_in", NaN, 0.002], ["bloss_halfwave_in", Infinity, 0.002],
	]) refuses(sequence(family, a, b));
});

test("Kz8 export does not silently drop zero/nonfinite length or nonrepresentable composition", () => {
	for (const length of [0, -1, NaN, Infinity]) refuses(sequence("bloss_halfwave_in", 0, 0.002, { length }));
	for (const extra of [
		{ normLengthPartition: [0.5, 0, 0.5] },
		{ normLengthPartition: null },
		{ normLengthPartition: Array(3) },
		{ normLengthPartition: [1, , 0] },
		{ opts: { normLengthPartition: [0, 0, 1] } },
		{ opts: { w1: 0.5, w2: 0.5 } },
		{ opts: { w1: 1 } },
		{ opts: { custom: true } },
	]) refuses(sequence("bloss_halfwave_in", 0, 0.002, extra));
	for (const extra of [{ normLengthPartition: [1, 0, 0] }, { opts: { w1: 1, w2: 1 } }]) {
		assert.equal(attemptedWrite(sequence("bloss_halfwave_in", 0, 0.002, extra)).records, 3);
	}
});

test("ordinary full Bloss remains Kz4; unresolved raw labels cannot be written as it", async () => {
	const elements = sequence("bloss", 0, 0.002);
	const exported = writeTra(exportInput(elements));
	assert.equal(new DataView(exported.bytes.buffer).getUint16(2 * 78 + 48, true), 4);
	const loaded = await traAlignmentFromBytes(exported.bytes, "full-bloss.TRA");
	assert.equal(loaded.elements.find((e) => e.type === "transition").family, "bloss");
	assert.throws(() => attemptedWrite(sequence("Bloss (1f geschw.)", 0, 0.002)), { code: "UNKNOWN_FAMILY" });
});
