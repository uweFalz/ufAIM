// src/alignment/Alignment2D.js

import { normalize } from "@src/lib/geom/vec2.js";

export class Alignment2D {

	constructor(elements = [], pose0 = { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } }) {
		this.elements = elements;
		this.pose0 = {
			p: { ...pose0.p },
			t: normalize(pose0.t)
		};

		this._buildIndex();
	}

	// ------------------------------------------------------------
	// precompute segment offsets
	// ------------------------------------------------------------

	_buildIndex() {
		this._offsets = [];
		let acc = 0;

		for (const el of this.elements) {
			this._offsets.push(acc);
			acc += el.arcLength;
		}

		this._arcLength = acc;
	}

	get arcLength() {
		return this._arcLength;
	}

	// ------------------------------------------------------------
	// helper: find segment
	// ------------------------------------------------------------

	_findSegment(s) {
		const ss = Math.max(0, Math.min(this._arcLength, s));

		for (let i = this.elements.length - 1; i >= 0; i--) {
			if (ss >= this._offsets[i]) {
				return {
					index: i,
					localS: ss - this._offsets[i]
				};
			}
		}

		return { index: 0, localS: ss };
	}

	// ------------------------------------------------------------
	// curvature
	// ------------------------------------------------------------

	curvatureAt(s) {
		if (this.elements.length === 0) return 0;

		const { index, localS } = this._findSegment(s);
		return this.elements[index].curvatureAt(localS);
	}

	// ------------------------------------------------------------
	// pose
	// ------------------------------------------------------------

	poseAt(s, opts = {}) {
		if (this.elements.length === 0) return this.pose0;

		const ss = Math.max(0, Math.min(this._arcLength, s));

		let pose = this.pose0;

		for (let i = 0; i < this.elements.length; i++) {
			const el = this.elements[i];
			const start = this._offsets[i];
			const end = start + el.arcLength;

			if (ss <= end) {
				// inside this element
				return el.poseAt(ss - start, pose, opts);
			}

			// advance fully through element
			pose = el.poseE(pose, opts);
		}

		return pose;
	}

	// ------------------------------------------------------------
	// convenience
	// ------------------------------------------------------------

	pointAt(s, opts = {}) {
		return this.poseAt(s, opts).p;
	}

	tangentAt(s, opts = {}) {
		return this.poseAt(s, opts).t;
	}

	// ------------------------------------------------------------
	// transforms (minimal v1)
	// ------------------------------------------------------------

	reverse() {
		const reversed = this.elements
			.slice()
			.reverse()
			.map(el => el.reverse());

		const poseEnd = this.poseAt(this.arcLength);

		return new Alignment2D(
			reversed,
			{
				p: poseEnd.p,
				t: { x: -poseEnd.t.x, y: -poseEnd.t.y }
			}
		);
	}

	parallel(offset) {
		const shifted = this.elements.map(el => el.parallel(offset));
		return new Alignment2D(shifted, this.pose0);
	}
}
