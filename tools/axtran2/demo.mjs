#!/usr/bin/env node
// tools/axtran2/demo.mjs
//
// The Vorführung: a real alignment through the adapter, end to end.
//
//   node tools/axtran2/demo.mjs --tra <strecke.TRA> [--out <folder>] [--spacing 25] \
//        [--noise 0.04] [--shift 0.02] [--bend 0.03] [--zwang 2.0] [--seed 7]
//
// What it does, in the order a colleague would:
//   1. reads the TRA as the surveyed track - the geometry the field has;
//   2. writes an Aufmaß from it: a point every `spacing` metres with `noise`
//      metres of lateral scatter (there is no real survey list for the
//      corpus files, and the demo says so in its summary);
//   3. sets one Zwangspunkt `zwang` metres left of the axis at a third of
//      the length, the way a platform edge or a mast would be given;
//   4. writes a start plan that is deliberately off: every free length by
//      ±`shift`, every arc curvature by ±`bend`, alternating in sign, so
//      the plan misses the track by decimetres to metres;
//   5. runs the adapter on the start plan with the Aufmaß and the
//      Zwangspunkt, and writes the fitted TRA, the report and the residual
//      list beside a summary.md that tells the story in numbers.
//
// Everything lands in `--out` (default: ./demo-<name> next to the TRA is
// not written to; the current directory is). Nothing in the repository
// changes, and the TRA itself is only read.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fitTra } from "./fitTra.mjs";
import { writeTra, cantLookup } from "./traWriter.mjs";

const ROOT = new URL("../../", import.meta.url);
const load = (path) => import(new URL(path, ROOT));
const { loadTraAlignment, buildProductionAlignment } = await load("test/axtran2/corpus/loadTraAlignment.mjs");
const { deps, momentsFor } = await load("test/axtran2/corpus/createTraScenario.mjs");
const { decodeBinary } = await load("src/import/parsers/technet/vermEsn/sharedVermesn.js");
const { createAlignmentPoseJacobian } = await load("src/domain/optimization/alignment/AlignmentPoseJacobian.js");
const { createFootMemory } = await load("src/domain/optimization/alignment/AlignmentPointProjection.js");

/** deterministic noise in [-1, 1], so a demo repeats */
function noiseFrom(seed) {
	let state = (Number(seed) >>> 0) || 7;
	return () => { state = (state * 1664525 + 1013904223) >>> 0; return (state / 0x100000000) * 2 - 1; };
}

const fmt = (value, digits = 3) => (Number.isFinite(value) ? value.toFixed(digits) : "–");

/**
 * @param {object} input
 * @param {string} input.tra        the surveyed track, a Verm.esn TRA
 * @param {string} input.out        folder for everything written
 * @param {number} [input.spacing]  metres between survey points (25)
 * @param {number} [input.noise]    lateral scatter of the survey, metres (0.04)
 * @param {number} [input.shift]    relative length error of the start plan (0.02)
 * @param {number} [input.bend]     relative curvature error of the start plan (0.03)
 * @param {number} [input.zwang]    the Zwangspunkt's distance left of the axis, metres (2.0); 0 for none
 * @param {number} [input.seed]
 * @param {number} [input.maxIterations]
 */
