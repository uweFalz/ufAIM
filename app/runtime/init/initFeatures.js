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

function buildImportInboxUiState(importState = {}) {
	const items = Array.isArray(importState?.items) ? importState.items : [];

	const rows = items.map((item) => {
		const fileName = item?.source?.fileName ?? null;
		const label =
			item?.payload?.name ??
			item?.payload?.id ??
			item?.source?.objectName ??
			item?.id ??
			"item";

		return {
			spotId: String(item?.id ?? ""),
			objectId: String(item?.id ?? ""),
			isActive: false,

			label,
			type: item?.kind ?? "alignment",

			outcome: item?.status?.promotable ? "promotable" : "imported",
			outcomeConfidence: item?.status?.promotable ? 1 : 0.5,

			sourceLabel: fileName ? `${fileName} → ${label}` : label,
			files: fileName ? [fileName] : [],

			missing: [],
			notes: [
				item?.status?.promotable ? "promotable" : "not-promotable",
			],

			hasSparse: Boolean(item?.derived?.sparseAlignment),
			sparseAlignment: item?.derived?.sparseAlignment ?? null,
		};
	});

	return {
		rows,
		activeSpotId: null,
		stats: {
			total: rows.length,
			filesSeen: new Set(
				rows.flatMap((row) => Array.isArray(row.files) ? row.files : [])
			).size,
		},
	};
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

	async function refreshImportInboxUiFromMaster() {
		const importState = await ctx.messaging?.sendCmdAwait?.("Import.GetState", {});
		const inboxUiState = buildImportInboxUiState(importState);
		ctx.ui?.setSpotState?.(inboxUiState);
		ctx.ui?.refreshSpot?.(ctx.store.getState());
		return inboxUiState;
	}

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

		onDecision: async ({ decision, key }) => {
			const itemId = String(key ?? "").trim();
			if (!itemId) return;

			ctx.store.actions?.setSpotDecision?.({
				spotId: itemId,
				slot: "right",
				decision: decision || null,
			});

			if (decision !== "accept") {
				ctx.ui?.refreshSpot?.(ctx.store.getState());
				return;
			}

			const result = await ctx.messaging?.sendCmdAwait?.(
				"Spot.PromoteImportItemsById",
				{ itemIds: [itemId] }
			);

			await refreshImportInboxUiFromMaster();

			const addedObjectId =
				Array.isArray(result?.addedObjects) && result.addedObjects[0]?.id
					? String(result.addedObjects[0].id)
					: null;

			if (addedObjectId) {
				ctx.store.actions?.clearPreviewItem?.();
				await ctx.focusManager?.setFocus?.({
					objectId: addedObjectId,
					slot: "right",
				});
			}
		},
	});

	// keep overlay populated with inbox items after imports
	const originalImportFiles = importer.importFiles;
	importer.importFiles = async (files) => {
		await originalImportFiles(files);
		await refreshImportInboxUiFromMaster();
		ctx.ui?.openSpot?.();
	};

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
	await setupTransitionRuntime(ctx);
}
