// src/import/parsers/technet/vermEsn/semanticMap.TRA.js
//
// VermEsn TRA -> landFAT semantic map
//
// @baustelle [CONTRACT]
// Diese Datei beschreibt Mapping-/Semantik-Wissen.
// Sie ist DOKUMENTATION / Referenz für Parserlogik,
// aber nicht selbst der Parser.
//
// @baustelle [TERMINOLOGY]
// Auf neue landFAT-Terminologie gezogen:
// - Alignment.coordGeom.elements[]
// - Line.direction
// - Curve.dirStart / dirEnd
// - Spiral.dirStart / dirEnd / theta
// - Kink als eigener Typ
// - Point2D mit easting / northing
//
// @baustelle [SOURCE-NEAR]
// Mapping bleibt source-nah.
// Keine Umrechnung, keine Geometrieberechnung, kein sparse.

export const VERMESN_TRA_SEMANTIC_MAP = {
	formatId: "vermEsn",
	fileType: "TRA",
	version: 2,

	defaults: {
		units: {
			linearUnit: "meter",
			elevationUnit: "meter",
			angularUnit: "radian",
		},

		coordinateSystem: {
			horizontalCoordinateSystemName: null,
			verticalCoordinateSystemName: null,
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

		cant: {
			unit: "millimeter",
		},
	},

	fieldMap: {
		R1: {
			sourceName: "radiusA",
			defaultTarget: "Alignment.coordGeom.elements[*].radiusStart",
			as: "RadiusValue | number",
			note: "Je nach Kz Anfangsradius oder Sonderbedeutung.",
		},

		R2: {
			sourceName: "radiusE",
			defaultTarget: "Alignment.coordGeom.elements[*].radiusEnd",
			as: "RadiusValue | number",
			note: "Je nach Kz Endradius oder gleichbleibender Radius.",
		},

		Y: {
			sourceName: "easting",
			defaultTarget: "Alignment.coordGeom.elements[*].start.easting",
			as: "Point2D.easting",
		},

		X: {
			sourceName: "northing",
			defaultTarget: "Alignment.coordGeom.elements[*].start.northing",
			as: "Point2D.northing",
		},

		T: {
			sourceName: "direction",
			defaultTarget: "Alignment.coordGeom.elements[*].direction",
			as: "Angle",
			valueSemantic: {
				unit: "radian",
				orientation: "cw",
				origin: "north",
			},
			note: "Je nach Elementtyp als Line.direction oder Curve/Spiral.dirStart verwendet.",
		},

		S: {
			sourceName: "station",
			defaultTarget: "Alignment.coordGeom.elements[*].staStart",
			as: "Measure",
			valueSemantic: {
				unit: "meter",
			},
		},

		Kz: {
			sourceName: "kindCode",
			defaultTarget: "Alignment.coordGeom.elements[*].type",
			as: "type discriminator",
			note: "Steuert Mapping auf Line / Curve / Spiral / Kink / StaEquation.",
		},

		L: {
			sourceName: "arcLength",
			defaultTarget: "Alignment.coordGeom.elements[*].length",
			as: "Measure",
			valueSemantic: {
				unit: "meter",
			},
			note: "Bei Kz=6 nicht Geometrie-Länge, sondern StaEquation.delta.",
		},

		U1: {
			sourceName: "cantA",
			defaultTarget: "Alignment.cant[*].appliedCant",
			as: "Measure",
			valueSemantic: {
				unit: "millimeter",
			},
			note: "Source-nah am Stationsanfang des Datensatzes.",
		},

		U2: {
			sourceName: "cantE",
			defaultTarget: "Alignment.extras.cantHints[*].u2",
			as: "Measure-like source hint",
			valueSemantic: {
				unit: "millimeter",
			},
			note: "Bleibt zunächst source-nah in extras.cantHints; keine Endstations-Rekonstruktion im Parser.",
		},

		C: {
			sourceName: "fieldC",
			defaultTarget: "Alignment.extras.cantHints[*].c",
			as: "vendor/source hint",
			note: "Beobachtete moderne Semantik weicht vom Handbuch ab.",
		},
	},

	typeDispatch: {
		0: {
			targetType: "Line",
			note: "Gerade",
			fieldBinding: {
				direction: "T",
				length: "L",
				start: ["Y", "X"],
			},
		},

		1: {
			targetType: "Curve",
			note: "Kreis",
			fieldBinding: {
				dirStart: "T",
				length: "L",
				radius: "R1",
				start: ["Y", "X"],
			},
		},

		2: {
			targetType: "Spiral",
			note: "Klothoide",
			fieldBinding: {
				dirStart: "T",
				length: "L",
				radiusStart: "R1",
				radiusEnd: "R2",
				start: ["Y", "X"],
				spiType: "clothoid",
			},
		},

		3: {
			targetType: "Spiral",
			note: "ÜB S-Form",
			fieldBinding: {
				dirStart: "T",
				length: "L",
				radiusStart: "R1",
				radiusEnd: "R2",
				start: ["Y", "X"],
				spiType: "ÜB S-Form",
			},
		},

		4: {
			targetType: "Spiral",
			note: "Bloss",
			fieldBinding: {
				dirStart: "T",
				length: "L",
				radiusStart: "R1",
				radiusEnd: "R2",
				start: ["Y", "X"],
				spiType: "Bloss",
			},
		},

		5: {
			targetType: "Kink",
			note: "Gerade/Knick",
			fieldBinding: {
				dirStart: "T",
				length: "L",
				start: ["Y", "X"],
				delta: "R1",
			},
			overrideSemantics: {
				R1: {
					target: "Alignment.coordGeom.elements[*].delta",
					as: "Angle",
					valueSemantic: {
						unit: "gon",
						orientation: "cw",
						origin: "west",
					},
				},
			},
		},

		6: {
			targetType: "StaEquation",
			note: "Kilometersprung",
			fieldBinding: {
				station: "S",
				delta: "L",
			},
			note2: "Keine CoordGeom-Geometrie; landet in Alignment.staEquations[].",
		},

		7: {
			targetType: "Spiral",
			note: "S-Form (1f geschw.)",
			fieldBinding: {
				dirStart: "T",
				length: "L",
				radiusStart: "R1",
				radiusEnd: "R2",
				start: ["Y", "X"],
				spiType: "S-Form (1f geschw.)",
			},
		},

		8: {
			targetType: "Spiral",
			note: "Bloss (1f geschw.)",
			fieldBinding: {
				dirStart: "T",
				length: "L",
				radiusStart: "R1",
				radiusEnd: "R2",
				start: ["Y", "X"],
				spiType: "Bloss (1f geschw.)",
			},
		},
	},

	specialCases: {
		semanticOverrides: [
			{
				when: { field: "Kz", equals: 5 },
				override: {
					field: "R1",
					target: "Alignment.coordGeom.elements[*].delta",
					as: "Angle",
					valueSemantic: {
						unit: "gon",
						orientation: "cw",
						origin: "west",
					},
				},
				note: "Bei Kz=5 ist R1 kein Radius, sondern Knickwinkel.",
			},
			{
				when: { field: "Kz", equals: 6 },
				override: {
					field: "L",
					target: "Alignment.staEquations[*].delta",
					as: "Measure",
					valueSemantic: {
						unit: "meter",
					},
				},
				note: "Bei Kz=6 ist L keine Elementlänge, sondern Stationierungsdelta.",
			},
		],

		semanticAlerts: {
			endRecord: {
				status: "important-known-topic",
				eyeCatcher: true,
				note: "TRA enthält typischerweise einen zusätzlichen Endpunkt-Datensatz; der Parser darf ihn source-nah als Endpunktlieferant lesen, aber nicht als eigenes Geometrieelement interpretieren.",
			},
			radiusEqualityOnClothoid: {
				status: "open-but-handled",
				eyeCatcher: false,
				note: "Wenn R1 == R2 bei Kz=2, kann parserseitig source-nah eine Kreisrepräsentation gewählt werden. Das ist ein bewusst markierter Sonderfall.",
			},
		},
	},
};
