// test/axtran2/corpus/runCorpus.mjs
//
// Every trusted alignment of the corpus through the solver, one line per run.
//
//   node test/axtran2/corpus/runCorpus.mjs [--from 0] [--to 206] \
//        [--objectives points,accumulated-length,lexicographic] [--ramp bound|constraint] \
//        [--iterations 1000] [--hessian bfgs|gauss-newton] [--restoration on-verdict|eager|off] [--lengthPrior sigma] [--correctionClosure 0.1] [--kinkStation held|free] [--qpWarmStart false] [--json out.json]
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
const { solveAlignmentLexicographic } = await import(new URL("src/domain/optimization/alignment/AlignmentLexicographicSolver.js", ROOT));
const { createAlignmentPoseJacobian } = await import(new URL("src/domain/optimization/alignment/AlignmentPoseJacobian.js", ROOT));

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1]] : [])).filter((e) => e.length));
const from = Number(args.from ?? 0);
const to = Number(args.to ?? Infinity);
const objectives = (args.objectives ?? "accumulated-length,points").split(",");
const rampLengthAs = args.ramp ?? "bound";
const maxIterations = Number(args.iterations ?? 1000);
const hessian = args.hessian ?? "bfgs";
const restoration = args.restoration ?? "on-verdict";
const structuredStart = args.structuredStart === undefined ? undefined : Number(args.structuredStart);
const hybridSwitch = args.hybridSwitch === undefined ? undefined : Number(args.hybridSwitch);
const lengthPrior = args.lengthPrior === undefined ? undefined : { sigma: Number(args.lengthPrior) };
const acceptance = args.acceptance;
// lexicographic tiers: "reference" (default: the length tier reports, does not
// constrain), "strict" (absolute epsilon 0), or "absolute=<m>" for a budget
const tiersArg = String(args.tiers ?? "reference");
const tiers = tiersArg === "reference"
	? undefined
	: [{ objective: "accumulated-length", absolute: tiersArg === "strict" ? 0 : Number(tiersArg.split("=")[1]) }, { objective: "points" }];
