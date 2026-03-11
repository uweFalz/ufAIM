// src/shared/messaging/SharedMessagingWorker.js

import { startWorkerRouter } from "./worker/WorkerRouter.js";
import transitionLookup from "../../alignment/transition/transitionLookup.json" with { type:"json" };

const router = startWorkerRouter(self);
const db = transitionLookup;

// ------------------------------------------------------------
// canonical master state (M3a: minimal project state)
// ------------------------------------------------------------
let projectState = {
	activeRouteProjectId: null
};

// ---- helpers (pure data, no functions) ----
function listPresets(db) {
	const tr = db?.transition ?? {};
	return Object.keys(tr).map((id) => {
		const t = tr[id] ?? {};
		return { id, label: t.label ?? id };
	});
}

function getPresetSpec(db, presetId) {
	const id = String(presetId || "").toLowerCase();
	const tr = db?.transition?.[id];
	if (!tr) throw new Error(`Unknown presetId: ${id}`);

	const hw1Id = tr.halfWave1;
	const hw2Id = tr.halfWave2;
	const part  = tr.normLengthPartition ?? [0, 1, 0];

	const hw1 = db?.halfWave?.[hw1Id];
	const hw2 = db?.halfWave?.[hw2Id];
	if (!hw1 || !hw2) throw new Error(`Preset ${id}: missing halfWave def`);

	const l1 = Number(part[0] ?? 0) || 0;
	const lc = Number(part[1] ?? 0) || 0;
	const l2 = Number(part[2] ?? 0) || 0;

	const w1 = l1;
	const w2 = l1 + lc;

	return {
		presetId: id,
		meta: { label: tr.label ?? id },

		lambdas: [l1, lc, l2],
		cuts01: { w1, w2 },

		halfWave1: { halfWaveId: hw1Id, protoId: hw1.proto, source: hw1.source ?? "kappa", reverse: false },
		core:      { protoId: "clothoCore", source: "kappa", reverse: false },
		halfWave2: { halfWaveId: hw2Id, protoId: hw2.proto, source: hw2.source ?? "kappa", reverse: true },

		defs: db
	};
}

// ------------------------------------------------------------
// Transition.* API
// ------------------------------------------------------------
router.onCmd("Transition.ListPresets", async () => listPresets(db));

router.onCmd("Transition.GetPresetSpec", async ({ presetId }) => getPresetSpec(db, presetId));

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
		size: it.size ?? 0,
		kind: it.kind ?? "unknown",
		status: "dropped"
	}));

	importState.items.push(...normalized);

	router.broadcastEvt?.("Import.StateChanged", cloneImportState());

	return cloneImportState();
});
