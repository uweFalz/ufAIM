// app/view/shell/restorePanelVisibility.js

import { loadPanelLayout } from "./panelLayoutStore.js";

export function restorePanelVisibility(panelIds = []) {
	for (const id of panelIds) {
		const el = document.getElementById(id);
		if (!el) continue;

		const layout = loadPanelLayout(id);
		if (!layout) continue;

		if (layout.hidden === true) el.classList.add("hidden");
		if (layout.hidden === false) el.classList.remove("hidden");
	}
}
