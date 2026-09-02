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
// What is NOT in the table, and deliberately: the dynamic gauge. It is geometry
// of the vehicle-track pair rather than a rule-book limit, it lives in the
// profile module as a constant, and the check on it is that it reproduces the
// 11.8 factor quoted for the equilibrium cant. See STANDARD_DYNAMIC_GAUGE.
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
//   Ril 800.0110 READ, version 3.0, valid from 2021-02-01. It settles the cant
//                (Tab. 4), the deficiency (Tab. 5) and the ramp gradient
//                (Tab. 7), and it governs the transition through that gradient
//                and a ramp length - it contains NO rate over time at all, not
//                "mm/s", not "Änderungsgeschwindigkeit", not once in 31 pages.
//                Two rate limits used to be declared here and attributed to it.
//                They are gone, and so is the rate-based rule they fed: the
//                kernel now states the requirement the way the governing rule
//                book does.
//
//                Not readable from the document's text layer: Tab. 8's cells,
//                which give the ramp length per ramp form. They are equation
//                graphics. For a straight ramp this costs nothing, because a
//                gradient of 1:m says exactly that du of cant takes m*du metres;
//                for the curved forms the factors were not read.
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
	cantDeficiencyMm = 130,
	// Ril 800.0110 Tab. 7: 1:600 or flatter is the planning value, 1:400 the
	// discretion limit. The planning value is the default; designing at the
	// discretion limit everywhere is a decision and has to be made as one.
	rampGradient = 600,
	exceptions = undefined,
} = {}) {
	return createAlignmentDesignProfile({
		id: `hauptbahn-V${speedKmh}`,
		source: "EBO § 6 for the regulatory limits, the operator's design rules for the rates",
		// Every limit below names a source that has been read: Ril 800.0110 V3.0 for
		// the cant, the deficiency and the ramp gradient; EBO § 6 for the three
		// regulatory bounds; the project for its own element floors. The module
		// refuses this status while any of them is unread.
		status: "confirmed",
		speed: {
			value: kmh(speedKmh),
			source: "project: declared design speed",
			verified: true,
		},
		maximumCant: {
			value: mm(cantMm),
			source: "Ril 800.0110 (V3.0, 2021-02-01) Tab. 4: 160 mm on ballasted track, "
				+ "170 mm on slab track; the table cites the EBO § 6 (3) cap of 180 mm itself",
			verified: cantMm <= 160,
		},
		regulatoryCantLimit: {
			value: mm(180),
			source: "EBO § 6 (3): cant may not exceed 180 mm, operational deviations included",
			verified: true,
		},
		maximumCantDeficiency: {
			value: mm(cantDeficiencyMm),
			source: "Ril 800.0110 (V3.0) Tab. 5: zul uf = 130 mm at r >= 650 m, 150 mm for "
				+ "approved vehicles; 100 mm applies to temporary bridges and to axle loads "
				+ "above 22.5 t, not generally. EBO states no limit on this at all",
			verified: cantDeficiencyMm <= 130,
		},
		absoluteMinimumRadius: {
			value: 300,
			source: "EBO § 6 (1): smallest radius in through main tracks, new construction",
			verified: true,
		},
		// NOT a Ril 800.0110 quantity. Ril governs the transition through the ramp
		// gradient (Tab. 7) and the ramp length (Tab. 8), and states no rate over
		// time anywhere. These two are the EN 13803 formulation of the same
		// requirement, kept because this kernel's transition rule is written that
		// way, and unverified because EN 13803 has not been read.
		cantGradient: {
			value: rampGradient,
			source: "Ril 800.0110 (V3.0) Tab. 7: Regelwert 1:600 or flatter, Ermessensgrenze "
				+ "1:400, Mindestwert 1:3000 (1:1500 for a curved ramp), flatter than that on "
				+ "slab track with central approval",
			verified: true,
		},
		regulatoryGradientLimit: {
			value: 400,
			source: "EBO § 6 (4): a cant ramp may be no steeper than 1:400, which Ril 800.0110 "
				+ "Tab. 7 cites as the EBO limit for Hauptbahnen",
			verified: true,
		},
		minimumLength: {
			// The project's own decision, so its source is the project and reading
			// it is not pending on anyone. Ril states no such floor for straights
			// and arcs; what it constrains is the transition, through Tab. 7.
			straight: { value: 20, source: "project: shortest element the sequence keeps", verified: true },
			arc: { value: 20, source: "project: shortest element the sequence keeps", verified: true },
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
	"hauptbahn-V200": () => hauptbahn({ speedKmh: 200 }),
});
