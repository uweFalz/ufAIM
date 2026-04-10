// app/view/overlays/spotView.js
//
// SPOT View
//
// Rolle:
// - rendert ausschließlich den aktuellen SPOT-Zustand (SpotUiState)
// - zeigt kanonische SPOT-Objects als reine DOM-Darstellung
// - erzeugt nur User-Intents (activate, pin, decision)
//
// NICHT:
// - keine Import-Logik
// - keine Parser-/Alignment-Logik
// - keine lokale Schattenwelt
// - keine Geometrieberechnung

import { formatPct01 } from "@utils/helpers.js";
import { escapeHtml } from "@app/utils/appHelpers.js";
import { t } from "@app/i18n/strings.js";

function decisionKey(spotId) {
	return String(spotId ?? "");
}

function isPinned(storeState, spotId) {
	const pins = Array.isArray(storeState?.view_pins) ? storeState.view_pins : [];
	return pins.some((p) => String(p?.rpId ?? "") === String(spotId ?? ""));
}

function statusClass(status) {
	switch (String(status ?? "")) {
		case "focused": return "spot__badge--focused";
		case "promotable": return "spot__badge--promotable";
		case "incomplete": return "spot__badge--incomplete";
		case "parameter-only": return "spot__badge--parameter";
		default: return "spot__badge--neutral";
	}
}

function statusLabel(status) {
	switch (String(status ?? "")) {
		case "focused": return t("spot_status_focused");
		case "promotable": return t("spot_status_promotable");
		case "incomplete": return t("spot_status_incomplete");
		case "parameter-only": return t("spot_status_parameter_only");
		default: return t("spot_status_unknown");
	}
}

function reasonLabel(reasonCode) {
	switch (String(reasonCode ?? "")) {
		case "OK": return t("spot_reason_ok");
		case "SPARSE_MISSING": return t("spot_reason_sparse_missing");
		case "CRS_MISSING": return t("spot_reason_crs_missing");
		default: return t("spot_reason_unknown");
	}
}

function renderBadge(label, className = "") {
	return `<span class="spot__badge ${escapeHtml(className)}">${escapeHtml(label)}</span>`;
}

function renderSpotRow(row, { activeObjectId, decisions, storeState }) {
	const spotId = String(row?.spotId ?? "");
	const active = activeObjectId === spotId;
	const pinned = isPinned(storeState, spotId);

	const decision = decisions[decisionKey(spotId)] ?? null;

	const files = Array.isArray(row?.files) ? row.files : [];
	const missing = Array.isArray(row?.missing) ? row.missing : [];
	const notes = Array.isArray(row?.notes) ? row.notes : [];

	const status = String(row?.status ?? "unknown");
	const reasonCode = String(row?.reasonCode ?? "UNKNOWN");

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
			<button class="btn btn--ghost btn--xs" data-spot-decision="" data-spot-key="${escapeHtml(spotId)}" title="${escapeHtml(t("spot_decision_clear_title"))}">×</button>
		</div>

		<div class="spot__main">
			<div class="spot__title">
				<strong>${escapeHtml(row?.label ?? spotId ?? t("spot_alignment_fallback"))}</strong>
				${statusBadge}
				${decisionBadge}
			</div>

			<div class="spot__meta">
				<span>${escapeHtml(t("spot_meta_type"))}=${escapeHtml(row?.type ?? "alignment")}</span>
				<span>${escapeHtml(t("spot_meta_status"))}=${escapeHtml(statusLabel(status))}</span>
				<span>${escapeHtml(t("spot_meta_reason"))}=${escapeHtml(reasonLabel(reasonCode))}</span>
			</div>

			<div class="spot__meta">
				<span>${escapeHtml(t("spot_meta_outcome"))}=${escapeHtml(row?.outcome ?? "spot")}</span>
				<span>${escapeHtml(t("spot_meta_conf"))}=${escapeHtml(formatPct01(row?.outcomeConfidence ?? 0))}</span>
				<span>${escapeHtml(t("spot_meta_sparse"))}=${escapeHtml(row?.hasSparse ? t("spot_yes") : t("spot_no"))}</span>
				<span>${escapeHtml(t("spot_meta_crs"))}=${escapeHtml(row?.hasHorizontalCrs ? t("spot_yes") : t("spot_no"))}</span>
			</div>

			${row?.sourceLabel
				? `<div class="spot__source">${escapeHtml(t("spot_meta_source"))}: ${escapeHtml(row.sourceLabel)}</div>`
				: ``}

			${files.length
				? `<div class="spot__meta">${escapeHtml(t("spot_meta_files"))}=${escapeHtml(files.join(" · "))}</div>`
				: ``}

			${missing.length
				? `<div class="spot__warn">${escapeHtml(t("spot_meta_missing"))}: ${escapeHtml(missing.join(", "))}</div>`
				: ``}

			${notes.length
				? `<div class="spot__notes">${escapeHtml(notes.slice(0, 4).join(" · "))}</div>`
				: ``}
		</div>
	</div>`;
}

function buildHeader(spotState, rows) {
	const stats = spotState?.stats ?? {};
	const total = Number(stats.total ?? rows.length);
	const filesSeen = Number(stats.filesSeen ?? 0);
	const promotableCount = Number(stats.promotableCount ?? 0);
	const activeCount = Number(stats.activeCount ?? 0);

	return `${t("panel_spot")} · ${t("spot_header_alignments")}=${total} · ${t("spot_header_files")}=${filesSeen} · ${t("spot_header_promotable")}=${promotableCount} · ${t("spot_header_active")}=${activeCount}`;
}

export function renderSpotHtml({ spotState, storeState }) {
	const rows = Array.isArray(spotState?.rows) ? spotState.rows : [];
	const header = buildHeader(spotState, rows);

	if (!rows.length) {
		return `<div class="spot">
			<div class="spot__head">${escapeHtml(header)}</div>
			<div class="spot__empty">${escapeHtml(t("spot_empty"))}</div>
		</div>`;
	}

	const activeObjectId =
		storeState?.focus?.objectId ??
		storeState?.activeRouteProjectId ??
		null;

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
				? `<div class="spot"><div class="spot__empty">${escapeHtml(t("spot_empty"))}</div></div>`
				: String(html);

		if (safe === _lastSpotHtml) return;
		_lastSpotHtml = safe;
		rootEl.innerHTML = safe;
	}

	function setSpotText(text) {
		rootEl.textContent = String(text ?? "");
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
		setSpotText,
		refresh,
		wireActions,
		renderSpotHtml,
		renderSpotState: renderSpotHtml,
	};
}
