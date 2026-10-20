#!/usr/bin/env node
// tools/axtran2/fitTra.mjs
//
// The AXTRAN adapter: a Verm.esn TRA file, a list of survey points and a
// list of Zwangspunkte go in; the fitted TRA and a residual report come out.
//
//   node tools/axtran2/fitTra.mjs --tra in.TRA --points aufmass.csv \
//        [--zwang zwangspunkte.csv] [--out fitted.TRA] [--report report.json] \
//        [--csv residuen.csv] [--tolerance 0.15] [--zwang-tolerance 0.01] \
//        [--speed 120] [--iterations 1000] [--axes en|ne] [--hold-last]
//
// The TRA is the start alignment and, unless --end-pose gives the
// connecting alignment's pose, the end pose: its first element's length is
// held, every other length and every arc curvature is free. Survey points are soft residuals in units
// of their tolerance; Zwangspunkte are equalities on the lateral offset.
// Everything is computed in a local frame at the file's start and
// translated back for the output, so the solver never sees a 5 000 km
// coordinate.
//
// The lists are read by tools/axtran2/pointLists.mjs, the file is written
// by tools/axtran2/traWriter.mjs, station equations included; the fit is the
// same problem the corpus runs, built from src/domain/optimization alone, with
// real points. Node resolves the parsers' aliases through ./nodeAliases.mjs.

import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

import { parsePointList, formatResidualList } from "./pointLists.mjs";
import { writeTra, cantLookup } from "./traWriter.mjs";

import { readTraFile } from "./nodeAliases.mjs";

const ROOT = new URL("../../", import.meta.url);
const load = (path) => import(new URL(path, ROOT));
const { buildProductionAlignment } = await load("src/domain/optimization/alignment/ProductionAlignment.js");
const { deps, momentsFor } = await load("src/domain/optimization/alignment/SolverDependencies.js");
const { chooseProfile } = await load("src/domain/optimization/alignment/DesignProfileChoice.js");
const { decodeBinary } = await load("src/import/parsers/technet/vermEsn/sharedVermesn.js");
const { createFootMemory } = await load("src/domain/optimization/alignment/AlignmentPointProjection.js");
const { createAlignmentPoseJacobian } = await load("src/domain/optimization/alignment/AlignmentPoseJacobian.js");
const { createAlignmentVariableCodec } = await load("src/domain/optimization/alignment/AlignmentVariableCodec.js");
const { createAlignmentConstraintBuilder } = await load("src/domain/optimization/alignment/AlignmentConstraintBuilder.js");
const { createAlignmentResidualBuilder } = await load("src/domain/optimization/alignment/AlignmentResidualBuilder.js");
const { createAlignmentOptimizationProblem } = await load("src/domain/optimization/alignment/AlignmentOptimizationProblem.js");
const { createIntrinsicMetricContext } = await load("src/domain/optimization/alignment/MetricContext.js");
const { solveAlignmentProblem } = await load("src/domain/optimization/alignment/AlignmentSQPSolver.js");

export const FIT_TRA_VERSION = "axtran2/fit-tra/0.2";

export class FitTraError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "FitTraError";
		this.code = code;
		this.detail = detail;
	}
}

const error = (code, message, detail) => { throw new FitTraError(code, message, detail); };
const poseOf = (alignment, s) => { const p = alignment.poseAt(s); return { x: p.p.x, y: p.p.y, theta: Math.atan2(p.t.y, p.t.x) }; };
const radiusOf = (e) => (e.type === "arc" && Number.isFinite(e.curvature) && e.curvature !== 0 ? -1 / e.curvature : null);

/**
 * @param {object} input
 * @param {string} input.tra                 path of the TRA
 * @param {Array|string} input.points        survey points [{ name, x, y, tolerance? }] or the list's text
 * @param {Array|string} [input.zwang]       Zwangspunkte [{ name, x, y, distance, tolerance? }] or text
 * @param {number} [input.tolerance]         default point tolerance, metres (0.15)
 * @param {number} [input.zwangTolerance]    scale of a Zwangspunkt's residual, metres (0.01)
 * @param {number|null} [input.speedKmh]     design speed; null picks the fastest Hauptbahn profile the file admits
 * @param {number} [input.cantMm]
 * @param {number} [input.maxIterations]
 * @param {"points"} [input.objective]
 * @param {boolean} [input.holdLast]         hold the last element's length too
 * @param {Array} [input.heldPoses]          [{ afterElement, x?, y?, theta? }] in world coordinates
 * @param {"en"|"ne"} [input.axes]           coordinate order of header-less lists
 * @param {{x,y,theta}|null} [input.endPose]  the end pose to hold, in world coordinates (theta counter-clockwise
 *        from east, radians): the connecting alignment's pose, as the original AXTRAN had it; the TRA's own end otherwise
 * @param {object} [input.solver]            further solveAlignmentProblem options
 */
