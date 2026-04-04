// app/view/overlays/spotView.js
//
// SPOT View
//
// Rolle:
// - rendert ausschließlich den aktuellen SPOT-Zustand (SpotUiState)
// - zeigt alle visualisierbaren Objekte (SPOT-Objects)
//
// Grundprinzip:
// - Wenn ein Objekt im SPOT ist, ist es visualisierbar
// - Der View erzeugt keine Daten, keine Kandidaten, keine Interpretation
//
// Input:
// - SpotUiState (vom Master / SpotService)
// - optional UI-Kontext (z. B. focus, pins) – nur für Darstellung
//
// Output:
// - reine DOM-Darstellung
// - User-Intents (activate, pin, decision)
//
// NICHT:
// - keine Import-Logik
// - keine Parser-/Alignment-Logik
// - keine lokale Schattenwelt (keine eigenen Kandidaten, keine Ableitungen)
//
// Ziel:
// Dumb Renderer für SPOT-Objects.
// Alle fachliche Wahrheit liegt außerhalb.
//
// SPOT view
// - renders a simple alignment-candidate board
// - no grouping
// - no slot/base editing
// - no importSession logic
//
// @baustelle [I18N_STRICT]
// No user-visible text literals should be introduced here.
// All visible labels / buttons / hints must pass through t(...).
//
// Input shape expected from buildSpotUiState():
// {
//   rows: [
//     {
//       spotId,
//       label,
//       kind,
//       outcome,
//       outcomeConfidence,
//       sourceLabel,
//       files,
//       missing,
//       notes
//     }
//   ],
//   stats: {
//     total,
//     filesSeen
//   }
// }

import { formatPct01 } from "@src/utils/helpers.js";
import { escapeHtml } from "@app/utils/appHelpers.js";
import { t } from "@app/i18n/strings.js";

function decisionKey(spotId) {
	return String(spotId ?? "");
}

function isPinned(storeState, spotId) {
	const pins = Array.isArray(storeState?.view_pins) ? storeState.view_pins : [];
	return pins.some((p) => String(p?.rpId ?? "") === String(spotId ?? ""));
}

function renderSpotRow(row, { activeObjectId, decisions, storeState }) {
	const spotId = String(row?.spotId ?? "");
	const active = activeObjectId === spotId;
	const pinned = isPinned(storeState, spotId);

	const decision = decisions[decisionKey(spotId)] ?? null;

	const files = Array.isArray(row?.files) ? row.files : [];
	const missing = Array.isArray(row?.missing) ? row.missing : [];
	const notes = Array.isArray(row?.notes) ? row.notes : [];

	const decisionBadge = decision
		? `<span class="spot__badge spot__badge--${escapeHtml(decision)}">${escapeHtml(decision)}</span>`
		: "";

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
				${decisionBadge}
			</div>

			<div class="spot__meta">
				<span>${escapeHtml(t("spot_meta_kind"))}=${escapeHtml(row?.kind ?? "alignment")}</span>
				<span>${escapeHtml(t("spot_meta_outcome"))}=${escapeHtml(row?.outcome ?? "candidate")}</span>
				<span>${escapeHtml(t("spot_meta_conf"))}=${escapeHtml(formatPct01(row?.outcomeConfidence ?? 0))}</span>
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
				? `<div class="spot__notes">${escapeHtml(notes.slice(0, 3).join(" · "))}</div>`
				: ``}
		</div>
	</div>`;
}

export function renderSpotHtml({ spotState, storeState }) {
	const rows = Array.isArray(spotState?.rows) ? spotState.rows : [];
	const total = Number(spotState?.stats?.total ?? rows.length);
	const filesSeen = Number(spotState?.stats?.filesSeen ?? 0);

	const header = `${t("panel_spot")} · ${t("spot_header_alignments")}=${total} ${t("spot_header_files")}=${filesSeen}`;

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
