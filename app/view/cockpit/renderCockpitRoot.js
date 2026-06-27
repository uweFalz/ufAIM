// app/view/cockpit/renderCockpitRoot.js
//
// Explicit Cockpit DOM write boundary.
//
// Owns:
// - writing rendered Cockpit markup into the Cockpit root
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

export function renderCockpitRoot(root, uiState = {}) {
	if (!root) return;

	root.innerHTML = renderCockpitHtml(uiState);
}
