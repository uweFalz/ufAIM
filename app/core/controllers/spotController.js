// app/core/controllers/spotController.js
//
// Minimal controller for Grabbeltisch:
// - reads rows from importSession.getUIState()
// - wires slot/baseId editors
// - rerenders on edit
//
// No store writes here.
// No import apply here.
// Purely edits ImportSession state.

import { escapeHtml } from "@app/utils/helpers.js";

//
// ...
//
export function makeGrabbeltischController({ importSession, rootEl } = {}) {
	if (!importSession?.getUIState) {
		throw new Error("GrabbeltischController: missing importSession.getUIState");
	}
	if (!importSession?.setGroupSlot) {
		throw new Error("GrabbeltischController: missing importSession.setGroupSlot");
	}
	if (!importSession?.setGroupBaseId) {
		throw new Error("GrabbeltischController: missing importSession.setGroupBaseId");
	}
	if (!rootEl) {
		throw new Error("GrabbeltischController: missing rootEl");
	}

	function renderRow(row) {
		const slotValue = row.slotEffective ?? row.suggestedSlot ?? "right";
		const baseIdValue = row.baseIdEffective ?? row.suggestedBaseId ?? "";

		return `
		<div class="grab-row" data-group-key="${escapeHtml(row.groupKey)}">
		<div class="grab-row-main">
		<div class="grab-row-title">
		<strong>${escapeHtml(row.groupKey)}</strong>
		</div>

		<div class="grab-row-meta">
		<span class="grab-chip">match: ${escapeHtml(row.matchLabel ?? "unknown")}</span>
		<span class="grab-chip">outcome: ${escapeHtml(row.outcome ?? "candidate")}</span>
		<span class="grab-chip">files: ${escapeHtml((row.files ?? []).length)}</span>
		</div>
		</div>

		<div class="grab-row-edit">
		<label>
		<span>Slot</span>
		<select data-role="slot">
		<option value="right" ${slotValue === "right" ? "selected" : ""}>right</option>
		<option value="left"  ${slotValue === "left" ? "selected" : ""}>left</option>
		<option value="km"    ${slotValue === "km" ? "selected" : ""}>km</option>
		</select>
		</label>

		<label>
		<span>BaseId</span>
		<input
		data-role="baseId"
		type="text"
		value="${escapeHtml(baseIdValue)}"
		placeholder="${escapeHtml(row.suggestedBaseId ?? "")}"
		/>
		</label>
		</div>
		</div>
		`;
	}

	function renderEmpty() {
		rootEl.innerHTML = `
		<div class="grab-empty">
		Noch keine Import-Gruppen vorhanden.
		</div>
		`;
	}

	function wireEditors() {
		rootEl.querySelectorAll(".grab-row").forEach((rowEl) => {
			const groupKey = String(rowEl.dataset.groupKey ?? "");
			if (!groupKey) return;

			const slotEl = rowEl.querySelector('[data-role="slot"]');
			const baseIdEl = rowEl.querySelector('[data-role="baseId"]');

			slotEl?.addEventListener("change", () => {
				importSession.setGroupSlot(groupKey, slotEl.value);
				render();
			});

			baseIdEl?.addEventListener("blur", () => {
				importSession.setGroupBaseId(groupKey, baseIdEl.value);
				render();
			});

			baseIdEl?.addEventListener("keydown", (ev) => {
				if (ev.key !== "Enter") return;
				importSession.setGroupBaseId(groupKey, baseIdEl.value);
				render();
			});
		});
	}

	function render(uiOpts = {}) {
		const uiState = importSession.getUIState(uiOpts);
		const rows = Array.isArray(uiState?.rows) ? uiState.rows : [];

		if (!rows.length) {
			renderEmpty();
			return;
		}

		rootEl.innerHTML = `
		<div class="grab-head">
		<div><strong>Import-Gruppen</strong></div>
		<div class="grab-stats">
		<span>groups: ${rows.length}</span>
		</div>
		</div>

		<div class="grab-list">
		${rows.map(renderRow).join("\n")}
		</div>
		`;

		wireEditors();
	}

	return {
		render,
		refresh: render,
	};
}