export async function runDemo({ tra, out, spacing = 25, noise = 0.04, shift = 0.02, bend = 0.03, zwang = 2.0, seed = 7, maxIterations = 1000 } = {}) {
	const t0 = Date.now();
	await mkdir(out, { recursive: true });
	const bytes = await readFile(tra);
	const surveyed = await loadTraAlignment(tra);
	if (surveyed.unsupported.length) throw new Error(`${surveyed.name}: records the adapter cannot carry: ${surveyed.unsupported.map((u) => u.spiType ?? u.type).join(", ")}`);
	const { rowsRaw } = decodeBinary(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "TRA");
	const startStation = rowsRaw[1].station;
	const origin = { x: surveyed.startPose.x, y: surveyed.startPose.y };
	const startPose = { x: 0, y: 0, theta: surveyed.startPose.theta };
	const world = (p) => ({ ...p, x: p.x + origin.x, y: p.y + origin.y });
	const track = buildProductionAlignment({ elements: surveyed.elements, startPose, deps });
	const draw = noiseFrom(seed);

	// 2. the Aufmaß, from the surveyed track
	const lines = ["Nr;Y;X"];
	for (let s = spacing; s < track.arcLength - spacing; s += spacing) {
		const p = track.poseAt(s);
		const off = noise * draw();
		const w = world({ x: p.p.x - off * p.t.y, y: p.p.y + off * p.t.x });
		lines.push(`${lines.length};${w.x.toFixed(4)};${w.y.toFixed(4)}`);
	}
	const pointsText = lines.join("\n") + "\n";
	await writeFile(join(out, "aufmass.csv"), pointsText);

	// 3. one Zwangspunkt, left of the axis
	let zwangText = "";
	if (zwang) {
		const zs = track.arcLength / 3;
		const zp = track.poseAt(zs);
		const zw = world({ x: zp.p.x - zwang * zp.t.y, y: zp.p.y + zwang * zp.t.x });
		zwangText = `name;easting;northing;abstand\nZ1;${zw.x.toFixed(4)};${zw.y.toFixed(4)};${zwang.toFixed(3)}\n`;
		await writeFile(join(out, "zwangspunkte.csv"), zwangText);
	}

	// 4. the start plan, deliberately off
	const plan = surveyed.elements.map((e, i) => {
		if (i === 0 || e.held || surveyed.elements[i + 1]?.type === "kink") return e;
		const sign = i % 2 ? 1 : -1;
		return { ...e, length: e.length * (1 + sign * shift), ...(e.type === "arc" ? { curvature: e.curvature * (1 - sign * bend) } : {}) };
	});
	const planChain = createAlignmentPoseJacobian({ elements: plan, startPose, momentsFor });
	const planFile = join(out, "plan.TRA");
	const written = writeTra({
		elements: plan,
		poseOfElement: (i) => world(planChain.entryPose(i)),
		poseAtStation: (s) => world(planChain.poseAt(s)),
		endPose: world(planChain.endPose),
		jumps: surveyed.kilometreJumps,
		startStation, header: bytes.subarray(0, 78), cantAt: cantLookup(rowsRaw.slice(1), startStation, surveyed.kilometreJumps),
	});
	await writeFile(planFile, written.bytes);
	const planEndMiss = Math.hypot(planChain.endPose.x - (surveyed.endPoint.x - origin.x), planChain.endPose.y - (surveyed.endPoint.y - origin.y));

	// 5. the adapter
	// the end pose is the connecting alignment's, not the plan's: the surveyed
	// track's end, as the original AXTRAN took it from the Anschlusstrasse
	const trackEnd = track.poseAt(track.arcLength);
	const endPose = world({ x: trackEnd.p.x, y: trackEnd.p.y, theta: Math.atan2(trackEnd.t.y, trackEnd.t.x) });
	const endGon = ((Math.PI / 2 - endPose.theta) * (200 / Math.PI) + 400) % 400;
	const result = await fitTra({ tra: planFile, points: pointsText, zwang: zwangText || [], tolerance: 0.15, maxIterations, endPose });
	await writeFile(join(out, "fitted.TRA"), result.tra);
	await writeFile(join(out, "report.json"), JSON.stringify(result.report, null, 2));
	await writeFile(join(out, "residuen.csv"), result.csv);

	const measured = result.report.points.filter((p) => p.kind === "measured");
	const excludedCount = result.report.points.filter((p) => p.kind === "excluded").length;
	const before = measured.map((p) => p.offsetBefore).filter(Number.isFinite);
	const after = measured.map((p) => p.offset).filter(Number.isFinite);
	const maxAbs = (a) => (a.length ? Math.max(...a.map(Math.abs)) : NaN);
	const rmsOf = (a) => (a.length ? Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length) : NaN);
	const { verdict, fit, input } = result.report;
	const z = result.report.points.find((p) => p.kind === "zwangspunkt") ?? null;
	// how far the fitted axis is from the surveyed track, every 10 m, between
	// the points as well as on them; and how far its element quantities are
	// from the track's, which the points do not determine
	const fittedElements = result.fitted;
	const fittedTrack = buildProductionAlignment({ elements: fittedElements, startPose, deps });
	const feet = createFootMemory({ samples: 400, refineSteps: 40 });
	// within the span the points observe, and in the end stretches beyond
	// the first and last admitted point, where only the end pose holds the axis
	const observedStations = measured.map((p) => p.station).filter(Number.isFinite).map((st) => st - startStation);
	const observedFrom = observedStations.length ? Math.min(...observedStations) : 0;
	const observedTo = observedStations.length ? Math.max(...observedStations) : fittedTrack.arcLength;
	let axisMax = 0;
	let axisMaxEnds = 0;
	for (let s = 0; s <= fittedTrack.arcLength; s += 10) {
		const p = fittedTrack.poseAt(s);
		const f = feet.project(track, p.p.x, p.p.y);
		if (f.clamped) continue;
		if (s >= observedFrom && s <= observedTo) axisMax = Math.max(axisMax, Math.abs(f.q));
		else axisMaxEnds = Math.max(axisMaxEnds, Math.abs(f.q));
	}
	const unobserved = Math.round(observedFrom + (fittedTrack.arcLength - observedTo));
	const lengthMiss = Math.max(...surveyed.elements.map((e, i) => Math.abs(fittedElements[i].length - e.length)));
	const radiusMiss = Math.max(0, ...surveyed.elements.map((e, i) => (e.type === "arc" ? Math.abs(1 / fittedElements[i].curvature - 1 / e.curvature) : 0)));
	const undetermined = result.run?.diagnostics?.determinacy?.directions?.length ?? null;
	const seconds = (Date.now() - t0) / 1000;

	const summary = `# AXTRAN2 Vorführung: ${surveyed.name}

Die Trasse: ${surveyed.elements.length} Elemente, ${Math.round(track.arcLength)} m, Familien ${surveyed.families.join(", ") || "keine Übergangsbögen"}${surveyed.kinks ? `, ${surveyed.kinks} Knicke` : ""}${surveyed.kilometreJumps.length ? `, ${surveyed.kilometreJumps.length} Kilometersprünge` : ""}.

## Was hineinging

- **Aufmaß** \`aufmass.csv\`: ${measured.length} Punkte alle ${spacing} m, aus der Trasse abgeleitet mit ${(noise * 100).toFixed(0)} cm Querstreuung. Es gibt für diese Datei kein echtes Aufmaß; das steht hier, damit es niemand für eines hält.
${zwang ? `- **Zwangspunkt** \`zwangspunkte.csv\`: Z1 bei einem Drittel der Länge, ${zwang.toFixed(2)} m links der Achse, als Gleichung.\n` : ""}- **Plan** \`plan.TRA\`: die Trasse mit jeder freien Länge um ±${(shift * 100).toFixed(0)} % und jeder Bogenkrümmung um ±${(bend * 100).toFixed(0)} % verstellt. Der Plan verfehlt das Aufmaß um bis zu ${fmt(maxAbs(before), 2)} m (rms ${fmt(rmsOf(before), 3)} m) und den aufgezeichneten Endpunkt um ${fmt(planEndMiss, 2)} m.
- **Endpose**: die der Anschlusstrasse, hier das Ende der aufgemessenen Trasse (E ${endPose.x.toFixed(3)}, N ${endPose.y.toFixed(3)}, Richtung ${endGon.toFixed(4)} gon), nicht das Ende des Plans.

## Der Aufruf

\`\`\`bash
node tools/axtran2/fitTra.mjs --tra plan.TRA --points aufmass.csv${zwang ? " --zwang zwangspunkte.csv" : ""} --end-pose "${endPose.x.toFixed(3)},${endPose.y.toFixed(3)},${endGon.toFixed(4)}" --out fitted.TRA --report report.json --csv residuen.csv
\`\`\`

## Was herauskam

| | |
|---|---|
| Verdikt | ${verdict.status}${verdict.reason ? " / " + verdict.reason : ""} nach ${verdict.iterations} Schritten in ${fmt(verdict.seconds, 1)} s |
| freie Größen | ${input.free} von ${input.elements} Elementen |
| Punkte im Fit | ${input.points} von ${measured.length + excludedCount}${excludedCount ? `, ${excludedCount} ohne Fußpunkt am Plan ausgeschlossen (Endversatz ${fmt(planEndMiss, 1)} m)` : ""} |
| Aufmaß vorher | max ${fmt(maxAbs(before), 3)} m, rms ${fmt(rmsOf(before), 3)} m |
| Aufmaß nachher | max ${fmt(maxAbs(after), 3)} m, rms ${fmt(rmsOf(after), 3)} m, ${fit.outsideTolerance} von ${measured.length} außerhalb 0,15 m${excludedCount ? `; ${excludedCount} Punkte ohne Fußpunkt am Plan blieben draußen` : ""} |
| Endpose | ${Number.isFinite(fit.endPoseDistance) ? fit.endPoseDistance.toExponential(1) : "–"} m |
${z ? `| Zwangspunkt Z1 | Abstand ${fmt(z.offset, 4)} m, verlangt ${fmt(z.target, 3)} m |\n` : ""}| Achse gegen die Trasse | größter Querabstand ${fmt(axisMax, 3)} m zwischen erstem und letztem Punkt, alle 10 m gemessen${unobserved > 0 ? `; ${fmt(axisMaxEnds, 3)} m auf den ${unobserved} m ohne Punkte an den Enden, wo nur die Endpose hält` : ""} |
| Elementgrößen gegen die Trasse | Länge bis ${fmt(lengthMiss, 1)} m, Radius bis ${fmt(radiusMiss, 0)} m anders${undetermined === null ? "" : `; ${undetermined} von den Punkten nicht bestimmte Richtungen`} |
| Profil | V ${input.speedKmh} km/h, ${input.designExceptions} vererbte Ausnahmen |

Die Punkte bestimmen die Achse, nicht ihre Aufteilung in Elemente: wo ein Übergangsbogen beginnt oder wie weit ein Radius von 5 000 m ist, sieht ein Aufmaß mit ${(noise * 100).toFixed(0)} cm Streuung nicht. Der Bericht nennt diese Richtungen; wer die Aufteilung des Plans halten will, nimmt den Längen-Prior des Beweisdienstes.

Die gefittete Trasse liegt in \`fitted.TRA\` mit ${result.report.output.records} Datensätzen${result.report.output.stationEquations ? ` und ${result.report.output.stationEquations} Kilometersprüngen` : ""}, der Bericht in \`report.json\`, die Residuen je Punkt in \`residuen.csv\`.

Gesamtzeit der Vorführung ${fmt(seconds, 1)} s.
`;
	await writeFile(join(out, "summary.md"), summary);
	return Object.freeze({ summary, report: result.report, out, planEndMiss, before: { max: maxAbs(before), rms: rmsOf(before) }, after: { max: maxAbs(after), rms: rmsOf(after) }, axisMax, axisMaxEnds, unobserved, lengthMiss, radiusMiss, undetermined, seconds });
}

function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (!a.startsWith("--")) continue;
		const next = argv[i + 1];
		if (next === undefined || next.startsWith("--")) args[a.slice(2)] = true;
		else { args[a.slice(2)] = next; i++; }
	}
	return args;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	const args = parseArgs(process.argv.slice(2));
	if (!args.tra) { console.error("usage: node tools/axtran2/demo.mjs --tra <strecke.TRA> [--out <folder>] [--spacing 25] [--noise 0.04] [--shift 0.02] [--bend 0.03] [--zwang 2.0] [--seed 7]"); process.exit(2); }
	const number = (key, fallback) => (args[key] === undefined ? fallback : Number(args[key]));
	runDemo({
		tra: args.tra, out: args.out ?? `demo-${basename(args.tra).replace(/\.tra$/i, "")}`,
		spacing: number("spacing", 25), noise: number("noise", 0.04), shift: number("shift", 0.02), bend: number("bend", 0.03), zwang: number("zwang", 2.0), seed: number("seed", 7),
	}).then((demo) => { process.stdout.write(demo.summary); })
		.catch((e) => { console.error(`${e.code ?? e.name}: ${e.message}`); process.exit(1); });
}
