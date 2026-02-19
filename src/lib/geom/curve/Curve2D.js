// src/lib/geom/curve/Curve2D.js 
//
// Curve2D: arc-length parametrized planar curve
// Tangent is unit vector.
//
// Minimal contract for 2D curve-like objects.
// We keep it intentionally small: arcLength + point/direction/curvature queries.
// Concrete implementations: AlignmentElement, Alignment2D, etc.

export class Curve2D {
	constructor() {
		if (new.target === Curve2D) {
			throw new Error("Curve2D is abstract");
		}
	}

	// --- required ---
	get arcLength() { throw new Error("Curve2D.arcLength getter required"); }

	// poseA is the “external initial value” (start pose for this curve segment/object).
	// Implementations may accept poseA via ctor (element stands alone) OR via arg (alignment propagates pose).
	curvatureAt(/* s, poseA? */) { throw new Error("curvatureAt(s) required"); }
	directionAt(/* s, poseA? */) { throw new Error("directionAt(s) required"); }
	coordAt(/* s, poseA? */) { throw new Error("coordAt(s) required"); }

	// --- optional goodies (can stay unimplemented in minimal phase) ---
	// toLocal / fromLocal, reverse, etc.
}
