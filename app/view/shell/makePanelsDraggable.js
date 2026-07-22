// app/view/shell/makePanelsDraggable.js

import { makePanelDraggable } from "./makePanelDraggable.js";

export function makePanelsDraggable() {
	const panelIds = [
		"spotOverlay",
		"transOverlay",
		"alignmentEditorOverlay",
		"overlayBands",
		"overlaySection",
	];

	const destroyers = [];

	for (const id of panelIds) {
		const panel = document.getElementById(id);
		if (!panel) continue;

		const handle = panel.querySelector(".uf-panel__header") || panel;
		const destroy = makePanelDraggable(panel, handle);
		destroyers.push(destroy);
	}

	return function destroyAll() {
		for (const destroy of destroyers) {
			try { destroy?.(); } catch {}
		}
	};
}
