// src/domain/projection/AlignmentProjectionService.js

import { validateSparseAlignment } from "@spot/validation/validateSparseAlignment.js";
import { makeAlignment2DFromSparse } from "@alignment/build/AlignmentFactory.js";
import { RegistryResolver } from "@transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "@transition/build/KappaFcnBuilder.js";

const registryResolver = new RegistryResolver();
const kappaBuilder = KappaFcnBuilder;

const DEBUG_PROJECTION = false;

export function makeAlignmentProjectionInput({
	objectId = null,
	geometry = null,
	source = null,
	crsId = null,
	georeference = null,
} = {}) {
	if (!geometry || typeof geometry !== "object") return null;

	return {
		objectId: objectId != null ? String(objectId) : null,
		geometry,
		source: source != null ? source : null,
		crsId: crsId != null ? String(crsId) : null,
		georeference: georeference && typeof georeference === "object" ? georeference : null,
	};
}

export function projectAlignmentPreview({
	input,
	maxStep = 5,
} = {}) {
	const geometry = input?.geometry ?? null;
	if (!geometry) return null;

	const validation = validateSparseAlignment(geometry);
	if (!validation?.ok) {
		if (DEBUG_PROJECTION) {
			console.log("[Projection] sparse invalid", validation);
		}
		return null;
	}

	const { alignment } = makeAlignment2DFromSparse({
		startPose: geometry.startPose,
		sparse: geometry.sparse,
		descriptorResolver: registryResolver,
		kappaBuilder,
	});

	if (DEBUG_PROJECTION) {
		console.log("[Projection] alignment built:", {
			arcLength: alignment?.arcLength,
			hasPointAt: typeof alignment?.pointAt === "function",
		});
	}

	if (!alignment || !Number.isFinite(alignment.arcLength)) return null;

	const polyline2d = sampleAlignment2D(alignment, maxStep);

	if (DEBUG_PROJECTION) {
		console.log("[Projection] sampled:", {
			points: polyline2d?.length ?? 0,
			first: polyline2d?.[0] ?? null,
			mid: polyline2d?.length ? polyline2d[Math.floor(polyline2d.length / 2)] : null,
			last: polyline2d?.length ? polyline2d[polyline2d.length - 1] : null,
		});
	}

	if (!Array.isArray(polyline2d) || polyline2d.length < 2) return null;

	const bbox = computeBbox2d(polyline2d);
	const sparse = Array.isArray(geometry.sparse)
		? geometry.sparse
		: Array.isArray(geometry.elements)
		? geometry.elements
		: [];
	const segmentData = sampleAlignmentSegments({
		alignment,
		sparse,
		maxStep,
	});

	if (DEBUG_PROJECTION) {
		console.log("[Projection] bbox:", bbox);
	}

	return {
		polyline2d,
		bbox,
		bboxCenter: bboxCenter2d(bbox),
		segments: segmentData.segments,
		boundaries: segmentData.boundaries,
		startPoint: segmentData.startPoint,
		endPoint: segmentData.endPoint,
		georeference: input?.georeference ?? null,
	};
}

