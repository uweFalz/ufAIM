// src/import/domain/buildSparseFromLandFAT.js
//
// landFAT -> sparse_v1
//
// Ziel:
// - klare, schlanke Übersetzung
// - Nutzung von sparseWriter (kein Roh-Objektbau mehr)
// - keine versteckte Vertragslogik
//
// @baustelle [7L]
// Erweiterungen (profile, cant, stationing, outerStationing) folgen separat
//
// @baustelle [CONTINUITY]
// Keine automatische Geometrie-Reparatur (nur strukturelle Alternation)
//
// @baustelle [SEMANTIC-DICT]
// transType Mapping aktuell lokal (später Registry)
//

import * as sw from "./sparseWriter.js";

import {
	poseFromHeading,
	poseFromTwoPoints,
} from "@src/lib/geom/frame/pose2.js";

// -----------------------------------------------------------------------------
// guards
// -----------------------------------------------------------------------------

function ensureObject(x, label) {
	if (!x || typeof x !== "object" || Array.isArray(x)) {
		throw new Error(`${label} must be an object`);
	}
	return x;
}

function hasCoordGeomElements(fatAlignment) {
	return Array.isArray(fatAlignment?.coordGeom?.elements);
}

// -----------------------------------------------------------------------------
// low-level readers
// -----------------------------------------------------------------------------

function readPoint(p) {
	if (!p) return null;

	const x = Number.isFinite(p.easting) ? p.easting : p.x;
	const y = Number.isFinite(p.northing) ? p.northing : p.y;

	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

	return { x, y };
}

function readMeasure(m) {
	return m && Number.isFinite(m.value) ? Number(m.value) : null;
}

function readAngle(a) {
	if (!a || !Number.isFinite(a.value)) return null;

	return {
		value: Number(a.value),
		unit: a.unit,
		orientation: a.orientation,
		origin: a.origin,
	};
}

// -----------------------------------------------------------------------------
// angle → math
// -----------------------------------------------------------------------------

function angleToRad(a) {
	let v = a.value;

	switch (a.unit) {
		case "radian": break;
		case "gon": v = v * Math.PI / 200; break;
		case "degree": v = v * Math.PI / 180; break;
		default: throw new Error(`angle unit unsupported: ${a.unit}`);
	}

	if (a.orientation === "cw") v = -v;
	else if (a.orientation !== "ccw") {
		throw new Error(`angle orientation invalid: ${a.orientation}`);
	}

	switch (a.origin) {
		case "east": return v;
		case "north": return v + Math.PI / 2;
		case "west": return v + Math.PI;
		case "south": return v - Math.PI / 2;
		default: throw new Error(`angle origin invalid: ${a.origin}`);
	}
}

// -----------------------------------------------------------------------------
// geometry helpers
// -----------------------------------------------------------------------------

function dist(a, b) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	return Math.sqrt(dx * dx + dy * dy);
}

function poseFromStartDir(seg) {
	const angle =
		readAngle(seg?.direction) ??
		readAngle(seg?.dirStart);

	if (!angle) throw new Error("missing direction");

	const start = readPoint(seg.start);
	if (!start) throw new Error("missing start point");

	const theta = angleToRad(angle);
	return poseFromHeading(start.x, start.y, theta);
}

function poseFromChord(seg) {
	const a = readPoint(seg?.start);
	const b = readPoint(seg?.end);

	if (!a || !b) throw new Error("missing chord");

	const len = dist(a, b);
	if (!Number.isFinite(len) || len <= 0) {
		throw new Error("invalid chord");
	}

	return poseFromTwoPoints(a.x, a.y, b.x, b.y);
}

function resolvePoseA(seg, index) {
	try {
		return poseFromStartDir(seg);
	} catch {
		try {
			return poseFromChord(seg);
		} catch (err) {
			throw new Error(`seg[${index}]: cannot resolve poseA :: ${err.message}`);
		}
	}
}

// -----------------------------------------------------------------------------
// parameter resolution
// -----------------------------------------------------------------------------

