// src/alignment/registry/RegistryCompiler.js

import lookup from "../transitionLookup.json" with { type: "json" };

import { buildProtoAst } from "./ast/buildProtoAst.js";
import { makeEvalFn } from "./ast/evalAst.js";
import { diffExpr } from "./ast/symDiff.js";
import { intExpr } from "./ast/symInt.js";
import { simplify } from "./ast/simplify.js";

import { computeAnchorsFromTotal } from "./compose/computeAnchorsFromTotal.js";

function clamp01(u) { return Math.max(0, Math.min(1, u)); }

function normFamilyFromProto({ protoId, protoDef, simpleFcn }) {
	// Build raw kappa expr over u, respecting proto domain and ref-level crops (via buildProtoAst)
	const kRawExpr = simplify(buildProtoAst(protoDef.tree, simpleFcn));
	const kRawFn = makeEvalFn(kRawExpr);

	// kappa1/kappa2 exact
	const k1RawExpr = simplify(diffExpr(kRawExpr));
	const k2RawExpr = simplify(diffExpr(k1RawExpr));
	const k1RawFn = makeEvalFn(k1RawExpr);
	const k2RawFn = makeEvalFn(k2RawExpr);

	// kappaInt exact (poly+trig+affine)
	const kIntRawExpr = simplify(intExpr(kRawExpr));
	const kIntRawFn = makeEvalFn(kIntRawExpr);

	// --- normalizeRangeEndpoint (central!) ---
	const k0 = kRawFn(0);
	const k1 = kRawFn(1);
	const denom = (k1 - k0);

	if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) {
		// constant proto: treat as valid "zero family" if k(u) == 0 on [0,1]
		const k00 = kRawFn(0);
		const k05 = kRawFn(0.5);
		const k11 = kRawFn(1);

		const isConst =
		Number.isFinite(k00) && Number.isFinite(k05) && Number.isFinite(k11) &&
		Math.abs(k05 - k00) < 1e-12 && Math.abs(k11 - k00) < 1e-12;

		const isZero = isConst && Math.abs(k00) < 1e-12;

		if (isZero) {
			return {
				kappa:    (u) => 0,
				kappa1:   (u) => 0,
				kappa2:   (u) => 0,
				kappaInt: (u) => 0,
				meta: { protoId, range: { k0: 0, k1: 0, denom: 0 }, degenerate: "zero" }
			};
		}

		// If you ever want: allow nonzero constants too (rare). For now: keep strict.
		throw new Error(`RegistryCompiler: degenerate range for proto "${protoId}"`);
	}

	const kFn  = (u) => (kRawFn(clamp01(u)) - k0) / denom;
	const k1Fn = (u) => k1RawFn(clamp01(u)) / denom;
	const k2Fn = (u) => k2RawFn(clamp01(u)) / denom;

	// integral: ∫((kRaw-k0)/denom) du = (kIntRaw - k0*u)/denom
	const kIntFn = (u) => ( (kIntRawFn(clamp01(u)) - kIntRawFn(0)) - k0 * clamp01(u) ) / denom;

	return {
		kappa: kFn,
		kappa1: k1Fn,
		kappa2: k2Fn,
		kappaInt: (u) => kIntFn(u) - kIntFn(0),
		meta: { protoId, range: { k0, k1, denom } }
	};
}

//
// ...
// 
export class RegistryCompiler {
	constructor(db = lookup) {
		this.db = db;
		this._cache = new Map(); // key: transitionId -> compiled package
	}

	compileTransType(transType, opts = {}) {
		const id = String(transType);
		const key = id.toLowerCase();
		
		const db = this.db;          // ✅ capture once

		// cache (1 statt 57 Bloss)
		const cacheKey = `T:${key}`;
		if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

		const tr = db.transition?.[key];
		if (!tr) throw new Error(`RegistryCompiler: unknown transition "${key}"`);

		// resolve halfWave1/halfWave2 (minimal v2)
		const hw1Id = tr.halfWave1;
		const hw2Id = tr.halfWave2;

		if (!hw1Id || !hw2Id) {
			throw new Error(`RegistryCompiler: transition "${key}" missing halfWave`);
		}

		// compile hw1/hw2 families (each from its halfWave.proto)
		function compileHalfWave(halfWaveIdLocal, reverseFlag) {
			const hwDef = db.halfWave?.[halfWaveIdLocal];
			if (!hwDef) throw new Error(`RegistryCompiler: missing halfWave "${halfWaveIdLocal}"`);
			const protoId = hwDef.proto;
			const protoDef = db.protoFcn?.[protoId];
			if (!protoDef) throw new Error(`RegistryCompiler: missing protoFcn "${protoId}"`);

			const fam = normFamilyFromProto({ protoId, protoDef, simpleFcn: db.simpleFcn });

			if (!reverseFlag) return fam;

			const uu = (u) => clamp01(u);

			// κ2(u) = 1 - κ(1-u)
			const kappa = (u) => 1 - fam.kappa(1 - uu(u));

			// κ2'(u) = κ'(1-u)
			const kappa1 = (u) => fam.kappa1(1 - uu(u));

			// κ2''(u) = -κ''(1-u)
			const kappa2 = (u) => -fam.kappa2(1 - uu(u));

			// I2(u) = ∫0^u κ2(t) dt = u - I(1) + I(1-u)
			const kappaInt = (u) => {
				const u0 = uu(u);
				const I = fam.kappaInt;
				return u0 - I(1) + I(1 - u0);
			};

			return {
				kappa,
				kappa1,
				kappa2,
				kappaInt,
				meta: { ...fam.meta, asymReversed: true }
			};
		}
		
		const hw1 = compileHalfWave(hw1Id, false);
		const hw2 = compileHalfWave(hw2Id, true); // hw2 internal asym-reverse

		// --- core is ALWAYS clothoCore (minimal v2) ---
		const coreProto = db.protoFcn?.clothoCore;
		if (!coreProto) throw new Error('RegistryCompiler: protoFcn.clothoCore missing');

		const core = normFamilyFromProto({
			protoId: "clothoCore",
			protoDef: coreProto,
			simpleFcn: db.simpleFcn
		});

		// partition + anchors
		const normLengthPartition = tr.normLengthPartition ?? [0, 1, 0];

		// anchors ALWAYS computed (must handle lc==0 etc.)
		const normCrvAnchor = computeAnchorsFromTotal([hw1, core, hw2], normLengthPartition);

		const out = {
			id: key,
			normLengthPartition,
			normCrvAnchor,
			kappaFamilies: [hw1, core, hw2]
		};

		this._cache.set(cacheKey, out);
		return out;
	}
	
