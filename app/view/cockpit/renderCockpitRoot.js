// app/view/cockpit/renderCockpitRoot.js
//
// Explicit Cockpit DOM write boundary.
//
// Owns:
// - writing rendered Cockpit markup into the Cockpit root
// - labelling its existing toolbar entry when imports await object selection
//
// Does NOT own:
// - Cockpit state
// - controller logic
// - application state
// - import/SPOT/projection logic
//
// Transition state:
// - renderCockpitHtml remains a string renderer temporarily
// - this file fences the only allowed Cockpit innerHTML write

import { renderCockpitHtml } from "./renderCockpitHtml.js";
import { t } from "@app/i18n/strings.js";

export function renderCockpitRoot(root, uiState = {}) {
	if (!root) return;

	root.innerHTML = renderCockpitHtml(uiState);

	// A collapsed Cockpit must not conceal the next step after a real import.
	// This only labels the existing toggle: no opening or promotion is implied.
	const entry = root.ownerDocument?.getElementById?.("btnCockpit");
	if (!entry) return;
	const hasCandidates = Array.isArray(uiState?.collections?.importRows)
		&& uiState.collections.importRows.length > 0;
	const hasActiveObject = uiState?.scene?.mode === "spot" && Boolean(uiState.scene.objectId);
	const key = hasCandidates && !hasActiveObject ? "panel_cockpit_import" : "panel_cockpit";
	entry.setAttribute("data-i18n", key);
	entry.setAttribute("data-i18n-title", key);
	entry.setAttribute("data-i18n-aria-label", key);
	entry.textContent = t(key);
	entry.setAttribute("title", t(key));
	entry.setAttribute("aria-label", t(key));
}
