// src/domain/alignment/elements/ImmediateElement.js

import { TransitionElement } from "./TransitionElement.js";

const ZERO_RUNTIME_PRESET = {
	kappa: () => 0,
	kappaInt: () => 0,
	kappa1: () => 0,
	kappa2: () => 0,
};

export class ImmediateElement extends TransitionElement {

	constructor({
		id = null,
		kappaA = 0,
		kappaB = 0,
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
	}

	curvatureAt(s) {
		return this.kappaB;
	}

	poseAt(s, poseA, opts = {}) {
		return poseA;
	}

	reverse() {
		return new ImmediateElement({
			id: this.id,
			kappaA: -this.kappaB,
			kappaB: -this.kappaA,
			meta: this.meta ?? null
		});
	}

	parallel(offset) {
		return new ImmediateElement({
			id: this.id,
			kappaA: this.kappaA,
			kappaB: this.kappaB,
			meta: this.meta ?? null
		});
	}
}
