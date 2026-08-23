// src/import/parsers/technet/vermEsn/parseTRA_GRA.js
//
// Verm.EsN TRA/GRA Import (binary) -> landFAT
//
// @baustelle [LAND_FAT_CONTRACT]
// Parserziel ist ausschließlich landFAT gemäß aktuellem Validator-Vertrag.
//
// @baustelle [NO-CALC]
// Dieser Parser rechnet NICHT:
// - keine sparse-Erzeugung
// - keine Richtungsumrechnung
// - keine Chord-/Geometrie-Rekonstruktion
// - keine Pose-Ableitung
//
// @baustelle [SOURCE-NEAR]
// TRA/GRA werden source-nah nach landFAT gehoben.
// Fehlende Formatsemantik bleibt in extras.sourceSemantics / extras.semanticMap.
//
// @baustelle [LEGACY]
// Legacy-Preview-Helfer bleiben vorerst erhalten, sind aber nicht Teil des
// eigentlichen landFAT-Vertrags.
//
// @baustelle [TRA-LIKE-BRIDGE]
// TRA-coordGeom wird jetzt nicht mehr lokal elementweise gebaut,
// sondern über den gemeinsamen Helper buildCoordGeomFromTraLikeRecords().
// Gleiches gilt für staEquations via extractStaEquationsFromTraLikeRecords().
//
// @baustelle [SHARED-SEMANTICS]
// Kz-Semantik lebt jetzt primär in ../shared/traLikeCoordGeom.js.
// parseTRA_GRA.js bleibt für TRA/GRA-Dateiimport, source-nahe Zusatzdaten,
// Legacy-Vorschauen und landFAT-Dokumentaufbau zuständig.

import * as fat from "@kimport/landfat/landFatWriter.js";

import {
	buildCoordGeomFromTraLikeRecords,
	extractStaEquationsFromTraLikeRecords,
} from "../shared/traLikeCoordGeom.js";
import {
	getTraLikeSemanticMapForTRA,
} from "../shared/traLikeSemanticMaps.js";

import {
	decodeBinary,
	baseMetaFromFile,
} from "./sharedVermesn.js";
import { extractGraSourceRecords } from "./extractGraSourceRecords.js";

// -------------------------------------------------------------------------------------------------
// small helpers
// -------------------------------------------------------------------------------------------------

function baseName(filename = "") {
	return String(filename).replace(/\.[^/.]+$/, "");
}

function getExtensionLower(filename = "") {
	const match = /\.([a-z0-9]+)$/i.exec(String(filename));
	return match ? match[1].toLowerCase() : "";
}

function isFiniteNum(x) {
	return Number.isFinite(Number(x));
}

function dedupConsecutive(points2d) {
	if (!Array.isArray(points2d) || points2d.length === 0) return points2d;

	const out = [];
	let last = null;

	for (const p of points2d) {
		if (!last || p.x !== last.x || p.y !== last.y) out.push(p);
		last = p;
	}

	return out;
}

/**
 * Freeze rule:
 * record 0 is treated as header/meta and skipped
 */
function sliceDataRows(rowsRaw) {
	if (!Array.isArray(rowsRaw) || rowsRaw.length === 0) {
		return { header: null, rows: [] };
	}

	return {
		header: rowsRaw[0] ?? null,
		rows: rowsRaw.slice(1),
	};
}

function makeMeasure(value, unit = null) {
	if (!isFiniteNum(value)) return null;
	return {
		value: Number(value),
		...(unit ? { unit } : {}),
	};
}

function pushWarning(warnings, index, code, message, extra = null) {
	warnings.push({
		index,
		code,
		message,
		...(extra ? { extra } : {}),
	});
}

// -------------------------------------------------------------------------------------------------
// legacy preview hooks (deprecated)
// -------------------------------------------------------------------------------------------------

/**
 * @deprecated
 * Legacy preview helper. Not part of target landFAT semantics.
 * Kept temporarily to preserve existing artifact generation / preview behavior.
 */
function buildPolylineFromTRA(rows) {
	const pts = [];

	for (const r of rows) {
		const x = r.easting;
		const y = r.northing;
		if (isFiniteNum(x) && isFiniteNum(y)) pts.push({ x, y });
	}

	return dedupConsecutive(pts);
}

/**
 * @deprecated
 * Legacy preview helper. Not part of target landFAT semantics.
 * Kept temporarily to preserve existing cant artifact behavior.
 */
