// src/services/axtran2/fitTraCore.js
//
// The AXTRAN adapter's calculation, free of any file system: the bytes of a
// Verm.esn TRA, the survey list and the Zwangspunkt list as text, and back
// come the fitted TRA as bytes, the report and the residual list. The Node
// command line (tools/axtran2/fitTra.mjs) and the browser app (axtran2/)
// both call this; nothing here knows where the bytes came from.
//
// The TRA is the start alignment and, unless endPose gives the connecting
// alignment's pose, the end pose: its first element's length is held, every
// other length and every arc curvature is free. Survey points are soft
// residuals in units of their tolerance; Zwangspunkte are equalities or, as
// "min"/"max" in the list, one-sided rules on the
// lateral offset. Everything is computed in a local frame at the file's
// start and translated back, so the solver never sees a 5 000 km coordinate.

import { parsePointList, formatResidualList } from "./pointLists.js";
import { writeTra, cantLookup } from "./traWriter.js";
import { recogniseTurnouts, resolveHold } from "./heldRecords.js";
import { parseAllEdits, resolveEdits, TRANSITION_FAMILIES } from "./recordEdits.js";
import { applyStructure } from "./editedElements.js";
import { traAlignmentFromBytes } from "../../import/parsers/technet/vermEsn/traAlignment.js";
import { decodeBinary } from "../../import/parsers/technet/vermEsn/sharedVermesn.js";
import { buildProductionAlignment } from "../../domain/optimization/alignment/ProductionAlignment.js";
import { deps, momentsFor } from "../../domain/optimization/alignment/SolverDependencies.js";
import { chooseProfile } from "../../domain/optimization/alignment/DesignProfileChoice.js";
import { createFootMemory } from "../../domain/optimization/alignment/AlignmentPointProjection.js";
import { createAlignmentPoseJacobian } from "../../domain/optimization/alignment/AlignmentPoseJacobian.js";
import { createAlignmentVariableCodec } from "../../domain/optimization/alignment/AlignmentVariableCodec.js";
import { createAlignmentConstraintBuilder } from "../../domain/optimization/alignment/AlignmentConstraintBuilder.js";
import { createAlignmentResidualBuilder, boundViolation } from "../../domain/optimization/alignment/AlignmentResidualBuilder.js";
import { createAlignmentOptimizationProblem } from "../../domain/optimization/alignment/AlignmentOptimizationProblem.js";
import { createIntrinsicMetricContext } from "../../domain/optimization/alignment/MetricContext.js";
import { solveAlignmentProblem } from "../../domain/optimization/alignment/AlignmentSQPSolver.js";
import { solveAlignmentLexicographic, DEFAULT_TIERS } from "../../domain/optimization/alignment/AlignmentLexicographicSolver.js";
import { GRAVITY } from "../../domain/optimization/alignment/AlignmentDesignProfile.js";

export const FIT_TRA_VERSION = "axtran2/fit-tra/0.14";

/**
 * The orders the adapter runs. "points" is the single objective; the
 * others are the declared priority order of AlignmentLexicographicSolver
 * (tier 0 the poses and the sequence, tier 1 the length, tier 2 the points)
 * and differ in what the length tier hands down: nothing but a number
 * ("reference"), an equality ("strict"), or a budget of metres ("budget=5").
 */
export const ORDERS = Object.freeze(["points", "reference", "strict", "budget"]);

