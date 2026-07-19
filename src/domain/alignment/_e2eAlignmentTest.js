// src/domain/alignment/_e2eAlignmentTest.js

import { makeAlignment2DFromSparse } from "./build/AlignmentFactory.js";

import transitionLookup from "@transition/transitionLookup.json" with { type: "json" };

import { KappaFcnBuilder } from "@transition/build/KappaFcnBuilder.js";
import { RegistryResolver } from "@transition/registry/RegistryResolver.js";

import { Alignment2D } from "./Alignment2D.js";
import { FixedElement } from "./elements/FixedElement.js";

import { buildChangeTransitionTypeProblem } from "../optimization/alignment/buildChangeTransitionTypeProblem.js";
import { solveEqualityQP } from "../../lib/math/optim/qp/solveEqualityQP.js";
import { solveOneEqualitySqpStep } from "../../lib/math/optim/sqp/solveOneEqualitySqpStep.js";
import { solveEqualitySqp } from "../../lib/math/optim/sqp/solveEqualitySqp.js";

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

function headingOfTangent(t) {
	return Math.atan2(t.y, t.x);
}

function wrapAngle(a) {
	let x = Number(a) || 0;
	while (x > Math.PI) x -= 2 * Math.PI;
	while (x < -Math.PI) x += 2 * Math.PI;
	return x;
}

function angleDelta(a, b) {
	return wrapAngle(a - b);
}

function integrateMidpoint01(fn, steps = 4096) {
	const n = Math.max(64, Number(steps) || 4096);
	let sum = 0;

	for (let i = 0; i < n; i++) {
		const u = (i + 0.5) / n;
		sum += Number(fn(u));
	}

	return sum / n;
}

function buildAlignmentFromSparse(sparse, startPose = { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }) {
	const built = makeAlignment2DFromSparse({
		startPose,
		sparse,
		descriptorResolver,
		kappaBuilder,
	});

	assert(Array.isArray(built.warnings), "buildAlignmentFromSparse: warnings missing");
	assert(built.warnings.length === 0, `buildAlignmentFromSparse: warnings ${JSON.stringify(built.warnings)}`);

	return built.alignment;
}

function makeBoundaryStations(sparse) {
	const boundaries = [0];
	let acc = 0;

	for (const el of sparse) {
		acc += Number(el.arcLength) || 0;
		boundaries.push(acc);
	}

	return boundaries;
}

function assertBoundaryContinuity(alignment, boundaries, epsPos = 2e-3) {
	for (const s of boundaries.slice(1, -1)) {
		const pL = alignment.pointAt(Math.max(0, s - 1e-6), { quality: "balanced" });
		const pR = alignment.pointAt(Math.min(alignment.arcLength, s + 1e-6), { quality: "balanced" });
		const d = Math.hypot(pR.x - pL.x, pR.y - pL.y);
		assert(d < epsPos, `boundary position discontinuity at s=${s}, d=${d}`);
	}
}

