// src/alignment/elements/AlignmentElement.js
//
// Base contract for all alignment elements (2D plan geometry).
// No transition-specific concepts here.
// Station variable is always s ∈ [0, L] in meters.
//
// Sparse core idea:
// - arcLength L
// - start pose A = { x, y, dx, dy }  (dx,dy normalized)
// - end pose   E = { x, y, dx, dy }  (may be lazily computed)
// - type = "fixed" | "transition"

import { Curve2D } from "../../lib/geom/curve/Curve2D.js";

export class AlignmentElement extends Curve2D {
	constructor({ id, type, arcLength } = {}) {
		super();
		this.id = String(id ?? "");
		this.type = type; // "fixed" | "transition"
		this._L = Number(arcLength ?? 0);
		if (!this.id) throw new Error("AlignmentElement: missing id");
		if (this.type !== "fixed" && this.type !== "transition") throw new Error("AlignmentElement: invalid type");
		if (!Number.isFinite(this._L) || this._L < 0) throw new Error("AlignmentElement: invalid arcLength");
	}

	get arcLength() { return this._L; }

	// mandatory:
	poseEFromPoseA(poseA) { throw new Error("AlignmentElement.poseEFromPoseA not implemented"); }

	// optional fast path for chaining:
	localDelta() { return null; }
}
