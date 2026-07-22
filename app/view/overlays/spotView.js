import { escapeHtml } from "@app/utils/appHelpers.js";
import { t } from "@app/i18n/strings.js";
import { getWorkspacePrimaryId } from "@src/shared/runtime/workspaceSelectionAccess.js";

const STYLE_ID = "spot-workspace-style";
function ensureStylesheet() { if (document.getElementById(STYLE_ID)) return; const link = document.createElement("link"); link.id = STYLE_ID; link.rel = "stylesheet"; link.href = "/app/styles/spotWorkspace.css"; document.head.append(link); }
function typeLabel(type) {
	const known = new Set(["alignment", "cant", "profile", "relation", "staequation"]);
	const normalized = String(type ?? "object").toLowerCase();
	return t(`spot_workspace_type_${known.has(normalized) ? normalized : "object"}`);
}
function spatialLabel(mode) { return t(mode === "geographic" ? "spot_workspace_geographic" : "spot_workspace_local"); }
function statusLabel(value) {
	const status = String(value ?? "").toLowerCase();
	if (status.includes("geographic") || status.includes("supported")) return t("spot_workspace_geographic");
	if (status.includes("local")) return t("spot_workspace_local");
	return t("spot_workspace_unresolved");
}
function lifecycleLabel(value) {
	const status = String(value ?? "").toLowerCase();
	if (status === "active") return t("spot_workspace_lifecycle_active");
	if (status === "removed") return t("spot_workspace_lifecycle_removed");
	return t("spot_workspace_not_recorded");
}
function warningLabel(value) {
	const key = String(value ?? "").trim();
	const known = { missingCrs: "spot_workspace_warning_crs", missing_crs_for_gnd: "spot_workspace_warning_crs", no_crs_context: "spot_workspace_warning_crs", missingKernel: "spot_workspace_warning_geometry", kernel_missing: "spot_workspace_warning_geometry" };
	return known[key] ? t(known[key]) : t("spot_workspace_warning_other");
}
function evidenceLabel(item) {
	const kind = t(item?.kind === "cant" ? "spot_workspace_cant" : item?.kind === "profile" ? "spot_workspace_profile" : "spot_workspace_attachment");
	if (item?.status === "ambiguous") return t("spot_workspace_evidence_ambiguous", { kind });
	if (item?.status === "rejected") return t("spot_workspace_evidence_rejected", { kind });
	return t("spot_workspace_evidence_retained", { kind });
}
function renderEvidence(row) {
	const evidence = Array.isArray(row?.unresolvedEvidence) ? row.unresolvedEvidence : [];
	const warnings = Array.isArray(row?.warnings) ? row.warnings : [];
	if (!evidence.length && !warnings.length) return "";
	const primary = evidence[0] ? evidenceLabel(evidence[0]) : warningLabel(warnings[0]);
	return `<p class="spotWorkspace__notice">${escapeHtml(primary)}</p>`;
}
function renderDetails(row) {
	const details = row?.details ?? {};
	return `<div class="spotWorkspace__details"><dl>
		<div><dt>${escapeHtml(t("spot_workspace_technical_id"))}</dt><dd>${escapeHtml(details.id ?? "—")}</dd></div>
		<div><dt>${escapeHtml(t("spot_workspace_crs"))}</dt><dd>${escapeHtml(details.crsId ?? t("spot_workspace_unresolved"))}</dd></div>
		<div><dt>${escapeHtml(t("spot_workspace_crs_status"))}</dt><dd>${escapeHtml(statusLabel(details.crsStatus))}</dd></div>
		<div><dt>${escapeHtml(t("spot_workspace_lifecycle"))}</dt><dd>${escapeHtml(lifecycleLabel(details.lifecycle))}</dd></div>
	</dl></div>`;
}
function renderContext(row, state, capabilities) {
	const id = String(row?.spotId ?? "");
	if (state.renameId === id) return `<form class="spotWorkspace__inline" data-spot-rename-form="${escapeHtml(id)}"><label>${escapeHtml(t("spot_workspace_rename_label"))}<input data-spot-rename-input value="${escapeHtml(state.renameDraft)}" /></label><div><button type="submit">${escapeHtml(t("spot_workspace_save"))}</button><button type="button" data-spot-cancel>${escapeHtml(t("spot_workspace_cancel"))}</button></div></form>`;
	if (state.removeId === id) return `<div class="spotWorkspace__inline spotWorkspace__confirm"><strong>${escapeHtml(t("spot_workspace_remove_named", { name: row?.label ?? id }))}</strong><p>${escapeHtml(t("spot_workspace_remove_explanation"))}</p><div><button class="is-danger" data-spot-confirm-remove="${escapeHtml(id)}">${escapeHtml(t("spot_workspace_remove"))}</button><button data-spot-cancel>${escapeHtml(t("spot_workspace_cancel"))}</button></div></div>`;
	if (state.detailsId === id) return renderDetails(row);
	if (state.menuId !== id) return "";
	return `<div class="spotWorkspace__menu" role="menu">
		${capabilities.rename ? `<button data-spot-start-rename="${escapeHtml(id)}">${escapeHtml(t("spot_workspace_rename"))}</button>` : ""}
		${capabilities.edit && row?.type === "alignment" ? `<button data-spot-edit-alignment="${escapeHtml(id)}">${escapeHtml(t("alignment_editor.action.edit_element"))}</button>` : ""}
		${capabilities.remove ? `<button data-spot-start-remove="${escapeHtml(id)}">${escapeHtml(t("spot_workspace_remove"))}</button>` : ""}
		<button data-spot-show-details="${escapeHtml(id)}">${escapeHtml(t("spot_workspace_details"))}</button>
	</div>`;
}
function renderCard(row, activeObjectId, state, capabilities) {
	const id = String(row?.spotId ?? ""); const active = id === activeObjectId;
	return `<article class="spotWorkspace__card ${active ? "is-active" : ""}" data-spot-card="${escapeHtml(id)}" data-spot-spatial="${escapeHtml(row?.spatialMode ?? "local")}" data-spot-source-kind="${escapeHtml(row?.sourceKind ?? "created")}">
		<button class="spotWorkspace__select" data-spot-activate="${escapeHtml(id)}" aria-label="${escapeHtml(t("spot_workspace_select_named", { name: row?.label ?? id }))}"></button>
		<div class="spotWorkspace__cardHead"><div><span class="spotWorkspace__type">${escapeHtml(typeLabel(row?.type))}</span><h3>${escapeHtml(row?.label ?? id)}</h3></div><div class="spotWorkspace__corner">${active ? `<span class="spotWorkspace__active">${escapeHtml(t("spot_workspace_active"))}</span>` : ""}<button class="spotWorkspace__more" data-spot-menu="${escapeHtml(id)}" aria-label="${escapeHtml(t("spot_workspace_actions"))}">•••</button></div></div>
		<div class="spotWorkspace__facts"><span>${escapeHtml(t(row?.sourceKind === "imported" ? "spot_workspace_imported" : "spot_workspace_created"))}</span><span class="is-${escapeHtml(row?.spatialMode ?? "local")}">${escapeHtml(spatialLabel(row?.spatialMode))}</span></div>
		${row?.sourceLabel ? `<p class="spotWorkspace__source">${escapeHtml(t("spot_workspace_source"))}: ${escapeHtml(row.sourceLabel)}</p>` : ""}
		${renderEvidence(row)}
		${renderContext(row, state, capabilities)}
	</article>`;
}

