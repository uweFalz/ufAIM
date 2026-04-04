// src/shared/messaging/service/SpotService.js
//
// SpotService
//
// Canonical SPOT object world.
//
// Responsibilities:
// - holds / serves shared SPOT objects
// - exposes canonical candidate / object state
// - broadcasts data changes
//
// NOT:
// - no window-local focus
// - no per-window selection
// - no view state
//
// Rule:
// Windows share the same SPOT truth,
// but not the same active object.
//

import { buildSpotUiState } from "../../../model/spot/buildSpotUiState.js";

//
// ...
//
export function createSpotService({ spotStore, router } = {}) {
	if (!spotStore) {
		throw new Error("SpotService: missing spotStore");
	}

	function getState() {
		return spotStore.getState();
	}

	function getUiState() {
		return buildSpotUiState(spotStore.getState());
	}

	function addCandidates({ spots = [] } = {}) {
		const state = spotStore.addSpots(spots);
		router?.broadcastEvt?.("Spot.StateChanged", state);
		router?.broadcastEvt?.("Spot.UiStateChanged", getUiState());
		return state;
	}

	return {
		addCandidates,
		getState,
		getUiState,
	};
}
