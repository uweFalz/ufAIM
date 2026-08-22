// src/aim-core/alignment/aggregate/AlignmentFactory.js
//
// sparse -> Alignment2D
//
// MODEL
// - Input is SPOT sparse alignment
// - RegistryResolver resolves transition descriptors (data only)
// - KappaFcnBuilder builds runtime presets (functions, client-side)
// - TransitionElement consumes runtimePreset + kappaA + kappaB
// - ImmediateElement / KinkElement are zero-length transition specials
//
// EXPECTED INPUT
// {
//   startPose: { p:{x,y}, t:{x,y} },
//   sparse: [
//     { id?, type:"fixed",      arcLength, curvature, meta? },
//     { id?, type:"transition", arcLength, transType, opts?, meta? },
//
//     // optional zero-length specials:
//     { id?, type:"fixed",      arcLength:0, curvature, meta? },                  // holder
//     { id?, type:"transition", arcLength:0, transType, meta? },                  // immediate
//     { id?, type:"transition", arcLength:0, transType, deltaDir, meta? }         // kink
//   ],
//   descriptorResolver: { resolveTransitionDescriptor(id) },
//   kappaBuilder: { buildPresetFromDescriptor(desc, opts?) }
// }

/**
* @baustelle [ARCH][SPARSE_V2]
*
* ZUKUNFTSMODELL sparse_v2 (noch NICHT implementiert)
*
* Ziel:
* - Ablösung des aktuellen elementbasierten sparse_v1-Modells
* - Übergang zu node-edge-basierter Repräsentation
*
* Strukturidee:
*   pose3  -- curvatureFcn -->  pose3
*
* Kerneigenschaften:
* - Knoten (pose3):
*   - Position (x,y,z optional)
*   - Richtung (tangent / heading)
*
* - Kanten:
*   - curvatureFcn(s) beschreibt kontinuierlichen Übergang
*   - keine harte Typisierung in fixed/transition
*   - arcLength nicht zwingend primär gespeichert
*
* Motivation:
* - näher an mathematischer Beschreibung (κ(s))
* - besser geeignet für Solver (axtran)
* - robust gegenüber Edit-Operationen (Teilabschnitte)
* - vorbereitet für Topologie (Netze statt Linien)
*
* Konsequenzen:
* - current sparse_v1 bleibt Transport-/Kompatibilitätsformat
* - AlignmentFactory arbeitet weiterhin auf v1
* - Builder wird später v1 -> v2 übersetzen
*
* Offene Punkte:
* - Parametrisierung ohne explizites arcLength?
* - Diskretisierung / Sampling für View
* - Umgang mit diskontinuierlichen Sprüngen (Knick)
* - Mapping von landXML (Line/Curve/Spiral) auf curvatureFcn
*
* @status pending
*/

import { Alignment2D } from "../../geometry/Alignment2D.js";
import { FixedElement } from "../../geometry/FixedElement.js";
import { TransitionElement } from "../../geometry/TransitionElement.js";
import { ZeroLengthFixed } from "../../geometry/ZeroLengthFixed.js";
import { ImmediateElement } from "../../geometry/ImmediateElement.js";
import { KinkElement } from "../../geometry/KinkElement.js";

const DEBUG_ALIGNMENT_FACTORY = true;

function isFiniteNumber(x) {
	return Number.isFinite(Number(x));
}

function toFiniteNumber(x, fallback = 0) {
	const v = Number(x);
	return Number.isFinite(v) ? v : fallback;
}

function mkId(prefix, i) {
	return `${prefix}_${i}`;
}

function normalizeSparseType(stub) {
	const type = String(stub?.type ?? stub?.kind ?? "").toLowerCase();

	if (type === "fixed" || type === "transition") return type;

	// fallback heuristic for older sparse stubs
	if (stub?.transType != null) return "transition";
	return "fixed";
}

function readArcLength(stub) {
	return toFiniteNumber(stub?.arcLength ?? stub?.arclength, 0);
}

function readFixedCurvature(stub) {
	const k = Number(stub?.curvature);
	return Number.isFinite(k) ? k : null;
}

function readDeltaDir(stub) {
	const beta = Number(stub?.deltaDir ?? stub?.beta);
	return Number.isFinite(beta) ? beta : null;
}

function makeDescriptorResolverAdapter(descriptorResolver) {
	if (!descriptorResolver?.resolveTransitionDescriptor) {
		throw new Error("AlignmentFactory: missing descriptorResolver.resolveTransitionDescriptor");
	}
	return descriptorResolver;
}

function makeKappaBuilderAdapter(kappaBuilder) {
	if (!kappaBuilder?.buildPresetFromDescriptor) {
		throw new Error("AlignmentFactory: missing kappaBuilder.buildPresetFromDescriptor");
	}
	return kappaBuilder;
}

function findNextFixedSparseIndex(sparse, fromIndex) {
	for (let j = fromIndex + 1; j < sparse.length; j++) {
		if (normalizeSparseType(sparse[j]) === "fixed") return j;
	}
	return -1;
}

