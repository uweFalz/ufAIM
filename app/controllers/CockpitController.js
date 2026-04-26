// app/controllers/CockpitController.js
//
// CockpitController
//
// Window-local user cockpit orchestration.
//
// Role:
// - builds a user-facing cockpit state from
//   * local window store
//   * canonical import-session state (master)
//   * canonical SPOT state (master)
// - dispatches user intents
// - does NOT own truth
//
// Principles:
// - user-first
// - no geometry computation here
// - no parser logic here
// - no fake canonical state here
//
// Current v1 scope:
// - focus summary
// - import inbox summary
// - SPOT summary
// - preview / accept / activate / pin actions
//
// Notes:
// - preview remains local-window only
// - canonical promotion remains explicit
// - cockpit is a visible control sofa, not a hidden service

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

	// -------------------------------------------------------------------------
	// public
	// -------------------------------------------------------------------------

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

		const uiState = this.buildUiState();
		this._rootEl.innerHTML = renderCockpitHtml(uiState);
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

		const focus = this._buildFocusState(windowState, importState, spotState);
		const importInbox = this._buildImportInboxState(windowState, importState);
		const spot = this._buildSpotState(windowState, spotState);

		return {
			focus,
			importInbox,
			spot,
			stats: {
				importItems: importInbox.total,
				spotObjects: spot.total,
				previewTracks: Array.isArray(windowState.import_preview_collection)
					? windowState.import_preview_collection.length
					: 0,
			},
		};
	}

	async previewImportItem(itemId) {
		const importState = this._importState ?? await this.refreshImportState();
		const item = findImportItemById(importState, itemId);
		if (!item?.derived?.sparseAlignment) return false;

		const previewCandidate = {
			id: item.id ?? item?.payload?.id ?? item?.payload?.name ?? "preview_alignment",
			kind: item.kind ?? "alignment",
			name:
				item?.payload?.name ??
				item?.payload?.id ??
				item?.source?.objectName ??
				item?.id ??
				"preview",
			sparseAlignment: item.derived.sparseAlignment,
			spatialRef: item?.derived?.spatialRef ?? null,
			source: {
				fileName: item?.source?.fileName ?? null,
				parserId: item?.source?.parserId ?? null,
				objectName: item?.source?.objectName ?? null,
			},
		};

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

	async acceptImportItem(itemId) {
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
			Array.isArray(result?.addedObjects) && result.addObjects?.[0]?.id
				? String(result.addedObjects[0].id)
				: Array.isArray(result?.addedObjects) && result.addedObjects[0]?.id
					? String(result.addedObjects[0].id)
					: null;

		if (addedObjectId) {
			this.store.actions?.clearPreviewItem?.();
			this.store.actions?.setActiveRouteProject?.(addedObjectId);
		}

		this.logLine?.(`[Cockpit] accept: ${itemId}`);
		this.render();
		return true;
	}

	async activateSpotObject(objectId) {
		const id = String(objectId ?? "").trim();
		if (!id) return false;

		this.store.actions?.setActiveRouteProject?.(id);
		this.store.actions?.clearPreviewItem?.();

		this.logLine?.(`[Cockpit] activate: ${id}`);
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
		this.logLine?.("[Cockpit] clear preview");
		this.queueRender();
	}

	// -------------------------------------------------------------------------
	// internal: build ui state
	// -------------------------------------------------------------------------

	_buildFocusState(windowState, importState, spotState) {
		const activeObjectId =
			windowState?.focus?.objectId ??
			windowState?.activeRouteProjectId ??
			null;

		const previewItem = windowState?.preview_item ?? null;
		const pinned = isPinned(windowState, activeObjectId);

		if (activeObjectId) {
			const obj = findSpotObjectById(spotState, activeObjectId);
			if (obj) {
				return {
					mode: "spot",
					objectId: activeObjectId,
					label: readSpotLabel(obj),
					slot: windowState?.activeSlot ?? "right",
					pinned,
				};
			}
		}

		if (previewItem?.id || previewItem?.name) {
			return {
				mode: "preview",
				objectId: previewItem?.id ?? null,
				label: previewItem?.name ?? previewItem?.id ?? "preview",
				slot: windowState?.activeSlot ?? "right",
				pinned: false,
			};
		}

		return {
			mode: "none",
			objectId: null,
			label: null,
			slot: windowState?.activeSlot ?? "right",
			pinned: false,
		};
	}

	_buildImportInboxState(windowState, importState) {
		const items = Array.isArray(importState?.items) ? importState.items : [];
		const previewId = String(windowState?.preview_item?.id ?? "");

		const rows = items.map((item) => {
			const itemId = String(item?.id ?? "");
			const label =
				item?.payload?.name ??
				item?.payload?.id ??
				item?.source?.objectName ??
				itemId;

			return {
				itemId,
				label,
				fileName: item?.source?.fileName ?? null,
				kind: item?.kind ?? "unknown",
				promotable: item?.status?.promotable === true,
				hasSparse: Boolean(item?.derived?.sparseAlignment),
				isPreviewActive: previewId !== "" && previewId === itemId,
			};
		});

		return {
			total: rows.length,
			rows,
		};
	}

	_buildSpotState(windowState, spotState) {
		const objects = Object.values(spotState?.objects ?? {});
		const activeObjectId =
			windowState?.focus?.objectId ??
			windowState?.activeRouteProjectId ??
			null;

		const rows = objects.map((obj) => {
			const objectId = String(obj?.id ?? "");
			return {
				objectId,
				label: readSpotLabel(obj),
				type: obj?.type ?? "unknown",
				isActive: activeObjectId === objectId,
				pinned: isPinned(windowState, objectId),
			};
		});

		return {
			total: rows.length,
			rows,
		};
	}

	// -------------------------------------------------------------------------
	// internal wiring
	// -------------------------------------------------------------------------

	_wireOnce() {
		if (this._wired || !this._rootEl) return;
		this._wired = true;

		this._rootEl.addEventListener("click", (ev) => {
			const previewBtn = ev.target.closest("[data-cockpit-preview]");
			if (previewBtn) {
				void this.previewImportItem(previewBtn.dataset.cockpitPreview);
				return;
			}

			const acceptBtn = ev.target.closest("[data-cockpit-accept]");
			if (acceptBtn) {
				void this.acceptImportItem(acceptBtn.dataset.cockpitAccept);
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

	_subscribeOnce() {
		if (this._unsubscribeStore) return;
		this._unsubscribeStore = this.store.subscribe(() => {
			this.queueRender();
		});
	}
}

// -----------------------------------------------------------------------------
// html helpers
// -----------------------------------------------------------------------------

function renderCockpitHtml(uiState = {}) {
	const focus = uiState?.focus ?? {};
	const importInbox = uiState?.importInbox ?? { rows: [] };
	const spot = uiState?.spot ?? { rows: [] };
	const stats = uiState?.stats ?? {};

	return `
		<div class="cockpit-sofa">
			<section class="cockpit-sofa__section">
				<h3>Focus</h3>
				<div class="cockpit-sofa__card">
					<div><strong>Mode:</strong> ${escapeHtml(focus.mode ?? "none")}</div>
					<div><strong>Label:</strong> ${escapeHtml(focus.label ?? "—")}</div>
					<div><strong>Slot:</strong> ${escapeHtml(focus.slot ?? "right")}</div>
					<div><strong>Pinned:</strong> ${focus.pinned ? "yes" : "no"}</div>
					<div class="cockpit-sofa__actions">
						<button class="btn btn--ghost btn--xs" data-cockpit-clear-preview>Clear preview</button>
						${focus.objectId ? `<button class="btn btn--ghost btn--xs" data-cockpit-pin="${escapeHtml(focus.objectId)}">${focus.pinned ? "Unpin" : "Pin"}</button>` : ""}
					</div>
				</div>
			</section>

			<section class="cockpit-sofa__section">
				<h3>Import Inbox · ${Number(importInbox.total ?? 0)}</h3>
				<div class="cockpit-sofa__list">
					${renderImportInboxRows(importInbox.rows)}
				</div>
			</section>

			<section class="cockpit-sofa__section">
				<h3>SPOT · ${Number(spot.total ?? 0)}</h3>
				<div class="cockpit-sofa__list">
					${renderSpotRows(spot.rows)}
				</div>
			</section>

			<section class="cockpit-sofa__section">
				<h3>Stats</h3>
				<div class="cockpit-sofa__card">
					<div><strong>Import items:</strong> ${Number(stats.importItems ?? 0)}</div>
					<div><strong>SPOT objects:</strong> ${Number(stats.spotObjects ?? 0)}</div>
					<div><strong>Preview tracks:</strong> ${Number(stats.previewTracks ?? 0)}</div>
				</div>
			</section>
		</div>
	`;
}

function renderImportInboxRows(rows = []) {
	if (!rows.length) {
		return `<div class="cockpit-sofa__empty">(no imported items)</div>`;
	}

	return rows.map((row) => `
		<div class="cockpit-sofa__row ${row.isPreviewActive ? "is-active" : ""}">
			<div class="cockpit-sofa__main">
				<div><strong>${escapeHtml(row.label ?? row.itemId ?? "item")}</strong></div>
				<div>${escapeHtml(row.kind ?? "unknown")} · ${escapeHtml(row.fileName ?? "no-file")}</div>
				<div>${row.promotable ? "promotable" : "not promotable"}${row.hasSparse ? " · sparse" : ""}</div>
			</div>
			<div class="cockpit-sofa__actions">
				<button class="btn btn--ghost btn--xs" data-cockpit-preview="${escapeHtml(row.itemId)}">Preview</button>
				${row.promotable ? `<button class="btn btn--ghost btn--xs" data-cockpit-accept="${escapeHtml(row.itemId)}">Accept</button>` : ""}
			</div>
		</div>
	`).join("");
}

function renderSpotRows(rows = []) {
	if (!rows.length) {
		return `<div class="cockpit-sofa__empty">(no SPOT objects)</div>`;
	}

	return rows.map((row) => `
		<div class="cockpit-sofa__row ${row.isActive ? "is-active" : ""}">
			<div class="cockpit-sofa__main">
				<div><strong>${escapeHtml(row.label ?? row.objectId ?? "object")}</strong></div>
				<div>${escapeHtml(row.type ?? "unknown")}${row.pinned ? " · pinned" : ""}</div>
			</div>
			<div class="cockpit-sofa__actions">
				<button class="btn btn--ghost btn--xs" data-cockpit-activate="${escapeHtml(row.objectId)}">Activate</button>
				<button class="btn btn--ghost btn--xs" data-cockpit-pin="${escapeHtml(row.objectId)}">${row.pinned ? "Unpin" : "Pin"}</button>
			</div>
		</div>
	`).join("");
}

function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
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

function readSpotLabel(obj) {
	return (
		obj?.meta?.name ??
		obj?.meta?.alignmentName ??
		obj?.payload?.name ??
		obj?.id ??
		"object"
	);
}

function isPinned(windowState, objectId) {
	const pins = Array.isArray(windowState?.view_pins) ? windowState.view_pins : [];
	const want = String(objectId ?? "");
	return pins.some((p) => String(p?.rpId ?? "") === want);
}
