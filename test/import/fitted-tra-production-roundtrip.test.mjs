import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Import this first: it installs the same Node aliases used by the productive
// Technet parser before the remaining production modules are loaded.
const corpus = await import("../axtran2/corpus/loadTraAlignment.mjs");
const { deps, momentsFor } = await import("../axtran2/corpus/createTraScenario.mjs");
const { fitTra } = await import("../../tools/axtran2/fitTra.mjs");
const { writeTra } = await import("../../src/services/axtran2/traWriter.js");
const { parseTraGraAuto } = await import("../../src/import/parsers/technet/vermEsn/parseTRA_GRA.js");
const { buildSparseFromLandFAT } = await import("../../src/import/build/buildSparseFromLandFAT.js");
const { makeAlignment2DFromSparse } = await import("../../src/aim-core/alignment/aggregate/AlignmentFactory.js");
const { createAlignmentPoseJacobian } = await import("../../src/domain/optimization/alignment/AlignmentPoseJacobian.js");
const { createNineElementScenario, TYPES, TRUE_LENGTHS, TRUE_CURVATURES } = await import("../axtran2/fixtures/nineElementScenario.mjs");

const { buildProductionAlignment, traAlignmentFromBytes } = corpus;
const LENGTH_TOLERANCE = 1e-6;
const POSITION_TOLERANCE = 2e-4;
const DIRECTION_TOLERANCE = 1e-10;
const CURVATURE_TOLERANCE = 1e-12;

