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

import { renderCockpitHtml } from "@app/view/cockpit/renderCockpitHtml.js";

import {
	buildImportRows,
	buildSpotRows,
	findImportItemById,
	findSpotObjectById,
	makePreviewCandidate,
	readSpotLabel,
	derivePreviewCrsId,
	deriveImportItemCrsId,
	isPinned,
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
	}

	attach(rootEl) {
		if (!rootEl) throw new Error("CockpitController.attach: missing rootEl");

		this._rootEl = rootEl;
		this._wireOnce();
		this._subscribeOnce();

		void this.refreshAll();
	}

	async refreshAll() {
		await Promise.all([
			this.refreshImportState(),
			this.refreshSpotState(),
		]);

		this.render();
	}

	async refreshImportState() {
		this._importState = await this.messaging.sendCmdAwait("Import.GetState", {});
		return this._importState;
	}

	async refreshSpotState() {
		this._spotState = await this.messaging.sendCmdAwait("Spot.GetState", {});
		return this._spotState;
	}

	render() {
		if (!this._rootEl) return;
		this._rootEl.innerHTML = renderCockpitHtml(this.buildUiState());
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

		const scene = this._buildSceneState(windowState, spotState);
		const context = this._buildContextState(windowState, importState, spotState, scene);
		const actions = this._buildActionState(scene, context);

		return {
			scene,
			context,
			actions,
			collections: {
				importRows: buildImportRows(windowState, importState),
				spotRows: buildSpotRows(windowState, spotState),
			},
		};
	}

	async previewImportItem(itemId) {
		const importState = this._importState ?? await this.refreshImportState();
		const item = findImportItemById(importState, itemId);

		if (!item?.derived?.sparseAlignment) return false;

		const previewCandidate = makePreviewCandidate(item);

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
		const item = findImportItemById(importState, itemId);

		if (!item) return false;

		if (item?.status?.accepted === true) {
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

	_activateObjectId(objectId) {
		return activateObjectId({
			store: this.store,
			objectId,
		});
	}

	_buildSceneState(windowState, spotState) {
		const activeObjectId =
			windowState?.workspace_selection?.primaryId ??
			windowState?.focus?.objectId ??
			windowState?.activeRouteProjectId ??
			null;

		const previewItem = windowState?.preview_item ?? null;

		if (activeObjectId) {
			const obj = findSpotObjectById(spotState, activeObjectId);

			if (obj) {
				return {
					mode: "spot",
					objectId: String(obj.id ?? activeObjectId),
					label: readSpotLabel(obj),
					type: obj.type ?? "unknown",
					crsId: obj.crsId ?? null,
					status: "in_workspace",
					slot: windowState?.activeSlot ?? "right",
					pinned: isPinned(windowState, obj.id ?? activeObjectId),
					source: obj?.meta?.source ?? null,
				};
			}
		}

		if (previewItem?.id || previewItem?.name) {
			return {
				mode: "preview",
				objectId: previewItem.id ?? null,
				label: previewItem.name ?? previewItem.id ?? "preview",
				type: previewItem.kind ?? "alignment",
				crsId: derivePreviewCrsId(previewItem),
				status: "preview_only",
				slot: windowState?.activeSlot ?? "right",
				pinned: false,
				source: previewItem.source ?? null,
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
		};
	}

	_buildContextState(windowState, importState, spotState, scene) {
		const importItems = Array.isArray(importState?.items) ? importState.items : [];
		const spotObjects = Object.values(spotState?.objects ?? {});

		const workspaceSelection = windowState?.workspace_selection ?? {};
		const contextCount = Array.isArray(workspaceSelection?.contextIds)
			? workspaceSelection.contextIds.length
			: 0;

		const crs = inspectCrsContext({
			sceneCrsId: scene?.crsId ?? null,
			projectCrsId: spotState?.meta?.engineeringCrsId ?? null,
			importCrsIds: importItems.map(deriveImportItemCrsId),
			spotCrsIds: spotObjects.map((o) => o?.crsId ?? null),
		});

		return {
			crs,
			crsIds: crs.crsIds,
			hasCrsConflict: crs.hasConflict,
			sceneHasCrs: crs.hasSceneCrs,
			sceneIsPreview: scene?.mode === "preview",
			sceneIsSpot: scene?.mode === "spot",
			importCount: importItems.length,
			spotCount: spotObjects.length,

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

		this.messaging.onEvt?.("Import.StateChanged", async () => {
			await this.refreshImportState();
			this.render();
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
