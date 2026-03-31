// src/import/parsers/landXML/parseLandXML.js
//
// landXML -> landFAT
//
// philosophy:
// - keep landXML semantics
// - no pose
// - no sparse normalization
// - no internal point reinterpretation
// - no synthetic reconstruction
// - parser only lifts markup semantics into landFAT contract
//
// intentionally still incomplete:
// - IrregularLine, Chain
// - CrossSects, Superelevation, Feature payloads
// - richer semanticMap-driven provenance
//
// @baustelle [SEMANTIC-MAP]
// semanticMap.landXML.js is not yet actively driving this parser.
//
// @baustelle [MULTI-PART]
// This parser currently returns one landFAT part per input file.
// Future split by differing units / coordinate systems inside one source
// is not yet implemented.
//
// @baustelle [PROFILE-CANT-COVERAGE]
// Profile / Cant / StaEquation are now lifted in contract shape,
// but deeper subtyping / completeness is still conservative.

//
// @baustelle [MULTI-PART]
// Noch nicht umgesetzt:
// - Split eines einzelnen landXML-Dokuments in mehrere landFAT-Teile,
//   falls innerhalb der Quelle unterschiedliche units oder coordinateSysteme vorkommen.
//
// @baustelle [PROFILE-COVERAGE]
// Noch nicht vollständig umgesetzt:
// - tiefere Typisierung / Vollabdeckung von Profile / ProfAlign / PVI / ParaCurve
// - weitere landXML-Profilelemente bleiben vorerst konservativ source-nah oder unberücksichtigt
//
// @baustelle [CANT-COVERAGE]
// Noch nicht vollständig umgesetzt:
// - tiefere Typisierung / Vollabdeckung von Cant / CantStation / SpeedStation
// - weitere Überhöhungs-/Superelevation-nahe Inhalte sind noch nicht integriert
//
// @baustelle [SEMANTIC-MAP]
// Noch nicht umgesetzt:
// - semanticMap.landXML.js steuert das Parsing noch nicht aktiv
// - Mapping ist derzeit implizit im Parsercode verdrahtet
//
// @baustelle [NON-CORE-LANDXML]
// Noch nicht umgesetzt:
// - IrregularLine
// - Chain
// - CrossSects
// - Superelevation
// - Feature-Payloads
//
// @baustelle [ALIGNMENT-STRICTNESS]
// Noch offen:
// - weitergehende formale Konsistenzprüfungen zwischen
//   coordGeom / staEquations / profile / cant
// - 7L-Logik wird weiterhin erst im sparseBuilder bzw. Folgeprozess erzwungen
//

import * as fat from "@kimport/landfat/landFatWriter.js";

export function parseLandXML(text, sourceFile = "") {
	const xmlSource = String(text ?? "").trim();
	if (!xmlSource) throw new Error("parseLandXML: empty input");

	const xml = new DOMParser().parseFromString(xmlSource, "application/xml");
	const parserError = xml.querySelector("parsererror");
	if (parserError) throw new Error("parseLandXML: invalid XML");

	const root = xml.documentElement;
	if (!root || localName(root) !== "LandXML") {
		throw new Error("parseLandXML: root is not LandXML");
	}

	const unitsNode = firstChild(root, "Units");
	const coordinateSystemNode = firstChild(root, "CoordinateSystem");

	const doc = fat.createDocument({
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
		units: unitsNode ? parseUnits(unitsNode) : defaultUnits(),
		coordinateSystem: coordinateSystemNode
			? parseCoordinateSystem(coordinateSystemNode)
			: defaultCoordinateSystem(),
		extras: {
			semanticMap: {
				formatId: "landXML",
				note: "landXML markup semantics lifted source-near into landFAT",
			},
		},
	});

	const alignmentNodes = allDescendants(root, "Alignment");
	doc.alignments = alignmentNodes.map((node, i) =>
		parseAlignment(node, doc.meta.sourceFile, doc.units, i)
	);

	return doc;
}

// -----------------------------------------------------------------------------
// defaults
// -----------------------------------------------------------------------------

function defaultUnits() {
	return {
		linearUnit: "meter",
		elevationUnit: "meter",
		angularUnit: null,
	};
}

function defaultCoordinateSystem() {
	return {
		horizontalCoordinateSystemName: null,
		verticalCoordinateSystemName: null,
	};
}

