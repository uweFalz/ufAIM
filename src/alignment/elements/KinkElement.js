// src/alignment/elements/KinkElement.js
//
// “Kink” = length 0, direction jump by deltaDir (beta).
// Still extends TransitionElement per your requirement, but overrides angle delta.

import { TransitionElement } from "./TransitionElement.js";

export class KinkElement extends TransitionElement {
	constructor({ id, deltaDir } = {}) {
		super({ id, parts: [] });
		this._deltaDir = Number(deltaDir) || 0;
	}

	// For s==0 -> 0, for any “after” evaluation -> full jump.
	// (Since arcLength==0, callers should only query boundaries anyway.)
	angleDeltaLocal(s /*, poseA */) {
		const x = Number(s) || 0;
		return (x <= 0) ? 0 : this._deltaDir;
	}
}
