import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The AXTRAN adapter: TRA, survey points and Zwangspunkte in, TRA and
// residuals out. Three things are pinned: the lists are read as the field
// writes them, a TRA survives the round trip through the writer, and a
// perturbed file is fitted back onto points taken from the original.

const TOOLS = new URL("../../tools/axtran2/", import.meta.url);
const { parsePointList, PointListError } = await import(new URL("pointLists.mjs", TOOLS));
const { writeTra, cantLookup, directionOfHeading } = await import(new URL("traWriter.mjs", TOOLS));
const { fitTra } = await import(new URL("fitTra.mjs", TOOLS));
const { loadTraAlignment, buildProductionAlignment, listTraFiles } = await import(new URL("corpus/loadTraAlignment.mjs", import.meta.url));
const { deps, momentsFor } = await import(new URL("corpus/createTraScenario.mjs", import.meta.url));
const { decodeBinary } = await import(new URL("../../src/import/parsers/technet/vermEsn/sharedVermesn.js", import.meta.url));
const { createAlignmentPoseJacobian } = await import(new URL("../../src/domain/optimization/alignment/AlignmentPoseJacobian.js", import.meta.url));

const SAMPLES = new URL("../samples/", import.meta.url).pathname;
const scratch = await mkdtemp(join(tmpdir(), "axtran2-adapter-"));

test("point lists are read as the field writes them", () => {
	const plain = parsePointList("P1 2544235.10 5533075.32\nP2 2544195,46 5532968,25 0.05\n", { tolerance: 0.15 });
	assert.equal(plain.length, 2);
	assert.deepEqual([plain[0].x, plain[0].y, plain[0].tolerance], [2544235.10, 5533075.32, 0.15]);
	assert.deepEqual([plain[1].x, plain[1].y, plain[1].tolerance], [2544195.46, 5532968.25, 0.05], "a decimal comma and a per-point tolerance");
	const noNames = parsePointList("1;2\n3;4\n");
	assert.deepEqual(noNames.map((p) => p.name), ["P1", "P2"]);
	// a Verm.esn listing: Y is the Rechtswert, X the Hochwert
	const vermesn = parsePointList("Nr;Y;X\n101;2544235.10;5533075.32\n");
	assert.deepEqual([vermesn[0].name, vermesn[0].x, vermesn[0].y], ["101", 2544235.10, 5533075.32]);
	const named = parsePointList("name\teasting\tnorthing\ttolerance\nA\t10\t20\t0.1\n");
	assert.deepEqual([named[0].x, named[0].y, named[0].tolerance], [10, 20, 0.1]);
	const swapped = parsePointList("5533075.32 2544235.10", { axes: "ne" });
	assert.deepEqual([swapped[0].x, swapped[0].y], [2544235.10, 5533075.32]);
	const zwang = parsePointList("Z1;2544200;5533000;-2.5\nZ2;2544300;5533100;0;0.005", { kind: "zwang", tolerance: 0.01 });
	assert.deepEqual([zwang[0].distance, zwang[0].tolerance, zwang[1].distance, zwang[1].tolerance], [-2.5, 0.01, 0, 0.005]);
	assert.throws(() => parsePointList("Z1;1;2", { kind: "zwang" }), (e) => e instanceof PointListError && e.code === "TOO_FEW_COLUMNS");
	assert.throws(() => parsePointList("A 1 2\nA 3 4"), /occurs twice/);
	assert.throws(() => parsePointList("name;foo;bar\nA;1;2"), /no easting/);
});

test("a direction is written clockwise from north in [0, 2pi)", () => {
	assert.ok(Math.abs(directionOfHeading(Math.PI / 2)) < 1e-15, "heading north is direction 0");
	assert.ok(Math.abs(directionOfHeading(0) - Math.PI / 2) < 1e-15, "heading east is a quarter turn");
	assert.ok(Math.abs(directionOfHeading(Math.PI) - 1.5 * Math.PI) < 1e-15, "heading west");
	assert.ok(Math.abs(directionOfHeading(-Math.PI / 2) - Math.PI) < 1e-15, "heading south");
});

// files small enough to be quick, plus the first with kinks and the first
// with two transitions meeting at a curvature, which exercise the folds
async function roundTripFiles() {
	const files = await listTraFiles(SAMPLES);
	const picked = [];
	let withKink = null;
	let withJunction = null;
	for (const file of files) {
		let a;
		try { a = await loadTraAlignment(file); } catch { continue; }
		if (a.unsupported.length) continue;
		// the corpus gate: a file whose chain misses its own recorded end is not trusted
		const chain = createAlignmentPoseJacobian({ elements: a.elements, startPose: { x: 0, y: 0, theta: a.startPose.theta }, momentsFor });
		if (Math.hypot(chain.endPose.x + a.startPose.x - a.endPoint.x, chain.endPose.y + a.startPose.y - a.endPoint.y) >= 1e-3) continue;
		if (picked.length < 6 && a.elements.length <= 40) picked.push(file);
		if (!withKink && a.kinks > 0) withKink = file;
		if (!withJunction && a.insertedJunctionArcs > 0) withJunction = file;
		if (picked.length >= 6 && withKink && withJunction) break;
	}
	return [...new Set([...picked, withKink, withJunction].filter(Boolean))];
}

