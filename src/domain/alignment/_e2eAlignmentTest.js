// src/domain/alignment/_e2eAlignmentTest.js

import { makeAlignment2DFromSparse } from "./build/AlignmentFactory.js";

import transitionLookup from "@transition/transitionLookup.json" with { type: "json" };

import { KappaFcnBuilder } from "@transition/build/KappaFcnBuilder.js";
import { RegistryResolver } from "@transition/registry/RegistryResolver.js";

import { Alignment2D } from "./Alignment2D.js";
import { FixedElement } from "./elements/FixedElement.js";

import { buildChangeTransitionTypeProblem } from "../optimization/alignment/buildChangeTransitionTypeProblem.js";
import { solveEqualityQP } from "../../lib/math/optim/qp/solveEqualityQP.js";

const defs = transitionLookup;

const descriptorResolver = new RegistryResolver(defs);
const kappaBuilder = KappaFcnBuilder;

const compatPreset = (presetId, opts = {}) =>
	KappaFcnBuilder.buildPresetFromDefs(defs, presetId, opts);

function assert(cond, msg) {
	if (!cond) throw new Error("E2E FAIL: " + msg);
}

function approx(a, b, eps = 1e-6) {
	return Math.abs(a - b) <= eps;
}

function finite(x) {
	return Number.isFinite(x);
}

function vecLen(v) {
	return Math.hypot(v.x, v.y);
}

function pointOfPose(pose) {
	return pose?.p ?? null;
}

function tangentOfPose(pose) {
	return pose?.t ?? null;
}

function runDescriptorAndPresetChecks() {
	const desc = descriptorResolver.resolveTransitionDescriptor("clothoid");
	console.log("DESC clothoid", desc);

	assert(desc && desc.id === "clothoid", "descriptorResolver failed for clothoid");

	const presetNew = kappaBuilder.buildPresetFromDescriptor(desc);

	console.log("PRESET NEW", {
		cuts01: presetNew?.cuts01,
		hasKappa: typeof presetNew?.kappa,
		hasKappaInt: typeof presetNew?.kappaInt,
		k0: (() => { try { return presetNew?.kappa?.(0); } catch (e) { return `ERR:${e.message}`; } })(),
		k05: (() => { try { return presetNew?.kappa?.(0.5); } catch (e) { return `ERR:${e.message}`; } })(),
		k1: (() => { try { return presetNew?.kappa?.(1); } catch (e) { return `ERR:${e.message}`; } })(),
	});

	assert(!!presetNew, "presetNew missing");
	assert(!!presetNew.cuts01, "presetNew missing cuts01");
	assert(typeof presetNew.kappa === "function", "presetNew.kappa missing");
	assert(typeof presetNew.kappaInt === "function", "presetNew.kappaInt missing");

	assert(finite(presetNew.kappa(0)), "presetNew.kappa(0) is NaN");
	assert(finite(presetNew.kappa(0.5)), "presetNew.kappa(0.5) is NaN");
	assert(finite(presetNew.kappa(1)), "presetNew.kappa(1) is NaN");

	assert(typeof compatPreset === "function", "compatPreset missing");
}

