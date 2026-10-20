// src/domain/optimization/alignment/DesignProfileChoice.js
//
// AXTRAN2 Calculation Kernel - the Hauptbahn profile an as-built alignment
// admits: the fastest candidate whose limits the geometry meets, with the
// radii, lengths and ramps it does not meet inherited as exceptions, so
// that the as-built track is never out of reach of its own constraints.
// Lifted from test/axtran2/corpus/createTraScenario.mjs on 2026-10-21; the
// corpus and the adapter choose from here.

import { hauptbahn } from "./profiles/index.js";

export const SPEED_CANDIDATES = Object.freeze([200, 160, 140, 120, 100, 80]);

/**
 * The fastest Hauptbahn profile the truth admits, with exceptions where it
 * does not. Judged against the bound form's floors, which are the conservative
 * ones: the exact ramp rule asks less of a transition between similar radii.
 */
export function chooseProfile(elements, { cantMm = 130, sourceName = "as-built", speedKmh: asked = null } = {}) {
	const arcs = elements.filter((e) => e.type === "arc" && e.length > 0);
	let chosen = null;
	// a speed asked for is taken as it is, with the same inherited exceptions
	// where the file does not admit it; otherwise the fastest candidate that does
	const candidates = Number.isFinite(asked) && asked > 0 ? [asked] : SPEED_CANDIDATES;
	for (const speedKmh of candidates) {
		const profile = hauptbahn({ speedKmh, cantMm });
		const tooTight = arcs.filter((e) => 1 / Math.abs(e.curvature) < profile.minimumRadius * (1 - 1e-9));
		// every kind has a floor: the ramp rule's for a transition, the profile's
		// own declared one for a straight or an arc. A turnout's 15 m straight
		// against a declared 20 m put the truth out of reach, and the subproblem
		// relaxed for 185 iterations without a verdict.
		const tooShort = elements.filter((e) => e.length > 0
			&& e.length < profile.minimumLengthFor(e.type, e.id) * (1 - 1e-9));
		chosen = { speedKmh, tooTight, tooShort };
		if (tooTight.length === 0 && tooShort.length === 0) break;
	}
	const exceptions = {};
	for (const e of chosen.tooTight) {
		exceptions[e.id] = { source: `corpus: inherited radius of ${sourceName}`, minimumRadius: (1 / Math.abs(e.curvature)) * (1 - 1e-6) };
	}
	for (const e of chosen.tooShort) {
		exceptions[e.id] = { ...(exceptions[e.id] ?? { source: `corpus: inherited ${e.type} of ${sourceName}` }), minimumLength: e.length * (1 - 1e-6) };
	}
	// The exact form asks each transition for m·|Δu| between its neighbours'
	// cants. A length exception lowers the bound, not that row: a 0.2 m
	// transition into a 190 m arc needs its own, steeper m or the truth is out
	// of reach under rampLengthAs "constraint" and never fairly measurable.
	const profile = hauptbahn({ speedKmh: chosen.speedKmh, cantMm });
	const tooSteep = [];
	elements.forEach((e, index) => {
		if (e.type !== "transition" || !(e.length > 0) || !profile.rampGradient) return;
		const entry = elements[index - 1]?.curvature ?? 0;
		const exit = elements[index + 1]?.curvature ?? 0;
		const change = Math.abs(profile.cantAt(exit) - profile.cantAt(entry));
		if (change === 0 || e.length >= profile.rampGradient * change * (1 - 1e-9)) return;
		tooSteep.push(e);
		exceptions[e.id] = {
			...(exceptions[e.id] ?? { source: `corpus: inherited ramp of ${sourceName}` }),
			rampGradient: (e.length / change) * (1 - 1e-6),
		};
	});
	return Object.freeze({
		speedKmh: chosen.speedKmh,
		design: hauptbahn({ speedKmh: chosen.speedKmh, cantMm, exceptions: Object.keys(exceptions).length ? exceptions : undefined }),
		exceptionCount: Object.keys(exceptions).length,
		inheritedRadii: chosen.tooTight.length,
		inheritedLengths: chosen.tooShort.length,
		inheritedRamps: tooSteep.length,
	});
}

