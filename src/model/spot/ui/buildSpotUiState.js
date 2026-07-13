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
// - no window-local focus or selection semantics
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
//   stats: {
//     total,
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

	if (fileName && objectName) {
		return `${fileName} → ${objectName}`;
	}

	if (fileName) {
		return fileName;
	}

	if (objectName) {
		return objectName;
	}

	if (typeof source === "string" && source.trim()) {
		return source.trim();
	}

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

function getUiStatus(object) {
	const kernel = hasKernel(object);
	const crs = hasCrs(object);

	if (kernel && crs) {
		return "ok";
	}

	if (!kernel || !crs) {
		return "incomplete";
	}

	return "unknown";
}

function buildRow(object) {
	const spotId = getObjectId(object);
	const crsId = getCrsId(object);

	return {
		spotId,
		objectId: spotId,

		label: getObjectLabel(object),
		type: getObjectType(object),
		status: getUiStatus(object),

		sourceLabel: buildSourceLabel(object),

		missing: buildMissing(object),
		notes: buildNotes(object),

		hasKernel: hasKernel(object),
		hasCrs: Boolean(crsId),

		crsId,
	};
}

function buildStats(rows) {
	return {
		total: rows.length,
		missingKernelCount: rows.filter((row) => !row.hasKernel).length,
		missingCrsCount: rows.filter((row) => !row.hasCrs).length,
	};
}

export function buildSpotUiState(spotState = {}) {
	const objects = getObjects(spotState);
	const rows = objects.map(buildRow);

	rows.sort((a, b) => {
		return String(a.label).localeCompare(String(b.label));
	});

	return {
		rows,
		stats: buildStats(rows),
	};
}

function isObject(value) {
	return !!value &&
		typeof value === "object" &&
		!Array.isArray(value);
}
