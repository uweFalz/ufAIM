// app/view/cockpit/renderCockpitHtml.js
//
// Cockpit layout renderer.
//
// Owns:
// - Cockpit HTML layout
// - markup structure
// - local presentation grouping
//
// Does NOT own:
// - DOM writing
// - controller orchestration
// - application state
// - import/SPOT/projection logic
//
// i18n rule:
// - text resolution should happen here or through an explicit text API,
//   not randomly inside controllers.
//
// Transition note:
// - This remains a string renderer for now.
// - innerHTML is only allowed through renderCockpitRoot(...).

import { t } from "@app/i18n/strings.js";
import { escapeHtml } from "@app/utils/appHelpers.js";

import {
	renderActionButtons,
	renderSpotRows,
	renderImportRows,
} from "./renderCockpitRows.js";

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

	const visibleCount = Number(context.contextCount ?? context.previewTracks ?? 0);

	return `
		<div class="cockpit-sofa cockpit-ivision cockpit-universe">
			${section({
				className: "cockpit-ivision__native",
				title: tx("cockpit.section.file", "File"),
				body: renderNativeAuthoringCard(),
			})}

			${section({
				className: "cockpit-ivision__scene",
				title: tx("cockpit.section.workspace", "Arbeitsansicht"),
				body: renderSceneCard(scene, context, visibleCount),
			})}

			${section({
				className: "cockpit-ivision__context",
				title: tx("cockpit.section.context", "Universe-Kontext"),
				body: renderContextCard(context, visibleCount),
			})}

			${section({
				className: "cockpit-ivision__actions",
				title: tx("cockpit.section.actions", "Aktionen"),
				body: `
					<div class="cockpit-sofa__actions cockpit-ivision__actionbar">
						${renderActionButtons(actions)}
					</div>
				`,
			})}

			${section({
				className: "cockpit-universe__objects",
				title: `${tx("cockpit.section.objects", "Universe Objects")} · ${spotRows.length}`,
				body: `
					<div class="cockpit-sofa__list">
						${renderSpotRows(spotRows)}
					</div>
				`,
			})}

			${section({
				className: "cockpit-universe__inbox",
				title: `${tx("cockpit.section.importInbox", "Import-Inbox")} · ${importRows.length}`,
				body: renderImportRows(importRows),
			})}
		</div>
	`;
}

function renderNativeAuthoringCard() {
	return card({
		className: "cockpit-ivision__native-card",
		body: `
			<div class="cockpit-sofa__actions cockpit-ivision__actionbar">
				<button
					type="button"
					class="cockpit-sofa__button cockpit-sofa__button--primary"
					data-cockpit-new-alignment
				>
					${escapeHtml(tx("cockpit.action.newAlignment", "File → New Alignment"))}
				</button>

				<button
					type="button"
					class="cockpit-sofa__button cockpit-sofa__button--secondary"
					data-cockpit-add-straight
				>
					${escapeHtml(tx("cockpit.action.addStraight", "+ Straight"))}
				</button>

				<button
					type="button"
					class="cockpit-sofa__button cockpit-sofa__button--secondary"
					data-cockpit-clear-elements
				>
					${escapeHtml(tx("cockpit.action.clearElements", "Clear Elements"))}
				</button>
			</div>
		`,
	});
}

function renderSceneCard(scene, context, visibleCount) {
	return card({
		className: [
			scene.mode === "preview" ? "is-preview" : "",
			context.hasCrsConflict ? "has-warning" : "",
		],
		body: `
			${lineStrong(scene.label ?? tx("cockpit.noFocus", "Kein Fokus"))}
			${metaLine([
				scene.type ?? "—",
				renderModeLabel(scene.mode),
				scene.crsId ?? tx("cockpit.crsOpen", "CRS offen"),
			])}
			${metaLine([
				`${tx("cockpit.focus", "Fokus")}: ${scene.objectId ?? "—"}`,
				`${tx("cockpit.selectedElement", "Element")}: ${scene.selectedElementId ?? "—"}`,
				`${tx("cockpit.visible", "Anzeige")}: ${visibleCount}`,
			])}
			${renderSourceLine(scene.source)}
			${renderEditorElements(scene.editor, scene.objectId)}
		`,
	});
}

function renderEditorElements(editor, objectId) {
	if (!editor?.isNativeAlignment) return "";

	const elements = Array.isArray(editor.elements) ? editor.elements : [];
	const selectedElementId = String(editor?.selectedElementId ?? "").trim();

	if (!elements.length) {
		return `
			<div class="cockpit-sofa__meta">
				Elements · 0
			</div>
		`;
	}

	return `
		<div class="cockpit-sofa__meta">
			${escapeHtml(tx("cockpit.editor.elements", "Elements"))} · ${elements.length}
		</div>
		<ol class="cockpit-sofa__list cockpit-sofa__list--compact">
			${elements.map((el, index) => `
				<li class="${String(el?.id ?? "") === selectedElementId ? "is-selected" : ""}">
					<strong>${index + 1}. ${escapeHtml(readElementLabel(el))}</strong>
					${renderElementMeta(el)}
					${renderFocusEditorAction({ objectId, elementId: el?.id })}
				</li>
			`).join("")}
		</ol>
	`;
}

