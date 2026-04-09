// app/core/controllers/viewGeometry.js
//
// Pure geometry / formatting helpers for ViewController.
// No store, no DOM, no three adapter, no closures with external state.

import {
	clamp01,
	clampNumber,
	lerp,
	normDeg180,
	headingDegFromPoints,
} from "@utils/helpers.js";

// ------------------------------------------------------------
// basic polyline helpers
// ------------------------------------------------------------

export function polylineLength(pts) {
	let L = 0;
	for (let i = 1; i < (pts?.length ?? 0); i++) {
		const a = pts[i - 1];
		const b = pts[i];
		L += Math.hypot((b.x - a.x), (b.y - a.y));
	}
	return L;
}

// key parser for strings like "<id>::<slot>" where <id> can contain "::"
export function parseIdSlotKey(key) {
	const parts = String(key ?? "").split("::");
	if (parts.length < 2) return null;

	const slot = parts.pop();
	const id = parts.join("::");

	if (!id || !slot) return null;
	return { id, slot };
}

export function isPolylineValid(polyline2d) {
	return Array.isArray(polyline2d) && polyline2d.length >= 2;
}

export function computeChainage(polyline2d) {
	if (!Array.isArray(polyline2d) || polyline2d.length < 2) return null;

	const cum = new Array(polyline2d.length);
	cum[0] = 0;

	for (let i = 1; i < polyline2d.length; i++) {
		const a = polyline2d[i - 1];
		const b = polyline2d[i];
		cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y);
	}

	return cum;
}

export function samplePointAndTangent(polyline2d, cum, s) {
	if (!cum || !Array.isArray(polyline2d) || polyline2d.length < 2) return null;

	const total = cum[cum.length - 1];
	const ss = clampNumber(s, 0, total);

	let i = 1;
	while (i < cum.length && cum[i] < ss) i++;
	if (i >= cum.length) i = cum.length - 1;

	const s0 = cum[i - 1];
	const s1 = cum[i];
	const a = polyline2d[i - 1];
	const b = polyline2d[i];

	const ds = (s1 - s0) || 1e-9;
	const tt = (ss - s0) / ds;

	const x = a.x + tt * (b.x - a.x);
	const y = a.y + tt * (b.y - a.y);

	let tx = (b.x - a.x);
	let ty = (b.y - a.y);
	const len = Math.hypot(tx, ty) || 1e-9;
	tx /= len;
	ty /= len;

	return { x, y, tx, ty, s: ss, total };
}

export function pointAtS(polyline2d, cum, s) {
	if (!Array.isArray(polyline2d) || polyline2d.length < 2) return null;
	if (!Array.isArray(cum) || cum.length !== polyline2d.length) return null;

	const total = cum[cum.length - 1];
	const ss = clampNumber(s, 0, total);

	let i = 1;
	while (i < cum.length && cum[i] < ss) i++;
	if (i >= cum.length) i = cum.length - 1;

	const s0 = cum[i - 1];
	const s1 = cum[i];
	const a = polyline2d[i - 1];
	const b = polyline2d[i];

	const ds = (s1 - s0) || 1e-9;
	const t = (ss - s0) / ds;

	return {
		x: lerp(a.x, b.x, t),
		y: lerp(a.y, b.y, t),
	};
}

export function clipPolylineByChainage(polyline2d, cum, sA, sB) {
	if (!Array.isArray(polyline2d) || polyline2d.length < 2) return null;
	if (!Array.isArray(cum) || cum.length !== polyline2d.length) return null;

	const total = cum[cum.length - 1];
	let a = clampNumber(sA, 0, total);
	let b = clampNumber(sB, 0, total);

	if (!(Number.isFinite(a) && Number.isFinite(b))) return null;

	const s0 = Math.min(a, b);
	const s1 = Math.max(a, b);
	if (!(s1 > s0)) return null;

	const out = [];
	const pStart = pointAtS(polyline2d, cum, s0);
	const pEnd = pointAtS(polyline2d, cum, s1);
	if (!pStart || !pEnd) return null;

	out.push(pStart);

	for (let i = 1; i < cum.length - 1; i++) {
		const si = cum[i];
		if (si > s0 && si < s1) out.push(polyline2d[i]);
	}

	out.push(pEnd);

	if (out.length < 2) return null;
	return out;
}

