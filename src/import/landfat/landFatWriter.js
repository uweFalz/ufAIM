// src/import/landfat/landFatWriter.js

// Minimal contract writer for landFAT
//
// Ziel:
// - contract-kompatibles Erzeugen zentralisieren
// - Parser von Form-Ballast entlasten
// - KEINE Geometrie-Rekonstruktion
// - KEINE Semantik-Erfindung

// @baustelle [SCOPE]
// v0 deckt nur die aktuell tatsächlich genutzten Kernbausteine ab.

// @baustelle [STRICT CONTRACT]
// Der Writer soll nur contract-konforme landFAT-Strukturen erzeugen.
// Pflichtfelder des Root-Contracts werden daher beim Schreiben hart geprüft.
// Ziel: Fehler früh im Parser-/Lifter-Kontext sichtbar machen,
// statt erst nachgelagert im Validator.

function isFiniteNum(x) {
	return Number.isFinite(x);
}

function cloneExtras(extras) {
	return extras && typeof extras === "object" && !Array.isArray(extras)
		? { ...extras }
		: {};
}

// -------------------------------------------------------------------------------------------------
// root
// -------------------------------------------------------------------------------------------------

export function createDocument({
	meta = {},
	units = {},
	coordinateSystem = {},
	alignments = [],
	extras = {},
} = {}) {
	if (!isNonEmptyString(units.linearUnit)) {
		throw new Error("createDocument: units.linearUnit must be a non-empty string");
	}

	if (!isNonEmptyString(units.elevationUnit)) {
		throw new Error("createDocument: units.elevationUnit must be a non-empty string");
	}

	if (units.angularUnit != null && !["radian", "gon", "degree"].includes(units.angularUnit)) {
		throw new Error('createDocument: units.angularUnit must be "radian", "gon", "degree", or null');
	}

	return {
		type: "landFAT",
		meta: { ...meta },
		units: {
			linearUnit: units.linearUnit,
			elevationUnit: units.elevationUnit,
			angularUnit: units.angularUnit ?? null,
		},
		coordinateSystem: {
			horizontalCoordinateSystemName: coordinateSystem.horizontalCoordinateSystemName ?? null,
			verticalCoordinateSystemName: coordinateSystem.verticalCoordinateSystemName ?? null,
		},
		alignments: Array.isArray(alignments) ? alignments : [],
		extras: cloneExtras(extras),
	};
}

export function pushAlignment(doc, alignment) {
	if (!doc || doc.type !== "landFAT") {
		throw new Error("pushAlignment: doc must be a landFAT document");
	}
	if (!Array.isArray(doc.alignments)) {
		doc.alignments = [];
	}
	doc.alignments.push(alignment);
	return doc;
}

// -------------------------------------------------------------------------------------------------
// alignment
// -------------------------------------------------------------------------------------------------

export function createAlignment({
	id,
	name = null,
	coordGeom = null,
	staEquations = null,
	profile = null,
	cant = null,
	extras = {},
} = {}) {
	if (!id || typeof id !== "string") {
		throw new Error("createAlignment: id must be a non-empty string");
	}

	return {
		type: "Alignment",
		id,
		name: name ?? null,
		coordGeom: coordGeom ?? createCoordGeom(),
		staEquations: Array.isArray(staEquations) ? staEquations : null,
		profile: profile ?? null,
		cant: Array.isArray(cant) ? cant : null,
		extras: cloneExtras(extras),
	};
}

export function createCoordGeom({ elements = [] } = {}) {
	return {
		elements: Array.isArray(elements) ? elements : [],
	};
}

// -------------------------------------------------------------------------------------------------
// atoms
// -------------------------------------------------------------------------------------------------

export function point2D(easting, northing) {
	if (!isFiniteNum(easting) || !isFiniteNum(northing)) {
		throw new Error("point2D: easting and northing must be finite numbers");
	}
	return {
		easting: Number(easting),
		northing: Number(northing),
	};
}

export function measure(value, unit = null) {
	if (!isFiniteNum(value)) {
		throw new Error("measure: value must be finite");
	}
	return unit
		? { value: Number(value), unit }
		: { value: Number(value) };
}

export function angle(value, unit, orientation, origin) {
	if (!isFiniteNum(value)) {
		throw new Error("angle: value must be finite");
	}
	return {
		value: Number(value),
		unit,
		orientation,
		origin,
	};
}

