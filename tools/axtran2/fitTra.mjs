#!/usr/bin/env node
// tools/axtran2/fitTra.mjs
//
// The AXTRAN adapter on the command line: a Verm.esn TRA file, a list of
// survey points and a list of Zwangspunkte go in; the fitted TRA and a
// residual report come out. The calculation is src/services/axtran2/
// fitTraCore.js, which the browser app in axtran2/ shares; this file only
// reads and writes files.
//
//   node tools/axtran2/fitTra.mjs --tra in.TRA --points aufmass.csv \
//        [--zwang zwangspunkte.csv] [--out fitted.TRA] [--report report.json] \
//        [--csv residuen.csv] [--tolerance 0.15] [--zwang-tolerance 0.01] \
//        [--speed 120] [--iterations 1000] [--axes en|ne] [--hold-last] [--hold 1,2,13|turnouts] [--hold-radii] [--edit "7L=45.2 7R=-1250"] [--end-pose E,N,T] [--order points|reference|strict|budget=<m>]

import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

import "./nodeAliases.mjs";
import { fitTraFromBytes, FitTraError, FIT_TRA_VERSION } from "../../src/services/axtran2/fitTraCore.js";
import { formatHold } from "../../src/services/axtran2/heldRecords.js";

export { FitTraError, FIT_TRA_VERSION };

/** the adapter on a file path: reads the TRA and hands its bytes to fitTraFromBytes */
export async function fitTra({ tra, ...rest } = {}) {
	if (typeof tra !== "string") throw new FitTraError("NO_TRA", "fitTra needs the path of a TRA file");
	const bytes = await readFile(tra);
	return fitTraFromBytes({ bytes, name: basename(tra), ...rest });
}

// ---------------------------------------------------------------- command line

function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith("--")) continue;
		const key = a.slice(2);
		const next = argv[i + 1];
		if (next === undefined || next.startsWith("--")) args[key] = true;
		else { args[key] = next; i++; }
	}
	return args;
}

