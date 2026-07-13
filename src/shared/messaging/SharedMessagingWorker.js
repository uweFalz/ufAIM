// src/shared/messaging/SharedMessagingWorker.js

import { startWorkerRouter } from "./worker/WorkerRouter.js";
import { createWorkerContext } from "./createWorkerContext.js";

import { createTransitionQueryService } from "../../domain/transition/service/TransitionQueryService.js";
import { createProjectStateService } from "./service/ProjectStateService.js";
import { createImportSessionService } from "./service/ImportSessionService.js";
import { createSpotService } from "./service/SpotService.js";
import { createDebugService } from "./service/DebugService.js";
import { createSolverService } from "../../services/optimization/SolverService.js";
import { getWorkspacePrimaryId } from "../runtime/workspaceSelectionAccess.js";

const router = startWorkerRouter(self);
const ctx = createWorkerContext({ router });

// ---- emergency debug bridge FIRST ----

self.addEventListener("error", (event) => {
	router?.emitEvt?.("Debug.Log", {
		scope: "worker",
		level: "error",
		message: event?.message ?? "worker error",
		meta: {
			filename: event?.filename ?? null,
			lineno: event?.lineno ?? null,
			colno: event?.colno ?? null,
		},
		ts: Date.now(),
	});
});

self.addEventListener("unhandledrejection", (event) => {
	router?.emitEvt?.("Debug.Log", {
		scope: "worker",
		level: "error",
		message: "unhandledrejection",
		meta: {
			reason: event?.reason != null
				? String(event.reason)
				: "unknown",
		},
		ts: Date.now(),
	});
});

// ---- services ----

const transitionService = createTransitionQueryService({
	db: ctx.db,
	registryResolver: ctx.registryResolver,
});

const projectStateService = createProjectStateService({
	getState: () => ctx.projectState,
	setState: (next) => {
		ctx.projectState = next;
	},
	router: ctx.router,
});

const importInboxService = createImportSessionService({
	getState: () => ctx.importState,
	setState: (next) => {
		ctx.importState = next;
	},
	router: ctx.router,
});

const spotService = createSpotService({
	spotStore: ctx.spotStore,
	router: ctx.router,
});

const debug = createDebugService({
	router: ctx.router,
	scope: "worker",
	enabled: true,
});

const solverService = createSolverService({
	router: ctx.router,
	debug,
});

debug.log("worker booted");

// ------------------------------------------------------------
// Transition.* API
// ------------------------------------------------------------

router.onCmd("Transition.ListPresets", async () => {
	debug.log("Transition.ListPresets");
	return transitionService.listPresets();
});

router.onCmd("Transition.GetPresetSpec", async ({ presetId } = {}) => {
	debug.log("Transition.GetPresetSpec", { presetId });
	return transitionService.getPresetSpec(presetId);
});

// ------------------------------------------------------------
// Project.* API
// ------------------------------------------------------------

router.onCmd("Project.GetState", async () => {
	const state = projectStateService.getState();
	debug.log("Project.GetState", {
		primaryId: getWorkspacePrimaryId(state),
	});

	return state;
});

router.onCmd(
	"Project.SetActiveRouteProject",
	async ({ routeProjectId } = {}) => {
		debug.log("Project.SetActiveRouteProject", {
			routeProjectId,
		});

		return projectStateService.setActiveRouteProject({
			routeProjectId,
		});
	}
);

// ------------------------------------------------------------
// Import.* API
// ------------------------------------------------------------

router.onCmd("Import.GetState", async () => {
	const state = importInboxService.getState();

	debug.log("Import.GetState", {
		itemCount: Array.isArray(state?.items)
			? state.items.length
			: 0,
	});

	return state;
});

router.onCmd("Import.BeginSession", async ({ source } = {}) => {
	debug.log("Import.BeginSession", { source });

	return importInboxService.beginSession({
		source,
	});
});

router.onCmd("Import.AddItems", async ({ items = [] } = {}) => {
	const list = Array.isArray(items) ? items : [];

	debug.log("Import.AddItems", {
		count: list.length,
		items: list.map((item) => ({
			id: item?.id ?? null,
			kind: item?.kind ?? null,
			name:
				item?.payload?.name ??
				item?.payload?.id ??
				null,
			promotable: item?.status?.promotable ?? null,
			stage: item?.status?.stage ?? null,
			hasSparse: Boolean(item?.derived?.sparseAlignment),
			interpretation: item?.derived?.interpretation ?? null,
		})),
	});

	const result = await importInboxService.addItems({
		items: list,
	});

	const after = importInboxService.getState?.() ?? {};

	debug.log("Import.AddItems.done", {
		itemCount: Array.isArray(after?.items)
			? after.items.length
			: 0,
	});

	return result;
});

router.onCmd(
	"Import.SetItemAccepted",
	async ({ itemId, accepted } = {}) => {
		debug.log("Import.SetItemAccepted", {
			itemId,
			accepted,
		});

		return importInboxService.setItemAccepted({
			itemId,
			accepted,
		});
	}
);

// ------------------------------------------------------------
// Spot.* API
// ------------------------------------------------------------

router.onCmd("Spot.AddCandidates", async ({ spots = [] } = {}) => {
	const objects = Array.isArray(spots) ? spots : [];

	debug.log("Spot.AddCandidates", {
		count: objects.length,
	});

	return spotService.addObjects({
		objects,
	});
});

router.onCmd("Spot.AddObjects", async ({ objects = [] } = {}) => {
	const list = Array.isArray(objects) ? objects : [];

	debug.log("Spot.AddObjects", {
		count: list.length,
		ids: list.map((object) => object?.id ?? null),
	});

	return spotService.addObjects({
		objects: list,
	});
});