function integrateSparseReference({ sparse, startPose, ds = 0.05 }) {
	const trans = sparse.map((el) => ({ ...el }));

	for (let i = 0; i < trans.length; i++) {
		if (String(trans[i].type) !== "transition") continue;

		let kappaA = 0;
		let kappaB = 0;

		for (let j = i - 1; j >= 0; j--) {
			if (String(trans[j].type) === "fixed") {
				kappaA = Number(trans[j].curvature) || 0;
				break;
			}
		}

		for (let j = i + 1; j < trans.length; j++) {
			if (String(trans[j].type) === "fixed") {
				kappaB = Number(trans[j].curvature) || 0;
				break;
			}
		}

		const desc = descriptorResolver.resolveTransitionDescriptor(String(trans[i].transType || "clothoid"));
		const preset = kappaBuilder.buildPresetFromDescriptor(desc, trans[i].opts ?? {});
		trans[i].kappaA = kappaA;
		trans[i].kappaB = kappaB;
		trans[i].runtimePreset = preset;
	}

	const t0 = startPose.t;
	let x = startPose.p.x;
	let y = startPose.p.y;
	let theta = Math.atan2(t0.y, t0.x);

	let sGlobal = 0;
	for (const el of trans) {
		const L = Number(el.arcLength) || 0;
		let local = 0;

		while (local < L - 1e-12) {
			const step = Math.min(ds, L - local);
			const mid = local + step * 0.5;

			let kappa = 0;
			if (String(el.type) === "fixed") {
				kappa = Number(el.curvature) || 0;
			} else if (String(el.type) === "transition") {
				const u = L > 0 ? mid / L : 0;
				kappa = el.kappaA + (el.kappaB - el.kappaA) * el.runtimePreset.kappa(u);
			}

			theta += kappa * step;
			x += Math.cos(theta) * step;
			y += Math.sin(theta) * step;
			local += step;
			sGlobal += step;
		}
	}

	return {
		p: { x, y },
		t: { x: Math.cos(theta), y: Math.sin(theta) },
		theta,
		s: sGlobal,
	};
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
		{ type: "fixed", id: "F0", arcLength: 80, curvature: 0.0 },
		{ type: "transition", id: "T1", arcLength: 60, transType: "clothoid" },
		{ type: "fixed", id: "F2", arcLength: 120, curvature: 1 / 300.0 },
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
	const kEndTrans = alignment.curvatureAt(S2 - 1e-3);

	assert(Math.abs(kStartTrans - 0.0) < 1e-2, "transition kappaA not 0");
	assert(Math.abs(kEndTrans - (1 / 300.0)) < 1e-2, "transition kappaB not 1/300");

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
		Lg: 100,
		Lu: 50,
		Lb: 100,
	};

	const kB = 1 / 1000;

	const clothoidSparse = [
		{ type: "fixed", id: "G0", arcLength: 100, curvature: 0 },
		{ type: "transition", id: "U1", arcLength: 50, transType: "clothoid" },
		{ type: "fixed", id: "B2", arcLength: 100, curvature: kB },
	];

	const { alignment: clothoidAlignment, warnings: clothoidWarnings } =
		makeAlignment2DFromSparse({
			startPose: {
				p: { x: poseA.p.x, y: poseA.p.y },
				t: { x: 1, y: 0 },
			},
			sparse: clothoidSparse,
			descriptorResolver,
			kappaBuilder,
		});

	assert(clothoidWarnings.length === 0, "clothoid oracle warnings not allowed");

	const clothoidEnd = clothoidAlignment.poseAt(clothoidAlignment.arcLength, {
		quality: "exact",
	});

	const poseE = {
		p: {
			x: clothoidEnd.p.x,
			y: clothoidEnd.p.y,
		},
		theta: Math.atan2(clothoidEnd.t.y, clothoidEnd.t.x),
	};

	console.log("CLOTHOID ORACLE END POSE", poseE);

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
	assert(
		Math.abs(snap.JG[2][1] - (kB * 0.5)) < 5e-4,
		"JG theta/Lu should reflect normalized transition integral"
	);
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

	const sqp = solveOneEqualitySqpStep({
		problem,
		v: snap.v,
	});

	console.log("CHANGE TRANSITION TYPE SQP STEP", sqp);

	assert(sqp.ok, `SQP step failed: ${sqp.reason ?? sqp.status}`);
	assert(Array.isArray(sqp.vNext) && sqp.vNext.length === 3, "SQP vNext invalid");

	for (const x of sqp.vNext) {
		assert(finite(x), "SQP vNext contains NaN");
	}

	const solved = solveEqualitySqp({
		problem,
		v0: snap.v,
		maxIterations: 10,
		tolerance: 1e-9,
	});

	console.log("CHANGE TRANSITION TYPE SQP SOLVE", solved);

	console.log("CHANGE TRANSITION TYPE SQP HISTORY", solved.history.map((h) => ({
		iteration: h.iteration,
		status: h.status,
		gNorm: h.gNorm,
		nextGNorm: h.nextGNorm,
		merit: h.merit,
		nextMerit: h.nextMerit,
		rawStepNorm: h.rawStepNorm,
		clippedStepNorm: h.clippedStepNorm,
		stepNorm: h.stepNorm,
		stepClipped: h.stepClipped,
		trustRadius: h.trustRadius,
		radiusAction: h.radiusAction,
		trustRegionRetries: h.trustRegionRetries,
		alpha: h.alpha,
		backtracks: h.backtracks,
		rankEstimate: h.rankEstimate,
		reason: h.reason,
	})));

	assert(Array.isArray(solved.v) && solved.v.length === 3, "SQP solve v invalid");
	assert(Array.isArray(solved.history) && solved.history.length > 0, "SQP solve history missing");
	assert(finite(solved.gNorm), "SQP solve gNorm invalid");

	for (const x of solved.v) {
		assert(finite(x), "SQP solve v contains NaN");
	}
}

