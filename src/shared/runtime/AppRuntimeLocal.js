// src/shared/runtime/AppRuntimeLocal.js

import transitionLookup from "../../domain/transition/transitionLookup.json" with { type:"json" };
import { mkAck, mkErr } from "../messaging/ccv1.js";
import { getWorkspaceSelection } from "./workspaceSelectionAccess.js";
import { RegistryResolver } from "../../domain/transition/registry/RegistryResolver.js";
import { createTransitionQueryService } from "../../domain/transition/service/TransitionQueryService.js";
import { createImportSessionService } from "../messaging/service/ImportSessionService.js";

const db = transitionLookup;
const transitionService = createTransitionQueryService({ db, registryResolver: new RegistryResolver(db) });

let projectState = {
	workspace_selection: {
		primaryId: null,
		contextIds: []
	}
};

let importState = {
	sessionId: null,
	phase: "idle",
	items: [],
	rejectedItems: [],
	resultEvidence: [],
	error: null
};

let spotState = {
	objects: {},
	order: [],
};

function cloneImportState() {
	return JSON.parse(JSON.stringify(importState));
}

function cloneSpotState() {
	return JSON.parse(JSON.stringify(spotState));
}

function summarizeCommandPayload(name, payload) {
	if (name === "Import.PublishResultEvidence") {
		return {
			evidenceId: payload?.evidence?.evidenceId ?? null,
			itemCount: Array.isArray(payload?.items) ? payload.items.length : 0,
		};
	}
	if (name === "Import.CommitJob") {
		return {
			batchId: payload?.batchId ?? null,
			fileCount: Array.isArray(payload?.files) ? payload.files.length : 0,
		};
	}
	return payload;
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
		this.importService = createImportSessionService({
			getState: () => importState,
			setState: (next) => { importState = next; },
			router: { broadcastEvt: (name, payload) => this.messaging?.emitEvt?.(name, payload) },
		});
	}

	async handle(msg) {
		if (this.debug) {
			console.log("[AppRuntimeLocal] cmd", msg.name, summarizeCommandPayload(msg.name, msg.payload));
		}
		if (msg?.type !== "cmd") return;

		try {
			if (msg.name === "Transition.ListPresets") {
				return mkAck(msg, transitionService.listPresets(), { src: { ctx:"local:runtime", role:"master" } });
			}

			if (msg.name === "Transition.GetPresetSpec") {
				const { presetId } = msg.payload ?? {};
				return mkAck(msg, transitionService.getPresetSpec(presetId), { src: { ctx:"local:runtime", role:"master" } });
			}

			if (msg.name === "Transition.GetCatalogue") return mkAck(msg, transitionService.getCatalogue(), { src: { ctx:"local:runtime", role:"master" } });
			if (msg.name === "Transition.UpdateWorkingCopy") return mkAck(msg, transitionService.updateWorkingCopy(msg.payload), { src: { ctx:"local:runtime", role:"master" } });
			if (msg.name === "Transition.ResetWorkingCopy") return mkAck(msg, transitionService.resetWorkingCopy(msg.payload), { src: { ctx:"local:runtime", role:"master" } });

			if (msg.name === "Project.GetState") {
				return mkAck(msg, { ...projectState }, { src: { ctx:"local:runtime", role:"master" } });
			}

			if (msg.name === "Project.SetActiveRouteProject") {
				const { routeProjectId } = msg.payload ?? {};
				const currentSelection =
					getWorkspaceSelection(projectState);
				projectState = {
					...projectState,
					workspace_selection: {
						primaryId: routeProjectId ?? null,
						contextIds: currentSelection.contextIds,
						source: currentSelection.source ?? null,
						crsId: currentSelection.crsId ?? null,
					}
				};

				// optional local event echo, if your client supports emitEvt back into same bus
				this.messaging?.emitEvt?.("Project.StateChanged", { ...projectState });

				return mkAck(msg, { ...projectState }, { src: { ctx:"local:runtime", role:"master" } });
			}
			
			if (msg.name === "Import.GetState") {
				return mkAck(msg, this.importService.getState());
			}

			if (msg.name === "Import.GetResultEvidence") {
				return mkAck(msg, this.importService.getResultEvidence(msg.payload ?? {}));
			}

			if (msg.name === "Spot.GetState") {
				return mkAck(msg, cloneSpotState(), { src: { ctx:"local:runtime", role:"master" } });
			}

			if (msg.name === "Import.BeginSession") {

				return mkAck(msg, this.importService.beginSession(msg.payload ?? {}));
			}

			if (msg.name === "Import.AddItems") {

				return mkAck(msg, this.importService.addItems(msg.payload ?? {}));
			}

			if (msg.name === "Import.PublishResultEvidence") {
				return mkAck(msg, this.importService.publishResultEvidence(msg.payload ?? {}));
			}

			if (msg.name === "Import.CommitJob") {
				return mkAck(msg, this.importService.commitJob(msg.payload ?? {}));
			}

			if (msg.name === "Import.SetItemAccepted") {
				return mkAck(msg, this.importService.setItemAccepted(msg.payload ?? {}));
			}

			if (msg.name === "Import.SetRelationDecision") {
				return mkAck(msg, this.importService.setRelationDecision(msg.payload ?? {}));
			}

			return mkErr(msg, new Error(`Unknown cmd: ${msg.name}`), { src: { ctx:"local:runtime", role:"master" } });
		} catch (e) {
			return mkErr(msg, e, { src: { ctx:"local:runtime", role:"master" } });
		}
	}
}
