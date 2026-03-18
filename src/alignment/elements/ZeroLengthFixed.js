// src/alignment/elements/ZeroLengthFixed.js

import { FixedElement } from "./FixedElement.js";

export class ZeroLengthFixed extends FixedElement {
	
	constructor({ id = null, curvature = 0, meta = null } = {}) {
		super({ id, arcLength: 0, curvature, meta });
	}

	poseAt(s, poseA, opts = {}) {
		return poseA;
	}

	parallel(offset) {
		return new ZeroLengthFixed({
			id: this.id,
			curvature: this.curvature,
			meta: this.meta ?? null,
		});
	}
}
