// src/domain/projection/ViewProjectionController.js
//
// ViewProjectionController
//
// Rolle:
// - übersetzt ein fokussiertes SPOT-Objekt in viewbare Geometrie
// - KEINE View-Logik
// - KEINE Import-Logik
// - KEINE Store-Logik
//
// Input:
// - spotObject (canonical aus SPOT)
//
// Expected SpotObject:
// {
//   id,
//   type,
//   data: {
//     kernel
//   },
//   crsId,
//   meta
// }
//
// Output:
// - viewGeometry (polyline2d + bbox)
//
// Wichtig:
// - nur Projection-Schicht
// - deterministic, stateless
//

import { projectAlignmentPreview } from "./AlignmentProjectionService.js";

// -----------------------------------------------------------------------------

export function projectFocusedSpotObject(spotObject, opts = {}) {
	if (!spotObject) {
		console.warn("[ViewProjectionController] no spotObject");
		return null;
	}

	const kernel = getKernel(spotObject);

	console.log("[ViewProjectionController] input", {
		id: spotObject?.id ?? null,
		type: spotObject?.type ?? null,
		crsId: spotObject?.crsId ?? null,
		hasData: Boolean(spotObject?.data),
		hasKernel: Boolean(kernel),
		kernelKeys: kernel ? Object.keys(kernel) : [],
		elements: Array.isArray(kernel?.elements) ? kernel.elements.length : null,
		sparse: Array.isArray(kernel?.sparse) ? kernel.sparse.length : null,
		startPose: kernel?.startPose ?? null,
	});

	if (!kernel) return null;

	const geom = projectAlignmentPreview({
		sparseAlignment: kernel,
		maxStep: opts.maxStep ?? 5,
	});

	console.log("[ViewProjectionController] output", {
		id: spotObject?.id ?? null,
		hasGeom: Boolean(geom),
		polylineCount: Array.isArray(geom?.polyline2d) ? geom.polyline2d.length : null,
		bbox: geom?.bbox ?? null,
	});

	if (!geom) return null;

	return {
		objectId: spotObject.id ?? null,
		crsId: spotObject.crsId ?? null,
		...geom,
	};
}

// -----------------------------------------------------------------------------

export function projectSpotObjects(spotObjects = [], opts = {}) {
	if (!Array.isArray(spotObjects)) return [];

	const out = [];

	for (const obj of spotObjects) {
		const geom = projectFocusedSpotObject(obj, opts);
		if (geom) out.push(geom);
	}

	return out;
}

// -----------------------------------------------------------------------------

function getKernel(spotObject) {
	return isObject(spotObject?.data?.kernel)
		? spotObject.data.kernel
		: null;
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
