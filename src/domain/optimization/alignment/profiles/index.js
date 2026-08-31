// src/domain/optimization/alignment/profiles/index.js
//
// Declared design profiles for AXTRAN2.
//
// This file is DECLARATION, not kernel. The calculation kernel contains no
// design limit of its own and cannot: what a curve is allowed to be comes from
// a rule book, and a rule book is not a property of an optimiser. Everything
// here is a number someone wrote down, together with where they wrote it.
//
// Every profile below carries `status: "candidate"`. That is not modesty, it is
// the accurate state: the values were entered from the sources named in each
// `source` string, and the current text of those sources was NOT read while
// writing this file. Before a profile is used for anything anyone signs, its
// numbers have to be checked against the rule book it names, and its status
// moved to "confirmed". Nothing in the kernel does that; a human does.
//
// What the sources mean here:
//
//   "EBO § 6"    the German Eisenbahn-Bau- und Betriebsordnung, the binding
//                floor. Where it speaks, the kinematics may not go below it.
//   "Ril ..."    the operator's design rules, which is where the rate limits
//                live. These are the values most in need of checking, because
//                they differ by line category and by whether the case is the
//                normal one or an exception.
//   "project"    a number this project chose, which the rule book leaves open.
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
		source: "EBO § 6 with the operator's design rules; entered, not verified",
		status: "candidate",
		speed: { value: kmh(speedKmh), source: "project: declared design speed" },
		maximumCant: {
			value: mm(cantMm),
			source: "Ril 800.0110: largest cant for the line category — CHECK",
		},
		maximumCantDeficiency: {
			value: mm(cantDeficiencyMm),
			source: "Ril 800.0110: largest cant deficiency, normal case — CHECK",
		},
		absoluteMinimumRadius: {
			value: 300,
			source: "EBO § 6: smallest radius in through main tracks — CHECK",
		},
		maximumCantRate: {
			value: mm(50),
			source: "Ril 800.0110: largest rate of cant change over time — CHECK",
		},
		maximumDeficiencyRate: {
			value: mm(55),
			source: "Ril 800.0110: largest rate of deficiency change over time — CHECK",
		},
		cantGradient: {
			value: 400,
			source: "Ril 800.0110: flattest admissible cant ramp, 1:n — CHECK",
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
