// src/alignment/eval/alignment2dEval.js

import { poseFromHeading } from "../../lib/geom/frame/pose2.js";
import { poseAtS, totalLength } from "../../lib/geom/curve/runner2.js";

// --- helpers: detect element kinds (minimal; ggf. an deine echten type strings anpassen)
function isFixed(el) {
	return el?.type === "fixed" || el?.constructor?.name?.includes("Fixed");
}

function isZeroFixed(el) {
	return el?.constructor?.name?.includes("ZeroLengthFixed");
}

function isTransitionElement(el) {
	return el?.constructor?.name?.includes("TransitionElement") || el?.type === "transition";
}

function isQuasi(el) {
	return el?.constructor?.name?.includes("QuasiElement") || el?.type === "quasi";
}

// Scale a normalized shape-family (u in [0..1]) to metric family (s in [0..L])
function scaledFamily({ shape, L, Ka, Ke }) {
	const dK = Ke - Ka;
	const invL = L !== 0 ? 1 / L : 0;
	const invL2 = invL * invL;

	const fam = {
		kappa: (s) => {
			const u = L === 0 ? 0 : s * invL;
			return Ka + dK * shape.kappa(u);
		},
		kappaInt: (s) => {
			const u = L === 0 ? 0 : s * invL;
			// ∫0..s [Ka + dK*shape.kappa(u)] ds
			// = Ka*s + dK * L * shape.kappaInt(u)
			return Ka * s + dK * L * shape.kappaInt(u);
		},
	};

	// optional for cog / transEd
	if (typeof shape.kappa1 === "function") {
		fam.kappa1 = (s) => {
			const u = L === 0 ? 0 : s * invL;
			return dK * invL * shape.kappa1(u);
		};
	}
	if (typeof shape.kappa2 === "function") {
		fam.kappa2 = (s) => {
			const u = L === 0 ? 0 : s * invL;
			return dK * invL2 * shape.kappa2(u);
		};
	}

	// halfWave2 pendants etc. bleiben einfach am shape hängen (Domain),
	// oder du leitest sie hier analog ab, falls du sie wirklich als s->... brauchst.

	return fam;
}

// Flatten Alignment2D elements to engine elements {arcLength, curvature} or {arcLength, kappaFamily}
export function buildEngineSequenceFromAlignment2D(alignment2D) {
	const seq = [];

	for (const el of alignment2D.elements) {
		if (isTransitionElement(el) && Array.isArray(el.parts)) {
			for (const p of el.parts) {
				if (isQuasi(p)) {
					const L = Number(p.arcLength ?? 0);
					if (L <= 0) continue;

					// These contracts are based on your factory:
					// QuasiElement({ shape, KaRef, KeRef })
					const Ka = p.KaRef?.curvatureAt?.(0, null) ?? 0;
					const Ke = p.KeRef?.curvatureAt?.(0, null) ?? 0;
					const shape = p.shape;

					if (!shape?.kappaInt || !shape?.kappa) {
						throw new Error("QuasiElement.shape must provide kappa(u) and kappaInt(u)");
					}

					seq.push({
						arcLength: L,
						kappaFamily: scaledFamily({ shape, L, Ka, Ke }),
					});
				} else if (isFixed(p) || isZeroFixed(p)) {
					// wiring points: keep only if you want curvature sampling at exact anchors
					const L = Number(p.arcLength ?? 0);
					if (L > 0) {
						const k = p.curvatureAt?.(0, null) ?? 0;
						seq.push({ arcLength: L, curvature: k });
					}
				}
			}
			continue;
		}

		// plain fixed element
		if (isFixed(el) || isZeroFixed(el)) {
			const L = Number(el.arcLength ?? 0);
			const k = el.curvatureAt?.(0, null) ?? 0;
			if (L > 0) seq.push({ arcLength: L, curvature: k });
			continue;
		}

		// unknown element: ignore or throw (I’d throw, to control Baustellen)
		throw new Error(`Unknown Alignment2D element kind: ${el?.constructor?.name ?? typeof el}`);
	}

	return seq;
}

// Public: eval pose at station s (meters)
export function evalAlignment2DAt(alignment2D, s) {
	const seq = buildEngineSequenceFromAlignment2D(alignment2D);
	const Ltot = totalLength(seq);
	const S = Math.max(0, Math.min(Ltot, s));

	const start = alignment2D.poseA ?? { x: 0, y: 0, theta: 0 };
	const startPose = poseFromHeading(start.x, start.y, start.theta);

	const pose = poseAtS(seq, startPose, S);

	// curvature reporting (optional): sample from element (cheap-ish)
	// Minimal: omit; or do a second pass to locate the local element and evaluate kappa(sLocal)
	return {
		x: pose.p.x,
		y: pose.p.y,
		theta: Math.atan2(pose.t.y, pose.t.x),
		s: S,
		totalLength: Ltot,
	};
}