function runComposedAlignmentChecks() {
	const sparse = [
		{ type: "fixed", id: "A0", arcLength: 60, curvature: 0 },
		{ type: "transition", id: "A1", arcLength: 40, transType: "bloss", opts: { w1: 0.2, w2: 0.85 } },
		{ type: "fixed", id: "A2", arcLength: 90, curvature: 1 / 250 },
		{ type: "transition", id: "A3", arcLength: 35, transType: "clothoid", opts: { w1: 0.1, w2: 0.55 } },
		{ type: "fixed", id: "A4", arcLength: 70, curvature: -1 / 300 },
		{ type: "transition", id: "A5", arcLength: 30, transType: "bloss", opts: { w1: 0.75, w2: 0.9 } },
		{ type: "fixed", id: "A6", arcLength: 40, curvature: 0 },
	];

	const startPose = { p: { x: 100, y: -50 }, t: { x: 1, y: 0 } };
	const alignment = buildAlignmentFromSparse(sparse, startPose);
	const boundaries = makeBoundaryStations(sparse);

	assertBoundaryContinuity(alignment, boundaries, 2e-3);

	const sInPosArc = boundaries[2] + 45;
	const sInNegArc = boundaries[4] + 35;
	const kPos = alignment.curvatureAt(sInPosArc);
	const kNeg = alignment.curvatureAt(sInNegArc);

	assert(kPos > 0, `positive arc curvature expected >0, got ${kPos}`);
	assert(kNeg < 0, `negative arc curvature expected <0, got ${kNeg}`);

	const ds = 0.5;
	const posePos = alignment.poseAt(sInPosArc, { quality: "balanced" });
	const posePosNext = alignment.poseAt(sInPosArc + ds, { quality: "balanced" });
	const chordPos = {
		x: posePosNext.p.x - posePos.p.x,
		y: posePosNext.p.y - posePos.p.y,
	};
	const crossPos = posePos.t.x * chordPos.y - posePos.t.y * chordPos.x;
	assert(crossPos > 0, `positive curvature should turn left (cross>0), got ${crossPos}`);

	const poseNeg = alignment.poseAt(sInNegArc, { quality: "balanced" });
	const poseNegNext = alignment.poseAt(sInNegArc + ds, { quality: "balanced" });
	const chordNeg = {
		x: poseNegNext.p.x - poseNeg.p.x,
		y: poseNegNext.p.y - poseNeg.p.y,
	};
	const crossNeg = poseNeg.t.x * chordNeg.y - poseNeg.t.y * chordNeg.x;
	assert(crossNeg < 0, `negative curvature should turn right (cross<0), got ${crossNeg}`);

	const poseEnd = alignment.poseAt(alignment.arcLength, { quality: "exact" });
	const ref = integrateSparseReference({ sparse, startPose, ds: 0.05 });

	const dEnd = Math.hypot(poseEnd.p.x - ref.p.x, poseEnd.p.y - ref.p.y);
	const dHeading = Math.abs(angleDelta(headingOfTangent(poseEnd.t), ref.theta));

	assert(dEnd < 0.3, `composed final position mismatch vs independent reference: ${dEnd}`);
	assert(dHeading < 3e-3, `composed final heading mismatch vs independent reference: ${dHeading}`);

	const kBeforeA2 = alignment.curvatureAt(boundaries[2] - 1e-3);
	const kAfterA2 = alignment.curvatureAt(boundaries[2] + 1e-3);
	assert(Math.abs(kBeforeA2 - (1 / 250)) < 1e-2, `transition->arc positive boundary mismatch before: ${kBeforeA2}`);
	assert(Math.abs(kAfterA2 - (1 / 250)) < 1e-6, `transition->arc positive boundary mismatch after: ${kAfterA2}`);

	const kBeforeA4 = alignment.curvatureAt(boundaries[4] - 1e-3);
	const kAfterA4 = alignment.curvatureAt(boundaries[4] + 1e-3);
	assert(Math.abs(kBeforeA4 - (-1 / 300)) < 1e-2, `transition->arc negative boundary mismatch before: ${kBeforeA4}`);
	assert(Math.abs(kAfterA4 - (-1 / 300)) < 1e-6, `transition->arc negative boundary mismatch after: ${kAfterA4}`);

	return { alignment, sparse, boundaries, startPose };
}

function runAsymmetricTransitionPartitionChecks() {
	const desc = descriptorResolver.resolveTransitionDescriptor("bloss");
	const presetDefault = kappaBuilder.buildPresetFromDescriptor(desc);
	const presetAsym = kappaBuilder.buildPresetFromDescriptor(desc, { w1: 0.2, w2: 0.85 });

	assert(Math.abs(presetAsym.cuts01.w1 - 0.2) < 1e-12, "asymmetric preset w1 mismatch");
	assert(Math.abs(presetAsym.cuts01.w2 - 0.85) < 1e-12, "asymmetric preset w2 mismatch");

	const midDefault = presetDefault.kappa(0.5);
	const midAsym = presetAsym.kappa(0.5);
	assert(Math.abs(midAsym - midDefault) > 1e-3, "asymmetric split should alter mid curvature profile");

	const intDefault = integrateMidpoint01((u) => presetDefault.kappa(u), 8192);
	const intAsym = integrateMidpoint01((u) => presetAsym.kappa(u), 8192);

	assert(Math.abs(intDefault - 0.5) < 5e-4, `default normalized integral should be ~0.5, got ${intDefault}`);
	assert(finite(intAsym), `asymmetric integral should be finite, got ${intAsym}`);
	assert(Math.abs(intAsym - intDefault) > 1e-3, `asymmetric integral should differ from default, got default=${intDefault}, asym=${intAsym}`);
}

