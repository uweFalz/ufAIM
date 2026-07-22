// app/main.js

import { initLanguage } from "@app/i18n/strings.js";
import { systemPrefs } from "@runtime/systemPrefs.js";
import { WindowRuntime } from "@runtime/WindowRuntime.js";
import { workerImportMirror } from "@app/examples/workerImportMirror.js";
import { registerDevNoCacheSW } from "@app/bootstrap/registerDevNoCacheSW.js";
import { beginAppE2ELifecycle, completeHarness, finalizeAppE2ELifecycle } from "@app/_e2eLifecycle.js";

import "@alignment/_e2eAlignmentTest.js";
import "@src/shared/runtime/_e2eWorkspaceSelectionAccessTest.js";
import "@src/import/parsers/_e2eParserValidationTest.js";
import "@src/services/alignment/_e2eAlignmentEditModelBoundaryTest.js";

await registerDevNoCacheSW({
	enabled: !systemPrefs?.debug?.disableServiceWorker,
});

if (systemPrefs?.debug?.importMirror) {
	await workerImportMirror("SharedMessagingWorker", () =>
		import("@src/shared/messaging/SharedMessagingWorker.js")
	);
}

initLanguage();

const runtime = new WindowRuntime({ prefs: systemPrefs });
window.runtime = runtime;

async function runRuntimeHarness(owner, load, promiseName) {
	const resultNames = { alignmentNativeUi: "__alignmentNativeEditorUiE2E", geoRuntimeAcceptance: "__geoRuntimeAcceptanceE2E", curvatureBand: "__curvatureBandE2E", spotWorkspace: "__spotWorkspaceE2E" };
	try {
		await load();
		const completed = await completeHarness(owner, window[promiseName], window[resultNames[owner]]);
		window[resultNames[owner]] = completed;
	} catch (error) {
		console.error(`${owner} harness failed`, error);
	}
}

try {
	await runtime.start();
	window.messaging = runtime.messaging;
	await beginAppE2ELifecycle();
	await runRuntimeHarness("alignmentNativeUi", () => import("@app/_e2eAlignmentNativeUiTest.js"), "__alignmentNativeEditorUiE2EPromise");
	await runRuntimeHarness("geoRuntimeAcceptance", () => import("@app/_e2eGeoRuntimeAcceptanceTest.js"), "__geoRuntimeAcceptanceE2EPromise");
	await runRuntimeHarness("curvatureBand", () => import("@app/_e2eCurvatureBandTest.js"), "__curvatureBandE2EPromise");
	await runRuntimeHarness("spotWorkspace", () => import("@app/_e2eSpotWorkspaceTest.js"), "__spotWorkspaceE2EPromise");
} catch (err) {
	console.error(err);
	const logElement = document.getElementById("log");
	if (logElement) {
		logElement.textContent = "runtime boot failed ❌\n" + String(err);
	}
} finally {
	if (window.__appE2ELifecycleApi) {
		await finalizeAppE2ELifecycle(window.__parserValidationE2E ?? null);
	}
}
