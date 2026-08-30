// app/runtime/init/initFeatures.js

import { makeImportController } from "@app/controllers/importController.js";
import { CockpitController } from "@app/controllers/CockpitController.js";
import { makeViewController } from "@app/controllers/viewController.js";
import { makeThreeAdapter } from "@app/controllers/adapters/geo/ThreeMainViewControllerAdapter.js";
import { makeThreeViewer } from "@app/view/viewers/threeViewer.js";
import { makeTransitionEditorBridge } from "@app/controllers/bridges/transitionEditorBridge.js";
import { MapLibreThreeAdapter } from "@app/controllers/adapters/geo/MapLibreThreeAdapter.js";
import { makeCurvatureBandController } from "@app/controllers/curvatureBandController.js";
import { makeAlignmentEditorBridge } from "@app/controllers/bridges/alignmentEditorBridge.js";
import { makeAlignmentCreationController } from "@app/controllers/alignmentCreationController.js";
import { makeGndImportWorkbenchController } from "@app/gndImportWorkbench/gndImportWorkbenchController.js";
import { createTransitionAxtranPreviewController } from "@app/controllers/transition-axtran/createTransitionAxtranPreviewController.js";
import { TransitionAxtranApplicationService } from "@src/services/transition/TransitionAxtranApplicationService.js";
import { TransitionCatalogueAdapter } from "@src/services/transition/TransitionCatalogueAdapter.js";
import { AlignmentApplicationService } from "@src/services/alignment/AlignmentApplicationService.js";
import { AlignmentProfileApplicationService } from "@src/services/alignment/AlignmentProfileApplicationService.js";
import { createAlignmentProfileProjectionController } from "@app/controllers/alignment-profile/createAlignmentProfileProjectionController.js";
import { AlignmentProfileSynchronizedView } from "@app/view/alignment-profile/AlignmentProfileSynchronizedView.js";
import { wireAlignmentProfileSynchronizedView } from "@app/controllers/alignment-profile/wireAlignmentProfileSynchronizedView.js";
import { createBasicVerticalProfileAuthoringController } from "@app/controllers/alignment-profile/createBasicVerticalProfileAuthoringController.js";
import { createTerminalParabolicVerticalCompositeEditController } from "@app/controllers/alignment-profile/createTerminalParabolicVerticalCompositeEditController.js";
import { createBasicChainageMappingAuthoringController } from "@app/controllers/alignment-profile/createBasicChainageMappingAuthoringController.js";
import { createChainageSegmentAppendController } from "@app/controllers/alignment-profile/createChainageSegmentAppendController.js";
import { createTerminalChainageSegmentAddressEditController } from "@app/controllers/alignment-profile/createTerminalChainageSegmentAddressEditController.js";
import { createTerminalChainageSegmentDirectionEditController } from "@app/controllers/alignment-profile/createTerminalChainageSegmentDirectionEditController.js";
import { createTerminalChainageSegmentDomainEditController } from "@app/controllers/alignment-profile/createTerminalChainageSegmentDomainEditController.js";
import { createTerminalChainageSegmentCompositeEditController } from "@app/controllers/alignment-profile/createTerminalChainageSegmentCompositeEditController.js";
import { createTerminalChainageSegmentRemoveController } from "@app/controllers/alignment-profile/createTerminalChainageSegmentRemoveController.js";
import { createBasicCantCrossLevelAuthoringController } from "@app/controllers/alignment-profile/createBasicCantCrossLevelAuthoringController.js";
import { createLinearCantElementAuthoringController } from "@app/controllers/alignment-profile/createLinearCantElementAuthoringController.js";
import { createTerminalLinearCantRateEditController } from "@app/controllers/alignment-profile/createTerminalLinearCantRateEditController.js";
import { createTerminalCantElementRemoveController } from "@app/controllers/alignment-profile/createTerminalCantElementRemoveController.js";
import { createTerminalConstantCantCrossLevelEditController } from "@app/controllers/alignment-profile/createTerminalConstantCantCrossLevelEditController.js";
import { createTerminalConstantCantDomainEditController } from "@app/controllers/alignment-profile/createTerminalConstantCantDomainEditController.js";
import { createTerminalLinearCantDomainEditController } from "@app/controllers/alignment-profile/createTerminalLinearCantDomainEditController.js";
import { createTerminalLinearCantCompositeEditController } from "@app/controllers/alignment-profile/createTerminalLinearCantCompositeEditController.js";
import { createRailPairCantRailLawEditController } from "@app/controllers/alignment-profile/createRailPairCantRailLawEditController.js";
import { createRailPairCantAdmissionController } from "@app/controllers/alignment-profile/createRailPairCantAdmissionController.js";
import { createChainageAddressLookupController } from "@app/controllers/alignment-profile/createChainageAddressLookupController.js";
import { createLongitudinalProfileController } from "@app/controllers/alignment-profile/createLongitudinalProfileController.js";
import { AlignmentLongitudinalProfileView } from "@app/view/alignment-profile/AlignmentLongitudinalProfileView.js";
import { createCantCrossLevelViewController } from "@app/controllers/alignment-profile/createCantCrossLevelViewController.js";
import { createAlignmentChangeProfileRefreshBridge } from "@app/controllers/alignment-profile/createAlignmentChangeProfileRefreshBridge.js";
import { AlignmentCantCrossLevelView } from "@app/view/alignment-profile/AlignmentCantCrossLevelView.js";
import { VerticalProfileAuthoringDockView } from "@app/view/alignment-profile/VerticalProfileAuthoringDockView.js";
import { createVerticalProfileAuthoringDockController } from "@app/controllers/alignment-profile/createVerticalProfileAuthoringDockController.js";
import { CantAuthoringDockView } from "@app/view/alignment-profile/CantAuthoringDockView.js";
import { createCantAuthoringDockController } from "@app/controllers/alignment-profile/createCantAuthoringDockController.js";
import { ChainageAuthoringDockView } from "@app/view/alignment-profile/ChainageAuthoringDockView.js";
import { createChainageAuthoringDockController } from "@app/controllers/alignment-profile/createChainageAuthoringDockController.js";
import { TrackNetworkTopologyApplicationService } from "@src/services/topology/TrackNetworkTopologyApplicationService.js";
import { InMemoryTrackNetworkTopologyRepositoryAdapter } from "@src/services/topology/InMemoryTrackNetworkTopologyRepositoryAdapter.js";
import { createTopologyWorkspaceController } from "@app/controllers/topology/createTopologyWorkspaceController.js";
import { wireTopologyWorkspaceView } from "@app/controllers/topology/wireTopologyWorkspaceView.js";
import { TopologyWorkspaceView } from "@app/view/topology/TopologyWorkspaceView.js";
import { createAlignmentBimWorkspaceController } from "@app/controllers/workspace/createAlignmentBimWorkspaceController.js";
import { createPromotedAlignmentWorkspaceJourneyController } from "@app/controllers/workspace/createPromotedAlignmentWorkspaceJourneyController.js";
import { canOpenDesignIssueTarget, createExistingAlignmentIntelligenceJourneyController, openDesignIssueTarget } from "@app/controllers/workspace/createExistingAlignmentIntelligenceJourneyController.js";
import { ExistingAlignmentIntelligenceView } from "@app/view/workspace/ExistingAlignmentIntelligenceView.js";
import { clearWorkspaceToolSurface, createObjectWorkspaceHydrator, watchWorkspaceToolSurface } from "@app/ui/uiWiring.js";
import { createCanonicalAuthoringReceiptRail } from "@app/domain/workspace/createCanonicalAuthoringReceiptRail.js";
import { createEngineeringCommandPaletteController } from "@app/controllers/workspace/createEngineeringCommandPaletteController.js";
import { EngineeringCommandPaletteView } from "@app/view/workspace/EngineeringCommandPaletteView.js";
import { createCanonicalObjectQuickSwitcherController } from "@app/controllers/workspace/createCanonicalObjectQuickSwitcherController.js";
import { CanonicalObjectQuickSwitcherView } from "@app/view/workspace/CanonicalObjectQuickSwitcherView.js";