function sampleAlignmentSegments({ alignment, sparse = [], maxStep = 5 } = {}) {
	if (!alignment || !Array.isArray(sparse) || !sparse.length) {
		return {
			segments: [],
			boundaries: [],
			startPoint: null,
			endPoint: null,
		};
	}

	const ds = Number.isFinite(maxStep) && maxStep > 0 ? maxStep : 5;
	const segments = [];
	const boundaries = [];
	const seenBoundaryKeys = new Set();

	let s0 = 0;
	let firstPoint = null;
	let lastPoint = null;

	for (let index = 0; index < sparse.length; index++) {
		const element = sparse[index] ?? {};
		const length = Math.max(0, Number(element.arcLength) || 0);
		const s1 = s0 + length;
		const elementId = String(element.id ?? `element_${index}`);
		const elementType = String(
			element.kind ?? element.type ?? element.sourceElementType ?? element.elementType ?? "unknown"
		).toLowerCase();

		const points2d = sampleSegmentPoints(alignment, s0, s1, ds);
		const startPoint = sampleAlignmentPoint(alignment, s0);
		const endPoint = sampleAlignmentPoint(alignment, s1);

		if (startPoint) {
			firstPoint ??= startPoint;
			pushBoundary(boundaries, seenBoundaryKeys, {
				id: `${elementId}:start`,
				elementId,
				kind: elementType,
				position: "start",
				s: s0,
				point2d: startPoint,
			});
		}

		if (endPoint) {
			lastPoint = endPoint;
			pushBoundary(boundaries, seenBoundaryKeys, {
				id: `${elementId}:end`,
				elementId,
				kind: elementType,
				position: "end",
				s: s1,
				point2d: endPoint,
			});
		}

		if (points2d?.length >= 2) {
			segments.push({
				id: elementId,
				elementId,
				kind: elementType,
				s0,
				s1,
				length,
				points2d,
				startPoint,
				endPoint,
				isTransition: elementType === "transition",
				isArc: elementType === "arc",
				isStraight: elementType === "straight" || elementType === "fixed",
			});
		}

		s0 = s1;
	}

	return {
		segments,
		boundaries,
		startPoint: firstPoint,
		endPoint: lastPoint,
	};
}

function sampleSegmentPoints(alignment, s0, s1, maxStep) {
	const start = Math.min(s0, s1);
	const end = Math.max(s0, s1);
	const length = Math.max(0, end - start);
	const count = Math.max(2, Math.ceil(Math.max(length, 1) / Math.max(1e-6, maxStep)) + 1);
	const points = [];

	for (let index = 0; index < count; index++) {
		const ratio = count <= 1 ? 0 : index / (count - 1);
		const sampleS = start + (end - start) * ratio;
		const point = sampleAlignmentPoint(alignment, sampleS);
		if (point) points.push(point);
	}

	return dedupePolyline(points);
}

function sampleAlignmentPoint(alignment, s) {
	const point = alignment?.pointAt?.(s, { quality: "balanced" });
	if (!point) return null;

	const x = Number(point.x);
	const y = Number(point.y);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

	return { x, y };
}

function dedupePolyline(points) {
	const out = [];
	for (const point of Array.isArray(points) ? points : []) {
		if (!point) continue;
		const last = out[out.length - 1];
		if (last && last.x === point.x && last.y === point.y) continue;
		out.push(point);
	}
	return out;
}

function pushBoundary(out, seen, boundary) {
	if (!boundary) return;
	const point = boundary.point2d ?? null;
	if (!point) return;

	const key = `${Number(boundary.s).toFixed(3)}:${Number(point.x).toFixed(3)}:${Number(point.y).toFixed(3)}`;
	if (seen.has(key)) return;
	seen.add(key);
	out.push(boundary);
}

function sampleAlignment2D(alignment, maxStep) {
	const ds = Number.isFinite(maxStep) && maxStep > 0 ? maxStep : 5;
	const L = Math.max(0, Number(alignment.arcLength) || 0);
	if (!(L > 0)) return null;

	const out = [];
	let s = 0;

	while (s <= L) {
		const p = alignment.pointAt(s);
		if (p) out.push({ x: p.x, y: p.y });
		s += ds;
	}

	const pEnd = alignment.pointAt(L);
	if (pEnd) {
		const last = out[out.length - 1];
		if (!last || last.x !== pEnd.x || last.y !== pEnd.y) {
			out.push({ x: pEnd.x, y: pEnd.y });
		}
	}

	return out.length >= 2 ? out : null;
}

function computeBbox2d(polyline2d) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const p of polyline2d ?? []) {
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

function bboxCenter2d(bbox) {
	if (!bbox) return null;

	const x = (Number(bbox.minX) + Number(bbox.maxX)) * 0.5;
	const y = (Number(bbox.minY) + Number(bbox.maxY)) * 0.5;

	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return { x, y };
}
