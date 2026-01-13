// app/main.js

import { bootApp } from "./core/appCore.js";
import { t } from "./i18n/strings.js";

bootApp().catch((error) => {
	console.error(error);
	const logElement = document.getElementById("log");
	if (logElement) logElement.textContent = `${t("boot_failed")} ❌\n${String(error)}`;
});
