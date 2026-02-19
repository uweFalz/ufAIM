// app/main.js

import { bootApp } from "./core/appCore.js";
import { makeSystemPrefs } from "./core/systemPrefs.js";

import "./src/alignment/_e2eAlignmentTest.js";

const systemPrefs = makeSystemPrefs();

bootApp({ prefs: systemPrefs }).catch((error) => {
	console.error(error);
	const logElement = document.getElementById("log");
	if (logElement) logElement.textContent = "boot failed ❌\n" + String(error);
});
