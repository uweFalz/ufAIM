// test/axtran2/corpus/createTraScenario.mjs
//
// One real alignment as an optimisation problem, built the way the nine-element
// fixture builds its synthetic one: the file's geometry is the truth, points are
// sampled along it with a small deterministic disturbance, the start is the
// truth with its free quantities perturbed, and the end pose is the truth's.
// What the solver is then asked is whether it finds its way back.
//
// The design profile is a Hauptbahn profile at the fastest speed the alignment
// admits; where the as-built geometry is tighter than that profile allows - a
// radius under the EBO floor, a transition shorter than the ramp rule wants -
// the element carries a declared exception naming the file as its source. That
// is how an inherited curve is declared in practice, and it keeps the truth
// admissible so that recovering it is a fair question.

import { createHash } from "node:crypto";
import { loadTraAlignment, buildProductionAlignment } from "./loadTraAlignment.mjs";

const ROOT = new URL("../../../", import.meta.url);
const load = (path) => import(new URL(path, ROOT));
const { RegistryResolver } = await load("src/domain/transition/registry/RegistryResolver.js");
const { KappaFcnBuilder } = await load("src/domain/transition/build/KappaFcnBuilder.js");
const lookup = (await import(new URL("src/domain/transition/transitionLookup.json", ROOT), { with: { type: "json" } })).default;
const { createTransitionMomentsCatalogue } = await load("src/domain/optimization/alignment/TransitionMomentsCatalogue.js");
const { createFootMemory } = await load("src/domain/optimization/alignment/AlignmentPointProjection.js");
const { createAlignmentPoseJacobian } = await load("src/domain/optimization/alignment/AlignmentPoseJacobian.js");
const { createAlignmentVariableCodec } = await load("src/domain/optimization/alignment/AlignmentVariableCodec.js");
const { createAlignmentConstraintBuilder } = await load("src/domain/optimization/alignment/AlignmentConstraintBuilder.js");
const { createAlignmentResidualBuilder } = await load("src/domain/optimization/alignment/AlignmentResidualBuilder.js");
const { createAlignmentOptimizationProblem } = await load("src/domain/optimization/alignment/AlignmentOptimizationProblem.js");
const { createIntrinsicMetricContext } = await load("src/domain/optimization/alignment/MetricContext.js");
const { hauptbahn } = await load("src/domain/optimization/alignment/profiles/index.js");

export const deps = Object.freeze({ descriptorResolver: new RegistryResolver(lookup), kappaBuilder: KappaFcnBuilder });

export const momentsFor = createTransitionMomentsCatalogue(deps);

/** deterministic in the file name, so a run is reproducible without a random source */
function noise(seedText) {
	let state = createHash("sha256").update(seedText).digest().readUInt32LE(0);
	return () => { state = (state * 1664525 + 1013904223) >>> 0; return (state / 0x100000000) * 2 - 1; };
}

export const SPEED_CANDIDATES = Object.freeze([200, 160, 140, 120, 100, 80]);

/**
 * The fastest Hauptbahn profile the truth admits, with exceptions where it
 * does not. Judged against the bound form's floors, which are the conservative
 * ones: the exact ramp rule asks less of a transition between similar radii.
 */
