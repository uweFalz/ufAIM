// app/main.js

import { bootApp } from "./core/appCore.js";

bootApp().catch((error) => {
	console.error(error);
	const logElement = document.getElementById("log");
	if (logElement) logElement.textContent = "boot failed ❌\n" + String(error);
});
