// src/alignment/Alignment2D.js

import { clampS } from "../lib/geom/curve/element2.js";

import { Curve2D } from "../lib/geom/curve/Curve2D.js"

// export class Alignment2D {
export class Alignment2D extends Curve2D {
	constructor({ elements = [], poseA } = {}) {
		super();
		this.elements = elements.slice();
		this.poseA = poseA ?? { x: 0, y: 0, theta: 0 };
		this._rebuildIndex();
	}
	
	_rebuildIndex() {
		// prefix sums over arcLength
		this._S = [0];
		let acc = 0;
		for (const el of this.elements) {
			acc += el.arcLength;
			this._S.push(acc);
		}
		this._L = acc;
	}

	get arcLength() { return this._L; }

	// find element index for global s
	_locate(s) {
		const ss = clampS(s, this._L);
		// linear ok for now; can be binary search later
		let i = 0;
		while (i < this.elements.length && ss > this._S[i+1]) i++;
		const s0 = this._S[i];
		return { i, localS: ss - s0, sGlobal: ss };
	}

	// propagate poseA up to element i
	_poseAtElementStart(i) {
		let pose = this.poseA;
		if (pose.theta == null && pose.heading != null) {
			pose = { x: pose.x, y: pose.y, theta: pose.heading };
		}
		for (let k = 0; k < i; k++) {
			pose = this.elements[k].poseEFromPoseA(pose);
		}
		return pose;
	}

	coordAt(s) {
		// console.log( "!!!" );
		
		const { i, localS } = this._locate(s);
		const el = this.elements[i];
		const poseEiA = this._poseAtElementStart(i);

		// console.log("coordAt dbg", { s, i, localS, elType: el?.type, elClass: el?.constructor?.name, poseEiA });
		
		return el.coordAt(localS, poseEiA);
	}

	tangentAt(s) {
		const { i, localS } = this._locate(s);
		const el = this.elements[i];
		const poseEiA = this._poseAtElementStart(i);
		return el.tangentAt(localS, poseEiA);
	}
	
	directionAt(s) { return this.tangentAt(s); }

	curvatureAt(s) {
		const { i, localS } = this._locate(s);
		const el = this.elements[i];
		// curvatureAt does not need pose, but allow it anyway
		return el.curvatureAt(localS, null);
	}

	// handy: pose at global station
	poseAt(s) {
		const { i, localS } = this._locate(s);
		let pose = this._poseAtElementStart(i);
		// advance inside element
		const el = this.elements[i];
		const p = el.coordAt(localS, pose);
		const t = el.tangentAt(localS, pose);
		return { x: p.x, y: p.y, theta: Math.atan2(t.ty, t.tx) };
	}
	
	evalAt(s) {
		const { i, localS, sGlobal } = this._locate(s);
		const el = this.elements[i];
		const poseEiA = this._poseAtElementStart(i);

		const p = el.coordAt(localS, poseEiA);
		const t = el.tangentAt(localS, poseEiA);
		const k = el.curvatureAt(localS, poseEiA);

		return {
			x: p.x,
			y: p.y,
			theta: Math.atan2(t.ty, t.tx),
			curvature: k,
			elIndex: i,
			sLocal: localS,
			s: sGlobal,
			totalLength: this._L
		};
	}

	// TODO later: (x,y)->(s,q), reverse(), splice/edit helpers
}
