// app/view/spotView.js
//
// SPOT / Grabbeltisch view
// - owns local spot UI state
// - renders SPOT html
// - writes SPOT html into its root element
//
// No store ownership here.
// No parser logic here.
// No importSession logic here.

import { escapeHtml } from "../utils/helpers.js";

function formatPct01(x) {
	const v = Number(x);
	if (!Number.isFinite(v)) return "—";
	return `${Math.round(v * 100)}%`;
}

function pinKey(rpId, slot) {
	return `${rpId}::${slot ?? "right"}`;
}

function decisionKey(spotId, slot) {
	return `${spotId}::${slot ?? "right"}`;
}

function isPinned(storeState, rpId, slot) {
	const pins = Array.isArray(storeState?.view_pins) ? storeState.view_pins : [];
	const key = pinKey(rpId, slot);
	return pins.some((p) => `${p?.rpId ?? ""}::${p?.slot ?? ""}` === key);
}

function renderSpotRow(r, { activeRp, activeSlot, decisions, storeState }) {

	const rpId = r.groupKey;
	const slot = r.slotEffective ?? r.suggestedSlot ?? r.slotHint ?? "right";
	const spotId = r.spotId ?? rpId;

	const active = (rpId === activeRp) && (slot === activeSlot);
	const pinned = isPinned(storeState, rpId, slot);

	const keyPin = pinKey(rpId, slot);
	const keyDec = decisionKey(spotId, slot);

	const decision = decisions[keyDec] ?? decisions[keyPin] ?? null;

	const missing = Array.isArray(r.missing) && r.missing.length
	? r.missing.join(", ")
	: "";

	const notes = Array.isArray(r.notes) && r.notes.length
	? r.notes.slice(0, 2).join(" · ")
	: "";

	const decisionBadge = decision
	? `<span class="spot__badge spot__badge--${escapeHtml(decision)}">${escapeHtml(decision)}</span>`
	: ``;

	const sourceLabel = r.sourceLabel ?? "";
	
	const conflictBadge = r.baseConflict
	? `<span class="spot__badge spot__badge--warn">conflict</span>`
	: ``;

	return `
	<div class="spot__row ${active ? "is-active" : ""}">
	
	<div class="spot__btns">
	<button class="btn btn--ghost btn--xs" data-spot-activate="${escapeHtml(keyPin)}">Activate</button>
	<button class="btn btn--ghost btn--xs" data-spot-pin="${escapeHtml(keyPin)}">${pinned ? "Unpin" : "Pin"}</button>

	<button class="btn btn--ghost btn--xs" data-spot-decision="accept" data-spot-key="${escapeHtml(keyDec)}">Accept</button>
	<button class="btn btn--ghost btn--xs" data-spot-decision="defer"  data-spot-key="${escapeHtml(keyDec)}">Defer</button>
	<button class="btn btn--ghost btn--xs" data-spot-decision="ignore" data-spot-key="${escapeHtml(keyDec)}">Ignore</button>
	<button class="btn btn--ghost btn--xs" data-spot-decision="" data-spot-key="${escapeHtml(keyDec)}" title="Clear decision">×</button>
	</div>

	<div class="spot__main">

	<div class="spot__title">
	<strong>${escapeHtml(r.groupKey)}</strong>
	${decisionBadge}
	${conflictBadge}
	</div>

	<div class="spot__meta">
	<span>match=${escapeHtml(r.matchLabel ?? "unknown")}</span>
	<span>outcome=${escapeHtml(r.outcome ?? "candidate")}</span>
	<span>conf=${escapeHtml(formatPct01(r.outcomeConfidence ?? r.confidence ?? 0))}</span>
	<span>slot=${escapeHtml(slot)}</span>
	</div>

	<div class="spot__meta">
	<span>files=${escapeHtml((r.files ?? []).length)}</span>
	<span>age=${escapeHtml(r.ageLabel ?? "—")}</span>
	<span>base=${escapeHtml(r.baseIdEffective ?? r.suggestedBaseId ?? r.groupKey ?? "")}</span>
	</div>

	${sourceLabel
	? `<div class="spot__source">source: ${escapeHtml(sourceLabel)}</div>`
	: ``}

	<div class="spot__edit">
	<label class="spot__editField">
	base
	<input
	class="spot__baseIdInput"
	type="text"
	list="spot-baseIds"
	value="${escapeHtml(r.baseIdEffective ?? r.suggestedBaseId ?? r.groupKey ?? "")}"
	data-spot-base-change="${escapeHtml(r.groupKey)}"
	/>
	</label>

	<label class="spot__editField">
	slot
	<select
	class="spot__slotSelect"
	data-spot-slot-change="${escapeHtml(r.groupKey)}"
	>
	<option value="right" ${slot === "right" ? "selected" : ""}>right</option>
	<option value="left"  ${slot === "left"  ? "selected" : ""}>left</option>
	<option value="km"    ${slot === "km"    ? "selected" : ""}>km</option>
	</select>
	</label>
	</div>

	${missing ? `<div class="spot__warn">missing: ${escapeHtml(missing)}</div>` : ``}
	${notes ? `<div class="spot__notes">${escapeHtml(notes)}</div>` : ``}

	</div>
	</div>`;
}

