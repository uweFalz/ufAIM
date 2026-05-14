// app/controllers/CockpitController.js

import { projectAlignmentPreview } from "@src/domain/projection/AlignmentProjectionService.js";
import { inspectCrsContext } from "@src/domain/crs/CrsAgent.js";
import { exportLandXML } from "@src/export/exportLandXML.js";
import { downloadTextFile } from "@src/export/downloadFile.js";

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
		this._syncSpotObjectsToPreviewCollection(this._spotState);
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

		const result = await this.messaging.sendCmdAwait("Spot.PromoteImportItemsById", {
			itemIds: [itemId],
		});

		const addedObjectId = readFirstAddedObjectId(result);

		if (!addedObjectId) {
			const reason = readFirstReviewReason(result);

			this.logLine?.(
			`[Cockpit] nicht ins Universe übernommen: ${itemId}` +
			(reason ? ` :: ${reason}` : "")
			);

			await Promise.all([
			this.refreshImportState(),
			this.refreshSpotState(),
			]);

			this.render();
			return false;
		}

		await this._markImportItemAccepted(itemId);

		await Promise.all([
		this.refreshImportState(),
		this.refreshSpotState(),
		]);

		if (show) {
			this._activateObjectId(addedObjectId);
		}

		this.logLine?.(`[Cockpit] ins Universe übernommen: ${itemId}${show ? " + anzeigen" : ""}`);
		this.render();

		return true;
	}

	async activateSpotObject(objectId) {
		const id = String(objectId ?? "").trim();
		if (!id) return false;

		this._activateObjectId(id);
		this.logLine?.(`[Cockpit] anzeigen: ${id}`);
		this.queueRender();

		return true;
	}

	async exportLandXMLById(objectId) {
		const id = String(objectId ?? "").trim();

		if (!id) {
			this.logLine?.("[Cockpit] kein Objekt für landXML-Export");
			return false;
		}

		const spotState = this._spotState ?? await this.refreshSpotState();
		const obj = findSpotObjectById(spotState, id);

		if (!obj) {
			this.logLine?.(`[Cockpit] SPOT-Objekt nicht gefunden: ${id}`);
			return false;
		}

		const alignment = obj?.data?.kernel ?? null;
		if (!alignment) {
			this.logLine?.(`[Cockpit] kein Alignment-Kernel für Export: ${id}`);
			return false;
		}

		const label = readSpotLabel(obj) ?? id;

		const xml = exportLandXML({
			alignment,
			meta: {
				name: label,
				objectId: id,
				crsId: obj?.crsId ?? null,
			},
		});

		downloadTextFile({
			content: xml,
			fileName: `${safeFileStem(label || id)}.landxml`,
		});

		this.logLine?.(`[Cockpit] landXML exportiert: ${label}`);
		return true;
	}

	togglePin(objectId) {
		const id = String(objectId ?? "").trim();
		if (!id) return false;

		this.store.actions?.togglePinRouteProject?.({
			rpId: id,
			slot: "right",
		});

		this.logLine?.(`[Cockpit] pin toggle: ${id}`);
		this.queueRender();

		return true;
	}

	clearPreview() {
		this.store.actions?.clearPreviewItem?.();
		this.logLine?.("[Cockpit] Vorschau geleert");
		this.queueRender();
	}

	_activateObjectId(objectId) {
		const id = String(objectId ?? "").trim();
		if (!id) return false;

		this.store.actions?.clearPreviewItem?.();
		this.store.actions?.setActiveRouteProject?.(id);
		this.store.actions?.setCursorS?.(0);

		return true;
	}

	async _markImportItemAccepted(itemId) {
		try {
			await this.messaging.sendCmdAwait("Import.SetItemAccepted", {
				itemId,
				accepted: true,
			});
		} catch (err) {
			console.warn("[Cockpit] Import.SetItemAccepted failed", err);
		}
	}

	_syncSpotObjectsToPreviewCollection(spotState) {
		const objects = Object.values(spotState?.objects ?? {});
		const tracks = [];

		for (const obj of objects) {
			const kernel = obj?.data?.kernel ?? null;
			if (!kernel) continue;

			const projected = projectAlignmentPreview({
				sparseAlignment: kernel,
				maxStep: 5,
			});

			const points = projected?.polyline2d;
			if (!Array.isArray(points) || points.length < 2) continue;

			tracks.push({
				id: String(obj.id),
				objectId: String(obj.id),
				points,
				source: "spot",
			});
		}

		this.store.actions?.setImportPreviewCollection?.({
			items: tracks,
			source: { type: "spot-sync" },
		});
	}

	_buildSceneState(windowState, spotState) {
		const activeObjectId =
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

		const previewTracks = Array.isArray(windowState.import_preview_collection)
		? windowState.import_preview_collection.length
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
			previewTracks,
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
				label: scene.pinned ? "Lösen" : "Anheften",
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
				this._dispatchAction(actionBtn.dataset.cockpitAction, actionBtn.dataset.objectId);
				return;
			}

			const previewBtn = ev.target.closest("[data-cockpit-preview]");
			if (previewBtn) {
				void this.previewImportItem(previewBtn.dataset.cockpitPreview);
				return;
			}

			const acceptBtn = ev.target.closest("[data-cockpit-accept]");
			if (acceptBtn) {
				void this.acceptImportItem(acceptBtn.dataset.cockpitAccept, { show: false });
				return;
			}

			const acceptShowBtn = ev.target.closest("[data-cockpit-accept-show]");
			if (acceptShowBtn) {
				void this.acceptImportItem(acceptShowBtn.dataset.cockpitAcceptShow, { show: true });
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
			this.logLine?.("[Cockpit] CRS-Kontext ist sichtbar. Nächster Schritt: CRS-Management-Shell.");
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

function readFirstAddedObjectId(result) {
	return Array.isArray(result?.addedObjects) && result.addedObjects[0]?.id
	? String(result.addedObjects[0].id)
	: null;
}

function readFirstReviewReason(result) {
	return Array.isArray(result?.reviewItems) && result.reviewItems[0]?.reason
	? String(result.reviewItems[0].reason)
	: null;
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

function safeFileStem(value) {
	return String(value ?? "ufAIM_alignment")
	.trim()
	.replace(/\.[^.]+$/g, "")
	.replace(/[^a-zA-Z0-9_\-]+/g, "_")
	.replace(/^_+|_+$/g, "")
	|| "ufAIM_alignment";
}
