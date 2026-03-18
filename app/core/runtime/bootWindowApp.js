// app/core/runtime/bootWindowApp.js
//
// Ziel später:
//
// bootWindowApp
//   -> setupRuntime(ctx)
//   -> setupControllers(ctx)
//   -> setupViews(ctx)

import { wireUI } from "../uiWiring.js";
import { t } from "@app/i18n/strings.js";

import { createRuntimeContext } from "./createRuntimeContext.js";

import { createWindowStore } from "../state/windowStore.js";
import { createWindowSessionState } from "../session/windowSessionState.js";
import { createWindowSessionController } from "../session/windowSessionController.js";
import { makeImportController } from "../controllers/importController.js";
import { createFocusManager } from "../controllers/focusManager.js";

import { applyIngestResult } from "@app/io/apply/importApply.js";

import { makeViewController } from "../controllers/viewController.js";
import { makeThreeAdapter } from "@app/adapters/geo/ThreeAdapter.js";
import { makeThreeViewer } from "@app/view/viewers/threeViewer.js";

import { makeTransitionEditorBridge } from "../bridges/transitionEditorBridge.js";
import { makeTransitionEditorView } from "@app/view/editors/transitionEditorView.js";

import { KappaFcnBuilder } from "@src/alignment/transition/build/KappaFcnBuilder.js";

// ...
async function setupProjectMirror(ctx) {
	await ctx.messaging?.sendCmdAwait?.("Project.GetState", {});
	await refreshRouteProjectOptions(ctx);

	ctx.messaging?.on?.("Import.StateChanged", async () => {
		await refreshRouteProjectOptions(ctx);
	});
}

function setupThreeRuntime(ctx) {
	const canvas = document.getElementById("view3d");
	if (!canvas) throw new Error("Missing <canvas id='view3d'>");

	const three = makeThreeViewer({ canvas });
	three.start?.();

	ctx.threeA = makeThreeAdapter({ three });
	return ctx.threeA;
}

function setupImportUI(ctx) {
	const importer = makeImportController({
		store: ctx.store,
		ui: ctx.ui,
		logLine: ctx.logLine,
		prefs: ctx.prefs,
		messaging: ctx.messaging,
	});

	importer.installDrop({ element: document.documentElement });

	ctx.ui.wireImportPicker?.({
		onFiles: (files) => importer.importFiles(files),
	});

	ctx.store.importSession = importer.session;

	ctx.ui.wireSpotActions?.({
		onActivate: async (key) => {
			const parts = String(key ?? "").split("::");
			const slot = parts.pop() || "right";
			const rpId = parts.join("::") || null;
			if (!rpId) return;

			await ctx.focusManager?.setFocus({
				objectId: rpId,
				slot,
			});
		},

		onTogglePin: (key) => {
			const parts = String(key ?? "").split("::");
			const slot = parts.pop() || "right";
			const rpId = parts.join("::") || null;
			if (!rpId) return;

			ctx.store.actions?.togglePinRouteProject?.({ rpId, slot });
		},

		onDecision: ({ decision, key }) => {
			const parts = String(key ?? "").split("::");
			const slot = parts.pop() || "right";
			const spotId = parts.join("::") || null;
			if (!spotId) return;

			ctx.store.actions?.setSpotDecision?.({
				spotId,
				slot,
				decision: decision || null,
			});
		},

		onSlotChange: ({ groupKey, slot }) => {
			ctx.store.importSession?.setGroupSlot?.(groupKey, slot);
			ctx.ui.refreshSpot?.(ctx.store.getState());
		},

		onBaseIdChange: ({ groupKey, baseId }) => {
			ctx.store.importSession?.setGroupBaseId?.(groupKey, baseId);
			ctx.ui.refreshSpot?.(ctx.store.getState());
		},
	});

	return importer;
}

async function refreshRouteProjectOptions(ctx) {
	if (!ctx.ui?.setRouteProjectOptions) return;

	const importState = await ctx.messaging?.sendCmdAwait?.("Import.GetState", {});
	const items = Array.isArray(importState?.items) ? importState.items : [];

	const ids = items.map((it) => String(it.id ?? "")).filter(Boolean);
	const activeId = ctx.store?.getState?.()?.activeRouteProjectId ?? "";

	ctx.ui.setRouteProjectOptions(ids, activeId);
}

async function hydrateActiveImportFromMaster(ctx) {
	const rpId = ctx.store?.getState?.()?.activeRouteProjectId;
	if (!rpId) return false;

	const importState = await ctx.messaging?.sendCmdAwait?.("Import.GetState", {});
	const items = Array.isArray(importState?.items) ? importState.items : [];

	const item = items.find((it) => String(it.id) === String(rpId));
	if (!item?.payload?.kind) return false;

	const slotHint = ctx.store?.getState?.()?.activeSlot ?? "right";

	const env = ctx.store.importSession?.ingest?.(item.payload, {
		slotHint,
		originFile: item?.source?.file ?? item?.name ?? null,
		sourceRef: {
			name: item?.source?.file ?? item?.name ?? null,
		},
	});

	for (const ingest of (env?.ingests ?? [])) {
		const effects = applyIngestResult({
			store: ctx.store,
			ui: ctx.ui,
			ingest,
			emitProps: false,
		});

		for (const e of (effects ?? [])) {
			if (!e) continue;

			if (e.type === "props") {
				if (typeof ctx.ui?.showProps === "function") ctx.ui.showProps(e.object);
				else if (typeof ctx.ui?.emitProps === "function") ctx.ui.emitProps(e.object);
			}
		}
	}

	return true;
}

