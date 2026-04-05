// src/shared/messaging/service/SpotService.js
//
// SpotService
//
// Canonical SPOT object registry.
//
// Responsibilities:
// - stores shared SPOT objects and metadata
// - serves canonical SPOT state / UI state
// - broadcasts canonical object changes
//
// NOT:
// - no window-local focus
// - no view geometry
// - no solver geometry
// - no calculations
//
// Important:
// SPOT stores object parameters / metadata only.
// Derived data must be computed on demand via @kernel.
//
// Rule:
// SPOT defines "what exists".
// Windows decide "what they look at".
//

import { buildSpotUiState } from "../../../model/spot/buildSpotUiState.js";

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