function setupGeoRuntime(ctx) {
	const canvas = document.getElementById("view3d");
	if (!canvas) throw new Error("Missing <canvas id='view3d'>");

	const three = makeThreeViewer({ canvas });
	three.start?.();
	ctx.threeViewer = three;

	ctx.threeA = makeThreeAdapter({ three });
	ctx.mapA = new MapLibreThreeAdapter();
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
	ctx.importController = importer;
	window.__ufAIM_importController = importer;
	const objectWorkspaceHydrator = createObjectWorkspaceHydrator({
		ui: ctx.ui,
		messaging: ctx.messaging,
		store: ctx.store,
	});
	ctx.objectWorkspaceHydrator = objectWorkspaceHydrator;

	document.querySelector("[data-import-activity-open]")?.addEventListener("click", () => {
		document.getElementById("btnGndImportWorkbench")?.click();
	});
	document.querySelector("[data-import-activity-dismiss]")?.addEventListener("click", () => {
		document.getElementById("importActivityRail")?.classList.add("hidden");
	});

	ctx.disposeFileDrop = importer.installDrop({
		element: document.documentElement,
			onLifecycle: ({ state, code, fileCount, fileNames, message, outcome }) => {
			updateImportActivityRail({ state, code, fileCount, fileNames, message, outcome });
			if (state === "idle") {
				ctx.ui.setStatusOk?.();
				return;
			}
			if (state === "drag-active") {
				ctx.ui.setStatus?.("Dateien zum Import ablegen");
				return;
			}
			if (state === "accepted") {
				ctx.ui.setStatusBusy?.();
				ctx.ui.logInfo?.(`file drop: accepted (${fileCount})`);
				document.getElementById("btnGndImportWorkbench")?.click();
				return;
			}
			if (state === "processing") {
				ctx.ui.setStatusBusy?.();
				ctx.ui.logInfo?.(`file drop: processing (${fileCount})`);
				return;
			}
			if (state === "completed") {
				ctx.ui.logInfo?.(`file drop: completed (${fileCount})`);
				for (const fileOutcome of outcome?.fileOutcomes ?? []) {
					ctx.ui.logInfo?.(`file drop outcome: ${JSON.stringify(fileOutcome)}`);
				}
				return;
			}
			ctx.ui.setStatusError?.();
			ctx.ui.logInfo?.(
				`file drop: ${state} :: ${code ?? "unknown"}${message ? ` :: ${message}` : ""}`
			);
		},
	});

	ctx.ui.wireImportPicker?.({
		onFiles: (files) => importer.importFiles(files),
	});

	// Old SPOT overlay actions remain available for now.
	// Cockpit is the new primary sofa, but this keeps existing buttons alive.
	ctx.ui.wireSpotActions?.({
		onActivate: async (spotId) => {
			const objectId = String(spotId ?? "").trim();
			if (!objectId) return;
			if (typeof ctx.promotedAlignmentJourney?.activateCanonicalAlignment === "function") {
				return ctx.promotedAlignmentJourney.activateCanonicalAlignment(objectId);
			}

			await ctx.focusManager?.setFocus?.({
				objectId,
				slot: "right",
			});
		},

		onEdit: async (spotId) => {
			const objectId = String(spotId ?? "").trim();
			if (!objectId) return;
			await ctx.focusManager?.setFocus?.({ objectId, slot: "right" });
			window.dispatchEvent(new CustomEvent("ufaim:alignment-editor-focus-element", { detail: { objectId, source: "objects-context" } }));
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

		onRename: async ({ objectId, name }) => {
			return await ctx.messaging.sendCmdAwait("Spot.RenameObject", {
				objectId,
				name,
			});
		},

		onRemove: async (spotId) => {
			const objectId = String(spotId ?? "").trim();
			if (!objectId) return null;
			const wasActive = String(ctx.focusManager?.getFocus?.()?.objectId ?? "") === objectId;
			const result = await ctx.messaging.sendCmdAwait("Spot.RemoveObject", { objectId });
			if (wasActive) {
				const fallbackId = result?.uiState?.rows?.map((row) => String(row?.spotId ?? "")).filter(Boolean).sort()[0] ?? null;
				await ctx.focusManager?.setFocus?.({ objectId: fallbackId, slot: "right" });
			}
			return { ...result, restoreSelection: wasActive };
		},

		onUndo: async (removal) => {
			const removedObject = removal?.removedObject ?? null;
			if (!removedObject) return null;
			const result = await ctx.messaging.sendCmdAwait("Spot.AddObjects", { objects: [removedObject] });
			if (removal?.restoreSelection) {
				await ctx.focusManager?.setFocus?.({ objectId: removedObject.id, slot: "right" });
			}
			return result;
		},

		onCreate: async () => await ctx.cockpit?.createNewAlignment?.(),
		onImport: () => document.getElementById("btnImport")?.click(),
		onRetry: () => objectWorkspaceHydrator.retry(),
	});
	ctx.ui?.elements?.buttonSpot?.addEventListener("click", () => {
		queueMicrotask(() => void objectWorkspaceHydrator.refresh());
	});
	if (!ctx.ui?.elements?.overlaySpot?.classList.contains("hidden")) void objectWorkspaceHydrator.refresh();

	return importer;
}

function updateImportActivityRail({ state, code, fileCount = 0, fileNames = [], message, outcome } = {}) {
	const rail = document.getElementById("importActivityRail");
	if (!rail) return;
	const title = rail.querySelector("[data-import-activity-title]");
	const detail = rail.querySelector("[data-import-activity-detail]");
	const files = rail.querySelector("[data-import-activity-files]");
	const open = rail.querySelector("[data-import-activity-open]");
	const names = Array.isArray(fileNames) ? fileNames.filter(Boolean) : [];
	rail.dataset.importActivityState = String(state ?? "idle");
	rail.setAttribute("aria-busy", String(["accepted", "processing"].includes(state)));
	rail.classList.toggle("hidden", state === "idle");
	rail.classList.toggle("is-busy", ["drag-active", "accepted", "processing"].includes(state));
	rail.classList.toggle("is-error", ["failed", "rejected"].includes(state));
	if (open) {
		open.hidden = !["accepted", "processing", "completed", "failed", "rejected"].includes(state);
		open.textContent = ["accepted", "processing"].includes(state) ? "Import öffnen" : "Import ansehen";
	}
	if (title) title.textContent = importActivityTitle(state, outcome);
	if (detail) detail.textContent = importActivityDetail({ state, code, fileCount, message, outcome });
	if (files) {
		files.replaceChildren(...names.slice(0, 6).map((name) => {
			const chip = document.createElement("span");
			chip.textContent = name;
			return chip;
		}));
		if (names.length > 6) {
			const remainder = document.createElement("span");
			remainder.textContent = `+${names.length - 6} weitere`;
			files.append(remainder);
		}
	}
}

function importActivityTitle(state, outcome) {
	if (state === "drag-active") return "Hier ablegen";
	if (state === "accepted") return "Drop-Inhalt wird gelesen …";
	if (state === "processing") return "Import läuft";
	if (state === "completed") {
		const outcomes = outcome?.fileOutcomes ?? [];
		return outcomes.some((entry) => ["failed", "rejected", "unsupported", "partial"].includes(String(entry?.status ?? "").toLowerCase()))
			? "Import geprüft"
			: "Import abgeschlossen";
	}
	if (state === "failed") return "Import fehlgeschlagen";
	if (state === "rejected") return "Drop abgelehnt";
	return "Import";
}

function importActivityDetail({ state, code, fileCount, message, outcome }) {
	if (state === "drag-active") return "Mehrere Dateien oder einen Projektordner loslassen.";
	if (state === "accepted") return fileCount > 0
		? `${fileCount} Datei${fileCount === 1 ? "" : "en"} werden gesammelt …`
		: "Ordner und Dateien werden gesammelt. Das kann einen Moment dauern.";
	if (state === "processing") return `${fileCount} Datei${fileCount === 1 ? "" : "en"} werden analysiert …`;
	if (state === "completed") {
		const outcomes = outcome?.fileOutcomes ?? [];
		const objects = outcomes.reduce((sum, entry) => sum + Number(entry?.itemCount ?? 0), 0);
		return `${fileCount} Datei${fileCount === 1 ? "" : "en"} geprüft · ${objects} Objekt${objects === 1 ? "" : "e"} erkannt`;
	}
	return message ?? code ?? "Keine Datei verarbeitet.";
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
		mapA: ctx.mapA,
		propsElement: ctx.propsElement,
		prefs: ctx.prefs,
		messaging: ctx.messaging,
	});

	window.__ufAIM_viewController = viewC;
	window.__ufAIM_geoView = ctx.threeA;

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
	const transitionAxtranApplicationService = new TransitionAxtranApplicationService({
		catalogueAdapter: new TransitionCatalogueAdapter(),
	});
	const transitionAxtranPreviewController = createTransitionAxtranPreviewController({
		transitionAxtranApplicationService,
	});
	const teBridge = makeTransitionEditorBridge({
		store: ctx.store,
		ui: ctx.ui,
		messaging: ctx.messaging,
		view: ctx.transV,
		previewController: transitionAxtranPreviewController,
	});

	await teBridge.wire?.();
	if (ctx.prefs.isDev) window.__ufAIM_teBridge = teBridge;
	return teBridge;
}

