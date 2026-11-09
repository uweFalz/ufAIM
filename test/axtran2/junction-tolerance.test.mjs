// test/axtran2/junction-tolerance.test.mjs
//
// One bound for both readings of a TRA's R1/R2: the solver's reader
// (traAlignment.js) and the app's import (buildSparseFromLandFAT.js) put a
// holder of zero length at a junction where the file's curvature is not the
// neighbour's - and they decide "not the neighbour's" with the kernel's
// JUNCTION_CURVATURE_TOLERANCE, so the two readings cannot drift apart.

import assert from "node:assert/strict";
import test from "node:test";

const SERVICE = new URL("../../src/services/axtran2/", import.meta.url);
const KERNEL = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const { writeTra } = await import(new URL("traWriter.js", SERVICE));
const { traAlignmentFromDocument } = await import(new URL("../../src/import/parsers/technet/vermEsn/traAlignment.js", import.meta.url));
const { parseTraGraAuto } = await import(new URL("../../src/import/parsers/technet/vermEsn/parseTRA_GRA.js", import.meta.url));
const { buildSparseFromLandFAT } = await import(new URL("../../src/import/build/buildSparseFromLandFAT.js", import.meta.url));
const { createAlignmentPoseJacobian } = await import(new URL("AlignmentPoseJacobian.js", KERNEL));
const { momentsFor } = await import(new URL("SolverDependencies.js", KERNEL));
const junction = await import(new URL("CurvatureJunction.js", KERNEL));
const kernelIndex = await import(new URL("index.js", KERNEL));

const ORIGIN = { x: 3476000, y: 5474000 };
const startPose = { x: 0, y: 0, theta: 0.3 };
const R = 400;
// straight, clothoid onto R 400, arc R 400, straight: the writer puts R1 0 / R2 400 on the clothoid
const elements = [
	{ id: "E0", type: "straight", length: 60 },
	{ id: "E1", type: "transition", length: 50, family: "clothoid" },
	{ id: "E2", type: "arc", length: 80, curvature: -1 / R },
	{ id: "E3", type: "straight", length: 60 },
];
const world = (p) => ({ x: p.x + ORIGIN.x, y: p.y + ORIGIN.y, theta: p.theta });
const chain = createAlignmentPoseJacobian({ elements, startPose, momentsFor });
const bytes = writeTra({ elements, poseOfElement: (i) => world(chain.entryPose(i)), poseAtStation: (s) => world(chain.poseAt(s)), endPose: world(chain.endPose) }).bytes;

/** the file's document with the clothoid's R2 moved to another radius */
async function documentWithR2(radius) {
	const document = await parseTraGraAuto({ name: "junction.TRA", arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
	const records = document.alignments[0].coordGeom.elements;
	assert.equal(records[1].type, "Spiral");
	assert.equal(records[1].radiusEnd, R);
	records[1].radiusEnd = radius;
	return document;
}
/** R2 so that the curvature differs from the arc's by `delta` (1/m) */
const radiusOff = (delta) => 1 / (1 / R - delta);

test("the kernel names the bound once, and its index exports it", () => {
	assert.equal(junction.JUNCTION_CURVATURE_TOLERANCE, 1e-9);
	assert.equal(junction.STRAIGHT_CURVATURE_TOLERANCE, 1e-12);
	assert.equal(kernelIndex.JUNCTION_CURVATURE_TOLERANCE, junction.JUNCTION_CURVATURE_TOLERANCE);
	assert.equal(kernelIndex.sameJunctionCurvature, junction.sameJunctionCurvature);
	assert.ok(junction.sameJunctionCurvature(1 / 1000, 1 / 1000.0005));
	assert.ok(!junction.sameJunctionCurvature(1 / 1000, 1 / 1000.01));
	assert.ok(!junction.sameJunctionCurvature(NaN, 0) && !junction.sameJunctionCurvature(0, undefined));
	assert.ok(junction.isStraightCurvature(0) && junction.isStraightCurvature(-5e-13) && !junction.isStraightCurvature(1e-11) && !junction.isStraightCurvature(NaN));
});

test("reader and import flip at the same curvature difference: no holder within the bound, one beyond it", async () => {
	const tol = junction.JUNCTION_CURVATURE_TOLERANCE;
	for (const [delta, holders] of [[0, 0], [tol / 2, 0], [-tol / 2, 0], [tol * 2, 1], [-tol * 2, 1], [1e-6, 1]]) {
		const document = await documentWithR2(radiusOff(delta));
		const reader = traAlignmentFromDocument(document, bytes, "junction.TRA");
		assert.equal(reader.unsupported.length, 0);
		assert.equal(reader.insertedJunctionArcs, holders, `reader at ${delta.toExponential(1)}`);
		const sparse = buildSparseFromLandFAT(document.alignments[0]);
		assert.equal(sparse.sparse.filter((e) => e.meta?.insertedBy === "traLikeJunction").length, holders, `import at ${delta.toExponential(1)}`);
		// where a holder stands, both carry the file's R2 on it
		if (holders) {
			const held = reader.elements.find((e) => e.type === "arc" && e.length === 0);
			const importHolder = sparse.sparse.find((e) => e.meta?.insertedBy === "traLikeJunction");
			assert.ok(Math.abs(held.curvature - (-1 / radiusOff(delta))) < 1e-15);
			assert.ok(Math.abs(importHolder.curvature - held.curvature) < 1e-15, "the same curvature in both readings");
		}
	}
});
