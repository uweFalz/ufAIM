// src/import/parsers/technet/shared/traLikeSemanticMaps.js
//
// Shared TRA-like semantic maps
//
// Zweck:
// Kleiner gemeinsamer Semantik-Kern für traLikeCoordGeom.js.
//
// Dieser Kern beschreibt nur das, was der gemeinsame Builder wirklich braucht:
// - kindCode -> targetType / spiType
// - direction-Semantik
// - kink-delta-Semantik
// - Basis-Units für station / length / radius
//
// @baustelle [SMALL-CONTRACT]
// Dies ist bewusst NICHT die vollständige semanticMap-Welt.
// Große, formatnahe semanticMap-Dateien (z. B. semanticMap.TRA.js)
// dürfen später ausführlicher bleiben.
//
// @baustelle [GND-MVP]
// GND bekommt hier zunächst nur den kleinen EL/EK-Kern.
// Eine vollständige semanticMap.GND.js kann später daraus wachsen.

function makeSharedTypeDispatch() {
	return {
		0: { targetType: "Line",        spiType: null,                      label: "Gerade" },
		1: { targetType: "Curve",       spiType: null,                      label: "Kreis" },
		2: { targetType: "Spiral",      spiType: "Klothoide",               label: "Klothoide" },
		3: { targetType: "Spiral",      spiType: "ÜB S-Form",               label: "ÜB S-Form" },
		4: { targetType: "Spiral",      spiType: "Bloss",                   label: "Bloss" },
		5: { targetType: "Kink",        spiType: null,                      label: "Gerade/Knick" },
		6: { targetType: "StaEquation", spiType: null,                      label: "Kilometersprung" },
		7: { targetType: "Spiral",      spiType: "S-Form (1f geschw.)",     label: "S-Form (1f geschw.)" },
		8: { targetType: "Spiral",      spiType: "Bloss (1f geschw.)",      label: "Bloss (1f geschw.)" },
	};
}

export function getTraLikeSemanticMapForTRA() {
	return {
		formatId: "vermEsn",
		fileType: "TRA",
		version: 1,

		defaults: {
			units: {
				linearUnit: "meter",
				elevationUnit: "meter",
				angularUnit: "radian",
			},

			angular: {
				direction: {
					unit: "radian",
					orientation: "cw",
					origin: "north",
				},
				kinkDelta: {
					unit: "gon",
					orientation: "cw",
					origin: "west",
				},
			},

			curvature: {
				representation: "radius",
				unit: "meter",
			},

			station: {
				unit: "meter",
			},
		},

		typeDispatch: makeSharedTypeDispatch(),
	};
}

export function getTraLikeSemanticMapForGND() {
	return {
		formatId: "gndEdit",
		fileType: "EL_EK",
		version: 1,

		defaults: {
			units: {
				linearUnit: "meter",
				elevationUnit: "meter",
				angularUnit: "gon",
			},

			angular: {
				direction: {
					unit: "gon",
					orientation: "cw",
					origin: "north",
				},
				kinkDelta: {
					unit: "gon",
					orientation: "cw",
					origin: "west",
				},
			},

			curvature: {
				representation: "radius",
				unit: "meter",
			},

			station: {
				unit: "meter",
			},
		},

		typeDispatch: makeSharedTypeDispatch(),
	};
}