function runMainAlignmentChecks() {
	const sparse = [
		{ type: "fixed",      id: "F0", arcLength: 80,  curvature: 0.0 },
		{ type: "transition", id: "T1", arcLength: 60,  transType: "clothoid" },
		{ type: "fixed",      id: "F2", arcLength: 120, curvature: 1 / 300.0 },
	];

	const startPose = {
		p: { x: 0, y: 0 },
		t: { x: 1, y: 0 },
	};

	const { alignment, warnings } = makeAlignment2DFromSparse({
		startPose,
		sparse,
		descriptorResolver,
		kappaBuilder,
	});

	assert(warnings.length === 0, "Factory warnings not allowed in E2E");

	const L = alignment.arcLength;
	assert(finite(L) && L > 0, "alignment arcLength invalid");

	const S0 = 0;
	const S1 = 80;
	const S2 = 80 + 60;
	const S3 = L;

	const probes = [
		S0,
		1,
		S1 - 1e-6, S1, S1 + 1e-6,
		S2 - 1e-6, S2, S2 + 1e-6,
		S3 - 1e-6, S3,
	];

	let prev = null;

	for (const s of probes) {
		const pose = alignment.poseAt(s, { quality: "balanced" });
		const p = pointOfPose(pose);
		const t = tangentOfPose(pose);
		const k = alignment.curvatureAt(s);

		assert(!!p && finite(p.x) && finite(p.y), `poseAt -> point NaN at s=${s}`);
		assert(!!t && finite(t.x) && finite(t.y), `poseAt -> tangent NaN at s=${s}`);
		assert(finite(k), `curvatureAt NaN at s=${s}`);

		const lt = vecLen(t);
		assert(approx(lt, 1, 1e-4), `tangent not unit at s=${s} (len=${lt})`);

		if (prev) {
			const ds = Math.abs(s - prev.s);
			const dx = p.x - prev.p.x;
			const dy = p.y - prev.p.y;
			const d = Math.hypot(dx, dy);

			assert(d <= ds + 1e-3, `position jump too large near s=${s} (d=${d}, ds=${ds})`);
		}

		prev = { s, p, t, k };
	}

	const p1m = alignment.pointAt(S1 - 1e-6, { quality: "balanced" });
	const p1p = alignment.pointAt(S1 + 1e-6, { quality: "balanced" });
	assert(Math.hypot(p1p.x - p1m.x, p1p.y - p1m.y) < 1e-3, "pos discontinuity at S1");

	const p2m = alignment.pointAt(S2 - 1e-6, { quality: "balanced" });
	const p2p = alignment.pointAt(S2 + 1e-6, { quality: "balanced" });
	assert(Math.hypot(p2p.x - p2m.x, p2p.y - p2m.y) < 1e-3, "pos discontinuity at S2");

	const kStartTrans = alignment.curvatureAt(S1 + 1e-3);
	const kEndTrans   = alignment.curvatureAt(S2 - 1e-3);

	assert(Math.abs(kStartTrans - 0.0) < 1e-2, "transition kappaA not ~ 0");
	assert(Math.abs(kEndTrans - (1 / 300.0)) < 1e-2, "transition kappaB not ~ 1/300");

	const poseEnd = alignment.poseAt(L, { quality: "exact" });
	assert(!!poseEnd?.p && !!poseEnd?.t, "end pose missing p/t");
	assert(finite(poseEnd.p.x) && finite(poseEnd.p.y), "end pose point invalid");
	assert(approx(vecLen(poseEnd.t), 1, 1e-4), "end pose tangent not unit");

	return alignment;
}

function runWorld2TrackStraightChecks() {
	const straight = new Alignment2D(
		[
			new FixedElement({ arcLength: 100, curvature: 0 }),
		],
		{ p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }
	);

	const hit = straight.world2Track(20, 5);

	assert(!!hit, "world2Track straight returned null");
	assert(Math.abs(hit.s - 20) < 1e-2, `straight s wrong (${hit.s})`);
	assert(Math.abs(hit.q - 5) < 1e-2, `straight q wrong (${hit.q})`);

	for (let s = 0; s <= straight.arcLength; s += 10) {
		const p = straight.pointAt(s);
		const back = straight.world2Track(p.x, p.y);

		assert(!!back, `world2Track straight back-projection null at s=${s}`);
		assert(Math.abs(back.s - s) < 1e-2, `straight back s wrong at s=${s} (got ${back.s})`);
		assert(Math.abs(back.q) < 1e-2, `straight back q wrong at s=${s} (got ${back.q})`);
	}
}

function runWorld2TrackMainAlignmentChecks(alignment) {
	const sampleStations = [0, 10, 40, 79, 81, 95, 120, 139, 141, alignment.arcLength - 1];

	for (const s of sampleStations) {
		const p = alignment.pointAt(s, { quality: "balanced" });
		const hit = alignment.world2Track(p.x, p.y, {
			samples: 96,
			refineSteps: 16,
		});

		assert(!!hit, `world2Track returned null at s=${s}`);
		assert(Math.abs(hit.s - s) < 5e-2, `world2Track s mismatch at s=${s} (got ${hit.s})`);
		assert(Math.abs(hit.q) < 5e-2, `world2Track q mismatch at s=${s} (got ${hit.q})`);
	}

	const s0 = 95;
	const pose = alignment.poseAt(s0, { quality: "balanced" });
	const n = { x: -pose.t.y, y: pose.t.x };
	const x = pose.p.x + 3 * n.x;
	const y = pose.p.y + 3 * n.y;

	const hit = alignment.world2Track(x, y, {
		samples: 96,
		refineSteps: 16,
	});

	assert(!!hit, "world2Track offset hit is null");
	assert(Math.abs(hit.s - s0) < 1e-1, `world2Track offset s mismatch (got ${hit.s}, want ${s0})`);
	assert(Math.abs(hit.q - 3) < 1e-1, `world2Track offset q mismatch (got ${hit.q})`);
}

