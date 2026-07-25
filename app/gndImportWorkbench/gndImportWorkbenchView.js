import { t } from "@app/i18n/strings.js";

export function renderGndImportWorkbench(root, model) {
	if (!root) return;
	root.replaceChildren();
	if (model.phase === "loading") return root.append(message(t("gnd_workbench.loading")));
	if (model.phase === "error") return root.append(message(t("gnd_workbench.read_failed"), "error"));
	if (!model.records.length) return root.append(message(t("gnd_workbench.empty")));

	const fragment = document.createDocumentFragment();
	for (const record of model.records) fragment.append(renderRecord(record, model));
	root.append(fragment);
}

function renderRecord(record, model) {
	const section = element("article", "gnd-wb-record");
	section.dataset.evidenceId = record.evidenceId;
	const eligibleCount = model.items.filter((item) => item.evidenceId === record.evidenceId && isEligible(item)).length;
	section.append(
		header(record, eligibleCount),
		sourceSummary(record),
		candidateSection(record, model),
		detailsSection(record),
	);
	if (model.feedback) section.append(message(t(model.feedback), model.feedback.endsWith("failed") ? "error" : "success"));
	return section;
}

function header(record, eligibleCount) {
	const node = element("header", "gnd-wb-hero");
	const title = element("div");
	title.append(
		element("p", "gnd-wb-kicker", record.source?.format ?? "GND"),
		element("h2", "", record.source?.fileName ?? record.evidenceId),
		element("p", "", t(`gnd_workbench.status.${record.truthfulnessStatus}`)),
		element("p", "hint", t(`gnd_workbench.explain.${record.truthfulnessStatus}`)),
	);
	const facts = element("dl", "gnd-wb-facts");
	addFact(facts, "SHA-256", compactHash(record.source?.sha256));
	addFact(facts, "Parser", record.source?.parserId);
	addFact(facts, "Extractor", [record.source?.extractor?.id, record.source?.extractor?.version].filter(Boolean).join(" "));
	addFact(facts, t("gnd_workbench.candidates"), eligibleCount);
	addFact(facts, t("gnd_workbench.unresolved"), record.unresolvedEvidence?.length ?? 0);
	node.append(title, facts, element("p", "gnd-wb-decision", t(eligibleCount ? "gnd_workbench.summary_safe" : "gnd_workbench.summary_withheld")));
	return node;
}

function sourceSummary(record) {
	const details = disclosure(t("gnd_workbench.source"), true);
	const dl = element("dl", "gnd-wb-facts gnd-wb-facts--wide");
	addFact(dl, "Filename", record.source?.fileName);
	addFact(dl, "Format", record.source?.format);
	addFact(dl, "Parser", record.source?.parserId);
	addFact(dl, "Container", record.source?.container);
	addFact(dl, "Extractor", [record.source?.extractor?.id, record.source?.extractor?.version].filter(Boolean).join(" "));
	addFact(dl, "SHA-256", record.source?.sha256);
	addFact(dl, "Evidence ID", record.evidenceId);
	details.append(dl);
	return details;
}

function candidateSection(record, model) {
	const wrap = element("section");
	wrap.append(element("h3", "", t("gnd_workbench.candidates")));
	const list = element("div", "gnd-wb-cards");
	const accepted = model.items.filter((item) => item.evidenceId === record.evidenceId);
	const rejected = model.rejectedItems.filter((item) => item.evidenceId === record.evidenceId);
	for (const item of [...accepted, ...rejected]) list.append(candidateCard(item, record, model));
	if (!list.childElementCount) list.append(message(t("gnd_workbench.summary_withheld")));
	wrap.append(list);
	return wrap;
}