function buildCantFromTRA(rows) {
	const pts = [];

	for (const r of rows) {
		const s0 = r.station;
		if (!isFiniteNum(s0)) continue;

		const uA = isFiniteNum(r.cantA) ? (Number(r.cantA) / 1000) : null; // mm -> m
		const uE = isFiniteNum(r.cantE) ? (Number(r.cantE) / 1000) : null; // mm -> m
		const L = isFiniteNum(r.arcLength) ? Number(r.arcLength) : null;

		if (uA !== null) pts.push({ s: s0, u: uA });
		if (L !== null && L !== 0 && uE !== null) pts.push({ s: s0 + L, u: uE });
	}

	pts.sort((a, b) => a.s - b.s);
	return pts.length >= 2 ? pts : null;
}

// -------------------------------------------------------------------------------------------------
// TRA source-near helpers
// -------------------------------------------------------------------------------------------------

function collectTraCantHints(rows) {
	const out = [];

	for (let i = 0; i < (rows?.length ?? 0); i += 1) {
		const r = rows[i];

		if (
			isFiniteNum(r?.cantA) ||
			isFiniteNum(r?.cantE) ||
			isFiniteNum(r?.fieldC)
		) {
			out.push({
				station: isFiniteNum(r?.station) ? Number(r.station) : null,
				u1: isFiniteNum(r?.cantA) ? Number(r.cantA) : null,
				u2: isFiniteNum(r?.cantE) ? Number(r.cantE) : null,
				c: isFiniteNum(r?.fieldC) ? Number(r.fieldC) : null,
				sourceIndex: i + 1,
			});
		}
	}

	return out;
}

function collectTraWarnings(rows) {
	const warnings = [];
	const usableRows = Array.isArray(rows) ? rows : [];

	// @baustelle [TRA-ENDPOINT-ROW]
	// Verm.EsN TRA enthält am Ende einen zusätzlichen Endpunkt-Datensatz.
	// Alle Records außer dem letzten werden als Geometrie-Records verstanden;
	// der Folge-Record liefert den Endpunkt.
	for (let i = 0; i < usableRows.length - 1; i += 1) {
		const r = usableRows[i];
		const nextR = usableRows[i + 1];
		const index = i + 1;

		const hasStart =
			isFiniteNum(r?.easting) &&
			isFiniteNum(r?.northing);

		const kindCode = isFiniteNum(r?.kindCode) ? Number(r.kindCode) : null;

		const hasEnd =
			isFiniteNum(nextR?.easting) &&
			isFiniteNum(nextR?.northing);

		if (!hasStart) {
			pushWarning(
				warnings,
				index,
				"bad_start",
				"TRA record has invalid start coordinates"
			);
		}

		if (!hasEnd && kindCode !== 6) {
			pushWarning(
				warnings,
				index,
				"missing_end_point",
				"TRA record has no following endpoint record"
			);
		}

		if (!isFiniteNum(r?.kindCode)) {
			pushWarning(
				warnings,
				index,
				"missing_kind_code",
				"TRA record has no valid kindCode"
			);
		}
	}

	return warnings;
}

function buildCantEntriesFromTRARows(rows) {
	const out = [];
	const seen = new Set();

	for (let i = 0; i < (rows?.length ?? 0); i += 1) {
		const r = rows[i];
		const station = isFiniteNum(r?.station) ? Number(r.station) : null;
		const appliedCant = isFiniteNum(r?.cantA) ? Number(r.cantA) : null;

		if (station == null || appliedCant == null) continue;

		const key = `${station}::${appliedCant}`;
		if (seen.has(key)) continue;
		seen.add(key);

		out.push(
			fat.cantStation({
				station: makeMeasure(station, "meter"),
				appliedCant: makeMeasure(appliedCant, "millimeter"),
				extras: {
					sourceSemantics: {
						sourceField: "cantA",
						note: "TRA cant is emitted source-near at record start station only; no end-station reconstruction in parser.",
					},
				},
			})
		);
	}

	return out;
}

// -------------------------------------------------------------------------------------------------
// GRA source-near extraction
// -------------------------------------------------------------------------------------------------

function isLikelyHugeMarkerValue(v) {
	if (!isFiniteNum(v)) return false;
	return Math.abs(Number(v)) >= 1e6;
}

