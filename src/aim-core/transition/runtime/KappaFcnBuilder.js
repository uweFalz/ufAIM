// src/aim-core/transition/runtime/KappaFcnBuilder.js

import { buildProtoAst } from "../ast/buildProtoAst.js";
import { makeEvalFn } from "../ast/evalAst.js";
import { symDiff } from "../ast/symDiff.js";
import { symInt } from "../ast/symInt.js";
import { simplify } from "../ast/simplify.js";

import { clamp01 } from "./clamp01.js";

import { computeAnchorsFromTotal } from "./computeAnchorsFromTotal.js";

// ...
function resolveLambdas(desc, opts = {}) {
	let lambdas = Array.isArray(desc?.normLengthPartition)
		? desc.normLengthPartition.map((x) => Number(x) || 0)
		: [0, 1, 0];

	if (opts?.w1 != null && opts?.w2 != null) {
		const w1 = clamp01(opts.w1);
		const w2 = clamp01(opts.w2);
		lambdas = [
			w1,
			Math.max(0, w2 - w1),
			Math.max(0, 1 - w2),
		];
	}

	return lambdas;
}

function kappaExprFromSource(expr, source, protoId) {
	const s = source || "kappa";
	switch (s) {
		case "kappa":
			return expr;
		case "kappa1":
			return simplify(symInt(expr));
		case "kappa2":
			return simplify(symInt(simplify(symInt(expr))));
		case "kappaInt":
			return simplify(symDiff(expr));
		default:
			throw new Error(`KappaFcnBuilder: proto "${protoId}": unknown source "${s}"`);
	}
}

function buildProtoExpression({ protoDef, simpleFcn }) {
	if (protoDef?.disabled === true) {
		throw new Error("KappaFcnBuilder: protoFcn is disabled");
	}
	const tree = protoDef?.tree ?? protoDef;
	return simplify(buildProtoAst(tree, simpleFcn));
}

function buildRawFamily({ protoId, protoDef, simpleFcn, source }) {
	const protoExpr = buildProtoExpression({ protoDef, simpleFcn });
	const kappaExpr = kappaExprFromSource(protoExpr, source, protoId);

	const kRawFn = makeEvalFn(kappaExpr);

	const k1Expr = simplify(symDiff(kappaExpr));
	const k2Expr = simplify(symDiff(k1Expr));
	const kIntExpr = simplify(symInt(kappaExpr));

	const k1RawFn = makeEvalFn(k1Expr);
	const k2RawFn = makeEvalFn(k2Expr);
	const kIntRawFn = makeEvalFn(kIntExpr);

	return {
		kappa: (u) => kRawFn(clamp01(u)),
		kappa1: (u) => k1RawFn(clamp01(u)),
		kappa2: (u) => k2RawFn(clamp01(u)),
		kappaInt: (u) => kIntRawFn(clamp01(u)),
		meta: { protoId },
	};
}

function normalizeFamily(rawFamily, protoId) {
	const k0 = rawFamily.kappa(0);
	const k1 = rawFamily.kappa(1);
	const denom = k1 - k0;

	if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) {
		const k00 = rawFamily.kappa(0);
		const k05 = rawFamily.kappa(0.5);
		const k11 = rawFamily.kappa(1);

		const isConst =
			Number.isFinite(k00) &&
			Number.isFinite(k05) &&
			Number.isFinite(k11) &&
			Math.abs(k05 - k00) < 1e-12 &&
			Math.abs(k11 - k00) < 1e-12;

		const isZero = isConst && Math.abs(k00) < 1e-12;

		if (isZero) {
			return {
				kappa: () => 0,
				kappa1: () => 0,
				kappa2: () => 0,
				kappaInt: () => 0,
				meta: {
					protoId,
					range: { k0: 0, k1: 0, denom: 0 },
					degenerate: "zero",
				},
			};
		}

		throw new Error(`KappaFcnBuilder: degenerate range for proto "${protoId}"`);
	}

	return {
		kappa: (u) => (rawFamily.kappa(u) - k0) / denom,
		kappa1: (u) => rawFamily.kappa1(u) / denom,
		kappa2: (u) => rawFamily.kappa2(u) / denom,
		kappaInt: (u) => {
			const uu = clamp01(u);
			return (
				(rawFamily.kappaInt(uu) - rawFamily.kappaInt(0) - k0 * uu) / denom
			);
		},
		meta: {
			protoId,
			range: { k0, k1, denom },
		},
	};
}

