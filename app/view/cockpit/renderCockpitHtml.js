// app/view/cockpit/renderCockpitHtml.js
//
// HTML renderer for CockpitController.
//
// Role:
// - render user-facing cockpit HTML
// - no state mutation
// - no messaging
// - no store access
// - no domain scoring except imported row sorting

import { escapeHtml } from "@app/utils/appHelpers.js";
import { compareImportRows } from "@app/domain/cockpit/scoreImportRow.js";

export function renderCockpitHtml(uiState = {}) {
	const scene = uiState?.scene ?? {};
	const context = uiState?.context ?? {};
	const actions = Array.isArray(uiState?.actions) ? uiState.actions : [];

	const importRows = Array.isArray(uiState?.collections?.importRows)
		? uiState.collections.importRows
		: [];

	const spotRows = Array.isArray(uiState?.collections?.spotRows)
		? uiState.collections.spotRows
		: [];

	return `
		<div class="cockpit-sofa cockpit-ivision">
			<section class="cockpit-sofa__section cockpit-ivision__scene">
				<h3>Du siehst gerade</h3>
				<div class="cockpit-sofa__card ${scene.mode === "preview" ? "is-preview" : ""} ${context.hasCrsConflict ? "has-warning" : ""}">
					<div><strong>${escapeHtml(scene.label ?? "Keine aktive Szene")}</strong></div>
					<div>
						${escapeHtml(scene.type ?? "—")}
						· ${renderModeLabel(scene.mode)}
						· ${scene.crsId ? escapeHtml(scene.crsId) : "CRS offen"}
					</div>
					<div>
						Slot: ${escapeHtml(scene.slot ?? "right")}
						${scene.pinned ? " · angeheftet" : ""}
					</div>
					${renderSourceLine(scene.source)}
				</div>
			</section>

			<section class="cockpit-sofa__section cockpit-ivision__context">
				<h3>Einordnung</h3>
				<div class="cockpit-sofa__card ${context.hasCrsConflict ? "has-warning" : ""}">
					<div>${escapeHtml(context.message ?? "")}</div>
					<div>
						Import: ${Number(context.importCount ?? 0)}
						· SPOT: ${Number(context.spotCount ?? 0)}
						· Vorschau-Layer: ${Number(context.previewTracks ?? 0)}
					</div>
					<div>
						CRS: ${context.crsIds?.length ? escapeHtml(context.crsIds.join(", ")) : "noch offen"}
					</div>
				</div>
			</section>

			<section class="cockpit-sofa__section cockpit-ivision__actions">
				<h3>Nächste sinnvolle Schritte</h3>
				<div class="cockpit-sofa__actions cockpit-ivision__actionbar">
					${renderActionButtons(actions)}
				</div>
			</section>

			<section class="cockpit-sofa__section">
				<h3>Import erkunden · ${importRows.length}</h3>
				${renderImportRows(importRows)}
			</section>

			<section class="cockpit-sofa__section">
				<h3>Arbeitsbestand · ${spotRows.length}</h3>
				<div class="cockpit-sofa__list">
					${renderSpotRows(spotRows)}
				</div>
			</section>
		</div>
	`;
}

function renderActionButtons(actions = []) {
	if (!actions.length) {
		return `<div class="cockpit-sofa__empty">Keine Aktion nötig. Ziehe Daten hinein oder wähle ein Objekt.</div>`;
	}

	return actions.map((action) => `
		<button
			class="btn btn--xs ${action.kind === "primary" ? "btn--primary" : "btn--ghost"}"
			data-cockpit-action="${escapeHtml(action.id)}"
			data-object-id="${escapeHtml(action.objectId ?? "")}">
			${escapeHtml(action.label)}
		</button>
	`).join("");
}

