// app/core/appCore.js

import { wireUI } from "./uiWiring.js";
import { t } from "../i18n/strings.js";

import { createWorkspaceState } from "./workspaceState.js";
import { makeImportController } from "./importController.js";
import { mirrorQuickHooksFromActive } from "../io/importApply.js";

import { makeThreeAdapter } from "../adapters/geo/ThreeAdapter.js";
import { makeThreeViewer } from "../view/threeViewer.js";
import { makeViewController } from "./viewController.js"; // falls bei dir schon so ist

import transitionLookup from "../src/alignment/transition/transitionLookup.json" with { type: "json" };
import { RegistryCompiler } from "../src/alignment/transition/registry/RegistryCompiler.js";

import { makeTransitionEditorBridge } from "./transitionEditorBridge.js";
import { makeTransitionEditorView } from "../view/transitionEditorView.js";

//
// ...
//
export async function bootApp({ prefs, messaging } = {}) {
    if (window.__ufAIM_booted) return;
    window.__ufAIM_booted = true;

    if (!prefs) throw new Error("bootApp: missing prefs (makeSystemPrefs)");

    const store = createWorkspaceState();
    if (prefs.isDev) window.__ufAIM_store = store;
    
    const transitionRegistry = new RegistryCompiler(transitionLookup);
    // ------------------------------------------------------------
    // C1: expose alignment transition compilation via Command
    // (local today, shared-worker/master later)
    // ------------------------------------------------------------
    if (messaging?.onCmd) {
        messaging.onCmd("Alignment.CompilePreset", async ({ presetId }) => {
            return transitionRegistry.compilePreset(presetId);
        });
    }

    const transV = makeTransitionEditorView(store, transitionRegistry);
    // transV.init?.(); // oder lazy via bridge/view injection
    // if (prefs.isDev) window.__ufAIM_transitionRegistry = transitionRegistry;

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
    
    const teBridge = makeTransitionEditorBridge({ store, ui, registry: transitionRegistry, messaging, view: transV });
    teBridge.wire();
    
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
