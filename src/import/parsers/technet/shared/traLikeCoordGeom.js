// src/import/parsers/technet/shared/traLikeCoordGeom.js
//
// TRA-like coordGeom builder
//
// Ziel:
// Einheitliche Ableitung von landFAT.coordGeom aus
// - VermEsn TRA
// - GND Edit (EL/EK)
//
// Grundlage:
// kindCode / ELTYP / EKTYP werden als identische Semantik interpretiert,
// die konkrete Winkel-/Typ-Semantik kommt jedoch aus einer kleinen semanticMap.
//
// @baustelle [FORMAT-NEUTRAL]
// Diese Datei kennt KEIN konkretes Quellformat (TRA, XLSX, MDB, DBB).
//
// @baustelle [NO-GEOM-SOLVE]
// Keine geometrische Rekonstruktion:
// - keine Kreismittelpunkte
// - keine Spiralintegration
// - keine Richtungsableitung
//
// @baustelle [CHAIN-MODE]
// Erwartet Records mit Start+End (bereits "paired").
//
// @baustelle [SOURCE]
// Source bleibt source-nah und minimal.
// Der Caller kann zusätzliche Herkunftsinfos ergänzen.
//
// @baustelle [STA-EQ-LATER]
// Kilometersprünge / StaEquation werden hier erkannt.
// Die Extraktion läuft separat über extractStaEquationsFromTraLikeRecords().
//
// @baustelle [SEMANTIC-MAP]
// Diese Datei enthält nicht mehr die volle Winkel-/Typ-Semantik hartkodiert,
// sondern liest sie aus einer kleinen shared semanticMap.

import * as fat from "@kimport/landfat/landFatWriter.js";

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function isFiniteNum(x) {
	return Number.isFinite(Number(x));
}

function makeMeasure(value, unit = null) {
	if (!isFiniteNum(value)) return null;
	return {
		value: Number(value),
		...(unit ? { unit } : {}),
	};
}

function makeAngle(value, unit, orientation, origin) {
	if (!isFiniteNum(value)) return null;

	return {
		value: Number(value),
		unit,
		orientation,
		origin,
	};
}

function makePoint(easting, northing) {
	if (!isFiniteNum(easting) || !isFiniteNum(northing)) return null;

	return {
		easting: Number(easting),
		northing: Number(northing),
	};
}

function makeRadius(value) {
	if (!isFiniteNum(value)) return null;
	return Number(value);
}

function nearlyEqual(a, b, eps = 1e-12) {
	return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
}

