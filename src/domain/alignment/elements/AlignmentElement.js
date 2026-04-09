// src/domain/alignment/elements/AlignmentElement.js

import { normalize } from "@src/lib/geom/vec2.js";

export /* abstract */ class AlignmentElement {

	constructor({ arcLength = 0 } = {}) {
		this._arcLength = Number(arcLength) || 0;
	}

	// --- core ---

	get arcLength() {
		return this._arcLength;
	}

	clampS(s) {
		const x = Number(s);
		if (!Number.isFinite(x)) return 0;
		return Math.max(0, Math.min(this._arcLength, x));
	}

	// --- required overrides ---

	curvatureAt(s) {
		throw new Error("AlignmentElement.curvatureAt(s) not implemented");
	}

	poseAt(s, poseA, opts = {}) {
		throw new Error("AlignmentElement.poseAt(s, poseA) not implemented");
	}

	reverse() {
		throw new Error("AlignmentElement.reverse() not implemented");
	}

	parallel(offset) {
		throw new Error("AlignmentElement.parallel(offset) not implemented");
	}

	// --- convenience ---

	poseE(poseA, opts = {}) {
		return this.poseAt(this._arcLength, poseA, opts);
	}

	pointAt(s, poseA, opts = {}) {
		return this.poseAt(s, poseA, opts).p;
	}

	tangentAt(s, poseA, opts = {}) {
		return this.poseAt(s, poseA, opts).t;
	}

	// --- track space ---

	track2World(s, q = 0, poseA, opts = {}) {
		const pose = this.poseAt(s, poseA, opts);

		const t = normalize(pose.t);
		const n = { x: -t.y, y: t.x }; // left normal

		return {
			x: pose.p.x + q * n.x,
			y: pose.p.y + q * n.y
		};
	}

	world2Track(x, y, poseA, opts = {}) {
		throw new Error("AlignmentElement.world2Track not implemented");
	}
}