const filterCeiling = args.filterCeiling === undefined ? undefined : Number(args.filterCeiling);
const filterSwitching = args.filterSwitching === undefined ? undefined : args.filterSwitching !== "false";
const correctionClosure = args.correctionClosure === undefined ? undefined : Number(args.correctionClosure);
const kinkStation = args.kinkStation ?? "held";
const qpWarmStart = args.qpWarmStart === undefined ? undefined : args.qpWarmStart !== "false";
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
console.log(`corpus: ${trusted.length} trusted alignments, ${excluded.length} excluded; running ${from}..${Math.min(to, trusted.length) - 1}, ${objectives.join("+")}${objectives.includes("lexicographic") ? ` (tiers ${tiersArg})` : ""}, ramp as ${rampLengthAs}, hessian ${hessian}, restoration ${restoration}`);
console.log("file                                       n free pts  V exc | objective           □ [status         ] @it   rms   endpose  admiss  truth%    dL m    s");
const rows = [];
for (const { file, n } of trusted.slice(from, to)) {
	let sc;
	try { sc = await createTraScenario(file, { rampLengthAs, kinkStation }); }
	catch (error) { console.log(`${rel(file).slice(-42).padEnd(42)} scenario: ${error.message.slice(0, 90)}`); rows.push({ file: rel(file), n, error: error.message }); continue; }
	for (const objective of objectives) {
		const t0 = Date.now();
		let run;
		const solver = { hessian, restoration, structuredStart, hybridSwitch, lengthPrior, acceptance, filterSwitching, filterCeiling, correctionClosure, qpWarmStart };
		if (objective === "lexicographic") {
			// the declared order: the length tier as a reference, then the points
			let lex;
			try { lex = solveAlignmentLexicographic({ problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, maxIterations, solver, ...(tiers ? { tiers } : {}) }); }
			catch (error) { console.log(`${rel(file).slice(-42).padEnd(42)} lexicographic: solver threw ${error.code ?? ""} ${error.message.slice(0, 60)}`); rows.push({ file: rel(file), n, objective, error: error.message }); continue; }
			const final = lex.phases.at(-1);
			const d = final?.diagnostics ?? {};
			const variables = final?.candidate?.variables ?? [];
			const truthDistance = variables.length ? distanceToTruth(sc, variables) : null;
			const sumTruth = sc.truth.elements.reduce((s, e) => s + e.length, 0);
			const sumL = variables.length ? sc.materialise(sc.codec.decode(variables)).reduce((s, e) => s + e.length, 0) : null;
			const seconds = (Date.now() - t0) / 1000;
			const phases = lex.phases.map((p) => `${p.label}:${p.status}@${p.diagnostics?.iterations ?? "-"}`).join(" ");
			const budget = lex.budgets?.[0] ?? null;
			const row = {
				file: rel(file), n, free: sc.freeCount, points: sc.pointCount, speedKmh: sc.profile.speedKmh, exceptions: sc.profile.exceptionCount,
				objective, status: lex.status, ok: lex.ok, admissible: final?.admissible ?? null,
				phases: lex.phases.map((p) => ({ label: p.label, status: p.status, ok: p.ok, iterations: p.diagnostics?.iterations ?? null })),
				iterations: lex.phases.reduce((s, p) => s + (p.diagnostics?.iterations ?? 0), 0),
				qpIterations: lex.phases.reduce((s, p) => s + (p.diagnostics?.history ?? []).reduce((q, e) => q + (e.qpIterations ?? 0), 0), 0),
				rms: d.softResidualRms ?? null, endPoseDistance: d.endPoseDistance ?? null, truthDistance, lengthChange: sumL === null ? null : sumL - sumTruth,
				lengthAttained: budget?.attained ?? null, lengthSpent: budget?.spent ?? null, seconds,
			};
			rows.push(row);
			console.log(`${rel(file).slice(-42).padEnd(42)} ${String(n).padStart(2)} ${String(sc.freeCount).padStart(4)} ${String(sc.pointCount).padStart(3)} | lexicographic [${lex.status.padEnd(14)}] ${phases} rms ${(row.rms ?? NaN).toFixed(3)} dL ${row.lengthChange === null ? "-" : row.lengthChange.toFixed(2)} (ref ${budget?.span === null || budget?.span === undefined ? "-" : budget.span.toFixed(2)}) ${seconds.toFixed(0)}s`);
			continue;
		}
		try { run = solveAlignmentProblem({ problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, objective, maxIterations, ...solver }); }
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
			iterations: d.iterations, qpIterations: (d.history ?? []).reduce((q, e) => q + (e.qpIterations ?? 0), 0),
			rms: d.softResidualRms, endPoseDistance: d.endPoseDistance, truthDistance, lengthChange: sumL === null ? null : sumL - sumTruth, seconds,
		};
		rows.push(row);
		console.log(`${rel(file).slice(-42).padEnd(42)} ${String(n).padStart(2)} ${String(sc.freeCount).padStart(4)} ${String(sc.pointCount).padStart(3)} ${String(sc.profile.speedKmh).padStart(3)} ${String(sc.profile.exceptionCount).padStart(3)} | ${objective.padEnd(19)} ${row.square ? "□" : " "} [${run.status.padEnd(14)}] @${String(d.iterations).padStart(3)} ${(d.softResidualRms ?? NaN).toFixed(3).padStart(6)} ${(d.endPoseDistance ?? NaN).toExponential(1).padStart(8)} ${String(run.admissible).padEnd(6)} ${truthDistance === null ? "     -" : (truthDistance * 100).toFixed(1).padStart(6)}% ${sumL === null ? "      -" : (sumL - sumTruth).toFixed(2).padStart(7)} ${seconds.toFixed(0).padStart(4)}`);
	}
}
if (args.json) writeFileSync(args.json, JSON.stringify({ trusted: trusted.map((t) => ({ file: rel(t.file), n: t.n })), excluded: excluded.map((e) => ({ file: rel(e.file), why: e.why })), rows }, null, 1));
console.log(`excluded ${excluded.length}: ${Object.entries(excluded.reduce((m, e) => (m[e.why.replace(/[0-9.e+-]+ m$/, "N m")] = (m[e.why.replace(/[0-9.e+-]+ m$/, "N m")] ?? 0) + 1, m), {})).map(([k, v]) => `${v}× ${k}`).join("; ")}`);
