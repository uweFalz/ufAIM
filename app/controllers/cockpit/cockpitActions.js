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

import {
	makeAlignmentProjectionInput,
	projectAlignmentPreview,
} from "@src/domain/projection/AlignmentProjectionService.js";
import { exportLandXML } from "@src/export/exportLandXML.js";
import { downloadTextFile } from "@src/export/downloadFile.js";
import {
	getWorkspaceSelection,
	getWorkspacePrimaryId,
	getWorkspaceContextIds,
} from "@src/shared/runtime/workspaceSelectionAccess.js";

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
	// contextIds sind nur zusätzliche Anzeigeobjekte.
	// Der Fokus selbst gehört nicht zusätzlich in contextIds.
	const state = store.getState?.() ?? {};
	const oldIds = getWorkspaceContextIds(state);

	const nextContextIds = oldIds
		.map(normalizeId)
		.filter((contextId) => contextId && contextId !== id);

	if (store.actions?.setWorkspaceContextObjects) {
		store.actions.setWorkspaceContextObjects({
			objectIds: nextContextIds,
			source: "cockpit-primary",
		});
	} else if (store.actions?.setWorkspaceContextIds) {
		store.actions.setWorkspaceContextIds({
			objectIds: nextContextIds,
			source: "cockpit-primary",
		});
	}

	store.actions?.setCursorS?.(0);

	console.log("[cockpitActions] primary/context after activate", {
		id,
		workspace_selection: getWorkspaceSelection(store.getState?.()),
	});

	return true;
}

