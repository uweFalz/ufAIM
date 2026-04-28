// src/model/spot/ui/buildSpotUiState.js
//
// buildSpotUiState
//
// Transforms canonical SPOT state into a window-consumable UI shape.
//
// Rules:
// - SPOT remains canonical parameter storage
// - only canonical SpotObjects are rendered
// - no import candidates / no promotable counting / no file counting
// - no geometry computation here
//
// Canonical SpotObject shape expected here:
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
// {
//   rows: [...],
//   activeSpotId,
//   stats: {
//     total,
//     activeCount,
//     missingKernelCount,
//     missingCrsCount
//   }
// }

function getObjects(spotState) {
	return Object.values(spotState?.objects ?? {}).filter(isObject);
}

function getObjectId(object) {
	return object?.id ?? null;
}

function getObjectType(object) {
	return String(object?.type ?? "unknown");
}

function getObjectLabel(object) {
	return (
		object?.meta?.label ??
		object?.meta?.objectId ??
		object?.data?.name ??
		object?.id ??
		"object"
	);
}

function getKernel(object) {
	return isObject(object?.data?.kernel)
		? object.data.kernel
		: null;
}

function hasKernel(object) {
	return Boolean(getKernel(object));
}

function getCrsId(object) {
	return object?.crsId ?? null;
}

function hasCrs(object) {
	return Boolean(getCrsId(object));
}

function buildSourceLabel(object) {
	const source = object?.meta?.source ?? {};
	const fileName = source?.fileName ?? null;
	const objectName = source?.objectName ?? null;

	if (fileName && objectName) return `${fileName} → ${objectName}`;
	if (fileName) return fileName;
	if (objectName) return objectName;

	return null;
}

function buildMissing(object) {
	const missing = [];

	if (!hasKernel(object)) {
		missing.push("kernel");
	}

	if (!hasCrs(object)) {
		missing.push("crsId");
	}

	return missing;
}

function buildNotes(object) {
	return buildMissing(object).map((key) => `${key}=missing`);
}

function getUiStatus(object, activeSpotId) {
	const spotId = getObjectId(object);
	const isActive = spotId === activeSpotId;

	const kernel = hasKernel(object);
	const crs = hasCrs(object);

	if (isActive && kernel && crs) return "focused";
	if (kernel && crs) return "ok";
	if (!kernel || !crs) return "incomplete";

	return "unknown";
}

function buildRow(object, activeSpotId) {
	const spotId = getObjectId(object);
	const kernel = getKernel(object);
	const crsId = getCrsId(object);

	return {
		spotId,
		objectId: spotId,
		isActive: spotId === activeSpotId,

		label: getObjectLabel(object),
		type: getObjectType(object),
		status: getUiStatus(object, activeSpotId),

		sourceLabel: buildSourceLabel(object),

		missing: buildMissing(object),
		notes: buildNotes(object),

		hasKernel: Boolean(kernel),
		hasCrs: Boolean(crsId),

		crsId,
		kernel,
	};
}

function buildStats(rows) {
	return {
		total: rows.length,
		activeCount: rows.filter((r) => r.isActive).length,
		missingKernelCount: rows.filter((r) => !r.hasKernel).length,
		missingCrsCount: rows.filter((r) => !r.hasCrs).length,
	};
}

export function buildSpotUiState(spotState = {}) {
	const objects = getObjects(spotState);
	const activeSpotId = spotState?.meta?.activeSpotId ?? null;

	const rows = objects.map((object) => buildRow(object, activeSpotId));

	rows.sort((a, b) => {
		if (a.isActive && !b.isActive) return -1;
		if (!a.isActive && b.isActive) return 1;
		return String(a.label).localeCompare(String(b.label));
	});

	return {
		rows,
		activeSpotId,
		stats: buildStats(rows),
	};
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
