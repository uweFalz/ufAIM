// app/core/bootLegacyAppCore.js

import { wireUI } from "./uiWiring.js";
import { t } from "../i18n/strings.js";

import { createWorkspaceState } from "./workspaceState.js";
import { makeImportController } from "./importController.js";

import { makeThreeAdapter } from "../adapters/geo/ThreeAdapter.js";
import { makeThreeViewer } from "../view/threeViewer.js";
import { makeViewController } from "./viewController.js";

import { makeTransitionEditorBridge } from "./transitionEditorBridge.js";
import { makeTransitionEditorView } from "../view/transitionEditorView.js";

import { KappaFcnBuilder } from "@src/alignment/transition/build/KappaFcnBuilder.js";

async function setupProjectMirror({ store, messaging } = {}) {
	const masterProjectState = await messaging?.sendCmdAwait?.("Project.GetState", {});
	store.actions?.setActiveRouteProject?.(masterProjectState?.activeRouteProjectId ?? null);

	messaging?.on?.("Project.StateChanged", (payload) => {
		store.actions?.setActiveRouteProject?.(payload?.activeRouteProjectId ?? null);
	});
}

function setupThreeRuntime() {
	const canvas = document.getElementById("view3d");
	if (!canvas) throw new Error("Missing <canvas id='view3d'>");

	const three = makeThreeViewer({ canvas });
	three.start?.();

	return makeThreeAdapter({ three });
}

function setupImportUI({ store, ui, logLine, prefs } = {}) {
	const importer = makeImportController({ store, ui, logLine, prefs });

	importer.installDrop({ element: document.documentElement });
	ui.wireImportPicker?.({
		onFiles: (files) => importer.importFiles(files),
	});
	
	store.importSession = importer.session;

	ui.wireSpotActions?.({
		onActivate: (key) => {
			const parts = String(key ?? "").split("::");
			const slot = parts.pop() || "right";
			const rpId = parts.join("::") || null;
			if (!rpId) return;

			store.actions?.setActiveRouteProject?.(rpId);
			store.actions?.setActiveSlot?.(slot);
		},

		onTogglePin: (key) => {
			const parts = String(key ?? "").split("::");
			const slot = parts.pop() || "right";
			const rpId = parts.join("::") || null;
			if (!rpId) return;

			store.actions?.togglePinRouteProject?.({ rpId, slot });
		},

		onDecision: ({ decision, key }) => {
			const parts = String(key ?? "").split("::");
			const slot = parts.pop() || "right";
			const spotId = parts.join("::") || null;
			if (!spotId) return;

			store.actions?.setSpotDecision?.({
				spotId,
				slot,
				decision: decision || null,
			});
		},
		
		onSlotChange: ({ groupKey, slot }) => {
			store.importSession?.setGroupSlot?.(groupKey, slot);
			ui.refreshSpot?.(store.getState());
		},

		onBaseIdChange: ({ groupKey, baseId }) => {
			store.importSession?.setGroupBaseId?.(groupKey, baseId);
			ui.refreshSpot?.(store.getState());
		},
	});

	return importer;
}

function setupProjectSelectors({ store, ui, messaging, prefs } = {}) {
	ui.wireRouteProjectSelect?.({
		onChange: async (baseId) => {
			await messaging?.sendCmdAwait?.("Project.SetActiveRouteProject", {
				routeProjectId: baseId || null,
			});

			store.actions?.clearImportMeta?.();
		},
	});

	ui.wireSlotSelect?.({
		onChange: (slot) => store.actions?.setActiveSlot?.(slot),
	});

	const cursorStepS = Math.max(1, Number(prefs?.view?.cursorStepS ?? 10));
	const parseCursorS = (value) => {
		const v = Number(value);
		if (!Number.isFinite(v)) return 0;
		return Math.max(0, v);
	};

	ui.wireCursorControls?.({
		onSetCursorS: (value) => store.actions?.setCursorS?.(parseCursorS(value)),
		onNudgeMinus: () => store.actions?.nudgeCursorS?.(-cursorStepS),
		onNudgePlus: () => store.actions?.nudgeCursorS?.(+cursorStepS),
	});

	store.actions?.setActiveSlot?.("right");
	ui.setSlotSelectValue?.("right");

	store.actions?.setCursorS?.(0);
	ui.setCursorSInputValue?.(0);

	ui.wireDocs?.({
		defaultDoc: String(prefs?.view?.docsDefault ?? "roadmap"),
	});
}

function setupViewRuntime({ store, ui, threeA, propsElement, prefs } = {}) {
	const viewC = makeViewController({
		store,
		ui,
		threeA,
		propsElement,
		prefs,
	});

	viewC.subscribe();

	ui.setAutoFitToggleVisible?.(Boolean(prefs?.isDev));
	ui.setAutoFitToggleValue?.(Boolean(prefs?.view?.autoFitOnGeomChange));

	ui.wireAutoFitToggle?.({
		onChange: (on) => {
			viewC.setAutoFitEnabled?.(on);
			ui.logInfo?.(`AutoFit=${on ? "ON" : "OFF"}`);
		},
	});

	ui.wireFitButton?.({
		onClick: () => viewC.fitActive?.(),
	});

	ui.wirePinControls?.({
		onTogglePin: () => store.actions?.togglePinFromActive?.(),
		onClearPins: () => store.actions?.clearPins?.(),
	});

	return viewC;
}

async function setupTransitionRuntime({ store, ui, messaging, transV } = {}) {
	const teBridge = makeTransitionEditorBridge({
		store,
		ui,
		messaging,
		view: transV,
	});

	await teBridge.wire?.();
	return teBridge;
}

function ensureSpotBaseIdDatalist() {
	let el = document.getElementById("spot-baseIds");
	if (el) return el;

	el = document.createElement("datalist");
	el.id = "spot-baseIds";

	document.body.appendChild(el);
	return el;
}

export async function bootApp({ prefs, messaging } = {}) {
	if (window.__ufAIM_booted) return;
	window.__ufAIM_booted = true;

	if (!prefs) throw new Error("bootApp: missing prefs (makeSystemPrefs)");

	const store = createWorkspaceState();
	if (prefs.isDev) window.__ufAIM_store = store;

	const transV = makeTransitionEditorView(store, {
		messaging,
		kappaBuilder: KappaFcnBuilder,
	});

	const logElement = document.getElementById("log");
	const statusElement = document.getElementById("status");
	const propsElement = document.getElementById("props");

	const logLine = (line) => {
		if (logElement) logElement.textContent += String(line) + "\n";
	};

	const ui = wireUI({ logElement, statusElement, prefs });
	ensureSpotBaseIdDatalist();
	ui.setStatus(t("boot_ok"));
	logLine(t("boot_ready"));
	ui.logInfo?.(`btnTrans=${!!ui.elements.buttonTransition} overlay=${!!ui.elements.transitionOverlay}`);
	
	await setupProjectMirror({ store, messaging });
	const threeA = setupThreeRuntime();
	setupImportUI({ store, ui, logLine, prefs });
	setupProjectSelectors({ store, ui, messaging, prefs });
	setupViewRuntime({ store, ui, threeA, propsElement, prefs });
	await setupTransitionRuntime({ store, ui, messaging, transV });

	return ui;
}
