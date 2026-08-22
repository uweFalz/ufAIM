// app/main.js

import { initLanguage } from "@app/i18n/strings.js";
import { systemPrefs } from "@runtime/systemPrefs.js";
import { WindowRuntime } from "@runtime/WindowRuntime.js";
import { workerImportMirror } from "@app/examples/workerImportMirror.js";
import { registerDevNoCacheSW } from "@app/bootstrap/registerDevNoCacheSW.js";

const startupQuery = new URLSearchParams(window.location.search);
const E2E_ENABLED = startupQuery.get("e2e") === "1"
	|| startupQuery.has("aimCoreAuthoringAcceptance");
let e2eLifecycle = null;

if (E2E_ENABLED) {
	window.__appE2EEnabled = true;
	e2eLifecycle = await import("@app/_e2eLifecycle.js");
	await Promise.all([
		import("@alignment/_e2eAlignmentTest.js"),
		import("@src/shared/runtime/_e2eWorkspaceSelectionAccessTest.js"),
		import("@src/import/parsers/_e2eParserValidationTest.js"),
		import("@src/services/alignment/_e2eAlignmentEditModelBoundaryTest.js"),
	]);
}

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

export const APP_E2E_DAG = Object.freeze({
	parserValidation: [],
	alignmentEditBoundary: [],
	alignmentNativeUi: ["runtime"],
	geoRuntimeAcceptance: ["alignmentNativeUi"],
	curvatureBand: ["geoRuntimeAcceptance"],
	spotWorkspace: ["curvatureBand"],
	alignmentCreation: ["spotWorkspace"],
	transEdDepth: ["alignmentCreation"],
	gndMdbDrop: ["transEdDepth"],
	gndImportWorkbench: ["gndMdbDrop"],
	uiRecovery: ["gndImportWorkbench"],
	importLoadStability: ["uiRecovery"],
	appLifecycle: [
		"parserValidation",
		"alignmentNativeUi",
		"geoRuntimeAcceptance",
		"curvatureBand",
		"spotWorkspace",
		"alignmentCreation",
		"transEdDepth",
		"gndMdbDrop",
		"gndImportWorkbench",
		"uiRecovery",
		"importLoadStability",
	],
});
if (E2E_ENABLED) window.__appE2EDag = APP_E2E_DAG;

async function runRuntimeHarness(owner, load, promiseName) {
	const resultNames = {
		alignmentNativeUi: "__alignmentNativeEditorUiE2E",
		geoRuntimeAcceptance: "__geoRuntimeAcceptanceE2E",
		curvatureBand: "__curvatureBandE2E",
		spotWorkspace: "__spotWorkspaceE2E",
		alignmentCreation: "__alignmentCreationE2E",
		transEdDepth: "__transEdDepthE2E",
		gndMdbDrop: "__gndMdbDropE2E",
		gndImportWorkbench: "__gndImportWorkbenchE2E",
		uiRecovery: "__uiRecoveryE2E",
		importLoadStability: "__importLoadStabilityE2E",
	};
	const readinessName = `__${owner}E2EReadyPromise`;
	window[readinessName] = Promise.resolve(Object.freeze({
		ready: true,
		owner,
		dependencies: APP_E2E_DAG[owner] ?? [],
		runtimeSurfaces: {
			messaging: Boolean(window.messaging),
			store: Boolean(window.__ufAIM_store),
			viewer: Boolean(window.__ufAIM_viewController),
		},
		readyAt: new Date().toISOString(),
	}));
	try {
		await load();
		const executionPromise = window[promiseName];
		if (!executionPromise || typeof executionPromise.then !== "function") {
			throw new Error(`${owner} execution promise missing after module load: ${promiseName}`);
		}
		const completed = await e2eLifecycle.completeHarness(owner, executionPromise, window[resultNames[owner]]);
		window[resultNames[owner]] = completed;
	} catch (error) {
		console.error(`${owner} harness failed`, error);
	}
}

try {
	await runtime.start();
	window.messaging = runtime.messaging;
	if (E2E_ENABLED) {
		await e2eLifecycle.beginAppE2ELifecycle();
		await runRuntimeHarness("alignmentNativeUi", () => import("@app/_e2eAlignmentNativeUiTest.js"), "__alignmentNativeEditorUiE2EPromise");
		await runRuntimeHarness("geoRuntimeAcceptance", () => import("@app/_e2eGeoRuntimeAcceptanceTest.js"), "__geoRuntimeAcceptanceE2EPromise");
		await runRuntimeHarness("curvatureBand", () => import("@app/_e2eCurvatureBandTest.js"), "__curvatureBandE2EPromise");
		await runRuntimeHarness("spotWorkspace", () => import("@app/_e2eSpotWorkspaceTest.js"), "__spotWorkspaceE2EPromise");
		await runRuntimeHarness("alignmentCreation", () => import("@app/_e2eAlignmentCreationTest.js"), "__alignmentCreationE2EPromise");
		await runRuntimeHarness("transEdDepth", () => import("@app/_e2eTransEdDepthTest.js"), "__transEdDepthE2EPromise");
		await runRuntimeHarness("gndMdbDrop", () => import("@app/_e2eGndMdbDropTest.js"), "__gndMdbDropE2EPromise");
		await runRuntimeHarness("gndImportWorkbench", () => import("@app/_e2eGndImportWorkbenchTest.js"), "__gndImportWorkbenchE2EPromise");
		await runRuntimeHarness("uiRecovery", () => import("@app/_e2eUiRecoveryTest.js"), "__uiRecoveryE2EPromise");
		await runRuntimeHarness("importLoadStability", () => import("@app/_e2eImportLoadStabilityTest.js"), "__importLoadStabilityE2EPromise");
	}
} catch (err) {
	console.error(err);
	const logElement = document.getElementById("log");
	if (logElement) {
		logElement.textContent = "runtime boot failed ❌\n" + String(err);
	}
} finally {
	if (E2E_ENABLED && window.__appE2ELifecycleApi) {
		await e2eLifecycle.finalizeAppE2ELifecycle(window.__parserValidationE2E ?? null);
	}
}
