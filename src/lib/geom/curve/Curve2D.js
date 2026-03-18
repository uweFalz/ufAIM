// src/lib/geom/curve/Curve2D.js 
//
// Curve2D: arc-length parametrized planar curve
// Tangent is unit vector.
//
// Minimal contract for 2D curve-like objects.
// We keep it intentionally small: arcLength + point/direction/curvature queries.
// Concrete implementations: AlignmentElement, Alignment2D, etc.

export /* abstract */ class Curve2D {

	constructor() {
		if (new.target === Curve2D) {
			throw new Error("Curve2D is abstract");
		}
	}

	curvatureAt(s) {
		throw new Error("curvatureAt(s) required");
	}

	poseAt(s, poseA, opts = {}) {
		throw new Error("poseAt(s) required");
	}

	pointAt(s, poseA = null, opts = {}) {
		return this.poseAt(s, poseA, opts).p;
	}

	tangentAt(s, poseA = null, opts = {}) {
		return this.poseAt(s, poseA, opts).t;
	}
}