export async function fitTra({
	tra, points, zwang = [], tolerance = 0.15, zwangTolerance = 0.01, speedKmh = null, cantMm = 130,
	maxIterations = 1000, objective = "points", holdLast = false, heldPoses = [], axes = "en", endPose: endPoseGiven = null, solver = {},
} = {}) {
	if (typeof tra !== "string") error("NO_TRA", "fitTra needs the path of a TRA file");
	const t0 = Date.now();
	const { bytes, loaded } = await readTraFile(tra);
	if (loaded.unsupported.length) {
		error("UNSUPPORTED_RECORDS", `${loaded.name}: records this adapter cannot carry: ${loaded.unsupported.map((u) => u.spiType ?? u.why ?? u.type).join(", ")}`, loaded.unsupported);
	}
	const { rowsRaw } = decodeBinary(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "TRA");
	const sourceRows = rowsRaw.slice(1);
	const startStation = Number.isFinite(sourceRows[0]?.station) ? sourceRows[0].station : 0;

	const surveyed = typeof points === "string" ? parsePointList(points, { kind: "points", axes, tolerance }) : points;
	const zwangspunkte = typeof zwang === "string" ? parsePointList(zwang, { kind: "zwang", axes, tolerance: zwangTolerance }) : zwang;
	if (!Array.isArray(surveyed) || surveyed.length === 0) error("NO_POINTS", "fitTra needs at least one survey point");

	// the local frame: the file's start at the origin, its heading kept
	const origin = { x: loaded.startPose.x, y: loaded.startPose.y };
	const toLocal = (p) => ({ ...p, x: p.x - origin.x, y: p.y - origin.y });
	const toWorld = (p) => ({ ...p, x: p.x + origin.x, y: p.y + origin.y });
	const startPose = Object.freeze({ x: 0, y: 0, theta: loaded.startPose.theta });
	const elements = loaded.elements;
	const last = elements.length - 1;

	const shortest = Math.min(...elements.filter((e) => e.length > 0).map((e) => e.length));
	const elementFloor = Math.max(0.05, Math.min(20, 0.5 * shortest));
	const chainOf = (els) => createAlignmentPoseJacobian({ elements: els, startPose, momentsFor });
	const fileAlignment = buildProductionAlignment({ elements, startPose, deps });
	if (endPoseGiven !== null && ![endPoseGiven?.x, endPoseGiven?.y, endPoseGiven?.theta].every(Number.isFinite)) error("INVALID_END_POSE", "endPose needs finite x, y and theta");
	const endPose = endPoseGiven === null ? poseOf(fileAlignment, fileAlignment.arcLength) : { x: endPoseGiven.x - origin.x, y: endPoseGiven.y - origin.y, theta: endPoseGiven.theta };

	const beforeKink = (i) => elements[i + 1]?.type === "kink";
	const role = (e, i) => ({
		length: i === 0 || (holdLast && i === last) || e.held || beforeKink(i) ? "held" : "free",
		...(e.type === "arc" ? { curvature: e.held ? "held" : "free" } : {}),
	});
	if (!elements.some((e) => e.type === "arc" && !e.held)) error("NOTHING_TO_BEND", `${loaded.name}: straights only, nothing to fit`);
	const codec = createAlignmentVariableCodec({
		elements: elements.map((e, i) => ({ id: e.id, quantities: role(e, i), values: { length: e.length, ...(e.type === "arc" ? { curvature: e.curvature } : {}) } })),
	});

	// A point beyond an end of the start alignment has no foot on it, and the
	// residual builder refuses to measure it from an extended tangent. Where
	// the end pose is given, the plan's end may lie short of it by metres;
	// the corpus keeps its points clear of the ends by one and a half times
	// that miss, and so does the adapter. Excluded points are listed, not lost.
	const planEnd = poseOf(fileAlignment, fileAlignment.arcLength);
	const shortBy = endPoseGiven === null ? 0 : (endPose.x - planEnd.x) * Math.cos(planEnd.theta) + (endPose.y - planEnd.y) * Math.sin(planEnd.theta);
	const margin = Math.min(0.25 * fileAlignment.arcLength, Math.max(0, 1.5 * shortBy));
	const startFeet = createFootMemory({ samples: 400, refineSteps: 40 });
	const excluded = [];
	const admitted = (p, kind) => {
		const f = startFeet.project(fileAlignment, p.x - origin.x, p.y - origin.y);
		const beyond = f.clamped && Math.abs(f.u ?? 0) > 1e-3;
		const why = beyond ? `no foot point on the start alignment: ${Math.abs(f.u).toFixed(3)} m beyond an end`
			: f.s < margin || f.s > fileAlignment.arcLength - margin ? `within ${margin.toFixed(1)} m of an end the plan misses by ${Math.abs(shortBy).toFixed(1)} m` : null;
		if (why === null) return true;
		if (kind === "zwangspunkt") error("ZWANGSPUNKT_WITHOUT_FOOT", `Zwangspunkt "${p.name}" cannot be held: ${why}`);
		excluded.push(Object.freeze({ name: p.name, why }));
		return false;
	};
	const problemPoints = [
		...surveyed.filter((p) => admitted(p, "measured")).map((p) => ({ name: p.name, x: p.x - origin.x, y: p.y - origin.y, target: 0, tolerance: p.tolerance ?? tolerance, enforcement: "soft", kind: "measured" })),
		...zwangspunkte.filter((z) => admitted(z, "zwangspunkt")).map((z) => ({ name: z.name, x: z.x - origin.x, y: z.y - origin.y, target: z.distance, tolerance: z.tolerance ?? zwangTolerance, enforcement: "hard", kind: "zwangspunkt" })),
	];
	if (problemPoints.filter((p) => p.enforcement === "soft").length === 0) error("NO_POINTS", `every survey point lies beyond the start alignment or within ${margin.toFixed(1)} m of its ends`);
	const profile = chooseProfile(elements, { cantMm, sourceName: loaded.name, speedKmh });
	const problem = createAlignmentOptimizationProblem({
		codec,
		constraints: createAlignmentConstraintBuilder({
			endPose,
			elementSequence: codec.elementSequence,
			minimumElementLength: elementFloor,
			hardPoints: zwangspunkte.map((z) => ({ name: z.name })),
			heldPoses: heldPoses.map((h) => ({ ...h, ...(h.x !== undefined ? { x: h.x - origin.x } : {}), ...(h.y !== undefined ? { y: h.y - origin.y } : {}) })),
			elementKinds: Object.fromEntries(elements.map((e) => [e.id, e.type])),
			design: profile.design,
			rampLengthAs: "bound",
		}),
		residuals: createAlignmentResidualBuilder({ metricContext: createIntrinsicMetricContext(), points: problemPoints }),
	});

	const materialise = (overlay) => elements.map((e) => {
		const patch = overlay?.[e.id] ?? {};
		return {
			...e,
			originalLength: e.length,
			length: Number.isFinite(patch.length) ? patch.length : e.length,
			...(e.type === "arc" ? { curvature: Number.isFinite(patch.curvature) ? patch.curvature : e.curvature } : {}),
		};
	});
	const feet = createFootMemory({ samples: 400, refineSteps: 40 });
	const buildAlignment = (overlay) => {
		const els = materialise(overlay);
		const alignment = buildProductionAlignment({ elements: els, startPose, deps });
		return { lengths: els.map((e) => e.length), endPose: poseOf(alignment, alignment.arcLength), worldToTrack: (x, y) => feet.project(alignment, x, y) };
	};
	const analyticJacobian = (overlay) => chainOf(materialise(overlay));

	const run = solveAlignmentProblem({ problem, buildAlignment, analyticJacobian, objective, maxIterations, ...solver });
	const fitted = run.candidate?.variables?.length ? materialise(codec.decode(run.candidate.variables)) : materialise(null);
	const fittedAlignment = buildProductionAlignment({ elements: fitted, startPose, deps });
	const fittedChain = chainOf(fitted);

	// the residuals, before and after, in the kernel's frame: offset left positive
	const reportFeet = createFootMemory({ samples: 400, refineSteps: 40 });
	const offsetOn = (alignment, p) => {
		const f = reportFeet.project(alignment, p.x - origin.x, p.y - origin.y);
		const extrapolated = f.clamped && Math.abs(f.u ?? 0) > 1e-3;
		return extrapolated ? { station: null, offset: null } : { station: startStation + f.s, offset: f.q };
	};
	const excludedNames = new Set(excluded.map((e) => e.name));
	const rows = [...surveyed.map((p) => ({ ...p, target: 0, tolerance: p.tolerance ?? tolerance, kind: excludedNames.has(p.name) ? "excluded" : "measured" })),
		...zwangspunkte.map((z) => ({ ...z, target: z.distance, tolerance: z.tolerance ?? zwangTolerance, kind: "zwangspunkt" }))].map((p) => {
		const before = offsetOn(fileAlignment, p);
		const after = offsetOn(fittedAlignment, p);
		const residual = after.offset === null ? null : after.offset - p.target;
		return Object.freeze({
			name: p.name, kind: p.kind, x: p.x, y: p.y, target: p.target, tolerance: p.tolerance,
			station: after.station, offset: after.offset, offsetBefore: before.offset, residual,
			within: residual === null ? null : Math.abs(residual) <= p.tolerance,
		});
	});

	const written = writeTra({
		elements: fitted,
		poseOfElement: (i) => toWorld(fittedChain.entryPose(i)),
		poseAtStation: (s) => toWorld(fittedChain.poseAt(s)),
		endPose: toWorld(fittedChain.endPose),
		jumps: loaded.kilometreJumps,
		startStation,
		header: bytes.subarray(0, 78),
		cantAt: cantLookup(sourceRows, startStation, loaded.kilometreJumps),
	});
	const d = run.diagnostics;
	const sumBefore = elements.reduce((s, e) => s + e.length, 0);
	const sumAfter = fitted.reduce((s, e) => s + e.length, 0);
	const report = Object.freeze({
		version: FIT_TRA_VERSION,
		input: Object.freeze({
			tra: basename(tra), elements: elements.length, free: codec.freeNames.length, points: surveyed.length - excluded.length, zwangspunkte: zwangspunkte.length,
			excludedPoints: Object.freeze(excluded), endMargin: margin,
			heldPoses: heldPoses.length, endPose: endPoseGiven === null ? "the TRA's own end" : "given", tolerance, zwangTolerance, speedKmh: profile.speedKmh, designExceptions: profile.exceptionCount,
			stationEquations: loaded.stationEquations, mergedRecords: loaded.mergedRecords, kinks: loaded.kinks,
		}),
		verdict: Object.freeze({ status: run.status, reason: d.reason ?? null, ok: run.ok, admissible: run.admissible, iterations: d.iterations, seconds: (Date.now() - t0) / 1000 }),
		fit: Object.freeze({
			rms: d.softResidualRms, outsideTolerance: d.softOutsideTolerance, endPoseDistance: d.endPoseDistance,
			hardPoints: d.hardPointResiduals, heldPoses: d.heldPoseResiduals ?? null, lengthChange: sumAfter - sumBefore,
		}),
		elements: Object.freeze(elements.map((e, i) => Object.freeze({
			id: e.id, type: e.type, family: e.family ?? null, held: Boolean(e.held),
			before: { length: e.length, radius: radiusOf(e) }, after: { length: fitted[i].length, radius: radiusOf(fitted[i]) },
		}))),
		points: Object.freeze(rows),
		output: Object.freeze({ records: written.records, dropped: written.dropped, stationEquations: loaded.kilometreJumps.length }),
	});
	return Object.freeze({ report, tra: written.bytes, run, fitted, csv: formatResidualList(rows) });
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
		console.error("usage: node tools/axtran2/fitTra.mjs --tra in.TRA --points aufmass.csv [--zwang z.csv] [--out fitted.TRA] [--report r.json] [--csv residuen.csv] [--tolerance 0.15] [--zwang-tolerance 0.01] [--speed 120] [--iterations 1000] [--axes en|ne] [--hold-last] [--end-pose E,N,T] (T the direction clockwise from north in gon, as a TRA states it)");
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
		endPose: args["end-pose"] ? endPoseFromArgument(args["end-pose"]) : null,
	});
	const out = args.out ?? args.tra.replace(/\.tra$/i, "") + "_axtran2.TRA";
	await writeFile(out, result.tra);
	if (args.report) await writeFile(args.report, JSON.stringify(result.report, null, 2));
	if (args.csv) await writeFile(args.csv, result.csv);
	const { verdict, fit, input } = result.report;
	console.log(`${input.tra}: ${input.elements} elements, ${input.free} free, ${input.points} points${input.excludedPoints.length ? ` (${input.excludedPoints.length} excluded, see the report)` : ""}, ${input.zwangspunkte} Zwangspunkte, V ${input.speedKmh} km/h`);
	console.log(`verdict ${verdict.status}${verdict.reason ? "/" + verdict.reason : ""} after ${verdict.iterations} iterations in ${verdict.seconds.toFixed(1)} s`);
	console.log(`rms ${fit.rms?.toFixed(3)} (tolerance units), ${fit.outsideTolerance} outside, end pose ${fit.endPoseDistance?.toExponential(1)} m, length ${fit.lengthChange >= 0 ? "+" : ""}${fit.lengthChange?.toFixed(3)} m`);
	for (const h of fit.hardPoints ?? []) console.log(`Zwangspunkt ${h.name}: residual ${h.residual?.toExponential(1)}`);
	console.log(`written ${out} (${result.report.output.records} records${result.report.output.stationEquations ? `, ${result.report.output.stationEquations} station equations` : ""})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	main().catch((e) => { console.error(`${e.code ?? e.name}: ${e.message}`); process.exit(1); });
}
