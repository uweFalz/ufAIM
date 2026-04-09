// src/domain/alignment/elements/FixedElement.js

import { AlignmentElement } from "./AlignmentElement.js";
import { advance } from "@src/lib/geom/frame/poseAdvance2.js";

export class FixedElement extends AlignmentElement {

	constructor({ arcLength, curvature = 0 } = {}) {
		super({ arcLength });

		this.curvature = Number(curvature) || 0;
	}

	// --- core ---

	curvatureAt(s) {
		this.clampS(s);
		return this.curvature;
	}

	poseAt(s, poseA, opts = {}) {
		const ss = this.clampS(s);
		return advance(poseA, ss, this.curvature);
	}

	// --- transforms ---

	reverse() {
		return new FixedElement({
			arcLength: this.arcLength,
			curvature: -this.curvature
		});
	}

	parallel(offset) {
		const d = Number(offset) || 0;

		// Gerade
		if (Math.abs(this.curvature) < 1e-12) {
			return new FixedElement({
				arcLength: this.arcLength,
				curvature: 0
			});
		}

		// Kreis
		const R = 1 / this.curvature;
		const Rp = R - d;

		if (Math.abs(Rp) < 1e-12) {
			throw new Error("FixedElement.parallel: offset hits center");
		}

		return new FixedElement({
			arcLength: this.arcLength * (Rp / R),
			curvature: 1 / Rp
		});
	}
}