/** the curvature the chain gives a transition at one end: its neighbour's, where that is an arc or a straight */
function realisedBeside(elements, index, step) {
	for (let j = index + step; j >= 0 && j < elements.length; j += step) {
		const e = elements[j];
		if (e.type === "arc") return e.curvature;
		if (e.type === "straight") return 0;
		if (e.type === "kink") continue;
		return null;
	}
	return 0;
}

test("a TRA survives the round trip through the writer", async () => {
	const files = await roundTripFiles();
	assert.ok(files.length >= 3, "the corpus is there (test/samples)");
	for (const file of files) {
		const bytes = await readFile(file);
		const original = await loadTraAlignment(file);
		const { rowsRaw } = decodeBinary(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "TRA");
		const startStation = rowsRaw[1].station;
		const startPose = { x: 0, y: 0, theta: original.startPose.theta };
		const chain = createAlignmentPoseJacobian({ elements: original.elements, startPose, momentsFor });
		const written = writeTra({
			elements: original.elements,
			poseOfElement: (i) => { const p = chain.entryPose(i); return { x: p.x + original.startPose.x, y: p.y + original.startPose.y, theta: p.theta }; },
			endPose: { x: chain.endPose.x + original.startPose.x, y: chain.endPose.y + original.startPose.y, theta: chain.endPose.theta },
			startStation,
			header: bytes.subarray(0, 78),
			cantAt: cantLookup(rowsRaw.slice(1), startStation),
		});
		const out = join(scratch, "rt-" + file.split("/").pop());
		await writeFile(out, written.bytes);
		const back = await loadTraAlignment(out);
		const name = file.split("/samples/")[1];
		assert.equal(back.unsupported.length, 0, `${name}: the written file reads back`);
		assert.equal(back.elements.length, original.elements.length, `${name}: ${original.elements.length} elements in, ${back.elements.length} out`);
		for (let i = 0; i < original.elements.length; i++) {
			const a = original.elements[i];
			const b = back.elements[i];
			assert.equal(b.type, a.type, `${name} ${a.id}: type`);
			assert.ok(Math.abs(b.length - a.length) < 1e-6, `${name} ${a.id}: length ${a.length} -> ${b.length}`);
			if (a.type === "arc") assert.ok(Math.abs(b.curvature - a.curvature) < 1e-12, `${name} ${a.id}: curvature ${a.curvature} -> ${b.curvature}`);
			if (a.type === "transition") {
				assert.equal(b.family, a.family, `${name} ${a.id}: family`);
				// the radii a transition joins are its neighbours' as the chain
				// realises them; a file whose record disagrees with its own
				// neighbour (6100_247-289 E212: R1 2468 m beside an arc of 275 m)
				// comes back repaired, not copied
				const entry = realisedBeside(original.elements, i, -1) ?? a.entryCurvature;
				const exit = realisedBeside(original.elements, i, +1) ?? a.exitCurvature;
				assert.ok(Math.abs(b.entryCurvature - entry) < 1e-12 && Math.abs(b.exitCurvature - exit) < 1e-12, `${name} ${a.id}: the radii it joins`);
			}
			if (a.type === "kink") assert.ok(Math.abs(b.deltaDir - a.deltaDir) < 1e-6, `${name} ${a.id}: kink ${a.deltaDir} -> ${b.deltaDir}`);
		}
		assert.ok(Math.hypot(back.startPose.x - original.startPose.x, back.startPose.y - original.startPose.y) < 1e-6, `${name}: start`);
		assert.ok(Math.abs(back.startPose.theta - original.startPose.theta) < 1e-12, `${name}: start heading`);
		// the end record is the chain's end, exactly; against the file's own
		// recorded end it is as far off as the chain's closure, within the
		// corpus gate of a millimetre
		const writtenEnd = { x: chain.endPose.x + original.startPose.x, y: chain.endPose.y + original.startPose.y };
		assert.ok(Math.hypot(back.endPoint.x - writtenEnd.x, back.endPoint.y - writtenEnd.y) < 1e-6, `${name}: end record`);
		assert.ok(Math.hypot(back.endPoint.x - original.endPoint.x, back.endPoint.y - original.endPoint.y) < 1e-3, `${name}: end point ${Math.hypot(back.endPoint.x - original.endPoint.x, back.endPoint.y - original.endPoint.y)} m off the recorded one`);
		// cants travel with their records
		const backRows = decodeBinary((await readFile(out)).buffer, "TRA").rowsRaw;
		assert.equal(backRows[0].kindCode, backRows.length - 2, `${name}: the header counts the element records`);
		if (original.mergedRecords === 0 && original.insertedJunctionArcs === 0 && original.stationEquations === 0) {
			for (let i = 1; i < rowsRaw.length; i++) assert.equal(backRows[i].cantA, rowsRaw[i].cantA, `${name} record ${i}: cant`);
		}
	}
});

