// app/domain/cockpit/cockpitItemAdapters.js
//
// Adapter helpers for cockpit UI state.
//
// Role:
// - map canonical ImportSession / SPOT state into cockpit rows
// - derive lightweight user-facing metadata
// - no HTML
// - no messaging
// - no store mutation

import { normalizeCrsId } from "@src/domain/crs/CrsAgent.js";

export function buildImportRows(windowState = {}, importState = {}) {
	const items = Array.isArray(importState?.items) ? importState.items : [];
	const previewId = String(windowState?.preview_item?.id ?? "");

	return items.map((item) => {
		const itemId = String(item?.id ?? "");

		return {
			itemId,
			label: readImportLabel(item),
			fileName: item?.source?.fileName ?? null,
			kind: item?.kind ?? "unknown",
			crsId: deriveImportItemCrsId(item),
			promotable: item?.status?.promotable === true,
			accepted: item?.status?.accepted === true,
			hasSparse: Boolean(item?.derived?.sparseAlignment),
			isPreviewActive: previewId !== "" && previewId === itemId,
			stationRange: deriveImportStationRange(item),
			lengthHint: deriveImportLengthHint(item),
			relationCount: deriveImportRelationCount(item),
			qualityFlags: deriveImportQualityFlags(item),
		};
	});
}

export function buildSpotRows(windowState = {}, spotState = {}) {
	const objects = Object.values(spotState?.objects ?? {});
	const activeObjectId =
		windowState?.focus?.objectId ??
		windowState?.activeRouteProjectId ??
		null;

	return objects.map((obj) => {
		const objectId = String(obj?.id ?? "");

		return {
			objectId,
			label: readSpotLabel(obj),
			type: obj?.type ?? "unknown",
			crsId: normalizeCrsId(obj?.crsId ?? null),
			hasKernel: Boolean(obj?.data?.kernel),
			isActive: activeObjectId === objectId,
			pinned: isPinned(windowState, objectId),
		};
	});
}

export function makePreviewCandidate(item) {
	const kernel = item?.derived?.sparseAlignment ?? null;
	const name = readImportLabel(item);
	const crsId = deriveImportItemCrsId(item);

	return {
		id: item.id ?? item?.payload?.id ?? item?.payload?.name ?? "preview_alignment",
		kind: item.kind ?? "alignment",
		name,

		// compatibility for current ViewController
		sparseAlignment: kernel,
		spatialRef: item?.derived?.spatialRef ?? null,

		// newer vocabulary
		kernel,
		crsId,

		source: {
			fileName: item?.source?.fileName ?? null,
			parserId: item?.source?.parserId ?? null,
			objectName: item?.source?.objectName ?? null,
		},
	};
}

export function findImportItemById(importState, itemId) {
	const items = Array.isArray(importState?.items) ? importState.items : [];
	const want = String(itemId ?? "");

	return items.find((item) => String(item?.id ?? "") === want) ?? null;
}

export function findSpotObjectById(spotState, objectId) {
	const objects = spotState?.objects ?? {};
	return objects[String(objectId ?? "")] ?? null;
}

export function readImportLabel(item) {
	return (
		item?.payload?.name ??
		item?.payload?.id ??
		item?.source?.objectName ??
		item?.id ??
		"import item"
	);
}

export function readSpotLabel(obj) {
	return (
		obj?.data?.name ??
		obj?.meta?.label ??
		obj?.meta?.name ??
		obj?.meta?.objectId ??
		obj?.meta?.alignmentName ??
		obj?.id ??
		"object"
	);
}

export function deriveImportItemCrsId(item) {
	const sr = item?.derived?.spatialRef ?? item?.payload?.spatialRef ?? null;

	return normalizeCrsId(
		sr?.crsId ??
		sr?.horizontalCrsId ??
		sr?.horizontal ??
		sr?.horizontalCoordinateSystemName ??
		null
	);
}

export function derivePreviewCrsId(previewItem) {
	const sr = previewItem?.spatialRef ?? null;

	return normalizeCrsId(
		previewItem?.crsId ??
		sr?.crsId ??
		sr?.horizontalCrsId ??
		sr?.horizontal ??
		sr?.horizontalCoordinateSystemName ??
		null
	);
}

export function deriveImportStationRange(item) {
	return (
		item?.meta?.stationRange ??
		item?.derived?.stationRange ??
		item?.payload?.meta?.stationRange ??
		item?.payload?.extended?.stationRange ??
		null
	);
}

export function deriveImportLengthHint(item) {
	const rangeLength = deriveLengthFromStationRange(deriveImportStationRange(item));
	if (rangeLength != null) return rangeLength;

	const sparse = item?.derived?.sparseAlignment;
	const elements = Array.isArray(sparse?.elements)
		? sparse.elements
		: Array.isArray(sparse?.sparse)
			? sparse.sparse
			: [];

	let sum = 0;

	for (const el of elements) {
		const length = Number(el?.length ?? el?.arcLength ?? el?.L);
		if (Number.isFinite(length) && length > 0) sum += length;
	}

	return sum > 0 ? sum : null;
}

export function deriveImportRelationCount(item) {
	const rels = item?.derived?.relations ?? item?.relations ?? [];
	return Array.isArray(rels) ? rels.length : 0;
}

export function deriveImportQualityFlags(item) {
	const flags = [];

	if (item?.status?.valid === true) flags.push("valid");
	if (item?.status?.promotable === true) flags.push("promotable");
	if (item?.derived?.sparseAlignment) flags.push("kernel");
	if (deriveImportItemCrsId(item)) flags.push("crs");
	if (deriveImportLengthHint(item)) flags.push("length");

	return flags;
}

export function isPinned(windowState, objectId) {
	const pins = Array.isArray(windowState?.view_pins) ? windowState.view_pins : [];
	const want = String(objectId ?? "");

	return pins.some((p) => String(p?.rpId ?? "") === want);
}

function deriveLengthFromStationRange(range) {
	if (!range || typeof range !== "object") return null;

	const sMin = Number(range.sMin ?? range.start ?? range.from ?? range.min);
	const sMax = Number(range.sMax ?? range.end ?? range.to ?? range.max);

	if (!Number.isFinite(sMin) || !Number.isFinite(sMax)) return null;

	return Math.abs(sMax - sMin);
}
