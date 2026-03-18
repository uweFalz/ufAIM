// src/shared/messaging/SharedMessagingWorker.js

import { startWorkerRouter } from "./worker/WorkerRouter.js";
import { createSpotStore } from "../../model/spot/SpotStore.js";
import transitionLookup from "../../alignment/transition/transitionLookup.json" with { type:"json" };
import { RegistryResolver } from "../../alignment/transition/registry/RegistryResolver.js";

const router = startWorkerRouter(self);

let projectState = {
	activeRouteProjectId: null
};

const spotStore = createSpotStore();

const db = transitionLookup;
const registryResolver = new RegistryResolver(db);

// ---- helpers (pure data, no functions) ----
function listPresets(db) {
	const tr = db?.transition ?? {};
	
	return Object.keys(tr).map((id) => {
		const t = tr[id] ?? {};
		return { id, label: t.label ?? id };
	});
}

function getPresetSpec(registryResolver, presetId) {
	const descriptor = registryResolver.resolveTransitionDescriptor(presetId);
	if (!descriptor) {
		throw new Error(`Unknown presetId: ${presetId}`);
	}

	const part = Array.isArray(descriptor.normLengthPartition)
	? descriptor.normLengthPartition
	: [0, 1, 0];

	const l1 = Number(part[0] ?? 0) || 0;
	const lc = Number(part[1] ?? 0) || 0;

	const w1 = l1;
	const w2 = l1 + lc;

	return {
		presetId: String(descriptor.id ?? presetId ?? "").toLowerCase(),
		descriptor,
		cuts01: { w1, w2 },
		meta: {
			label: descriptor.label ?? String(descriptor.id ?? presetId ?? ""),
		},
	};
}

// ------------------------------------------------------------
// Transition.* API
// ------------------------------------------------------------

router.onCmd("Transition.ListPresets", async () => listPresets(db));

router.onCmd("Transition.GetPresetSpec", async ({ presetId }) => {
	return getPresetSpec(registryResolver, presetId); 
});

// ------------------------------------------------------------
// Project.* API  (M3a)
// ------------------------------------------------------------

router.onCmd("Project.GetState", async () => {
	return { ...projectState };
});

router.onCmd("Project.SetActiveRouteProject", async ({ routeProjectId } = {}) => {
	projectState = {
		...projectState,
		activeRouteProjectId: routeProjectId ?? null
	};

	// falls dein Router anders broadcastet, hier entsprechend anpassen
	router.broadcastEvt?.("Project.StateChanged", { ...projectState });

	return { ...projectState };
});

// ------------------------------------------------------------
// Import session state (M3-Importa)
// ------------------------------------------------------------

let importState = {
	sessionId: null,
	phase: "idle",     // idle | collecting | parsing | ready | error
	items: [],
	error: null
};

function cloneImportState() {
	return JSON.parse(JSON.stringify(importState));
}

// ------------------------------------------------------------
// Import.* API
// ------------------------------------------------------------

router.onCmd("Import.GetState", async () => {
	return cloneImportState();
});

router.onCmd("Import.BeginSession", async ({ source } = {}) => {

	importState = {
		sessionId: `imp_${Date.now()}`,
		phase: "collecting",
		items: [],
		error: null
	};

	router.broadcastEvt?.("Import.StateChanged", cloneImportState());

	return cloneImportState();
});

router.onCmd("Import.AddItems", async ({ items = [] } = {}) => {

	const normalized = items.map((it, i) => ({
		id: it.id ?? `item_${Date.now()}_${i}`,
		name: it.name ?? "unknown",
		size: Number(it.size ?? 0),
		kind: it.kind ?? "unknown",
		status: it.status ?? "dropped",

		meta: it.meta ?? null,
		source: it.source ?? null,
		payload: it.payload ?? null,
	}));

	importState.items.push(...normalized);

	router.broadcastEvt?.("Import.StateChanged", cloneImportState());

	return cloneImportState();
});

// ------------------------------------------------------------
// Spot.* API
// ------------------------------------------------------------

router.onCmd("Spot.AddCandidates", async ({ spots = [] } = {}) => {
	const state = spotStore.addSpots(spots);
	router.broadcastEvt?.("Spot.StateChanged", state);
	return state;
});

router.onCmd("Spot.GetState", async () => {
	return spotStore.getState();
});

router.onCmd("Spot.SetActive", async ({ spotId } = {}) => {

	if (!spotId) {
		return spotStore.getMeta();
	}

	const meta = spotStore.setActiveSpot(spotId);

	router.broadcastEvt?.("Spot.ActiveChanged", meta);

	return meta;
});

// ------------------------------------------------------------
// Debug.* API
// ------------------------------------------------------------

router.onCmd("Debug.GetWorkerState", async () => {
	return {
		clients: router.getClientCount?.() ?? -1,
		projectState: { ...projectState },
		importState: cloneImportState(),
	};
});
