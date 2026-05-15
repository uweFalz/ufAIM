// app/controllers/cockpit/cockpitActions.js
//
// Cockpit action helpers.
//
// Role:
// - keep CockpitController focused on wiring/render/state orchestration
// - collect imperative cockpit side effects
// - provide small reusable action functions
//
// NOT:
// - no DOM event wiring
// - no HTML rendering
// - no parser/import pipeline logic

import { projectAlignmentPreview } from "@src/domain/projection/AlignmentProjectionService.js";
import { exportLandXML } from "@src/export/exportLandXML.js";
import { downloadTextFile } from "@src/export/downloadFile.js";

import {
	findSpotObjectById,
	readSpotLabel,
} from "@app/domain/cockpit/cockpitItemAdapters.js";

// ------------------------------------------------------------
// focus / selection
// ------------------------------------------------------------

export function activateObjectId({ store, objectId } = {}) {
	const id = String(objectId ?? "").trim();
	if (!id) return false;

	store.actions?.clearPreviewItem?.();

	// Transitional bridge:
	// activeRouteProjectId is still used by ViewController as focus mirror.
	store.actions?.setActiveRouteProject?.(id);

	// New direction:
	// workspace_selection is the canonical window-side selection target.
	store.actions?.setWorkspacePrimary?.({
		objectId: id,
		source: "cockpit",
	});

	store.actions?.setCursorS?.(0);

	return true;
}

export function toggleCockpitPin({ store, objectId, slot = "right" } = {}) {
	const id = String(objectId ?? "").trim();
	if (!id) return false;

	// Transitional bridge:
	// view_pins still drives some UI/render paths.
	store.actions?.togglePinRouteProject?.({
		rpId: id,
		slot,
	});

	// New direction:
	// contextIds are the future multi-object workspace selection.
	store.actions?.toggleWorkspaceContextObject?.({
		objectId: id,
		source: "cockpit",
	});

	return true;
}

export function clearCockpitPreview({ store } = {}) {
	store.actions?.clearPreviewItem?.();
	return true;
}

// ------------------------------------------------------------
// import admission
// ------------------------------------------------------------

export async function markImportItemAccepted({ messaging, itemId } = {}) {
	try {
		await messaging?.sendCmdAwait?.("Import.SetItemAccepted", {
			itemId,
			accepted: true,
		});
		return true;
	} catch (err) {
		console.warn("[Cockpit] Import.SetItemAccepted failed", err);
		return false;
	}
}

// ------------------------------------------------------------
// SPOT -> rendered context tracks
// ------------------------------------------------------------

export function syncSpotObjectsToPreviewCollection({
	store,
	spotState,
	maxStep = 5,
	sourceType = "spot-sync",
} = {}) {
	const objects = Object.values(spotState?.objects ?? {});
	const tracks = [];

	for (const obj of objects) {
		const kernel = obj?.data?.kernel ?? null;
		if (!kernel) continue;

		const projected = projectAlignmentPreview({
			sparseAlignment: kernel,
			maxStep,
		});

		const points = projected?.polyline2d;
		if (!Array.isArray(points) || points.length < 2) continue;

		tracks.push({
			id: String(obj.id),
			objectId: String(obj.id),
			points,
			source: "spot",
		});
	}

	store.actions?.setImportPreviewCollection?.({
		items: tracks,
		source: { type: sourceType },
	});

	return tracks;
}

// ------------------------------------------------------------
// export
// ------------------------------------------------------------

export async function exportLandXMLById({
	spotState,
	refreshSpotState,
	objectId,
	logLine,
} = {}) {
	const id = String(objectId ?? "").trim();

	if (!id) {
		logLine?.("[Cockpit] kein Objekt für landXML-Export");
		return false;
	}

	const state = spotState ?? (typeof refreshSpotState === "function"
		? await refreshSpotState()
		: null);

	const obj = findSpotObjectById(state, id);

	if (!obj) {
		logLine?.(`[Cockpit] SPOT-Objekt nicht gefunden: ${id}`);
		return false;
	}

	const alignment = obj?.data?.kernel ?? null;
	if (!alignment) {
		logLine?.(`[Cockpit] kein Alignment-Kernel für Export: ${id}`);
		return false;
	}

	const label = readSpotLabel(obj) ?? id;

	const xml = exportLandXML({
		alignment,
		meta: {
			name: label,
			objectId: id,
			crsId: obj?.crsId ?? null,
		},
	});

	downloadTextFile({
		content: xml,
		fileName: `${safeFileStem(label || id)}.landxml`,
	});

	logLine?.(`[Cockpit] landXML exportiert: ${label}`);
	return true;
}

// ------------------------------------------------------------
// result readers
// ------------------------------------------------------------

export function readFirstAddedObjectId(result) {
	return Array.isArray(result?.addedObjects) && result.addedObjects[0]?.id
		? String(result.addedObjects[0].id)
		: null;
}

export function readFirstReviewReason(result) {
	return Array.isArray(result?.reviewItems) && result.reviewItems[0]?.reason
		? String(result.reviewItems[0].reason)
		: null;
}

// ------------------------------------------------------------
// misc
// ------------------------------------------------------------

function safeFileStem(value) {
	return String(value ?? "ufAIM_alignment")
		.trim()
		.replace(/\.[^.]+$/g, "")
		.replace(/[^a-zA-Z0-9_\-]+/g, "_")
		.replace(/^_+|_+$/g, "")
		|| "ufAIM_alignment";
}
