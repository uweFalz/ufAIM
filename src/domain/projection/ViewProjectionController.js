// src/domain/projection/ViewProjectionController.js

import { projectAlignmentPreview } from "./AlignmentProjectionService.js";

const DEBUG_PROJECTION = false;

export function projectFocusedSpotObject(spotObject, opts = {}) {
	if (!spotObject) return null;

	const kernel = getKernel(spotObject);

	if (DEBUG_PROJECTION) {
	console.log("[ViewProjectionController] kernel probe", {
		id: spotObject?.id ?? null,
		type: spotObject?.type ?? null,
		crsId: spotObject?.crsId ?? null,
		hasKernel: Boolean(kernel),
		kernelKeys: Object.keys(kernel ?? {}),
		elementCount: Array.isArray(kernel?.elements) ? kernel.elements.length : null,
		hasStartPose: Boolean(kernel?.startPose),
	});
}

	if (!kernel) return null;

	const geom = projectAlignmentPreview({
		sparseAlignment: kernel,
		maxStep: opts.maxStep ?? 5,
	});

	if (DEBUG_PROJECTION) {
	console.log("[ViewProjectionController] projection probe", {
		id: spotObject?.id ?? null,
		hasGeom: Boolean(geom),
		pointCount: geom?.polyline2d?.length ?? 0,
		hasBbox: Boolean(geom?.bbox),
	});
}

	if (!geom?.polyline2d || geom.polyline2d.length < 2) {
		return null;
	}

	return {
		objectId: spotObject.id ?? null,
		crsId: spotObject.crsId ?? null,
		...geom,
	};
}

export function projectSpotObjects(spotObjects = [], opts = {}) {
	if (!Array.isArray(spotObjects)) return [];

	const out = [];

	for (const obj of spotObjects) {
		const geom = projectFocusedSpotObject(obj, opts);
		if (geom) out.push(geom);
	}

	return out;
}

function getKernel(spotObject) {
	return isObject(spotObject?.data?.kernel)
		? spotObject.data.kernel
		: null;
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