function runWorld2TrackComposedRoundtripChecks(alignment, boundaries) {
	const stationSamples = [
		0,
		boundaries[1],
		boundaries[1] - 1e-4,
		boundaries[1] + 1e-4,
		boundaries[3],
		boundaries[5],
		alignment.arcLength - 1e-4,
		alignment.arcLength,
	];

	const lateralOffsets = [-4, -1.25, 0, 2.5, 5];
	const sTol = 0.2;
	const qTol = 0.15;

	for (const s of stationSamples) {
		const pose = alignment.poseAt(s, { quality: "balanced" });
		const n = { x: -pose.t.y, y: pose.t.x };

		for (const q of lateralOffsets) {
			const x = pose.p.x + q * n.x;
			const y = pose.p.y + q * n.y;

			const hit = alignment.world2Track(x, y, {
				samples: 160,
				refineSteps: 24,
			});

			assert(!!hit, `composed world2Track returned null for s=${s}, q=${q}`);
			assert(Math.abs(hit.s - s) < sTol, `world2Track station mismatch for s=${s}, q=${q}, got ${hit.s}`);
			assert(Math.abs(hit.q - q) < qTol, `world2Track lateral mismatch for s=${s}, q=${q}, got ${hit.q}`);
		}
	}
}

function runOptimizationJacobianConsistencyChecks() {
	const poseA = { p: { x: 0, y: 0 }, theta: 0 };
	const poseE = { p: { x: 180, y: 12 }, theta: 0.21 };
	const kB = 1 / 450;

	const problem = buildChangeTransitionTypeProblem({
		poseA,
		poseE,
		initial: { Lg: 90, Lu: 55, Lb: 110 },
		kB,
		transitionType: "bloss",
		minLengths: { Lg: 0.1, Lu: 0.1, Lb: 0.1 },
	});

	const snap = problem.snapshot();
	const h = 1e-5;

	for (let j = 0; j < 3; j++) {
		const vp = [...snap.v];
		const vm = [...snap.v];
		vp[j] += h;
		vm[j] -= h;

		const gp = problem.G(vp);
		const gm = problem.G(vm);

		for (let i = 0; i < 3; i++) {
			const fd = (gp[i] - gm[i]) / (2 * h);
			const jac = snap.JG[i][j];
			const err = Math.abs(fd - jac);

			const tol = i < 2 ? 3e-2 : 5e-3;
			assert(err < tol, `JG finite-difference mismatch at row=${i}, col=${j}: fd=${fd}, jac=${jac}, err=${err}`);
		}
	}

	let thrown = false;
	try {
		buildChangeTransitionTypeProblem({
			poseA,
			poseE,
			initial: { Lg: 1, Lu: 1, Lb: 1 },
			kB,
			transitionType: "unknown_heritage_transition",
		});
	} catch {
		thrown = true;
	}
	assert(thrown, "unknown transition type should be rejected deterministically");
}

function run() {
	console.log("E2E AlignmentBuilder test starting…");

	runDescriptorAndPresetChecks();
	const alignment = runMainAlignmentChecks();

	runWorld2TrackStraightChecks();
	runWorld2TrackMainAlignmentChecks(alignment);

	const composed = runComposedAlignmentChecks();
	runAsymmetricTransitionPartitionChecks();
	runWorld2TrackComposedRoundtripChecks(composed.alignment, composed.boundaries);

	runChangeTransitionTypeProblemChecks();
	runOptimizationJacobianConsistencyChecks();

	console.log("✅ E2E AlignmentBuilder test PASSED");
}

try {
	run();
	if (typeof window !== "undefined") {
		window.__axtranAlignmentE2E = {
			passed: true,
			ts: Date.now(),
		};
	}
} catch (e) {
	if (typeof window !== "undefined") {
		window.__axtranAlignmentE2E = {
			passed: false,
			error: String(e?.message ?? e),
			ts: Date.now(),
		};
	}
	console.error(e);
}
