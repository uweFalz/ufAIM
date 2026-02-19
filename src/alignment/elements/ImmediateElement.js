// src/alignment/elements/ImmediateElement.js
//
// “Immediate” = length 0, no direction change, no curvature evolution.
// Exists mainly to keep the alternating chain stable.

// import { TransitionElement } from "./TransitionElement.js";
import { AlignmentElement } from "./AlignmentElement.js";

//export class ImmediateElement extends TransitionElement {
export class ImmediateElement extends AlignmentElement {
	constructor({ id } = {}) {
		super({ id, type: "transition", arcLength: 0 });
	}

	// no-op geometry
	curvatureAt() { return 0; }

	tangentAt(s, poseA) {
		// poseA required, but unchanged
		return { tx: Math.cos(poseA.theta), ty: Math.sin(poseA.theta) };
	}

	coordAt(s, poseA) {
		return { x: poseA.x, y: poseA.y };
	}

	localDelta() { return { dx: 0, dy: 0, dTheta: 0 }; }

	poseEFromPoseA(poseA) { return poseA; }
}