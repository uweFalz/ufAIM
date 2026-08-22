// app/view/cockpit/renderCockpitRows.js

import { t } from "@app/i18n/strings.js";
import { escapeHtml } from "@app/utils/appHelpers.js";
import { compareImportRows } from "@app/domain/cockpit/scoreImportRow.js";

export function renderActionButtons(actions = []) {
	if (!actions.length) {
		return empty(tx(
			"cockpit.empty.selectObject",
			"Wähle ein Universe-Objekt oder ziehe Daten hinein."
		));
	}

	return actions.map((action) => button({
		label: action.label,
		kind: action.kind,
		attrs: {
			"data-cockpit-action": action.id,
			"data-object-id": action.objectId ?? "",
		},
	})).join("");
}

export function renderSpotRows(rows = []) {
	if (!rows.length) {
		return empty(tx(
			"cockpit.empty.noObjects",
			"Noch keine Objekte im Universe. Ziehe Alignment-Daten hinein."
		));
	}

	return rows.map(renderSpotRow).join("");
}

function renderSpotRow(row) {
	return rowWrap({
		className: [
			"cockpit-object-card",
			row.isActive ? "is-active" : "",
			row.pinned ? "is-visible" : "",
			row.issues?.length ? "has-warning" : "",
		],
		main: `
			${titleLine(row.label ?? row.objectId ?? "object", [
				row.isActive ? tx("cockpit.badge.inFocus", "Im Fokus") : null,
				row.pinned ? tx("cockpit.badge.visible", "Angezeigt") : null,
			])}

			${metaLine([
				row.type ?? "unknown",
				row.crsId ?? tx("cockpit.crsOpen", "CRS offen"),
				row.hasKernel ? tx("cockpit.kernel", "Kernel") : null,
				row.exportable ? tx("cockpit.exportable", "exportierbar") : null,
			])}

			${metaLine([
				Number.isFinite(Number(row.lengthHint))
					? `${tx("cockpit.lengthApprox", "Länge≈")}${Math.round(Number(row.lengthHint))}m`
					: tx("cockpit.lengthOpen", "Länge offen"),
				Number.isFinite(Number(row.elementCount))
					? `${tx("cockpit.elements", "Elemente")}:${Number(row.elementCount)}`
					: null,
				row.bandSummary?.length
					? `${tx("cockpit.bands", "Bänder")}:${row.bandSummary.join(", ")}`
					: tx("cockpit.noBands", "keine Zusatzbänder"),
			])}

			${row.sourceLabel ? divLine(`${tx("cockpit.source", "Quelle")}: ${row.sourceLabel}`) : ""}
			${row.issues?.length ? divLine(`${tx("cockpit.notes", "Hinweise")}: ${row.issues.join(", ")}`) : ""}
		`,
		actions: `
			${button({
				label: tx("cockpit.action.focus", "Fokus"),
				attrs: { "data-cockpit-activate": row.objectId },
			})}

			${button({
				label: row.pinned
					? tx("cockpit.action.hide", "Ausblenden")
					: tx("cockpit.action.show", "Anzeigen"),
				attrs: { "data-cockpit-pin": row.objectId },
			})}

			${row.exportable ? button({
				label: tx("cockpit.action.export", "Export"),
				attrs: {
					"data-cockpit-action": "exportLandXML",
					"data-object-id": row.objectId,
				},
			}) : ""}

			${button({
				label: tx("cockpit.action.details", "Details"),
				attrs: {
					"data-cockpit-action": "details",
					"data-object-id": row.objectId,
				},
			})}
		`,
	});
}

export function renderImportRows(rows = []) {
	if (!rows.length) {
		return empty(tx("cockpit.empty.noImportData", "(keine Importdaten)"));
	}

	const sortedRows = [...rows].sort(compareImportRows);
	const visibleRows = sortedRows.slice(0, 12);
	const hiddenCount = Math.max(0, sortedRows.length - visibleRows.length);

	return `
		<div class="cockpit-sofa__list">
			${visibleRows.map(renderImportRow).join("")}
		</div>

		${hiddenCount > 0 ? empty(
			`… ${hiddenCount} ${tx("cockpit.moreImportObjects", "weitere Importobjekte")}`
		) : ""}
	`;
}

function renderImportRow(row) {
	return rowWrap({
		className: [
			row.isPreviewActive ? "is-active" : "",
			row.accepted ? "is-accepted" : "",
			row.rejected ? "has-warning" : "",
		],
		main: `
			${titleLine(row.label ?? row.itemId ?? "item")}

			${metaLine([
				row.kind ?? "unknown",
				row.fileName ?? "no-file",
				row.crsId ?? tx("cockpit.crsOpen", "CRS offen"),
			])}

			${metaLine([
				row.statusLabel,
				row.hasSparse ? tx("cockpit.kernel", "Kernel") : null,
				row.accepted ? tx("cockpit.inUniverse", "im Universe") : null,
				Number.isFinite(Number(row.lengthHint))
					? `${tx("cockpit.lengthApprox", "Länge≈")}${Math.round(Number(row.lengthHint))}m`
					: null,
				row.relationCount
					? `${tx("cockpit.relations", "Relationen")}:${row.relationCount}`
					: null,
			])}
			${row.reason ? divLine(`${tx("cockpit.notes", "Grund")}: ${row.reason}`) : ""}
		`,
		actions: `
			${row.hasSparse && row.promotable ? button({
				label: tx("cockpit.action.preview", "Vorschau"),
				attrs: { "data-cockpit-preview": row.itemId },
			}) : ""}

			${row.promotable ? button({
				label: tx("cockpit.action.acceptAndShow", "Übernehmen & anzeigen"),
				attrs: { "data-cockpit-accept-show": row.itemId },
			}) : ""}
		`,
	});
}

// -----------------------------------------------------------------------------
// HTML helpers
// -----------------------------------------------------------------------------

function rowWrap({ className = "", main = "", actions = "" } = {}) {
	const cls = Array.isArray(className)
		? className.filter(Boolean).join(" ")
		: String(className ?? "");

	return `
		<div class="cockpit-sofa__row ${escapeHtml(cls)}">
			<div class="cockpit-sofa__main">
				${main}
			</div>
			<div class="cockpit-sofa__actions">
				${actions}
			</div>
		</div>
	`;
}

function button({ label, kind = "ghost", attrs = {} } = {}) {
	const className = kind === "primary"
		? "btn btn--primary btn--xs"
		: "btn btn--ghost btn--xs";

	return `
		<button class="${className}" ${attrsToHtml(attrs)}>
			${escapeHtml(label ?? "")}
		</button>
	`;
}

function attrsToHtml(attrs = {}) {
	return Object.entries(attrs)
		.filter(([, value]) => value !== null && value !== undefined)
		.map(([key, value]) => `${escapeHtml(key)}="${escapeHtml(value)}"`)
		.join(" ");
}

function titleLine(value, badges = []) {
	const suffix = badges.filter(Boolean).map((b) => ` · ${escapeHtml(b)}`).join("");

	return `
		<div>
			<strong>${escapeHtml(value)}</strong>${suffix}
		</div>
	`;
}

function metaLine(parts = []) {
	const text = parts.filter(Boolean).join(" · ");
	return `<div>${escapeHtml(text)}</div>`;
}

function divLine(value) {
	return `<div>${escapeHtml(value)}</div>`;
}

function empty(value) {
	return `<div class="cockpit-sofa__empty">${escapeHtml(value)}</div>`;
}

function tx(key, fallback) {
	const value = t?.(key);
	return value && value !== key ? value : fallback;
}
