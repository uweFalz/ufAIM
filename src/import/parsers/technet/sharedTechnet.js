// src/import/parsers/technet/sharedTechnet.js
//
// Shared Technet domain reference
// - no binary decoder
// - no byte-layout runtime
// - no parser execution logic
//
// Zweck:
// - gemeinsame Satzarten-/Sheet-Struktur für Technet-Welt
// - nutzbar für VermEsn und GNDedit
// - explizite Wissensbasis aus Handbuch + Projekterkenntnis
//
// Hinweis:
// - diese Datei ist fachliche Referenz, nicht Parserlogik
// - Mehrdeutigkeiten und Altlasten sollen sichtbar bleiben
//
// @baustelle [LANGUAGE]
// Sprachlich leicht an landFAT-/Contract-Vokabular angenähert,
// aber bewusst fachreferenziell belassen.

export const TECHNET_TYPES = {
	Kz: {
		0: { label: "Gerade", status: "verified", targetTypeHint: "Line" },
		1: { label: "Kreis", status: "verified", targetTypeHint: "Curve" },
		2: { label: "Klothoide", status: "verified", targetTypeHint: "Spiral" },
		3: { label: "ÜB S-Form", status: "verified", targetTypeHint: "Spiral" },
		4: { label: "Bloss", status: "verified", targetTypeHint: "Spiral" },
		5: { label: "Gerade/Knick", status: "verified", targetTypeHint: "Kink" },
		6: { label: "KSprung", status: "verified", targetTypeHint: "StaEquation" },
		7: { label: "S-Form (1f geschw.)", status: "verified", targetTypeHint: "Spiral" },
		8: { label: "Bloss (1f geschw.)", status: "verified", targetTypeHint: "Spiral" },
	},
};

