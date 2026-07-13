// app/main.js

import { initLanguage } from "@app/i18n/strings.js";
import { systemPrefs } from "@runtime/systemPrefs.js";
import { WindowRuntime } from "@runtime/WindowRuntime.js";
import { workerImportMirror } from "@app/examples/workerImportMirror.js";
import { registerDevNoCacheSW } from "@app/bootstrap/registerDevNoCacheSW.js";

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

try {
	await runtime.start();
	window.messaging = runtime.messaging;
} catch (err) {
	console.error(err);
	const logElement = document.getElementById("log");
	if (logElement) {
		logElement.textContent = "runtime boot failed ❌\n" + String(err);
	}
}
