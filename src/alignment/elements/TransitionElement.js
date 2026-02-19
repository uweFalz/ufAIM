// src/alignment/elements/TransitionElement.js
//
// TransitionElement: berlinish bundle
// [Quasi(hw1), ZeroLen(K1), Quasi(core), ZeroLen(K2), Quasi(hw2)]
// Quasi does the math; TransitionElement forwards.

import { AlignmentElement } from "./AlignmentElement.js";
import { clampS } from "../../lib/geom/curve/element2.js";

export class TransitionElement extends AlignmentElement {
	constructor({ id, parts = [] } = {}) {
		const L = parts.reduce((a, el) => a + (Number(el?.arcLength) || 0), 0);
		super({ id, type: "transition", arcLength: L });
		
		if (!Array.isArray(parts) || parts.length === 0) {
			throw new Error("TransitionElement: missing parts[]");
		}
		this.parts = parts.slice();
		this._rebuildIndex();
	}

	_rebuildIndex() {
		this._S = [0];
		let acc = 0;
		for (const el of this.parts) {
			acc += Number(el.arcLength) || 0;
			this._S.push(acc);
		}
		this._L = acc;
	}

	get arcLength() { return this._L; }

	_locate(s) {
		const ss = clampS(s, this._L);
		let i = 0;
		while (i < this.parts.length && ss > this._S[i + 1]) i++;
		return { i, localS: ss - this._S[i] };
	}

	_poseAtPartStart(i, poseA) {
		let pose = poseA;
		for (let k = 0; k < i; k++) {
			pose = this.parts[k].poseEFromPoseA(pose);
		}
		return pose;
	}

	curvatureAt(s, poseA) {
		// curvature doesn't truly need poseA; we still accept it.
		const { i, localS } = this._locate(s);
		return this.parts[i].curvatureAt(localS, poseA);
	}

	tangentAt(s, poseA) {
		const { i, localS } = this._locate(s);
		const pA = this._poseAtPartStart(i, poseA);
		return this.parts[i].tangentAt(localS, pA);
	}

	coordAt(s, poseA) {
		const { i, localS } = this._locate(s);
		const pA = this._poseAtPartStart(i, poseA);
		return this.parts[i].coordAt(localS, pA);
	}

	poseEFromPoseA(poseA) {
		let pose = poseA;
		for (const el of this.parts) pose = el.poseEFromPoseA(pose);
		return pose;
	}

	// optional convenience for editor/opter debugging:
	get internalParts() { return this.parts.slice(); }
}
