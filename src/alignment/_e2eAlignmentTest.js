// src/alignment/_e2eAlignmentTest.js

import { makeAlignment2DFromSparse } from "./build/AlignmentFactory.js";

import transitionLookup from "@src/alignment/transition/transitionLookup.json" with { type: "json" };

import { KappaFcnBuilder } from "./transition/build/KappaFcnBuilder.js";
import { RegistryResolver } from "./transition/registry/RegistryResolver.js";

const defs = transitionLookup;

const descriptorResolver = new RegistryResolver(defs);
const kappaBuilder = KappaFcnBuilder;

// optional compat oracle
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

function run() {
	console.log("E2E AlignmentBuilder test starting…");

	// ------------------------------------------------------------
	// 1) Descriptor + preset sanity
	// ------------------------------------------------------------
	const desc = descriptorResolver.resolveTransitionDescriptor("clothoid");
	assert(desc && desc.id === "clothoid", "descriptorResolver failed for clothoid");

	const presetNew = kappaBuilder.buildPresetFromDescriptor(desc);
	const presetCompat = compatPreset("clothoid");

	assert(!!presetNew.cuts01, "presetNew missing cuts01");
	assert(!!presetCompat.cuts01, "presetCompat missing cuts01");

	assert(Math.abs(presetNew.cuts01.w1 - presetCompat.cuts01.w1) < 1e-12, "w1 mismatch");
	assert(Math.abs(presetNew.cuts01.w2 - presetCompat.cuts01.w2) < 1e-12, "w2 mismatch");

	for (let i = 0; i <= 200; i++) {
		const u = i / 200;
		const a = presetCompat.kappa(u);
		const b = presetNew.kappa(u);
		assert(finite(a) && finite(b), `NaN in preset compare at u=${u}`);
		assert(Math.abs(a - b) < 5e-6, `preset kappa mismatch at u=${u} (compat=${a}, new=${b})`);
	}

	// ------------------------------------------------------------
	// 2) Minimal sparse alignment:
	//    fixed(line) – transition(clothoid) – fixed(arc)
	// ------------------------------------------------------------
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

	// ------------------------------------------------------------
	// 3) Global arc length + boundaries
	// ------------------------------------------------------------
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

	// ------------------------------------------------------------
	// 4) Evaluate continuity / sanity
	// ------------------------------------------------------------
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

			// arc-length-parametrized curve should not move faster than ds
			assert(d <= ds + 1e-3, `position jump too large near s=${s} (d=${d}, ds=${ds})`);
		}

		prev = { s, p, t, k };
	}

	// ------------------------------------------------------------
	// 5) Boundary continuity checks
	// ------------------------------------------------------------
	const p1m = alignment.pointAt(S1 - 1e-6, { quality: "balanced" });
	const p1p = alignment.pointAt(S1 + 1e-6, { quality: "balanced" });
	assert(Math.hypot(p1p.x - p1m.x, p1p.y - p1m.y) < 1e-3, "pos discontinuity at S1");

	const p2m = alignment.pointAt(S2 - 1e-6, { quality: "balanced" });
	const p2p = alignment.pointAt(S2 + 1e-6, { quality: "balanced" });
	assert(Math.hypot(p2p.x - p2m.x, p2p.y - p2m.y) < 1e-3, "pos discontinuity at S2");

	// ------------------------------------------------------------
	// 6) Transition curvature wiring checks
	// ------------------------------------------------------------
	const kStartTrans = alignment.curvatureAt(S1 + 1e-3);
	const kEndTrans   = alignment.curvatureAt(S2 - 1e-3);

	assert(Math.abs(kStartTrans - 0.0) < 1e-2, "transition kappaA not ~ 0");
	assert(Math.abs(kEndTrans - (1 / 300.0)) < 1e-2, "transition kappaB not ~ 1/300");

	// ------------------------------------------------------------
	// 7) End pose sanity
	// ------------------------------------------------------------
	const poseEnd = alignment.poseAt(L, { quality: "exact" });
	assert(!!poseEnd?.p && !!poseEnd?.t, "end pose missing p/t");
	assert(finite(poseEnd.p.x) && finite(poseEnd.p.y), "end pose point invalid");
	assert(approx(vecLen(poseEnd.t), 1, 1e-4), "end pose tangent not unit");

	console.log("✅ E2E AlignmentBuilder test PASSED");
}

try {
	run();
} catch (e) {
	console.error(e);
}
