// app/core/runtime/workerImportMirror.js
//
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

import "@src/shared/messaging/SharedMessagingWorker.js";
import "@src/shared/messaging/createWorkerContext.js";

import "@src/alignment/transition/service/TransitionQueryService.js";

import "@src/shared/messaging/service/ProjectStateService.js";
import "@src/shared/messaging/service/ImportSessionService.js";
import "@src/shared/messaging/service/SpotService.js";
import "@src/shared/messaging/service/DebugService.js";

console.log("[workerImportMirror] succeeded");

export const NOTHING = {};
