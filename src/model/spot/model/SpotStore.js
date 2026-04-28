// src/model/spot/model/SpotStore.js
//
// SpotStore
//
// Canonical in-memory store for SPOT objects.
//
// Responsibilities:
// - holds canonical SPOT objects
// - provides store-style read/write API
// - manages activeSpotId
//
// Canonical SpotObject:
// {
//   id,
//   type,
//   data: {
//     kernel
//   },
//   crsId,
//   meta
// }
//
// NOT:
// - no UI state
// - no window-local focus/selection
// - no geometry derivation
//
// Important:
// Consumers should use the store API, not mutate raw state.
//

export function createSpotStore(initialState = {}) {
	let state = {
		meta: {
			activeSpotId: null,
			activeRouteProjectId: null,
			engineeringCrsId: null,
			...(initialState.meta ?? {}),
		},

		objects: {
			...(initialState.objects ?? initialState.spots ?? {}),
		},
	};

	function getState() {
		return clone(state);
	}

	function getMeta() {
		return clone(state.meta);
	}

	function getObject(objectId) {
		return clone(state.objects[objectId] ?? null);
	}

	function listObjects() {
		return Object.values(state.objects).map(clone);
	}

	function addObject(object) {
		const normalized = normalizeSpotObject(object);

		state = {
			...state,
			objects: {
				...state.objects,
				[normalized.id]: clone(normalized),
			},
			meta: {
				...state.meta,
				activeSpotId: state.meta.activeSpotId ?? normalized.id,
			},
		};

		return getState();
	}

	function addObjects(objects = []) {
		let nextObjects = { ...state.objects };
		let firstAddedId = null;
		let changed = false;

		for (const object of objects) {
			if (!object?.id) continue;

			const normalized = normalizeSpotObject(object);

			if (!firstAddedId) firstAddedId = normalized.id;

			nextObjects[normalized.id] = clone(normalized);
			changed = true;
		}

		if (!changed) {
			return getState();
		}

		state = {
			...state,
			objects: nextObjects,
			meta: {
				...state.meta,
				activeSpotId: state.meta.activeSpotId ?? firstAddedId ?? null,
			},
		};

		return getState();
	}

	function updateObject(objectId, patch = {}) {
		const prev = state.objects[objectId];

		if (!prev) {
			throw new Error(`SpotStore.updateObject: unknown objectId ${objectId}`);
		}

		const next = normalizeSpotObject({
			...prev,
			...patch,

			data: patch.data
				? {
					...(prev.data ?? {}),
					...patch.data,
				}
				: prev.data,

			meta: patch.meta
				? {
					...(prev.meta ?? {}),
					...patch.meta,
				}
				: prev.meta,
		});

		state = {
			...state,
			objects: {
				...state.objects,
				[objectId]: clone(next),
			},
		};

		return getState();
	}

	function setActiveSpot(spotId) {
		if (spotId != null && !state.objects[spotId]) {
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
		getObject,
		listObjects,
		addObject,
		addObjects,
		updateObject,
		setActiveSpot,
	};
}

// -----------------------------------------------------------------------------

function normalizeSpotObject(object) {
	if (!object?.id) {
		throw new Error("SpotStore: missing object.id");
	}

	return {
		id: object.id,
		type: object.type ?? "unknown",

		crsId: object.crsId ?? null,

		data: {
			...(object.data ?? {}),
		},

		refs: {
			...(object.refs ?? {}),
		},

		meta: {
			...(object.meta ?? {}),
		},
	};
}

function clone(value) {
	if (typeof structuredClone === "function") {
		return structuredClone(value);
	}
	return JSON.parse(JSON.stringify(value));
}
