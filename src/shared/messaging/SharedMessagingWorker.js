// src/shared/messaging/SharedMessagingWorker.js

import { startWorkerRouter } from "./worker/WorkerRouter.js";
import { createWorkerContext } from "./createWorkerContext.js";

import { createTransitionQueryService } from "../../alignment/transition/service/TransitionQueryService.js";
import { createProjectStateService } from "./service/ProjectStateService.js";
import { createImportSessionService } from "./service/ImportSessionService.js";
import { createSpotService } from "./service/SpotService.js";
import { createDebugService } from "./service/DebugService.js";

console.log("[Worker] booting (1)...");

const router = startWorkerRouter(self);
const ctx = createWorkerContext({ router });

console.log("[Worker] booting (2)...");

// ---- services ----
const transitionService = createTransitionQueryService({
	db: ctx.db,
	registryResolver: ctx.registryResolver,
});

const projectStateService = createProjectStateService({
	getState: () => ctx.projectState,
	setState: (next) => { ctx.projectState = next; },
	router: ctx.router,
});

const importInboxService = createImportSessionService({
	getState: () => ctx.importState,
	setState: (next) => { ctx.importState = next; },
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

debug.log("worker booted");

// ------------------------------------------------------------
// Transition.* API
// ------------------------------------------------------------

router.onCmd("Transition.ListPresets", async () => {
	debug.log("Transition.ListPresets");
	return transitionService.listPresets();
});

router.onCmd("Transition.GetPresetSpec", async ({ presetId }) => {
	debug.log("Transition.GetPresetSpec", { presetId });
	return transitionService.getPresetSpec(presetId);
});

// ------------------------------------------------------------
// Project.* API
// ------------------------------------------------------------

router.onCmd("Project.GetState", async () => {
	return projectStateService.getState();
});

router.onCmd("Project.SetActiveRouteProject", async ({ routeProjectId } = {}) => {
	return projectStateService.setActiveRouteProject({ routeProjectId });
});

// ------------------------------------------------------------
// Import.* API
// ------------------------------------------------------------

router.onCmd("Import.GetState", async () => {
	return importInboxService.getState();
});

router.onCmd("Import.BeginSession", async ({ source } = {}) => {
	return importInboxService.beginSession({ source });
});

router.onCmd("Import.AddItems", async ({ items = [] } = {}) => {
	return importInboxService.addItems({ items });
});

// ------------------------------------------------------------
// Spot.* API
// ------------------------------------------------------------

router.onCmd("Spot.AddCandidates", async ({ spots = [] } = {}) => {
	return spotService.addCandidates({ spots });
});

router.onCmd("Spot.GetState", async () => {
	return spotService.getState();
});

router.onCmd("Spot.GetUiState", async () => {
	return spotService.getUiState();
});

// ------------------------------------------------------------
// Debug.* API
// ------------------------------------------------------------

router.onCmd("Debug.GetWorkerState", async () => {
	return {
		clients: router.getClientCount?.() ?? -1,
		projectState: projectStateService.getState(),
		importState: importInboxService.getState(),
	};
});
