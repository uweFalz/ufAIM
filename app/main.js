// app/main.js

import { systemPrefs } from "./core/systemPrefs.js";
import { WindowRuntime } from "@app/core/WindowRuntime.js";

import "./src/alignment/_e2eAlignmentTest.js";

const runtime = new WindowRuntime({ prefs: systemPrefs });
runtime.start().catch((err) => {
	console.error(err);
	const logElement = document.getElementById("log");
	if (logElement) logElement.textContent = "runtime boot failed ❌\n" + String(err);
});
