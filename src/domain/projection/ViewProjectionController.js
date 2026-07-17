// src/domain/projection/ViewProjectionController.js

import {
	makeAlignmentProjectionInput,
	projectAlignmentPreview,
} from "./AlignmentProjectionService.js";

const DEBUG_PROJECTION = false;

export function projectAlignmentGeometry({
	objectId = null,
	geometry = null,
	crsId = null,
	source = "spot-object",
	maxStep = 5,
} = {}) {
	const input = makeAlignmentProjectionInput({
		objectId,
		geometry,
		source,
		crsId,
	});

	if (!input) return null;

	const geom = projectAlignmentPreview({
		input,
		maxStep,
	});

	if (!geom?.polyline2d || geom.polyline2d.length < 2) {
		return null;
	}

	return {
		objectId: objectId != null ? String(objectId) : null,
		crsId: crsId != null ? String(crsId) : null,
		...geom,
	};
}

export function projectFocusedSpotObject(spotObject, opts = {}) {
	if (!spotObject) return null;

	const geometry = getProjectableGeometry(spotObject);
	const projected = projectAlignmentGeometry({
		objectId: spotObject?.id ?? null,
		geometry,
		source: "spot-object",
		crsId: spotObject?.crsId ?? null,
		maxStep: opts.maxStep ?? 5,
	});

	if (DEBUG_PROJECTION) {
	console.log("[ViewProjectionController] kernel probe", {
		id: spotObject?.id ?? null,
		type: spotObject?.type ?? null,
		crsId: spotObject?.crsId ?? null,
		hasKernel: Boolean(geometry),
		kernelKeys: Object.keys(geometry ?? {}),
		elementCount: Array.isArray(geometry?.elements) ? geometry.elements.length : null,
		hasStartPose: Boolean(geometry?.startPose),
	});
}

	if (DEBUG_PROJECTION) {
	console.log("[ViewProjectionController] projection probe", {
		id: spotObject?.id ?? null,
		hasGeom: Boolean(projected),
		pointCount: projected?.polyline2d?.length ?? 0,
		hasBbox: Boolean(projected?.bbox),
	});
}

	return projected;
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

function getProjectableGeometry(spotObject) {
	return isObject(spotObject?.data?.kernel)
		? spotObject.data.kernel
		: null;
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