function asKindCode(value) {
	if (!isFiniteNum(value)) return null;
	return Number(value);
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

// -----------------------------------------------------------------------------
// semantic map access
// -----------------------------------------------------------------------------

function getDefaults(semanticMap) {
	return semanticMap?.defaults ?? {};
}

function getTypeDispatch(semanticMap) {
	return semanticMap?.typeDispatch ?? {};
}

function getDirectionSemantic(semanticMap) {
	return (
		getDefaults(semanticMap)?.angular?.direction ?? {
			unit: "radian",
			orientation: "cw",
			origin: "north",
		}
	);
}

function getKinkDeltaSemantic(semanticMap) {
	return (
		getDefaults(semanticMap)?.angular?.kinkDelta ?? {
			unit: "gon",
			orientation: "cw",
			origin: "west",
		}
	);
}

function getLinearUnit(semanticMap) {
	return getDefaults(semanticMap)?.units?.linearUnit ?? "meter";
}

function getCurvatureUnit(semanticMap) {
	return getDefaults(semanticMap)?.curvature?.unit ?? "meter";
}

function getStationUnit(semanticMap) {
	return getDefaults(semanticMap)?.station?.unit ?? getLinearUnit(semanticMap);
}

function resolveTraLikeKind(kindCode, semanticMap = null) {
	const kz = asKindCode(kindCode);
	const dispatch = getTypeDispatch(semanticMap);

	const hit = kz != null ? dispatch[kz] : null;

	if (hit) {
		return {
			kindCode: kz,
			targetType: hit.targetType ?? "Spiral",
			spiType: hit.spiType ?? null,
			label: hit.label ?? hit.note ?? `kz_${kz}`,
		};
	}

	return {
		kindCode: kz,
		targetType: "Spiral",
		spiType: kz == null ? null : `kz_${kz}`,
		label: kz == null ? "unknown" : `kz_${kz}`,
	};
}

function makeDirectionAngle(value, semanticMap = null) {
	const s = getDirectionSemantic(semanticMap);
	return makeAngle(value, s.unit, s.orientation, s.origin);
}

function makeKinkAngle(value, semanticMap = null) {
	const s = getKinkDeltaSemantic(semanticMap);
	return makeAngle(value, s.unit, s.orientation, s.origin);
}

// -----------------------------------------------------------------------------
// common source/extras
// -----------------------------------------------------------------------------

function makeSourceFromRecord(rec, index, extra = {}) {
	return {
		kindCode: asKindCode(rec?.kindCode),
		index,
		...extra,
	};
}

function makeElementExtras(rec, kind, semanticMap = null, extra = {}) {
	return {
		sourceSemantics: {
			formatClass: "tra-like",
			formatId: semanticMap?.formatId ?? null,
			fileType: semanticMap?.fileType ?? null,
			kindCode: kind?.kindCode ?? null,
			typeLabel: kind?.label ?? null,
			targetType: kind?.targetType ?? null,
			spiType: kind?.spiType ?? null,
			units: {
				linearUnit: getLinearUnit(semanticMap),
				stationUnit: getStationUnit(semanticMap),
				curvatureUnit: getCurvatureUnit(semanticMap),
			},
			angular: {
				defaultDirection: getDirectionSemantic(semanticMap),
				kinkDelta: getKinkDeltaSemantic(semanticMap),
			},
		},
		...(isObject(rec?.valueOrigins) ? { valueOrigins: rec.valueOrigins } : {}),
		...extra,
	};
}

// -----------------------------------------------------------------------------
// element builders
// -----------------------------------------------------------------------------

function baseElement({ type, start, staStart, source, extras }) {
	return {
		type,
		start,
		...(staStart ? { staStart } : {}),
		...(source ? { source } : {}),
		...(extras ? { extras } : {}),
	};
}

function makeLine(ctx) {
	return {
		...baseElement(ctx),
		end: ctx.end,
		length: ctx.length,
		direction: ctx.direction,
	};
}

function makeCurve(ctx) {
	return {
		...baseElement(ctx),
		end: ctx.end,
		radius: ctx.radius,
		length: ctx.length,
		dirStart: ctx.direction,
		dirEnd: null,
	};
}

function makeSpiral(ctx) {
	return {
		...baseElement(ctx),
		end: ctx.end,
		radiusStart: ctx.radiusStart,
		radiusEnd: ctx.radiusEnd,
		length: ctx.length,
		dirStart: ctx.direction,
		dirEnd: null,
		spiType: ctx.spiType ?? null,
	};
}

function makeKink(ctx) {
	return {
		...baseElement(ctx),
		end: ctx.end ?? null,
		length: makeMeasure(0, "meter"),
		delta: ctx.delta,
		dirStart: ctx.direction ?? null,
		dirEnd: null,
	};
}

// -----------------------------------------------------------------------------
// main mapping
// -----------------------------------------------------------------------------

export function mapTraLikeRecordToElements(
	rec,
	nextRec,
	index,
	ctx = {}
) {
	const semanticMap = ctx?.semanticMap ?? null;
	const linearUnit = getLinearUnit(semanticMap);
	const stationUnit = getStationUnit(semanticMap);

	const out = [];

	const start = makePoint(rec?.easting, rec?.northing);
	const end = makePoint(nextRec?.easting, nextRec?.northing);

	if (!start) {
		ctx?.warnings?.push?.({
			index,
			code: "bad_start",
			message: "tra-like record has invalid start coordinates",
		});
		return out;
	}

	const staStart = makeMeasure(rec?.station, stationUnit);
	const direction = makeDirectionAngle(rec?.direction, semanticMap);
	const length = makeMeasure(rec?.arcLength, linearUnit);

	const R1 = isFiniteNum(rec?.radiusA) ? Number(rec.radiusA) : null;
	const R2 = isFiniteNum(rec?.radiusE) ? Number(rec.radiusE) : null;

	const kind = resolveTraLikeKind(rec?.kindCode, semanticMap);
	const source = makeSourceFromRecord(rec, index, {
		formatId: semanticMap?.formatId ?? null,
		fileType: semanticMap?.fileType ?? null,
	});

	if (kind.targetType === "StaEquation") {
		return out;
	}

	if (kind.targetType === "Line") {
		out.push(makeLine({
			type: "Line",
			start,
			end,
			length,
			direction,
			staStart,
			source,
			extras: makeElementExtras(rec, kind, semanticMap),
		}));
		return out;
	}

	if (kind.targetType === "Curve") {
		out.push(makeCurve({
			type: "Curve",
			start,
			end,
			length,
			direction,
			radius: makeRadius(R1),
			staStart,
			source,
			extras: makeElementExtras(rec, kind, semanticMap),
		}));
		return out;
	}

	if (kind.targetType === "Kink") {
		out.push(makeLine({
			type: "Line",
			start,
			end,
			length,
			direction,
			staStart,
			source,
			extras: makeElementExtras(rec, kind, semanticMap, {
				coComponentOf: "kink",
			}),
		}));

		out.push(makeKink({
			type: "Kink",
			start,
			end,
			direction,
			delta: makeKinkAngle(R1, semanticMap),
			staStart,
			source,
			extras: makeElementExtras(rec, kind, semanticMap, {
				kinkDeltaSourceField: "radiusA",
			}),
		}));

		return out;
	}

	if (kind.targetType === "Spiral") {
		if (R1 !== null && R2 !== null && nearlyEqual(R1, R2)) {
			out.push(makeCurve({
				type: "Curve",
				start,
				end,
				length,
				direction,
				radius: makeRadius(R1),
				staStart,
				source,
				extras: makeElementExtras(rec, kind, semanticMap, {
					coercedFrom: "Spiral",
					equalRadiusEndpoints: true,
				}),
			}));
			return out;
		}

		out.push(makeSpiral({
			type: "Spiral",
			start,
			end,
			length,
			direction,
			radiusStart: makeRadius(R1),
			radiusEnd: makeRadius(R2),
			spiType: kind.spiType,
			staStart,
			source,
			extras: makeElementExtras(rec, kind, semanticMap),
		}));
		return out;
	}

	return out;
}

// -----------------------------------------------------------------------------
// full builder
// -----------------------------------------------------------------------------

export function buildCoordGeomFromTraLikeRecords(records = [], semanticMap = null) {
	const elements = [];
	const warnings = [];

	for (let i = 0; i < records.length - 1; i += 1) {
		const rec = records[i];
		const next = records[i + 1];

		const mapped = mapTraLikeRecordToElements(rec, next, i + 1, {
			semanticMap,
			warnings,
		});

		if (mapped?.length) elements.push(...mapped);
	}

	return fat.createCoordGeom({ elements });
}

// -----------------------------------------------------------------------------
// staEquation helper
// -----------------------------------------------------------------------------

export function extractStaEquationsFromTraLikeRecords(records = [], semanticMap = null) {
	const out = [];
	const stationUnit = getStationUnit(semanticMap);
	const linearUnit = getLinearUnit(semanticMap);

	for (let i = 0; i < records.length; i += 1) {
		const rec = records[i];
		const kind = resolveTraLikeKind(rec?.kindCode, semanticMap);

		if (kind.targetType !== "StaEquation") continue;

		const station = makeMeasure(rec?.station, stationUnit);
		const delta = makeMeasure(rec?.arcLength, linearUnit);

		if (!station || !delta) continue;

		out.push(
			fat.staEquation({
				station,
				delta,
				extras: {
					sourceSemantics: {
						formatClass: "tra-like",
						formatId: semanticMap?.formatId ?? null,
						fileType: semanticMap?.fileType ?? null,
						kindCode: kind.kindCode ?? null,
						typeLabel: kind.label ?? null,
						targetType: kind.targetType ?? null,
					},
					source: makeSourceFromRecord(rec, i + 1, {
						formatId: semanticMap?.formatId ?? null,
						fileType: semanticMap?.fileType ?? null,
					}),
				},
			})
		);
	}

	return out;
}
