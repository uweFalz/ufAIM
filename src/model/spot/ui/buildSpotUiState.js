// src/model/spot/ui/buildSpotUiState.js
//
// buildSpotUiState
//
// Transforms canonical SPOT state into a window-consumable UI shape.
//
// Rules:
// - SPOT remains canonical parameter storage
// - no geometry computation here
// - UI gets status / labels / notes / lightweight flags only
//
// Output:
// {
//   rows: [...],
//   activeSpotId,
//   stats: { total, filesSeen, activeCount, promotableCount, missingSparseCount, missingCrsCount }
// }

function buildSourceLabel(object) {
	const file =
		object?.payload?.source?.file ??
		object?.source?.file ??
		object?.meta?.source?.fileName ??
		"";

	const name =
		object?.payload?.name ??
		object?.meta?.name ??
		object?.meta?.alignmentName ??
		object?.meta?.objectId ??
		object?.id ??
		"";

	if (!file) return name;
	return `${file} → ${name}`;
}

function buildFiles(object) {
	const file =
		object?.payload?.source?.file ??
		object?.source?.file ??
		object?.meta?.source?.fileName ??
		null;

	return file ? [file] : [];
}

function buildNotes(object) {
	const notes = [];

	const spatialRef = object?.spatialRef ?? object?.payload?.spatialRef ?? null;
	if (spatialRef == null) {
		notes.push("spatialRef=missing");
	} else if (!spatialRef.horizontalCrsId) {
		notes.push("horizontalCrsId=missing");
	}

	if (!object?.payload?.sparseAlignment) {
		notes.push("sparseAlignment=missing");
	}

	return notes;
}

function buildMissing(object) {
	const missing = [];

	const spatialRef = object?.spatialRef ?? object?.payload?.spatialRef ?? null;
	if (spatialRef == null) {
		missing.push("spatialRef");
	} else if (!spatialRef.horizontalCrsId) {
		missing.push("horizontalCrsId");
	}

	if (!object?.payload?.sparseAlignment) {
		missing.push("sparseAlignment");
	}

	return missing;
}

function countFiles(rows) {
	const set = new Set();

	for (const row of rows) {
		for (const file of row.files ?? []) {
			set.add(file);
		}
	}

	return set.size;
}

function getObjects(spotState) {
	return Object.values(spotState?.objects ?? {});
}

function getObjectType(object) {
	return object?.type ?? "unknown";
}

function getObjectLabel(object) {
	return (
		object?.payload?.name ??
		object?.meta?.name ??
		object?.meta?.alignmentName ??
		object?.meta?.objectId ??
		object?.id ??
		"object"
	);
}

function getObjectId(object) {
	return (
		object?.meta?.objectId ??
		object?.payload?.importItemId ??
		object?.id ??
		null
	);
}

function hasSparse(object) {
	return Boolean(object?.payload?.sparseAlignment);
}

function hasHorizontalCrs(object) {
	const spatialRef = object?.spatialRef ?? object?.payload?.spatialRef ?? null;
	return Boolean(spatialRef?.horizontalCrsId);
}

function getUiStatus(object, activeSpotId) {
	const isActive = object?.id === activeSpotId;
	const sparse = hasSparse(object);
	const crs = hasHorizontalCrs(object);

	if (isActive && sparse && crs) return "focused";
	if (sparse && crs) return "promotable";
	if (sparse && !crs) return "incomplete";
	if (!sparse) return "parameter-only";

	return "unknown";
}

function getUiReasonCode(object) {
	if (!hasSparse(object)) return "SPARSE_MISSING";
	if (!hasHorizontalCrs(object)) return "CRS_MISSING";
	return "OK";
}

function buildRow(object, activeSpotId) {
	const payload = object?.payload ?? {};
	const type = getObjectType(object);
	const files = buildFiles(object);
	const missing = buildMissing(object);
	const notes = buildNotes(object);
	const status = getUiStatus(object, activeSpotId);
	const reasonCode = getUiReasonCode(object);

	return {
		spotId: object.id,
		objectId: getObjectId(object),
		isActive: object.id === activeSpotId,

		label: getObjectLabel(object),
		type,

		status,
		reasonCode,

		outcome: "spot",
		outcomeConfidence: 1,

		sourceLabel: buildSourceLabel(object),
		files,

		missing,
		notes,

		hasSparse: hasSparse(object),
		hasHorizontalCrs: hasHorizontalCrs(object),

		// keep lightweight parameter access only
		sparseAlignment: payload?.sparseAlignment ?? null,
	};
}

function buildStats(rows) {
	return {
		total: rows.length,
		filesSeen: countFiles(rows),
		activeCount: rows.filter((r) => r.isActive).length,
		promotableCount: rows.filter((r) => r.status === "promotable" || r.status === "focused").length,
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
