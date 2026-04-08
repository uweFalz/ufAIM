// src/shared/messaging/service/SpotService.js
//
// SpotService
//
// Canonical SPOT object registry service.
//
// Responsibilities:
// - serves canonical SPOT state / UI state
// - accepts canonical SpotObjects
// - promotes canonical ImportSessionItems into SPOT
// - broadcasts SPOT UI state changes
//
// Important:
// SpotService works against the SpotStore API, not against raw mutable state.

import { buildSpotUiState } from "../../../spot/ui/buildSpotUiState.js";
import { promoteImportItems } from "../../../spot/mutate/promoteImportItems.js";

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

	function getUiState() {
		return buildSpotUiState(spotStore.getState());
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

		spotStore.addObjects(list);

		const uiState = emitUiStateChanged();

		return {
			ok: true,
			count: list.length,
			uiState,
		};
	}

	function promoteItems({ items = [] } = {}) {
		const result = promoteImportItems({
			items,
			spotStore,
		});

		const addedObjects = Array.isArray(result?.addedObjects)
			? result.addedObjects
			: [];

		if (addedObjects.length > 0) {
			spotStore.addObjects(addedObjects);
		}

		const uiState = emitUiStateChanged();

		return {
			...result,
			uiState,
		};
	}

	return {
		getState,
		getUiState,
		addObjects,
		promoteItems,
	};
}

function isSpotLikeObject(object) {
	return !!object &&
		typeof object === "object" &&
		!Array.isArray(object) &&
		typeof object.id === "string" &&
		object.id.trim().length > 0;
}
