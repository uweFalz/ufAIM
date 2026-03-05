// app/core/bootLegacyAppCore.js

import { wireUI } from "./uiWiring.js";
import { t } from "../i18n/strings.js";

import { createWorkspaceState } from "./workspaceState.js";
import { makeImportController } from "./importController.js";
import { mirrorQuickHooksFromActive } from "../io/importApply.js";

import { makeThreeAdapter } from "../adapters/geo/ThreeAdapter.js";
import { makeThreeViewer } from "../view/threeViewer.js";
import { makeViewController } from "./viewController.js"; // falls bei dir schon so ist

import { makeTransitionEditorBridge } from "./transitionEditorBridge.js";
import { makeTransitionEditorView } from "../view/transitionEditorView.js";

import { KappaFcnBuilder } from "@src/alignment/transition/build/KappaFcnBuilder.js";

//
// ...
//
export async function bootApp({ prefs, messaging } = {}) {
	if (window.__ufAIM_booted) return;
	window.__ufAIM_booted = true;

	if (!prefs) throw new Error("bootApp: missing prefs (makeSystemPrefs)");

	const store = createWorkspaceState();
	if (prefs.isDev) window.__ufAIM_store = store;
	
	const transV = makeTransitionEditorView(store, {
		messaging,
		kappaBuilder: KappaFcnBuilder
	});

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
	
	ui.logInfo?.(`btnTrans=${!!ui.elements.buttonTransition} overlay=${!!ui.elements.transitionOverlay}`);

	// 3D
	const canvas = document.getElementById("view3d");
	if (!canvas) throw new Error("Missing <canvas id='view3d'>");

	const three = makeThreeViewer({ canvas });
	three.start?.();

	const threeA = makeThreeAdapter({ three });
	
	// ImportController (prefs rein!)
	const importer = makeImportController({ store, ui, logLine, prefs });
	
	// Drop + Picker
	importer.installDrop({ element: document.documentElement });
	ui.wireImportPicker?.({ onFiles: (files) => importer.importFiles(files) });

	// RP + Slot
	ui.wireRouteProjectSelect({
		onChange: (baseId) => {
			store.actions?.setActiveRouteProject?.(baseId || null);
			store.actions?.clearImportMeta?.();
		},
	});

	ui.wireSlotSelect?.({ onChange: (slot) => store.actions?.setActiveSlot?.(slot) });

	// Docs overlay (MS14.1)
	ui.wireDocs?.({ defaultDoc: String(prefs?.view?.docsDefault ?? "roadmap") });

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
		onSetCursorS: (value) => store.actions?.setCursorS?.(parseCursorS(value)),
		onNudgeMinus: () => store.actions?.nudgeCursorS?.(-cursorStepS),
		onNudgePlus:  () => store.actions?.nudgeCursorS?.(+cursorStepS),
	});
	
	// Default slot
	store.actions?.setActiveSlot?.("right");
	ui.setSlotSelectValue?.("right");

	store.actions?.setCursorS?.(0);
	ui.setCursorSInputValue?.(0);

	const viewC = makeViewController({
		store,
		ui,
		threeA,
		propsElement,
		prefs, // ✅ MS12.y inject
	});

	viewC.subscribe();
	
	// Bridge bekommt messaging, nicht registry
	const teBridge = makeTransitionEditorBridge({
		store,
		ui,
		messaging,
		view: transV
	});
	await teBridge.wire?.(); // oder teBridge.wire() fire&forget
	
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
		onTogglePin: () => store.actions?.togglePinFromActive?.(),
		onClearPins: () => store.actions?.clearPins?.(),
	});

	return ui;
}