/** @returns {null|Array} the tiers for an order, null for the single objective */
export function tiersOf(order) {
	if (order === undefined || order === null || order === "points") return null;
	if (order === "reference") return DEFAULT_TIERS;
	if (order === "strict") return [{ objective: "accumulated-length", absolute: 0 }, { objective: "points" }];
	const budget = typeof order === "object" ? order.budget : typeof order === "string" && order.startsWith("budget=") ? Number(order.slice(7)) : NaN;
	if (Number.isFinite(budget) && budget >= 0) return [{ objective: "accumulated-length", absolute: budget }, { objective: "points" }];
	error("INVALID_ORDER", `order wants one of ${ORDERS.join(", ")} (budget as "budget=<metres>"); got ${JSON.stringify(order)}`);
}

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
 * @param {Uint8Array} input.bytes           the TRA file
 * @param {string} [input.name]              its name, for the report
 * @param {Array|string} input.points        survey points [{ name, x, y, tolerance? }] or the list's text
 * @param {Array|string} [input.zwang]       Zwangspunkte [{ name, x, y, distance, tolerance?, enforcement? }] or text; enforcement "hard" (default), "at-least" or "at-most"
 * @param {number} [input.tolerance]         default point tolerance, metres (0.15)
 * @param {number} [input.zwangTolerance]    scale of a Zwangspunkt's residual, metres (0.01)
 * @param {number|null} [input.speedKmh]     design speed. Null is an assumption the report states with its reason
 *        (input.speed): what the slowest turnout the file shows allows in its branch (Ril 800.0120A01), and
 *        without a turnout the fastest Hauptbahn profile the file admits
 * @param {number} [input.cantMm]
 * @param {number} [input.maxIterations]
 * @param {"points"} [input.objective]
 * @param {"points"|"reference"|"strict"|string|{budget:number}} [input.order]
 *        "points": the points as the one objective (default). The others run the priority
 *        order: the length tier reports what the shortest admissible alignment would be
 *        ("reference"), holds it ("strict"), or allows "budget=<metres>" over it.
 * @param {boolean} [input.holdLast]         hold the last element's length too
 * @param {Array|string} [input.hold]        records held as they stand: numbers as the TRA's listing counts them,
 *        with L or R behind one to hold its length or its radius alone ("7R"); otherwise length and radius. Also
 *        listing counts them, ranges ("3-5"), and "turnouts" for every record recognised as a catalogue turnout
 * @param {boolean} [input.holdRadii]        hold every radius; the lengths stay free
 * @param {Array|Map|string} [input.edits]   values the fit starts from instead of the file's: "7L=45,2 7R=-1250 9T=Bloss"
 *        (record, L length, R radius with the file's sign, T the type of a transition); an edited record keeps its own element.
 *        "-9" takes record 9 out, "+9=G:20" (or B:-500:30, U:40:Bloss) puts a record in after it (recordEdits.js)
 * @param {Array} [input.heldPoses]          [{ afterElement, x?, y?, theta? }] in world coordinates
 * @param {"en"|"ne"} [input.axes]           coordinate order of header-less lists
 * @param {{x,y,theta}|null} [input.endPose]  the end pose to hold, in world coordinates (theta counter-clockwise
 *        from east, radians): the connecting alignment's pose, as the original AXTRAN had it; the TRA's own end otherwise
 * @param {object} [input.solver]            further solveAlignmentProblem options
 */
export async function fitTraFromBytes({
	bytes, name = "alignment.TRA", points, zwang = [], tolerance = 0.15, zwangTolerance = 0.01, speedKmh = null, cantMm = 130,
	maxIterations = 1000, objective = "points", order = "points", holdLast = false, hold = [], holdRadii = false, edits = [], heldPoses = [], axes = "en", endPose: endPoseGiven = null, solver = {},
} = {}) {
	if (!(bytes instanceof Uint8Array)) error("NO_TRA", "fitTraFromBytes needs the TRA's bytes as a Uint8Array");
	const tiers = tiersOf(order);
	const t0 = Date.now();
	// The file is read twice where records are held: once to see its
	// records and the turnouts among them, once more with the held ones
	// kept apart from their neighbours.
	const seen = await traAlignmentFromBytes(bytes, name);
	const turnoutsSeen = recogniseTurnouts(seen.records);
	const heldRecords = resolveHold(hold, seen.records, turnoutsSeen);
	const allEdits = parseAllEdits(edits);
	const recordEdits = resolveEdits(allEdits.values, seen.records);
	// held, edited, removed records and those a record goes in after stay apart from
	// their neighbours: one record, one element
	const apart = new Set([...heldRecords.keys(), ...recordEdits.keys(), ...allEdits.removed, ...allEdits.inserted.keys()]);
	const loaded = apart.size ? await traAlignmentFromBytes(bytes, name, { fixedRecords: apart }) : seen;
	for (const n of heldRecords.keys()) if (loaded.recordElements[n - 1] === null) error("INVALID_HOLD", `record ${n} carries no element this adapter can hold`);
	for (const n of recordEdits.keys()) if (loaded.recordElements[n - 1] === null) error("INVALID_EDIT", `record ${n} carries no element this adapter can change`);
	for (const n of heldRecords.keys()) if (allEdits.removed.has(n)) error("INVALID_EDIT", `record ${n} is held and taken out at once`);
	for (const n of recordEdits.keys()) if (allEdits.removed.has(n)) error("INVALID_EDIT", `record ${n} is changed and taken out at once`);
	// the structure: records taken out and put in
	const structure = applyStructure({ elements: loaded.elements, recordElements: loaded.recordElements, records: seen.records, removed: allEdits.removed, inserted: allEdits.inserted, turnouts: turnoutsSeen });
	const elementOf = (key) => structure.recordElements.get(key) ?? null;
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
	// the elements the fit starts from: the file's, with the edited values in place
	const editOf = new Map([...recordEdits].map(([n, e]) => [elementOf(n), e]));
	const elements = structure.elements.map((e) => {
		const edit = editOf.get(e.id);
		if (!edit) return e;
		// a transition's type: one the writer carries, from one the writer carries (a half-wave is its own thing)
		if (edit.family !== undefined && !TRANSITION_FAMILIES[e.family]) error("INVALID_EDIT", `${e.id}: a transition of type "${e.family}" cannot change its type`);
		return { ...e, ...(edit.length !== undefined ? { length: edit.length } : {}), ...(edit.radius !== undefined ? { curvature: -1 / edit.radius } : {}), ...(edit.family !== undefined ? { family: edit.family } : {}) };
	});
	// the file's transition family per record, for the report (a transition is never merged)
	const familyOfRecord = (n) => seen.elements.find((e) => e.id === seen.recordElements[n - 1])?.family ?? null;
	const last = elements.length - 1;

	const shortest = Math.min(...elements.filter((e) => e.length > 0).map((e) => e.length));
	const elementFloor = Math.max(0.05, Math.min(20, 0.5 * shortest));
	const chainOf = (els) => createAlignmentPoseJacobian({ elements: els, startPose, momentsFor });
	const fileAlignment = buildProductionAlignment({ elements, startPose, deps });
	if (endPoseGiven !== null && ![endPoseGiven?.x, endPoseGiven?.y, endPoseGiven?.theta].every(Number.isFinite)) error("INVALID_END_POSE", "endPose needs finite x, y and theta");
	const endPose = endPoseGiven === null ? poseOf(fileAlignment, fileAlignment.arcLength) : { x: endPoseGiven.x - origin.x, y: endPoseGiven.y - origin.y, theta: endPoseGiven.theta };

	const beforeKink = (i) => elements[i + 1]?.type === "kink";
	// what of a fixed element is held: the quantities of its record (a fixed
	// record is never merged, so it is one element with one record)
	const holdOf = new Map();
	for (const [n, h] of heldRecords) {
		const id = elementOf(n);
		const have = holdOf.get(id) ?? { length: false, radius: false };
		holdOf.set(id, { length: have.length || h.length, radius: have.radius || h.radius });
	}
	const heldIn = (e) => holdOf.get(e.id) ?? { length: false, radius: false };
	const role = (e, i) => ({
		length: i === 0 || (holdLast && i === last) || e.held || heldIn(e).length || beforeKink(i) ? "held" : "free",
		...(e.type === "arc" ? { curvature: e.held || heldIn(e).radius || holdRadii ? "held" : "free" } : {}),
	});
	if (!elements.some((e) => e.type === "arc" && !e.held)) error("NOTHING_TO_BEND", `${loaded.name}: straights only, nothing to fit`);
	if (!elements.some((e, i) => Object.values(role(e, i)).includes("free"))) error("NOTHING_FREE", `${loaded.name}: every length and every radius is held, nothing is left to fit`);
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
	// A station given with a point is a hint, in the file's chainage: the
	// foot is searched from there, not for the nearest. Each projector of
	// this fit is seeded with it on the start alignment.
	const hinted = [...surveyed, ...zwangspunkte].filter((p) => p.station !== undefined);
	for (const p of hinted) {
		if (!Number.isFinite(p.station)) error("INVALID_STATION", `point "${p.name}": the station ${p.station} is not a number`);
		const s = p.station - startStation;
		if (s < 0 || s > fileAlignment.arcLength) error("STATION_OUTSIDE", `point "${p.name}": station ${p.station.toFixed(3)} lies outside the alignment, which runs from ${startStation.toFixed(3)} to ${(startStation + fileAlignment.arcLength).toFixed(3)}`);
	}
	const seeded = (memory) => { for (const p of hinted) memory.seed(fileAlignment, p.x - origin.x, p.y - origin.y, p.station - startStation); return memory; };
	const startFeet = seeded(createFootMemory({ samples: 400, refineSteps: 40 }));
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
		...zwangspunkte.filter((z) => admitted(z, "zwangspunkt")).map((z) => ({ name: z.name, x: z.x - origin.x, y: z.y - origin.y, target: z.distance, tolerance: z.tolerance ?? zwangTolerance, enforcement: z.enforcement ?? "hard", kind: "zwangspunkt" })),
	];
	if (problemPoints.filter((p) => p.enforcement === "soft").length === 0) error("NO_POINTS", `every survey point lies beyond the start alignment or within ${margin.toFixed(1)} m of its ends`);
	// The speed. Given, it is the caller's. Not given, it is an assumption,
	// and the report says which and why, so that it can be judged and
	// changed: a track that runs through a turnout's branch runs no faster
	// than the annex allows there; a track without one gets the fastest
	// Hauptbahn profile its radii and lengths admit.
	const speedGiven = Number.isFinite(speedKmh) && speedKmh > 0;
	const slowestTurnout = turnoutsSeen.filter((t) => Number.isFinite(t.branchSpeedKmh)).sort((a, b) => a.branchSpeedKmh - b.branchSpeedKmh)[0] ?? null;
	const speedBasis = speedGiven ? "given" : slowestTurnout ? "turnout" : "profile";
	const profile = chooseProfile(elements, { cantMm, sourceName: loaded.name, speedKmh: speedBasis === "turnout" ? slowestTurnout.branchSpeedKmh : speedKmh });
	const problem = createAlignmentOptimizationProblem({
		codec,
		constraints: createAlignmentConstraintBuilder({
			endPose,
			elementSequence: codec.elementSequence,
			minimumElementLength: elementFloor,
			// the equalities; a one-sided Zwangspunkt is an inequality and declares itself through the residuals
			hardPoints: zwangspunkte.filter((z) => (z.enforcement ?? "hard") === "hard").map((z) => ({ name: z.name })),
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
			// the span the element has in the file, for station equations and cants found by distance there
			originalLength: e.fileSpan ?? e.length,
			length: Number.isFinite(patch.length) ? patch.length : e.length,
			...(e.type === "arc" ? { curvature: Number.isFinite(patch.curvature) ? patch.curvature : e.curvature } : {}),
		};
	});
	const feet = seeded(createFootMemory({ samples: 400, refineSteps: 40 }));
	const buildAlignment = (overlay) => {
		const els = materialise(overlay);
		const alignment = buildProductionAlignment({ elements: els, startPose, deps });
		return { lengths: els.map((e) => e.length), endPose: poseOf(alignment, alignment.arcLength), worldToTrack: (x, y) => feet.project(alignment, x, y) };
	};
	const analyticJacobian = (overlay) => chainOf(materialise(overlay));

	const run = tiers === null
		? solveAlignmentProblem({ problem, buildAlignment, analyticJacobian, objective, maxIterations, ...solver })
		: solveAlignmentLexicographic({ problem, buildAlignment, analyticJacobian, tiers, maxIterations, solver });
	// the order's own account: each phase with its verdict, and what the
	// points cost in length against the shortest admissible alignment
	const lengthBudget = run.budgets?.find((b) => b.objective === "accumulated-length") ?? null;
	const orderReport = tiers === null ? null : Object.freeze({
		order: typeof order === "object" ? `budget=${order.budget}` : order,
		tiers: Object.freeze(tiers.map((t) => Object.freeze({ ...t }))),
		phases: Object.freeze(run.phases.map((p) => Object.freeze({ label: p.label, objective: p.objective, status: p.status, ok: p.ok, reason: p.diagnostics?.reason ?? null, iterations: p.diagnostics?.iterations ?? null }))),
		budgetMode: lengthBudget?.mode ?? null,
		shortestLength: lengthBudget?.attained ?? null,
		lengthCost: lengthBudget?.span ?? null,
		noBudget: run.skippedBudgets?.length ? run.skippedBudgets.map((b) => b.objective ?? b) : [],
	});
	const fitted = run.candidate?.variables?.length ? materialise(codec.decode(run.candidate.variables)) : materialise(null);
	const fittedAlignment = buildProductionAlignment({ elements: fitted, startPose, deps });
	const fittedChain = chainOf(fitted);

	// the residuals, before and after, in the kernel's frame: offset left positive
	const reportFeet = seeded(createFootMemory({ samples: 400, refineSteps: 40 }));
	const offsetOn = (alignment, p) => {
		const f = reportFeet.project(alignment, p.x - origin.x, p.y - origin.y);
		const extrapolated = f.clamped && Math.abs(f.u ?? 0) > 1e-3;
		return extrapolated ? { station: null, offset: null } : { station: startStation + f.s, offset: f.q };
	};
	const excludedNames = new Set(excluded.map((e) => e.name));
	const rows = [...surveyed.map((p) => ({ ...p, target: 0, tolerance: p.tolerance ?? tolerance, kind: excludedNames.has(p.name) ? "excluded" : "measured" })),
		...zwangspunkte.map((z) => ({ ...z, target: z.distance, tolerance: z.tolerance ?? zwangTolerance, kind: "zwangspunkt", enforcement: z.enforcement ?? "hard" }))].map((p) => {
		const before = offsetOn(fileAlignment, p);
		const after = offsetOn(fittedAlignment, p);
		const residual = after.offset === null ? null : after.offset - p.target;
		// a one-sided Zwangspunkt is within when it is not violated beyond its tolerance
		const violation = residual === null ? null : boundViolation(p.enforcement, p.target, after.offset);
		return Object.freeze({
			name: p.name, kind: p.kind, enforcement: p.enforcement ?? "soft", x: p.x, y: p.y, target: p.target, tolerance: p.tolerance,
			station: after.station, offset: after.offset, offsetBefore: before.offset, residual,
			// what the list said beside the coordinates: the hint and the remark
			stationGiven: p.station ?? null, remark: p.remark ?? null,
			within: residual === null ? null : violation === null ? Math.abs(residual) <= p.tolerance : violation <= p.tolerance,
		});
	});

	// The cant. The fit does not touch it: U1/U2 go back into the file as
	// they were, since cant is a design decision of another discipline. But
	// a radius that changed is judged against the cant it keeps: at the
	// profile's speed the equilibrium cant is s V^2 / (g R), and what the
	// carried cant leaves of it is the deficiency, which Ril 800.0110 limits.
	// Every arc is listed, before and after, and the ones that exceed the
	// limit are counted. A file without cant gets the same account, which
	// then says what the deficiency would be at that speed with none.
	const cantOf = cantLookup(sourceRows, startStation, loaded.kilometreJumps);
	const design = profile.design;
	const V = design.speed, gauge = design.dynamicGauge;
	const equilibriumMm = (radius) => radius === null ? 0 : (gauge * V * V) / (GRAVITY * Math.abs(radius)) * 1000;
	// the carried cant is judged against the regulatory cap the profile
	// declares (EBO), not against the cant the profile assumes for its radius
	// floor: that assumption is the adapter's, the cap is the rule's
	const cantLimit = design.declared.regulatoryCantLimit ?? design.declared.maximumCant;
	const maximumCantMm = cantLimit.value * 1000;
	const maximumDeficiencyMm = design.declared.maximumCantDeficiency.value * 1000;
	let originalStart = 0;
	const cantArcs = [];
	elements.forEach((e, i) => {
		const start = originalStart;
		originalStart += e.length;
		if (e.type !== "arc" || !(e.length > 0)) return;
		const carried = cantOf(start);
		const cantMm = carried.cantA ?? 0;
		const judge = (radius) => {
			const equilibrium = equilibriumMm(radius);
			const deficiency = equilibrium - cantMm;
			return { radius, equilibriumMm: equilibrium, deficiencyMm: deficiency, ok: deficiency <= maximumDeficiencyMm + 1e-9 };
		};
		cantArcs.push(Object.freeze({ id: e.id, cantMm, cantOk: cantMm <= maximumCantMm + 1e-9, before: Object.freeze(judge(radiusOf(e))), after: Object.freeze(judge(radiusOf(fitted[i]))) }));
	});
	// what the arcs themselves admit: the speed at which the tightest of
	// them, with the cant it carries, reaches the deficiency limit. A speed
	// assumed or given above it shows in the counts below; this says by how much.
	const admissibleOf = (arc) => Math.sqrt(((maximumDeficiencyMm + arc.cantMm) / 1000) * GRAVITY * Math.abs(arc.after.radius) / gauge) * 3.6;
	const limiting = cantArcs.length ? cantArcs.reduce((a, b) => (admissibleOf(b) < admissibleOf(a) ? b : a)) : null;
	const cantReport = Object.freeze({
		admissibleSpeedKmh: limiting ? admissibleOf(limiting) : null,
		limitingArc: limiting ? Object.freeze({ id: limiting.id, radius: limiting.after.radius, cantMm: limiting.cantMm }) : null,
		carried: "from the source file, unchanged by the fit",
		present: sourceRows.some((r) => (r.cantA ?? 0) !== 0 || (r.cantE ?? 0) !== 0),
		speedKmh: profile.speedKmh,
		maximumCantMm, maximumCantSource: cantLimit.source,
		maximumDeficiencyMm, maximumDeficiencySource: design.declared.maximumCantDeficiency.source,
		arcs: Object.freeze(cantArcs),
		exceededBefore: cantArcs.filter((a) => !a.before.ok).length,
		exceededAfter: cantArcs.filter((a) => !a.after.ok).length,
		excessiveCant: cantArcs.filter((a) => !a.cantOk).length,
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
	const d = run.diagnostics ?? {};
	const failedPhase = tiers === null ? null : run.phases.find((p) => p.label !== "warm-start" && !p.ok) ?? null;
	const iterations = tiers === null ? d.iterations : run.phases.reduce((n, p) => n + (p.diagnostics?.iterations ?? 0), 0);
	const sumBefore = elements.reduce((s, e) => s + e.length, 0);
	const sumAfter = fitted.reduce((s, e) => s + e.length, 0);
	const report = Object.freeze({
		version: FIT_TRA_VERSION,
		input: Object.freeze({
			tra: name, elements: elements.length, free: codec.freeNames.length, points: surveyed.length - excluded.length, zwangspunkte: zwangspunkte.length,
			excludedPoints: Object.freeze(excluded), endMargin: margin, stationHints: hinted.length,
			// the speed and where it comes from: "given", "turnout" or "profile"
			speed: Object.freeze({
				kmh: profile.speedKmh, basis: speedBasis,
				why: speedBasis === "given" ? "given by the caller"
					: speedBasis === "turnout" ? `assumed: the branch of ${slowestTurnout.designation} (record ${slowestTurnout.arc}) allows ${slowestTurnout.branchSpeedKmh} km/h (Ril 800.0120A01)`
					: "assumed: the fastest Hauptbahn profile the file's radii and lengths admit",
				turnout: speedBasis === "turnout" ? Object.freeze({ designation: slowestTurnout.designation, records: slowestTurnout.records, branchSpeedKmh: slowestTurnout.branchSpeedKmh }) : null,
			}),
			// what the fit may not touch: the records held, in which quantities and why, and whether every radius is
			heldRecords: Object.freeze([...heldRecords].map(([record, h]) => Object.freeze({ record, element: elementOf(record), why: h.why, length: h.length, radius: h.radius }))),
			holdRadii: Boolean(holdRadii),
			// what the fit started from where it is not the file: the edited values
			edits: Object.freeze([...recordEdits].map(([record, e]) => Object.freeze({ record, element: elementOf(record), length: e.length ?? null, radius: e.radius ?? null, family: e.family ?? null }))),
			// the structure: records taken out, records put in (under their keys, "7+1")
			structure: Object.freeze({ removed: Object.freeze(structure.removed), inserted: Object.freeze(structure.inserted.map((i) => Object.freeze({ ...i }))) }),
			turnouts: Object.freeze(turnoutsSeen.map((t) => Object.freeze({ ...t, held: t.records.every((n) => heldRecords.has(n)) }))),
			records: loaded.recordCount,
			heldPoses: heldPoses.length, endPose: endPoseGiven === null ? "the TRA's own end" : "given", order: orderReport?.order ?? "points", tolerance, zwangTolerance, speedKmh: profile.speedKmh, designExceptions: profile.exceptionCount,
			stationEquations: loaded.stationEquations, mergedRecords: loaded.mergedRecords, kinks: loaded.kinks,
		}),
		verdict: Object.freeze({ status: run.status, reason: failedPhase ? `${failedPhase.label}: ${failedPhase.diagnostics?.reason ?? failedPhase.status}` : d.reason ?? null, ok: run.ok, admissible: run.admissible, iterations, seconds: (Date.now() - t0) / 1000 }),
		order: orderReport,
		fit: Object.freeze({
			rms: d.softResidualRms, outsideTolerance: d.softOutsideTolerance, endPoseDistance: d.endPoseDistance,
			hardPoints: d.hardPointResiduals, boundPoints: d.boundPointResiduals ?? [], heldPoses: d.heldPoseResiduals ?? null, lengthChange: sumAfter - sumBefore,
		}),
		elements: Object.freeze(elements.map((e, i) => Object.freeze({
			id: e.id, type: e.type, family: e.family ?? null, held: Boolean(e.held), fixed: Boolean(e.fixed),
			// the records of the file this element stands for: several where equal neighbours were merged
			records: Object.freeze([...(structure.elementRecords.get(e.id) ?? [])]),
			before: { length: e.length, radius: radiusOf(e) }, after: { length: fitted[i].length, radius: radiusOf(fitted[i]) },
		}))),
		// the file's records as it lists them, each with the element that carries it: what a
		// picture needs to offer a record to be held, also where the fit merged it away
		planRecords: Object.freeze(seen.records.flatMap((r) => [
			Object.freeze({
				// length and radius as the fit started from them; the file's where they differ
				number: r.number, type: r.type, length: recordEdits.get(r.number)?.length ?? r.length, radius: recordEdits.get(r.number)?.radius ?? radiusOf(r),
				fileLength: r.length, fileRadius: radiusOf(r),
				family: r.type === "transition" ? recordEdits.get(r.number)?.family ?? familyOfRecord(r.number) : null,
				fileFamily: r.type === "transition" ? familyOfRecord(r.number) : null,
				edited: recordEdits.has(r.number) ? Object.freeze({ length: recordEdits.get(r.number).length !== undefined, radius: recordEdits.get(r.number).radius !== undefined, family: recordEdits.get(r.number).family !== undefined }) : null,
				removed: allEdits.removed.has(r.number),
				inserted: null,
				element: elementOf(r.number),
				held: heldRecords.get(r.number)?.why ?? null,
				heldLength: Boolean(heldRecords.get(r.number)?.length),
				heldRadius: Boolean(heldRecords.get(r.number)?.radius) && r.type === "arc",
				turnout: turnoutsSeen.find((t) => t.records.includes(r.number))?.designation ?? null,
			}),
			// the records put in after this one, under their keys
			...structure.inserted.filter((i) => i.after === r.number).map((i) => Object.freeze({
				number: i.key, type: i.type, length: i.length, radius: i.radius, fileLength: null, fileRadius: null,
				family: i.family, fileFamily: null, edited: null, removed: false, inserted: Object.freeze({ after: i.after, index: i.index }),
				element: i.element, held: null, heldLength: false, heldRadius: false, turnout: null,
			})),
		])),
		points: Object.freeze(rows),
		cant: cantReport,
		output: Object.freeze({ records: written.records, dropped: written.dropped, stationEquations: loaded.kilometreJumps.length }),
	});
	return Object.freeze({ report, tra: written.bytes, run, fitted, csv: formatResidualList(rows) });
}