function buildNormalizedFamilyFromDescriptor(def) {
	const raw = buildRawFamily({
		protoId: def.protoId,
		protoDef: def.protoDef,
		simpleFcn: def.simpleFcn,
		source: def.source,
	});

	return normalizeFamily(raw, def.protoId);
}

function reverseFamilyAsymmetric(fam) {
	const uu = (u) => clamp01(u);

	return {
		kappa: (u) => 1 - fam.kappa(1 - uu(u)),
		kappa1: (u) => fam.kappa1(1 - uu(u)),
		kappa2: (u) => -fam.kappa2(1 - uu(u)),
		kappaInt: (u) => {
			const u0 = uu(u);
			const I = fam.kappaInt;
			return u0 - I(1) + I(1 - u0);
		},
		meta: { ...(fam.meta ?? {}), asymReversed: true },
	};
}

function buildFamily(def, simpleFcn, reverse = false) {
	const fam = buildNormalizedFamilyFromDescriptor({
		...def,
		simpleFcn,
	});
	return reverse ? reverseFamilyAsymmetric(fam) : fam;
}

function segK(u, L, A, B, shape) {
	if (L <= 1e-12) return null;
	const local = clamp01(u / L);
	return A + (B - A) * shape.kappa(local);
}

function segK1(u, L, A, B, shape) {
	if (L <= 1e-12) return null;
	const local = clamp01(u / L);
	return (B - A) * shape.kappa1(local) / L;
}

function segK2(u, L, A, B, shape) {
	if (L <= 1e-12) return null;
	const local = clamp01(u / L);
	return (B - A) * shape.kappa2(local) / (L * L);
}

function segInt(u, L, A, B, shape) {
	if (L <= 1e-12) return 0;
	const uu = clamp01(u);
	const local = clamp01(uu / L);
	return A * uu + (B - A) * L * shape.kappaInt(local);
}

function buildPiecewisePreset({ id, label, lambdas, families, anchors }) {
	const [l1, lc, l2] = lambdas;
	const [a0, a1, a2, a3] = anchors;

	const w1 = l1;
	const w2 = l1 + lc;

	const has1 = l1 > 1e-12;
	const hasC = lc > 1e-12;
	const has2 = l2 > 1e-12;

	const kappa = (u) => {
		const uu = clamp01(u);

		if (has1 && uu < w1) {
			return segK(uu, l1, a0, a1, families[0]);
		}

		if (hasC && uu <= w2) {
			return segK(uu - w1, lc, a1, a2, families[1]);
		}

		if (has2) {
			return segK(uu - w2, l2, a2, a3, families[2]);
		}

		// degenerate fallback
		if (hasC) return a2;
		if (has1) return a1;
		return a3;
	};

	const kappa1 = (u) => {
		const uu = clamp01(u);

		if (has1 && uu < w1) {
			return segK1(uu, l1, a0, a1, families[0]);
		}

		if (hasC && uu <= w2) {
			return segK1(uu - w1, lc, a1, a2, families[1]);
		}

		if (has2) {
			return segK1(uu - w2, l2, a2, a3, families[2]);
		}

		return 0;
	};

	const kappa2 = (u) => {
		const uu = clamp01(u);

		if (has1 && uu < w1) {
			return segK2(uu, l1, a0, a1, families[0]);
		}

		if (hasC && uu <= w2) {
			return segK2(uu - w1, lc, a1, a2, families[1]);
		}

		if (has2) {
			return segK2(uu - w2, l2, a2, a3, families[2]);
		}

		return 0;
	};

	const kappaInt = (u) => {
		const uu = clamp01(u);
		let acc = 0;

		if (has1) {
			const u1 = Math.min(uu, w1);
			acc += segInt(u1, l1, a0, a1, families[0]);
		}

		if (hasC && uu > w1) {
			const u2 = Math.min(uu, w2) - w1;
			acc += segInt(u2, lc, a1, a2, families[1]);
		}

		if (has2 && uu > w2) {
			const u3 = uu - w2;
			acc += segInt(u3, l2, a2, a3, families[2]);
		}

		return acc;
	};

	return {
		presetId: id,
		label,

		lambdas,
		kappaFamilies: families,

		normCrvAnchor: anchors,
		cuts01: { w1, w2 },
		cutsCrv: { c1: a1, c2: a2 },

		kappa,
		kappa1,
		kappa2,
		kappaInt,

		meta: {
			kind: "transitionRuntimePreset",
		},
	};
}