function candidateCard(item, record, model) {
	const eligible = isEligible(item);
	const transferred = item?.status?.accepted === true;
	const unresolved = item?.payload?.extended?.unresolvedAttachments ?? [];
	const card = element("article", "gnd-wb-card");
	card.tabIndex = 0;
	card.dataset.itemId = item.id;
	card.append(
		element("h4", "", item?.payload?.name ?? item?.source?.objectName ?? item.id),
		element("p", "hint", `${item.kind ?? "unknown"} · ${item.source?.objectName ?? record.source?.fileName ?? ""}`),
		element("p", "", spatialLabel(item)),
		element("p", "", `${geometryCount(item)} elements · ${unresolved.length} unresolved`),
	);
	const status = element("p", `gnd-wb-eligibility ${eligible ? "is-eligible" : "is-withheld"}`,
		transferred ? t("gnd_workbench.transferred") : eligible ? t(`gnd_workbench.status.${record.truthfulnessStatus}`) : t("gnd_workbench.ineligible"));
	card.append(status);
	const actions = element("div", "gnd-wb-actions");
	const preview = button(t("gnd_workbench.preview"), "gnd-preview", item.id);
	preview.disabled = !item?.derived?.sparseAlignment || !eligible;
	const promote = button(transferred ? t("gnd_workbench.transferred") : t("gnd_workbench.add"), "gnd-promote", item.id);
	promote.disabled = !eligible || transferred || model.busyItemId === item.id;
	actions.append(preview, promote);
	card.append(actions);
	for (const diagnostic of diagnosticsFor(record, item)) {
		card.append(element("p", "gnd-wb-diagnostic", `${diagnostic.severity ?? "info"} · ${diagnostic.code ?? "diagnostic"} · ${diagnostic.message ?? diagnostic.reason ?? ""}`));
	}
	return card;
}

function detailsSection(record) {
	const group = element("section", "gnd-wb-details");
	const inventory = disclosure(t("gnd_workbench.inventory"));
	const table = element("table", "gnd-wb-table");
	table.append(row(["Table", "Rows", "Columns", "State"], "th"));
	for (const entry of record.inventory ?? []) table.append(row([entry.name, entry.rowCount, entry.columnCount, entry.interpreted === false ? "uninterpreted" : "interpreted"]));
	inventory.append(table);
	group.append(inventory);
	group.append(jsonDisclosure(t("gnd_workbench.diagnostics"), record.diagnostics));
	group.append(jsonDisclosure(t("gnd_workbench.relations"), record.relationCandidates));
	group.append(jsonDisclosure(t("gnd_workbench.unresolved"), record.unresolvedEvidence));
	const technical = disclosure(t("gnd_workbench.technical"));
	const controls = element("div", "gnd-wb-technical");
	const tables = record.sourceEnvelope?.tables ?? [];
	for (let index = 0; index < tables.length; index += 1) controls.append(button(`${t("gnd_workbench.show_table")}: ${tables[index]?.name ?? index + 1}`, "gnd-raw-table", String(index)));
	const pre = element("pre", "gnd-wb-raw");
	pre.dataset.rawEvidence = record.evidenceId;
	controls.append(pre);
	technical.append(controls);
	group.append(technical);
	return group;
}

function jsonDisclosure(label, value) {
	const details = disclosure(label);
	const pre = element("pre", "gnd-wb-json");
	pre.textContent = JSON.stringify(value ?? [], null, 2);
	details.append(pre);
	return details;
}

function diagnosticsFor(record, item) {
	return (record.diagnostics ?? []).filter((entry) => !entry.itemId || String(entry.itemId) === String(item.id)).slice(0, 3);
}
function isEligible(item) { return item?.status?.promotable === true && item?.status?.rejected !== true; }
function geometryCount(item) { return item?.derived?.sparseAlignment?.elements?.length ?? item?.derived?.sparseAlignment?.segments?.length ?? item?.derived?.sparseAlignment?.sparse?.length ?? 0; }
function spatialLabel(item) { const spatial = item?.derived?.spatialRef ?? item?.payload?.spatialRef ?? {}; return spatial.mode ?? spatial.supportState ?? spatial.resolutionState ?? "local-Cartesian / unresolved"; }
function compactHash(value) { const text = String(value ?? "—"); return text.length > 18 ? `${text.slice(0, 10)}…${text.slice(-6)}` : text; }
function disclosure(label, open = false) { const node = element("details", "gnd-wb-disclosure"); node.open = open; node.append(element("summary", "", label)); return node; }
function message(text, kind = "info") { const node = element("p", "gnd-wb-message", text); node.dataset.kind = kind; return node; }
function addFact(dl, label, value) { dl.append(element("dt", "", label), element("dd", "", value ?? "—")); }
function row(values, cell = "td") { const tr = element("tr"); for (const value of values) tr.append(element(cell, "", value ?? "—")); return tr; }
function button(label, action, value) { const node = element("button", "btn", label); node.type = "button"; node.setAttribute(`data-${action}`, value); return node; }
function element(tag, className = "", text = null) { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = String(text); return node; }