function getFixedCurvatureFromBuiltElement(el) {
	if (!el || typeof el.curvatureAt !== "function") return null;
	try {
		const k = el.curvatureAt(0);
		return Number.isFinite(k) ? k : null;
	} catch {
		return null;
	}
}

function buildFixedLikeElement(stub, index, warnings) {
	const id = String(stub?.id ?? mkId("F", index));
	const L = readArcLength(stub);
	const k = readFixedCurvature(stub);

	if (k == null) {
		warnings.push({
			index,
			id,
			type: "fixed",
			msg: "FixedElement missing curvature -> set 0",
		});
	}

	if (!isFiniteNumber(L) || L < 0) {
		warnings.push({
			index,
			id,
			type: "fixed",
			msg: "FixedElement invalid arcLength -> clamped to 0",
		});
	}

	// zero-length fixed special = curvature holder
	if (L === 0) {
		return new ZeroLengthFixed({
			id,
			curvature: k ?? 0,
			meta: stub?.meta ?? null,
		});
	}

	return new FixedElement({
		id,
		arcLength: L,
		curvature: k ?? 0,
		meta: stub?.meta ?? null,
	});
}

function buildImmediateElement({
	stub,
	index,
	warnings,
	kappaA = 0,
	kappaB = 0,
	msg = null,
}) {
	const id = String(stub?.id ?? mkId("T", index));

	if (msg) {
		warnings.push({
			index,
			id,
			type: "transition",
			msg,
		});
	}

	return new ImmediateElement({
		id,
		kappaA,
		kappaB,
		meta: stub?.meta ?? null,
	});
}

function buildKinkElement({
	stub,
	index,
	warnings,
	kappaA = 0,
	kappaB = 0,
	msg = null,
}) {
	const id = String(stub?.id ?? mkId("T", index));
	const deltaDir = readDeltaDir(stub) ?? 0;

	if (msg) {
		warnings.push({
			index,
			id,
			type: "transition",
			msg,
		});
	}

	return new KinkElement({
		id,
		kappaA,
		kappaB,
		deltaDir,
		meta: stub?.meta ?? null,
	});
}

function buildContinuousTransitionElement({
	stub,
	index,
	sparse,
	builtElements,
	descriptorResolver,
	kappaBuilder,
	warnings,
}) {
	const id = String(stub?.id ?? mkId("T", index));
	const L = readArcLength(stub);
	const transType = String(stub?.transType ?? "").toLowerCase();

	if (!transType) {
		return buildImmediateElement({
			stub,
			index,
			warnings,
			msg: 'Transition missing transType -> treated as Immediate',
		});
	}

	// kappaA from previous built fixed-like element
	const prevBuilt = builtElements[builtElements.length - 1] ?? null;
	let kappaA = getFixedCurvatureFromBuiltElement(prevBuilt);
	if (kappaA == null) {
		kappaA = 0;
		warnings.push({
			index,
			id,
			type: "transition",
			msg: "Prev fixed curvature missing -> kappaA = 0",
		});
	}

	// kappaB from next sparse fixed stub
	const nextFixedIdx = findNextFixedSparseIndex(sparse, index);
	let kappaB = 0;

	if (nextFixedIdx >= 0) {
		const nextStub = sparse[nextFixedIdx];
		const nextCurv = readFixedCurvature(nextStub);
		if (nextCurv == null) {
			warnings.push({
				index,
				id,
				type: "transition",
				msg: "Next fixed curvature missing -> kappaB = 0",
			});
		} else {
			kappaB = nextCurv;
		}
	} else {
		warnings.push({
			index,
			id,
			type: "transition",
			msg: "No next fixed found -> kappaB = 0",
		});
	}

	let descriptor;
	try {
		descriptor = descriptorResolver.resolveTransitionDescriptor(transType);

		/*
		if (DEBUG_ALIGNMENT_FACTORY) {
			console.log("[AlignmentFactory] descriptor", {
				id,
				transType,
				descriptorId: descriptor?.id ?? null,
				descriptorKeys: descriptor ? Object.keys(descriptor) : [],
			});
		}
		*/
	} catch (err) {
		return buildImmediateElement({
			stub,
			index,
			warnings,
			kappaA,
			kappaB,
			msg: `Descriptor resolve failed -> Immediate (${String(err?.message ?? err)})`,
		});
	}

	let runtimePreset;
	try {
		runtimePreset = kappaBuilder.buildPresetFromDescriptor(
		descriptor,
		stub?.opts ?? {}
		);

		/*
		console.log("[AlignmentFactory] runtimePreset RAW", runtimePreset);
		console.log("[AlignmentFactory] runtimePreset typeof", {
			kappa: typeof runtimePreset?.kappa,
			kappaInt: typeof runtimePreset?.kappaInt,
			kappa1: typeof runtimePreset?.kappa1,
			kappa2: typeof runtimePreset?.kappa2,
			keys: Object.keys(runtimePreset ?? {}),
		});
		*/

		/*
		if (DEBUG_ALIGNMENT_FACTORY) {
			console.log("[AlignmentFactory] runtimePreset", {
				id,
				transType,
				hasPreset: !!runtimePreset,
				hasKappa: typeof runtimePreset?.kappa === "function",
				hasKappaInt: typeof runtimePreset?.kappaInt === "function",
				keys: runtimePreset ? Object.keys(runtimePreset) : [],
			});
		}
		*/
	} catch (err) {
		return buildImmediateElement({
			stub,
			index,
			warnings,
			kappaA,
			kappaB,
			msg: `Runtime preset build failed -> Immediate (${String(err?.message ?? err)})`,
		});
	}

	try {
		/*
		if (DEBUG_ALIGNMENT_FACTORY) {
			console.log("[AlignmentFactory] transition input", {
				id,
				type: stub?.type ?? null,
				transType: stub?.transType ?? stub?.transitionCurve ?? null,
				arcLength: stub?.arcLength ?? null,
				kappaA,
				kappaB,
			});
		}
		*/

		return new TransitionElement({
			id,
			arcLength: L,
			runtimePreset,
			kappaA,
			kappaB,
			meta: {
				...(stub?.meta ?? {}),
				transType,
				descriptorId: descriptor?.id ?? transType,
			},
		});
	} catch (err) {
		/*
		if (DEBUG_ALIGNMENT_FACTORY) {
			console.log("[AlignmentFactory] TransitionElement failed", {
				id,
				transType,
				message: String(err?.message ?? err),
				runtimePresetKeys: runtimePreset ? Object.keys(runtimePreset) : [],
				hasKappa: typeof runtimePreset?.kappa === "function",
				hasKappaInt: typeof runtimePreset?.kappaInt === "function",
			});
		}
		*/

		return buildImmediateElement({
			stub,
			index,
			warnings,
			kappaA,
			kappaB,
			msg: `TransitionElement construction failed -> Immediate (${String(err?.message ?? err)})`,
		});
	}
}