function setupAlignmentEditorRuntime(ctx) {
	const bridge = makeAlignmentEditorBridge({ store: ctx.store, ui: ctx.ui, messaging: ctx.messaging, receiptSource:ctx.authoringReceiptRail });
	bridge.wire();
	if (ctx.prefs.isDev) window.__ufAIM_aeBridge = bridge;
	return bridge;
}

function setupAlignmentProfileRuntime(ctx) {
	const alignmentApplicationService =
		new AlignmentApplicationService({
			store: ctx.store,
			messaging: ctx.messaging,
		});
	const alignmentProfileApplicationService =
		new AlignmentProfileApplicationService({
			alignmentRepository:
				alignmentApplicationService.alignmentRepository,
		});
	const projectionController =
		createAlignmentProfileProjectionController({
			alignmentProfileApplicationService,
		});
	const authoringController =
		createBasicVerticalProfileAuthoringController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const terminalParabolicVerticalCompositeEditController =
		createTerminalParabolicVerticalCompositeEditController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const chainageAuthoringController =
		createBasicChainageMappingAuthoringController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const chainageSegmentAppendController =
		createChainageSegmentAppendController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const terminalChainageSegmentAddressEditController =
		createTerminalChainageSegmentAddressEditController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const terminalChainageSegmentDirectionEditController =
		createTerminalChainageSegmentDirectionEditController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const terminalChainageSegmentDomainEditController =
		createTerminalChainageSegmentDomainEditController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const terminalChainageSegmentCompositeEditController =
		createTerminalChainageSegmentCompositeEditController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const terminalChainageSegmentRemoveController = createTerminalChainageSegmentRemoveController({ alignmentProfileApplicationService, projectionController });
	const cantAuthoringController =
		createBasicCantCrossLevelAuthoringController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const linearCantAuthoringController =
		createLinearCantElementAuthoringController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const terminalLinearCantRateEditController =
		createTerminalLinearCantRateEditController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const terminalCantElementRemoveController =
		createTerminalCantElementRemoveController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const terminalConstantCantCrossLevelEditController =
		createTerminalConstantCantCrossLevelEditController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const terminalConstantCantDomainEditController =
		createTerminalConstantCantDomainEditController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const terminalLinearCantDomainEditController =
		createTerminalLinearCantDomainEditController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const terminalLinearCantCompositeEditController =
		createTerminalLinearCantCompositeEditController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const railPairCantRailLawEditController =
		createRailPairCantRailLawEditController({
			alignmentProfileApplicationService,
			projectionController,
		});
	const railPairCantAdmissionController = createRailPairCantAdmissionController({
		alignmentProfileApplicationService,
		projectionController,
	});
	const chainageLookupController =
		createChainageAddressLookupController({ projectionController });
	const longitudinalController =
		createLongitudinalProfileController({
			alignmentProfileApplicationService,
		});
	const cantCrossLevelController = createCantCrossLevelViewController();
	const wiring = wireAlignmentProfileSynchronizedView({
		store: ctx.store,
		messaging: ctx.messaging,
		projectionController,
		authoringController,
		terminalParabolicVerticalCompositeEditController,
		chainageAuthoringController,
		chainageSegmentAppendController,
		terminalChainageSegmentAddressEditController,
		terminalChainageSegmentDirectionEditController,
		terminalChainageSegmentDomainEditController,
		terminalChainageSegmentCompositeEditController,
		terminalChainageSegmentRemoveController,
		cantAuthoringController,
		linearCantAuthoringController,
		terminalLinearCantRateEditController,
		terminalCantElementRemoveController,
		terminalConstantCantCrossLevelEditController,
		terminalConstantCantDomainEditController,
		terminalLinearCantDomainEditController,
		terminalLinearCantCompositeEditController,
		railPairCantRailLawEditController,
		railPairCantAdmissionController,
		chainageLookupController,
		longitudinalController,
		cantCrossLevelController,
		receiptSource:ctx.authoringReceiptRail,
		View: AlignmentProfileSynchronizedView,
		LongitudinalView: AlignmentLongitudinalProfileView,
		CantCrossLevelView: AlignmentCantCrossLevelView,
	});
	ctx.alignmentProfileSynchronizedView = wiring;
	const verticalHost = document.getElementById("verticalProfileAuthoringBody");
	if (verticalHost) {
		ctx.verticalProfileAuthoringDock = createVerticalProfileAuthoringDockController({ store: ctx.store, profileSource: wiring, ui: ctx.ui, view: new VerticalProfileAuthoringDockView({ host: verticalHost }) });
		document.getElementById("btnVerticalProfileAuthoringClose")?.addEventListener("click", () => ctx.verticalProfileAuthoringDock.close());
	}
	const cantHost=document.getElementById("cantAuthoringBody");
	if(cantHost){ctx.cantAuthoringDock=createCantAuthoringDockController({store:ctx.store,profileSource:wiring,ui:ctx.ui,view:new CantAuthoringDockView({host:cantHost})});document.getElementById("btnCantAuthoringClose")?.addEventListener("click",()=>ctx.cantAuthoringDock.close());}
	const chainageHost=document.getElementById("chainageAuthoringBody");if(chainageHost){ctx.chainageAuthoringDock=createChainageAuthoringDockController({store:ctx.store,profileSource:wiring,ui:ctx.ui,view:new ChainageAuthoringDockView({host:chainageHost})});document.getElementById("btnChainageAuthoringClose")?.addEventListener("click",()=>ctx.chainageAuthoringDock.close());}
	return wiring;
}

