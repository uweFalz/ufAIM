// src/shared/messaging/service/SpotService.js

export function createSpotService({ spotStore, router } = {}) {
	if (!spotStore) {
		throw new Error("SpotService: missing spotStore");
	}

	function addCandidates({ spots = [] } = {}) {
		const state = spotStore.addSpots(spots);
		router?.broadcastEvt?.("Spot.StateChanged", state);
		return state;
	}

	function getState() {
		return spotStore.getState();
	}

	function setActive({ spotId } = {}) {
		if (!spotId) {
			return spotStore.getMeta();
		}

		const meta = spotStore.setActiveSpot(spotId);
		router?.broadcastEvt?.("Spot.ActiveChanged", meta);
		return meta;
	}

	return {
		addCandidates,
		getState,
		setActive,
	};
}