function buildTransitionLikeElement({
	stub,
	index,
	sparse,
	builtElements,
	descriptorResolver,
	kappaBuilder,
	warnings,
}) {
	const id = String(stub?.id ?? mkId("T", index));
	const L = readArcLength(stub);

	if (!isFiniteNumber(L) || L < 0) {
		return buildImmediateElement({
			stub,
			index,
			warnings,
			msg: "Transition invalid arcLength -> treated as Immediate",
		});
	}

	// determine contextual kappaA / kappaB even for zero-length specials
	const prevBuilt = builtElements[builtElements.length - 1] ?? null;
	let kappaA = getFixedCurvatureFromBuiltElement(prevBuilt);
	if (kappaA == null) kappaA = 0;

	const nextFixedIdx = findNextFixedSparseIndex(sparse, index);
	let kappaB = 0;
	if (nextFixedIdx >= 0) {
		const nextStub = sparse[nextFixedIdx];
		const nextCurv = readFixedCurvature(nextStub);
		if (nextCurv != null) kappaB = nextCurv;
	}

	// zero-length transition specials
	if (L === 0) {
		const deltaDir = readDeltaDir(stub);

		if (deltaDir != null && Math.abs(deltaDir) > 0) {
			return buildKinkElement({
				stub,
				index,
				warnings,
				kappaA,
				kappaB,
			});
		}

		return buildImmediateElement({
			stub,
			index,
			warnings,
			kappaA,
			kappaB,
		});
	}

	return buildContinuousTransitionElement({
		stub,
		index,
		sparse,
		builtElements,
		descriptorResolver,
		kappaBuilder,
		warnings,
	});
}

export function makeAlignment2DFromSparse({
	startPose,
	sparse,
	descriptorResolver,
	kappaBuilder,
} = {}) {
	const warnings = [];

	if (!startPose) {
		throw new Error("AlignmentFactory: missing startPose");
	}
	if (!Array.isArray(sparse)) {
		throw new Error("AlignmentFactory: sparse must be an array");
	}

	const resolver = makeDescriptorResolverAdapter(descriptorResolver);
	const builder = makeKappaBuilderAdapter(kappaBuilder);

	const elements = [];

	for (let i = 0; i < sparse.length; i++) {
		const stub = sparse[i] ?? {};
		const type = normalizeSparseType(stub);

		if (type === "fixed") {
			const el = buildFixedLikeElement(stub, i, warnings);
			elements.push(el);
			continue;
		}

		if (type === "transition") {
			const el = buildTransitionLikeElement({
				stub,
				index: i,
				sparse,
				builtElements: elements,
				descriptorResolver: resolver,
				kappaBuilder: builder,
				warnings,
			});
			elements.push(el);
			continue;
		}

		warnings.push({
			index: i,
			id: String(stub?.id ?? mkId("X", i)),
			type: "unknown",
			msg: `Unknown sparse type "${String(stub?.type ?? stub?.kind ?? "")}" -> skipped`,
		});
	}

	const alignment = new Alignment2D(elements, startPose);

	return { alignment, warnings };
}
