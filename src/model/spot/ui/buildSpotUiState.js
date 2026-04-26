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
// Output:
// {
//   rows: [...],
//   activeSpotId,
//   stats: { total, activeCount, missingSparseCount, missingCrsCount }
// }

function getObjects(spotState) {
	return Object.values(spotState?.objects ?? {}).filter(isObject);
}

function getObjectType(object) {
	return String(object?.type ?? "unknown");
}

function getObjectId(object) {
	return object?.id ?? null;
}

function getObjectLabel(object) {
	return (
		object?.payload?.name ??
		object?.meta?.label ??
		object?.meta?.objectId ??
		object?.id ??
		"object"
	);
}

function getSpatialRef(object) {
	return isObject(object?.spatialRef) ? object.spatialRef : null;
}

function getSparseAlignment(object) {
	return isObject(object?.payload?.sparseAlignment)
		? object.payload.sparseAlignment
		: null;
}

function hasSparse(object) {
	return Boolean(getSparseAlignment(object));
}

function hasHorizontalCrs(object) {
	const spatialRef = getSpatialRef(object);

	return Boolean(
		spatialRef?.horizontalCrsId ??
		spatialRef?.crsId ??
		spatialRef?.horizontal ??
		spatialRef?.horizontalCoordinateSystemName
	);
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

	if (!hasSparse(object)) {
		missing.push("sparseAlignment");
	}

	if (!getSpatialRef(object)) {
		missing.push("spatialRef");
	} else if (!hasHorizontalCrs(object)) {
		missing.push("horizontalCrs");
	}

	return missing;
}

function buildNotes(object) {
	const notes = [];
	const spatialRef = getSpatialRef(object);

	if (!hasSparse(object)) {
		notes.push("sparseAlignment=missing");
	}

	if (!spatialRef) {
		notes.push("spatialRef=missing");
	} else if (!hasHorizontalCrs(object)) {
		notes.push("horizontalCrs=missing");
	}

	return notes;
}

function getUiStatus(object, activeSpotId) {
	const isActive = object?.id === activeSpotId;
	const sparse = hasSparse(object);
	const crs = hasHorizontalCrs(object);

	if (isActive && sparse && crs) return "focused";
	if (sparse && crs) return "ok";
	if (sparse && !crs) return "incomplete";
	if (!sparse) return "incomplete";

	return "unknown";
}

function buildRow(object, activeSpotId) {
	const payload = object?.payload ?? {};
	const status = getUiStatus(object, activeSpotId);

	return {
		spotId: object.id,
		objectId: getObjectId(object),
		isActive: object.id === activeSpotId,

		label: getObjectLabel(object),
		type: getObjectType(object),
		status,

		sourceLabel: buildSourceLabel(object),

		missing: buildMissing(object),
		notes: buildNotes(object),

		hasSparse: hasSparse(object),
		hasHorizontalCrs: hasHorizontalCrs(object),

		sparseAlignment: payload?.sparseAlignment ?? null,
	};
}

function buildStats(rows) {
	return {
		total: rows.length,
		activeCount: rows.filter((r) => r.isActive).length,
		missingSparseCount: rows.filter((r) => !r.hasSparse).length,
		missingCrsCount: rows.filter((r) => !r.hasHorizontalCrs).length,
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