function setupTopologyRuntime(ctx) {
	const topologyApplicationService =
		new TrackNetworkTopologyApplicationService({
			repository:
				new InMemoryTrackNetworkTopologyRepositoryAdapter(),
		});
	const controller = createTopologyWorkspaceController({
		topologyApplicationService,
	});
	const wiring = wireTopologyWorkspaceView({
		store: ctx.store,
		messaging: ctx.messaging,
		controller,
		View: TopologyWorkspaceView,
	});
	ctx.topologyWorkspace = wiring;
	return wiring;
}

export async function initFeatures(ctx) {
	ctx.cockpit = new CockpitController({
		store: ctx.store,
		messaging: ctx.messaging,
		logLine: ctx.logLine,
	});
	if (ctx.prefs.isDev) window.__ufAIM_cockpit = ctx.cockpit;

	setupGeoRuntime(ctx);
	ctx.alignmentBimWorkspace = createAlignmentBimWorkspaceController({
		documentRef: document,
		threeViewer: ctx.threeViewer,
		store: ctx.store,
		openImport: () => document.getElementById("btnImport")?.click(),
		createAlignment: () => ctx.gndImportWorkbench?.createAlignment?.(),
		openObjects: () => document.getElementById("btnSpot")?.click(),
	});
	ctx.alignmentBimWorkspace.start();
	setupImportUI(ctx);
	setupCockpitSelectors(ctx);
	ctx.viewController = setupViewRuntime(ctx);
	ctx.authoringReceiptRail=createCanonicalAuthoringReceiptRail({store:ctx.store,getHorizontalSource:()=>ctx.viewController?.getDebugState?.(),getProfileSource:()=>ctx.alignmentProfileSynchronizedView?.getCurrentProjection?.()});
	ctx.alignmentBimWorkspace.setCameraCoordinator(ctx.viewController);
	ctx.curvatureBand = makeCurvatureBandController({ store: ctx.store, messaging: ctx.messaging });
	ctx.curvatureBand.start();
	if (ctx.prefs.isDev) window.__ufAIM_curvatureBand = ctx.curvatureBand;
	setupCockpitRuntime(ctx);
	setupAlignmentProfileRuntime(ctx);
	ctx.alignmentChangeProfileRefreshBridge =
		createAlignmentChangeProfileRefreshBridge({
			store: ctx.store,
			profileSource: ctx.alignmentProfileSynchronizedView,
		});
	ctx.alignmentChangeProfileRefreshBridge.start();
	setupTopologyRuntime(ctx);
	ctx.alignmentEditorBridge = setupAlignmentEditorRuntime(ctx);
	ctx.alignmentCreation = makeAlignmentCreationController({ store: ctx.store, messaging: ctx.messaging, curvatureBand: ctx.curvatureBand, cockpit: ctx.cockpit, viewController: ctx.viewController });
	ctx.alignmentCreation.start();
	window.__ufAIM_alignmentCreation = ctx.alignmentCreation;
	ctx.alignmentIntelligence = createExistingAlignmentIntelligenceJourneyController({
		store: ctx.store,
		workspace: ctx.alignmentBimWorkspace,
		viewController: ctx.viewController,
		profileSource: ctx.alignmentProfileSynchronizedView,
		receiptSource:ctx.authoringReceiptRail,
		view: new ExistingAlignmentIntelligenceView({ documentRef: document, actions: {
			activateMode: (mode) => ctx.alignmentBimWorkspace?.activate?.(mode),
			showOnMap: () => ctx.alignmentBimWorkspace?.activate?.("main"),
			openObjects: () => document.getElementById("btnSpot")?.click(),
			openImport: () => document.getElementById("btnImport")?.click(),
			openReview: () => document.getElementById("btnGndImportWorkbench")?.click(),
			openSource: () => document.getElementById("btnGndImportWorkbench")?.click(),
			openHorizontal: () => ctx.ui?.openAlignmentEditor?.(),
			openBands: () => ctx.alignmentBimWorkspace?.activate?.("l"),
			openVertical: () => { ctx.alignmentBimWorkspace?.activate?.("l"); ctx.alignmentProfileSynchronizedView?.focusLane?.("vertical"); const selection = ctx.store.getState()?.workspace_selection ?? {}; ctx.verticalProfileAuthoringDock?.open?.({ objectId: selection.primaryId, elementId: selection.elementDiscipline === "vertical" ? selection.elementId : null }); },
			openCant: () => { ctx.alignmentBimWorkspace?.activate?.("l"); ctx.alignmentProfileSynchronizedView?.focusLane?.("cant"); const selection=ctx.store.getState()?.workspace_selection??{};ctx.cantAuthoringDock?.open?.({objectId:selection.primaryId,elementId:selection.elementDiscipline==="cant"?selection.elementId:null}); },
			openChainage: () => { ctx.alignmentBimWorkspace?.activate?.("l"); ctx.alignmentProfileSynchronizedView?.focusLane?.("chainage"); const selection=ctx.store.getState()?.workspace_selection??{};ctx.chainageAuthoringDock?.open?.({objectId:selection.primaryId,elementId:selection.elementDiscipline==="chainage"?selection.elementId:null}); },
			canOpenIssue:(target={})=>canOpenDesignIssueTarget({target,activeObjectId:ctx.store.getState()?.workspace_selection?.primaryId,focusHorizontal:ctx.alignmentEditorBridge?.focusElementInEditor,docks:{vertical:ctx.verticalProfileAuthoringDock,cant:ctx.cantAuthoringDock,chainage:ctx.chainageAuthoringDock},profileProjection:ctx.alignmentProfileSynchronizedView?.getCurrentProjection?.(),openReview:document.getElementById("btnGndImportWorkbench")?.click,openObjects:document.getElementById("btnSpot")?.click}),
			openIssue:(target={})=>openDesignIssueTarget({target,activeObjectId:ctx.store.getState()?.workspace_selection?.primaryId,focusHorizontal:(value)=>ctx.alignmentEditorBridge?.focusElementInEditor?.(value),docks:{vertical:ctx.verticalProfileAuthoringDock,cant:ctx.cantAuthoringDock,chainage:ctx.chainageAuthoringDock},profileProjection:ctx.alignmentProfileSynchronizedView?.getCurrentProjection?.(),openReview:()=>document.getElementById("btnGndImportWorkbench")?.click(),openObjects:()=>document.getElementById("btnSpot")?.click(),setSelection:({objectId,discipline,elementId})=>ctx.store.actions?.setWorkspaceSelection?.({...ctx.store.getState()?.workspace_selection,primaryId:objectId,elementDiscipline:discipline,elementId,source:"design-issue-navigator"}),activateLongitudinal:()=>ctx.alignmentBimWorkspace?.activate?.("l"),focusLane:(discipline)=>ctx.alignmentProfileSynchronizedView?.focusLane?.(discipline)}),
			openTaskRail: () => { const rail = document.querySelector?.("[data-alignment-task-rail]"); rail?.scrollIntoView?.({ block: "nearest" }); rail?.focus?.(); },
			openQuickSwitcher: () => ctx.canonicalObjectQuickSwitcher?.open?.(),
			focusReceipt:(receipt)=>{const focused=ctx.authoringReceiptRail?.focus?.(receipt);if(!focused)return false;if(focused.action==="openHorizontal")ctx.ui?.openAlignmentEditor?.();else{ctx.alignmentBimWorkspace?.activate?.("l");ctx.alignmentProfileSynchronizedView?.focusLane?.(focused.discipline);const dock=focused.discipline==="vertical"?ctx.verticalProfileAuthoringDock:focused.discipline==="cant"?ctx.cantAuthoringDock:ctx.chainageAuthoringDock;dock?.open?.({objectId:focused.objectId,elementId:focused.elementId});}return true;},
		} }),
	});
	ctx.alignmentIntelligence.start();
	ctx.promotedAlignmentJourney = createPromotedAlignmentWorkspaceJourneyController({
		cockpit: ctx.cockpit,
		store: ctx.store,
		alignmentBimWorkspace: ctx.alignmentBimWorkspace,
		viewController: ctx.viewController,
		profileSource: ctx.alignmentProfileSynchronizedView,
		alignmentIntelligence: ctx.alignmentIntelligence,
	});
	ctx.gndImportWorkbench = makeGndImportWorkbenchController({
		store: ctx.store,
		messaging: ctx.messaging,
		cockpit: ctx.cockpit,
		importController: ctx.importController,
		alignmentCreation: ctx.alignmentCreation,
		alignmentEditorBridge: ctx.alignmentEditorBridge,
		promotedAlignmentJourney: ctx.promotedAlignmentJourney,
		alignmentIntelligence: ctx.alignmentIntelligence,
	});
	ctx.gndImportWorkbench.start();
	window.__ufAIM_gndImportWorkbench = ctx.gndImportWorkbench;
	let stopQuickSwitcherResponsive=null;const quickOverlay=document.getElementById("canonicalObjectQuickSwitcherOverlay"),closeQuickSwitcher=()=>{stopQuickSwitcherResponsive?.();stopQuickSwitcherResponsive=null;quickOverlay?.classList.add("hidden");quickOverlay?.setAttribute("aria-hidden","true");clearWorkspaceToolSurface({kind:"quick-switcher"});document.getElementById("geoStage")?.focus?.();},openQuickSwitcherSurface=()=>{for(const id of["btnGndImportWorkbenchClose","btnSpotClose","btnAlignmentEditorClose","btnVerticalProfileAuthoringClose","btnCantAuthoringClose","btnChainageAuthoringClose","btnCommandPaletteClose"])document.getElementById(id)?.click?.();stopQuickSwitcherResponsive?.();stopQuickSwitcherResponsive=watchWorkspaceToolSurface({surface:quickOverlay,kind:"quick-switcher"});quickOverlay?.classList.remove("hidden");quickOverlay?.setAttribute("aria-hidden","false");};document.getElementById("btnCanonicalObjectQuickSwitcherClose")?.addEventListener("click",closeQuickSwitcher);
	ctx.canonicalObjectQuickSwitcher=createCanonicalObjectQuickSwitcherController({view:new CanonicalObjectQuickSwitcherView({documentRef:document,root:document.getElementById("canonicalObjectQuickSwitcherBody")}),refreshCanonicalUiState:()=>ctx.objectWorkspaceHydrator.refreshCanonicalUiState({requireVisible:false}),activateCanonicalAlignment:id=>ctx.promotedAlignmentJourney.activateCanonicalAlignment(id),getActiveObjectId:()=>ctx.store.getState()?.workspace_selection?.primaryId,openSurface:openQuickSwitcherSurface,closeSurface:closeQuickSwitcher,documentRef:document});
	const command=(run,available=()=>true,reason=null)=>({run,available,reason}),active=()=>ctx.store.getState()?.workspace_selection?.primaryId??null,button=(id)=>document.getElementById(id);
	ctx.engineeringCommandPalette=createEngineeringCommandPaletteController({
		documentRef:document,windowRef:window,watchToolSurface:watchWorkspaceToolSurface,clearToolSurface:clearWorkspaceToolSurface,
		view:new EngineeringCommandPaletteView({documentRef:document,root:document.getElementById("engineeringCommandPaletteBody")}),getContext:()=>({objectId:active()}),
		availability:{
			activateMain:command(()=>{if(!ctx.alignmentBimWorkspace?.activate)return false;ctx.alignmentBimWorkspace.activate("main");return true;},()=>Boolean(ctx.alignmentBimWorkspace?.activate),"Workspace nicht verfügbar"),
			activateQ:command(()=>{if(!ctx.alignmentBimWorkspace?.activate)return false;ctx.alignmentBimWorkspace.activate("q");return true;},()=>Boolean(ctx.alignmentBimWorkspace?.activate),"Workspace nicht verfügbar"),
			activateL:command(()=>{if(!ctx.alignmentBimWorkspace?.activate)return false;ctx.alignmentBimWorkspace.activate("l");return true;},()=>Boolean(ctx.alignmentBimWorkspace?.activate),"Workspace nicht verfügbar"),
			openWorkbench:command(()=>{const target=button("btnGndImportWorkbench");if(!target)return false;target.click();return true;},()=>Boolean(button("btnGndImportWorkbench")),"Workbench nicht verfügbar"),
			openObjects:command(()=>{const target=button("btnSpot");if(!target)return false;target.click();return true;},()=>Boolean(button("btnSpot")),"Objekte nicht verfügbar"),
			openTasks:command(()=>{const target=document.querySelector("[data-design-issue-navigator]");if(!target)return false;target.scrollIntoView?.({block:"nearest"});return true;},()=>Boolean(document.querySelector("[data-design-issue-navigator]")),"Befunde nicht verfügbar"),
			openHorizontal:command(()=>{if(!ctx.ui?.openAlignmentEditor)return false;ctx.ui.openAlignmentEditor();return true;},()=>Boolean(ctx.ui?.openAlignmentEditor),"Horizontal-Editor nicht verfügbar"),
			openVertical:command(()=>ctx.verticalProfileAuthoringDock?.open?.({objectId:active()})===true,()=>Boolean(ctx.verticalProfileAuthoringDock?.open),"Vertical-Dock nicht verfügbar"),
			openCant:command(()=>ctx.cantAuthoringDock?.open?.({objectId:active()})===true,()=>Boolean(ctx.cantAuthoringDock?.open),"Cant-Dock nicht verfügbar"),
			openChainage:command(()=>ctx.chainageAuthoringDock?.open?.({objectId:active()})===true,()=>Boolean(ctx.chainageAuthoringDock?.open),"Chainage-Dock nicht verfügbar"),
			createAlignment:command(()=>{const target=document.querySelector("[data-workspace-create]");if(!target)return false;target.click();return true;},()=>Boolean(document.querySelector("[data-workspace-create]")),"Neuanlage nicht verfügbar")
		}
	});
	await setupTransitionRuntime(ctx);
}
