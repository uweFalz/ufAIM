// src/import/parsers/technet/vermEsn/semanticMap.GRA.js
//
// VermEsn GRA -> landFAT semantic map
//
// @baustelle [CONTRACT]
// Diese Datei beschreibt Mapping-/Semantik-Wissen.
// Sie ist DOKUMENTATION / Referenz für Parserlogik,
// aber nicht selbst der Parser.
//
// @baustelle [TERMINOLOGY]
// Auf neue landFAT-Terminologie gezogen:
// - GRA wird nicht als nacktes Profile-Root verstanden,
//   sondern als Alignment mit leerem coordGeom und profile
// - Profile -> ProfAlign -> pvis[]
//
// @baustelle [SOURCE-NEAR]
// Keine Rekonstruktion vertikaler Ausrundungen.
// Keine implizite Parabel-Bildung.
// Keine km-/Gleis-Interpretation.

export const VERMESN_GRA_SEMANTIC_MAP = {
	formatId: "vermEsn",
	fileType: "GRA",
	version: 2,

	defaults: {
		units: {
			linearUnit: "meter",
			elevationUnit: "meter",
			angularUnit: null,
		},

		coordinateSystem: {
			horizontalCoordinateSystemName: null,
			verticalCoordinateSystemName: null,
		},

		curvature: {
			representation: "radius",
			unit: "meter",
		},
	},

	fieldMap: {
		S: {
			sourceName: "station",
			defaultTarget: "Alignment.profile.profAlign.pvis[*].station",
			as: "Measure",
			valueSemantic: {
				unit: "meter",
			},
		},

		H: {
			sourceName: "height",
			defaultTarget: "Alignment.profile.profAlign.pvis[*].elevation",
			as: "Measure",
			valueSemantic: {
				unit: "meter",
			},
			note: "H ist Höhen-/Profilwert, nicht Point2D.northing.",
		},

		R: {
			sourceName: "radius",
			defaultTarget: "Alignment.profile.profAlign.pvis[*].extras.sourceSemantics.radius",
			as: "source-near vertical radius hint",
			valueSemantic: {
				unit: "meter",
			},
			note: "Bleibt source-nah in extras; keine vertikale Kurvenrekonstruktion im Parser.",
		},

		T: {
			sourceName: "tangentL",
			defaultTarget: "Alignment.profile.profAlign.pvis[*].extras.sourceSemantics.tangentLength",
			as: "source-near tangent length hint",
			valueSemantic: {
				unit: "meter",
			},
			note: "Nicht arcLength; bleibt bewusst source-nah.",
		},

		Pkt: {
			sourceName: "pointNumber",
			defaultTarget: "Alignment.profile.profAlign.pvis[*].extras.sourceSemantics.pointNumber",
			as: "source-near point reference",
		},
	},

	typeDispatch: {
		default: {
			targetType: "ProfilePVI",
			note: "GRA wird source-nah als PVI-/Profilpunktfolge unter Alignment.profile.profAlign.pvis[] gehoben.",
		},
	},

	specialCases: {
		semanticOverrides: [],

		semanticAlerts: {
			gleisscheren: {
				status: "source-evidence-supported",
				eyeCatcher: true,
				note: "GRA kann laut Handbuch / Altbestand auch Gleisscheren-/Rampen-Semantik tragen; dieselben Felder werden dann anders gelesen.",
				fieldMeaningShift: {
					S: "Station RE1 statt Station NW",
					H: "Station RA statt Höhe NW",
					R: "Station RE2 statt Ausrundungsradius",
					T: "Überhöhung1 + Kennzeichen Rampe statt Tangentenlänge",
					Pkt: "Überhöhung2 bzw. kontextabhängige Zusatzbedeutung",
				},
				parserRule: "GRA(0).S und GRA(0).Pkt bestimmen die getrennten Folgen aus Neigungswechseln und Gleisscheren. Gleisscheren source-nah als gekoppelte TRA/GRA-Konstruktionsclaims erhalten; niemals als PVI interpretieren oder ohne TRA-Bindung berechnen.",
			},

			kmLineGradientMarkers: {
				status: "open-topic",
				eyeCatcher: true,
				note: "Bei auf Kilometerlinie definierter Gradiente können um km-Sprünge fiktive Neigungswechsel mit extrem großen Tangentenlängen als Marker auftreten.",
				parserRule: "Nicht berechnen, sondern als mögliche Sondermarker kennzeichnen.",
			},

			stationReference: {
				status: "important-open-topic",
				eyeCatcher: true,
				note: "GRA selbst codiert nicht explizit, ob die Stationierung zur km-Linie oder zur echten Gleisachse gehört.",
				parserRule: "Im Parser als sourceSemantics.stationReference.mode='unknown' dokumentieren.",
			},
		},
	},
};
