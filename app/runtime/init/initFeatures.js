// app/runtime/init/initFeatures.js

import { makeImportController } from "@app/controllers/importController.js";
import { CockpitController } from "@app/controllers/CockpitController.js";
import { makeViewController } from "@app/controllers/viewController.js";
import { makeThreeAdapter } from "@app/controllers/adapters/geo/ThreeAdapter.js";
import { makeThreeViewer } from "@app/view/viewers/threeViewer.js";
import { makeTransitionEditorBridge } from "@app/controllers/bridges/transitionEditorBridge.js";

function setupGeoRuntime(ctx) {
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
		focusManager: ctx.focusManager,
	});

	importer.installDrop({ element: document.documentElement });

	ctx.ui.wireImportPicker?.({
		onFiles: (files) => importer.importFiles(files),
	});

	// Old SPOT overlay actions remain available for now.
	// Cockpit is the new primary sofa, but this keeps existing buttons alive.
	ctx.ui.wireSpotActions?.({
		onActivate: async (spotId) => {
			const objectId = String(spotId ?? "").trim();
			if (!objectId) return;

			await ctx.focusManager?.setFocus?.({
				objectId,
				slot: "right",
			});
		},

		onTogglePin: (spotId) => {
			const objectId = String(spotId ?? "").trim();
			if (!objectId) return;

			ctx.store.actions?.togglePinRouteProject?.({
				rpId: objectId,
				slot: "right",
			});
		},

		onDecision: ({ decision, key }) => {
			const spotId = String(key ?? "").trim();
			if (!spotId) return;

			ctx.store.actions?.setSpotDecision?.({
				spotId,
				slot: "right",
				decision: decision || null,
			});

			ctx.ui?.refreshSpot?.(ctx.store.getState());
		},
	});

	return importer;
}

function setupCockpitSelectors(ctx) {
	const cursorStepS = Math.max(1, Number(ctx.prefs?.view?.cursorStepS ?? 10));

	const parseCursorS = (value) => {
		const v = Number(value);
		if (!Number.isFinite(v)) return 0;
		return Math.max(0, v);
	};

	ctx.ui.wireSlotSelect?.({
		onChange: async (slot) => {
			await ctx.focusManager?.setFocusSlot?.(slot);
		},
	});

	ctx.ui.wireCursorControls?.({
		onSetCursorS: (value) => ctx.store.actions?.setCursorS?.(parseCursorS(value)),
		onNudgeMinus: () => ctx.store.actions?.nudgeCursorS?.(-cursorStepS),
		onNudgePlus: () => ctx.store.actions?.nudgeCursorS?.(+cursorStepS),
	});

	void ctx.focusManager?.setFocusSlot?.("right");
	ctx.ui.setSlotSelectValue?.("right");

	ctx.store.actions?.setCursorS?.(0);
	ctx.ui.setCursorSInputValue?.(0);
}

function setupViewRuntime(ctx) {
	const viewC = makeViewController({
		store: ctx.store,
		ui: ctx.ui,
		threeA: ctx.threeA,
		propsElement: ctx.propsElement,
		prefs: ctx.prefs,
		messaging: ctx.messaging,
	});

	void viewC.subscribe();

	ctx.ui.setAutoFitToggleVisible?.(Boolean(ctx.prefs?.isDev));
	ctx.ui.setAutoFitToggleValue?.(Boolean(ctx.prefs?.view?.autoFitOnGeomChange));

	ctx.ui.wireAutoFitToggle?.({
		onChange: (on) => {
			viewC.setAutoFitEnabled?.(on);
			ctx.ui.logInfo?.(`AutoFit=${on ? "ON" : "OFF"}`);
		},
	});

	ctx.ui.wireFitButton?.({
		onClick: () => { void viewC.fitActive?.(); },
	});

	ctx.ui.wirePinControls?.({
		onTogglePin: () => ctx.store.actions?.togglePinFromActive?.(),
		onClearPins: () => ctx.store.actions?.clearPins?.(),
	});

	return viewC;
}

function setupCockpitRuntime(ctx) {
	const cockpitRoot = document.getElementById("cockpitPanelBody");
	if (!cockpitRoot) {
		ctx.ui?.logInfo?.("Cockpit panel body not found");
		return null;
	}

	ctx.cockpit.attach(cockpitRoot);
	return ctx.cockpit;
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

export async function initFeatures(ctx) {
	ctx.cockpit = new CockpitController({
		store: ctx.store,
		messaging: ctx.messaging,
		logLine: ctx.logLine,
	});
	if (ctx.prefs.isDev) window.__ufAIM_cockpit = ctx.cockpit;

	setupGeoRuntime(ctx);
	setupImportUI(ctx);
	setupCockpitSelectors(ctx);
	setupViewRuntime(ctx);
	setupCockpitRuntime(ctx);
	await setupTransitionRuntime(ctx);
}
