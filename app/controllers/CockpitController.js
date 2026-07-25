// app/controllers/cockpitController.js
//
// CockpitController
//
// Role:
// - owns cockpit root rendering/wiring
// - refreshes Import + SPOT UI state
// - delegates imperative side effects to cockpitActions
//
// NOT:
// - no import pipeline logic
// - no HTML generation
// - no geometry truth
//
// Direction:
//   SPOT / ImportInbox -> Cockpit UI -> workspace_selection -> ViewController

import { inspectCrsContext } from "@src/domain/crs/CrsAgent.js";

import { renderCockpitRoot } from "@app/view/cockpit/renderCockpitRoot.js";
import { AlignmentEditorController } from "@app/controllers/alignmentEditorController.js";
import {
	getWorkspacePrimaryId,
	getWorkspaceContextIds,
} from "@src/shared/runtime/workspaceSelectionAccess.js";

import {
	buildImportRows,
	buildSpotRows,
	deriveSpotEditorSnapshot,
	findImportItemById,
	findSpotObjectById,
	makePreviewCandidate,
	readSpotLabel,
	derivePreviewCrsId,
} from "@app/domain/cockpit/cockpitItemAdapters.js";

import {
	activateObjectId,
	toggleCockpitContextObject,
	clearCockpitPreview,
	exportLandXMLById,
	syncSpotObjectsToVisibleTracks,
	promoteImportItemToSpot,
} from "@app/controllers/cockpit/cockpitActions.js";

export class CockpitController {
	constructor({ store, messaging, logLine } = {}) {
		this.store = store ?? null;
		this.messaging = messaging ?? null;
		this.logLine = typeof logLine === "function" ? logLine : () => {};

		if (!this.store?.getState || !this.store?.subscribe) {
			throw new Error("CockpitController: missing store");
		}

		if (!this.messaging?.sendCmdAwait) {
			throw new Error("CockpitController: missing messaging.sendCmdAwait");
		}

		this._rootEl = null;
		this._renderQueued = false;
		this._wired = false;
		this._unsubscribeStore = null;

		this._importState = null;
		this._spotState = null;
		this._importRefreshPromise = null;
		this._importRefreshQueued = false;
		this._importRefreshError = null;
		this._importRefreshCount = 0;

		this._alignmentEditor = new AlignmentEditorController({
			store: this.store,
			messaging: this.messaging,
			logLine: this.logLine,
		});
	}

	attach(rootEl) {
		if (!rootEl) throw new Error("CockpitController.attach: missing rootEl");

		this._rootEl = rootEl;
		this._wireOnce();
		this._subscribeOnce();

		void this.refreshAll();
	}

	async refreshAll() {
		await Promise.allSettled([
			this.refreshImportState(),
			this.refreshSpotState(),
		]);

		this.render();
	}

	async refreshImportState() {
		if (this._importRefreshPromise) {
			this._importRefreshQueued = true;
			return this._importRefreshPromise;
		}
		this._importRefreshPromise = this.messaging
			.sendCmdAwait("Import.GetState", {}, { timeoutMs: 12000 })
			.then((state) => {
				this._importState = state;
				this._importRefreshError = null;
				this._importRefreshCount += 1;
				return state;
			})
			.catch((error) => {
				this._importRefreshError = {
					command: "Import.GetState",
					message: error?.message ?? String(error),
					at: new Date().toISOString(),
				};
				return this._importState;
			})
			.finally(() => {
				this._importRefreshPromise = null;
				if (this._importRefreshQueued) {
					this._importRefreshQueued = false;
					queueMicrotask(() => void this.refreshImportState().then(() => this.render()));
				}
			});
		return this._importRefreshPromise;
	}

	async refreshSpotState() {
		this._spotState = await this.messaging.sendCmdAwait("Spot.GetState", {});
		return this._spotState;
	}

	render() {
		if (!this._rootEl) return;
		renderCockpitRoot(this._rootEl, this.buildUiState());
	}

	queueRender() {
		if (this._renderQueued) return;

		this._renderQueued = true;

		queueMicrotask(() => {
			this._renderQueued = false;
			this.render();
		});
	}

	buildUiState() {
		const windowState = this.store.getState?.() ?? {};
		const importState = this._importState ?? {};
		const spotState = this._spotState ?? {};
		const importRows = buildImportRows(windowState, importState);
		const spotRows = buildSpotRows(windowState, spotState);

		const scene = this._buildSceneState(windowState, spotState, {
			importRows,
			spotRows,
		});
		const context = this._buildContextState(windowState, spotState, scene, {
			importRows,
			spotRows,
		});
		const actions = this._buildActionState(scene, context);

		return {
			scene,
			context,
			actions,
			collections: {
				importRows,
				spotRows,
			},
		};
	}