export const KappaFcnBuilder = {
	buildFamiliesFromDescriptor(desc, opts = {}) {
		if (!desc?.halfWave1 || !desc?.halfWave2 || !desc?.core || !desc?.simpleFcn) {
			throw new Error("KappaFcnBuilder: invalid descriptor");
		}

		const lambdas = resolveLambdas(desc, opts);

		const hw1 = buildFamily(desc.halfWave1, desc.simpleFcn, false);
		const hw2 = buildFamily(desc.halfWave2, desc.simpleFcn, true);
		const core = buildFamily(desc.core, desc.simpleFcn, false);

		const families = [hw1, core, hw2];

		let anchors = [0, 0, 1, 1];
		try {
			anchors = computeAnchorsFromTotal(families, lambdas) ?? anchors;
		} catch {
			// fallback
		}

		return {
			id: desc.id,
			label: desc.label,
			lambdas,
			kappaFamilies: families,
			normCrvAnchor: anchors,
			meta: {
				kind: "kappaFamilyPackage",
			},
		};
	},

	buildPresetFromDescriptor(desc, opts = {}) {
		const famPkg = this.buildFamiliesFromDescriptor(desc, opts);

		return buildPiecewisePreset({
			id: desc.id,
			label: desc.label,
			lambdas: famPkg.lambdas,
			families: famPkg.kappaFamilies,
			anchors: famPkg.normCrvAnchor,
		});
	},

	// compat bridge for old callers
	buildPresetFromDefs(defs, presetId, opts = {}) {
		const desc = {
			...(() => {
				const key = String(presetId ?? "").toLowerCase();
				const tr = defs?.transition?.[key];
				if (!tr) throw new Error(`KappaFcnBuilder: unknown presetId "${key}"`);

				const hw1 = defs?.halfWave?.[tr.halfWave1];
				const hw2 = defs?.halfWave?.[tr.halfWave2];
				const core = defs?.protoFcn?.clothoCore;

				if (!hw1 || !hw2 || !core) {
					throw new Error("KappaFcnBuilder: invalid defs for compat bridge");
				}

				return {
					id: key,
					label: tr.label ?? key,
					normLengthPartition: tr.normLengthPartition ?? [0, 1, 0],
					halfWave1: {
						id: tr.halfWave1,
						protoId: hw1.proto,
						protoDef: defs.protoFcn[hw1.proto],
						source: hw1.source ?? "kappa",
					},
					halfWave2: {
						id: tr.halfWave2,
						protoId: hw2.proto,
						protoDef: defs.protoFcn[hw2.proto],
						source: hw2.source ?? "kappa",
					},
					core: {
						id: "clothoCore",
						protoId: "clothoCore",
						protoDef: core,
						source: "kappa",
					},
					simpleFcn: defs.simpleFcn,
				};
			})(),
		};

		return this.buildPresetFromDescriptor(desc, opts);
	},
};
