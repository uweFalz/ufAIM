// src/alignment/elements/KinkElement.js

import { TransitionElement } from "./TransitionElement.js";

function rot(v, angle) {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return {
		x: v.x * c - v.y * s,
		y: v.x * s + v.y * c
	};
}

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
			kappaA,
			kappaB,
			meta
		});

		this.deltaDir = Number(deltaDir) || 0;
	}

	curvatureAt(s) {
		// praktisch: nach dem Knick gilt neue Krümmung
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
