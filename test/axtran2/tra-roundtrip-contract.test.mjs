import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

// The TRA round-trip contract between AXTRAN2 and alignmentOS. Two readers
// turn a Verm.esn TRA into an axis: the app's import bridge
// (parseTraGraAuto -> buildSparseFromLandFAT -> makeAlignment2DFromSparse)
// and the solver's (traAlignmentFromBytes -> buildProductionAlignment). A
// fitted TRA leaves the adapter through traWriter and comes back into the
// app through the bridge. The contract: on every trusted corpus file the two
// readers realise the same axis, and the written file realises it again
// through both - so what the adapter hands back is what alignmentOS will
// import. This file only reads app/ and src/import; it changes nothing there.
//
// Measured on 2026-10-30 over the 248 trusted files: the contract holds to
// 1e-8 m on 236 of them. The twelve others carry a transition pair meeting at
// a curvature (two Spirals in a row with R2 != 0): the solver's reader
// inserts a held arc of zero length carrying that curvature, the bridge
// writes transitions without their end curvatures, the junction falls to
// zero, and the app's axis misses the file's own recorded end by 0.8 m to
// 674 m. That is a defect of the app importer, reported to its owners, not
// of the adapter; the second test pins the divergence to exactly those
// files so that a fix of the bridge flips it and this test can then be
// folded into the first.

const ROOT = new URL("../../", import.meta.url);
const load = (path) => import(new URL(path, ROOT));
const { loadTraAlignment, listTraFiles, buildProductionAlignment, traAlignmentFromBytes } = await load("test/axtran2/corpus/loadTraAlignment.mjs");
const { deps, momentsFor } = await load("src/domain/optimization/alignment/SolverDependencies.js");
const { createAlignmentPoseJacobian } = await load("src/domain/optimization/alignment/AlignmentPoseJacobian.js");
const { writeTra, cantLookup } = await load("src/services/axtran2/traWriter.js");
const { decodeBinary } = await load("src/import/parsers/technet/vermEsn/sharedVermesn.js");
const { parseTraGraAuto } = await load("src/import/parsers/technet/vermEsn/parseTRA_GRA.js");
const { buildSparseFromLandFAT } = await load("src/import/build/buildSparseFromLandFAT.js");
const { makeAlignment2DFromSparse } = await load("src/aim-core/alignment/aggregate/AlignmentFactory.js");

const SAMPLES = new URL("../samples/", import.meta.url).pathname;
const STEP = 25;
const AGREE = 1e-4;

