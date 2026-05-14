// app/domain/cockpit/cockpitItemAdapters.js
//
// Adapter helpers for cockpit UI state.
//
// Role:
// - map canonical ImportSession / SPOT state into cockpit rows
// - derive lightweight user-facing object metadata
// - support Universe/Object Navigator thinking
// - no HTML
// - no messaging
// - no store mutation

import { normalizeCrsId } from "@src/domain/crs/CrsAgent.js";

// -----------------------------------------------------------------------------
// import rows: secondary / inbox-like
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// SPOT rows: primary Universe objects
// -----------------------------------------------------------------------------

export function buildSpotRows(windowState = {}, spotState = {}) {
	const objects = Object.values(spotState?.objects ?? {});
	const activeObjectId =
		windowState?.focus?.objectId ??
		windowState?.activeRouteProjectId ??
		null;

	return objects.map((obj) => {
		const objectId = String(obj?.id ?? "");
		const kernel = readSpotKernel(obj);
		const bands = readSpotBands(obj);
		const source = readSpotSource(obj);

		return {
			objectId,
			label: readSpotLabel(obj),
			type: obj?.type ?? obj?.kind ?? "unknown",
			crsId: deriveSpotObjectCrsId(obj),

			// object state
			hasKernel: Boolean(kernel),
			hasCant: Boolean(bands?.cant),
			hasProfile: Boolean(bands?.profile),
			hasStaEq: Boolean(bands?.staEq),
			hasBands: Boolean(bands?.cant || bands?.profile || bands?.staEq),

			// user-facing hints
			lengthHint: deriveSpotLengthHint(obj),
			elementCount: deriveSpotElementCount(obj),
			bandSummary: deriveSpotBandSummary(obj),
			source,
			sourceLabel: formatSourceLabel(source),
			exportable: isSpotExportable(obj),
			issues: deriveSpotIssues(obj),
			qualityFlags: deriveSpotQualityFlags(obj),

			// UI state
			isActive: activeObjectId === objectId,
			pinned: isPinned(windowState, objectId),
		};
	});
}

// -----------------------------------------------------------------------------
// preview candidate
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// finders
// -----------------------------------------------------------------------------

export function findImportItemById(importState, itemId) {
	const items = Array.isArray(importState?.items) ? importState.items : [];
	const want = String(itemId ?? "");

	return items.find((item) => String(item?.id ?? "") === want) ?? null;
}

export function findSpotObjectById(spotState, objectId) {
	const objects = spotState?.objects ?? {};
	return objects[String(objectId ?? "")] ?? null;
}

// -----------------------------------------------------------------------------
// labels
// -----------------------------------------------------------------------------

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
		obj?.payload?.name ??
		obj?.meta?.label ??
		obj?.meta?.name ??
		obj?.meta?.objectId ??
		obj?.meta?.alignmentName ??
		obj?.id ??
		"object"
	);
}

// -----------------------------------------------------------------------------
// CRS
// -----------------------------------------------------------------------------

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

export function deriveSpotObjectCrsId(obj) {
	const sr =
		obj?.spatialRef ??
		obj?.data?.spatialRef ??
		obj?.payload?.spatialRef ??
		obj?.meta?.spatialRef ??
		null;

	return normalizeCrsId(
		obj?.crsId ??
		obj?.data?.crsId ??
		obj?.payload?.crsId ??
		sr?.crsId ??
		sr?.horizontalCrsId ??
		sr?.horizontal ??
		sr?.horizontalCoordinateSystemName ??
		null
	);
}

// -----------------------------------------------------------------------------
// import metadata
// -----------------------------------------------------------------------------

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

	return deriveSparseLength(item?.derived?.sparseAlignment);
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

// -----------------------------------------------------------------------------
// SPOT metadata
// -----------------------------------------------------------------------------

export function readSpotKernel(obj) {
	return (
		obj?.data?.kernel ??
		obj?.payload?.sparseAlignment ??
		obj?.payload?.kernel ??
		obj?.sparseAlignment ??
		null
	);
}

