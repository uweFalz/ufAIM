// app/main.js

import { initLanguage } from "@app/i18n/strings.js";
import { systemPrefs } from "@app/core/config/systemPrefs.js";
import { WindowRuntime } from "@app/core/runtime/WindowRuntime.js";
import { workerImportMirror } from "@app/examples/workerImportMirror.js";
import { registerDevNoCacheSW } from "@app/bootstrap/registerDevNoCacheSW.js";

import "../src/alignment/_e2eAlignmentTest.js";

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

runtime.start().then(() => {
	window.messaging = runtime.messaging;
})
.catch((err) => {
	console.error(err);
	const logElement = document.getElementById("log");
	if (logElement) {
		logElement.textContent = "runtime boot failed ❌\n" + String(err);
	}
});
