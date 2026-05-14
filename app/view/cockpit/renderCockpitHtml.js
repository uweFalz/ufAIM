// app/view/cockpit/renderCockpitHtml.js
//
// HTML renderer for CockpitController.
//
// Role:
// - render user-facing cockpit HTML
// - Cockpit acts as Universe / Object Navigator
// - Import is secondary inbox/debug context
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
		<div class="cockpit-sofa cockpit-ivision cockpit-universe">
			<section class="cockpit-sofa__section cockpit-ivision__scene">
				<h3>Aktueller Fokus</h3>
				<div class="cockpit-sofa__card ${scene.mode === "preview" ? "is-preview" : ""} ${context.hasCrsConflict ? "has-warning" : ""}">
					<div><strong>${escapeHtml(scene.label ?? "Kein Objekt im Fokus")}</strong></div>
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
				<h3>Universe-Kontext</h3>
				<div class="cockpit-sofa__card ${context.hasCrsConflict ? "has-warning" : ""}">
					<div>${escapeHtml(context.message ?? "")}</div>
					<div>
						Objekte: ${Number(context.spotCount ?? 0)}
						· Import-Inbox: ${Number(context.importCount ?? 0)}
						· Vorschau-Layer: ${Number(context.previewTracks ?? 0)}
					</div>
					<div>
						CRS: ${context.crsIds?.length ? escapeHtml(context.crsIds.join(", ")) : "noch offen"}
					</div>
				</div>
			</section>

			<section class="cockpit-sofa__section cockpit-ivision__actions">
				<h3>Aktionen zum Fokus</h3>
				<div class="cockpit-sofa__actions cockpit-ivision__actionbar">
					${renderActionButtons(actions)}
				</div>
			</section>

			<section class="cockpit-sofa__section cockpit-universe__objects">
				<h3>Universe Objects · ${spotRows.length}</h3>
				<div class="cockpit-sofa__list">
					${renderSpotRows(spotRows)}
				</div>
			</section>

			<section class="cockpit-sofa__section cockpit-universe__inbox">
				<h3>Import-Inbox · ${importRows.length}</h3>
				${renderImportRows(importRows)}
			</section>
		</div>
	`;
}

function renderActionButtons(actions = []) {
	if (!actions.length) {
		return `<div class="cockpit-sofa__empty">Wähle ein Objekt im Universe oder ziehe Daten hinein.</div>`;
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

// -----------------------------------------------------------------------------
// SPOT / Universe objects
// -----------------------------------------------------------------------------

function renderSpotRows(rows = []) {
	if (!rows.length) {
		return `<div class="cockpit-sofa__empty">Noch keine Objekte im Universe. Ziehe Alignment-Daten hinein.</div>`;
	}

	return rows.map(renderSpotRow).join("");
}

function renderSpotRow(row) {
	return `
		<div class="cockpit-sofa__row cockpit-object-card ${row.isActive ? "is-active" : ""} ${row.issues?.length ? "has-warning" : ""}">
			<div class="cockpit-sofa__main">
				<div>
					<strong>${escapeHtml(row.label ?? row.objectId ?? "object")}</strong>
					${row.pinned ? " · angeheftet" : ""}
				</div>

				<div>
					${escapeHtml(row.type ?? "unknown")}
					· ${row.crsId ? escapeHtml(row.crsId) : "CRS offen"}
					${row.hasKernel ? " · Kernel" : ""}
					${row.exportable ? " · exportierbar" : ""}
				</div>

				<div>
					${Number.isFinite(Number(row.lengthHint)) ? `Länge≈${Math.round(Number(row.lengthHint))}m` : "Länge offen"}
					${Number.isFinite(Number(row.elementCount)) ? ` · Elemente:${Number(row.elementCount)}` : ""}
					${row.bandSummary?.length ? ` · Bänder:${escapeHtml(row.bandSummary.join(", "))}` : " · keine Zusatzbänder"}
				</div>

				${row.sourceLabel ? `
					<div>Quelle: ${escapeHtml(row.sourceLabel)}</div>
				` : ""}

				${row.issues?.length ? `
					<div>Hinweise: ${escapeHtml(row.issues.join(", "))}</div>
				` : ""}
			</div>

			<div class="cockpit-sofa__actions">
				<button class="btn btn--ghost btn--xs" data-cockpit-activate="${escapeHtml(row.objectId)}">Anzeigen</button>
				<button class="btn btn--ghost btn--xs" data-cockpit-pin="${escapeHtml(row.objectId)}">${row.pinned ? "Lösen" : "Anheften"}</button>
				${row.exportable ? `<button class="btn btn--ghost btn--xs" data-cockpit-action="exportLandXML" data-object-id="${escapeHtml(row.objectId)}">Export</button>` : ""}
				<button class="btn btn--ghost btn--xs" data-cockpit-action="details" data-object-id="${escapeHtml(row.objectId)}">Details</button>
			</div>
		</div>
	`;
}

// -----------------------------------------------------------------------------
// Import inbox: secondary
// -----------------------------------------------------------------------------

function renderImportRows(rows = []) {
	if (!rows.length) {
		return `<div class="cockpit-sofa__empty">(keine Importdaten)</div>`;
	}

	const sortedRows = [...rows].sort(compareImportRows);
	const visibleRows = sortedRows.slice(0, 12);
	const hiddenCount = Math.max(0, sortedRows.length - visibleRows.length);

	return `
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
					${row.promotable ? "verwertbar" : "nicht verwertbar"}
					${row.hasSparse ? " · Kernel" : ""}
					${row.accepted ? " · im Universe" : ""}
					${Number.isFinite(Number(row.lengthHint)) ? ` · Länge≈${Math.round(Number(row.lengthHint))}m` : ""}
					${row.relationCount ? ` · Relationen:${row.relationCount}` : ""}
				</div>
			</div>
			<div class="cockpit-sofa__actions">
				<button class="btn btn--ghost btn--xs" data-cockpit-preview="${escapeHtml(row.itemId)}">Vorschau</button>
				${row.promotable ? `<button class="btn btn--ghost btn--xs" data-cockpit-accept-show="${escapeHtml(row.itemId)}">Ins Universe</button>` : ""}
			</div>
		</div>
	`;
}

// -----------------------------------------------------------------------------
// misc
// -----------------------------------------------------------------------------

function renderModeLabel(mode) {
	switch (mode) {
		case "preview":
			return "Vorschau";

		case "spot":
			return "Universe-Objekt";

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
