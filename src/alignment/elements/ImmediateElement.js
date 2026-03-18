// src/alignment/elements/ImmediateElement.js

import { TransitionElement } from "./TransitionElement.js";

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