export function readSpotBands(obj) {
	const kernel = readSpotKernel(obj);

	return (
		obj?.data?.bands ??
		obj?.payload?.bands ??
		kernel?.bands ??
		{}
	);
}

export function readSpotSource(obj) {
	return {
		fileName:
			obj?.meta?.source?.fileName ??
			obj?.source?.fileName ??
			obj?.data?.source?.fileName ??
			null,

		parserId:
			obj?.meta?.source?.parserId ??
			obj?.source?.parserId ??
			obj?.data?.source?.parserId ??
			null,

		objectName:
			obj?.meta?.source?.objectName ??
			obj?.source?.objectName ??
			obj?.data?.source?.objectName ??
			null,
	};
}

export function deriveSpotLengthHint(obj) {
	const explicit = deriveLengthFromStationRange(
		obj?.meta?.stationRange ??
		obj?.data?.stationRange ??
		obj?.payload?.meta?.stationRange ??
		null
	);

	if (explicit != null) return explicit;

	return deriveSparseLength(readSpotKernel(obj));
}

export function deriveSpotElementCount(obj) {
	const kernel = readSpotKernel(obj);
	const elements = readSparseElements(kernel);

	return elements.length;
}

export function deriveSpotBandSummary(obj) {
	const bands = readSpotBands(obj);
	const out = [];

	if (bands?.cant) out.push("cant");
	if (bands?.profile) out.push("profile");
	if (bands?.staEq) out.push("staEq");

	return out;
}

export function isSpotExportable(obj) {
	const kernel = readSpotKernel(obj);
	return Boolean(kernel && readSparseElements(kernel).length > 0);
}

export function deriveSpotIssues(obj) {
	const issues = [];

	if (!readSpotKernel(obj)) issues.push("missingKernel");
	if (!deriveSpotObjectCrsId(obj)) issues.push("missingCrs");
	if (!deriveSpotElementCount(obj)) issues.push("emptyGeometry");

	return issues;
}

export function deriveSpotQualityFlags(obj) {
	const flags = [];

	if (readSpotKernel(obj)) flags.push("kernel");
	if (deriveSpotObjectCrsId(obj)) flags.push("crs");
	if (deriveSpotLengthHint(obj)) flags.push("length");
	if (isSpotExportable(obj)) flags.push("exportable");

	const bands = readSpotBands(obj);
	if (bands?.cant) flags.push("cant");
	if (bands?.profile) flags.push("profile");
	if (bands?.staEq) flags.push("staEq");

	return flags;
}

// -----------------------------------------------------------------------------
// UI state helpers
// -----------------------------------------------------------------------------

export function isPinned(windowState, objectId) {
	const pins = Array.isArray(windowState?.view_pins) ? windowState.view_pins : [];
	const want = String(objectId ?? "");

	return pins.some((p) => String(p?.rpId ?? "") === want);
}

// -----------------------------------------------------------------------------
// generic helpers
// -----------------------------------------------------------------------------

function deriveLengthFromStationRange(range) {
	if (!range || typeof range !== "object") return null;

	const sMin = Number(range.sMin ?? range.start ?? range.from ?? range.min);
	const sMax = Number(range.sMax ?? range.end ?? range.to ?? range.max);

	if (!Number.isFinite(sMin) || !Number.isFinite(sMax)) return null;

	return Math.abs(sMax - sMin);
}

function deriveSparseLength(sparse) {
	const elements = readSparseElements(sparse);

	let sum = 0;

	for (const el of elements) {
		const length = Number(el?.length ?? el?.arcLength ?? el?.L);
		if (Number.isFinite(length) && length > 0) sum += length;
	}

	return sum > 0 ? sum : null;
}

function readSparseElements(sparse) {
	if (Array.isArray(sparse?.elements)) return sparse.elements;
	if (Array.isArray(sparse?.sparse)) return sparse.sparse;
	return [];
}

function formatSourceLabel(source = {}) {
	const parts = [
		source.objectName,
		source.fileName,
		source.parserId,
	].filter(Boolean);

	return parts.length ? parts.join(" · ") : null;
}