export function chooseProfile(elements, { cantMm = 130, sourceName = "as-built" } = {}) {
	const arcs = elements.filter((e) => e.type === "arc" && e.length > 0);
	let chosen = null;
	for (const speedKmh of SPEED_CANDIDATES) {
		const profile = hauptbahn({ speedKmh, cantMm });
		const tooTight = arcs.filter((e) => 1 / Math.abs(e.curvature) < profile.minimumRadius * (1 - 1e-9));
		// every kind has a floor: the ramp rule's for a transition, the profile's
		// own declared one for a straight or an arc. A turnout's 15 m straight
		// against a declared 20 m put the truth out of reach, and the subproblem
		// relaxed for 185 iterations without a verdict.
		const tooShort = elements.filter((e) => e.length > 0
			&& e.length < profile.minimumLengthFor(e.type, e.id) * (1 - 1e-9));
		chosen = { speedKmh, tooTight, tooShort };
		if (tooTight.length === 0 && tooShort.length === 0) break;
	}
	const exceptions = {};
	for (const e of chosen.tooTight) {
		exceptions[e.id] = { source: `corpus: inherited radius of ${sourceName}`, minimumRadius: (1 / Math.abs(e.curvature)) * (1 - 1e-6) };
	}
	for (const e of chosen.tooShort) {
		exceptions[e.id] = { ...(exceptions[e.id] ?? { source: `corpus: inherited ${e.type} of ${sourceName}` }), minimumLength: e.length * (1 - 1e-6) };
	}
	// The exact form asks each transition for m·|Δu| between its neighbours'
	// cants. A length exception lowers the bound, not that row: a 0.2 m
	// transition into a 190 m arc needs its own, steeper m or the truth is out
	// of reach under rampLengthAs "constraint" and never fairly measurable.
	const profile = hauptbahn({ speedKmh: chosen.speedKmh, cantMm });
	const tooSteep = [];
	elements.forEach((e, index) => {
		if (e.type !== "transition" || !(e.length > 0) || !profile.rampGradient) return;
		const entry = elements[index - 1]?.curvature ?? 0;
		const exit = elements[index + 1]?.curvature ?? 0;
		const change = Math.abs(profile.cantAt(exit) - profile.cantAt(entry));
		if (change === 0 || e.length >= profile.rampGradient * change * (1 - 1e-9)) return;
		tooSteep.push(e);
		exceptions[e.id] = {
			...(exceptions[e.id] ?? { source: `corpus: inherited ramp of ${sourceName}` }),
			rampGradient: (e.length / change) * (1 - 1e-6),
		};
	});
	return Object.freeze({
		speedKmh: chosen.speedKmh,
		design: hauptbahn({ speedKmh: chosen.speedKmh, cantMm, exceptions: Object.keys(exceptions).length ? exceptions : undefined }),
		exceptionCount: Object.keys(exceptions).length,
		inheritedRadii: chosen.tooTight.length,
		inheritedLengths: chosen.tooShort.length,
		inheritedRamps: tooSteep.length,
	});
}

/**
 * @param {string|URL|object} source  a .TRA path, or an alignment already loaded
 * @param {object} [options]
 * @param {number} [options.pointSpacing]   metres between sampled points (default 50)
 * @param {number} [options.spread]         lateral disturbance amplitude, metres
 * @param {number} [options.tolerance]      per-point tolerance, metres
 * @param {number} [options.perturbation]   relative perturbation of the free quantities at the start
 * @param {string} [options.rampLengthAs]
 * @param {"held"|"free"} [options.kinkStation]  whether the element before a kink keeps its length (default held)
 */