function renderFocusEditorAction({ objectId, elementId } = {}) {
	const oid = String(objectId ?? "").trim();
	const eid = String(elementId ?? "").trim();
	if (!oid || !eid) return "";

	return `
		<div class="cockpit-editor-focus-row">
			<button
				type="button"
				class="cockpit-sofa__button cockpit-sofa__button--secondary cockpit-editor-focus"
				data-cockpit-focus-editor-element
				data-cockpit-object-id="${escapeHtml(oid)}"
				data-cockpit-element-id="${escapeHtml(eid)}"
			>
				${escapeHtml(tx("cockpit.editor.focusInEditor", "Edit in Transition Editor"))}
			</button>
		</div>
	`;
}

function readElementLabel(el) {
	const type = String(el?.type ?? "element").trim().toLowerCase();

	if (type === "straight") return tx("alignment_editor.element_type.straight", "Straight");
	if (type === "arc") return tx("alignment_editor.element_type.arc", "Arc");
	if (type === "transition") return tx("alignment_editor.element_type.transition", "Transition");

	return type || tx("alignment_editor.element_type.unknown", "Element");
}

function renderElementMeta(el) {
	const type = String(el?.type ?? "").trim().toLowerCase();

	if (type === "straight") {
		const length =
			el?.parameters?.length ??
			el?.length ??
			null;

		return `<div>${escapeHtml(`${tx("cockpit.editor.length", "length")} ${length ?? "—"}`)}</div>`;
	}

	if (type === "arc") {
		const length = el?.parameters?.length ?? el?.length ?? null;
		const curvature = el?.parameters?.curvature ?? el?.curvature ?? null;
		return `<div>${escapeHtml(`${tx("cockpit.editor.length", "length")} ${length ?? "—"} · ${tx("cockpit.editor.k", "k")} ${curvature ?? "—"}`)}</div>`;
	}

	if (type === "transition") {
		const length = el?.parameters?.length ?? el?.length ?? null;
		const transitionType =
			el?.parameters?.transitionType ??
			el?.transitionType ??
			el?.transType ??
			null;
		return `<div>${escapeHtml(`${tx("cockpit.editor.length", "length")} ${length ?? "—"} · ${transitionType ?? tx("cockpit.editor.typeMissing", "type —")}`)}</div>`;
	}

	return "";
}

function renderContextCard(context, visibleCount) {
	return card({
		className: context.hasCrsConflict ? "has-warning" : "",
		body: `
			${line(context.message ?? "")}
			${metaLine([
				`${tx("cockpit.universe", "Universe")}: ${Number(context.spotCount ?? 0)}`,
				`${tx("cockpit.importInbox", "Import-Inbox")}: ${Number(context.importCount ?? 0)}`,
				`${tx("cockpit.visible", "Anzeige")}: ${visibleCount}`,
			])}
			${metaLine([
				`${tx("cockpit.crs", "CRS")}: ${
					context.crsIds?.length
						? context.crsIds.join(", ")
						: tx("cockpit.crsUnknown", "noch offen")
				}`,
			])}
		`,
	});
}

function section({ className = "", title = "", body = "" } = {}) {
	return `
		<section class="cockpit-sofa__section ${escapeHtml(className)}">
			<h3>${escapeHtml(title)}</h3>
			${body}
		</section>
	`;
}

function card({ className = "", body = "" } = {}) {
	const cls = Array.isArray(className)
		? className.filter(Boolean).join(" ")
		: String(className ?? "");

	return `
		<div class="cockpit-sofa__card ${escapeHtml(cls)}">
			${body}
		</div>
	`;
}

function line(value) {
	return `<div>${escapeHtml(value)}</div>`;
}

function lineStrong(value) {
	return `<div><strong>${escapeHtml(value)}</strong></div>`;
}

function metaLine(parts = []) {
	return `<div>${parts.filter(Boolean).map(escapeHtml).join(" · ")}</div>`;
}

function renderModeLabel(mode) {
	switch (mode) {
		case "preview":
			return tx("cockpit.mode.preview", "Vorschau");
		case "spot":
			return tx("cockpit.mode.spot", "Universe-Objekt");
		case "none":
			return tx("cockpit.mode.none", "leer");
		default:
			return String(mode ?? tx("cockpit.mode.unknown", "unbekannt"));
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

	return line(`${tx("cockpit.source", "Quelle")}: ${parts.join(" · ")}`);
}

function tx(key, fallback) {
	const value = t?.(key);
	return value && value !== key ? value : fallback;
}