	async createNewAlignment() {
		const result = await this._alignmentEditor.newAlignment({
			name: "New Alignment",
		});

		const objectId = result?.spotObject?.id ?? result?.alignmentData?.id ?? null;

		if (objectId) {
			clearCockpitPreview({ store: this.store });
			this._activateObjectId(objectId);
		}

		await this.refreshSpotState();

		const label =
			result?.spotObject?.meta?.label ??
			result?.alignmentData?.name ??
			"New Alignment";

		this.logLine?.(`[Cockpit] New Alignment erstellt: ${label}`);
		this.render();

		return result;
	}

	async previewImportItem(itemId) {
		const importState = this._importState ?? await this.refreshImportState();
		const windowState = this.store.getState?.() ?? {};
		const row = buildImportRows(windowState, importState)
			.find((entry) => String(entry?.itemId ?? "") === String(itemId ?? ""));

		if (!row?.hasSparse) return false;

		const item = findImportItemById(importState, itemId);
		if (!item) return false;

		const previewCandidate = makePreviewCandidate(item);
		if (!previewCandidate?.kernel) return false;

		this.store.actions?.setPreviewItem?.({
			item: previewCandidate,
			source: { type: "cockpit-preview" },
		});

		this.store.actions?.setActiveRouteProject?.(null);
		this.store.actions?.clearWorkspacePrimary?.();
		this.store.actions?.setCursorS?.(0);

		this.logLine?.(`[Cockpit] Vorschau: ${previewCandidate.name}`);
		this.queueRender();

		return true;
	}

	async acceptImportItem(itemId, { show = false } = {}) {
		const importState = this._importState ?? await this.refreshImportState();
		const windowState = this.store.getState?.() ?? {};
		const row = buildImportRows(windowState, importState)
			.find((entry) => String(entry?.itemId ?? "") === String(itemId ?? ""));

		if (!row) return false;

		const item = findImportItemById(importState, itemId);

		if (!item) return false;

		if (row.accepted === true) {
			if (show) this._activateObjectId(itemId);

			this.logLine?.(
				show
					? `[Cockpit] anzeigen: ${itemId}`
					: `[Cockpit] bereits im Universe: ${itemId}`
			);

			this.queueRender();
			return true;
		}

		const promoted = await promoteImportItemToSpot({
			store: this.store,
			messaging: this.messaging,
			itemId,
			logLine: this.logLine,
		});

		const addedObjectId = promoted?.objectId ?? null;

		if (!addedObjectId) {
			this.logLine?.(`[Cockpit] nicht ins Universe übernommen: ${itemId}`);

			await Promise.all([
				this.refreshImportState(),
				this.refreshSpotState(),
			]);

			syncSpotObjectsToVisibleTracks({
				store: this.store,
				spotState: this._spotState,
				sourceType: "cockpit-accept-failed",
			});

			this.render();
			return false;
		}

		await Promise.all([
			this.refreshImportState(),
			this.refreshSpotState(),
		]);

		syncSpotObjectsToVisibleTracks({
			store: this.store,
			spotState: this._spotState,
			sourceType: "cockpit-accept",
		});

		if (show) {
			this._activateObjectId(addedObjectId);
		}

		this.logLine?.(
			`[Cockpit] ins Universe übernommen: ${itemId}${show ? " + anzeigen" : ""}`
		);

		this.render();
		return true;
	}

	async activateSpotObject(objectId) {
		const ok = this._activateObjectId(objectId);
		if (!ok) return false;

		this.logLine?.(`[Cockpit] anzeigen: ${objectId}`);
		this.queueRender();

		return true;
	}

	async exportLandXMLById(objectId) {
		return await exportLandXMLById({
			spotState: this._spotState,
			refreshSpotState: () => this.refreshSpotState(),
			objectId,
			logLine: this.logLine,
		});
	}

	togglePin(objectId) {
		const ok = toggleCockpitContextObject({
			store: this.store,
			objectId,
		});

		if (!ok) return false;

		this.logLine?.(`[Cockpit] Kontext toggle: ${objectId}`);
		this.queueRender();

		return true;
	}

	clearPreview() {
		clearCockpitPreview({ store: this.store });
		this.logLine?.("[Cockpit] Vorschau geleert");
		this.queueRender();
	}