function bufferOf(bytes) {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function elementKind(element) {
	if (element.kind === "transition" || element.transType) return "transition";
	if (element.kind === "kink") return "kink";
	if (element.type && element.type !== "fixed") return element.type;
	return element.curvature === 0 ? "straight" : "arc";
}

function elementFamily(element) {
	return element.family ?? element.transType ?? null;
}

function uniqueStations(values) {
	return [...new Set(values.map((value) => value.toPrecision(15)))].map(Number).sort((a, b) => a - b);
}

function comparePose(actual, expected, label) {
	assert.ok(Math.hypot(actual.p.x - expected.p.x, actual.p.y - expected.p.y) < POSITION_TOLERANCE,
		`${label}: position differs by ${Math.hypot(actual.p.x - expected.p.x, actual.p.y - expected.p.y)}`);
	assert.ok(Math.hypot(actual.t.x - expected.t.x, actual.t.y - expected.t.y) < DIRECTION_TOLERANCE,
		`${label}: tangent differs by ${Math.hypot(actual.t.x - expected.t.x, actual.t.y - expected.t.y)}`);
}

function assertDecodedStartPoses({ direct, bridged, expected }) {
	const expectedTangent = { x: Math.cos(expected.theta), y: Math.sin(expected.theta) };
	assert.ok(Math.hypot(direct.startPose.x - expected.x, direct.startPose.y - expected.y) < POSITION_TOLERANCE,
		"direct reader start position matches the independently known writer pose");
	assert.ok(Math.hypot(Math.cos(direct.startPose.theta) - expectedTangent.x, Math.sin(direct.startPose.theta) - expectedTangent.y) < DIRECTION_TOLERANCE,
		"direct reader start direction matches the independently known writer pose");
	assert.ok(Math.hypot(bridged.startPose.p.x - expected.x, bridged.startPose.p.y - expected.y) < POSITION_TOLERANCE,
		"productive bridge start position matches the independently known writer pose");
	assert.ok(Math.hypot(bridged.startPose.t.x - expectedTangent.x, bridged.startPose.t.y - expectedTangent.y) < DIRECTION_TOLERANCE,
		"productive bridge start direction matches the independently known writer pose");
}

async function deterministicAdapterFixture() {
	// Reuse the repository's deterministic nine-element AXTRAN fixture. Unlike
	// the corpus-backed adapter test it is self-contained in a fresh checkout.
	const scenario = createNineElementScenario();
	const original = TYPES.map((type, index) => ({
		id: `E${index}`,
		type,
		length: TRUE_LENGTHS[index],
		...(type === "arc" ? { curvature: TRUE_CURVATURES[index === 2 ? 0 : 1] } : {}),
		...(type === "transition" ? { family: "bloss" } : {}),
		...(index === 0 || index === TYPES.length - 1 ? { held: true } : {}),
	}));
	const startPose = { x: 0, y: 0, theta: 0 };
	const lines = ["Nr;Y;X", ...scenario.points.map((point) => `${point.name};${point.x};${point.y}`)];
	const perturbed = original.map((element, index) => {
		if (element.held) return element;
		const sign = index % 2 ? 1 : -1;
		return {
			...element,
			length: element.length * (1 + sign * 0.02),
			...(element.type === "arc" ? { curvature: element.curvature * (1 - sign * 0.03) } : {}),
		};
	});
	const chain = createAlignmentPoseJacobian({ elements: perturbed, startPose, momentsFor });
	const written = writeTra({
		elements: perturbed,
		poseOfElement: (index) => chain.entryPose(index),
		poseAtStation: (s) => chain.poseAt(s),
		endPose: chain.endPose,
	});
	const scratch = await mkdtemp(join(tmpdir(), "fitted-tra-production-roundtrip-"));
	const perturbedFile = join(scratch, "perturbed.TRA");
	await writeFile(perturbedFile, written.bytes);
	return {
		fixture: "test/axtran2/fixtures/nineElementScenario.mjs",
		startPose,
		result: await fitTra({ tra: perturbedFile, points: lines.join("\n"), tolerance: 0.15, maxIterations: 300 }),
	};
}

test("fitted TRA bytes survive the productive parser, sparse bridge and realization without hidden normalization", async (context) => {
	const { fixture, startPose, result } = await deterministicAdapterFixture();
	assert.ok(result.report.verdict.ok, `${result.report.verdict.status} ${result.report.verdict.reason ?? ""}`);
	const fittedBytes = Uint8Array.from(result.tra);

	const document = await parseTraGraAuto({ name: "fitted.TRA", arrayBuffer: async () => bufferOf(fittedBytes) });
	assert.equal(document.alignments.length, 1, "the productive parser yields one alignment");
	const bridged = buildSparseFromLandFAT(document.alignments[0]);
	const production = makeAlignment2DFromSparse({ startPose: bridged.startPose, sparse: bridged.sparse, ...deps }).alignment;

	const direct = await traAlignmentFromBytes(fittedBytes, "fitted.TRA");
	assertDecodedStartPoses({ direct, bridged, expected: startPose });
	const directGeometry = buildProductionAlignment({ elements: direct.elements, startPose: direct.startPose, deps });
	const fittedGeometry = buildProductionAlignment({ elements: result.fitted, startPose, deps });

	const dropped = result.report.output.dropped;
	const inserted = bridged.sparse.filter((element) => element.meta?.insertedBy === "enforceAlternation");
	const sourceSparse = bridged.sparse.filter((element) => element.meta?.insertedBy !== "enforceAlternation");
	context.diagnostic(JSON.stringify({
		fixture,
		dropped,
		mergedRecords: direct.mergedRecords,
		unsupported: direct.unsupported,
		insertedAlternationElements: inserted.length,
	}));
	assert.deepEqual(dropped, [], "the fitted writer reports every dropped record explicitly (none in this fixture)");
	assert.equal(direct.mergedRecords, 0, "the direct fitted-byte reader reports merged records explicitly (none in this fixture)");
	assert.deepEqual(direct.unsupported, [], "the direct fitted-byte reader reports unsupported records explicitly (none in this fixture)");
	assert.equal(inserted.length, 0, "the productive bridge must not hide alternation insertion in this supported fixture");
	assert.equal(sourceSparse.length, result.fitted.length, "productive source elements are neither silently dropped nor added");
	assert.equal(direct.elements.length, result.fitted.length, "direct fitted-byte elements retain the fitted count");

	for (let index = 0; index < result.fitted.length; index += 1) {
		const expected = result.fitted[index];
		const decoded = direct.elements[index];
		const sparse = sourceSparse[index];
		assert.equal(decoded.type, expected.type, `element ${index}: fitted/direct type`);
		assert.equal(elementKind(sparse), expected.type, `element ${index}: productive sparse type`);
		assert.ok(Math.abs(decoded.length - expected.length) < LENGTH_TOLERANCE, `element ${index}: fitted/direct length`);
		assert.ok(Math.abs((sparse.arcLength ?? 0) - expected.length) < LENGTH_TOLERANCE, `element ${index}: productive sparse length`);
		if (expected.type === "transition") {
			assert.equal(decoded.family, expected.family, `element ${index}: fitted/direct transition family`);
			assert.equal(elementFamily(sparse), expected.family, `element ${index}: productive transition family`);
		}
		if (expected.type === "arc") assert.ok(Math.abs(decoded.curvature - expected.curvature) < CURVATURE_TOLERANCE, `element ${index}: curvature`);
	}

	assert.ok(Math.abs(production.arcLength - directGeometry.arcLength) < LENGTH_TOLERANCE, "productive/direct total length");
	assert.ok(Math.abs(production.arcLength - fittedGeometry.arcLength) < LENGTH_TOLERANCE, "productive/fitted total length");
	const stations = [0, production.arcLength];
	let station = 0;
	for (const element of direct.elements) {
		stations.push(station, station + element.length / 2, station + element.length);
		station += element.length;
	}
	for (const s of uniqueStations(stations)) {
		const productivePose = production.poseAt(s, { quality: "exact" });
		const directPose = directGeometry.poseAt(s, { quality: "exact" });
		const fittedPose = fittedGeometry.poseAt(s, { quality: "exact" });
		comparePose(productivePose, directPose, `s=${s}: productive/direct`);
		comparePose(productivePose, fittedPose, `s=${s}: productive/fitted`);
		assert.ok(Math.abs(production.curvatureAt(s) - directGeometry.curvatureAt(s)) < CURVATURE_TOLERANCE, `s=${s}: productive/direct curvature`);
		assert.ok(Math.abs(production.curvatureAt(s) - fittedGeometry.curvatureAt(s)) < CURVATURE_TOLERANCE, `s=${s}: productive/fitted curvature`);
	}
	assert.deepEqual(result.tra, fittedBytes, "neither production path mutates the fitted TRA bytes");
});
