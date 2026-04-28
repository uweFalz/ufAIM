// app/controllers/CockpitController.js
//
// CockpitController
//
// Cockpit = contact point / iVision between user and system.
//
// Role:
// - translates local window state + canonical ImportSession + canonical SPOT
//   into a user-facing scene/context/action shell
// - dispatches user intents
// - does NOT own truth
//
// Principles:
// - user-first
// - what you see is what you can explore
// - every user interaction gives value to user and system
// - no geometry computation here
// - no parser logic here
// - no fake canonical state here

import { escapeHtml } from "@app/utils/appHelpers.js";

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

		const scene = this._buildSceneState(windowState, importState, spotState);
		const context = this._buildContextState(windowState, importState, spotState, scene);
		const actions = this._buildActionState(scene, context, windowState);

		return {
			scene,
			context,
			actions,
			collections: {
				importRows: this._buildImportRows(windowState, importState),
				spotRows: this._buildSpotRows(windowState, spotState),
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

		this.logLine?.(`[Cockpit] preview: ${previewCandidate.name}`);
		this.queueRender();
		return true;
	}

	async acceptImportItem(itemId, { show = false } = {}) {
		const importState = this._importState ?? await this.refreshImportState();
		const item = findImportItemById(importState, itemId);
		if (!item) return false;

		const result = await this.messaging.sendCmdAwait("Spot.PromoteImportItemsById", {
			itemIds: [itemId],
		});

		await Promise.all([
			this.refreshImportState(),
			this.refreshSpotState(),
		]);

		const addedObjectId =
			Array.isArray(result?.addedObjects) && result.addedObjects[0]?.id
				? String(result.addedObjects[0].id)
				: null;

		if (addedObjectId && show) {
			this.store.actions?.clearPreviewItem?.();
			this.store.actions?.setActiveRouteProject?.(addedObjectId);
			this.store.actions?.setCursorS?.(0);
		}

		this.logLine?.(`[Cockpit] übernommen: ${itemId}${show ? " + anzeigen" : ""}`);
		this.render();
		return true;
	}

	async activateSpotObject(objectId) {
		const id = String(objectId ?? "").trim();
		if (!id) return false;

		this.store.actions?.setActiveRouteProject?.(id);
		this.store.actions?.clearPreviewItem?.();
		this.store.actions?.setCursorS?.(0);

		this.logLine?.(`[Cockpit] anzeigen: ${id}`);
		this.queueRender();
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

	_buildSceneState(windowState, importState, spotState) {
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
				crsId: previewItem.crsId ?? derivePreviewCrsId(previewItem),
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

		const crsIds = unique([
			...importItems.map(deriveImportItemCrsId),
			...spotObjects.map((o) => o?.crsId ?? null),
		].filter(Boolean));

		const previewTracks = Array.isArray(windowState.import_preview_collection)
			? windowState.import_preview_collection.length
			: 0;

		return {
			crsIds,
			hasCrsConflict: crsIds.length > 1,
			sceneHasCrs: Boolean(scene?.crsId),
			sceneIsPreview: scene?.mode === "preview",
			sceneIsSpot: scene?.mode === "spot",
			importCount: importItems.length,
			spotCount: spotObjects.length,
			previewTracks,
			message: buildContextMessage(scene, crsIds),
		};
	}

	_buildActionState(scene, context, windowState) {
		const actions = [];

		if (scene.mode === "preview" && scene.objectId) {
			actions.push({
				id: "accept",
				label: "Übernehmen",
				kind: "secondary",
				objectId: scene.objectId,
			});

			actions.push({
				id: "acceptAndShow",
				label: "Übernehmen & anzeigen",
				kind: "primary",
				objectId: scene.objectId,
			});

			actions.push({
				id: "clearPreview",
				label: "Vorschau schließen",
				kind: "ghost",
				objectId: scene.objectId,
			});
		}

		if (scene.mode === "spot" && scene.objectId) {
			actions.push({
				id: "pin",
				label: scene.pinned ? "Lösen" : "Anheften",
				kind: "secondary",
				objectId: scene.objectId,
			});
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

	_buildImportRows(windowState, importState) {
		const items = Array.isArray(importState?.items) ? importState.items : [];
		const previewId = String(windowState?.preview_item?.id ?? "");

		return items.map((item) => {
			const itemId = String(item?.id ?? "");
			const label = readImportLabel(item);

			return {
				itemId,
				label,
				fileName: item?.source?.fileName ?? null,
				kind: item?.kind ?? "unknown",
				crsId: deriveImportItemCrsId(item),
				promotable: item?.status?.promotable === true,
				accepted: item?.status?.accepted === true,
				hasSparse: Boolean(item?.derived?.sparseAlignment),
				isPreviewActive: previewId !== "" && previewId === itemId,
			};
		});
	}

	_buildSpotRows(windowState, spotState) {
		const objects = Object.values(spotState?.objects ?? {});
		const activeObjectId =
			windowState?.focus?.objectId ??
			windowState?.activeRouteProjectId ??
			null;

		return objects.map((obj) => {
			const objectId = String(obj?.id ?? "");
			return {
				objectId,
				label: readSpotLabel(obj),
				type: obj?.type ?? "unknown",
				crsId: obj?.crsId ?? null,
				hasKernel: Boolean(obj?.data?.kernel),
				isActive: activeObjectId === objectId,
				pinned: isPinned(windowState, objectId),
			};
		});
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

			case "pin":
				this.togglePin(objectId);
				return;

			case "inspectCrs":
				this.logLine?.("[Cockpit] CRS prüfen: noch Management-Shell-Platzhalter");
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

// -----------------------------------------------------------------------------
// html
// -----------------------------------------------------------------------------

function renderCockpitHtml(uiState = {}) {
	const scene = uiState?.scene ?? {};
	const context = uiState?.context ?? {};
	const actions = Array.isArray(uiState?.actions) ? uiState.actions : [];
	const importRows = Array.isArray(uiState?.collections?.importRows)
		? uiState.collections.importRows
		: [];
	const spotRows = Array.isArray(uiState?.collections?.spotRows)
		? uiState.collections.spotRows
		: [];

	return `
		<div class="cockpit-sofa cockpit-ivision">
			<section class="cockpit-sofa__section cockpit-ivision__scene">
				<h3>Du siehst gerade</h3>
				<div class="cockpit-sofa__card ${scene.mode === "preview" ? "is-preview" : ""} ${context.hasCrsConflict ? "has-warning" : ""}">
					<div><strong>${escapeHtml(scene.label ?? "Keine aktive Szene")}</strong></div>
					<div>
						${escapeHtml(scene.type ?? "—")}
						· ${renderModeLabel(scene.mode)}
						· ${scene.crsId ? escapeHtml(scene.crsId) : "CRS offen"}
					</div>
					<div>
						Slot: ${escapeHtml(scene.slot ?? "right")}
						${scene.pinned ? " · angeheftet" : ""}
					</div>
					${renderSourceLine(scene.source)}
				</div>
			</section>

			<section class="cockpit-sofa__section cockpit-ivision__context">
				<h3>Einordnung</h3>
				<div class="cockpit-sofa__card ${context.hasCrsConflict ? "has-warning" : ""}">
					<div>${escapeHtml(context.message ?? "")}</div>
					<div>
						Import: ${Number(context.importCount ?? 0)}
						· SPOT: ${Number(context.spotCount ?? 0)}
						· Vorschau-Layer: ${Number(context.previewTracks ?? 0)}
					</div>
					<div>
						CRS: ${context.crsIds?.length ? escapeHtml(context.crsIds.join(", ")) : "noch offen"}
					</div>
				</div>
			</section>

			<section class="cockpit-sofa__section cockpit-ivision__actions">
				<h3>Nächste sinnvolle Schritte</h3>
				<div class="cockpit-sofa__actions cockpit-ivision__actionbar">
					${renderActionButtons(actions)}
				</div>
			</section>

			<section class="cockpit-sofa__section">
				<h3>Import erkunden · ${importRows.length}</h3>
				<div class="cockpit-sofa__list">
					${renderImportRows(importRows)}
				</div>
			</section>

			<section class="cockpit-sofa__section">
				<h3>Arbeitsbestand · ${spotRows.length}</h3>
				<div class="cockpit-sofa__list">
					${renderSpotRows(spotRows)}
				</div>
			</section>
		</div>
	`;
}

function renderActionButtons(actions = []) {
	if (!actions.length) {
		return `<div class="cockpit-sofa__empty">Keine Aktion nötig. Ziehe Daten hinein oder wähle ein Objekt.</div>`;
	}

	return actions.map((action) => `
		<button
			class="btn btn--xs ${action.kind === "primary" ? "btn--primary" : "btn--ghost"}"
			data-cockpit-action="${escapeHtml(action.id)}"
			data-object-id="${escapeHtml(action.objectId ?? "")}">
			${escapeHtml(action.label)}
		</button>
	`).join("");
}

function renderImportRows(rows = []) {
	if (!rows.length) {
		return `<div class="cockpit-sofa__empty">(keine Importdaten)</div>`;
	}

	return rows.map((row) => `
		<div class="cockpit-sofa__row ${row.isPreviewActive ? "is-active" : ""}">
			<div class="cockpit-sofa__main">
				<div><strong>${escapeHtml(row.label ?? row.itemId ?? "item")}</strong></div>
				<div>
					${escapeHtml(row.kind ?? "unknown")}
					· ${escapeHtml(row.fileName ?? "no-file")}
					· ${row.crsId ? escapeHtml(row.crsId) : "CRS offen"}
				</div>
				<div>
					${row.promotable ? "übernehmbar" : "nicht übernehmbar"}
					${row.hasSparse ? " · Kernel" : ""}
					${row.accepted ? " · akzeptiert" : ""}
				</div>
			</div>
			<div class="cockpit-sofa__actions">
				<button class="btn btn--ghost btn--xs" data-cockpit-preview="${escapeHtml(row.itemId)}">Ansehen</button>
				${row.promotable ? `<button class="btn btn--ghost btn--xs" data-cockpit-accept="${escapeHtml(row.itemId)}">Übernehmen</button>` : ""}
				${row.promotable ? `<button class="btn btn--ghost btn--xs" data-cockpit-accept-show="${escapeHtml(row.itemId)}">Übernehmen & anzeigen</button>` : ""}
			</div>
		</div>
	`).join("");
}

function renderSpotRows(rows = []) {
	if (!rows.length) {
		return `<div class="cockpit-sofa__empty">(noch kein Arbeitsbestand)</div>`;
	}

	return rows.map((row) => `
		<div class="cockpit-sofa__row ${row.isActive ? "is-active" : ""}">
			<div class="cockpit-sofa__main">
				<div><strong>${escapeHtml(row.label ?? row.objectId ?? "object")}</strong></div>
				<div>
					${escapeHtml(row.type ?? "unknown")}
					· ${row.crsId ? escapeHtml(row.crsId) : "CRS offen"}
					${row.hasKernel ? " · Kernel" : ""}
					${row.pinned ? " · angeheftet" : ""}
				</div>
			</div>
			<div class="cockpit-sofa__actions">
				<button class="btn btn--ghost btn--xs" data-cockpit-activate="${escapeHtml(row.objectId)}">Anzeigen</button>
				<button class="btn btn--ghost btn--xs" data-cockpit-pin="${escapeHtml(row.objectId)}">${row.pinned ? "Lösen" : "Anheften"}</button>
			</div>
		</div>
	`).join("");
}

function renderModeLabel(mode) {
	switch (mode) {
		case "preview": return "Vorschau";
		case "spot": return "Arbeitsbestand";
		case "none": return "leer";
		default: return escapeHtml(mode ?? "unbekannt");
	}
}

function renderSourceLine(source) {
	if (!source) return "";

	const parts = [
		source.fileName ?? source.file ?? null,
		source.objectName ?? null,
		source.parserId ?? source.format ?? null,
	].filter(Boolean);

	if (!parts.length) return "";
	return `<div>Quelle: ${escapeHtml(parts.join(" · "))}</div>`;
}

// -----------------------------------------------------------------------------
// data helpers
// -----------------------------------------------------------------------------

function makePreviewCandidate(item) {
	const kernel = item?.derived?.sparseAlignment ?? null;
	const name = readImportLabel(item);
	const crsId = deriveImportItemCrsId(item);

	return {
		id: item.id ?? item?.payload?.id ?? item?.payload?.name ?? "preview_alignment",
		kind: item.kind ?? "alignment",
		name,

		// compatibility for current viewController
		sparseAlignment: kernel,
		spatialRef: item?.derived?.spatialRef ?? null,

		// new vocabulary
		kernel,
		crsId,

		source: {
			fileName: item?.source?.fileName ?? null,
			parserId: item?.source?.parserId ?? null,
			objectName: item?.source?.objectName ?? null,
		},
	};
}

function findImportItemById(importState, itemId) {
	const items = Array.isArray(importState?.items) ? importState.items : [];
	const want = String(itemId ?? "");
	return items.find((item) => String(item?.id ?? "") === want) ?? null;
}

function findSpotObjectById(spotState, objectId) {
	const objects = spotState?.objects ?? {};
	return objects[String(objectId ?? "")] ?? null;
}

function readImportLabel(item) {
	return (
		item?.payload?.name ??
		item?.payload?.id ??
		item?.source?.objectName ??
		item?.id ??
		"import item"
	);
}

function readSpotLabel(obj) {
	return (
		obj?.data?.name ??
		obj?.meta?.label ??
		obj?.meta?.name ??
		obj?.meta?.objectId ??
		obj?.meta?.alignmentName ??
		obj?.id ??
		"object"
	);
}

function deriveImportItemCrsId(item) {
	const sr = item?.derived?.spatialRef ?? item?.payload?.spatialRef ?? null;

	return normalizeCrsId(
		sr?.crsId ??
		sr?.horizontalCrsId ??
		sr?.horizontal ??
		sr?.horizontalCoordinateSystemName ??
		null
	);
}

function derivePreviewCrsId(previewItem) {
	const sr = previewItem?.spatialRef ?? null;

	return normalizeCrsId(
		previewItem?.crsId ??
		sr?.crsId ??
		sr?.horizontalCrsId ??
		sr?.horizontal ??
		sr?.horizontalCoordinateSystemName ??
		null
	);
}

function normalizeCrsId(value) {
	const s = String(value ?? "").trim();
	if (!s) return null;

	if (/^EPSG:/i.test(s)) return `EPSG:${s.split(":")[1]}`;
	if (/^DB:/i.test(s)) return `DB:${s.split(":")[1].toUpperCase()}`;

	if (/^[A-Z]{2}\d$/i.test(s)) return `DB:${s.toUpperCase()}`;

	return s;
}

function buildContextMessage(scene, crsIds) {
	if (scene.mode === "none") {
		return "Ziehe Daten in die Szene, um sie zu erkunden.";
	}

	if (crsIds.length > 1) {
		return `Mehrere Bezugssysteme erkannt: ${crsIds.join(", ")}. Anzeigen ist möglich, Zusammenführen braucht Klärung.`;
	}

	if (!scene.crsId) {
		return "Dieses Objekt hat noch kein explizites Bezugssystem.";
	}

	if (scene.mode === "preview") {
		return "Dies ist eine Vorschau. Sie ist sichtbar, aber noch nicht Teil des Arbeitsbestands.";
	}

	return "Dieses Objekt ist im Arbeitsbestand und kann weiter untersucht werden.";
}

function unique(values) {
	return [...new Set(values.map((v) => String(v)).filter(Boolean))];
}

function isPinned(windowState, objectId) {
	const pins = Array.isArray(windowState?.view_pins) ? windowState.view_pins : [];
	const want = String(objectId ?? "");
	return pins.some((p) => String(p?.rpId ?? "") === want);
}
