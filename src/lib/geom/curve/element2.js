// src/lib/geom/curve/element2.js
// Minimal evaluator für Fix-Elemente im alignment2D:
// - Gerade (kappa = 0)
// - Kreisbogen mit konstanter Krümmung kappa != 0
//
// Element-Form (minimal, "sparse-friendly"):
//   { arcLength: Number, curvature: Number }     // curvature = kappa = 1/R, Vorzeichen: + links, - rechts
// Optional: { type: "G"|"R" } nur fürs Debug/Lesbarkeit.
//
// Abhängigkeit: Pose-Frame aus src/lib/geom/frame/pose2.js

import { advance } from "../frame/pose2.js";

const EPS = 1e-12;

export function makeLine(arcLength) {
	return { type: "G", arcLength, curvature: 0 };
}

export function makeArc(arcLength, curvature) {
	return { type: "R", arcLength, curvature };
}

// Convenience: radius -> curvature (mit Vorzeichen über radiusSign oder separat)
export function curvatureFromRadius(radius) {
	if (!isFinite(radius) || Math.abs(radius) < EPS) {
		throw new Error("curvatureFromRadius(): invalid radius");
	}
	return 1 / radius; // Vorzeichen steckt im radius (negativer Radius => negative Krümmung)
}

export function clampS(s, L) {
	if (s < 0) return 0;
	if (s > L) return L;
	return s;
}

// Pose nach s Metern entlang Element (0..arcLength)
export function poseAt(element, startPose, s) {
	const L = element.arcLength;
	if (!isFinite(L) || L < 0) throw new Error("poseAt(): invalid arcLength");
	const ss = clampS(s, L);
	const kappa = element.curvature ?? 0;
	return advance(startPose, ss, kappa);
}

// Endpose des Elements
export function endPose(element, startPose) {
	return poseAt(element, startPose, element.arcLength);
}

// Split: (pose at s) + remaining length
export function cutAt(element, startPose, s) {
	const L = element.arcLength;
	const ss = clampS(s, L);
	const poseS = poseAt(element, startPose, ss);
	const head = { ...element, arcLength: ss };
	const tail = { ...element, arcLength: L - ss };
	return { head, poseS, tail };
}

// Sampler: N+1 Posen inkl. Start und Ende (für Debug/Rendering)
export function samplePoses(element, startPose, n = 10) {
	const L = element.arcLength;
	if (n < 1) n = 1;
	const out = [];
	for (let i = 0; i <= n; i++) {
		const s = (L * i) / n;
		out.push(poseAt(element, startPose, s));
	}
	return out;
}