function normalizeLinearUnit(v) {
	const s = String(v ?? "").trim().toLowerCase();
	if (!s) return null;

	if (s === "meter" || s === "meters" || s === "metre" || s === "metres" || s === "m") {
		return "meter";
	}

	if (s === "millimeter" || s === "millimeters" || s === "millimetre" || s === "millimetres" || s === "mm") {
		return "millimeter";
	}

	if (s === "foot" || s === "feet" || s === "ft") {
		return "foot";
	}

	return s;
}

// -----------------------------------------------------------------------------
// root-level blocks
// -----------------------------------------------------------------------------

function parseUnits(node) {
	const metricNode = firstChild(node, "Metric");
	const imperialNode = firstChild(node, "Imperial");
	const src = metricNode ?? imperialNode ?? node;

	const linearUnit = normalizeLinearUnit(attr(src, "linearUnit")) ?? "meter";
	const elevationUnit =
		normalizeLinearUnit(attr(src, "elevationUnit")) ??
		linearUnit;

	return {
		linearUnit,
		elevationUnit,
		angularUnit: normalizeAngularUnit(
			attr(src, "angularUnit") ??
			attr(src, "directionUnit") ??
			attr(src, "latLongAngularUnit")
		),
	};
}

function parseCoordinateSystem(node) {
	return {
		horizontalCoordinateSystemName:
			attr(node, "horizontalCoordinateSystemName") ??
			attr(node, "projectedCoordinateSystemName") ??
			attr(node, "geographicCoordinateSystemName") ??
			attr(node, "compoundCoordinateSystemName") ??
			attr(node, "name"),

		verticalCoordinateSystemName:
			attr(node, "verticalCoordinateSystemName") ??
			attr(node, "verticalDatum"),
	};
}

// -----------------------------------------------------------------------------
// alignment
// -----------------------------------------------------------------------------

function parseAlignment(node, sourceFile = "", units = null, index = 0) {
	const coordGeomNode = firstChild(node, "CoordGeom");
	const profileNode = firstChild(node, "Profile");
	const cantNode = firstChild(node, "Cant");
	const staEquationNodes = childList(node, "StaEquation");

	return fat.createAlignment({
		id:
			attr(node, "oID") ??
			attr(node, "name") ??
			`alignment_${String(index + 1).padStart(4, "0")}`,

		name: attr(node, "name"),

		coordGeom: fat.createCoordGeom({
			elements: coordGeomNode ? parseCoordGeom(coordGeomNode, units) : [],
		}),

		staEquations: staEquationNodes.length
			? staEquationNodes.map(parseStaEquation)
			: null,

		profile: profileNode ? parseProfile(profileNode) : null,
		cant: cantNode ? parseCant(cantNode, units) : null,

		extras: {
			source: {
				fileName: String(sourceFile ?? ""),
				format: "landXML",
			},
			semanticMap: {
				markupNative: true,
				note: "Most semantics already explicit in source markup",
			},
			meta: {
				desc: attr(node, "desc"),
				oID: attr(node, "oID"),
				state: attr(node, "state"),
				length: parseMeasure(attr(node, "length"), units?.linearUnit),
				staStart: parseMeasure(attr(node, "staStart"), units?.linearUnit),
			},
		},
	});
}

function parseCoordGeom(node, units) {
	const out = [];

	for (const child of Array.from(node.children)) {
		const tag = localName(child);

		if (tag === "Line") {
			out.push(parseLine(child, units));
			continue;
		}

		if (tag === "Curve") {
			out.push(parseCurve(child, units));
			continue;
		}

		if (tag === "Spiral") {
			out.push(parseSpiral(child, units));
			continue;
		}

		// intentionally ignored for now:
		// IrregularLine, Chain, Feature
	}

	return out;
}

// -----------------------------------------------------------------------------
// coordGeom elements
// -----------------------------------------------------------------------------

function parseLine(node, units) {
	return fat.line({
		start: parseNamedPoint(firstChild(node, "Start")),
		end: parseNamedPoint(firstChild(node, "End")),
		length: parseMeasure(attr(node, "length"), units?.linearUnit),
		direction: parseDirectionAngle(attr(node, "dir"), units?.angularUnit),
		staStart: parseMeasure(attr(node, "staStart"), units?.linearUnit),
		extras: {
			name: attr(node, "name"),
			desc: attr(node, "desc"),
			oID: attr(node, "oID"),
			state: attr(node, "state"),
			note: attr(node, "note"),
		},
	});
}