export function renderSpotHtml({ spotState, storeState, query = "", capabilities = {}, interaction = {} }) {
	const rows = Array.isArray(spotState?.rows) ? spotState.rows : []; const activeObjectId = getWorkspacePrimaryId(storeState); const normalized = String(query).trim().toLocaleLowerCase();
	const visible = rows.filter((row) => !normalized || [row?.label, row?.type, row?.sourceLabel, spatialLabel(row?.spatialMode)].some((value) => String(value ?? "").toLocaleLowerCase().includes(normalized)));
	return `<section class="spotWorkspace" aria-label="${escapeHtml(t("spot_workspace_aria"))}"><header class="spotWorkspace__header"><div><p class="spotWorkspace__eyebrow">${escapeHtml(t("spot_workspace_eyebrow"))}</p><h2>${escapeHtml(t("spot_workspace_title"))}</h2><p>${escapeHtml(t("spot_workspace_count", { count: rows.length }))}</p></div><label><span class="sr-only">${escapeHtml(t("spot_workspace_search"))}</span><input type="search" data-spot-search value="${escapeHtml(query)}" placeholder="${escapeHtml(t("spot_workspace_search"))}" /></label></header>
	${rows.length === 0 ? `<div class="spotWorkspace__empty"><h3>${escapeHtml(t("spot_workspace_empty_title"))}</h3><p>${escapeHtml(t("spot_workspace_empty_text"))}</p><div>${capabilities.create ? `<button data-spot-create>${escapeHtml(t("spot_workspace_create"))}</button>` : ""}${capabilities.import ? `<button data-spot-import>${escapeHtml(t("spot_workspace_import"))}</button>` : ""}</div></div>` : visible.length ? `<div class="spotWorkspace__list">${visible.map((row) => renderCard(row, activeObjectId, interaction, capabilities)).join("")}</div>` : `<div class="spotWorkspace__empty"><h3>${escapeHtml(t("spot_workspace_no_match_title"))}</h3><p>${escapeHtml(t("spot_workspace_no_match_text"))}</p></div>`}
	<div class="spotWorkspace__undo" data-spot-undo ${interaction.undoVisible ? "" : "hidden"}><span>${escapeHtml(t("spot_workspace_removed"))}</span><button>${escapeHtml(t("spot_workspace_undo"))}</button></div></section>`;
}