function groupRowsByBaseId(rows) {
	const groups = new Map();

	for (const r of rows) {
		const baseId =
		r.baseIdEffective ??
		r.baseIdUser ??
		r.suggestedBaseId ??
		r.groupKey ??
		"";

		if (!groups.has(baseId)) {
			groups.set(baseId, []);
		}

		groups.get(baseId).push(r);
	}

	return groups;
}

function slotSortRank(slot) {
	switch (String(slot ?? "")) {
		case "km": return 0;
		case "right": return 1;
		case "left": return 2;
		default: return 9;
	}
}

export function renderSpotHtml({ spotState, storeState }) {
	const rows = Array.isArray(spotState?.rows) ? spotState.rows : [];

	const header = [
	`SPOT (Grabbeltisch)`,
	`groups=${spotState?.stats?.groupsTotal ?? rows.length} files=${spotState?.stats?.filesSeen ?? "—"}`,
	].join(" · ");

	if (!rows.length) {
		return `<div class="spot">
		<div class="spot__head">${escapeHtml(header)}</div>
		<div class="spot__empty">(drop files to create spots)</div>
		</div>`;
	}

	const activeRp = storeState?.activeRouteProjectId ?? null;
	const activeSlot = storeState?.activeSlot ?? "right";
	const decisions = storeState?.spot_decisions ?? {};

	const groups = groupRowsByBaseId(rows);

	const body = Array.from(groups.entries())
	.sort(([a], [b]) => String(a).localeCompare(String(b)))
	.map(([baseId, gRows]) => {

		const sortedRows = [...gRows].sort((a, b) => {
			const slotA = a.slotEffective ?? a.suggestedSlot ?? a.slotHint ?? "right";
			const slotB = b.slotEffective ?? b.suggestedSlot ?? b.slotHint ?? "right";

			const dSlot = slotSortRank(slotA) - slotSortRank(slotB);
			if (dSlot !== 0) return dSlot;

			const confA = Number(a.outcomeConfidence ?? a.confidence ?? 0);
			const confB = Number(b.outcomeConfidence ?? b.confidence ?? 0);
			if (confB !== confA) return confB - confA;

			return String(a.groupKey ?? "").localeCompare(String(b.groupKey ?? ""));
		});

		const rowsHtml = sortedRows
		.map((r) => renderSpotRow(r, {
			activeRp,
			activeSlot,
			decisions,
			storeState,
		}))
		.join("");

		return `
		<div class="spot__group">
		<div class="spot__groupHead">
		<strong>${escapeHtml(baseId)}</strong>
		<span class="spot__groupCount">${gRows.length}</span>
		</div>
		${rowsHtml}
		</div>`;
	}).join("");

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
		const s = spotState ?? null;
		if (!s) {
			_spotState = null;
			return;
		}

		const rows0 = Array.isArray(s.rows) ? s.rows : [];
		const rows = rows0.map((r) => {
			if (!r) return r;
			const groupKey = r.groupKey ?? r.rpId ?? r.baseId ?? "";
			const spotId = String(r.spotId ?? groupKey);
			return { ...r, spotId };
		});

		_spotState = { ...s, rows };
	}

	function getSpotState() {
		return _spotState;
	}

	function setSpotHtml(html) {
		const safe = (html == null || html === "")
		? `<div class="spot"><div class="spot__empty">(drop files to create spots)</div></div>`
		: String(html);

		if (safe === _lastSpotHtml) return;
		_lastSpotHtml = safe;
		rootEl.innerHTML = safe;
	}

	function setSpotText(text) {
		rootEl.textContent = String(text ?? "");
	}

	function refresh(storeState) {
		setSpotHtml(renderSpotHtml({
			spotState: _spotState,
			storeState,
		}));
	}

	function wireActions({
		onActivate,
		onTogglePin,
		onDecision,
		onSlotChange,
		onBaseIdChange,
	} = {}) {

		rootEl.addEventListener("change", (ev) => {
			const baseInput = ev.target.closest("[data-spot-base-change]");
			if (baseInput) {
				onBaseIdChange?.({
					groupKey: String(baseInput.dataset.spotBaseChange ?? ""),
					baseId: String(baseInput.value ?? "").trim(),
				});
				return;
			}

			const slotSelect = ev.target.closest("[data-spot-slot-change]");
			if (slotSelect) {
				onSlotChange?.({
					groupKey: String(slotSelect.dataset.spotSlotChange ?? ""),
					slot: String(slotSelect.value ?? "right"),
				});
				return;
			}
		});

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