function setupProjectSelectors(ctx) {
	ctx.ui.wireRouteProjectSelect?.({
		onChange: async (rpId) => {
			await ctx.focusManager?.setFocusObjectId?.(rpId || null, {
				clearImportMeta: true,
				hydrate: true,
			});
		},
	});

	ctx.ui.wireSlotSelect?.({
		onChange: async (slot) => {
			await ctx.focusManager?.setFocusSlot?.(slot);
		},
	});

	const cursorStepS = Math.max(1, Number(ctx.prefs?.view?.cursorStepS ?? 10));
	const parseCursorS = (value) => {
		const v = Number(value);
		if (!Number.isFinite(v)) return 0;
		return Math.max(0, v);
	};

	ctx.ui.wireCursorControls?.({
		onSetCursorS: (value) => ctx.store.actions?.setCursorS?.(parseCursorS(value)),
		onNudgeMinus: () => ctx.store.actions?.nudgeCursorS?.(-cursorStepS),
		onNudgePlus: () => ctx.store.actions?.nudgeCursorS?.(+cursorStepS),
	});

	void ctx.focusManager?.setFocusSlot?.("right");
	ctx.ui.setSlotSelectValue?.("right");

	ctx.store.actions?.setCursorS?.(0);
	ctx.ui.setCursorSInputValue?.(0);

	ctx.ui.wireDocs?.({
		defaultDoc: String(ctx.prefs?.view?.docsDefault ?? "roadmap"),
	});
}

function setupViewRuntime(ctx) {
	const viewC = makeViewController({
		store: ctx.store,
		ui: ctx.ui,
		threeA: ctx.threeA,
		propsElement: ctx.propsElement,
		prefs: ctx.prefs,
	});

	viewC.subscribe();

	ctx.ui.setAutoFitToggleVisible?.(Boolean(ctx.prefs?.isDev));
	ctx.ui.setAutoFitToggleValue?.(Boolean(ctx.prefs?.view?.autoFitOnGeomChange));

	ctx.ui.wireAutoFitToggle?.({
		onChange: (on) => {
			viewC.setAutoFitEnabled?.(on);
			ctx.ui.logInfo?.(`AutoFit=${on ? "ON" : "OFF"}`);
		},
	});

	ctx.ui.wireFitButton?.({
		onClick: () => viewC.fitActive?.(),
	});

	ctx.ui.wirePinControls?.({
		onTogglePin: () => ctx.store.actions?.togglePinFromActive?.(),
		onClearPins: () => ctx.store.actions?.clearPins?.(),
	});

	return viewC;
}

async function setupTransitionRuntime(ctx) {
	const teBridge = makeTransitionEditorBridge({
		store: ctx.store,
		ui: ctx.ui,
		messaging: ctx.messaging,
		view: ctx.transV,
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

export async function bootWindowApp({ prefs, messaging } = {}) {
	if (window.__ufAIM_booted) return;
	window.__ufAIM_booted = true;

	if (!prefs) throw new Error("bootApp: missing prefs (makeSystemPrefs)");

	const ctx = createRuntimeContext({ prefs, messaging });

	ctx.store = createWindowStore();
	if (prefs.isDev) window.__ufAIM_store = ctx.store;

	ctx.windowSessionState = createWindowSessionState();
	if (prefs.isDev) window.__ufAIM_windowSessionState = ctx.windowSessionState;

	ctx.windowSession = createWindowSessionController({
		store: ctx.store,
		sessionState: ctx.windowSessionState,
	});
	if (prefs.isDev) window.__ufAIM_windowSession = ctx.windowSession;

	ctx.transV = makeTransitionEditorView(ctx.store, {
		messaging: ctx.messaging,
		kappaBuilder: KappaFcnBuilder,
	});

	ctx.logElement = document.getElementById("log");
	ctx.statusElement = document.getElementById("status");
	ctx.propsElement = document.getElementById("props");

	ctx.logLine = (line) => {
		if (ctx.logElement) ctx.logElement.textContent += String(line) + "\n";
	};

	ctx.ui = wireUI({
		logElement: ctx.logElement,
		statusElement: ctx.statusElement,
		prefs: ctx.prefs,
	});

	ctx.focusManager = createFocusManager({
		windowSession: ctx.windowSession,
		store: ctx.store,
		hydrateActiveImportFromMaster: () => hydrateActiveImportFromMaster(ctx),
	});
	if (prefs.isDev) window.__ufAIM_focusManager = ctx.focusManager;
	if (prefs.isDev) window.__ufAIM_getFocus = () => ctx.focusManager?.getFocusSnapshot?.();

	ensureSpotBaseIdDatalist();
	ctx.ui.setStatus(t("boot_ok"));
	ctx.logLine(t("boot_ready"));
	ctx.ui.logInfo?.(`btnTrans=${!!ctx.ui.elements.buttonTransition} overlay=${!!ctx.ui.elements.transitionOverlay}`);

	await setupProjectMirror(ctx);
	setupThreeRuntime(ctx);

	setupImportUI(ctx);
	setupProjectSelectors(ctx);

	await refreshRouteProjectOptions(ctx);
	setupViewRuntime(ctx);
	await setupTransitionRuntime(ctx);

	return ctx.ui;
}
