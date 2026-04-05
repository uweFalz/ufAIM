// src/model/spot/SpotStore.js
//
// SpotStore
//
// Canonical in-memory store for SPOT objects.
//
// Responsibilities:
// - holds SPOT objects (alignments, candidates, metadata)
// - provides immutable-style state updates
// - manages identifiers and basic indexing
//
// NOT:
// - no UI state
// - no window-specific state (focus, selection, etc.)
// - no calculations
// - no geometry derivation
//
// Important:
// SpotStore is part of the canonical data layer.
//
// It stores parameters and metadata only.
// Any derived data (geometry, projections, solver input)
// must be computed via @kernel by consumers.
//

//
// ...
//
export function createSpotStore(initialState = {}) {
	
	console.log("where this is shown?");

	let state = {
		meta: {
			activeSpotId: null,
			activeRouteProjectId: null,
			engineeringCrsId: null,
			...(initialState.meta ?? {}),
		},

		spots: {
			...(initialState.spots ?? {}),
		},
	};

	function getState() {
		return clone(state);
	}

	function getMeta() {
		return clone(state.meta);
	}

	function getSpot(spotId) {
		return clone(state.spots[spotId] ?? null);
	}

	function listSpots() {
		return Object.values(state.spots).map(clone);
	}

	function addSpot(spot) {

		if (!spot?.id) {
			throw new Error("SpotStore.addSpot: missing spot.id");
		}

		state = {
			...state,
			spots: {
				...state.spots,
				[spot.id]: clone(spot),
			},
			meta: {
				...state.meta,
				activeSpotId: state.meta.activeSpotId ?? spot.id,
			},
		};

		return getState();
	}

	function addSpots(spots = []) {

		let nextSpots = { ...state.spots };
		let firstAddedId = null;
		let changed = false;

		for (const spot of spots) {

			if (!spot?.id) continue;

			if (!firstAddedId) firstAddedId = spot.id;

			nextSpots[spot.id] = clone(spot);

			changed = true;
		}

		if (!changed) {
			return getState();
		}

		state = {
			...state,
			spots: nextSpots,
			meta: {
				...state.meta,
				activeSpotId: state.meta.activeSpotId ?? firstAddedId ?? null,
			},
		};

		return getState();
	}

	function updateSpot(spotId, patch = {}) {

		const prev = state.spots[spotId];

		if (!prev) {
			throw new Error(`SpotStore.updateSpot: unknown spotId ${spotId}`);
		}

		const next = {
			...prev,
			...patch,
			model: patch.model ? { ...prev.model, ...patch.model } : prev.model,
			status: patch.status ? { ...prev.status, ...patch.status } : prev.status,
			provenance: patch.provenance ? { ...prev.provenance, ...patch.provenance } : prev.provenance,
			links: patch.links ? { ...prev.links, ...patch.links } : prev.links,
		};

		state = {
			...state,
			spots: {
				...state.spots,
				[spotId]: next,
			},
		};

		return getState();
	}

	function setActiveSpot(spotId) {

		if (spotId != null && !state.spots[spotId]) {
			throw new Error(`SpotStore.setActiveSpot: unknown spotId ${spotId}`);
		}

		state = {
			...state,
			meta: {
				...state.meta,
				activeSpotId: spotId ?? null,
			},
		};

		return getState();
	}

	return {
		getState,
		getMeta,
		getSpot,
		listSpots,
		addSpot,
		addSpots,
		updateSpot,
		setActiveSpot,
	};
}

function clone(value) {

	if (typeof structuredClone === "function") {
		return structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value));
}
