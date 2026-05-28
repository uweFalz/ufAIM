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
//
// Current terms:
// - Fokus   -> workspace_selection.primaryId
// - Anzeige -> workspace_selection.contextIds
// - workspace_visible_tracks -> projected helper/cache tracks
//
// Deprecated:
// - syncSpotObjectsToPreviewCollection kept as alias

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
	const id = normalizeId(objectId);
	if (!id) return false;

	store.actions?.clearPreviewItem?.();

	store.actions?.setWorkspacePrimary?.({
		objectId: id,
		source: "cockpit",
	});

	// primaryId ist Fokus.
	// contextIds sind NUR Zusatz-/Anzeigeobjekte.
	// Der Fokus selbst gehört NICHT in contextIds.
	const state = store.getState?.() ?? {};
	const sel = state.workspace_selection ?? {};
	const oldIds = Array.isArray(sel.contextIds) ? sel.contextIds : [];

	const nextContextIds = oldIds
	.map(normalizeId)
	.filter((x) => x && x !== id);

	store.actions?.setWorkspaceContextObjects?.({
		objectIds: nextContextIds,
		source: "cockpit-primary",
	});

	store.actions?.setCursorS?.(0);

	console.log("[cockpitActions] primary/context after activate", {
		id,
		workspace_selection: store.getState?.().workspace_selection,
	});

	return true;
}

export function toggleCockpitContextObject({ store, objectId } = {}) {
	const id = normalizeId(objectId);
	if (!id) return false;

	const state = store.getState?.() ?? {};
	const sel = state.workspace_selection ?? {};
	const oldIds = Array.isArray(sel.contextIds) ? sel.contextIds : [];

	const nextIds = oldIds.includes(id)
	? oldIds.filter((x) => x !== id)
	: [...oldIds, id];

	if (store.actions?.setWorkspaceContextIds) {
		store.actions.setWorkspaceContextIds({
			objectIds: nextIds,
			source: "cockpit",
		});
	} else if (store.actions?.toggleWorkspaceContextObject) {
		store.actions.toggleWorkspaceContextObject({
			objectId: id,
			source: "cockpit",
		});
	} else {
		console.warn("[cockpitActions] no workspace context action available");
		return false;
	}

	console.log("[cockpitActions] context after toggle", {
		id,
		nextIds,
		workspace_selection: store.getState?.().workspace_selection,
	});

	return true;
}

// @deprecated
export function toggleCockpitPin(args = {}) {
	return toggleCockpitContextObject(args);
}

export function clearCockpitPreview({ store } = {}) {
	store.actions?.clearPreviewItem?.();
	store.actions?.clearWorkspacePrimary?.();
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

export async function promoteImportItemToSpot({
	store,
	messaging,
	itemId,
	logLine,
} = {}) {
	const id = normalizeId(itemId);
	if (!id) return null;

	const result = await messaging?.sendCmdAwait?.("Spot.PromoteImportItemsById", {
		itemIds: [id],
	});

	const objectId = readFirstAddedObjectId(result);

	if (!result?.ok || !objectId) {
		const reason = readFirstReviewReason(result) ?? "promotion failed";
		logLine?.(`[Cockpit] Promote fehlgeschlagen: ${id} (${reason})`);
		return null;
	}

	const importAcceptedRequested = await markImportItemAccepted({
		messaging,
		itemId: id,
	});

	store.actions?.clearPreviewItem?.();

	function unwrapState(response) {
		return response?.state ?? response?.payload ?? response ?? {};
	}

	const spotResponse = await messaging?.sendCmdAwait?.("Spot.GetState", {});
	const spotState = unwrapState(spotResponse);

	const windowState = store.getState?.() ?? {};

	console.log("[cockpitActions] post-promote check", {
		itemId: id,
		objectId,
		importAcceptedRequested: true,
		workerActiveSpotId: spotState?.activeSpotId ?? null,
		workspacePrimaryId: windowState?.workspace_selection?.primaryId ?? null,
		previewCleared: !windowState?.preview_item,
		workspace_selection: windowState?.workspace_selection,
	});

	return {
		objectId,
		spotState,
		result,
	};
}

// ------------------------------------------------------------
// SPOT -> projected visible track cache
// ------------------------------------------------------------

export function syncSpotObjectsToVisibleTracks({
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

	store.actions?.setWorkspaceVisibleTracks?.({
		items: tracks,
		source: { type: sourceType },
	});

	return tracks;
}

// @deprecated
export function syncSpotObjectsToPreviewCollection(args = {}) {
	return syncSpotObjectsToVisibleTracks(args);
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
	const id = normalizeId(objectId);

	if (!id) {
		logLine?.("[Cockpit] kein Objekt für landXML-Export");
		return false;
	}

	const state = spotState ?? (
	typeof refreshSpotState === "function"
	? await refreshSpotState()
	: null
	);

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

function normalizeId(value) {
	const id = String(value ?? "").trim();
	return id || null;
}

function safeFileStem(value) {
	return String(value ?? "ufAIM_alignment")
	.trim()
	.replace(/\.[^.]+$/g, "")
	.replace(/[^a-zA-Z0-9_\-]+/g, "_")
	.replace(/^_+|_+$/g, "")
	|| "ufAIM_alignment";
}