export function radiusValue(value) {
	if (value === "INF") {
		return { value: "INF", representation: "infinite" };
	}
	if (!isFiniteNum(value)) {
		throw new Error('radiusValue: value must be finite or "INF"');
	}
	return Number(value);
}

// -------------------------------------------------------------------------------------------------
// coordGeom elements
// -------------------------------------------------------------------------------------------------

export function line({
	start,
	end,
	length = null,
	direction = null,
	staStart = null,
	extras = {},
} = {}) {
	return {
		type: "Line",
		start,
		end,
		length,
		direction,
		staStart,
		extras: cloneExtras(extras),
	};
}

export function curve({
	start,
	end,
	center = null,
	radius = null,
	rot = null,
	length = null,
	dirStart = null,
	dirEnd = null,
	staStart = null,
	crvType = null,
	extras = {},
} = {}) {
	return {
		type: "Curve",
		start,
		end,
		center,
		radius,
		rot,
		length,
		dirStart,
		dirEnd,
		staStart,
		crvType,
		extras: cloneExtras(extras),
	};
}

export function spiral({
	start,
	end,
	pi = null,
	radiusStart = null,
	radiusEnd = null,
	spiType = null,
	length = null,
	dirStart = null,
	dirEnd = null,
	theta = null,
	staStart = null,
	extras = {},
} = {}) {
	return {
		type: "Spiral",
		start,
		end,
		pi,
		radiusStart,
		radiusEnd,
		spiType,
		length,
		dirStart,
		dirEnd,
		theta,
		staStart,
		extras: cloneExtras(extras),
	};
}

export function kink({
	start,
	end = null,
	length = null,
	delta = null,
	dirStart = null,
	dirEnd = null,
	staStart = null,
	extras = {},
} = {}) {
	return {
		type: "Kink",
		start,
		end,
		length,
		delta,
		dirStart,
		dirEnd,
		staStart,
		extras: cloneExtras(extras),
	};
}

// -------------------------------------------------------------------------------------------------
// sta equations
// -------------------------------------------------------------------------------------------------

export function staEquation({
	station = null,
	delta = null,
	staAhead = null,
	staBack = null,
	staInternal = null,
	staIncrement = null,
	extras = {},
} = {}) {
	return {
		type: "StaEquation",
		station,
		delta,
		staAhead,
		staBack,
		staInternal,
		staIncrement,
		extras: cloneExtras(extras),
	};
}

// -------------------------------------------------------------------------------------------------
// profile
// -------------------------------------------------------------------------------------------------

export function profile({
	name = null,
	desc = null,
	profAlign = null,
	extras = {},
} = {}) {
	return {
		type: "Profile",
		name,
		desc,
		profAlign,
		extras: cloneExtras(extras),
	};
}

export function profAlign({
	name = null,
	desc = null,
	pvis = [],
	paraCurves = [],
	extras = {},
} = {}) {
	return {
		type: "ProfAlign",
		name,
		desc,
		pvis: Array.isArray(pvis) ? pvis : [],
		paraCurves: Array.isArray(paraCurves) ? paraCurves : [],
		extras: cloneExtras(extras),
	};
}

export function pvi({
	station = null,
	elevation = null,
	extras = {},
} = {}) {
	return {
		station,
		elevation,
		extras: cloneExtras(extras),
	};
}

export function paraCurve({
	station = null,
	elevation = null,
	length = null,
	extras = {},
} = {}) {
	return {
		station,
		elevation,
		length,
		extras: cloneExtras(extras),
	};
}

// -------------------------------------------------------------------------------------------------
// cant
// -------------------------------------------------------------------------------------------------

export function cantStation({
	station = null,
	appliedCant = null,
	speed = null,
	transitionType = null,
	curvature = null,
	extras = {},
} = {}) {
	return {
		type: "CantStation",
		station,
		appliedCant,
		speed,
		transitionType,
		curvature,
		extras: cloneExtras(extras),
	};
}

export function speedStation({
	station = null,
	speed = null,
	extras = {},
} = {}) {
	return {
		type: "SpeedStation",
		station,
		speed,
		extras: cloneExtras(extras),
	};
}

function isNonEmptyString(x) {
	return typeof x === "string" && x.trim() !== "";
}