function runChangeTransitionTypeProblemChecks() {
	const poseA = {
		p: { x: 0, y: 0 },
		theta: 0,
	};

	const initial = {
		Lg: 80,
		Lu: 60,
		Lb: 120,
	};

	const kB = 1 / 300;

	const oracle = buildChangeTransitionTypeProblem({
		poseA,
		poseE: { p: { x: 0, y: 0 }, theta: 0 },
		initial,
		kB,
		minLengths: { Lg: 0.001, Lu: 0.001, Lb: 0.001 },
	});

	const ev0 = oracle.evaluate([initial.Lg, initial.Lu, initial.Lb]);
	const poseE = ev0.endPose;

	const problem = buildChangeTransitionTypeProblem({
		poseA,
		poseE,
		initial,
		kB,
		minLengths: { Lg: 0.001, Lu: 0.001, Lb: 0.001 },
	});

	const snap = problem.snapshot();

	console.log("CHANGE TRANSITION TYPE SNAPSHOT", {
		names: snap.names,
		v: snap.v,
		F: snap.F,
		G: snap.G,
		H: snap.H,
		JG: snap.JG,
		JH: snap.JH,
		Q: snap.Q,
		endPose: snap.evaluation?.endPose,
	});

	assert(Array.isArray(snap.names) && snap.names.length === 3, "changeTransition names invalid");
	assert(Array.isArray(snap.v) && snap.v.length === 3, "changeTransition v invalid");

	assert(finite(snap.F) && snap.F > 0, "changeTransition F invalid");

	assert(Array.isArray(snap.G) && snap.G.length === 3, "changeTransition G invalid");
	assert(Array.isArray(snap.H) && snap.H.length === 3, "changeTransition H invalid");

	for (const g of snap.G) {
		assert(finite(g), "changeTransition G contains NaN");
	}

	for (const h of snap.H) {
		assert(finite(h), "changeTransition H contains NaN");
		assert(h <= 0, `changeTransition H violated (${h})`);
	}

	assert(Math.hypot(snap.G[0], snap.G[1]) < 1e-6, "changeTransition position closure not zero");
	assert(Math.abs(snap.G[2]) < 1e-6, "changeTransition angle closure not zero");

	assert(Array.isArray(snap.JG) && snap.JG.length === 3, "changeTransition JG row count invalid");
	assert(Array.isArray(snap.JH) && snap.JH.length === 3, "changeTransition JH row count invalid");
	assert(Array.isArray(snap.Q) && snap.Q.length === 3, "changeTransition Q row count invalid");

	for (const row of snap.JG) {
		assert(Array.isArray(row) && row.length === 3, "changeTransition JG col count invalid");
		for (const x of row) assert(finite(x), "changeTransition JG contains NaN");
	}

	for (const row of snap.JH) {
		assert(Array.isArray(row) && row.length === 3, "changeTransition JH col count invalid");
		for (const x of row) assert(finite(x), "changeTransition JH contains NaN");
	}

	for (const row of snap.Q) {
		assert(Array.isArray(row) && row.length === 3, "changeTransition Q col count invalid");
		for (const x of row) assert(finite(x), "changeTransition Q contains NaN");
	}

	assert(Math.abs(snap.JG[2][0]) < 1e-12, "JG theta/Lg should be 0");
	assert(Math.abs(snap.JG[2][1] - kB) < 1e-12, "JG theta/Lu should be kB");
	assert(Math.abs(snap.JG[2][2] - kB) < 1e-12, "JG theta/Lb should be kB");

	const qp = solveEqualityQP({
		Q: snap.Q,
		c: snap.gradF,
		A: snap.JG,
		b: snap.G,
	});

	console.log("CHANGE TRANSITION TYPE QP STEP", qp);

	assert(qp.ok, `equality QP failed: ${qp.reason ?? qp.status}`);
	assert(Array.isArray(qp.d) && qp.d.length === 3, "QP d invalid");
	assert(Array.isArray(qp.lambda) && qp.lambda.length === 3, "QP lambda invalid");

	for (const x of qp.d) assert(finite(x), "QP d contains NaN");
	for (const x of qp.lambda) assert(finite(x), "QP lambda contains NaN");
}

function run() {
	console.log("E2E AlignmentBuilder test starting…");

	runDescriptorAndPresetChecks();
	const alignment = runMainAlignmentChecks();

	runWorld2TrackStraightChecks();
	runWorld2TrackMainAlignmentChecks(alignment);

	runChangeTransitionTypeProblemChecks();

	console.log("✅ E2E AlignmentBuilder test PASSED");
}

try {
	run();
} catch (e) {
	console.error(e);
}