function detectGraSpecialCases(rows) {
	const warnings = [];
	let suspectedSwitchScissorRows = 0;
	let suspectedKmLineMarkerRows = 0;

	rows.forEach((r, i) => {
		const index = i + 1; // after header

		if (isLikelyHugeMarkerValue(r.tangentL)) {
			suspectedKmLineMarkerRows += 1;
			pushWarning(
				warnings,
				index,
				"gra_huge_tangent_marker",
				"GRA row has unusually large tangent length; possible synthetic marker around km-jump / km-line gradient handling",
				{ tangentL: r.tangentL }
			);
		}

		if (
			isFiniteNum(r.station) &&
			isFiniteNum(r.height) &&
			isFiniteNum(r.radius) &&
			isFiniteNum(r.tangentL) &&
			Math.abs(Number(r.tangentL)) >= 3000
		) {
			suspectedSwitchScissorRows += 1;
			pushWarning(
				warnings,
				index,
				"gra_possible_switch_scissor",
				"GRA row may belong to Gleisscheren / ramp semantics; values kept source-near without reinterpretation",
				{
					station: r.station,
					height: r.height,
					radius: r.radius,
					tangentL: r.tangentL,
				}
			);
		}
	});

	let mode = "gradeProfile";
	if (suspectedSwitchScissorRows > 0 && suspectedKmLineMarkerRows > 0) {
		mode = "mixedOrUnknown";
	} else if (suspectedSwitchScissorRows > 0) {
		mode = "switchScissor";
	} else if (suspectedKmLineMarkerRows > 0) {
		mode = "kmLineOrSyntheticMarkers";
	}

	return {
		mode,
		suspectedSwitchScissorRows,
		suspectedKmLineMarkerRows,
		warnings,
	};
}

function extractGraProfilePoints(rows, specialCases) {
	const pts = [];

	for (const r of rows) {
		const s = isFiniteNum(r.station) ? Number(r.station) : null;
		const z = isFiniteNum(r.height) ? Number(r.height) : null;

		if (s == null || z == null) continue;

		const tangentLength = isFiniteNum(r.tangentL) ? Number(r.tangentL) : null;
		const radius = isFiniteNum(r.radius) ? Number(r.radius) : null;

		pts.push({
			station: s,
			elevation: z,
			radius,
			tangentLength,
			pointNumber: r.pointNumber ?? null,
			pointKey: r.pointKey ?? null,
			flags: {
				suspectedKmJumpMarker: isLikelyHugeMarkerValue(tangentLength),
				sourceMode: specialCases?.mode ?? "gradeProfile",
			},
		});
	}

	pts.sort((a, b) => a.station - b.station);
	return pts;
}

/**
 * @deprecated
 * Legacy helper for preview / compatibility only.
 * Grade derivation is a calculation and not primary parser responsibility.
 */
function buildLegacyGradeFromProfilePoints(points) {
	if (!Array.isArray(points) || points.length < 2) return null;

	const grade = [];

	for (let i = 0; i < points.length - 1; i++) {
		const a = points[i];
		const b = points[i + 1];
		const ds = b.station - a.station;
		if (!isFiniteNum(ds) || Number(ds) === 0) continue;

		const slope = (b.elevation - a.elevation) / ds;
		grade.push({ s: a.station, i: slope });
	}

	if (grade.length) {
		const lastSlope = grade[grade.length - 1].i;
		const endS = points[points.length - 1].station;
		grade.push({ s: endS, i: lastSlope });
	}

	return grade.length ? grade : null;
}

// -------------------------------------------------------------------------------------------------
// GRA -> landFAT
// -------------------------------------------------------------------------------------------------

function buildGraProfile(profilePoints, { name, specialCases } = {}) {
	return fat.profile({
		name: name ?? null,
		desc: "source-near profile from GRA",
		profAlign: fat.profAlign({
			name: name ?? null,
			desc: "source-near PVI sequence from GRA",
			pvis: (profilePoints ?? []).map((p) =>
				fat.pvi({
					station: makeMeasure(p?.station, "meter"),
					elevation: makeMeasure(p?.elevation, "meter"),
					extras: {
						sourceSemantics: {
							radius: p?.radius ?? null,
							tangentLength: p?.tangentLength ?? null,
							pointNumber: p?.pointNumber ?? null,
							pointKey: p?.pointKey ?? null,
							flags: p?.flags ?? null,
						},
					},
				})
			),
			paraCurves: [],
		}),
		extras: {
			sourceSemantics: {
				mode: specialCases?.mode ?? "gradeProfile",
				note: "GRA source-near profile; no parabola reconstruction in parser.",
			},
		},
	});
}