export async function createTraScenario(source, {
	pointSpacing = 50, spread = 0.04, tolerance = 0.15, perturbation = 0.03,
	rampLengthAs = "bound", minimumElementLength = null, cantMm = 130,
	holdLast = false, kinkStation = "held",
} = {}) {
	const loaded = typeof source === "object" && source.elements ? source : await loadTraAlignment(source);
	if (loaded.unsupported.length) {
		throw new Error(`${loaded.name}: unsupported records ${loaded.unsupported.map((u) => u.spiType ?? u.type).join(", ")}`);
	}
	// local frame: the file's start at the origin, its heading kept
	const startPose = Object.freeze({ x: 0, y: 0, theta: loaded.startPose.theta });
	const trueElements = loaded.elements;
	const ids = trueElements.map((e) => e.id);
	const last = trueElements.length - 1;

	// The floor under every element length may not sit above what the file
	// itself has: a turnout's 15 m straight against a floor of 20 m put the truth
	// out of reach and the solve parked on the bound, 5 m short of its end
	// pose. Half the shortest as-built element, and never more than twenty.
	const shortest = Math.min(...trueElements.filter((e) => e.length > 0).map((e) => e.length));
	const elementFloor = minimumElementLength ?? Math.max(0.05, Math.min(20, 0.5 * shortest));
	const chainOf = (elements) => createAlignmentPoseJacobian({ elements, startPose, momentsFor });
	const truthChain = chainOf(trueElements);
	const truth = buildProductionAlignment({ elements: trueElements, startPose, deps });
	const poseOf = (alignment, s) => { const p = alignment.poseAt(s); return { x: p.p.x, y: p.p.y, theta: Math.atan2(p.t.y, p.t.x) }; };
	const endPose = poseOf(truth, truth.arcLength);

	// the free quantities: every element's length but the first, every arc's
	// curvature. The first element's length is held because it anchors poseA;
	// the last one is what reaches poseE and stays free - measured, holding it
	// as the fixture does left three-element turnouts with two variables
	// against three equalities. A junction arc of zero length holds everything.
	// A kink's station is the file's datum: the record sits where it sits. Left
	// free, the two straights it joins are all but one element - a 0.03 gon
	// kink moved 21 m along them for a centimetre of lateral effect on
	// Landshut/5634S000-007 - and the fit walks that valley for the whole
	// budget. The element before a kink keeps its length.
	const beforeKink = (i) => kinkStation === "held" && trueElements[i + 1]?.type === "kink";
	const role = (e, i) => ({
		length: i === 0 || (holdLast && i === last) || e.held || beforeKink(i) ? "held" : "free",
		...(e.type === "arc" ? { curvature: e.held ? "held" : "free" } : {}),
	});
	// The length perturbation sums to zero over the free lengths, so the start
	// is as long as the truth and its end does not wander off by the share of
	// the whole. Independent ±3 % per element had left a 110-element start
	// 111 m short, and the margin that kept the points off the missing end
	// put whole elements out of every point's sight: five exact zero
	// eigenvalues of J'J on 64 elements, a valley the solver could not leave.
	const jitter = noise(loaded.name);
	const draws = trueElements.map((e, i) => ({ role: role(e, i), length: jitter(), curvature: e.type === "arc" ? jitter() : 0 }));
	const freeLengths = draws.filter((d) => d.role.length === "free");
	const meanDraw = freeLengths.reduce((sum, d) => sum + d.length, 0) / Math.max(1, freeLengths.length);
	// centred, and rescaled so the largest shift is still `perturbation`
	const widest = Math.max(1, ...freeLengths.map((d) => Math.abs(d.length - meanDraw)));
	const startValues = trueElements.map((e, i) => {
		const { role: r, length: drawL, curvature: drawK } = draws[i];
		const values = { length: r.length === "free" ? Math.max(elementFloor, e.length * (1 + perturbation * ((drawL - meanDraw) / widest))) : e.length };
		if (e.type === "arc") values.curvature = r.curvature === "free" ? e.curvature * (1 + perturbation * drawK) : e.curvature;
		return values;
	});
	if (!trueElements.some((e) => e.type === "arc" && !e.held)) {
		// three straights meeting an end pose have nothing to bend; the file is a
		// track record, not a design problem
		throw new Error(`${loaded.name}: no free curvature, the alignment is straights only`);
	}
	const codec = createAlignmentVariableCodec({
		elements: trueElements.map((e, i) => ({ id: e.id, quantities: role(e, i), values: startValues[i] })),
	});

	// Points along the truth, disturbed laterally. Two things scale with the
	// file. The cap of 60 was the projection's cost, and on 41 elements it left
	// 60 points against 46 unknowns: a fit below the noise floor that walked a
	// flat valley for a thousand iterations. Three points an element at least.
	// The points keep clear of the ends only as far as the start's end misses
	// the truth's: the length perturbation sums to zero, so that miss is the
	// curvatures' alone, and an element every point can see is one the fit
	// can determine.
	const maxPoints = Math.max(60, 3 * trueElements.length);
	// The start's end still wanders with the curvature perturbation - 13 m
	// short on 11 km - and a point beyond the start's end has no foot on it.
	// Only the longitudinal part of the miss matters: how far the truth's end
	// lies ahead of the start's, along the start's end tangent. The margin
	// covers one and a half times that, and never less than half a spacing.
	const startEnd = chainOf(trueElements.map((e, i) => ({ ...e, ...startValues[i] }))).endPose;
	const shortBy = (truthChain.endPose.x - startEnd.x) * Math.cos(startEnd.theta) + (truthChain.endPose.y - startEnd.y) * Math.sin(startEnd.theta);
	const margin = Math.min(0.25 * truth.arcLength, Math.max(0.5 * pointSpacing, 1.5 * shortBy));
	const span = truth.arcLength - 2 * margin;
	const pointCount = Math.max(6, Math.min(maxPoints, Math.round(span / pointSpacing)));
	const pointJitter = noise(loaded.name + ":points");
	const points = [];
	for (let i = 0; i < pointCount; i++) {
		const s = margin + (span * (i + 0.5)) / pointCount;
		const p = truth.poseAt(s);
		const offset = spread * pointJitter();
		points.push({ name: `M${i}`, x: p.p.x - offset * p.t.y, y: p.p.y + offset * p.t.x, tolerance });
	}

	const profile = chooseProfile(trueElements, { cantMm, sourceName: loaded.name });
	const problem = createAlignmentOptimizationProblem({
		codec,
		constraints: createAlignmentConstraintBuilder({
			endPose,
			elementSequence: codec.elementSequence,
			minimumElementLength: elementFloor,
			hardPoints: [],
			elementKinds: Object.fromEntries(trueElements.map((e) => [e.id, e.type])),
			design: profile.design,
			rampLengthAs,
		}),
		residuals: createAlignmentResidualBuilder({ metricContext: createIntrinsicMetricContext(), points }),
	});

	const materialise = (overlay) => trueElements.map((e, i) => {
		const patch = overlay?.[e.id] ?? {};
		return {
			...e,
			length: Number.isFinite(patch.length) ? patch.length : startValues[i].length,
			...(e.type === "arc" ? { curvature: Number.isFinite(patch.curvature) ? patch.curvature : startValues[i].curvature } : {}),
		};
	});
	// The projection was the solve's cost, not the solver: world2Track scans the
	// whole alignment (400 samples, 40 refinements, 8 ms a point on 8.5 km) and
	// the kernel projects every point at every evaluation. Measured on 41
	// elements, 84 % of a 449 s run was in that scan. A point's foot moves
	// little between evaluations, so it is found again by Newton on the
	// longitudinal offset from where it was last time, on the same production
	// geometry; the full scan remains for the first time and for any foot that
	// leaves its window or an end.
	const feet = createFootMemory({ samples: 400, refineSteps: 40, ...(process.env.STALE ? { staleDistance: Number(process.env.STALE) } : {}) });
	const buildAlignment = (overlay) => {
		const elements = materialise(overlay);
		const alignment = buildProductionAlignment({ elements, startPose, deps });
		return {
			lengths: elements.map((e) => e.length),
			endPose: poseOf(alignment, alignment.arcLength),
			worldToTrack: (x, y) => feet.project(alignment, x, y),
		};
	};
	const analyticJacobian = (overlay) => chainOf(materialise(overlay));

	return Object.freeze({
		name: loaded.name,
		problem, codec, points, endPose, startPose,
		buildAlignment, analyticJacobian, materialise,
		truth: Object.freeze({ elements: trueElements, arcLength: truth.arcLength, endPose: truthChain.endPose, values: trueElements.map((e) => ({ length: e.length, ...(e.type === "arc" ? { curvature: e.curvature } : {}) })) }),
		profile: Object.freeze({ speedKmh: profile.speedKmh, exceptionCount: profile.exceptionCount, inheritedRadii: profile.inheritedRadii, inheritedLengths: profile.inheritedLengths }),
		ids,
		elementFloor,
		equalityCount: 3,
		freeCount: codec.freeCount,
		pointCount, pointMargin: margin,
	});
}

/** how far a candidate sits from the truth, per free quantity, relative */
export function distanceToTruth(scenario, variables) {
	const overlay = scenario.codec.decode(variables);
	let worst = 0;
	for (const [i, e] of scenario.truth.elements.entries()) {
		const patch = overlay[e.id]; if (!patch) continue;
		if (Number.isFinite(patch.length) && e.length > 0) worst = Math.max(worst, Math.abs(patch.length - e.length) / Math.max(e.length, 1));
		if (Number.isFinite(patch.curvature) && e.curvature) worst = Math.max(worst, Math.abs(patch.curvature - e.curvature) / Math.abs(e.curvature));
	}
	return worst;
}
