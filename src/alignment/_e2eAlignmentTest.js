// src/alignment/_e2eAlignmentTest.js

import { makeAlignment2DFromSparse } from "./build/AlignmentFactory.js";  // ggf. Pfad anpassen
import { RegistryCompiler } from "./transition/registry/RegistryCompiler.js"; // ggf. Pfad anpassen

import transitionLookup from "./transition/transitionLookup.json" with { type: "json" };

// import { Curve2D } from "../lib/geom/curve/Curve2D.js"

function assert(cond, msg) {
	if (!cond) throw new Error("E2E FAIL: " + msg);
}

function approx(a, b, eps = 1e-6) {
	return Math.abs(a - b) <= eps;
}

function finite(x) {
	return Number.isFinite(x);
}

function len2(v) {
	return Math.hypot(v.tx, v.ty);
}

function run() {
	console.log("E2E AlignmentBuilder test starting…");

	// 1) RegistryCompiler
	const registry = new RegistryCompiler(transitionLookup);
	
	const p = registry.compilePreset("test");
	// console.log("has cuts01?", !!p.cuts01, p.cuts01);
	// console.log("has kappa?", typeof p.kappa);

	// 2) Minimal sparse alignment: F (line) – T (clothoid) – F (arc)
	//    (Ka from first fixed, Ke from next fixed)
	const sparse = [
	{ kind: "fixed",      id: "F0", arcLength: 80,  curvature: 0.0 },
	{ kind: "transition", id: "T1", arcLength: 60,  transType: "Clothoid" },
	{ kind: "fixed",      id: "F2", arcLength: 120, curvature: 1/300.0 } 
	];
	
	const startPose = { x: 0, y: 0, theta: 0 };

	const { alignment, warnings } = makeAlignment2DFromSparse({ startPose, sparse, registry });
	
	// console.log("warnings JSON:", JSON.stringify(warnings, null, 2));
	
	assert(warnings.length === 0, "Registry/Builder warnings not allowed in E2E");
	
	// console.log("ALIGNMENT CLASS", alignment?.constructor?.name);
	// console.log("coordAt is", alignment?.coordAt);
	// console.log("coordAt owner is Curve2D?", alignment?.coordAt === Curve2D.prototype.coordAt);
	// console.log("ALIGNMENT CLASS", alignment.constructor.name);
	// console.log("ALIGNMENT proto keys", Object.getOwnPropertyNames(Object.getPrototypeOf(alignment)));

	// 3) Sample points incl. boundaries
	const L = alignment.arcLength;
	assert(finite(L) && L > 0, "alignment length invalid");

	// segment boundaries in this sparse example:
	const S0 = 0;
	const S1 = 80;
	const S2 = 80 + 60;
	const S3 = L;

	const probes = [
	S0, 1,
	S1 - 1e-6, S1, S1 + 1e-6,
	S2 - 1e-6, S2, S2 + 1e-6,
	S3 - 1e-6, S3
	];

	// 4) Evaluate continuity
	let prev = null;
	
	for (const s of probes) {
		// console.log(s);
		const p = alignment.coordAt(s);
		const t = alignment.tangentAt(s);
		const k = alignment.curvatureAt(s);

		assert(finite(p.x) && finite(p.y), `coordAt NaN at s=${s}`);
		assert(finite(t.tx) && finite(t.ty), `tangentAt NaN at s=${s}`);
		assert(finite(k), `curvatureAt NaN at s=${s}`);

		// tangent should be unit-ish
		const lt = len2(t);
		assert(approx(lt, 1, 1e-4), `tangent not unit at s=${s} (len=${lt})`);

		// no insane jumps (coarse check)
		if (prev) {
			const ds = Math.abs(s - prev.s);
			const dx = p.x - prev.p.x;
			const dy = p.y - prev.p.y;
			const d = Math.hypot(dx, dy);

			// A curve parametrized by arc length cannot move faster than 1 m per 1 m of s.
			// Allow small numerical slack.
			assert(d <= ds + 1e-3, `position jump too large near s=${s} (d=${d}, ds=${ds})`);
		}

		prev = { s, p, t, k };
	}

	// 5) Boundary-specific checks
	// Position continuity at S1 and S2 (should be extremely tight)
	const p1m = alignment.coordAt(S1 - 1e-6);
	const p1p = alignment.coordAt(S1 + 1e-6);
	assert(Math.hypot(p1p.x - p1m.x, p1p.y - p1m.y) < 1e-3, "pos discontinuity at S1");

	const p2m = alignment.coordAt(S2 - 1e-6);
	const p2p = alignment.coordAt(S2 + 1e-6);
	assert(Math.hypot(p2p.x - p2m.x, p2p.y - p2m.y) < 1e-3, "pos discontinuity at S2");

	// Curvature should start at ~0 and end near 1/300 at end of transition
	const kStartTrans = alignment.curvatureAt(S1 + 1e-3);
	const kEndTrans   = alignment.curvatureAt(S2 - 1e-3);
	assert(Math.abs(kStartTrans - 0.0) < 1e-2, "transition Ka not ca. 0");
	assert(Math.abs(kEndTrans - (1./ 300)) < 1e-2, "transition Ke not ca. 1 durch 300");
	
	// --- transition preset sanity: test ---
	{
		const p = registry.compilePreset("test");
		
		// console.debug( p );
		
		assert(Math.abs(p.cuts01.w1 - 0.25) < 1e-12, "test w1 not 0.25");
		assert(Math.abs(p.cuts01.w2 - 0.75) < 1e-12, "test w2 not 0.75");

		// midpoint anchor expectation (soft)
		const km = p.kappa(0.5);
		assert(finite(km), "test kappa(0.5) NaN");
		assert(Math.abs(km - 0.5) < 5e-2, `test kappa(0.5) not ~0.5 (got ${km})`);

		// κ(u) should be monotone nondecreasing in [0,1]
		let prev = p.kappa(0);
		for (let i = 1; i <= 200; i++) {
			const u = i / 200;
			const k = p.kappa(u);
			assert(finite(k), `test kappa NaN at u=${u}`);
			assert(k + 1e-9 >= prev, `test kappa not monotone at u=${u} (k=${k}, prev=${prev})`);
			prev = k;
		}

		// endpoints should be ~0 and ~1 (normalized)
		assert(Math.abs(p.kappa(0) - 0) < 1e-9, "test kappa(0) not ~0");
		assert(Math.abs(p.kappa(1) - 1) < 1e-9, "test kappa(1) not ~1");
	}

	console.log("✅ E2E AlignmentBuilder test PASSED");
}

try { run(); } catch (e) { console.error(e); }
