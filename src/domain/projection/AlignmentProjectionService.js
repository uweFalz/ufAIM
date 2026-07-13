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
} = {}) {
	if (!geometry || typeof geometry !== "object") return null;

	return {
		objectId: objectId != null ? String(objectId) : null,
		geometry,
		source: source != null ? source : null,
		crsId: crsId != null ? String(crsId) : null,
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

	if (DEBUG_PROJECTION) {
		console.log("[Projection] bbox:", bbox);
	}

	return {
		polyline2d,
		bbox,
		bboxCenter: bboxCenter2d(bbox),
	};
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
