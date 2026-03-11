// src/import/parsers/parseLandXML.js
//
// landXML -> landFAT (v0)
// scope:
// - meta
// - units
// - coordinateSystem
// - alignments[]
//   - coordGeom[] with Line / Curve / Spiral
//
// intentionally ignored in v0:
// - IrregularLine, Chain
// - Profile, Cant, StaEquation, CrossSects, Superelevation
// - Feature payloads
//
// parser philosophy:
// - keep landXML semantics
// - do not normalize to sparse here
// - keep transition names (spiType) untouched

import {
	normalizeSurveyPoint,
	normalizeLandXMLRotation,
	normalizeLandXMLSpiralType,
	normalizeLandXMLDirection,
	normalizeLandXMLRadius,
	normalizeLandXMLNumber,
	normalizeLandXMLBool,
} from "../domain/landXMLNormalizers.js";

// ...
export function parseLandXML(text, sourceFile = "") {
	const xml = new DOMParser().parseFromString(String(text ?? ""), "application/xml");

	const parserError = xml.querySelector("parsererror");
	if (parserError) {
		throw new Error("parseLandXML: invalid XML");
	}

	const root = xml.documentElement;
	if (!root || localName(root) !== "LandXML") {
		throw new Error("parseLandXML: root is not LandXML");
	}

	const fat = {
		type: "landFAT",

		meta: {
			sourceFile: String(sourceFile ?? ""),
			format: "landXML",

			date: attr(root, "date"),
			time: attr(root, "time"),
			version: attr(root, "version"),
			language: attr(root, "language"),
			readOnly: parseBool(attr(root, "readOnly")),
			landXMLId: parseNum(attr(root, "LandXMLId")),
			crc: parseNum(attr(root, "crc")),
		},

		units: null,
		coordinateSystem: null,
		alignments: [],
	};

	const unitsNode = firstChild(root, "Units");
	if (unitsNode) fat.units = parseUnits(unitsNode);

	const csNode = firstChild(root, "CoordinateSystem");
	if (csNode) fat.coordinateSystem = parseCoordinateSystem(csNode);

	const alignmentNodes = allDescendants(root, "Alignment");
	fat.alignments = alignmentNodes.map((node) => parseAlignment(node, fat.meta.sourceFile));

	return fat;
}

// -----------------------------------------------------------------------------
// root-level blocks
// -----------------------------------------------------------------------------

function parseUnits(node) {
	return {
		areaUnit: attr(node, "areaUnit"),
		linearUnit: attr(node, "linearUnit"),
		volumeUnit: attr(node, "volumeUnit"),
		temperatureUnit: attr(node, "temperatureUnit"),
		pressureUnit: attr(node, "pressureUnit"),
		diameterUnit: attr(node, "diameterUnit"),
		widthUnit: attr(node, "widthUnit"),
		heightUnit: attr(node, "heightUnit"),
		velocityUnit: attr(node, "velocityUnit"),
		flowUnit: attr(node, "flowUnit"),
		angularUnit: attr(node, "angularUnit"),
		directionUnit: attr(node, "directionUnit"),
		latLongAngularUnit: attr(node, "latLongAngularUnit"),
		elevationUnit: attr(node, "elevationUnit"),
	};
}

function parseCoordinateSystem(node) {
	return {
		name: attr(node, "name"),
		desc: attr(node, "desc"),
		epsgCode: attr(node, "epsgCode"),
		ogcWktCode: attr(node, "ogcWktCode"),

		horizontalDatum: attr(node, "horizontalDatum"),
		verticalDatum: attr(node, "verticalDatum"),
		datum: attr(node, "datum"),
		ellipsoidName: attr(node, "ellipsoidName"),

		horizontalCoordinateSystemName: attr(node, "horizontalCoordinateSystemName"),
		geocentricCoordinateSystemName: attr(node, "geocentricCoordinateSystemName"),
		projectedCoordinateSystemName: attr(node, "projectedCoordinateSystemName"),
		geographicCoordinateSystemName: attr(node, "geographicCoordinateSystemName"),
		verticalCoordinateSystemName: attr(node, "verticalCoordinateSystemName"),
		localCoordinateSystemName: attr(node, "localCoordinateSystemName"),
		compoundCoordinateSystemName: attr(node, "compoundCoordinateSystemName"),
		fittedCoordinateSystemName: attr(node, "fittedCoordinateSystemName"),

		rotationAngle: parseNum(attr(node, "rotationAngle")),
		fileLocation: attr(node, "fileLocation"),

		start: parseNamedPoint(firstChild(node, "Start")),
	};
}

// -----------------------------------------------------------------------------
// alignment
// -----------------------------------------------------------------------------

function parseAlignment(node, sourceFile = "") {
	const out = {
		type: "Alignment",

		name: attr(node, "name"),
		desc: attr(node, "desc"),
		oID: attr(node, "oID"),
		state: attr(node, "state"),

		length: parseNum(attr(node, "length")),
		staStart: parseNum(attr(node, "staStart")),

		source: {
			fileName: String(sourceFile ?? ""),
			format: "landXML",
			xmlPath: null,
		},

		start: parseNamedPoint(firstChild(node, "Start")),
		coordGeom: [],

		// reserved for later phases
		profiles: [],
		cants: [],
		staEquations: [],
		extras: {},
	};

	const coordGeomNode = firstChild(node, "CoordGeom");
	if (coordGeomNode) {
		out.coordGeom = parseCoordGeom(coordGeomNode);
	}

	return out;
}

