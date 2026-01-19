// app/main.js

import { bootApp } from "./core/appCore.js";
import { makeSystemPrefs } from "./core/systemPrefs.js";

const systemPrefs = makeSystemPrefs();

bootApp({ prefs: systemPrefs }).catch((error) => {
	console.error(error);
	const logElement = document.getElementById("log");
	if (logElement) logElement.textContent = "boot failed ❌\n" + String(error);
});
