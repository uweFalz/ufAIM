// src/coord/CoordContextAgent.js
//
// First-stage CoordContext factory.
//
// Role:
// - normalize CRS-ish metadata into CoordContext
// - infer very rough engineering context where possible
// - never claim false precision

import { makeCoordContext } from "./CoordContext.js";

export function makeCoordContextFromSpatialRef({
	spatialRef = null,
	source = null,
	fallbackId = null,
	representativePoint = null,
} = {}) {
	const declared = readDeclaredCrsId(spatialRef);

	if (declared) {
		const crsId = normalizeCrsId(declared);

		return makeCoordContext({
			id: crsId,
			crsId,
			status: spatialRef?.status ?? "declared",
			family: classifyCrsFamily(crsId),
			label: spatialRef?.horizontalCoordinateSystemName ?? crsId,
			source: spatialRef?.source ?? source,
			raw: spatialRef,
		});
	}

	const inferred = inferEngineeringContext(representativePoint);

	if (inferred) {
		return makeCoordContext({
			id: inferred.crsId,
			crsId: inferred.crsId,
			status: "inferred",
			family: inferred.family,
			label: inferred.label,
			source,
			raw: {
				inferred: true,
				heuristic: inferred.heuristic,
				baseSpatialRef: spatialRef ?? null,
			},
		});
	}

	const unknownId = `unknown:engineering:${safeIdStem(fallbackId ?? source ?? "import")}`;

	return makeCoordContext({
		id: unknownId,
		crsId: unknownId,
		status: "unknown",
		family: "local_unknown",
		label: "unknown engineering CRS",
		source,
		raw: spatialRef ?? {},
	});
}

export function readDeclaredCrsId(sr) {
	return firstNonEmptyString(
		sr?.crsId,
		sr?.horizontalCrsId,
		sr?.horizontal,
		sr?.horizontalCoordinateSystemName
	);
}

export function normalizeCrsId(value) {
	const s = String(value ?? "").trim();
	if (!s) return null;

	if (/^EPSG:/i.test(s)) return `EPSG:${s.split(":")[1]}`;
	if (/^DB:/i.test(s)) return `DB:${s.split(":")[1]}`;
	if (/^[A-Z]{2}\d$/i.test(s)) return `DB:${s.toUpperCase()}`;

	return s;
}

export function classifyCrsFamily(crsId) {
	const s = String(crsId ?? "").toUpperCase();

	if (s.includes("GK") || s.includes("GAUSS") || s.includes("KRUEGER") || s.includes("KRÜGER")) {
		return "gauss_krueger";
	}

	if (s.includes("UTM") || s.startsWith("EPSG:258") || s.startsWith("EPSG:32")) {
		return "utm";
	}

	if (s.includes("DBREF") || s.startsWith("DB:DR")) {
		return "dbref";
	}

	if (s.startsWith("DB:DA")) {
		return "db_landessystem";
	}

	if (s.startsWith("UNKNOWN:")) {
		return "local_unknown";
	}

	return "unknown";
}

export function inferEngineeringContext(point) {
	if (!point) return null;

	const x = Number(point.x);
	const y = Number(point.y);

	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

	if (x > 2_000_000 && x < 6_000_000 && y > 5_000_000 && y < 7_000_000) {
		const strip = Math.floor(x / 1_000_000);

		return {
			crsId: `INFERRED:GK:${strip}`,
			label: `inferred Gauss-Krüger strip ${strip}`,
			family: "gauss_krueger",
			heuristic: {
				type: "gk_strip_from_rechtswert",
				strip,
				x,
				y,
			},
		};
	}

	return null;
}

function firstNonEmptyString(...values) {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return null;
}

function safeIdStem(value) {
	return String(value ?? "import")
		.trim()
		.replace(/\.[^.]+$/g, "")
		.replace(/[^a-zA-Z0-9_\-]+/g, "_")
		.replace(/^_+|_+$/g, "")
		|| "import";
}
