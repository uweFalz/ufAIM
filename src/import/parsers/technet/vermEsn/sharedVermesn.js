// src/import/parsers/technet/vermEsn/sharedVermesn.js
//
// Shared VermEsn source/layout reference
//
// Zweck:
// - gemeinsame Layout-/Quellreferenz für VermEsn TRA/GRA
// - keine Parserlogik
// - keine landFAT-Berechnung
// - keine sparse-Logik
//
// @baustelle [CONTRACT-LANGUAGE]
// Sprachlich auf den LAND_FAT_CONTRACT gezogen:
// - meter statt m
// - radian statt rad
// - sourceSemantics.angular explizit
// - Radius-/Knick-/Sonderfeld-Semantik klarer dokumentiert
//
// @baustelle [SOURCE-NEAR]
// Diese Datei beschreibt Quellformate.
// Sie darf landFAT-Zielsprache andeuten, aber keine Umrechnung / Ableitung vornehmen.

import { TECHNET_TYPES } from "../sharedTechnet.js";

export const VERMESN_SOURCE_META = {
	vendor: "TechNet / Verm.EsN",
	handbook: "Nov 2000",
	reality: "files observed up to ~2010+",
	rule: "runtime behavior follows observed data, not handbook",
};

export const VERMESN_KIND_CODES = {
	TRA: TECHNET_TYPES.Kz,
};

