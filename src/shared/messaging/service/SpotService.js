// src/shared/messaging/service/SpotService.js

import { buildSpotUiState } from "../../../model/spot/ui/buildSpotUiState.js";
import { promoteImportItems } from "../../../model/spot/mutate/promoteImportItems.js";
import { inspectCoordContext } from "../../../domain/coord/CoordAgent.js";

export function createSpotService({ spotStore, router } = {}) {
	if (!spotStore) {
		throw new Error("SpotService: missing spotStore");
	}

	if (typeof spotStore.getState !== "function") {
		throw new Error("SpotService: invalid spotStore.getState");
	}

	if (typeof spotStore.addObjects !== "function") {
		throw new Error("SpotService: invalid spotStore.addObjects");
	}

	function getState() {
		return spotStore.getState();
	}

	function getObjectsArray() {
		return Object.values(getState()?.objects ?? {});
	}

	function getCoordContext() {
		return inspectCoordContext(getObjectsArray());
	}

	function getUiState() {
		const spotState = getState();

		return {
			...buildSpotUiState(spotState),
			coordContext: inspectCoordContext(Object.values(spotState?.objects ?? {})),
		};
	}

	function emitUiStateChanged() {
		const uiState = getUiState();
		router?.emitEvt?.("Spot.UiStateChanged", uiState);
		return uiState;
	}

	function addObjects({ objects = [] } = {}) {
		const list = Array.isArray(objects)
			? objects.filter(isSpotLikeObject)
			: [];

		if (list.length > 0) {
			spotStore.addObjects(list);
		}

		const uiState = emitUiStateChanged();

		return {
			ok: true,
			count: list.length,
			uiState,
			coordContext: getCoordContext(),
		};
	}

	function promoteItems({ items = [] } = {}) {
		const result = promoteImportItems({
			items,
			spotStore,
		});

		console.log("[SpotService] promoteItems result =", {
			addedObjects: result?.count?.addedObjects ?? 0,
			reviewItems: result?.count?.reviewItems ?? 0,
			rejectedItems: result?.count?.rejectedItems ?? 0,
			review: result?.reviewItems ?? [],
			rejected: result?.rejectedItems ?? [],
		});

		const uiState = emitUiStateChanged();

		return {
			...result,
			uiState,
			coordContext: getCoordContext(),
		};
	}

	function renameObject({ objectId, name } = {}) {
		const id = String(objectId ?? "").trim();
		const nextName = String(name ?? "").trim();
		if (!id || !nextName) throw new Error("SpotService.renameObject: objectId and name are required");
		const current = spotStore.getObject?.(id);
		if (!current) throw new Error(`SpotService.renameObject: unknown object ${id}`);
		const alignmentData = current?.data?.alignmentData && typeof current.data.alignmentData === "object"
			? { ...current.data.alignmentData, name: nextName }
			: current?.data?.alignmentData;
		spotStore.updateObject(id, {
			data: { name: nextName, ...(alignmentData ? { alignmentData } : {}) },
			meta: { label: nextName, modifiedAt: new Date().toISOString() },
		});
		const uiState = emitUiStateChanged();
		return { ok: true, objectId: id, name: nextName, uiState };
	}

	function removeObject({ objectId } = {}) {
		const id = String(objectId ?? "").trim();
		if (!id) throw new Error("SpotService.removeObject: objectId is required");
		const removedObject = spotStore.removeObject?.(id) ?? null;
		const uiState = emitUiStateChanged();
		return { ok: Boolean(removedObject), objectId: id, removedObject, uiState };
	}

	return {
		getState,
		getUiState,
		getCoordContext,
		addObjects,
		promoteItems,
		renameObject,
		removeObject,
	};
}

function isSpotLikeObject(object) {
	return !!object &&
		typeof object === "object" &&
		!Array.isArray(object) &&
		typeof object.id === "string" &&
		object.id.trim().length > 0;
}
