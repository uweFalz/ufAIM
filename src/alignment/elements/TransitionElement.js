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
		arcLength,
		runtimePreset,
		kappaA = 0,
		kappaB = 0,
	} = {}) {
		super({ arcLength });

		if (!runtimePreset?.kappa || !runtimePreset?.kappaInt) {
			throw new Error("TransitionElement: missing runtimePreset.kappa/kappaInt");
		}

		this.runtime = runtimePreset;
		this.kappaA = Number(kappaA) || 0;
		this.kappaB = Number(kappaB) || 0;
	}

	curvatureAt(s) {
		const ss = this.clampS(s);
		if (this.arcLength <= 1e-12) return this.kappaA;

		const u = clamp01(ss / this.arcLength);
		return this.kappaA + (this.kappaB - this.kappaA) * this.runtime.kappa(u);
	}

	poseAt(s, poseA, opts = {}) {
		const ss = this.clampS(s);
		if (ss <= 0) return poseA;
		if (this.arcLength <= 1e-12) return poseA;

		const L = this.arcLength;
		const t0 = normalize(poseA.t);
		const n0 = rot90(t0);

		// relative heading change from start tangent
		const thetaAt = (si) => {
			const u = clamp01(si / L);
			return this.kappaA * si + (this.kappaB - this.kappaA) * L * this.runtime.kappaInt(u);
		};

		const quality = opts.quality ?? "balanced";

		// map quality to romberg tolerances very lightly
		const oldAbs = romberg.abs;
		const oldRel = romberg.rel;
		const oldNmax = romberg.NMAX;

		try {
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
			const thetaS = thetaAt(ss);
			const tS = rot(t0, thetaS);

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
			arcLength: this.arcLength,
			runtimePreset: this.runtime,
			kappaA: -this.kappaB,
			kappaB: -this.kappaA,
		});
	}

	parallel(offset) {
		throw new Error("TransitionElement.parallel(offset) not implemented yet");
	}
}
