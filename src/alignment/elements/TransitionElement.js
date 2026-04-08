// src/alignment/elements/TransitionElement.js

import { AlignmentElement } from "./AlignmentElement.js";
import { normalize, rot90 } from "@src/lib/geom/vec2.js";
import { romberg } from "@src/lib/math/numeric/romberg.js";

function clamp01(u) {
	const x = Number(u);
	if (!Number.isFinite(x)) return 0;
	return Math.max(0, Math.min(1, x));
}

function rot(v, angle) {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return {
		x: v.x * c - v.y * s,
		y: v.x * s + v.y * c,
	};
}

export class TransitionElement extends AlignmentElement {
	constructor({
		id = null,
		arcLength,
		runtimePreset,
		kappaA = 0,
		kappaB = 0,
		meta = null,
	} = {}) {
		super({ id, arcLength, meta });

		if (!runtimePreset?.kappa || !runtimePreset?.kappaInt) {
			console.log("[TransitionElement] incoming runtimePreset", runtimePreset);
			console.log("[TransitionElement] incoming typeof", {
				kappa: typeof runtimePreset?.kappa,
				kappaInt: typeof runtimePreset?.kappaInt,
				kappa1: typeof runtimePreset?.kappa1,
				kappa2: typeof runtimePreset?.kappa2,
				keys: Object.keys(runtimePreset ?? {}),
			});
			throw new Error("TransitionElement: missing runtimePreset.kappa/kappaInt");
		}

		this.runtime = runtimePreset;
		this.kappaA = Number(kappaA) || 0;
		this.kappaB = Number(kappaB) || 0;
	}

	curvatureAt(s) {
		const ss = this.clampS(s);
		if (this.arcLength <= 1e-12) return this.kappaB;

		const u = clamp01(ss / this.arcLength);
		return this.kappaA + (this.kappaB - this.kappaA) * this.runtime.kappa(u);
	}

	curvature1At(s) {
		if (!this.runtime?.kappa1 || this.arcLength <= 1e-12) return 0;

		const ss = this.clampS(s);
		const u = clamp01(ss / this.arcLength);

		return (this.kappaB - this.kappaA) * this.runtime.kappa1(u) / this.arcLength;
	}

	curvature2At(s) {
		if (!this.runtime?.kappa2 || this.arcLength <= 1e-12) return 0;

		const ss = this.clampS(s);
		const u = clamp01(ss / this.arcLength);

		return (this.kappaB - this.kappaA) * this.runtime.kappa2(u) / (this.arcLength * this.arcLength);
	}

	poseAt(s, poseA, opts = {}) {
		const ss = this.clampS(s);
		if (ss <= 0 || this.arcLength <= 1e-12) return poseA;

		const L = this.arcLength;
		const t0 = normalize(poseA.t);
		const n0 = rot90(t0);

		// relative heading increment from start tangent
		const thetaAt = (si) => {
			const u = clamp01(si / L);
			return this.kappaA * si + (this.kappaB - this.kappaA) * L * this.runtime.kappaInt(u);
		};

		const oldAbs = romberg.abs;
		const oldRel = romberg.rel;
		const oldNmax = romberg.NMAX;

		try {
			const quality = opts.quality ?? "balanced";

			if (quality === "exact") {
				romberg.abs = 1e-12;
				romberg.rel = 1e-12;
				romberg.NMAX = 24;
			} else if (quality === "rough") {
				romberg.abs = 1e-6;
				romberg.rel = 1e-6;
				romberg.NMAX = 8;
			} else {
				romberg.abs = 1e-9;
				romberg.rel = 1e-9;
				romberg.NMAX = 16;
			}

			const delta = romberg.integrateFresnel(thetaAt, 0, ss);
			const tS = rot(t0, thetaAt(ss));

			return {
				p: {
					x: poseA.p.x + delta.intC * t0.x + delta.intS * n0.x,
					y: poseA.p.y + delta.intC * t0.y + delta.intS * n0.y,
				},
				t: tS,
			};
		} finally {
			romberg.abs = oldAbs;
			romberg.rel = oldRel;
			romberg.NMAX = oldNmax;
		}
	}

	reverse() {
		return new TransitionElement({
			id: this.id,
			arcLength: this.arcLength,
			runtimePreset: this.runtime,
			kappaA: -this.kappaB,
			kappaB: -this.kappaA,
			meta: this.meta ?? null,
		});
	}

	parallel(offset) {
		throw new Error("TransitionElement.parallel(offset) not implemented yet");
	}
}
