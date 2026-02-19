// src/alignment/elements/FixedElement.js

import { AlignmentElement } from "./AlignmentElement.js";
import { clampS } from "../../lib/geom/curve/element2.js";
import { applyLocalDelta } from "../../lib/geom/frame/pose2.js"; // <== neu

const EPS = 1e-12;

function nearZero(x, eps = 1e-12) { return Math.abs(x) < eps; }

/**
* FixedElement: constant curvature element
* - curvature K in 1/m
* - L in m
*
* Analytic:
*  - dTheta = K*L
*  - local chord:
*      if K≈0: dx=L, dy=0
*      else:  dx = sin(KL)/K, dy = (1-cos(KL))/K
*/
export class FixedElement extends AlignmentElement {
	constructor({ id, arcLength, curvature } = {}) {
		super({ id, type: "fixed", arcLength });
		const K = Number(curvature);
		if (!Number.isFinite(K)) throw new Error("FixedElement: invalid curvature");
		this._K = K;
	}

	get curvature() { return this._K; }
	set curvature(v) {
		const K = Number(v);
		if (!Number.isFinite(K)) return;
		this._K = K;
	}

	curvatureAt(s) { void s; return this._K; }

	coordAt(s, poseA) {
		if (!poseA) throw new Error("FixedElement.coordAt(s, poseA) requires poseA");
		return this.coordAtFromPoseA(s, poseA);
	}

	tangentAt(s, poseA) {
		if (!poseA) throw new Error("FixedElement.tangentAt(s, poseA) requires poseA");
		const theta = this.directionAtFromPoseA(s, poseA);
		return { tx: Math.cos(theta), ty: Math.sin(theta) };
	}

	// Curve2D expects directionAt; we return tangent-vector like Alignment2D expects.
	directionAt(s, poseA) { return this.tangentAt(s, poseA); }

	directionAtFromPoseA(s, poseA) {
		const ss = clampS(s, this.arcLength);
		return poseA.theta + this._K * ss;
	}

	coordAtFromPoseA(s, poseA) {
		const ss = clampS(s, this.arcLength);
		const K = this._K;

		let dx, dy;

		if (nearZero(K)) {
			dx = ss;
			dy = 0;
		} else {
			const a = K * ss;
			dx = Math.sin(a) / K;
			dy = (1 - Math.cos(a)) / K;
		}

		const c = Math.cos(poseA.theta);
		const sn = Math.sin(poseA.theta);
		return {
			x: poseA.x + c * dx - sn * dy,
			y: poseA.y + sn * dx + c * dy
		};
	}

	localDelta() {
		const L = this.arcLength;
		const K = this._K;
		const dTheta = K * L;

		let dx, dy;
		if (nearZero(K)) {
			dx = L;
			dy = 0;
		} else {
			dx = Math.sin(dTheta) / K;
			dy = (1 - Math.cos(dTheta)) / K;
		}
		return { dx, dy, dTheta };
	}

	poseEFromPoseA(poseA) {
		return applyLocalDelta(poseA, this.localDelta());
	}

	toJSON() { return { ...super.toJSON(), curvature: this._K }; }
}
