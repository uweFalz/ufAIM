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
const { createTransitionMoments, curvatureIntegralFrom } = await load("src/domain/optimization/alignment/TransitionMoments.js");
const { createAlignmentPoseJacobian } = await load("src/domain/optimization/alignment/AlignmentPoseJacobian.js");
const { createAlignmentVariableCodec } = await load("src/domain/optimization/alignment/AlignmentVariableCodec.js");
const { createAlignmentConstraintBuilder } = await load("src/domain/optimization/alignment/AlignmentConstraintBuilder.js");
const { createAlignmentResidualBuilder } = await load("src/domain/optimization/alignment/AlignmentResidualBuilder.js");
const { createAlignmentOptimizationProblem } = await load("src/domain/optimization/alignment/AlignmentOptimizationProblem.js");
const { createIntrinsicMetricContext } = await load("src/domain/optimization/alignment/MetricContext.js");
const { hauptbahn } = await load("src/domain/optimization/alignment/profiles/index.js");

export const deps = Object.freeze({ descriptorResolver: new RegistryResolver(lookup), kappaBuilder: KappaFcnBuilder });

const momentCache = new Map();
export function momentsFor(family = "clothoid") {
	if (!momentCache.has(family)) {
		const preset = KappaFcnBuilder.buildPresetFromDescriptor(deps.descriptorResolver.resolveTransitionDescriptor(family));
		const khat = curvatureIntegralFrom((u) => preset.kappa(Math.max(0, Math.min(1, u))));
		momentCache.set(family, Object.freeze({ ...createTransitionMoments({ id: family, curvatureIntegral: khat }), khat }));
	}
	return momentCache.get(family);
}

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
	return Object.freeze({
		speedKmh: chosen.speedKmh,
		design: hauptbahn({ speedKmh: chosen.speedKmh, cantMm, exceptions: Object.keys(exceptions).length ? exceptions : undefined }),
		exceptionCount: Object.keys(exceptions).length,
		inheritedRadii: chosen.tooTight.length,
		inheritedLengths: chosen.tooShort.length,
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
 */
export async function createTraScenario(source, {
	pointSpacing = 50, spread = 0.04, tolerance = 0.15, perturbation = 0.03,
	rampLengthAs = "bound", minimumElementLength = null, cantMm = 130,
	holdLast = false,
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
	const role = (e, i) => ({
		length: i === 0 || (holdLast && i === last) || e.held ? "held" : "free",
		...(e.type === "arc" ? { curvature: e.held ? "held" : "free" } : {}),
	});
	const jitter = noise(loaded.name);
	const startValues = trueElements.map((e, i) => {
		const r = role(e, i);
		const values = { length: r.length === "free" ? Math.max(elementFloor, e.length * (1 + perturbation * jitter())) : e.length };
		if (e.type === "arc") values.curvature = r.curvature === "free" ? e.curvature * (1 + perturbation * jitter()) : e.curvature;
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

	// points along the truth, disturbed laterally
	const pointCount = Math.max(6, Math.min(60, Math.round(truth.arcLength / pointSpacing)));
	const pointJitter = noise(loaded.name + ":points");
	const points = [];
	for (let i = 0; i < pointCount; i++) {
		const s = (truth.arcLength * (i + 0.5)) / pointCount;
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
	const buildAlignment = (overlay) => {
		const elements = materialise(overlay);
		const alignment = buildProductionAlignment({ elements, startPose, deps });
		return {
			lengths: elements.map((e) => e.length),
			endPose: poseOf(alignment, alignment.arcLength),
			worldToTrack: (x, y) => alignment.world2Track(x, y, { samples: 400, refineSteps: 40 }),
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
		pointCount,
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
