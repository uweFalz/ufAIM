// src/lib/geom/curve/runner2.js
// Minimal SequenceRunner für alignment2D sparse-sequence.
//
// Unterstützte Elemente:
// - Fix: { arcLength, curvature }  (G/R) -> element2.poseAt / endPose
// - Transition: { arcLength, lookup } (T) -> transition2.poseAtTransition / endPoseTransition
//
// API:
//   endPoseOfSequence(elements, startPose)
//   poseAtS(elements, startPose, sGlobal)        // sGlobal entlang Gesamtlänge
//   sampleSequence(elements, startPose, step)    // Posen in konstantem Schritt
//
// Minimal: linear scan (ok). Später: prefix sums + binary search.

import { poseAt as poseAtFix, endPose as endPoseFix } from "./element2.js";
import { poseAtTransition, endPoseTransition } from "./transition2.js";

const EPS = 1e-12;

function isTransition(el) {
	// minimal: transition erkannt an lookup-array
	return Array.isArray(el.lookup);
}

function arcLengthOf(el) {
	const L = el.arcLength;
	if (!isFinite(L) || L < 0) throw new Error("runner2: invalid arcLength");
	return L;
}

export function totalLength(elements) {
	let sum = 0;
	for (const el of elements) sum += arcLengthOf(el);
	return sum;
}

export function endPoseOfSequence(elements, startPose, tol = 1e-8) {
	let pose = startPose;
	for (const el of elements) {
		pose = isTransition(el) ? endPoseTransition(el, pose, tol) : endPoseFix(el, pose);
	}
	return pose;
}

// Pose bei globaler Station sGlobal (0..Gesamtlänge)
export function poseAtS(elements, startPose, sGlobal, tol = 1e-8) {
	const Ltot = totalLength(elements);
	const s = Math.max(0, Math.min(sGlobal, Ltot));

	let pose = startPose;
	let acc = 0;

	for (const el of elements) {
		const L = arcLengthOf(el);
		const nextAcc = acc + L;

		if (s <= nextAcc + EPS) {
			const localS = s - acc;
			return isTransition(el)
			? poseAtTransition(el, pose, localS, tol)
			: poseAtFix(el, pose, localS);
		}

		// advance whole element
		pose = isTransition(el) ? endPoseTransition(el, pose, tol) : endPoseFix(el, pose);
		acc = nextAcc;
	}

	return pose; // falls s==Ltot
}

// Sampling entlang Gesamtlänge mit Schrittweite ds (inkl. Start/Ende)
export function sampleSequence(elements, startPose, ds = 10, tol = 1e-8) {
	const Ltot = totalLength(elements);
	if (!isFinite(ds) || ds <= 0) throw new Error("sampleSequence(): ds must be > 0");

	const out = [];
	out.push({ s: 0, pose: startPose });

	let s = ds;
	while (s < Ltot - EPS) {
		out.push({ s, pose: poseAtS(elements, startPose, s, tol) });
		s += ds;
	}

	out.push({ s: Ltot, pose: poseAtS(elements, startPose, Ltot, tol) });
	return out;
}