/** "E,N,T" or "E;N;T": easting, northing, direction clockwise from north in gon */
function endPoseFromArgument(text) {
	const parts = String(text).split(/[,;]\s*|\s+/).map((v) => Number(String(v).replace(",", ".")));
	if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v))) throw new FitTraError("INVALID_END_POSE", `--end-pose wants E,N,T; got "${text}"`);
	return { x: parts[0], y: parts[1], theta: Math.PI / 2 - parts[2] * (Math.PI / 200) };
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (!args.tra || !args.points) {
		console.error("usage: node tools/axtran2/fitTra.mjs --tra in.TRA --points aufmass.csv [--zwang z.csv] [--out fitted.TRA] [--report r.json] [--csv residuen.csv] [--tolerance 0.15] [--zwang-tolerance 0.01] [--speed 120] [--iterations 1000] [--axes en|ne] [--hold-last] [--hold 1,2,13|turnouts] [--hold-radii] [--edit \"7L=45.2 7R=-1250\"] [--end-pose E,N,T] [--order points|reference|strict|budget=<m>] (T the direction clockwise from north in gon, as a TRA states it)");
		process.exit(2);
	}
	const result = await fitTra({
		tra: args.tra,
		points: await readFile(args.points, "utf8"),
		zwang: args.zwang ? await readFile(args.zwang, "utf8") : [],
		tolerance: args.tolerance !== undefined ? Number(args.tolerance) : 0.15,
		zwangTolerance: args["zwang-tolerance"] !== undefined ? Number(args["zwang-tolerance"]) : 0.01,
		speedKmh: args.speed !== undefined ? Number(args.speed) : null,
		maxIterations: args.iterations !== undefined ? Number(args.iterations) : 1000,
		axes: args.axes ?? "en",
		holdLast: args["hold-last"] === true,
		hold: typeof args.hold === "string" ? args.hold : [],
		holdRadii: args["hold-radii"] === true,
		edits: typeof args.edit === "string" ? args.edit : [],
		endPose: args["end-pose"] ? endPoseFromArgument(args["end-pose"]) : null,
		order: args.order ?? "points",
	});
	const out = args.out ?? args.tra.replace(/\.tra$/i, "") + "_axtran2.TRA";
	await writeFile(out, result.tra);
	if (args.report) await writeFile(args.report, JSON.stringify(result.report, null, 2));
	if (args.csv) await writeFile(args.csv, result.csv);
	const { verdict, fit, input } = result.report;
	console.log(`${input.tra}: ${input.elements} elements, ${input.free} free, ${input.points} points${input.excludedPoints.length ? ` (${input.excludedPoints.length} excluded, see the report)` : ""}, ${input.zwangspunkte} Zwangspunkte, V ${input.speedKmh} km/h`);
	const span = (records) => (records.length > 1 ? `records ${records[0]}-${records[records.length - 1]}` : `record ${records[0]}`);
	if (input.turnouts.length) console.log(`turnouts seen: ${input.turnouts.map((t) => `${span(t.records)} ${t.designation} ${t.side} (${t.held ? "held" : "not held"})`).join(", ")}${input.turnouts.some((t) => !t.held) ? "; --hold turnouts holds them" : ""}`);
	if (input.edits?.length) console.log(`started from edited values: ${input.edits.map((e) => `record ${e.record}${e.length !== null ? ` length ${e.length}` : ""}${e.radius !== null ? ` radius ${e.radius}` : ""}${e.family ? ` type ${e.family}` : ""}`).join(", ")}`);
	if (input.heldRecords.length || input.holdRadii) console.log(`held: ${input.heldRecords.length ? `records ${formatHold(input.heldRecords)} (L the length only, R the radius only)` : "no record"}${input.holdRadii ? "; every radius" : ""}`);
	console.log(`verdict ${verdict.status}${verdict.reason ? "/" + verdict.reason : ""} after ${verdict.iterations} iterations in ${verdict.seconds.toFixed(1)} s`);
	console.log(`rms ${fit.rms?.toFixed(3)} (tolerance units), ${fit.outsideTolerance} outside, end pose ${fit.endPoseDistance?.toExponential(1)} m, length ${fit.lengthChange >= 0 ? "+" : ""}${fit.lengthChange?.toFixed(3)} m`);
	if (result.report.order) {
		const o = result.report.order;
		console.log(`order ${o.order}: ${o.phases.map((p) => `${p.label} ${p.status}@${p.iterations ?? "-"}`).join(", ")}${o.lengthCost === null ? "" : Math.abs(o.lengthCost) < 5e-4 ? "; the points cost no length over the shortest admissible alignment" : `; the points cost ${o.lengthCost > 0 ? "+" : ""}${o.lengthCost.toFixed(3)} m over the shortest admissible alignment`}${o.noBudget.length ? "; the length tier handed no budget down" : ""}`);
	}
	const c = result.report.cant;
	console.log(`speed ${input.speed.kmh} km/h ${input.speed.why}${c.admissibleSpeedKmh === null ? "" : `; the arcs admit ${Math.floor(c.admissibleSpeedKmh)} km/h (${c.limitingArc.id}, R ${Math.abs(c.limitingArc.radius).toFixed(0)} m, cant ${c.limitingArc.cantMm.toFixed(0)} mm)`}${input.speed.basis === "given" ? "" : "; --speed changes it"}`);
	console.log(`cant ${c.present ? "carried from the file" : "none in the file"}, judged at V ${c.speedKmh} km/h against zul uf ${c.maximumDeficiencyMm} mm: ${c.exceededAfter} of ${c.arcs.length} arcs over the deficiency limit after the fit (${c.exceededBefore} before)${c.excessiveCant ? `, ${c.excessiveCant} over the cant limit of ${c.maximumCantMm} mm` : ""}`);
	for (const h of fit.hardPoints ?? []) console.log(`Zwangspunkt ${h.name}: residual ${h.residual?.toExponential(1)}`);
	for (const b of fit.boundPoints ?? []) console.log(`Zwangspunkt ${b.name} (${b.enforcement} ${Math.abs(b.target).toFixed(3)} m ${b.target < 0 ? "right" : "left"}): ${b.violation === null ? "not evaluated" : b.violation > 1e-6 ? `broken by ${b.violation.toFixed(4)} m` : `held, ${(-b.violation).toFixed(3)} m to spare`}`);
	for (const p of result.report.points.filter((p) => p.stationGiven !== null && p.station !== null && Math.abs(p.station - p.stationGiven) > 200)) console.log(`point ${p.name}: station ${p.stationGiven.toFixed(1)} named, foot at ${p.station.toFixed(1)}: the hint did not take, the nearest foot was used`);
	console.log(`written ${out} (${result.report.output.records} records${result.report.output.stationEquations ? `, ${result.report.output.stationEquations} station equations` : ""})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	main().catch((e) => { console.error(`${e.code ?? e.name}: ${e.message}`); process.exit(1); });
}
