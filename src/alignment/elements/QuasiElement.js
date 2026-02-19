// src/alignment/elements/QuasiElement.js

import { AlignmentElement } from "./AlignmentElement.js";
import { clampS } from "../../lib/geom/curve/element2.js";
import { applyLocalDelta } from "../../lib/geom/frame/pose2.js"; // <== neu
import { romberg } from "../../lib/math/numeric/romberg.js";

// shape API expected (normalized u∈[0,1]):
// - kappa(u)      in [0,1]
// - kappaInt(u)   integral_0^u kappa(t) dt   (dimensionless)
// - (optional) xyInt(u): {x,y} gives normalized local chord for integration-free coord
//
// Quasi maps: K(s) = Ka + (Ke-Ka)*shape.kappa(s/L)
// Δθ(s) = ∫ K ds = Ka*s + (Ke-Ka)*L*shape.kappaInt(s/L)

export class QuasiElement extends AlignmentElement {
	constructor({ id, arcLength, shape, KaRef, KeRef } = {}) {
		super({ id, type: "transition", arcLength });
		if (!shape?.kappa || !shape?.kappaInt) throw new Error("QuasiElement: missing shape.kappa/kappaInt");
		if (!KaRef || !KeRef) throw new Error("QuasiElement: missing KaRef/KeRef");
		this.shape = shape;
		this.KaRef = KaRef; // e.g. ZeroLengthFixed instance
		this.KeRef = KeRef;
	}

	get Ka() { return Number(this.KaRef.curvature ?? 0); }
	set Ka(v) { this.KaRef.curvature = v; }

	get Ke() { return Number(this.KeRef.curvature ?? 0); }
	set Ke(v) { this.KeRef.curvature = v; }

	// curvature at local s
	curvatureAt(s) {
		const L = this.arcLength;
		if (L <= 0) return this.Ka;
		const ss = clampS(s, L);
		const u = ss / L;
		const Ka = this.Ka, Ke = this.Ke;
		return Ka + (Ke - Ka) * this.shape.kappa(u);
	}

	// local heading change from 0..s (no numeric integration!)
	angleDeltaLocal(s) {
		const L = this.arcLength;
		if (L <= 0) return 0;
		const ss = clampS(s, L);
		const u = ss / L;
		const Ka = this.Ka, Ke = this.Ke;
		return Ka * ss + (Ke - Ka) * L * this.shape.kappaInt(u);
	}

	// tangent unit vector in GLOBAL coords (needs poseA)
	tangentAt(s, poseA) {
		const dTheta = this.angleDeltaLocal(s);
		const theta = poseA.theta + dTheta;
		return { tx: Math.cos(theta), ty: Math.sin(theta) };
	}

	// coordAt requires integration of rotated tangent.
	// We keep it numeric for now (fast enough), but we do NOT integrate curvature.
	// We integrate cos/sin of (poseA.theta + angleDeltaLocal(t)).
	coordAt(s, poseA) {
		const L = this.arcLength;
		const ss = clampS(s, L);
		if (ss <= 0) return { x: poseA.x, y: poseA.y };

		const theta0 = poseA.theta;

		// tau(t) = theta0 + Δθ(t)
		const tau = (t) => theta0 + this.angleDeltaLocal(t);

		const { intC, intS } = romberg.integrateFresnel(tau, 0, ss);

		return { x: poseA.x + intC, y: poseA.y + intS };
	}

	// full element local delta (for chaining/poseE)
	localDelta() {
		const L = this.arcLength;
		if (L <= 0) return { dx: 0, dy: 0, dTheta: 0 };

		const dTheta = this.angleDeltaLocal(L);

		// compute dx,dy in *local frame at poseA* (theta0=0), then outer applies rotation.
		// We'll reuse coordAt with a "poseA at origin, theta=0".
		const p0 = { x: 0, y: 0, theta: 0 };
		const pe = this.coordAt(L, p0);
		return { dx: pe.x, dy: pe.y, dTheta };
	}

	poseEFromPoseA(poseA) {
		return applyLocalDelta(poseA, this.localDelta());
	}
}