function renderImportRows(rows = []) {
	if (!rows.length) {
		return `<div class="cockpit-sofa__empty">(keine Importdaten)</div>`;
	}

	const sortedRows = [...rows].sort(compareImportRows);
	const topRows = sortedRows.slice(0, 3);
	const visibleRows = sortedRows.slice(0, 25);
	const hiddenCount = Math.max(0, sortedRows.length - visibleRows.length);

	return `
		${topRows.length ? `
			<div class="cockpit-sofa__top">
				<div class="cockpit-sofa__top-title">Empfohlene Kandidaten</div>
				${topRows.map(renderImportRow).join("")}
			</div>
		` : ""}

		<div class="cockpit-sofa__list">
			${visibleRows.map(renderImportRow).join("")}
		</div>

		${hiddenCount > 0 ? `
			<div class="cockpit-sofa__empty">
				… ${hiddenCount} weitere Importobjekte
			</div>
		` : ""}
	`;
}

function renderImportRow(row) {
	return `
		<div class="cockpit-sofa__row ${row.isPreviewActive ? "is-active" : ""} ${row.accepted ? "is-accepted" : ""}">
			<div class="cockpit-sofa__main">
				<div><strong>${escapeHtml(row.label ?? row.itemId ?? "item")}</strong></div>
				<div>
					${escapeHtml(row.kind ?? "unknown")}
					· ${escapeHtml(row.fileName ?? "no-file")}
					· ${row.crsId ? escapeHtml(row.crsId) : "CRS offen"}
				</div>
				<div>
					${row.promotable ? "übernehmbar" : "nicht übernehmbar"}
					${row.hasSparse ? " · Kernel" : ""}
					${row.accepted ? " · akzeptiert" : ""}
					${Number.isFinite(Number(row.lengthHint)) ? ` · Länge≈${Math.round(Number(row.lengthHint))}m` : ""}
					${row.relationCount ? ` · Relationen:${row.relationCount}` : ""}
				</div>
			</div>
			<div class="cockpit-sofa__actions">
				<button class="btn btn--ghost btn--xs" data-cockpit-preview="${escapeHtml(row.itemId)}">Ansehen</button>
				${row.promotable ? `<button class="btn btn--ghost btn--xs" data-cockpit-accept="${escapeHtml(row.itemId)}">Übernehmen</button>` : ""}
				${row.promotable ? `<button class="btn btn--ghost btn--xs" data-cockpit-accept-show="${escapeHtml(row.itemId)}">Übernehmen & anzeigen</button>` : ""}
			</div>
		</div>
	`;
}

function renderSpotRows(rows = []) {
	if (!rows.length) {
		return `<div class="cockpit-sofa__empty">(noch kein Arbeitsbestand)</div>`;
	}

	return rows.map((row) => `
		<div class="cockpit-sofa__row ${row.isActive ? "is-active" : ""}">
			<div class="cockpit-sofa__main">
				<div><strong>${escapeHtml(row.label ?? row.objectId ?? "object")}</strong></div>
				<div>
					${escapeHtml(row.type ?? "unknown")}
					· ${row.crsId ? escapeHtml(row.crsId) : "CRS offen"}
					${row.hasKernel ? " · Kernel" : ""}
					${row.pinned ? " · angeheftet" : ""}
				</div>
			</div>
			<div class="cockpit-sofa__actions">
				<button class="btn btn--ghost btn--xs" data-cockpit-activate="${escapeHtml(row.objectId)}">Anzeigen</button>
				<button class="btn btn--ghost btn--xs" data-cockpit-pin="${escapeHtml(row.objectId)}">${row.pinned ? "Lösen" : "Anheften"}</button>
			</div>
		</div>
	`).join("");
}

function renderModeLabel(mode) {
	switch (mode) {
		case "preview":
			return "Vorschau";

		case "spot":
			return "Arbeitsbestand";

		case "none":
			return "leer";

		default:
			return escapeHtml(mode ?? "unbekannt");
	}
}

function renderSourceLine(source) {
	if (!source) return "";

	const parts = [
		source.fileName ?? source.file ?? null,
		source.objectName ?? null,
		source.parserId ?? source.format ?? null,
	].filter(Boolean);

	if (!parts.length) return "";

	return `<div>Quelle: ${escapeHtml(parts.join(" · "))}</div>`;
}
