// app/view/overlays/spotView.js
//
// SPOT View (canonical only)
//
// Rolle:
// - rendert ausschließlich den aktuellen SPOT-Zustand (SpotUiState)
// - zeigt NUR kanonische SPOT-Objects
// - erzeugt nur User-Intents (activate, pin, decision)
//
// KEIN:
// - Import-/Kandidaten-Logik
// - promotable / Dateien / relationCandidates
// - Schattenwelt
// - Geometrie

import { formatPct01 } from "@utils/helpers.js";
import { escapeHtml } from "@app/utils/appHelpers.js";
import { t } from "@app/i18n/strings.js";
import {
	getWorkspaceContextIds,
	getWorkspacePrimaryId,
} from "@src/shared/runtime/workspaceSelectionAccess.js";

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------

function decisionKey(spotId) {
	return String(spotId ?? "");
}

function isPinned(storeState, spotId) {
	const contextIds = getWorkspaceContextIds(storeState);
	return contextIds.includes(String(spotId ?? ""));
}

function statusClass(status) {
	switch (String(status ?? "")) {
		case "focused": return "spot__badge--focused";
		case "ok": return "spot__badge--promotable";
		case "incomplete": return "spot__badge--incomplete";
		default: return "spot__badge--neutral";
	}
}

function statusLabel(status) {
	switch (String(status ?? "")) {
		case "focused": return t("spot_status_focused");
		case "ok": return t("spot_status_ok");
		case "incomplete": return t("spot_status_incomplete");
		default: return t("spot_status_unknown");
	}
}

function renderBadge(label, className = "") {
	return `<span class="spot__badge ${escapeHtml(className)}">${escapeHtml(label)}</span>`;
}

// ------------------------------------------------------------
// row rendering
// ------------------------------------------------------------

function renderSpotRow(row, { activeObjectId, decisions, storeState }) {
	const spotId = String(row?.spotId ?? "");
	const active = activeObjectId === spotId;
	const pinned = isPinned(storeState, spotId);

	const decision = decisions[decisionKey(spotId)] ?? null;

	const status = String(row?.status ?? "unknown");

	const decisionBadge = decision
		? renderBadge(decision, `spot__badge--${escapeHtml(decision)}`)
		: "";

	const statusBadge = renderBadge(
		statusLabel(status),
		statusClass(status)
	);

	return `
	<div class="spot__row ${active ? "is-active" : ""}">
		<div class="spot__btns">
			<button class="btn btn--ghost btn--xs" data-spot-activate="${escapeHtml(spotId)}">${escapeHtml(t("spot_activate"))}</button>
			<button class="btn btn--ghost btn--xs" data-spot-pin="${escapeHtml(spotId)}">${escapeHtml(t(pinned ? "spot_unpin" : "spot_pin"))}</button>

			<button class="btn btn--ghost btn--xs" data-spot-decision="accept" data-spot-key="${escapeHtml(spotId)}">${escapeHtml(t("spot_decision_accept"))}</button>
			<button class="btn btn--ghost btn--xs" data-spot-decision="defer" data-spot-key="${escapeHtml(spotId)}">${escapeHtml(t("spot_decision_defer"))}</button>
			<button class="btn btn--ghost btn--xs" data-spot-decision="ignore" data-spot-key="${escapeHtml(spotId)}">${escapeHtml(t("spot_decision_ignore"))}</button>
			<button class="btn btn--ghost btn--xs" data-spot-decision="" data-spot-key="${escapeHtml(spotId)}">×</button>
		</div>

		<div class="spot__main">
			<div class="spot__title">
				<strong>${escapeHtml(row?.label ?? spotId)}</strong>
				${statusBadge}
				${decisionBadge}
			</div>

			<div class="spot__meta">
				<span>type=${escapeHtml(row?.type ?? "alignment")}</span>
				<span>status=${escapeHtml(statusLabel(status))}</span>
			</div>

			<div class="spot__meta">
				<span>confidence=${escapeHtml(formatPct01(row?.confidence ?? 0))}</span>
				<span>sparse=${escapeHtml(row?.hasSparse ? "yes" : "no")}</span>
				<span>crs=${escapeHtml(row?.hasHorizontalCrs ? "yes" : "no")}</span>
			</div>

			${row?.sourceLabel
				? `<div class="spot__source">${escapeHtml(row.sourceLabel)}</div>`
				: ``}
		</div>
	</div>`;
}

// ------------------------------------------------------------
// header
// ------------------------------------------------------------

function buildHeader(spotState, rows) {
	const stats = spotState?.stats ?? {};
	const total = Number(stats.total ?? rows.length);
	const activeCount = Number(stats.activeCount ?? 0);

	return `SPOT · Objekte=${total} · aktiv=${activeCount}`;
}

// ------------------------------------------------------------
// main render
// ------------------------------------------------------------

export function renderSpotHtml({ spotState, storeState }) {
	const rows = Array.isArray(spotState?.rows) ? spotState.rows : [];
	const header = buildHeader(spotState, rows);

	if (!rows.length) {
		return `<div class="spot">
			<div class="spot__head">${escapeHtml(header)}</div>
			<div class="spot__empty">SPOT leer – noch keine aufgenommenen Objekte.</div>
		</div>`;
	}

	const activeObjectId = getWorkspacePrimaryId(storeState);

	const decisions = storeState?.spot_decisions ?? {};

	const body = rows
		.map((row) =>
			renderSpotRow(row, {
				activeObjectId,
				decisions,
				storeState,
			})
		)
		.join("");

	return `<div class="spot">
		<div class="spot__head">${escapeHtml(header)}</div>
		<div class="spot__list">${body}</div>
	</div>`;
}

// ------------------------------------------------------------
// view wrapper
// ------------------------------------------------------------

export function makeSpotView({ rootEl } = {}) {
	if (!rootEl) throw new Error("spotView: missing rootEl");

	let _spotState = null;
	let _lastSpotHtml = null;

	function setSpotState(spotState) {
		_spotState = spotState ?? null;
	}

	function getSpotState() {
		return _spotState;
	}

	function setSpotHtml(html) {
		const safe =
			html == null || html === ""
				? `<div class="spot"><div class="spot__empty">SPOT leer</div></div>`
				: String(html);

		if (safe === _lastSpotHtml) return;
		_lastSpotHtml = safe;
		rootEl.innerHTML = safe;
	}

	function refresh(storeState) {
		setSpotHtml(
			renderSpotHtml({
				spotState: _spotState,
				storeState,
			})
		);
	}

	function wireActions({
		onActivate,
		onTogglePin,
		onDecision,
	} = {}) {
		rootEl.addEventListener("click", (ev) => {
			const btnActivate = ev.target.closest("[data-spot-activate]");
			if (btnActivate) {
				onActivate?.(String(btnActivate.dataset.spotActivate ?? ""));
				return;
			}

			const btnPin = ev.target.closest("[data-spot-pin]");
			if (btnPin) {
				onTogglePin?.(String(btnPin.dataset.spotPin ?? ""));
				return;
			}

			const btnDecision = ev.target.closest("[data-spot-decision]");
			if (btnDecision) {
				onDecision?.({
					decision: String(btnDecision.dataset.spotDecision ?? ""),
					key: String(btnDecision.dataset.spotKey ?? ""),
				});
			}
		});
	}

	return {
		setSpotState,
		getSpotState,
		setSpotHtml,
		refresh,
		wireActions,
		renderSpotHtml,
	};
}