	async clearActiveAlignmentElements() {
		const result = await this._alignmentEditor.clearActiveAlignmentElements();

		if (!result) {
			this.logLine?.("[Cockpit] Elemente konnten nicht gelöscht werden");
			return null;
		}

		await this.refreshSpotState();
		this.render();

		return result;
	}

	_activateObjectId(objectId) {
		return activateObjectId({
			store: this.store,
			objectId,
		});
	}

	_buildSceneState(windowState, spotState, { importRows = [], spotRows = [] } = {}) {
		const activeObjectId =
			getWorkspacePrimaryId(windowState);
		const selectedElementId = String(windowState?.workspace_selection?.elementId ?? "").trim() || null;

		const previewItem = windowState?.preview_item ?? null;

		if (activeObjectId) {
			const spotRow = spotRows.find((row) => String(row?.objectId ?? "") === String(activeObjectId));
			const obj = findSpotObjectById(spotState, activeObjectId);

			if (obj && spotRow) {
				const editor = {
					...deriveSpotEditorSnapshot(obj),
					selectedElementId,
				};

				return {
					mode: "spot",
					objectId: String(spotRow.objectId ?? activeObjectId),
					label: spotRow.label ?? readSpotLabel(obj),
					type: spotRow.type ?? "unknown",
					crsId: spotRow.crsId ?? null,
					status: "in_workspace",
					slot: windowState?.activeSlot ?? "right",
					pinned: Boolean(spotRow.pinned),
					source: spotRow.source ?? null,
					selectedElementId,
					editor,
				};
			}
		}

		if (previewItem?.id && previewItem?.kernel) {
			const previewRow = importRows.find(
				(row) => String(row?.itemId ?? "") === String(previewItem.id ?? "")
			);

			return {
				mode: "preview",
				objectId: previewItem.id ?? null,
				label: previewItem.name ?? previewRow?.label ?? previewItem.id ?? "preview",
				type: previewItem.kind ?? previewRow?.kind ?? "alignment",
				crsId: derivePreviewCrsId(previewItem),
				status: "preview_only",
				slot: windowState?.activeSlot ?? "right",
				pinned: false,
				source: previewItem.source ?? null,
				selectedElementId,
				editor: null,
			};
		}

		return {
			mode: "none",
			objectId: null,
			label: "Keine aktive Szene",
			type: null,
			crsId: null,
			status: "empty",
			slot: windowState?.activeSlot ?? "right",
			pinned: false,
			source: null,
			selectedElementId,
			editor: null,
		};
	}

	_buildContextState(windowState, spotState, scene, { importRows = [], spotRows = [] } = {}) {

		const contextCount = getWorkspaceContextIds(windowState).length;

		const crs = inspectCrsContext({
			sceneCrsId: scene?.crsId ?? null,
			projectCrsId: spotState?.meta?.engineeringCrsId ?? null,
			importCrsIds: importRows.map((row) => row?.crsId ?? null),
			spotCrsIds: spotRows.map((row) => row?.crsId ?? null),
		});

		return {
			crs,
			crsIds: crs.crsIds,
			hasCrsConflict: crs.hasConflict,
			sceneHasCrs: crs.hasSceneCrs,
			sceneIsPreview: scene?.mode === "preview",
			sceneIsSpot: scene?.mode === "spot",
			importCount: importRows.length,
			spotCount: spotRows.length,

			previewTracks: contextCount,
			contextCount,

			message: buildContextMessage(scene, crs),
		};
	}

	_buildActionState(scene, context) {
		const actions = [];

		if (scene.mode === "preview" && scene.objectId) {
			actions.push(
				{
					id: "accept",
					label: "Übernehmen",
					kind: "secondary",
					objectId: scene.objectId,
				},
				{
					id: "acceptAndShow",
					label: "Übernehmen & anzeigen",
					kind: "primary",
					objectId: scene.objectId,
				},
				{
					id: "clearPreview",
					label: "Vorschau schließen",
					kind: "ghost",
					objectId: scene.objectId,
				}
			);
		}

		if (scene.mode === "spot" && scene.objectId) {
			actions.push(
				{
					id: "exportLandXML",
					label: "landXML exportieren",
					kind: "primary",
					objectId: scene.objectId,
				},
				{
					id: "pin",
					label: scene.pinned ? "Aus Kontext lösen" : "Als Kontext anzeigen",
					kind: "secondary",
					objectId: scene.objectId,
				}
			);
		}

		if (context.hasCrsConflict) {
			actions.push({
				id: "inspectCrs",
				label: "CRS prüfen",
				kind: "warning",
				objectId: scene.objectId,
			});
		}

		return actions;
	}