function resolveLength(seg) {
	const len = readMeasure(seg?.length);
	if (Number.isFinite(len)) return len;

	const a = readPoint(seg?.start);
	const b = readPoint(seg?.end);

	if (a && b) {
		const chord = dist(a, b);
		if (Number.isFinite(chord) && chord > 0) return chord;
	}

	return null;
}

function resolveCurvature(seg) {
	const r =
		Number.isFinite(seg?.radius) ? seg.radius :
		seg?.radius?.value === "INF" ? Infinity :
		null;

	if (!r || r === Infinity) return 0;

	const rot = String(seg?.rot ?? "").toLowerCase();

	if (rot === "ccw") return  1 / r;
	if (rot === "cw")  return -1 / r;

	return 1 / r;
}

function resolveTransitionType(seg) {
	const raw = String(
		seg?.spiType ?? seg?.transType ?? ""
	).trim().toLowerCase();

	if (!raw) return "clothoid";

	const map = {
		clothoid: "clothoid",
		klothoide: "clothoid",
		spiral: "clothoid",
		bloss: "bloss",
		cubic: "bloss",
		immediate: "immediate",
		kink: "kink",
	};

	return map[raw] ?? raw;
}

function deltaDirVec(seg) {
	const a = readAngle(seg?.delta);
	if (!a) throw new Error("missing delta angle");

	const t = angleToRad(a);

	return {
		x: Math.cos(t),
		y: Math.sin(t),
	};
}

// -----------------------------------------------------------------------------
// mapping
// -----------------------------------------------------------------------------

function mapSegment(seg, index) {

	const poseA = resolvePoseA(seg, index);
	const len = resolveLength(seg);

	switch (seg.type) {

		case "Line": {
			if (!Number.isFinite(len) || len <= 1e-12) return [];

			return [sw.fixed({
				poseA,
				arcLength: len,
				curvature: 0,
				meta: { sourceType: "Line" },
			})];
		}

		case "Curve": {
			const k = resolveCurvature(seg);

			if (!Number.isFinite(len) || len <= 1e-12) {
				return [sw.zeroFixed({
					poseA,
					curvature: k,
					meta: { sourceType: "Curve" },
				})];
			}

			return [sw.fixed({
				poseA,
				arcLength: len,
				curvature: k,
				meta: { sourceType: "Curve" },
			})];
		}

		case "Spiral": {
			const type = resolveTransitionType(seg);

			if (!Number.isFinite(len) || len <= 1e-12) {
				return [sw.immediate({
					poseA,
					meta: { sourceType: "Spiral" },
				})];
			}

			return [sw.transition({
				poseA,
				arcLength: len,
				transType: type,
				meta: { sourceType: "Spiral" },
			})];
		}

		case "Kink": {
			return [sw.kink({
				poseA,
				deltaDir: deltaDirVec(seg),
				meta: { sourceType: "Kink" },
			})];
		}

		case "Immediate": {
			return [sw.immediate({
				poseA,
				meta: { sourceType: "Immediate" },
			})];
		}

		default:
			throw new Error(`seg[${index}]: unsupported type "${seg.type}"`);
	}
}

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------

export function buildSparseFromLandFAT(fatAlignment) {

	ensureObject(fatAlignment, "fatAlignment");

	if (!hasCoordGeomElements(fatAlignment)) {
		throw new Error("coordGeom.elements missing");
	}

	const elements = fatAlignment.coordGeom.elements;

	if (!elements.length) {
		throw new Error("coordGeom.elements empty");
	}

	const sparseRaw = [];

	for (let i = 0; i < elements.length; i++) {
		const seg = elements[i];
		const mapped = mapSegment(seg, i);
		if (mapped.length) sparseRaw.push(...mapped);
	}

	if (!sparseRaw.length) {
		throw new Error("no sparse elements built");
	}

	const startPose = resolvePoseA(elements[0], 0);

	const sparse = sw.enforceAlternation(sparseRaw);

	return sw.createSparseAlignment({
		name: fatAlignment?.name ?? null,
		startPose,
		elements: sparse,
	});
}
