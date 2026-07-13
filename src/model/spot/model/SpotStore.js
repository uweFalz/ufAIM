// src/model/spot/model/SpotStore.js
//
// SpotStore
//
// Canonical in-memory store for SPOT objects.
//
// Responsibilities:
// - holds canonical SPOT objects
// - holds canonical CoordContexts
// - provides store-style read/write API
//
// NOT:
// - no UI state
// - no window-local focus/selection
// - no geometry derivation
// - no CRS transformation
//
// Important:
// Consumers should use the store API, not mutate raw state.
//

export function createSpotStore(initialState = {}) {
	let state = {
		meta: normalizeInitialMeta(initialState.meta),

		objects: {
			...(initialState.objects ?? initialState.spots ?? {}),
		},

		coordContexts: {
			...(initialState.coordContexts ?? initialState.crs ?? {}),
		},
	};

	function getState() {
		return clone(state);
	}

	function getMeta() {
		return clone(state.meta);
	}

	function getObject(objectId) {
		const id = normalizeId(objectId);
		if (!id) return null;

		return clone(state.objects[id] ?? null);
	}

	function listObjects() {
		return Object.values(state.objects).map(clone);
	}

	function getCoordContext(contextId) {
		const id = normalizeId(contextId);
		if (!id) return null;

		return clone(state.coordContexts[id] ?? null);
	}

	function listCoordContexts() {
		return Object.values(state.coordContexts).map(clone);
	}

	function addCoordContext(context) {
		const normalized = normalizeCoordContext(context);

		state = {
			...state,
			coordContexts: {
				...state.coordContexts,
				[normalized.id]: clone(normalized),
			},
		};

		return getState();
	}

	function upsertCrs(context) {
		return addCoordContext(context);
	}

	function addCrs(context) {
		return addCoordContext(context);
	}

	function addObject(object) {
		const normalized = normalizeSpotObject(object);

		state = {
			...state,
			objects: {
				...state.objects,
				[normalized.id]: clone(normalized),
			},
		};

		return getState();
	}

	function addObjects(objects = []) {
		const list = Array.isArray(objects) ? objects : [];
		const nextObjects = { ...state.objects };

		let changed = false;

		for (const object of list) {
			if (!object?.id) continue;

			const normalized = normalizeSpotObject(object);

			nextObjects[normalized.id] = clone(normalized);
			changed = true;
		}

		if (!changed) {
			return getState();
		}

		state = {
			...state,
			objects: nextObjects,
		};

		return getState();
	}

	function updateObject(objectId, patch = {}) {
		const id = normalizeId(objectId);

		if (!id || !state.objects[id]) {
			throw new Error(`SpotStore.updateObject: unknown objectId ${objectId}`);
		}

		const prev = state.objects[id];

		const next = normalizeSpotObject({
			...prev,
			...patch,

			data: patch.data
				? {
					...(prev.data ?? {}),
					...patch.data,
				}
				: prev.data,

			refs: patch.refs
				? {
					...(prev.refs ?? {}),
					...patch.refs,
				}
				: prev.refs,

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
				[id]: clone(next),
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

		getCoordContext,
		listCoordContexts,
		addCoordContext,

		// Compatibility aliases used by promoteImportItems().
		addCrs,
		upsertCrs,
	};
}

// -----------------------------------------------------------------------------

function normalizeInitialMeta(meta) {
	return normalizeCanonicalMeta(meta);
}

function normalizeSpotObject(object) {
	if (!object?.id) {
		throw new Error("SpotStore: missing object.id");
	}

	return {
		id: String(object.id),
		type: object.type ?? "unknown",

		crsId: object.crsId ?? object.coordContextId ?? null,
		crsStatus: object.crsStatus ?? null,
		coordContextId: object.coordContextId ?? object.crsId ?? null,

		data: {
			...(object.data ?? {}),
		},

		refs: {
			...(object.refs ?? {}),
		},

		meta: normalizeCanonicalMeta(object.meta),
	};
}

function normalizeCanonicalMeta(meta) {
	const source = isObject(meta) ? meta : {};
	const engineeringCrsId = normalizeId(source.engineeringCrsId);

	return engineeringCrsId
		? { engineeringCrsId }
		: {};
}

function normalizeCoordContext(context) {
	if (!context?.id && !context?.crsId) {
		throw new Error("SpotStore: missing coordContext.id/crsId");
	}

	const id = String(context.id ?? context.crsId);

	return {
		id,
		crsId: context.crsId ?? id,
		status: context.status ?? "unknown",
		family: context.family ?? "unknown",
		label: context.label ?? context.crsId ?? id,
		source: context.source ?? null,
		raw: isObject(context.raw) ? { ...context.raw } : {},
	};
}

function normalizeId(value) {
	const id = String(value ?? "").trim();
	return id || null;
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

function clone(value) {
	if (value == null) return value;

	if (typeof structuredClone === "function") {
		return structuredClone(value);
	}

	return JSON.parse(JSON.stringify(value));
}