export const VERMESN_LAYOUT_SOURCE = {
	GRA: {
		formatId: "vermEsn",
		fileType: "GRA",
		cycleSize: 36,

		sourceSemantics: {
			units: {
				linearUnit: "meter",
				elevationUnit: "meter",
				angularUnit: null,
			},
			coordinateSystem: {
				horizontalCoordinateSystemName: null,
				verticalCoordinateSystemName: null,
			},
			stationReference: {
				mode: "unknown",
				note: "GRA itself does not encode whether stationing belongs to km-line or true track alignment.",
			},
		},

		fields: [
			{
				id: "S",
				name: "station",
				off: 0,
				bytes: 8,
				kind: "f64",
				unit: "meter",
				status: "verified",
				semanticRole: "profile station",
			},
			{
				id: "H",
				name: "height",
				off: 8,
				bytes: 8,
				kind: "f64",
				unit: "meter",
				status: "verified",
				semanticRole: "profile elevation",
			},
			{
				id: "R",
				name: "radius",
				off: 16,
				bytes: 8,
				kind: "f64",
				unit: "meter",
				status: "verified",
				semanticRole: "source-near vertical radius hint",
			},
			{
				id: "T",
				name: "tangentL",
				off: 24,
				bytes: 8,
				kind: "f64",
				unit: "meter",
				status: "verified",
				semanticRole: "source-near tangent length hint",
			},
			{
				id: "Pkt",
				name: "pointNumber",
				off: 32,
				bytes: 4,
				kind: "u32",
				unit: null,
				status: "ambiguous",
				semanticRole: "source-near point reference",
				note: "Handbuch: LONG; reale Deutung ggf. kontextabhängig.",
			},
		],

		specialCases: {
			gleisscheren: {
				status: "important-open-topic",
				eyeCatcher: true,
				note: "GRA can carry switch-scissor / ramp semantics; identical fields may then have different meaning.",
				fieldMeaningShift: {
					S: "Station RE1 instead of grade-break station",
					H: "Station RA instead of elevation",
					R: "Station RE2 instead of vertical radius",
					T: "Cant1 + ramp identifier instead of tangentLength",
					Pkt: "Cant2 or context-dependent auxiliary meaning",
				},
				parserRule: "Do not reinterpret automatically; mark, warn, preserve source-near.",
			},

			kmLineGradientMarkers: {
				status: "open-topic",
				eyeCatcher: true,
				note: "Gradient defined on kilometering line may contain synthetic markers around station jumps via huge tangent lengths.",
				parserRule: "Do not calculate; only classify and preserve source-near.",
			},
		},
	},

	TRA: {
		formatId: "vermEsn",
		fileType: "TRA",
		cycleSize: 78,

		sourceSemantics: {
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
					note: "0 = north, positive clockwise.",
				},
				kinkDelta: {
					unit: "gon",
					orientation: "cw",
					origin: "west",
					note: "For Kz=5, R1 is interpreted source-near as kink angle.",
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

		fields: [
			{
				id: "R1",
				name: "radiusA",
				off: 0,
				bytes: 8,
				kind: "f64",
				unit: "meter",
				status: "verified",
				semanticRole: "radiusStart | kinkDelta",
				note: "For Kz=5 handbook describes kink-angle-related semantics, not radiusStart.",
			},
			{
				id: "R2",
				name: "radiusE",
				off: 8,
				bytes: 8,
				kind: "f64",
				unit: "meter",
				status: "verified",
				semanticRole: "radiusEnd",
			},
			{
				id: "Y",
				name: "easting",
				off: 16,
				bytes: 8,
				kind: "f64",
				unit: "meter",
				status: "verified",
				semanticRole: "start.easting",
			},
			{
				id: "X",
				name: "northing",
				off: 24,
				bytes: 8,
				kind: "f64",
				unit: "meter",
				status: "verified",
				semanticRole: "start.northing",
			},
			{
				id: "T",
				name: "direction",
				off: 32,
				bytes: 8,
				kind: "f64",
				unit: "radian",
				status: "verified",
				semanticRole: "direction / dirStart",
				valueSemantic: {
					unit: "radian",
					orientation: "cw",
					origin: "north",
				},
				note: "Source angle; parser must not convert.",
			},
			{
				id: "S",
				name: "station",
				off: 40,
				bytes: 8,
				kind: "f64",
				unit: "meter",
				status: "verified",
				semanticRole: "staStart",
			},
			{
				id: "Kz",
				name: "kindCode",
				off: 48,
				bytes: 2,
				kind: "u16",
				unit: null,
				status: "verified",
				semanticRole: "type discriminator",
			},
			{
				id: "L",
				name: "arcLength",
				off: 50,
				bytes: 8,
				kind: "f64",
				unit: "meter",
				status: "verified",
				semanticRole: "length | staEquation.delta",
			},
			{
				id: "U1",
				name: "cantA",
				off: 58,
				bytes: 8,
				kind: "f64",
				unit: "millimeter",
				status: "verified",
				semanticRole: "cant start hint",
			},
			{
				id: "U2",
				name: "cantE",
				off: 66,
				bytes: 8,
				kind: "f64",
				unit: "millimeter",
				status: "verified",
				semanticRole: "cant end hint",
			},
			{
				id: "C",
				name: "fieldC",
				off: 74,
				bytes: 4,
				kind: "f32",
				unit: null,
				status: "patched",
				source: "reverse-engineered",
				semanticRole: "vendor/source hint",
				note: "Observed modern files differ from handbook; keep source-near only.",
			},
		],

		typeDispatch: {
			0: { targetType: "Line", note: "Gerade" },
			1: { targetType: "Curve", note: "Kreis" },
			2: { targetType: "Spiral", note: "Klothoide" },
			3: { targetType: "Spiral", note: "ÜB S-Form" },
			4: { targetType: "Spiral", note: "Bloss" },
			5: { targetType: "Kink", note: "Gerade/Knick" },
			6: { targetType: "StaEquation", note: "Kilometersprung" },
			7: { targetType: "Spiral", note: "S-Form (1f geschw.)" },
			8: { targetType: "Spiral", note: "Bloss (1f geschw.)" },
		},
	},
};

export const VERMESN_LAYOUT_PATCH_NOTES = [
	{
		format: "TRA",
		field: "R1",
		status: "patched",
		reason: "semantics depend on kindCode",
		note: "For Kz=5 interpret source-near as kink delta, not radiusStart.",
	},
	{
		format: "TRA",
		field: "C",
		status: "patched",
		reason: "observed modern files differ from handbook",
		note: "Reverse-engineering suggests source/vendor helper semantics in newer files; keep source-near only.",
	},
	{
		format: "GRA",
		field: "Pkt",
		status: "openQuestion",
		reason: "handbook and observed usage differ by context",
		note: "May encode pointNumber, cant, or context-dependent packed semantics.",
	},
];

// ----------------------------------------------------------------------
// Runtime-Schicht
// ----------------------------------------------------------------------

function readAt(dv, offset, kind) {
	switch (kind) {
		case "u16": return dv.getUint16(offset, true);
		case "u32": return dv.getUint32(offset, true);
		case "f32": return dv.getFloat32(offset, true);
		case "f64": return dv.getFloat64(offset, true);
		default: return NaN;
	}
}

export function getVermEsnLayout(format) {
	const spec = VERMESN_LAYOUT_SOURCE[format];
	if (!spec) throw new Error(`Unknown VermEsn layout: ${format}`);
	return spec;
}

export function decodeBinary(buffer, format) {
	const spec = getVermEsnLayout(format);
	const dv = new DataView(buffer);

	const total = dv.byteLength;
	const n = Math.floor(total / spec.cycleSize);
	const remainder = total - n * spec.cycleSize;

	const rowsRaw = new Array(n);

	for (let i = 0; i < n; i++) {
		const pos = i * spec.cycleSize;
		const row = {};

		for (const field of spec.fields) {
			row[field.name] = readAt(dv, pos + field.off, field.kind);
		}

		rowsRaw[i] = row;
	}

	return {
		meta: {
			byteLength: total,
			cycleBytes: spec.cycleSize,
			cycles: n,
			remainderBytes: remainder,
			layoutSource: "handbook+reverse-engineered patches",
		},
		rowsRaw,
	};
}

export function baseMetaFromFile(file) {
	return {
		name: file.name,
		size: file.size,
		type: file.type || "(binary)",
		lastModified: file.lastModified,
	};
}