function parseCurve(node, units) {
	return fat.curve({
		start: parseNamedPoint(firstChild(node, "Start")),
		end: parseNamedPoint(firstChild(node, "End")),
		center: parseNamedPoint(firstChild(node, "Center")),
		radius: parseRadiusValue(attr(node, "radius")),
		rot: normalizeRotation(attr(node, "rot")),
		length: parseMeasure(attr(node, "length"), units?.linearUnit),
		dirStart: parseDirectionAngle(attr(node, "dirStart"), units?.angularUnit),
		dirEnd: parseDirectionAngle(attr(node, "dirEnd"), units?.angularUnit),
		staStart: parseMeasure(attr(node, "staStart"), units?.linearUnit),
		crvType: attr(node, "crvType"),
		extras: {
			name: attr(node, "name"),
			desc: attr(node, "desc"),
			oID: attr(node, "oID"),
			state: attr(node, "state"),
			note: attr(node, "note"),
			delta: parseDirectionAngle(attr(node, "delta"), units?.angularUnit),
			chord: parseMeasure(attr(node, "chord"), units?.linearUnit),
			tangent: parseMeasure(attr(node, "tangent"), units?.linearUnit),
			pi: parseNamedPoint(firstChild(node, "PI")),
		},
	});
}

function parseSpiral(node, units) {
	return fat.spiral({
		start: parseNamedPoint(firstChild(node, "Start")),
		end: parseNamedPoint(firstChild(node, "End")),
		pi: parseNamedPoint(firstChild(node, "PI")),
		radiusStart: parseRadiusValue(attr(node, "radiusStart")),
		radiusEnd: parseRadiusValue(attr(node, "radiusEnd")),
		spiType: attr(node, "spiType"),
		length: parseMeasure(attr(node, "length"), units?.linearUnit),
		staStart: parseMeasure(attr(node, "staStart"), units?.linearUnit),
		dirStart: parseDirectionAngle(attr(node, "dirStart"), units?.angularUnit),
		dirEnd: parseDirectionAngle(attr(node, "dirEnd"), units?.angularUnit),
		theta: parseDirectionAngle(attr(node, "theta"), units?.angularUnit),
		extras: {
			name: attr(node, "name"),
			desc: attr(node, "desc"),
			oID: attr(node, "oID"),
			state: attr(node, "state"),
			rot: normalizeRotation(attr(node, "rot")),
			chord: parseMeasure(attr(node, "chord"), units?.linearUnit),
			constant: parseMeasure(attr(node, "constant"), units?.linearUnit),
			totalX: parseMeasure(attr(node, "totalX"), units?.linearUnit),
			totalY: parseMeasure(attr(node, "totalY"), units?.linearUnit),
			tanLong: parseMeasure(attr(node, "tanLong"), units?.linearUnit),
			tanShort: parseMeasure(attr(node, "tanShort"), units?.linearUnit),
		},
	});
}

// -----------------------------------------------------------------------------
// profile / cant / staEquation
// -----------------------------------------------------------------------------

function parseStaEquation(node) {
	return fat.staEquation({
		staAhead: parseMeasure(attr(node, "staAhead")),
		staBack: parseMeasure(attr(node, "staBack")),
		staInternal: parseMeasure(attr(node, "staInternal")),
		staIncrement: attr(node, "staIncrement"),
	});
}

function parseProfile(profileNode) {
	const profAlignNode = firstChild(profileNode, "ProfAlign");

	return fat.profile({
		name: attr(profileNode, "name"),
		desc: attr(profileNode, "desc"),
		profAlign: profAlignNode
			? parseProfAlign(profAlignNode)
			: fat.profAlign(),
	});
}

