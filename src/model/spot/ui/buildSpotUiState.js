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

function readGeoreference(object) {
	return object?.data?.georeference ?? object?.data?.extended?.spatialRef ?? null;
}

function buildSpatialSummary(object) {
	const geo = readGeoreference(object);
	const mode = String(geo?.mode ?? geo?.resolutionState ?? object?.crsStatus ?? "").toLowerCase();
	if (mode.includes("geographic") || mode.includes("supported") || geo?.resolvedEpsg) {
		return { mode: "geographic", label: "Geographic reference resolved" };
	}
	return { mode: "local", label: "Local Cartesian" };
}

function collectEvidence(object) {
	const candidates = [
		object?.data?.extended?.unresolvedAttachments,
		object?.data?.extended?.extras?.unresolvedAttachments,
		object?.data?.meta?.unresolvedAttachments,
		object?.meta?.unresolvedAttachments,
	];
	return candidates.find(Array.isArray) ?? [];
}

function collectWarnings(object, evidence) {
	const warnings = [
		...(Array.isArray(object?.meta?.warnings) ? object.meta.warnings : []),
		...(Array.isArray(object?.data?.meta?.diagnostics) ? object.data.meta.diagnostics : []),
	];
	for (const item of evidence) {
		warnings.push(item?.message ?? `${item?.kind ?? "Attachment"} evidence ${item?.status ?? "unresolved"}`);
	}
	return warnings.map((value) => typeof value === "string" ? value : value?.decision ?? value?.message ?? value?.code).filter(Boolean);
}

function buildSourceKind(object) {
	const source = object?.meta?.source;
	if (source === "editor" || source?.kind === "editor") return "created";
	return source ? "imported" : "created";
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
	const evidence = collectEvidence(object);
	const warnings = collectWarnings(object, evidence);
	const spatial = buildSpatialSummary(object);

	return {
		spotId,
		objectId: spotId,

		label: getObjectLabel(object),
		type: getObjectType(object),
		status: getUiStatus(object),

		sourceLabel: buildSourceLabel(object),
		sourceKind: buildSourceKind(object),
		spatialMode: spatial.mode,
		spatialLabel: spatial.label,
		lastChange: object?.meta?.modifiedAt ?? object?.meta?.createdAt ?? null,
		warnings,
		unresolvedEvidence: evidence.map((item) => ({
			kind: item?.kind ?? "attachment",
			status: item?.status ?? "unresolved",
			evidenceClass: item?.evidenceClass ?? null,
			message: item?.message ?? null,
			ambiguityReason: item?.ambiguityReason ?? item?.rejectionReason ?? null,
		})),

		missing: buildMissing(object),
		notes: buildNotes(object),

		hasKernel: hasKernel(object),
		hasCrs: Boolean(crsId),

		crsId,
		details: {
			id: spotId,
			crsId,
			crsStatus: object?.crsStatus ?? null,
			source: object?.meta?.source ?? null,
			lifecycle: object?.meta?.lifecycle ?? null,
		},
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