export function makeSpotView({ rootEl } = {}) {
	if (!rootEl) throw new Error("spotView: missing rootEl"); ensureStylesheet();
	let spotState = null; let storeState = null; let query = ""; let lastRemoved = null; let actions = {}; let interaction = { menuId: null, renameId: null, renameDraft: "", removeId: null, detailsId: null, undoVisible: false };
	const capabilities = () => ({ rename: typeof actions.onRename === "function", remove: typeof actions.onRemove === "function", create: typeof actions.onCreate === "function", import: typeof actions.onImport === "function", edit: typeof actions.onEdit === "function" });
	const render = () => { rootEl.innerHTML = renderSpotHtml({ spotState, storeState, query, capabilities: capabilities(), interaction }); };
	const closeContext = () => { interaction = { ...interaction, menuId: null, renameId: null, removeId: null, detailsId: null }; };
	rootEl.addEventListener("input", (event) => { if (!event.target.matches("[data-spot-search]")) return; query = event.target.value; render(); const search = rootEl.querySelector("[data-spot-search]"); search?.focus(); search?.setSelectionRange?.(query.length, query.length); });
	rootEl.addEventListener("submit", async (event) => { const form = event.target.closest("[data-spot-rename-form]"); if (!form) return; event.preventDefault(); const name = form.querySelector("[data-spot-rename-input]")?.value?.trim(); if (!name) return; const result = await actions.onRename?.({ objectId: form.dataset.spotRenameForm, name }); if (result?.uiState) spotState = result.uiState; closeContext(); render(); });
	rootEl.addEventListener("click", async (event) => {
		const menu = event.target.closest("[data-spot-menu]"); if (menu) { const id = menu.dataset.spotMenu; interaction = { ...interaction, menuId: interaction.menuId === id ? null : id, renameId: null, removeId: null, detailsId: null }; render(); return; }
		const startRename = event.target.closest("[data-spot-start-rename]"); if (startRename) { const id = startRename.dataset.spotStartRename; const row = spotState?.rows?.find((item) => String(item.spotId) === id); interaction = { ...interaction, menuId: null, renameId: id, renameDraft: row?.label ?? "" }; render(); rootEl.querySelector("[data-spot-rename-input]")?.select(); return; }
		const startRemove = event.target.closest("[data-spot-start-remove]"); if (startRemove) { interaction = { ...interaction, menuId: null, removeId: startRemove.dataset.spotStartRemove }; render(); return; }
		const details = event.target.closest("[data-spot-show-details]"); if (details) { interaction = { ...interaction, menuId: null, detailsId: details.dataset.spotShowDetails }; render(); return; }
		if (event.target.closest("[data-spot-cancel]")) { closeContext(); render(); return; }
		const confirmRemove = event.target.closest("[data-spot-confirm-remove]"); if (confirmRemove) { const result = await actions.onRemove?.(confirmRemove.dataset.spotConfirmRemove); lastRemoved = result?.removedObject ? result : null; if (result?.uiState) spotState = result.uiState; closeContext(); interaction.undoVisible = Boolean(lastRemoved); render(); return; }
		if (event.target.closest("[data-spot-undo] button") && lastRemoved) { const result = await actions.onUndo?.(lastRemoved); if (result?.uiState) spotState = result.uiState; lastRemoved = null; interaction.undoVisible = false; render(); return; }
		const activate = event.target.closest("[data-spot-activate]"); if (activate) { closeContext(); render(); return actions.onActivate?.(activate.dataset.spotActivate); }
		const edit = event.target.closest("[data-spot-edit-alignment]"); if (edit) { closeContext(); render(); return actions.onEdit?.(edit.dataset.spotEditAlignment); }
		if (event.target.closest("[data-spot-create]")) actions.onCreate?.(); if (event.target.closest("[data-spot-import]")) actions.onImport?.();
	});
	window.addEventListener("keydown", (event) => { if (event.key !== "Escape" || rootEl.closest("#spotOverlay")?.classList.contains("hidden")) return; if (interaction.menuId || interaction.renameId || interaction.removeId || interaction.detailsId) { closeContext(); render(); } else document.getElementById("btnSpotClose")?.click(); });
	return { setSpotState: (value) => { spotState = value ?? null; }, getSpotState: () => spotState, setSpotHtml: (html) => { rootEl.innerHTML = String(html ?? ""); }, setSpotText: (text) => { rootEl.textContent = String(text ?? ""); }, refresh: (value) => { storeState = value ?? storeState; render(); }, wireActions: (callbacks = {}) => { actions = { ...actions, ...callbacks }; render(); }, renderSpotHtml, getQuery: () => query, setQuery: (value) => { query = String(value ?? ""); render(); } };
}