	// ------------------------------------------------------------
	// Compat for TransitionEditorView (Option 1)
	// ------------------------------------------------------------
	compilePreset(presetId, opts = {}) {
		const pkg = this.compileTransType(presetId, { samples: false, ...opts });

		const lambdas = pkg.normLengthPartition;   // [l1, lc, l2]
		const shapes  = pkg.kappaFamilies;         // [hw1, clo, hw2]
		const a = pkg.normCrvAnchor ?? [0, 0, 1, 1];
		const [a0, a1, a2, a3] = a;

		const l1 = lambdas[0], lc = lambdas[1], l2 = lambdas[2];
		const w1 = l1;
		const w2 = l1 + lc;

		function segK(u, L, A, B, shape) {
			// κ = A + (B-A)*k(local)
			if (L <= 1e-12) return null;
			const local = clamp01(u / L);
			return A + (B - A) * shape.kappa(local);
		}

		function segK1(u, L, A, B, shape) {
			// d/du κ = (B-A) * k1(local) * (1/L)
			if (L <= 1e-12) return null;
			const local = clamp01(u / L);
			return (B - A) * shape.kappa1(local) / L;
		}

		function segK2(u, L, A, B, shape) {
			// d²/du² κ = (B-A) * k2(local) * (1/L²)
			if (L <= 1e-12) return null;
			const local = clamp01(u / L);
			return (B - A) * shape.kappa2(local) / (L * L);
		}

		function segInt(u, L, A, B, shape) {
			// ∫ κ du over segment length u∈[0..L]:
			// ∫ (A + (B-A)*k(local)) du
			// = A*u + (B-A)*L*I(local)
			if (L <= 1e-12) return 0;
			const uu = clamp01(u);
			const local = clamp01(uu / L);
			return A * uu + (B - A) * L * shape.kappaInt(local);
		}

		// κ itself is continuous and already normalized by your compiler design
		const kappa = (u) => {
			const uu = clamp01(Number(u));
			if (!Number.isFinite(uu)) return NaN;

			if (uu <= w1) return segK(uu, l1, a0, a1, shapes[0]);
			if (uu <= w2) return segK(uu - w1, lc, a1, a2, shapes[1]) ?? a1; // lc=0 -> a1
			return segK(uu - w2, l2, a2, a3, shapes[2]);
		};

		const kappaPrime = (u) => {
			const uu = clamp01(Number(u));
			if (!Number.isFinite(uu)) return NaN;

			if (uu <  w1) return segK1(uu, l1, a0, a1, shapes[0]);
			if (uu >  w2) return segK1(uu - w2, l2, a2, a3, shapes[2]);

			// exactly at the cut (and lc==0): pick something stable
			// (left derivative is fine)
			return segK1(w1, l1, a0, a1, shapes[0]) ?? 0;
		};

		const kappa2 = (u) => {
			const uu = clamp01(Number(u));
			if (!Number.isFinite(uu)) return NaN;

			if (uu <  w1) return segK2(uu, l1, a0, a1, shapes[0]);
			if (uu >  w2) return segK2(uu - w2, l2, a2, a3, shapes[2]);

			return segK2(w1, l1, a0, a1, shapes[0]) ?? 0;
		};

		const kappaInt = (u) => {
			const uu = clamp01(Number(u));
			if (!Number.isFinite(uu)) return NaN;

			let acc = 0;

			// seg1 contribution up to min(u,w1)
			const u1 = Math.min(uu, w1);
			acc += segInt(u1, l1, a0, a1, shapes[0]);

			// seg2 (only if lc>0)
			if (uu > w1 && lc > 1e-12) {
				const u2 = Math.min(uu, w2) - w1;
				acc += segInt(u2, lc, a1, a2, shapes[1]);
			} else if (uu > w1) {
				// lc==0 => κ is “jumpless constant” at a1 over zero width => no area
			}

			// seg3
			if (uu > w2) {
				const u3 = uu - w2;
				acc += segInt(u3, l2, a2, a3, shapes[2]);
			}

			return acc;
		};

		return {
			kappa,
			kappaPrime,
			kappa2,
			kappaInt,
			cuts01: { w1, w2 }
		};
	}
	
	// in RegistryCompiler class
	listPresetIds() {
		const tr = this.db?.transition ?? {};
		return Object.keys(tr);
	}

	getPresetMeta(id) {
		const key = String(id).toLowerCase();
		const tr = this.db?.transition?.[key];
		if (!tr) return null;
		return {
			id: key,
			label: tr.label ?? key,
		};
	}
}