router.onCmd("Spot.GetState", async () => {
	const state = spotService.getState();
	const objects = Object.values(state?.objects ?? {});

	debug.log("Spot.GetState", {
		objectCount: objects.length,
		objects: objects.map((object) => ({
			id: object?.id ?? null,
			type: object?.type ?? null,
			crsId: object?.crsId ?? null,
			hasKernel: Boolean(object?.data?.kernel),
			label:
				object?.data?.name ??
				object?.meta?.label ??
				object?.id ??
				null,
		})),
	});

	return state;
});

router.onCmd("Spot.GetUiState", async () => {
	const uiState = spotService.getUiState();

	debug.log("Spot.GetUiState", {
		rowCount: Array.isArray(uiState?.rows)
			? uiState.rows.length
			: 0,
		stats: uiState?.stats ?? null,
	});

	return uiState;
});

router.onCmd(
	"Spot.PromoteImportItems",
	async ({ items = [] } = {}) => {
		const list = Array.isArray(items) ? items : [];

		debug.log("Spot.PromoteImportItems", {
			count: list.length,
			ids: list.map((item) => item?.id ?? null),
		});

		const result = await spotService.promoteItems({
			items: list,
		});

		debug.log("Spot.PromoteImportItems.done", {
			ok: result?.ok ?? null,
			addedObjects: Array.isArray(result?.addedObjects)
				? result.addedObjects.map((object) => object?.id ?? null)
				: [],
			reviewItems: Array.isArray(result?.reviewItems)
				? result.reviewItems.map((item) => item?.id ?? null)
				: [],
			rejectedItems: Array.isArray(result?.rejectedItems)
				? result.rejectedItems.map((item) => item?.id ?? null)
				: [],
		});

		return result;
	}
);

router.onCmd(
	"Spot.PromoteImportItemsById",
	async ({ itemIds = [] } = {}) => {
		const ids = Array.isArray(itemIds)
			? itemIds
				.map((value) => String(value ?? "").trim())
				.filter(Boolean)
			: [];

		debug.log("Spot.PromoteImportItemsById", {
			itemIds: ids,
		});

		if (!ids.length) {
			const emptyResult = {
				ok: false,
				reason: "no_item_ids",
				addedObjects: [],
				reviewItems: [],
				rejectedItems: [],
				uiState: spotService.getUiState(),
			};

			debug.log(
				"Spot.PromoteImportItemsById.empty",
				emptyResult
			);

			return emptyResult;
		}

		const importState = importInboxService.getState?.() ?? {};
		const allItems = Array.isArray(importState?.items)
			? importState.items
			: [];

		debug.log("Spot.PromoteImportItemsById.lookup", {
			importItemCount: allItems.length,
			allIds: allItems.map((item) => item?.id ?? null),
		});

		const wanted = allItems.filter((item) => {
			const id = String(item?.id ?? "");
			return ids.includes(id);
		});

		debug.log("Spot.PromoteImportItemsById.resolved", {
			wantedCount: wanted.length,
			wanted: wanted.map((item) => ({
				id: item?.id ?? null,
				kind: item?.kind ?? null,
				name:
					item?.payload?.name ??
					item?.payload?.id ??
					null,
				promotable: item?.status?.promotable ?? null,
				hasSparse: Boolean(item?.derived?.sparseAlignment),

				spatialRef: item?.derived?.spatialRef ?? null,
				payloadSpatialRef:
					item?.payload?.spatialRef ??
					null,
				metaSpatialRefHint:
					item?.meta?.spatialRefHint ??
					null,
				importAssessment:
					item?.derived?.importAssessment ??
					null,

				interpretation:
					item?.derived?.interpretation ??
					null,
			})),
		});

		const result = await spotService.promoteItems({
			items: wanted,
		});

		debug.log("Spot.PromoteImportItemsById.done", {
			ok: result?.ok ?? null,
			addedObjects: Array.isArray(result?.addedObjects)
				? result.addedObjects.map((object) => ({
					id: object?.id ?? null,
					type: object?.type ?? null,
					crsId: object?.crsId ?? null,
					hasKernel: Boolean(object?.data?.kernel),
					label:
						object?.data?.name ??
						object?.meta?.label ??
						object?.id ??
						null,
				}))
				: [],
			reviewItems: result?.reviewItems ?? [],
			rejectedItems: result?.rejectedItems ?? [],
			count: result?.count ?? null,
		});

		return result;
	}
);

// ------------------------------------------------------------
// Solver.* API
// ------------------------------------------------------------

router.onCmd("Solver.Ping", async ({ message } = {}) => {
	debug.log("Solver.Ping", { message });

	return solverService.ping({
		message,
	});
});

router.onCmd("Solver.RunDummy", async ({ payload } = {}) => {
	debug.log("Solver.RunDummy", {
		payload,
	});

	return solverService.runDummy({
		payload,
	});
});

// ------------------------------------------------------------
// Debug.* API
// ------------------------------------------------------------

router.onCmd("Debug.GetWorkerState", async () => {
	const importState = importInboxService.getState();
	const spotState = spotService.getState();

	return {
		clients: router.getClientCount?.() ?? -1,
		projectState: projectStateService.getState(),
		importState,
		spotStateSummary: {
			objectCount: spotState?.objects
				? Object.keys(spotState.objects).length
				: 0,
			coordContextCount: spotState?.coordContexts
				? Object.keys(spotState.coordContexts).length
				: 0,
		},
	};
});