	_wireOnce() {
		if (this._wired || !this._rootEl) return;

		this._wired = true;

		this._rootEl.addEventListener("click", (ev) => {
			const focusEditorBtn = ev.target.closest("[data-cockpit-focus-editor-element]");
			if (focusEditorBtn) {
				const elementId = String(focusEditorBtn.dataset.cockpitElementId ?? "").trim();
				const objectId = String(focusEditorBtn.dataset.cockpitObjectId ?? "").trim();

				if (objectId) {
					this._activateObjectId(objectId);
				}

				window.dispatchEvent(new CustomEvent("ufaim:alignment-editor-focus-element", {
					detail: { elementId, objectId, source: "cockpit" },
				}));
				return;
			}

			const newAlignmentBtn = ev.target.closest("[data-cockpit-new-alignment]");
			if (newAlignmentBtn) {
				void this.createNewAlignment();
				return;
			}

			const addStraightBtn = ev.target.closest("[data-cockpit-add-straight]");
			if (addStraightBtn) {
				void this._alignmentEditor.addStraightToActiveAlignment({ length: 100 });
				return;
			}

			const clearElementsBtn = ev.target.closest("[data-cockpit-clear-elements]");
			if (clearElementsBtn) {
				void this.clearActiveAlignmentElements();
				return;
			}

			const actionBtn = ev.target.closest("[data-cockpit-action]");
			if (actionBtn) {
				this._dispatchAction(
					actionBtn.dataset.cockpitAction,
					actionBtn.dataset.objectId
				);
				return;
			}

			const previewBtn = ev.target.closest("[data-cockpit-preview]");
			if (previewBtn) {
				void this.previewImportItem(previewBtn.dataset.cockpitPreview);
				return;
			}

			const acceptBtn = ev.target.closest("[data-cockpit-accept]");
			if (acceptBtn) {
				void this.acceptImportItem(acceptBtn.dataset.cockpitAccept, {
					show: false,
				});
				return;
			}

			const acceptShowBtn = ev.target.closest("[data-cockpit-accept-show]");
			if (acceptShowBtn) {
				void this.acceptImportItem(acceptShowBtn.dataset.cockpitAcceptShow, {
					show: true,
				});
				return;
			}

			const activateBtn = ev.target.closest("[data-cockpit-activate]");
			if (activateBtn) {
				void this.activateSpotObject(activateBtn.dataset.cockpitActivate);
				return;
			}

			const pinBtn = ev.target.closest("[data-cockpit-pin]");
			if (pinBtn) {
				this.togglePin(pinBtn.dataset.cockpitPin);
				return;
			}

			const clearPreviewBtn = ev.target.closest("[data-cockpit-clear-preview]");
			if (clearPreviewBtn) {
				this.clearPreview();
			}
		});

		this.messaging.onEvt?.("Spot.UiStateChanged", async () => {
			await this.refreshSpotState();
			this.render();
		});

		this.messaging.onEvt?.("Import.StateChanged", () => {
			void this.refreshImportState().then(() => this.render());
		});
	}

	_dispatchAction(actionId, objectId) {
		switch (actionId) {
			case "accept":
				void this.acceptImportItem(objectId, { show: false });
				return;

			case "acceptAndShow":
				void this.acceptImportItem(objectId, { show: true });
				return;

			case "clearPreview":
				this.clearPreview();
				return;

			case "exportLandXML":
				void this.exportLandXMLById(objectId);
				return;

			case "pin":
				this.togglePin(objectId);
				return;

			case "inspectCrs":
				this.logLine?.(
					"[Cockpit] CRS-Kontext ist sichtbar. Nächster Schritt: CRS-Management-Shell."
				);
				return;

			case "details":
				this.logLine?.(`[Cockpit] Details: ${objectId}`);
				return;

			default:
				this.logLine?.(`[Cockpit] unbekannte Aktion: ${actionId}`);
		}
	}

	_subscribeOnce() {
		if (this._unsubscribeStore) return;

		this._unsubscribeStore = this.store.subscribe(() => {
			this.queueRender();
		});
	}
}

function buildContextMessage(scene, crs) {
	if (scene.mode === "none") {
		return "Ziehe Daten in die Szene, um sie zu erkunden.";
	}

	if (crs?.message) {
		return crs.message;
	}

	if (scene.mode === "preview") {
		return "Dies ist eine Vorschau. Sie ist sichtbar, aber noch nicht Teil des Arbeitsbestands.";
	}

	return "Dieses Objekt ist im Arbeitsbestand und kann weiter untersucht werden.";
}