export function liftParsedGraToLandFAT(parsedGra, opts = {}) {
	if (!parsedGra || parsedGra.kind !== "GRA") {
		throw new Error("liftParsedGraToLandFAT: invalid input");
	}

	const {
		name,
		meta = {},
		profilePoints = [],
		specialCases = null,
		grade = null,
		cant1d = null,
		rowsRaw = null,
		rows = null,
		header = null,
		raw = null,
		trackScissorClaims = [],
		graRecordDiagnostics = [],
	} = parsedGra;

	const alignmentId = opts.alignmentId ?? `${name ?? "gra"}_alignment`;
	const alignmentName = opts.alignmentName ?? name ?? "GRA_alignment";

	const doc = fat.createDocument({
		meta: {
			sourceFile: raw?.filename ?? meta?.name ?? "",
			format: "GRA",

			name: meta?.name ?? null,
			size: meta?.size ?? null,
			fileType: meta?.type ?? null,
			lastModified: meta?.lastModified ?? null,

			byteLength: meta?.byteLength ?? null,
			cycleBytes: meta?.cycleBytes ?? null,
			cycles: meta?.cycles ?? null,
			remainderBytes: meta?.remainderBytes ?? null,

			header: meta?.header ?? null,
			dataRows: meta?.dataRows ?? null,
			profilePts: meta?.profilePts ?? null,
		},

		units: {
			linearUnit: "meter",
			elevationUnit: "meter",
			angularUnit: null,
		},

		coordinateSystem: {
			horizontalCoordinateSystemName: null,
			verticalCoordinateSystemName: null,
		},

		extras: {
			sourceSemantics: {
				format: "GRA",
				note: "Root contains exactly one alignment with empty coordGeom and source-near profile.",
			},
		},
	});

	fat.pushAlignment(
		doc,
		fat.createAlignment({
			id: alignmentId,
			name: alignmentName,

			coordGeom: fat.createCoordGeom({
				elements: [],
			}),

			staEquations: null,
			profile: buildGraProfile(profilePoints, {
				name: alignmentName,
				specialCases,
			}),
			cant: [],

			extras: {
				sourceSemantics: {
					format: "GRA",
					stationReference: {
						mode: "unknown",
						note: "GRA stations may represent km-line stationing or true track stationing; source does not encode this explicitly.",
					},
				},
				specialCases,
				coupledCantGradientConstructions: trackScissorClaims,
				graRecordDiagnostics,
				legacy: {
					grade,
					cant1d,
				},
				raw: {
					rowsRaw,
					rows,
					header,
				},
			},
		})
	);

	return doc;
}

// -------------------------------------------------------------------------------------------------
// TRA -> landFAT
// -------------------------------------------------------------------------------------------------