function parseCoordGeom(node) {
	const out = [];

	for (const child of Array.from(node.children)) {
		const tag = localName(child);

		if (tag === "Line") {
			out.push(parseLine(child));
			continue;
		}

		if (tag === "Curve") {
			out.push(parseCurve(child));
			continue;
		}

		if (tag === "Spiral") {
			out.push(parseSpiral(child));
			continue;
		}

		// v0 intentionally ignores:
		// IrregularLine, Chain, Feature
	}

	return out;
}

// -----------------------------------------------------------------------------
// coordGeom elements
// -----------------------------------------------------------------------------

function parseLine(node) {
	return {
		type: "Line",

		name: attr(node, "name"),
		desc: attr(node, "desc"),
		oID: attr(node, "oID"),
		state: attr(node, "state"),
		note: attr(node, "note"),

		staStart: parseNum(attr(node, "staStart")),
		length: parseNum(attr(node, "length")),
		dir: parseNum(attr(node, "dir")),

		start: parseNamedPoint(firstChild(node, "Start")),
		end: parseNamedPoint(firstChild(node, "End")),
	};
}

function parseCurve(node) {
	return {
		type: "Curve",

		name: attr(node, "name"),
		desc: attr(node, "desc"),
		oID: attr(node, "oID"),
		state: attr(node, "state"),
		note: attr(node, "note"),

		staStart: parseNum(attr(node, "staStart")),
		length: parseNum(attr(node, "length")),

		radius: parseRadius(attr(node, "radius")),
		delta: parseNum(attr(node, "delta")),
		tangent: parseNum(attr(node, "tangent")),
		chord: parseNum(attr(node, "chord")),
		rot: normalizeLandXMLRotation(attr(node, "rot")),
		crvType: attr(node, "crvType"),

		dirStart: normalizeLandXMLDirection(attr(node, "dirStart")),
		dirEnd: normalizeLandXMLDirection(attr(node, "dirEnd")),

		start: parseNamedPoint(firstChild(node, "Start")),
		center: parseNamedPoint(firstChild(node, "Center")),
		end: parseNamedPoint(firstChild(node, "End")),
		pi: parseNamedPoint(firstChild(node, "PI")),
	};
}

function parseSpiral(node) {
	return {
		type: "Spiral",

		name: attr(node, "name"),
		desc: attr(node, "desc"),
		oID: attr(node, "oID"),
		state: attr(node, "state"),

		staStart: parseNum(attr(node, "staStart")),
		length: parseNum(attr(node, "length")),

		radiusStart: parseRadius(attr(node, "radiusStart")),
		radiusEnd: parseRadius(attr(node, "radiusEnd")),

		rot: normalizeLandXMLRotation(attr(node, "rot")),
		spiType: normalizeLandXMLSpiralType(attr(node, "spiType")),

		dirStart: normalizeLandXMLDirection(attr(node, "dirStart")),
		dirEnd: normalizeLandXMLDirection(attr(node, "dirEnd")),

		chord: parseNum(attr(node, "chord")),
		constant: parseNum(attr(node, "constant")),
		theta: parseNum(attr(node, "theta")),
		totalX: parseNum(attr(node, "totalX")),
		totalY: parseNum(attr(node, "totalY")),
		tanLong: parseNum(attr(node, "tanLong")),
		tanShort: parseNum(attr(node, "tanShort")),

		start: parseNamedPoint(firstChild(node, "Start")),
		pi: parseNamedPoint(firstChild(node, "PI")),
		end: parseNamedPoint(firstChild(node, "End")),
	};
}

function parseNamedPoint(node) {
	if (!node) return null;

	const raw = String(node.textContent ?? "").trim();
	if (!raw) return null;

	const values = raw
		.split(/[\s,;]+/)
		.map((s) => Number(s))
		.filter(Number.isFinite);

	return normalizeSurveyPoint({ raw, values });
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function localName(node) {
	return node?.localName ?? node?.nodeName ?? null;
}

function attr(node, name) {
	if (!node) return null;
	const v = node.getAttribute(name);
	return v == null || v === "" ? null : v;
}

function firstChild(node, wantedLocalName) {
	if (!node) return null;
	for (const child of Array.from(node.children ?? [])) {
		if (localName(child) === wantedLocalName) return child;
	}
	return null;
}

function allDescendants(node, wantedLocalName) {
	if (!node) return [];
	const all = node.getElementsByTagNameNS
		? node.getElementsByTagNameNS("*", wantedLocalName)
		: node.getElementsByTagName(wantedLocalName);
	return Array.from(all ?? []);
}

function parseBool(v) {
	return normalizeLandXMLBool(v);
}

function parseNum(v) {
	return normalizeLandXMLNumber(v);
}

function parseRadius(v) {
	return normalizeLandXMLRadius(v);
}