function parseProfAlign(node) {
	const pvis = [];
	const paraCurves = [];

	for (const child of Array.from(node.children ?? [])) {
		const tag = localName(child);
		const vals = parsePointLikeNumbers(child.textContent);

		if (tag === "PVI") {
			pvis.push(
				fat.pvi({
					station: vals[0] != null ? { value: vals[0] } : null,
					elevation: vals[1] != null ? { value: vals[1] } : null,
					extras: { desc: attr(child, "desc") },
				})
			);
			continue;
		}

		if (tag === "ParaCurve") {
			paraCurves.push(
				fat.paraCurve({
					station: vals[0] != null ? { value: vals[0] } : null,
					elevation: vals[1] != null ? { value: vals[1] } : null,
					length: parseMeasure(attr(child, "length")),
					extras: { desc: attr(child, "desc") },
				})
			);
		}
	}

	return fat.profAlign({
		name: attr(node, "name"),
		desc: attr(node, "desc"),
		pvis,
		paraCurves,
	});
}

function parseCant(node, units) {
	const out = [];

	for (const n of childList(node, "CantStation")) {
		out.push(
			fat.cantStation({
				station: parseMeasure(attr(n, "station"), units?.linearUnit),
				appliedCant: parseMeasure(attr(n, "appliedCant"), units?.elevationUnit),
				speed: parseMeasure(attr(n, "speed")),
				transitionType: attr(n, "transitionType"),
				curvature: attr(n, "curvature"),
				extras: {
					equilibriumCant: parseMeasure(attr(n, "equilibriumCant"), units?.elevationUnit),
					cantDeficiency: parseMeasure(attr(n, "cantDeficiency"), units?.elevationUnit),
					cantExcess: parseMeasure(attr(n, "cantExcess"), units?.elevationUnit),
					cantGradient: parseNum(attr(n, "cantGradient")),
					adverse: parseBool(attr(n, "adverse")),
				},
			})
		);
	}

	for (const n of childList(node, "SpeedStation")) {
		out.push(
			fat.speedStation({
				station: parseMeasure(attr(n, "station"), units?.linearUnit),
				speed: parseMeasure(attr(n, "speed")),
			})
		);
	}

	return out.length ? out : null;
}

// -----------------------------------------------------------------------------
// point / atomic readers
// -----------------------------------------------------------------------------

function parseNamedPoint(node) {
	if (!node) return null;

	const raw = String(node.textContent ?? "").trim();
	if (!raw) return null;

	const values = parsePointLikeNumbers(raw);
	if (values.length < 2) return null;

	return fat.point2D(values[1], values[0]);
}

function parsePointLikeNumbers(raw) {
	return String(raw ?? "")
		.trim()
		.split(/[\s,;]+/)
		.map((s) => Number(s))
		.filter(Number.isFinite);
}

function parseMeasure(v, unit = null) {
	const value = parseNum(v);
	if (!Number.isFinite(value)) return null;

	return unit ? { value, unit } : { value };
}

function parseDirectionAngle(v, angularUnit = null) {
	const value = parseNum(v);
	if (!Number.isFinite(value)) return null;

	return {
		value,
		unit: normalizeAngularUnit(angularUnit) ?? "radian",
		orientation: "ccw",
		origin: "east",
	};
}

function parseRadiusValue(v) {
	if (v == null || v === "") return null;

	const s = String(v).trim().toUpperCase();
	if (s === "INF" || s === "+INF" || s === "-INF") {
		return {
			value: "INF",
			representation: "infinite",
		};
	}

	const n = Number(v);
	return Number.isFinite(n) ? n : null;
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

function childList(node, wantedLocalName) {
	if (!node) return [];
	return Array.from(node.children ?? []).filter((child) => localName(child) === wantedLocalName);
}

function allDescendants(node, wantedLocalName) {
	if (!node) return [];
	const all = node.getElementsByTagNameNS
		? node.getElementsByTagNameNS("*", wantedLocalName)
		: node.getElementsByTagName(wantedLocalName);
	return Array.from(all ?? []);
}

function parseBool(v) {
	if (v == null || v === "") return null;
	const s = String(v).trim().toLowerCase();
	if (s === "true") return true;
	if (s === "false") return false;
	return null;
}

function parseNum(v) {
	if (v == null || v === "") return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

function normalizeRotation(v) {
	const s = String(v ?? "").trim().toLowerCase();
	return s === "cw" || s === "ccw" ? s : null;
}

function normalizeAngularUnit(v) {
	const s = String(v ?? "").trim().toLowerCase();
	if (!s) return null;

	if (s === "radian" || s === "radians" || s === "rad") return "radian";
	if (s === "degree" || s === "degrees" || s === "deg") return "degree";
	if (s === "gon" || s === "grad" || s === "grads") return "gon";

	return null;
}
