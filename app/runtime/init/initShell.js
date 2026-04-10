// app/runtime/init/initShell.js

import { buildWindowShell } from "@app/view/shell/buildWindowShell.js";
import { makePanelsDraggable } from "@app/view/shell/makePanelsDraggable.js";
import { restorePanelVisibility } from "@app/view/shell/restorePanelVisibility.js";
import { wireUI } from "@app/ui/uiWiring.js";

export function initShell(ctx) {
	buildWindowShell();

	restorePanelVisibility([
		"spotOverlay",
		"transOverlay",
		"overlayBands",
		"overlaySection",
		"debugOverlay",
	]);

	ctx.logElement = document.getElementById("log");
	ctx.statusElement = document.getElementById("status");
	ctx.propsElement = document.getElementById("props");

	ctx.ui = wireUI({
		logElement: ctx.logElement,
		statusElement: ctx.statusElement,
		prefs: ctx.prefs,
	});

	ctx.logLine = ctx.ui.logLine;
	ctx.destroyPanelDragging = makePanelsDraggable();

	return ctx.ui;
}