export const TECHNET_DB = {
	meta: {
		vendor: "TechNet / VermEsn / GND",
		status: "handbook + project knowledge",
		note: "Shared domain reference for Technet-family formats. Not a binary format spec.",
	},

	sheets: {
		X_ASC11_PP: {
			desc: "Satzart 11 Punkt allgemein",
			rows: {
				PAD:      { desc: "Punktadresse" },
				PART:     { desc: "Punktart (Featurenummer)" },
				STATION:  { desc: "Station bzw. km-Wert" },
				PSTRECKE: { desc: "Streckennummer bzw. Gleisnummer" },
				PSTRRIKZ: { desc: "Richtungskennzeichen" },
			},
		},

		X_ASC12_PL: {
			desc: "Satzart 12 Punkt Lage",
			rows: {
				PAD:  { desc: "Punktadresse" },
				LSYS: { desc: "HorizontalCoordinateSystemName / Lagesystem" },
				Y:    { desc: "Easting / Rechtswert in meter" },
				X:    { desc: "Northing / Hochwert in meter" },
			},
		},

		X_ASC13_PH: {
			desc: "Satzart 13 Punkt Höhe",
			rows: {
				PAD:  { desc: "Punktadresse" },
				HSYS: { desc: "VerticalCoordinateSystemName / Höhensystem" },
				H:    { desc: "Elevation / Höhe in meter" },
			},
		},

		X_ASC21_EL: {
			desc: "Satzart 21 Elemente Lage",
			rows: {
				PAD1:    { desc: "Punktadresse Anfangspunkt" },
				PAD2:    { desc: "Punktadresse Endpunkt" },
				ELSYS:   { desc: "Koordinatensystem des Richtungswinkels" },
				ELTYP:   { desc: "Elemententyp" },
				ELPAR1:  { desc: "Länge" },
				ELPAR2:  { desc: "Anfangsradius" },
				ELPAR3:  { desc: "Endradius" },
				ELARIWI: { desc: "Richtungswinkel am Anfang" },
			},
		},

		X_ASC22_EH: {
			desc: "Satzart 22 Elemente Höhe",
			rows: {
				PAD1:   { desc: "Punktadresse Anfangspunkt" },
				PAD2:   { desc: "Punktadresse Endpunkt" },
				EHSYS:  { desc: "Höhensystem" },
				EHTYP:  { desc: "Elemententyp" },
				EHPAR1: { desc: "Länge" },
				EHPAR2: { desc: "Steigung am Anfang in ‰" },
				EHPAR3: { desc: "Steigung am Ende in ‰" },
			},
		},

		X_ASC23_EU: {
			desc: "Satzart 23 Elemente Überhöhung",
			rows: {
				PAD1:   { desc: "Punktadresse Anfangspunkt" },
				PAD2:   { desc: "Punktadresse Endpunkt" },
				EUTYP:  { desc: "Elemententyp" },
				EUPAR1: { desc: "Länge" },
				EUPAR2: { desc: "Überhöhung am Anfang in meter" },
				EUPAR3: { desc: "Überhöhung am Ende in meter" },
			},
		},

		X_ASC24_EK: {
			desc: "Satzart 24 Elemente Kilometrierungslinie",
			rows: {
				PAD1:    { desc: "Punktadresse Anfangspunkt" },
				PAD2:    { desc: "Punktadresse Endpunkt" },
				EKSYS:   { desc: "Koordinatensystem des Richtungswinkels" },
				EKTYP:   { desc: "Elemententyp" },
				EKPAR1:  { desc: "Länge" },
				EKPAR2:  { desc: "Anfangsradius bzw. bei Richtgeraden Knickwinkel +200 gon" },
				EKPAR3:  { desc: "Endradius" },
				EKARIWI: { desc: "Richtungswinkel am Anfang" },
				EKAKM:   { desc: "Kilometer am Anfang" },
				EKEKM:   { desc: "Kilometer am Ende" },
			},
		},
	},

	types: {
		ELTYP: {
			...TECHNET_TYPES.Kz,
			3: { ...TECHNET_TYPES.Kz[3], label: "Übergangsbogen S-Form" },
			5: { ...TECHNET_TYPES.Kz[5], label: "Richtgerade / Knick am Ende" },
		},

		EHTYP: {
			0: { label: "Gerade" },
			1: { label: "quadratische Parabel" },
			2: { label: "überhöhter Weichenabzweig" },
		},

		EUTYP: {
			0: { label: "gleichbleibende Überhöhung" },
			2: { label: "Klotoide" },
			3: { label: "S-Förmige Rampe" },
			4: { label: "Bloss-Rampe" },
			7: { label: "Gleisschere S-Form" },
			8: { label: "Gleisschere Bloss" },
		},

		EKTYP: {
			0: { label: "Gerade", targetTypeHint: "Line" },
			1: { label: "Kreis", targetTypeHint: "Curve" },
			2: { label: "Klotoide", targetTypeHint: "Spiral" },
			3: { label: "Übergangsbogen S-Form", targetTypeHint: "Spiral" },
			4: { label: "Blosskurve", targetTypeHint: "Spiral" },
			5: { label: "Richtgerade / Knick am Ende", targetTypeHint: "Kink" },
			6: { label: "Kilometersprung", targetTypeHint: "StaEquation" },
			7: { label: "S-Form (einfach geschwungen)", targetTypeHint: "Spiral" },
			8: { label: "Bloss (einfach geschwungen)", targetTypeHint: "Spiral" },
		},
	},

	specialCases: {
		gleisscheren: {
			status: "important-open-topic",
			eyeCatcher: true,
			note: "Technet/GND semantics can reuse identical structural fields with altered meaning in switch-scissor / ramp contexts.",
		},

		kmLineGradient: {
			status: "important-open-topic",
			eyeCatcher: true,
			note: "Gradient definitions may be tied to kilometering line rather than true track stationing.",
		},

		mixedCoordinateSystems: {
			status: "important-contract-topic",
			eyeCatcher: true,
			note: "Mixed LSYS / HSYS situations should be split into separate landFAT parts, not merged implicitly.",
		},
	},
};

export const TECHNET_SHEET_NAMES = {
	PP: "X_ASC11_PP",
	PL: "X_ASC12_PL",
	PH: "X_ASC13_PH",
	EL: "X_ASC21_EL",
	EH: "X_ASC22_EH",
	EU: "X_ASC23_EU",
	EK: "X_ASC24_EK",
};

export const TECHNET_EDGE_FAMILIES = ["EL", "EH", "EU", "EK"];
