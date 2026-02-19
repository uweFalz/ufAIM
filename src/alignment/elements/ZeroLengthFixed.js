// src/alignment/elements/ZeroLengthFixed.js

// ZeroLengthFixed: curvature holder, arcLength=0, passes pose through
import { AlignmentElement } from "./AlignmentElement.js";

export class ZeroLengthFixed extends AlignmentElement {
	constructor({ id, curvature = 0 } = {}) {
		super({ id, type: "fixed", arcLength: 0 });
		this.curvature = Number(curvature) || 0;
	}

	curvatureAt(s=0) {
		return Number(this.curvature) || 0;
	}

	tangentAt(s=0, poseA) {
		// unit tangent from poseA.theta
		return { tx: Math.cos(poseA.theta), ty: Math.sin(poseA.theta) };
	}

	coordAt(s=0, poseA) {
		return { x: poseA.x, y: poseA.y };
	}

	poseEFromPoseA(poseA) {
		return poseA; // zero length
	}

	localDelta() {
		return { dx: 0, dy: 0, dTheta: 0 };
	}
}