/** the app's reading: the import bridge's sparse, realised by the factory */
async function appAxis(bytes, name) {
	const document = await parseTraGraAuto({ name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
	const sparse = buildSparseFromLandFAT(document.alignments[0]);
	const { alignment } = makeAlignment2DFromSparse({ startPose: sparse.startPose, sparse: sparse.sparse ?? sparse.elements, ...deps });
	return alignment;
}

/** the solver's reading, in world coordinates */
async function solverAxis(bytes, name) {
	const loaded = await traAlignmentFromBytes(bytes, name);
	const origin = { x: loaded.startPose.x, y: loaded.startPose.y };
	const alignment = buildProductionAlignment({ elements: loaded.elements, startPose: { x: 0, y: 0, theta: loaded.startPose.theta }, deps });
	return { loaded, alignment, origin };
}

function worstGap(appAlignment, solver) {
	const L = Math.min(appAlignment.arcLength, solver.alignment.arcLength);
	let worst = 0;
	for (let s = 0; s <= L; s += STEP) {
		const a = appAlignment.poseAt(s, { quality: "exact" });
		const b = solver.alignment.poseAt(s, { quality: "exact" });
		worst = Math.max(worst, Math.hypot(a.p.x - (b.p.x + solver.origin.x), a.p.y - (b.p.y + solver.origin.y)));
	}
	return { worst, lengthGap: Math.abs(appAlignment.arcLength - solver.alignment.arcLength) };
}

function endMiss(alignment, endPoint, origin = { x: 0, y: 0 }) {
	const e = alignment.poseAt(alignment.arcLength, { quality: "exact" });
	return Math.hypot(e.p.x + origin.x - endPoint.x, e.p.y + origin.y - endPoint.y);
}

/** every trusted corpus file (the loader's chain reaches its recorded end to a millimetre), with its features */
async function trustedFiles() {
	const out = [];
	for (const file of await listTraFiles(SAMPLES)) {
		let a;
		try { a = await loadTraAlignment(file); } catch { continue; }
		if (a.unsupported.length || a.elements.length < 3) continue;
		const chain = createAlignmentPoseJacobian({ elements: a.elements, startPose: { x: 0, y: 0, theta: a.startPose.theta }, momentsFor });
		if (Math.hypot(chain.endPose.x + a.startPose.x - a.endPoint.x, chain.endPose.y + a.startPose.y - a.endPoint.y) >= 1e-3) continue;
		out.push({ file, loaded: a });
	}
	return out;
}

async function writtenCopy(file, solver, bytes, scratch) {
	const { rowsRaw } = decodeBinary(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "TRA");
	const chain = createAlignmentPoseJacobian({ elements: solver.loaded.elements, startPose: { x: 0, y: 0, theta: solver.loaded.startPose.theta }, momentsFor });
	const toWorld = (p) => ({ x: p.x + solver.origin.x, y: p.y + solver.origin.y, theta: p.theta });
	const written = writeTra({
		elements: solver.loaded.elements,
		poseOfElement: (i) => toWorld(chain.entryPose(i)), poseAtStation: (s) => toWorld(chain.poseAt(s)), endPose: toWorld(chain.endPose),
		jumps: solver.loaded.kilometreJumps, startStation: rowsRaw[1].station, header: bytes.subarray(0, 78),
		cantAt: cantLookup(rowsRaw.slice(1), rowsRaw[1].station, solver.loaded.kilometreJumps),
	});
	const out = join(scratch, "rt-" + basename(file));
	await writeFile(out, written.bytes);
	return readFile(out);
}

test("the contract: on every trusted file without a transition junction the app's import and the solver's reader realise the same axis, from the file and from the file the adapter writes", async () => {
	const files = (await trustedFiles()).filter((entry) => entry.loaded.insertedJunctionArcs === 0);
	assert.ok(files.length >= 100, `${files.length} trusted files without junction arcs (test/samples)`);
	const scratch = await mkdtemp(join(tmpdir(), "axtran2-roundtrip-"));
	let worstOriginal = 0, worstWritten = 0, worstBoth = 0;
	for (const { file } of files) {
		const name = basename(file);
		const bytes = await readFile(file);
		const app = await appAxis(bytes, name);
		const solver = await solverAxis(bytes, name);
		const original = worstGap(app, solver);
		assert.ok(original.worst < AGREE && original.lengthGap < 1e-6, `${name}: the two readers disagree by ${original.worst} m (length ${original.lengthGap} m) on the original`);
		const writtenBytes = await writtenCopy(file, solver, bytes, scratch);
		const appAgain = await appAxis(writtenBytes, name);
		const solverAgain = await solverAxis(writtenBytes, name);
		const throughApp = worstGap(appAgain, solver);
		const both = worstGap(appAgain, solverAgain);
		assert.ok(throughApp.worst < AGREE, `${name}: the written TRA, imported by the app, is ${throughApp.worst} m off the solver's axis`);
		assert.ok(both.worst < AGREE, `${name}: on the written TRA the two readers disagree by ${both.worst} m`);
		worstOriginal = Math.max(worstOriginal, original.worst); worstWritten = Math.max(worstWritten, throughApp.worst); worstBoth = Math.max(worstBoth, both.worst);
	}
	console.log(`  ${files.length} files: readers ${worstOriginal.toExponential(1)} m apart at worst; the written file ${worstWritten.toExponential(1)} m off through the app, ${worstBoth.toExponential(1)} m between readers`);
});

test("the reported divergence: a transition pair meeting at a curvature is lost by the app's import bridge, not by the solver's reader or the adapter's writer", async () => {
	const files = (await trustedFiles()).filter((entry) => entry.loaded.insertedJunctionArcs > 0);
	assert.ok(files.length >= 1, "the corpus has files with transition junctions");
	const scratch = await mkdtemp(join(tmpdir(), "axtran2-roundtrip-junction-"));
	const rows = [];
	for (const { file, loaded } of files) {
		const name = basename(file);
		const bytes = await readFile(file);
		const app = await appAxis(bytes, name);
		const solver = await solverAxis(bytes, name);
		const appMiss = endMiss(app, loaded.endPoint);
		const solverMiss = endMiss(solver.alignment, loaded.endPoint, solver.origin);
		// our side holds: the written copy reads back onto the solver's axis
		const writtenBytes = await writtenCopy(file, solver, bytes, scratch);
		const solverAgain = await solverAxis(writtenBytes, name);
		const ours = worstGap(solver.alignment ? { arcLength: solverAgain.alignment.arcLength, poseAt: (s, o) => { const p = solverAgain.alignment.poseAt(s, o); return { p: { x: p.p.x + solverAgain.origin.x, y: p.p.y + solverAgain.origin.y } }; } } : null, solver);
		rows.push({ name, junctions: loaded.insertedJunctionArcs, appMiss, solverMiss, ours: ours.worst });
	}
	for (const r of rows) console.log(`  ${r.name.padEnd(44)} junctions ${r.junctions}  app misses the recorded end by ${r.appMiss.toFixed(2)} m, the solver's reader by ${r.solverMiss.toExponential(1)} m; written copy through the solver ${r.ours.toExponential(1)} m`);
	for (const r of rows) {
		assert.ok(r.solverMiss < 1e-3, `${r.name}: the solver's reader is trusted here`);
		assert.ok(r.ours < AGREE, `${r.name}: the adapter's written copy reads back ${r.ours} m off`);
		// the defect, pinned: once the bridge carries the junction curvature this
		// assertion fails, and these files join the contract test above
		assert.ok(r.appMiss >= 1e-3, `${r.name}: the app's import now reaches the recorded end (${r.appMiss} m) - move this file into the contract`);
	}
});
