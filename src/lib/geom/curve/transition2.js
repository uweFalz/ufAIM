// src/lib/geom/curve/transition2.js
// Minimal: Transition-Element über lookup-basierte Krümmungsfunktion κ(s).
//
// Nutzt ufRomberg2023:
//   romberg.integrate(f, a, b) -> Number
//   romberg.integrateFresnel(tauFunc, a, b) -> { intC, intS }  // ∫cos(tau), ∫sin(tau)
//
// Konventionen (wie pose2):
// - θ (heading) in rad
// - κ > 0 => Linkskurve (CCW)
// - Pose: { p:{x,y}, t:{x,y} } (t unit)
//

import { heading, poseFromHeading } from "../frame/pose2.js";
import { romberg } from "../../math/numeric/romberg.js";

const EPS = 1e-12;

// ---- Lookup κ(s) ----
// lookup: [{s, kappa}, ...] mit 0..L
export function kappaFromLookup(lookup, s) {
	if (!lookup || lookup.length < 2) throw new Error("kappaFromLookup(): lookup too short");

	if (s <= lookup[0].s) return lookup[0].kappa;
	const last = lookup[lookup.length - 1];
	if (s >= last.s) return last.kappa;

	// minimal linear scan; später binary search
	for (let i = 0; i < lookup.length - 1; i++) {
		const a = lookup[i], b = lookup[i + 1];
		if (s >= a.s && s <= b.s) {
			const ds = b.s - a.s;
			if (Math.abs(ds) < EPS) return b.kappa; // degenerate segment
			const t = (s - a.s) / ds;
			return a.kappa + t * (b.kappa - a.kappa);
		}
	}
	return last.kappa;
}

export function makeTransition(arcLength, lookup, name = "lookup") {
	return { type: "T", arcLength, lookup, name };
}

function clampS(s, L) {
	if (s < 0) return 0;
	if (s > L) return L;
	return s;
}

// ψ(s) = ∫0..s κ(u) du
export function psiAt(element, s) {
	const L = element.arcLength;
	const ss = clampS(s, L);
	const lookup = element.lookup;
	const kappa = (u) => kappaFromLookup(lookup, u);
	return romberg.integrate(kappa, 0, ss);
}

// Pose an Station s innerhalb Transition
export function poseAtTransition(element, startPose, s) {
	const L = element.arcLength;
	if (!isFinite(L) || L < 0) throw new Error("poseAtTransition(): invalid arcLength");

	const ss = clampS(s, L);
	const x0 = startPose.p.x;
	const y0 = startPose.p.y;
	const theta0 = heading(startPose);
	const lookup = element.lookup;

	// τ(u) = θ0 + ψ(u) = θ0 + ∫0..u κ(w) dw
	// minimal korrekt (nested integral). Für Preview ok.
	const kappa = (w) => kappaFromLookup(lookup, w);
	const psi = (u) => romberg.integrate(kappa, 0, u);
	const tau = (u) => theta0 + psi(u);

	// Position via Fresnel-Integral (cos/sin gemeinsam)
	const { intC, intS } = romberg.integrateFresnel(tau, 0, ss);

	// Endheading
	const theta = theta0 + psi(ss);

	return poseFromHeading(x0 + intC, y0 + intS, theta);
}

export function endPoseTransition(element, startPose) {
	return poseAtTransition(element, startPose, element.arcLength);
}
