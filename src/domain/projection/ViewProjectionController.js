// src/domain/projection/ViewProjectionController.js

import { projectAlignmentPreview } from "./AlignmentProjectionService.js";

export function projectFocusedSpotObject(spotObject, opts = {}) {
	if (!spotObject) return null;

	const kernel = getKernel(spotObject);
	if (!kernel) return null;

	const geom = projectAlignmentPreview({
		sparseAlignment: kernel,
		maxStep: opts.maxStep ?? 5,
	});

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