export function liftParsedTraToLandFAT(parsedTra, opts = {}) {
	if (!parsedTra || parsedTra.kind !== "TRA") {
		throw new Error("liftParsedTraToLandFAT: invalid input");
	}

	const {
		name,
		meta = {},
		coordGeom = { elements: [] },
		staEquations = [],
		cantHints = [],
		cantEntries = [],
		warnings = [],
		geometry = null,
		cant1d = null,
		rowsRaw = null,
		rows = null,
		header = null,
		raw = null,
	} = parsedTra;

	const alignmentName = opts.alignmentName ?? name ?? "TRA_alignment";
	const alignmentId = opts.alignmentId ?? `${alignmentName}_id`;

	const doc = fat.createDocument({
		meta: {
			sourceFile: raw?.filename ?? meta?.name ?? "",
			format: "TRA",

			name: meta?.name ?? null,
			size: meta?.size ?? null,
			fileType: meta?.type ?? null,
			lastModified: meta?.lastModified ?? null,

			byteLength: meta?.byteLength ?? null,
			cycleBytes: meta?.cycleBytes ?? null,
			cycles: meta?.cycles ?? null,
			remainderBytes: meta?.remainderBytes ?? null,

			header: meta?.header ?? null,
			dataRows: meta?.dataRows ?? null,
			points: meta?.points ?? null,
			coordGeomCount: meta?.coordGeomCount ?? null,
			staEquationCount: meta?.staEquationCount ?? null,
		},

		units: {
			linearUnit: "meter",
			elevationUnit: "meter",
			angularUnit: "radian",
		},

		coordinateSystem: {
			horizontalCoordinateSystemName: null,
			verticalCoordinateSystemName: null,
		},

		extras: {
			sourceSemantics: {
				format: "TRA",
				note: "Root contains exactly one alignment with source-near coordGeom.",
			},
		},
	});

	fat.pushAlignment(
		doc,
		fat.createAlignment({
			id: alignmentId,
			name: alignmentName,

			coordGeom: fat.createCoordGeom({
				elements: Array.isArray(coordGeom?.elements) ? coordGeom.elements : [],
			}),

			staEquations: staEquations.length ? staEquations : null,
			profile: null,
			cant: cantEntries,

			extras: {
				sourceSemantics: {
					format: "TRA",
					angular: {
						defaultDirection: {
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
					note: "Direction values are preserved as source values; no conversion performed in parser.",
				},
				cantHints,
				warnings,
				legacy: {
					geometry,
					cant1d,
				},
				raw: {
					rowsRaw,
					rows,
					header,
				},
			},
		})
	);

	return doc;
}

// -------------------------------------------------------------------------------------------------
// entry
// -------------------------------------------------------------------------------------------------

export async function parseTraGraAuto(file) {
	const extension = getExtensionLower(file.name);
	const name = baseName(file.name);
	const buffer = await file.arrayBuffer();

	if (extension === "tra") {
		const decoded = decodeBinary(buffer, "TRA");
		const sliced = sliceDataRows(decoded.rowsRaw);

		const polyline2d = buildPolylineFromTRA(sliced.rows);
		const cant1d = buildCantFromTRA(sliced.rows);

		const traSemanticMap = getTraLikeSemanticMapForTRA();

const coordGeom = buildCoordGeomFromTraLikeRecords(sliced.rows, traSemanticMap);
const staEquations = extractStaEquationsFromTraLikeRecords(sliced.rows, traSemanticMap);
		const cantHints = collectTraCantHints(sliced.rows);
		const warnings = collectTraWarnings(sliced.rows);
		const cantEntries = buildCantEntriesFromTRARows(sliced.rows);

		const parsedTra = {
			kind: "TRA",
			name,

			meta: {
				...baseMetaFromFile(file),
				...decoded.meta,
				points: polyline2d.length,
				header: sliced.header ? "present" : "none",
				dataRows: sliced.rows.length,
				coordGeomCount: coordGeom?.elements?.length ?? 0,
				staEquationCount: staEquations.length,
			},

			geometry: { pts: polyline2d },
			cant1d,

			coordGeom,
			staEquations,
			cantHints,
			cantEntries,
			warnings,

			rowsRaw: decoded.rowsRaw,
			rows: sliced.rows,
			header: sliced.header,

			raw: { filename: file.name },
		};

		return liftParsedTraToLandFAT(parsedTra, {
			alignmentName: name,
			alignmentId: name,
		});
	}

	if (extension === "gra") {
		const decoded = decodeBinary(buffer, "GRA");
		const sliced = sliceDataRows(decoded.rowsRaw);
		const graRecords = extractGraSourceRecords(sliced.header, sliced.rows);

		const specialCases = detectGraSpecialCases(graRecords.profileRows);
		const profilePoints = extractGraProfilePoints(graRecords.profileRows, specialCases);
		const grade = buildLegacyGradeFromProfilePoints(profilePoints);

		const parsedGra = {
			kind: "GRA",
			name,

			meta: {
				...baseMetaFromFile(file),
				...decoded.meta,
				profilePts: profilePoints?.length ?? 0,
				header: sliced.header ? "present" : "none",
				dataRows: sliced.rows.length,
			},

			profilePoints,
			specialCases,
			trackScissorClaims: graRecords.trackScissorClaims,
			graRecordDiagnostics: graRecords.diagnostics,
			grade,
			cant1d: null,

			rowsRaw: decoded.rowsRaw,
			rows: sliced.rows,
			header: sliced.header,

			raw: { filename: file.name },
		};

		return liftParsedGraToLandFAT(parsedGra, {
			alignmentName: name,
			alignmentId: name,
		});
	}

	throw new Error(`Unsupported import: ${file.name}`);
}
