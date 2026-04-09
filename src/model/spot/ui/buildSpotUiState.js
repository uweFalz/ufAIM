// src/model/spot/ui/buildSpotUiState.js
//
// buildSpotUiState
//
// Transforms canonical SPOT state into a window-consumable UI shape.
//
// Input:
// - raw SpotStore state (not the store API)
//
// Output:
// {
//   rows: [...],
//   activeSpotId,
//   stats: { total, filesSeen }
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

function buildNotes(object) {
	const notes = [];

	const spatialRef = object?.spatialRef ?? null;
	if (spatialRef == null) {
		notes.push("spatialRef=missing");
	} else if (!spatialRef.horizontalCrsId) {
		notes.push("horizontalCrsId=missing");
	}

	return notes;
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

export function buildSpotUiState(spotState = {}) {
	const objects = getObjects(spotState);
	const activeSpotId = spotState?.meta?.activeSpotId ?? null;

	const rows = objects.map((object) => {
		const payload = object?.payload ?? {};
		const type = getObjectType(object);
		const file =
			payload?.source?.file ??
			object?.source?.file ??
			object?.meta?.source?.fileName ??
			null;

		return {
			spotId: object.id,
			objectId: getObjectId(object),
			isActive: object.id === activeSpotId,

			label: getObjectLabel(object),
			type,

			outcome: "spot",
			outcomeConfidence: 1,

			sourceLabel: buildSourceLabel(object),
			files: file ? [file] : [],

			missing: [],
			notes: buildNotes(object),

			hasSparse: Boolean(payload?.sparseAlignment),
			sparseAlignment: payload?.sparseAlignment ?? null,
		};
	});

	return {
		rows,
		activeSpotId,
		stats: {
			total: rows.length,
			filesSeen: countFiles(rows),
		},
	};
}
