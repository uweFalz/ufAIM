// src/shared/runtime/AppRuntimeLocal.js

import transitionLookup from "@src/alignment/transition/transitionLookup.json" with { type:"json" };
import { mkAck, mkErr } from "@src/shared/messaging/ccv1.js";

const db = transitionLookup;

let projectState = {
	activeRouteProjectId: null
};

let importState = {
	sessionId: null,
	phase: "idle",
	items: [],
	error: null
};

function cloneImportState() {
	return JSON.parse(JSON.stringify(importState));
}

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

export class AppRuntimeLocal {
	constructor({ windowId, debug = false, messaging = null } = {}) {
		this.windowId = windowId;
		this.debug = debug;
		this.messaging = messaging; // optional: for evt echo in local mode
	}

	async handle(msg) {
		if (this.debug) console.log("[AppRuntimeLocal] cmd", msg.name, msg.payload);
		if (msg?.type !== "cmd") return;

		try {
			if (msg.name === "Transition.ListPresets") {
				return mkAck(msg, listPresets(db), { src: { ctx:"local:runtime", role:"master" } });
			}

			if (msg.name === "Transition.GetPresetSpec") {
				const { presetId } = msg.payload ?? {};
				return mkAck(msg, getPresetSpec(db, presetId), { src: { ctx:"local:runtime", role:"master" } });
			}

			if (msg.name === "Project.GetState") {
				return mkAck(msg, { ...projectState }, { src: { ctx:"local:runtime", role:"master" } });
			}

			if (msg.name === "Project.SetActiveRouteProject") {
				const { routeProjectId } = msg.payload ?? {};
				projectState = {
					...projectState,
					activeRouteProjectId: routeProjectId ?? null
				};

				// optional local event echo, if your client supports emitEvt back into same bus
				this.messaging?.emitEvt?.("Project.StateChanged", { ...projectState });

				return mkAck(msg, { ...projectState }, { src: { ctx:"local:runtime", role:"master" } });
			}
			
			if (msg.name === "Import.GetState") {
				return mkAck(msg, cloneImportState());
			}

			if (msg.name === "Import.BeginSession") {

				importState = {
					sessionId: `imp_${Date.now()}`,
					phase: "collecting",
					items: [],
					error: null
				};

				this.messaging?.emitEvt?.("Import.StateChanged", cloneImportState());

				return mkAck(msg, cloneImportState());
			}

			if (msg.name === "Import.AddItems") {

				const { items = [] } = msg.payload ?? {};

				const normalized = items.map((it, i) => ({
					id: it.id ?? `item_${Date.now()}_${i}`,
					name: it.name ?? "unknown",
					size: it.size ?? 0,
					kind: it.kind ?? "unknown",
					status: "dropped"
				}));

				importState.items.push(...normalized);

				this.messaging?.emitEvt?.("Import.StateChanged", cloneImportState());

				return mkAck(msg, cloneImportState());
			}

			return mkErr(msg, new Error(`Unknown cmd: ${msg.name}`), { src: { ctx:"local:runtime", role:"master" } });
		} catch (e) {
			return mkErr(msg, e, { src: { ctx:"local:runtime", role:"master" } });
		}
	}
}
