// src/shared/runtime/AppRuntimeLocal.js

import transitionLookup from "@src/alignment/transition/transitionLookup.json" with { type:"json" };
import { mkAck, mkErr } from "@src/shared/messaging/ccv1.js";

const db = transitionLookup;

// ---- helpers (pure data) ----
function listPresets(db) {
	const tr = db?.transition ?? {};
	return Object.keys(tr).map((id) => {
		const t = tr[id] ?? {};
		return { id, label: t.label ?? id };
	});
}

function getPresetCuts(db, presetId) {
	const id = String(presetId || "").toLowerCase();
	const tr = db?.transition?.[id];
	if (!tr) throw new Error(`Unknown presetId: ${id}`);

	const part = tr.normLengthPartition ?? [0, 1, 0];
	const l1 = Number(part[0] ?? 0) || 0;
	const lc = Number(part[1] ?? 0) || 0;

	const w1 = l1;
	const w2 = l1 + lc;

	return {
		presetId: id,
		cuts01: { w1, w2 },
		cutsCrv: null,                 // v0.1: bewusst nicht verfügbar
		meta: { label: tr.label ?? id } // konsistent zu deinem SharedWorker
	};
}

export class AppRuntimeLocal {
	constructor({ windowId, debug = false } = {}) {
		this.windowId = windowId;
		this.debug = debug;
	}

	async handle(msg) {
		if (this.debug) console.log("[AppRuntimeLocal] cmd", msg.name, msg.payload);
		if (msg?.type !== "cmd") return;

		try {
			if (msg.name === "Transition.ListPresets") {
				const items = listPresets(db);
				return mkAck(msg, items, { src: { ctx:"worker:router", role:"master" } });
			}

			if (msg.name === "Transition.GetPresetCuts") {
				const { presetId } = msg.payload ?? {};
				const payload = getPresetCuts(db, presetId);
				return mkAck(msg, payload, { src: { ctx:"worker:router", role:"master" } });
			}

			// Optional (sehr sinnvoll, weil deine View es nutzt):
			if (msg.name === "Transition.GetPresetSpec") {
				const { presetId } = msg.payload ?? {};
				const key = String(presetId || "").toLowerCase();

				// defs = komplette DB (serializable)
				const defs = transitionLookup;

				// optional: Cuts direkt als Komfort
				let cuts01 = null;
				let cutsCrv = null;
				let meta = null;

				try {
					const compiled = registry.compilePreset(key);
					cuts01 = compiled?.cuts01 ?? null;
					cutsCrv = compiled?.cutsCrv ?? null;
					meta = registry.getPresetMeta?.(key) ?? null;
				} catch {}

				return mkAck(msg, { presetId: key, defs, cuts01, cutsCrv, meta }, { src: { ctx:"worker:router", role:"master" } });
			}

			return mkErr(msg, new Error(`Unknown cmd: ${msg.name}`), { src: { ctx:"worker:router", role:"master" } });
		} catch (e) {
			return mkErr(msg, e, { src: { ctx:"worker:router", role:"master" } });
		}
	}
}