test("a perturbed TRA is fitted back onto points taken from the original, with a Zwangspunkt held", async () => {
	// the smallest file with a transition and enough elements to bend
	const files = await listTraFiles(SAMPLES);
	let file = null;
	for (const f of files) {
		let a;
		try { a = await loadTraAlignment(f); } catch { continue; }
		if (a.unsupported.length === 0 && a.kinks === 0 && a.elements.length >= 7 && a.elements.length <= 12 && a.elements.some((e) => e.type === "transition")) { file = f; break; }
	}
	assert.ok(file, "a small corpus file with a transition");
	const original = await loadTraAlignment(file);
	const bytes = await readFile(file);
	const { rowsRaw } = decodeBinary(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "TRA");
	const startPose = { x: 0, y: 0, theta: original.startPose.theta };
	const truth = buildProductionAlignment({ elements: original.elements, startPose, deps });
	const world = (p) => ({ x: p.x + original.startPose.x, y: p.y + original.startPose.y });

	// survey points every 20 m along the original, 3 cm of noise, in world coordinates
	let seed = 7;
	const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed / 0x100000000) * 2 - 1; };
	const lines = ["Nr;Y;X"];
	for (let s = 20; s < truth.arcLength - 20; s += 20) {
		const p = truth.poseAt(s);
		const off = 0.03 * noise();
		const w = world({ x: p.p.x - off * p.t.y, y: p.p.y + off * p.t.x });
		lines.push(`M${lines.length};${w.x.toFixed(4)};${w.y.toFixed(4)}`);
	}
	const pointsText = lines.join("\n");
	// a Zwangspunkt 3 m left of the axis at a third of the length
	const zs = truth.arcLength / 3;
	const zp = truth.poseAt(zs);
	const zw = world({ x: zp.p.x - 3 * zp.t.y, y: zp.p.y + 3 * zp.t.x });
	const zwangText = `name;easting;northing;abstand\nZ1;${zw.x.toFixed(4)};${zw.y.toFixed(4)};3.0\n`;

	// the perturbed start: free lengths +-2 %, curvatures +-3 %, summed length kept
	const perturbed = original.elements.map((e, i) => {
		if (i === 0 || e.held) return e;
		const sign = i % 2 ? 1 : -1;
		return { ...e, length: e.length * (1 + sign * 0.02), ...(e.type === "arc" ? { curvature: e.curvature * (1 - sign * 0.03) } : {}) };
	});
	const chain = createAlignmentPoseJacobian({ elements: perturbed, startPose, momentsFor });
	const written = writeTra({
		elements: perturbed,
		poseOfElement: (i) => { const p = chain.entryPose(i); return { ...world(p), theta: p.theta }; },
		endPose: { ...world(chain.endPose), theta: chain.endPose.theta },
		startStation: rowsRaw[1].station, header: bytes.subarray(0, 78), cantAt: cantLookup(rowsRaw.slice(1), rowsRaw[1].station),
	});
	const perturbedFile = join(scratch, "perturbed.TRA");
	await writeFile(perturbedFile, written.bytes);

	const result = await fitTra({ tra: perturbedFile, points: pointsText, zwang: zwangText, tolerance: 0.15, maxIterations: 300 });
	const { report } = result;
	assert.ok(report.verdict.ok, `${report.verdict.status} ${report.verdict.reason ?? ""}`);
	assert.equal(report.input.zwangspunkte, 1);
	assert.ok(report.fit.rms < 1, `rms ${report.fit.rms} tolerance units`);
	assert.ok(Math.abs(report.fit.hardPoints[0].residual) < 1e-6, `Zwangspunkt residual ${report.fit.hardPoints[0].residual}`);
	const z = report.points.find((p) => p.name === "Z1");
	assert.ok(Math.abs(z.offset - 3) < 1e-4, `the axis passes Z1 at ${z.offset} m, asked 3 m`);
	const measured = report.points.filter((p) => p.kind === "measured");
	assert.ok(measured.every((p) => p.within), `${measured.filter((p) => !p.within).length} points outside tolerance`);
	const worseBefore = measured.filter((p) => p.offsetBefore !== null && Math.abs(p.offsetBefore) > Math.abs(p.offset)).length;
	assert.ok(worseBefore > measured.length / 2, `the fit moved the axis towards the points on ${worseBefore} of ${measured.length}`);
	// the end pose is the file's, which the perturbation did not touch
	assert.ok(report.fit.endPoseDistance < 1e-6);
	// and the output TRA reads back as the fitted alignment
	const outFile = join(scratch, "fitted.TRA");
	await writeFile(outFile, result.tra);
	const back = await loadTraAlignment(outFile);
	assert.equal(back.elements.length, original.elements.length);
	for (let i = 0; i < back.elements.length; i++) {
		assert.ok(Math.abs(back.elements[i].length - result.fitted[i].length) < 1e-6, `${back.elements[i].id} length`);
	}
	assert.ok(result.csv.startsWith("name;easting;northing;station;offset"), "the residual list");
});
