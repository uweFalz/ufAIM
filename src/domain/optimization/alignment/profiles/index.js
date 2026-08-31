// src/domain/optimization/alignment/profiles/index.js
//
// Declared design profiles for AXTRAN2.
//
// This file is DECLARATION, not kernel. The calculation kernel contains no
// design limit of its own and cannot: what a curve is allowed to be comes from
// a rule book, and a rule book is not a property of an optimiser. Everything
// here is a number someone wrote down, together with where they wrote it.
//
// Each limit carries `verified: true` only if its source has actually been read.
// A profile cannot call itself "confirmed" while any of its limits has not - the
// profile module refuses it - so the status below is a consequence of the table,
// not a judgement anyone made about it.
//
// What has been read, and what has not:
//
//   EBO § 6      READ, at gesetze-im-internet.de and cross-checked at buzer.de
//                on 2026-08-31. It gives three of the numbers here: the 300 m
//                floor for through main tracks (§ 6 (1)), the 180 mm cap on cant
//                (§ 6 (3)), and the flattest admissible cant ramp of 1:400
//                (§ 6 (4)). It states NOTHING about cant deficiency or about the
//                rate of cant change over time, which was checked explicitly.
//
//   Ril 800.0110 NOT READ, and not publicly available. Every rate limit lives
//                there, and every one of them is still marked CHECK. These are
//                also the values that matter most: a wrong rate changes every
//                transition length in the alignment.
//
//   project      a number this project chose, which the rule book leaves open.
//
// One correction from that reading: the 1:400 cant ramp was attributed here to
// Ril 800.0110. It is EBO § 6 (4) - a binding regulation, not an operator's
// design rule - and it is now cited as such.
//
// Where a profile belongs. A profile is declared WITH THE PROBLEM, because two
// alignments in one project can sit under different rules - a new line and a
// reconstruction, an open line and a station throat. What is shared is named
// here so that it can be referenced rather than retyped, and what is local
// belongs in the problem's own `exceptions`, with its own reason.

import { createAlignmentDesignProfile } from "../AlignmentDesignProfile.js";

/** km/h to m/s, because rule books speak in km/h and the kinematics does not. */
export const kmh = (value) => (value * 1000) / 3600;

/** millimetres to metres, because cant is quoted in millimetres everywhere. */
export const mm = (value) => value / 1000;

/**
 * A through main track under EBO, at a declared design speed.
 *
 * The radius is the larger of the EBO floor and what the cant and deficiency
 * limits allow at that speed, so raising the speed raises the radius and never
 * the other way round.
 *
 * @param {object} input
 * @param {number} input.speedKmh
 * @param {number} [input.cantMm]              applied cant, millimetres
 * @param {number} [input.cantDeficiencyMm]
 * @param {Record<string, object>} [input.exceptions]
 */
export function hauptbahn({
	speedKmh,
	cantMm = 160,
	cantDeficiencyMm = 100,
	exceptions = undefined,
} = {}) {
	return createAlignmentDesignProfile({
		id: `hauptbahn-V${speedKmh}`,
		source: "EBO § 6 for the regulatory limits, the operator's design rules for the rates",
		status: "candidate",
		speed: {
			value: kmh(speedKmh),
			source: "project: declared design speed",
			verified: true,
		},
		maximumCant: {
			value: mm(cantMm),
			source: "Ril 800.0110: largest cant for the line category — CHECK; "
				+ "below the EBO § 6 (3) cap of 180 mm, which is checked here",
		},
		regulatoryCantLimit: {
			value: mm(180),
			source: "EBO § 6 (3): cant may not exceed 180 mm, operational deviations included",
			verified: true,
		},
		maximumCantDeficiency: {
			value: mm(cantDeficiencyMm),
			source: "Ril 800.0110: largest cant deficiency, normal case — CHECK; "
				+ "EBO § 6 states no limit on this, so nothing binding constrains it",
		},
		absoluteMinimumRadius: {
			value: 300,
			source: "EBO § 6 (1): smallest radius in through main tracks, new construction",
			verified: true,
		},
		maximumCantRate: {
			value: mm(50),
			source: "Ril 800.0110: largest rate of cant change over time — CHECK; "
				+ "EBO § 6 states no limit on this",
		},
		maximumDeficiencyRate: {
			value: mm(55),
			source: "Ril 800.0110: largest rate of deficiency change over time — CHECK; "
				+ "EBO § 6 states no limit on this",
		},
		cantGradient: {
			value: 400,
			source: "EBO § 6 (4): every change of cant runs over a ramp no steeper than 1:400",
			verified: true,
		},
		minimumLength: {
			straight: { value: 20, source: "project: shortest element the sequence keeps" },
			arc: { value: 20, source: "project: shortest element the sequence keeps" },
		},
		exceptions,
	});
}

/**
 * The profiles this repository ships, by name. A project may reference one of
 * these or declare its own; nothing here is privileged.
 */
export const DECLARED_PROFILES = Object.freeze({
	"hauptbahn-V100": () => hauptbahn({ speedKmh: 100 }),
	"hauptbahn-V160": () => hauptbahn({ speedKmh: 160 }),
	"hauptbahn-V200": () => hauptbahn({ speedKmh: 200, cantDeficiencyMm: 130 }),
});
