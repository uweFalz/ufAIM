// src/alignment/elements/KinkElement.js

import { TransitionElement } from "./TransitionElement.js";
import { rot } from "@src/lib/geom/vec2.js";

const ZERO_RUNTIME_PRESET = {
	kappa: () => 0,
	kappaInt: () => 0,
	kappa1: () => 0,
	kappa2: () => 0,
};

export class KinkElement extends TransitionElement {

	constructor({
		id = null,
		kappaA = 0,
		kappaB = 0,
		deltaDir = 0,
		meta = null
	} = {}) {
		super({
			id,
			arcLength: 0,
			runtimePreset: ZERO_RUNTIME_PRESET,
			kappaA,
			kappaB,
			meta
		});

		this.deltaDir = Number(deltaDir) || 0;
	}

	curvatureAt(s) {
		return this.kappaB;
	}

	poseAt(s, poseA, opts = {}) {
		return {
			p: poseA.p,
			t: rot(poseA.t, this.deltaDir)
		};
	}

	reverse() {
		return new KinkElement({
			id: this.id,
			kappaA: -this.kappaB,
			kappaB: -this.kappaA,
			deltaDir: -this.deltaDir,
			meta: this.meta ?? null
		});
	}

	parallel(offset) {
		return new KinkElement({
			id: this.id,
			kappaA: this.kappaA,
			kappaB: this.kappaB,
			deltaDir: this.deltaDir,
			meta: this.meta ?? null
		});
	}
}
