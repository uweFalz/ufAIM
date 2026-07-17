// app/io/import/importVisibleTracksAdapter.js
//
// Import preview representation adapter.
//
// Scope:
// - pre-admission projection of import candidates
// - canonical representation output for runtime visibility
//
// Not in scope:
// - store mutation
// - SPOT persistence
// - controller orchestration

import { projectAlignmentGeometry } from "@src/domain/projection/ViewProjectionController.js";

export function buildVisibleTracksFromImportItems({
	items = [],
	fileName = "",
	sampleStep = 5,
} = {}) {
	const tracks = [];

	for (const item of items) {
		if (item?.kind !== "alignment") continue;

		const projected = projectAlignmentGeometry({
			objectId: item?.id ?? null,
			geometry: item?.derived?.sparseAlignment ?? null,
			source: "import-item",
			crsId: deriveItemCrsId(item),
			maxStep: sampleStep,
		});

		const points = projected?.polyline2d;
		if (!Array.isArray(points) || points.length < 2) continue;

		tracks.push({
			id: makeTrackId(fileName, item.id, tracks.length),
			importItemId: item.id ?? null,
			objectId: item.id ?? null,
			label: item?.payload?.name ?? item?.payload?.id ?? item.id ?? "import",
			polyline2d: points,
			bbox: projected?.bbox ?? null,
			source: "import-drop",
			crsId: deriveItemCrsId(item),
		});
	}

	return tracks;
}

function deriveItemCrsId(item) {
	const sr = item?.derived?.spatialRef ?? null;

	return (
		sr?.crsId ??
		sr?.horizontalCrsId ??
		sr?.horizontal ??
		sr?.horizontalCoordinateSystemName ??
		null
	);
}

function makeTrackId(fileName, itemId, index) {
	const f = safeIdStem(fileName || "drop");
	const i = safeIdStem(itemId || `item_${index}`);
	return `import_${f}_${i}_${index}`;
}

function safeIdStem(value) {
	return String(value ?? "x")
		.trim()
		.replace(/\.[^.]+$/g, "")
		.replace(/[^a-zA-Z0-9_\-]+/g, "_")
		.replace(/^_+|_+$/g, "") || "x";
}
