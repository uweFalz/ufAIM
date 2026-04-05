// src/projection/ViewProjectionController.js
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
	if (!spotObject) return null;

	console.log("[ViewProjectionController] spotObject =", spotObject);

	const sparseAlignment =
		spotObject?.payload?.sparseAlignment ??
		spotObject?.payload ??
		null;

	console.log("[ViewProjectionController] sparseAlignment =", sparseAlignment);

	if (!sparseAlignment) return null;

	const geom = projectAlignmentPreview({
		sparseAlignment,
		maxStep: opts.maxStep ?? 5,
	});

	console.log("[ViewProjectionController] geom =", geom);

	if (!geom) return null;

	return {
		objectId: spotObject.id ?? null,
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
