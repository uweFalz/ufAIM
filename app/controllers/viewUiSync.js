// app/controllers/viewUiSync.js
//
// Small UI sync helpers for ViewController.
// DOM/UI only. No store.subscribe here.

import { t } from "@app/i18n/strings.js";
import { clamp01 } from "@utils/helpers.js";
import { escapeHtml } from "@app/utils/appHelpers.js";
import { getWorkspacePrimaryId } from "@src/shared/runtime/workspaceSelectionAccess.js";

import { normalizePins } from "@app/controllers/viewGeometry.js";
import { renderBandsText, renderSectionText } from "@app/controllers/viewTextRender.js";

export function syncRouteProjectSelect(ui, state) {
	const ids = Object.keys(state.routeProjects ?? {}).sort((a, b) => a.localeCompare(b));
	ui.setRouteProjectOptions?.(ids, getWorkspacePrimaryId(state));
}

export function syncSpotBaseIdDatalist(state) {
	const el = document.getElementById("spot-baseIds");
	if (!el) return;

	const ids = Object.keys(state.routeProjects ?? {}).sort((a, b) => a.localeCompare(b));
	const html = ids.map((id) => `<option value="${escapeHtml(id)}">`).join("");

	if (el.innerHTML !== html) {
		el.innerHTML = html;
	}
}

export function syncCursorInput(ui, state) {
	const cursorEl = ui.elements?.cursorSInput;
	if (cursorEl && document.activeElement !== cursorEl) {
		ui.setCursorSInputValue?.(state.cursor?.s ?? 0);
	}
}

export function syncOverlays(ui, state) {
	ui.setBoardBandsText?.(renderBandsText(state));
}

export function syncSectionBoard(ui, state, sectionInfo) {
	ui.setBoardSectionText?.(renderSectionText(state, sectionInfo));
}

export function syncPinsBadge(ui, state) {
	const pinsNow = normalizePins(state.view_pins);
	ui.setPinsInfoText?.(t("pins_info", { count: pinsNow.length }));
}

export function syncSpotPanel(ui, state) {
	ui.refreshSpot?.(state);
}

export function syncTransitionEditorControls(state) {
	const w1 = document.getElementById("w1");
	const w2 = document.getElementById("w2");
	const famSel = document.getElementById("familySel");
	const preset = document.getElementById("preset");

	if (famSel && document.activeElement !== famSel) famSel.value = state.te_family ?? "berlinish";
	if (preset && document.activeElement !== preset) preset.value = state.te_preset ?? "bloss";

	if (w1 && document.activeElement !== w1) {
		w1.value = String(Math.round(clamp01(state.te_w1 ?? 0.25) * 1000));
	}
	if (w2 && document.activeElement !== w2) {
		w2.value = String(Math.round(clamp01(state.te_w2 ?? 0.75) * 1000));
	}
}
