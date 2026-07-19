import { createGeoreferenceContract } from "../coordinates/GeoreferenceContract.js";

export function makeDbRefToEtrs89Transform(proj4, resolution) {
	const d = resolution?.horizontalTransformation;
	if (typeof proj4 !== "function" || !d || resolution?.supportState !== "geographic-supported") return null;
	// PROJ.4 towgs84 uses position-vector rotation signs; EPSG:5826 publishes coordinate-frame signs.
	const h = d.helmert;
	const source = `+proj=tmerc +lat_0=${d.latitudeOfOriginDegrees} +lon_0=${d.centralMeridianDegreesEast} +k=${d.scaleFactor} +x_0=${d.falseEastingMetres} +y_0=${d.falseNorthingMetres} +a=${d.ellipsoid.semiMajorAxis} +rf=${d.ellipsoid.inverseFlattening} +towgs84=${h.x},${h.y},${h.z},${-h.rx},${-h.ry},${-h.rz},${h.scalePpm} +units=m +no_defs`;
	return (coordinate) => proj4(source, "EPSG:4326", coordinate);
}

export function projectGeographicGeometry({ projection, resolution, transform } = {}) {
	const contract = (status, extra = []) => createGeoreferenceContract({ horizontal: resolution, vertical: projection?.georeference?.vertical ?? null, coordinateProvenance: "GND.PL:Y(easting),X(northing)", coordinatesAreAbsolute: true, transformationAvailable: typeof transform === "function", validationStatus: status, warnings: extra });
	if (resolution?.supportState !== "geographic-supported" || resolution?.status !== "resolved") return { ok: false, geometry: null, georeference: contract(resolution?.status ?? "missing") };
	if (typeof transform !== "function") return { ok: false, geometry: null, georeference: contract("transformation-failed", ["Validated DB_REF transformation is unavailable at runtime."]) };
	try {
		const polyline = transformPoints(projection?.polyline2d, transform);
		const segments = (projection?.segments ?? []).map((s) => ({ ...s, pointsGeographic: transformPoints(s?.points2d, transform) }));
		const extent = resolution.geographicValidity;
		if (!insideValidity(polyline, extent)) return { ok: false, geometry: null, georeference: contract("outside-validity", ["Transformed coordinates lie outside the supported DB_REF strip or German validity region."]) };
		return { ok: true, geometry: { polyline, segments, bbox: geographicBbox(polyline) }, georeference: contract("valid") };
	} catch (error) { return { ok: false, geometry: null, georeference: contract("transformation-failed", [String(error?.message ?? error)]) }; }
}

function transformPoints(points, transform) {
	if (!Array.isArray(points) || points.length < 2) throw new Error("Geographic projection requires at least two source points.");
	return points.map((p) => { const r = transform([Number(p?.x), Number(p?.y)]); const longitude = Number(r?.[0] ?? r?.longitude), latitude = Number(r?.[1] ?? r?.latitude); if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) throw new Error("Transformation returned invalid longitude/latitude."); return { longitude, latitude }; });
}
function insideValidity(points, extent) { const [w,e] = extent?.longitudeDegrees ?? []; const [s,n] = extent?.latitudeDegrees ?? []; return Number.isFinite(w) && points.every((p) => p.longitude >= w && p.longitude <= e && p.latitude >= s && p.latitude <= n); }
function geographicBbox(points) { return points.reduce((b,p) => ({ west: Math.min(b.west,p.longitude), south: Math.min(b.south,p.latitude), east: Math.max(b.east,p.longitude), north: Math.max(b.north,p.latitude) }), { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity }); }
