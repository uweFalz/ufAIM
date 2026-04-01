// src/projection/AlignmentProjectionService.js
//
// Canonical alignment preview projection service
//
// Rolle:
// - sparseAlignment -> sampled polyline2d
// - bbox / center für Views
// - keine View-spezifische Logik
// - keine Import-Logik

import { sampleAlignment } from "./sampleAlignment.js";

export function projectAlignmentPreview({
	sparseAlignment,
	maxStep = 5,
} = {}) {
	if (!sparseAlignment) return null;

	const polyline2d = sampleAlignment(sparseAlignment, { maxStep });
	if (!Array.isArray(polyline2d) || polyline2d.length < 2) return null;

	const bbox = computeBbox2d(polyline2d);

	return {
		polyline2d,
		bbox,
		bboxCenter: bboxCenter2d(bbox),
	};
}

// -----------------------------------------------------------------------------
// bbox
// -----------------------------------------------------------------------------

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