export function toggleCockpitContextObject({ store, objectId } = {}) {
	const id = normalizeId(objectId);
	if (!id) return false;

	const state = store.getState?.() ?? {};
	const primaryId = getWorkspacePrimaryId(state);

	// Der Fokus darf nicht gleichzeitig als zusätzlicher Kontext geführt werden.
	if (id === primaryId) {
		console.warn(
			"[cockpitActions] focused object cannot be added to context",
			{ id }
		);
		return false;
	}

	const oldIds = getWorkspaceContextIds(state);

	const normalizedOldIds = oldIds
		.map(normalizeId)
		.filter(Boolean);

	const nextIds = normalizedOldIds.includes(id)
		? normalizedOldIds.filter((contextId) => contextId !== id)
		: [...normalizedOldIds, id];

	if (store.actions?.setWorkspaceContextObjects) {
		store.actions.setWorkspaceContextObjects({
			objectIds: nextIds,
			source: "cockpit",
		});
	} else if (store.actions?.setWorkspaceContextIds) {
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
		workspace_selection: getWorkspaceSelection(store.getState?.()),
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
	store.actions?.setCursorS?.(0);

	return true;
}

// ------------------------------------------------------------
// editor actions
// ------------------------------------------------------------

export async function addStraightToActiveAlignment({
	alignmentEditor,
	length = 100,
	logLine,
} = {}) {
	if (!alignmentEditor?.addStraightToActiveAlignment) {
		logLine?.("[Cockpit] AlignmentEditor fehlt: addStraight");
		return null;
	}

	try {
		return await alignmentEditor.addStraightToActiveAlignment({
			length,
		});
	} catch (err) {
		console.error("[Cockpit] addStraight failed", err);

		logLine?.(
			`[Cockpit] Gerade konnte nicht hinzugefügt werden: ${
				err?.message ?? err
			}`
		);

		return null;
	}
}

export async function removeElementFromActiveAlignment({
	alignmentEditor,
	elementId,
	logLine,
} = {}) {
	if (!alignmentEditor?.removeElementFromActiveAlignment) {
		logLine?.("[Cockpit] AlignmentEditor fehlt: removeElement");
		return null;
	}

	const id = normalizeId(elementId);

	if (!id) {
		logLine?.("[Cockpit] Kein Element zum Entfernen ausgewählt");
		return null;
	}

	try {
		return await alignmentEditor.removeElementFromActiveAlignment({
			elementId: id,
		});
	} catch (err) {
		console.error("[Cockpit] removeElement failed", err);

		logLine?.(
			`[Cockpit] Element konnte nicht entfernt werden: ${
				err?.message ?? err
			}`
		);

		return null;
	}
}

export async function clearActiveAlignmentElements({
	alignmentEditor,
	logLine,
} = {}) {
	if (!alignmentEditor?.clearActiveAlignmentElements) {
		logLine?.("[Cockpit] AlignmentEditor fehlt: clearElements");
		return null;
	}

	try {
		return await alignmentEditor.clearActiveAlignmentElements();
	} catch (err) {
		console.error("[Cockpit] clearElements failed", err);

		logLine?.(
			`[Cockpit] Elemente konnten nicht gelöscht werden: ${
				err?.message ?? err
			}`
		);

		return null;
	}
}

// ------------------------------------------------------------
// import admission
// ------------------------------------------------------------

export async function markImportItemAccepted({
	messaging,
	itemId,
} = {}) {
	const id = normalizeId(itemId);
	if (!id) return false;

	try {
		await messaging?.sendCmdAwait?.("Import.SetItemAccepted", {
			itemId: id,
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

	const result = await messaging?.sendCmdAwait?.(
		"Spot.PromoteImportItemsById",
		{
			itemIds: [id],
		}
	);

	const objectId = readFirstAddedObjectId(result);

	if (!result?.ok || !objectId) {
		const reason =
			readFirstReviewReason(result) ??
			readFirstRejectedReason(result) ??
			"promotion failed";

		logLine?.(
			`[Cockpit] Promote fehlgeschlagen: ${id} (${reason})`
		);

		return null;
	}

	const importAcceptedRequested = await markImportItemAccepted({
		messaging,
		itemId: id,
	});

	store.actions?.clearPreviewItem?.();

	const spotResponse = await messaging?.sendCmdAwait?.(
		"Spot.GetState",
		{}
	);

	const spotState = unwrapState(spotResponse);
	const windowState = store.getState?.() ?? {};

	console.log("[cockpitActions] post-promote check", {
		itemId: id,
		objectId,
		importAcceptedRequested,
		workspacePrimaryId: getWorkspacePrimaryId(windowState),
		previewCleared: !windowState?.preview_item,
		workspace_selection: getWorkspaceSelection(windowState),
		spotObjectPresent: Boolean(
			findSpotObjectById(spotState, objectId)
		),
	});

	return {
		objectId,
		spotState,
		result,
		importAcceptedRequested,
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

	for (const object of objects) {
		const input = makeAlignmentProjectionInput({
			objectId: object?.id ?? null,
			geometry: object?.data?.kernel ?? null,
			source: "spot",
			crsId: object?.crsId ?? null,
		});
		if (!input) continue;

		const projected = projectAlignmentPreview({
			input,
			maxStep,
		});

		const points = projected?.polyline2d;

		if (!Array.isArray(points) || points.length < 2) {
			continue;
		}

		tracks.push({
			id: String(object.id),
			objectId: String(object.id),
			points,
			source: "spot",
		});
	}

	store.actions?.setWorkspaceVisibleTracks?.({
		items: tracks,
		source: {
			type: sourceType,
		},
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

	const state =
		spotState ??
		(
			typeof refreshSpotState === "function"
				? await refreshSpotState()
				: null
		);

	const object = findSpotObjectById(state, id);

	if (!object) {
		logLine?.(`[Cockpit] SPOT-Objekt nicht gefunden: ${id}`);
		return false;
	}

	const alignment = object?.data?.kernel ?? null;

	if (!alignment) {
		logLine?.(
			`[Cockpit] kein Alignment-Kernel für Export: ${id}`
		);
		return false;
	}

	const label = readSpotLabel(object) ?? id;

	const xml = exportLandXML({
		alignment,
		meta: {
			name: label,
			objectId: id,
			crsId: object?.crsId ?? null,
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
	return Array.isArray(result?.addedObjects) &&
		result.addedObjects[0]?.id
		? String(result.addedObjects[0].id)
		: null;
}

export function readFirstReviewReason(result) {
	return Array.isArray(result?.reviewItems) &&
		result.reviewItems[0]?.reason
		? String(result.reviewItems[0].reason)
		: null;
}

export function readFirstRejectedReason(result) {
	return Array.isArray(result?.rejectedItems) &&
		result.rejectedItems[0]?.reason
		? String(result.rejectedItems[0].reason)
		: null;
}

// ------------------------------------------------------------
// misc
// ------------------------------------------------------------

function unwrapState(response) {
	return response?.state ??
		response?.payload ??
		response ??
		{};
}

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
