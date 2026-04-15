// src/shared/messaging/workerImportMirror.js
//
// Visible mirror of SharedWorker boot imports.
//
// Purpose:
// - detect path drift during refactors in window context
// - document intended worker boot dependencies centrally
//
// Important:
// - this is NOT a real worker execution test
// - success here does NOT guarantee worker-side module resolution
//

console.log("[workerImportMirror] is starting");


import { startWorkerRouter } from "./worker/WorkerRouter.js";
import { createWorkerContext } from "./createWorkerContext.js";

import { createTransitionQueryService } from "../../domain/transition/service/TransitionQueryService.js";
import { createProjectStateService } from "./service/ProjectStateService.js";
import { createImportSessionService } from "./service/ImportSessionService.js";
import { createSpotService } from "./service/SpotService.js";
import { createDebugService } from "./service/DebugService.js";


console.log("[workerImportMirror] succeeded");

export const NOTHING = {};
