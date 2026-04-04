// app/core/controllers/viewPropsPanel.js
//
// Props panel controller for ViewController.
//
// Responsibilities:
// - render props panel HTML
// - handle props panel click actions
//
// No store.subscribe here.
// No geometry computations here, except using already prepared chunk metrics/state.
// No direct three adapter access.

import { t } from "@app/i18n/strings.js";
import { escapeHtml } from "@app/utils/appHelpers.js";
import { formatNum } from "@src/utils/helpers.js";

import { parseIdSlotKey, normalizePins } from "@app/core/controllers/viewGeometry.js";
import { mirrorQuickHooksFromActive } from "@app/io/apply/importApply.js";

// console.log("[viewPropsPanel] loaded");

export function createViewPropsPanel({
	store,
	ui,
	propsElement,
	aux,
	setCursorS,
	redrawAuxFromState,
} = {}) {
	if (!store?.getState) throw new Error("createViewPropsPanel: missing store");
	if (!propsElement) throw new Error("createViewPropsPanel: missing propsElement");
	if (!aux) throw new Error("createViewPropsPanel: missing aux");
	if (typeof setCursorS !== "function") throw new Error("createViewPropsPanel: missing setCursorS");
	if (typeof redrawAuxFromState !== "function") {
		throw new Error("createViewPropsPanel: missing redrawAuxFromState");
	}

	function renderPinsHtml(state) {
		const pins = normalizePins(state.view_pins);

		if (!pins.length) {
			return `<div class="propsPins__empty">${escapeHtml(t("props_no_pins"))}</div>`;
		}

		return pins.map((pin) => {
			const key = `${pin.rpId}::${pin.slot}`;
			const safeRp = escapeHtml(pin.rpId ?? "");
			const safeSlot = escapeHtml(pin.slot ?? "right");
			const safeKey = escapeHtml(key);

			const isActive =
				(pin.rpId === state.activeRouteProjectId) &&
				(pin.slot === (state.activeSlot ?? "right"));

			const activeBadge = isActive
				? `<span class="propsPins__badge">${escapeHtml(t("props_active"))}</span>`
				: ``;

			return `
<div class="propsPins__row">
	<button
		class="btn btn--ghost btn--xs"
		data-pin-jump="${safeKey}"
		title="${escapeHtml(t("props_pin_jump_title"))}"
	>${escapeHtml(t("props_jump"))}</button>

	<div class="propsPins__label">
		<span class="propsPins__rp">${safeRp}</span>
		<span class="propsPins__slot">${safeSlot}</span>
		${activeBadge}
	</div>

	<button
		class="btn btn--ghost btn--xs"
		data-pin-unpin="${safeKey}"
		title="${escapeHtml(t("props_unpin_title"))}"
	>×</button>
</div>
`;
		}).join("");
	}

	function renderPendingHtml() {
		const pendingChunkStartS = aux.getPendingChunkStartS();

		if (pendingChunkStartS == null) return ``;

		return `
<div class="propsChunks__pending">
	${escapeHtml(t("props_chunk_pending", { s: formatNum(pendingChunkStartS, 1) }))}
</div>
`;
	}

	function renderChunksHtml() {
		const chunkTracks = aux.getChunkTracks();

		if (!chunkTracks.length) {
			return `<div class="propsChunks__empty">(no chunks yet) — Shift+click start/end</div>`;
		}

		return chunkTracks
			.slice()
			.sort((a, b) => (b?.at ?? 0) - (a?.at ?? 0))
			.map((c) => {
				const mid = (Number(c.s0) + Number(c.s1)) * 0.5;
				const m = c.metrics ?? {};
				const len = Number.isFinite(m.len) ? m.len : Math.abs(Number(c.s1) - Number(c.s0));
				const dH = Number.isFinite(m.dH) ? m.dH : null;
				const safeId = escapeHtml(c.id ?? "");
				const ageSec = Math.max(0, Math.round((Date.now() - (c.at ?? 0)) / 1000));

				const headingHtml = (dH != null)
					? `<span class="propsChunks__meta">ΔH=${escapeHtml(formatNum(dH, 1))}°</span>`
					: ``;

				const frozenBadge = c.frozen
					? `<span class="propsChunks__badge">frozen</span>`
					: ``;

				const hiddenBadge = c.hidden
					? `<span class="propsChunks__badge">hidden</span>`
					: ``;

				return `
<div class="propsChunks__row">
	<div class="propsChunks__label">
		<span class="propsChunks__range">
			s=${escapeHtml(formatNum(c.s0, 1))}..${escapeHtml(formatNum(c.s1, 1))}
		</span>
		<span class="propsChunks__meta">
			len=${escapeHtml(formatNum(len, 1))}m · age=${escapeHtml(String(ageSec))}s
		</span>
		${headingHtml}
		${frozenBadge}${hiddenBadge}
	</div>

	<button
		class="btn btn--ghost btn--xs"
		data-chunk-jump="${safeId}"
		data-chunk-mid="${escapeHtml(String(mid))}"
	>${escapeHtml(t("props_jump"))}</button>

	<button
		class="btn btn--ghost btn--xs"
		data-chunk-freeze="${safeId}"
		title="${escapeHtml(t("props_chunk_freeze_title"))}"
	>❄︎</button>

	<button
		class="btn btn--ghost btn--xs"
		data-chunk-hide="${safeId}"
		title="${escapeHtml(t("props_chunk_hide_title"))}"
	>👁</button>

	<button
		class="btn btn--ghost btn--xs"
		data-chunk-remove="${safeId}"
		title="${escapeHtml(t("props_chunk_remove_title"))}"
	>×</button>

	<button
		class="btn btn--ghost btn--xs"
		data-chunk-copy-json="${safeId}"
		title="${escapeHtml(t("props_chunk_copy_json_title"))}"
	>⧉</button>
</div>
`;
			}).join("");
	}

	function renderJsonHtml(state) {
		const json = JSON.stringify(
			{
				activeRouteProjectId: state.activeRouteProjectId ?? null,
				activeSlot: state.activeSlot ?? "right",
				cursor: state.cursor ?? {},
				import_meta: state.import_meta ?? null,
				activeArtifacts: state.import_activeArtifacts ?? null,

				hasAlignment: Array.isArray(state.import_polyline2d) && state.import_polyline2d.length >= 2,
				hasProfile: Array.isArray(state.import_profile1d) && state.import_profile1d.length >= 2,
				hasCant: Array.isArray(state.import_cant1d) && state.import_cant1d.length >= 2,
			},
			null,
			2
		);

		return `<div class="propsJson"><pre>${escapeHtml(json)}</pre></div>`;
	}

	function updateProps(state = store.getState()) {
		
		// console.log("[viewPropsPanel] updateProps");
		// console.log("[viewPropsPanel] title test", t("props_pins_title"));
// console.log("[viewPropsPanel] clear test", t("props_clear"));
		
		propsElement.innerHTML = `
<div class="propsPins">
	<div class="propsPins__title">Pinned</div>
	${renderPinsHtml(state)}
</div>

<div class="propsChunks">
	<div class="propsChunks__title">Chunks</div>
	${renderPendingHtml()}
	${renderChunksHtml()}
	<div class="propsChunks__actions">
		<button class="btn btn--ghost btn--xs" data-chunks-clear="1">Clear</button>
	</div>
</div>

${renderJsonHtml(state)}
`;
	}

	function copyChunkJson(id) {
		const idx = aux.findChunkIndexById(id);
		if (idx < 0) return;

		const chunkTracks = aux.getChunkTracks();
		const c = chunkTracks[idx];
		if (!c) return;

		const payload = {
			id: c.id,
			at: c.at,
			frozen: !!c.frozen,
			hidden: !!c.hidden,
			label: c.label ?? "",
			s0: c.s0,
			s1: c.s1,
			metrics: c.metrics ?? null,
		};

		const txt = JSON.stringify(payload, null, 2);

		if (navigator?.clipboard?.writeText) {
			navigator.clipboard.writeText(txt).then(
				() => ui?.logInfo?.("Chunk copied (JSON)."),
				() => ui?.logInfo?.("Copy failed (clipboard blocked).")
			);
			return;
		}

		try {
			window.prompt("Copy chunk JSON:", txt);
		} catch {
			ui?.logInfo?.(t("clipboard_api_unavailable"));
		}
	}

	function handleChunkActions(target, state, ev) {
		const jumpChunkBtn = target.closest("[data-chunk-jump]");
		const removeChunkBtn = target.closest("[data-chunk-remove]");
		const clearChunksBtn = target.closest("[data-chunks-clear]");
		const freezeChunkBtn = target.closest("[data-chunk-freeze]");
		const hideChunkBtn = target.closest("[data-chunk-hide]");
		const copyChunkJsonBtn = target.closest("[data-chunk-copy-json]");

		if (
			!jumpChunkBtn &&
			!removeChunkBtn &&
			!clearChunksBtn &&
			!freezeChunkBtn &&
			!hideChunkBtn &&
			!copyChunkJsonBtn
		) {
			return false;
		}

		ev.preventDefault?.();
		ev.stopPropagation?.();

		if (clearChunksBtn) {
			aux.clearChunks();
			updateProps(state);
			redrawAuxFromState(state);
			return true;
		}

		if (removeChunkBtn) {
			const id = removeChunkBtn.getAttribute("data-chunk-remove");
			if (id) {
				aux.removeChunk(id);
				updateProps(state);
				redrawAuxFromState(state);
			}
			return true;
		}

		if (freezeChunkBtn) {
			const id = freezeChunkBtn.getAttribute("data-chunk-freeze");
			if (id) {
				aux.toggleChunkFrozen(id);
				aux.pruneChunksIfNeeded();
				updateProps(state);
				redrawAuxFromState(state);
			}
			return true;
		}

		if (hideChunkBtn) {
			const id = hideChunkBtn.getAttribute("data-chunk-hide");
			if (id) {
				aux.toggleChunkHidden(id);
				updateProps(state);
				redrawAuxFromState(state);
			}
			return true;
		}

		if (jumpChunkBtn) {
			const mid = Number(jumpChunkBtn.getAttribute("data-chunk-mid"));
			if (Number.isFinite(mid)) {
				setCursorS(mid, { fit: true });
			}
			return true;
		}

		if (copyChunkJsonBtn) {
			const id = copyChunkJsonBtn.getAttribute("data-chunk-copy-json");
			if (id) copyChunkJson(id);
			return true;
		}

		return true;
	}

	function handlePinActions(target, state, ev) {
		const jumpBtn = target.closest("[data-pin-jump]");
		const unpinBtn = target.closest("[data-pin-unpin]") || target.closest("[data-pin-remove]");

		const key =
			jumpBtn?.getAttribute?.("data-pin-jump") ??
			unpinBtn?.getAttribute?.("data-pin-unpin") ??
			unpinBtn?.getAttribute?.("data-pin-remove") ??
			null;

		if (!key) return false;

		ev.preventDefault?.();
		ev.stopPropagation?.();

		const parsed = parseIdSlotKey(key);
		if (!parsed) return true;

		const rpId = parsed.id;
		const slot = parsed.slot;

		if (unpinBtn) {
			if (store.actions?.unpinRouteProject) {
				store.actions.unpinRouteProject({ rpId, slot });
			} else if (store.actions?.setPins) {
				const pins = Array.isArray(state.view_pins) ? state.view_pins : [];
				const next = pins.filter((p) => !(p?.rpId === rpId && (p?.slot ?? "right") === slot));
				store.actions.setPins(next);
			} else {
				ui?.logInfo?.(t("pin_unpin_missing_action"));
			}
			return true;
		}

		store.actions?.setActiveRouteProject?.(rpId);
		store.actions?.setActiveSlot?.(slot);
		mirrorQuickHooksFromActive(store);
		return true;
	}

	function handlePropsPanelClick(ev) {
		const target = ev?.target;
		if (!target || typeof target.closest !== "function") return;

		const state = store.getState?.() ?? {};

		if (handleChunkActions(target, state, ev)) return;
		if (handlePinActions(target, state, ev)) return;
	}

	function wirePropsPanelOnce() {
		if (propsElement.__ufAIM_propsWired) return;
		propsElement.__ufAIM_propsWired = true;
		propsElement.addEventListener("click", handlePropsPanelClick);
	}

	return {
		updateProps,
		wirePropsPanelOnce,
		handlePropsPanelClick,
	};
}
