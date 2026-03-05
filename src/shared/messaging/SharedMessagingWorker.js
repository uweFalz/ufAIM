// src/shared/messaging/SharedMessagingWorker.js

import { startWorkerRouter } from "./worker/WorkerRouter.js";
import transitionLookup from "../../alignment/transition/transitionLookup.json" with { type: "json" };

const router = startWorkerRouter(self);
const db = transitionLookup;

function clamp01(x) {
	const v = Number(x);
	if (!Number.isFinite(v)) return 0;
	return Math.max(0, Math.min(1, v));
}

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

		// ✅ konsistent:
		meta: { label: tr.label ?? id },

		lambdas: [l1, lc, l2],
		cuts01: { w1, w2 },

		halfWave1: { halfWaveId: hw1Id, protoId: hw1.proto, source: hw1.source ?? "kappa", reverse: false },
		core:      { protoId: "clothoCore", source: "kappa", reverse: false },
		halfWave2: { halfWaveId: hw2Id, protoId: hw2.proto, source: hw2.source ?? "kappa", reverse: true },

		// v0.1:
		defs: db
	};
}

// ---- Transition.* API (pure data) ----

// 0) ListPresets (Meta)
router.onCmd("Transition.ListPresets", async () => {
	return listPresets(db);
});

// 1) Spec (v0.1: includes defs)
router.onCmd("Transition.GetPresetSpec", async ({ presetId }) => {
	return getPresetSpec(db, presetId);
});

// 1b) Alignment.CompilePreset (Etappe 2)
// Pure-data compile payload with optional w1/w2 override.
router.onCmd("Alignment.CompilePreset", async ({ presetId, w1, w2 } = {}) => {
	const spec = getPresetSpec(db, presetId);

	const a0 = (w1 == null) ? spec.cuts01.w1 : clamp01(w1);
	const b0 = (w2 == null) ? spec.cuts01.w2 : clamp01(w2);
	const a  = Math.min(a0, b0);
	const b  = Math.max(a0, b0);

	const lambdas = [a, Math.max(0, b - a), Math.max(0, 1 - b)];

	return {
		presetId: spec.presetId,
		meta: spec.meta,
		cuts01: { w1: a, w2: b },
		lambdas,
		halfWave1: spec.halfWave1,
		core: spec.core,
		halfWave2: spec.halfWave2,
		// Etappe 2: defs noch ok (Window baut Functions lokal)
		defs: spec.defs
	};
});

// 2) Cuts (cheap subset; cutsCrv intentionally null in v0.1)
router.onCmd("Transition.GetPresetCuts", async ({ presetId }) => {
	const spec = getPresetSpec(db, presetId);
	return {
		presetId: spec.presetId,
		cuts01: spec.cuts01,
		cutsCrv: null,
		meta: spec.meta
	};
});