export function makeSectionLine(sample, halfWidth = 20) {
	const nx = -sample.ty;
	const ny = sample.tx;

	return {
		p0: { x: sample.x - nx * halfWidth, y: sample.y - ny * halfWidth, z: 0 },
		p1: { x: sample.x + nx * halfWidth, y: sample.y + ny * halfWidth, z: 0 },
	};
}

// ------------------------------------------------------------
// bbox helpers
// ------------------------------------------------------------

export function computeBbox(polyline2d) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const p of (polyline2d ?? [])) {
		const x = Number(p?.x);
		const y = Number(p?.y);
		if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}

	if (!Number.isFinite(minX)) return null;
	return { minX, minY, maxX, maxY };
}

export function unionBbox(a, b) {
	if (!a) return b ?? null;
	if (!b) return a ?? null;

	return {
		minX: Math.min(a.minX, b.minX),
		minY: Math.min(a.minY, b.minY),
		maxX: Math.max(a.maxX, b.maxX),
		maxY: Math.max(a.maxY, b.maxY),
	};
}

export function computeBboxUnionFromTracks(tracks) {
	let bbox = null;

	for (const t of (tracks ?? [])) {
		const pts = t?.points;
		if (!Array.isArray(pts) || pts.length < 2) continue;

		const b = computeBbox(pts);
		bbox = unionBbox(bbox, b);
	}

	return bbox;
}

export function pickBboxFromArtifactOrPolyline(art, poly) {
	const b =
	art?.payload?.bbox ??
	art?.payload?.bboxENU ??
	art?.payload?.bbox?.bbox ??
	null;

	if (b?.minX != null) return b;
	return computeBbox(poly);
}

// ------------------------------------------------------------
// pins / ids
// ------------------------------------------------------------

// pins: legacy string or object
export function normalizePins(pins) {
	const arr = Array.isArray(pins) ? pins : [];
	const out = [];

	for (const p of arr) {
		if (!p) continue;

		if (typeof p === "string") {
			const [rpId, slot] = String(p).split("::");
			if (rpId) out.push({ rpId, slot: slot || "right" });
			continue;
		}

		if (typeof p === "object") {
			const rpId = p.rpId ?? p.baseId ?? null;
			if (!rpId) continue;

			out.push({
				rpId: String(rpId),
				slot: String(p.slot ?? "right"),
			});
		}
	}

	return out;
}

export function makeActiveGeomKey(state) {
	const aa = state.import_activeArtifacts;
	if (aa) {
		return `${aa.baseId ?? ""}::${aa.slot ?? ""}::${aa.alignmentArtifactId ?? ""}`;
	}

	const rpId = state.activeRouteProjectId ?? "";
	const slot = state.activeSlot ?? "right";
	return `${rpId}::${slot}::(no-activeArtifacts)`;
}

// ------------------------------------------------------------
// aux/chunk style helpers
// ------------------------------------------------------------

export function computeAuxAlphaByAge(ageSec, { minA, maxA, fadeSec }) {
	const t = clamp01(ageSec / Math.max(1e-6, fadeSec));
	return maxA + (minA - maxA) * t;
}

export function buildChunkMetrics(points, s0, s1) {
	if (!Array.isArray(points) || points.length < 2) return null;

	const h0 = headingDegFromPoints(points[0], points[1]);
	const h1 = headingDegFromPoints(points[points.length - 2], points[points.length - 1]);
	const dH = normDeg180(h1 - h0);

	return {
		s0,
		s1,
		len: polylineLength(points),
		p0: { x: points[0].x, y: points[0].y },
		p1: { x: points[points.length - 1].x, y: points[points.length - 1].y },
		h0,
		h1,
		dH,
	};
}
