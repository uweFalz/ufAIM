// src/alignment/service/sampleSparseAlignmentForView.js
//
// Kernel facade for VIEW
//
// Purpose:
// - take canonical sparseAlignment
// - validate it
// - build Alignment2D
// - sample polyline for rendering
//
// NO:
// - no UI
// - no SPOT logic
// - no messaging
//
// YES:
// - deterministic, pure computation
//
// Future:
// - can be moved to worker without changing callers

import { validateSparseAlignment } from "../../spot/validation/validateSparseAlignment.js";
import { makeAlignment2DFromSparse } from "../build/AlignmentFactory.js";

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------

function computeBBox(points) {
	if (!points.length) return null;

	let minX = +Infinity, minY = +Infinity;
	let maxX = -Infinity, maxY = -Infinity;

	for (const p of points) {
		if (!p) continue;
		const x = Number(p.x);
		const y = Number(p.y);
		if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}

	if (!Number.isFinite(minX)) return null;

	return { minX, minY, maxX, maxY };
}

// ------------------------------------------------------------
// main
// ------------------------------------------------------------

export function sampleSparseAlignmentForView({
	sparseAlignment,
	descriptorResolver,
	kappaBuilder,
	step = 5,          // meters
	maxPoints = 5000,  // safety
	log = () => {},
} = {}) {

	// --------------------------------------------------------
	// 1) validate
	// --------------------------------------------------------

	const validation = validateSparseAlignment(sparseAlignment);

	if (!validation?.ok) {
		const err = new Error("sparseAlignment invalid");
		err.code = "SPARSE_INVALID";
		err.validation = validation;
		throw err;
	}

	// --------------------------------------------------------
	// 2) build runtime alignment
	// --------------------------------------------------------

	const { alignment, warnings } = makeAlignment2DFromSparse({
		startPose: sparseAlignment.startPose,
		sparse: sparseAlignment.sparse,
		descriptorResolver,
		kappaBuilder,
	});

	if (!alignment) {
		throw new Error("AlignmentFactory failed");
	}

	if (warnings?.length) {
		log?.("alignment build warnings:", warnings);
	}

	// --------------------------------------------------------
	// 3) sample polyline
	// --------------------------------------------------------

	const L = alignment.arcLength;
	const ds = Math.max(0.1, Number(step) || 5);

	const points = [];

	let s = 0;
	let count = 0;

	while (s <= L && count < maxPoints) {
		const p = alignment.pointAt(s);
		if (p) {
			points.push({ x: p.x, y: p.y });
		}
		s += ds;
		count++;
	}

	// ensure last point
	if (points.length === 0 || s < L + ds) {
		const pEnd = alignment.pointAt(L);
		if (pEnd) {
			points.push({ x: pEnd.x, y: pEnd.y });
		}
	}

	// --------------------------------------------------------
	// 4) bbox
	// --------------------------------------------------------

	const bbox = computeBBox(points);

	// --------------------------------------------------------
	// 5) return
	// --------------------------------------------------------

	return {
		polyline2d: points,
		bbox,
		arcLength: L,
		sampleStep: ds,
		warnings,
	};
}
