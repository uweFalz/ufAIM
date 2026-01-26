// app/core/appCore.js
import { wireUI } from "./uiWiring.js";
import { t } from "../i18n/strings.js";

import { createWorkspaceState } from "./workspaceState.js";
import { makeImportController } from "./importController.js";
import { mirrorQuickHooksFromActive } from "../io/importApply.js";

import { makeThreeAdapter } from "../adapters/geo/ThreeAdapter.js";
import { makeThreeViewer } from "../view/threeViewer.js";
import { makeViewController } from "./viewController.js"; // falls bei dir schon so ist

export async function bootApp({ prefs } = {}) {
	if (window.__ufAIM_booted) return;
	window.__ufAIM_booted = true;

	if (!prefs) throw new Error("bootApp: missing prefs (makeSystemPrefs)");

	const store = createWorkspaceState();
	if (prefs.isDev) window.__ufAIM_store = store;

	const logElement = document.getElementById("log");
	const statusElement = document.getElementById("status");
	const propsElement = document.getElementById("props");

	const logLine = (line) => {
		if (logElement) logElement.textContent += String(line) + "\n";
	};

	// UI wiring
	const ui = wireUI({ logElement, statusElement, prefs }); // prefs weitergeben (optional, aber sauber)
	ui.setStatus(t("boot_ok"));
	logLine(t("boot_ready"));

	// 3D
	const canvas = document.getElementById("view3d");
	if (!canvas) throw new Error("Missing <canvas id='view3d'>");

	const three = makeThreeViewer({ canvas });
	three.start?.();

	const threeA = makeThreeAdapter({ three });

	// ImportController (prefs rein!)
	const importer = makeImportController({ store, ui, logLine, prefs });

	// RP + Slot
	ui.wireRouteProjectSelect({
		onChange: (baseId) => {
			store.actions?.setActiveRouteProject?.(baseId || null);
			store.setState({ import_meta: null });
		},
	});

	ui.wireSlotSelect?.({
		onChange: (slot) => {
			store.actions?.setActiveSlot?.(slot);
		},
	});

	// ------------------------------------------------------------
	// Cursor wiring (MS13.8)
	// - revive cursor input + +/- buttons
	// - cursor.s drives overlays + section marker
	// ------------------------------------------------------------
	const cursorStepS = Math.max(1, Number(prefs?.view?.cursorStepS ?? 10));
	const parseCursorS = (value) => {
		const v = Number(value);
		if (!Number.isFinite(v)) return 0;
		return Math.max(0, v);
	};

	ui.wireCursorControls?.({
		onSetCursorS: (value) => {
			store.actions?.setCursorS?.(parseCursorS(value));
		},
		onNudgeMinus: () => {
			const s0 = Number(store.getState()?.cursor?.s ?? 0) || 0;
			store.actions?.setCursorS?.(Math.max(0, s0 - cursorStepS));
		},
		onNudgePlus: () => {
			const s0 = Number(store.getState()?.cursor?.s ?? 0) || 0;
			store.actions?.setCursorS?.(Math.max(0, s0 + cursorStepS));
		},
	});
	
	// Default slot
	store.actions?.setActiveSlot?.("right");
	ui.setSlotSelectValue?.("right");
	// Default cursor
	store.actions?.setCursorS?.(0);
	ui.setCursorSInputValue?.(0);
	mirrorQuickHooksFromActive(store);

	// Drop + Picker
	importer.installDrop({ element: document.documentElement });
	ui.wireImportPicker?.({ onFiles: (files) => importer.importFiles(files) });

	// ViewController
	// ... bis viewC

	const viewC = makeViewController({
		store,
		ui,
		threeA,
		propsElement,
		prefs, // ✅ MS12.y inject
	});

	viewC.subscribe();
	
	// DEV-only: AutoFit toggle
	ui.setAutoFitToggleVisible?.(Boolean(prefs.isDev));
	ui.setAutoFitToggleValue?.(Boolean(prefs.view?.autoFitOnGeomChange));

	ui.wireAutoFitToggle?.({
		onChange: (on) => {
			viewC.setAutoFitEnabled?.(on);
			ui.logInfo?.(`AutoFit=${on ? "ON" : "OFF"}`);
		},
	});

	ui.wireFitButton?.({
		onClick: () => viewC.fitActive?.(), // padding kommt jetzt aus prefs.view.fitPadding
	});

	// MS13.12+: pin/unpin current + clear pins
	ui.wirePinControls?.({
		onTogglePin: () => store.actions.togglePinFromActive?.(),
		onClearPins: () => store.actions?.clearPins?.(),
	});

	return ui;
}
