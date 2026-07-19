const STATUS = Object.freeze({
	RESOLVED: "resolved", MISSING: "missing", MALFORMED: "malformed", LOCAL: "local",
	AMBIGUOUS: "ambiguous", CONFLICTING: "conflicting", UNSUPPORTED: "unsupported",
});

const MERIDIAN = Object.freeze({
	C: { strip: 2, centralMeridianDegreesEast: 6, epsg: "EPSG:5682", longitudeExtent: [4.5, 7.5] },
	D: { strip: 3, centralMeridianDegreesEast: 9, epsg: "EPSG:5683", longitudeExtent: [7.5, 10.5] },
	E: { strip: 4, centralMeridianDegreesEast: 12, epsg: "EPSG:5684", longitudeExtent: [10.5, 13.5] },
	F: { strip: 5, centralMeridianDegreesEast: 15, epsg: "EPSG:5685", longitudeExtent: [13.5, 16.5] },
});
const FAMILY = Object.freeze({
	A: { id: "RD83", label: "RD/83" }, B: { id: "PD83", label: "PD/83" },
	C: { id: "42_83", label: "42/83" }, S: { id: "SOLDNER_NETZ_88", label: "Soldner Netz 88" },
	R: { id: "DB_REF", label: "DB_REF" },
});
const HORIZONTAL_PROVENANCE = Object.freeze({
	authority: "DB Ril 883.9010 sections 5-8; EPSG projected CRS 5682-5685 and operation 5826",
	operation: "DB_REF to ETRS89 (1)", operationEpsg: "EPSG:5826",
	method: "7-parameter Helmert, coordinate-frame convention",
});

export { STATUS as GND_CRS_STATUS };

export function decodeGndLsys(value) {
	const sourceIdentifier = normalize(value);
	if (!sourceIdentifier) return { sourceIdentifier: null, valid: false, meridian: null, family: null, variant: null, placementClass: "missing", warnings: [] };
	const match = sourceIdentifier.match(/^([CDEF])([ABCSR])([A-Z0-9])$/);
	if (!match) return { sourceIdentifier, valid: false, meridian: null, family: null, variant: null, placementClass: "malformed", warnings: ["LSYS must be a Ril 885 three-character meridian, family, and variant identifier."] };
	const [, meridianCode, familyCode, variantCode] = match;
	const directGraphicalReference = variantCode === "0";
	return {
		sourceIdentifier, valid: true,
		meridian: { code: meridianCode, ...MERIDIAN[meridianCode] },
		family: { code: familyCode, ...FAMILY[familyCode] },
		variant: { code: variantCode, kind: directGraphicalReference ? "db-gis-graphical-reference" : "other-cartesian", hasDirectDbGisRepresentation: directGraphicalReference },
		placementClass: directGraphicalReference ? "graphical-reference" : "local-cartesian",
		warnings: directGraphicalReference ? [] : ["Ril 885 identifies this variant as another Cartesian system without direct DB-GIS graphical representation."],
	};
}

export function resolveGndCrsIdentifier(value, { role = "horizontal" } = {}) {
	const sourceIdentifier = normalize(value);
	const decoded = role === "horizontal" ? decodeGndLsys(sourceIdentifier) : null;
	const base = {
		rawSourceIdentifiers: sourceIdentifier ? [sourceIdentifier] : [], sourceIdentifier,
		resolvedEpsg: null, status: STATUS.MISSING, supportState: "local-missing-crs", role,
		sourceCrsFamily: decoded?.family?.id ?? null, realization: null,
		meridianStrip: decoded?.meridian?.strip ?? null,
		units: role === "horizontal" ? "m" : null,
		axisOrder: role === "horizontal" ? "easting,northing (GND fields Y,X)" : "up",
		horizontalTransformation: null, transformationProvenance: null,
		geographicValidity: null, operatingMode: "local-cartesian", fallbackReason: "missing-crs",
		verticalReferenceStatus: role === "horizontal" ? "unresolved-separate-source-height" : "unsupported",
		provenance: { source: "GND", field: role === "horizontal" ? "LSYS" : "HSYS", structuralAuthority: "Ril 885.0111 pages 2-8" },
		decoded, warnings: [...(decoded?.warnings ?? [])], conflicts: [],
	};
	if (!sourceIdentifier) return base;
	if (role !== "horizontal") return { ...base, status: STATUS.UNSUPPORTED, supportState: "local-unsupported-crs", fallbackReason: "vertical-transformation-unresolved", warnings: ["Source height is preserved; no vertical equivalence or transformation is claimed."] };
	if (!decoded?.valid) return { ...base, status: STATUS.MALFORMED, supportState: "local-malformed-crs", fallbackReason: "malformed-crs" };
	if (decoded.placementClass === "local-cartesian") return { ...base, status: STATUS.LOCAL, supportState: "local-explicit", fallbackReason: "local-lsys-variant" };
	if (decoded.family.id !== "DB_REF") return { ...base, status: STATUS.UNSUPPORTED, supportState: "local-graphical-only", fallbackReason: "unsupported-source-family", warnings: [...base.warnings, `${decoded.family.label} graphical coordinates have no validated geographic transformation in this package.`] };

	const m = decoded.meridian;
	return {
		...base, status: STATUS.RESOLVED, supportState: "geographic-supported", resolvedEpsg: m.epsg,
		realization: "DB_REF horizontal (common to DB_REF2003 and DB_REF2016)", operatingMode: "geographic", fallbackReason: null,
		horizontalTransformation: {
			projection: "3-degree Gauss-Kruger / Transverse Mercator", ellipsoid: { name: "Bessel", semiMajorAxis: 6377397.155, inverseFlattening: 299.15281 },
			centralMeridianDegreesEast: m.centralMeridianDegreesEast, latitudeOfOriginDegrees: 0, scaleFactor: 1,
			falseEastingMetres: m.strip * 1_000_000 + 500_000, falseNorthingMetres: 0,
			target: "ETRS89 geographic longitude,latitude", helmert: { convention: "coordinate_frame", x: 584.9636, y: 107.7175, z: 413.8067, rx: -1.1155214628, ry: -0.2824339890, rz: 3.1384490633, scalePpm: 7.992235 },
		},
		transformationProvenance: HORIZONTAL_PROVENANCE,
		geographicValidity: { longitudeDegrees: m.longitudeExtent, latitudeDegrees: [47.27, 55.09], region: "Germany onshore within the selected 3-degree strip" },
		warnings: ["Horizontal realization is common; LSYS does not identify the separate DB_REF2003/DB_REF2016 vertical model. Source height remains unresolved."],
	};
}

export function resolveGndCrsIdentifiers(values, options = {}) {
	const identifiers = [...new Set((Array.isArray(values) ? values : [values]).map(normalize).filter(Boolean))];
	if (!identifiers.length) return resolveGndCrsIdentifier(null, options);
	if (identifiers.length > 1) {
		const conflicts = identifiers.map((v) => resolveGndCrsIdentifier(v, options));
		return { ...conflicts[0], rawSourceIdentifiers: identifiers, resolvedEpsg: null, status: STATUS.CONFLICTING, supportState: "local-conflicting-crs", operatingMode: "local-cartesian", fallbackReason: "conflicting-crs", horizontalTransformation: null, warnings: [`Conflicting GND CRS identifiers: ${identifiers.join(", ")}`], conflicts };
	}
	return resolveGndCrsIdentifier(identifiers[0], options);
}

function normalize(value) { const text = String(value ?? "").trim().toUpperCase(); return text || null; }
