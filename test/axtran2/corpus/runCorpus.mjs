// test/axtran2/corpus/runCorpus.mjs
//
// Every trusted alignment of the corpus through the solver, one line per run.
//
//   node test/axtran2/corpus/runCorpus.mjs [--from 0] [--to 206] \
//        [--objectives points,accumulated-length] [--ramp bound|constraint] \
//        [--iterations 200] [--json out.json]
//
// "Trusted" means the loader's chain reaches the file's own recorded end
// point to a millimetre; the files that do not are inconsistent as-built
// records and are listed, not solved. The table is the deliverable; the JSON
// is for comparing two solvers.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadTraAlignment, listTraFiles } from "./loadTraAlignment.mjs";
import { createTraScenario, distanceToTruth, momentsFor } from "./createTraScenario.mjs";

const ROOT = new URL("../../../", import.meta.url);
const { solveAlignmentProblem } = await import(new URL("src/domain/optimization/alignment/AlignmentSQPSolver.js", ROOT));
const { createAlignmentPoseJacobian } = await import(new URL("src/domain/optimization/alignment/AlignmentPoseJacobian.js", ROOT));

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1]] : [])).filter((e) => e.length));
const from = Number(args.from ?? 0);
const to = Number(args.to ?? Infinity);
const objectives = (args.objectives ?? "accumulated-length,points").split(",");
const rampLengthAs = args.ramp ?? "bound";
const maxIterations = Number(args.iterations ?? 200);
const samples = args.samples ?? new URL("../../samples/", import.meta.url).pathname;

const trusted = [];
const excluded = [];
for (const file of await listTraFiles(samples)) {
	try {
		const a = await loadTraAlignment(file);
		if (a.unsupported.length) { excluded.push({ file, why: a.unsupported.map((u) => u.spiType ?? u.type).join("|") }); continue; }
		if (a.elements.length < 3) { excluded.push({ file, why: "fewer than three elements" }); continue; }
		const chain = createAlignmentPoseJacobian({ elements: a.elements, startPose: a.startPose, momentsFor });
		const miss = Math.hypot(chain.endPose.x - a.endPoint.x, chain.endPose.y - a.endPoint.y);
		if (miss >= 1e-3) { excluded.push({ file, why: `chain misses the recorded end by ${miss.toExponential(1)} m` }); continue; }
		trusted.push({ file, n: a.elements.length });
	} catch (error) { excluded.push({ file, why: error.message.slice(0, 80) }); }
}
trusted.sort((a, b) => a.n - b.n || a.file.localeCompare(b.file));

const rel = (file) => file.split("/samples/")[1] ?? file;
console.log(`corpus: ${trusted.length} trusted alignments, ${excluded.length} excluded; running ${from}..${Math.min(to, trusted.length) - 1}, ${objectives.join("+")}, ramp as ${rampLengthAs}`);
console.log("file                                       n free pts  V exc | objective           □ [status         ] @it   rms   endpose  admiss  truth%    dL m    s");
const rows = [];
for (const { file, n } of trusted.slice(from, to)) {
	let sc;
	try { sc = await createTraScenario(file, { rampLengthAs }); }
	catch (error) { console.log(`${rel(file).slice(-42).padEnd(42)} scenario: ${error.message.slice(0, 90)}`); rows.push({ file: rel(file), n, error: error.message }); continue; }
	for (const objective of objectives) {
		const t0 = Date.now();
		let run;
		try { run = solveAlignmentProblem({ problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, objective, maxIterations }); }
		catch (error) { console.log(`${rel(file).slice(-42).padEnd(42)} ${objective}: solver threw ${error.code ?? ""} ${error.message.slice(0, 60)}`); rows.push({ file: rel(file), n, objective, error: error.message }); continue; }
		const d = run.diagnostics;
		const variables = run.candidate?.variables ?? [];
		const truthDistance = variables.length ? distanceToTruth(sc, variables) : null;
		const sumTruth = sc.truth.elements.reduce((s, e) => s + e.length, 0);
		const sumL = variables.length ? sc.materialise(sc.codec.decode(variables)).reduce((s, e) => s + e.length, 0) : null;
		const seconds = (Date.now() - t0) / 1000;
		const row = {
			file: rel(file), n, free: sc.freeCount, points: sc.pointCount, speedKmh: sc.profile.speedKmh, exceptions: sc.profile.exceptionCount,
			objective, square: sc.freeCount === sc.equalityCount, status: run.status, ok: run.ok, admissible: run.admissible,
			iterations: d.iterations, rms: d.softResidualRms, endPoseDistance: d.endPoseDistance, truthDistance, lengthChange: sumL === null ? null : sumL - sumTruth, seconds,
		};
		rows.push(row);
		console.log(`${rel(file).slice(-42).padEnd(42)} ${String(n).padStart(2)} ${String(sc.freeCount).padStart(4)} ${String(sc.pointCount).padStart(3)} ${String(sc.profile.speedKmh).padStart(3)} ${String(sc.profile.exceptionCount).padStart(3)} | ${objective.padEnd(19)} ${row.square ? "□" : " "} [${run.status.padEnd(14)}] @${String(d.iterations).padStart(3)} ${(d.softResidualRms ?? NaN).toFixed(3).padStart(6)} ${(d.endPoseDistance ?? NaN).toExponential(1).padStart(8)} ${String(run.admissible).padEnd(6)} ${truthDistance === null ? "     -" : (truthDistance * 100).toFixed(1).padStart(6)}% ${sumL === null ? "      -" : (sumL - sumTruth).toFixed(2).padStart(7)} ${seconds.toFixed(0).padStart(4)}`);
	}
}
if (args.json) writeFileSync(args.json, JSON.stringify({ trusted: trusted.map((t) => ({ file: rel(t.file), n: t.n })), excluded: excluded.map((e) => ({ file: rel(e.file), why: e.why })), rows }, null, 1));
console.log(`excluded ${excluded.length}: ${Object.entries(excluded.reduce((m, e) => (m[e.why.replace(/[0-9.e+-]+ m$/, "N m")] = (m[e.why.replace(/[0-9.e+-]+ m$/, "N m")] ?? 0) + 1, m), {})).map(([k, v]) => `${v}× ${k}`).join("; ")}`);
