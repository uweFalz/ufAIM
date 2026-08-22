import { t } from "../i18n/strings.js";
import { buildGndSourceEvidenceBands } from "../domain/workspace/buildGndSourceEvidenceBands.js";

export function renderGndImportWorkbench(root, model) {
	if (!root) return;
	root.replaceChildren();

	const fragment = document.createDocumentFragment();
	const lifecycle = renderImportLifecycle(model);
	if (lifecycle) fragment.append(lifecycle);
	if (model.datasetCompleteness?.sourceCount || model.datasetCompleteness?.groups?.length) fragment.append(renderDatasetCompletenessCockpit(model.datasetCompleteness));
	if (!model.lifecycle && !model.dropState && !model.fileOutcomes?.length) fragment.append(renderWorkspaceStart(model));
	if (model.phase === "loading") fragment.append(message(t("gnd_workbench.loading")));
	if (model.phase === "error") fragment.append(message(t("gnd_workbench.read_failed"), "error"));
	const hasImportWorkspace = Boolean(model.fileOutcomes?.length || model.records?.length);
	if (hasImportWorkspace) fragment.append(renderImportWorkspace(model));
	else if (!model.records.length && !isImportBusy(model)) fragment.append(message(t("gnd_workbench.empty")));
	if (model.feedback && !model.records.length) {
		fragment.append(message(t(model.feedback), model.feedback.endsWith("failed") ? "error" : "success"));
	}
	root.append(fragment);
}

function renderImportWorkspace(model) {
	const selected = selectRecord(model);
	const workspace = element("section", "gnd-wb-viewer");
	workspace.dataset.importWorkspace = selected?.evidenceId ?? "outcomes-only";
	workspace.append(
		renderInbox(model, selected),
		renderImportStage(model, selected),
		renderOutbox(model, selected),
		renderSevenLinePlan(model, selected),
	);
	return workspace;
}

function selectRecord(model) {
	const requested = String(model.activeEvidenceId ?? "");
	return model.records?.find((entry) => String(entry?.evidenceId ?? "") === requested) ?? model.records?.[0] ?? null;
}

function renderInbox(model, selected) {
	const aside = element("aside", "gnd-wb-inbox");
	aside.append(
		element("p", "gnd-wb-pane-label", "INBOX"),
		element("strong", "gnd-wb-pane-title", `${model.fileOutcomes?.length ?? 0} Dateien · ${model.records?.length ?? 0} Befunde`),
	);
	const outcomes = element("div", "gnd-wb-inbox__files");
	for (const outcome of model.fileOutcomes ?? []) {
		const row = element("article", "gnd-wb-inbox-file");
		row.dataset.importFileOutcome = String(outcome?.fileName ?? "unknown");
		row.append(
			element("strong", "", outcome?.fileName ?? "Unbenannte Datei"),
			element("span", "", `${outcome?.parserId ?? "kein Parser"} · ${outcome?.status ?? "unknown"}`),
			element("small", "", outcome?.reason ?? `${outcome?.itemCount ?? 0} Objekte`),
		);
		outcomes.append(row);
	}
	aside.append(outcomes);
	if (model.records?.length) aside.append(element("p", "gnd-wb-pane-label", "FACHLICHE BEFUNDE"));
	for (const record of model.records ?? []) {
		const active = record === selected;
		const select = button(record?.source?.fileName ?? record?.evidenceId ?? "Befund", "import-evidence-select", record?.evidenceId ?? "");
		select.className = `gnd-wb-evidence-select${active ? " is-active" : ""}`;
		select.setAttribute("aria-pressed", String(active));
		const status = element("span", "", record?.truthfulnessStatus ?? "unknown");
		select.append(status);
		aside.append(select);
	}
	return aside;
}

function renderImportStage(model, selected) {
	const main = element("main", "gnd-wb-stage");
	const header = element("header", "gnd-wb-stage__header");
	header.append(
		element("div", "", selected ? `${selected?.source?.format ?? "Import"} · ${selected?.source?.fileName ?? selected.evidenceId}` : "Import-Ergebnis"),
		element("strong", "", selected?.truthfulnessStatus ?? "Keine konstruktive Evidenz"),
	);
	main.append(header);
	if (!selected) {
		main.append(renderFileOutcomes(model), message(t("gnd_workbench.empty")));
		return main;
	}
	main.append(renderAlignmentPreview(model, selected));
	main.append(renderSourceEvidenceBands(selected));
	main.append(renderRelationReview(model.relationReviewModel));
	if (model.alignmentIntelligenceModel) main.append(renderAlignmentFinding(model.alignmentIntelligenceModel));
	main.append(renderRecord(selected, model));
	return main;
}

function renderRelationReview(review) {
	const section = element("section", "gnd-wb-relation-review");
	section.dataset.gndRelationReview = review?.evidenceId ?? "absent";
	section.append(element("p", "gnd-wb-kicker", "QUELLENEVIDENZ"), element("h3", "", "Quellenassoziationen prüfen"), element("p", "hint", "Nur explizite Prüfung · keine Auswahl aus Dateiname, Reihenfolge oder Lage · keine fachliche Relation abgeleitet"));
	if (!review?.candidates?.length) { section.append(element("p", "", "Keine Quellenassoziationskandidaten vorhanden.")); return section; }
	for (const candidate of review.candidates) {
		const card = element("article", "gnd-wb-relation-candidate");
		card.dataset.relationCandidateId = candidate.id ?? "unknown";
		card.dataset.relationCandidateStatus = candidate.status;
		card.append(
			element("strong", "", `${candidate.id ?? "unbekannte ID"} · ${candidate.type ?? "Relation"} · ${candidate.from ?? "?"} → ${candidate.to ?? "?"}`),
			element("span", "", candidate.status),
			element("small", "", relationProvenanceText(candidate.provenance)),
		);
		card.append(candidate.status === "reviewed" ? button("Prüfung zurücknehmen", "gnd-source-association-withdraw-review", candidate.id) : button("Quellenassoziation als geprüft markieren", "gnd-source-association-review", candidate.id));
		section.append(card);
	}
	return section;
}

function relationProvenanceText(provenance) {
	const source = provenance?.source ?? null;
	const sourceFacts = [source?.fileName, source?.parserId, source?.objectName ?? source?.objectId].filter(hasText);
	const derivationFacts = [provenance?.origin, provenance?.derivedBy, provenance?.method].filter(hasText);
	const reasons = Array.isArray(provenance?.reasons) ? provenance.reasons.filter(hasText) : hasText(provenance?.reasons) ? [provenance.reasons] : [];
	const facts = [...sourceFacts, ...derivationFacts, ...reasons];
	return facts.length ? `Provenienz: ${facts.map(String).join(" · ")}` : "Provenienz: nicht angegeben";
}

function hasText(value) {
	return value !== null && value !== undefined && String(value).trim() !== "";
}

function renderSourceEvidenceBands(record) {
	const section = element("section", "gnd-wb-source-bands");
	section.dataset.sourceEvidenceBands = record?.evidenceId ?? "absent";
	section.append(
		element("p", "gnd-wb-kicker", "GND-QUELLWERTE"),
		element("h3", "", "EH-Profil und EU-Überhöhung"),
		element("p", "hint", "Numerische Source-Evidenz · noch keine konstruktive Kernel-Geometrie"),
	);
	for (const band of buildGndSourceEvidenceBands(record)) section.append(renderSourceEvidenceBand(band));
	return section;
}

function renderSourceEvidenceBand(band) {
	const article = element("article", "gnd-wb-source-band");
	article.dataset.sourceFamily = band.family;
	const header = element("header", "gnd-wb-source-band__header");
	header.append(
		element("strong", "", `${band.family} · ${band.kind === "profile" ? "Gradiente" : "Überhöhung"}`),
		element("span", "", `${band.segments.length} Quellelemente · ${band.valueUnit}`),
	);
	article.append(header);
	if (!band.segments.length) {
		article.append(element("p", "gnd-wb-source-band__empty", "Keine Quellwerte vorhanden."));
		return article;
	}
	if (band.drawableSegments.length) article.append(sourceBandSvg(band));
	else article.append(element("p", "gnd-wb-source-band__empty", "Werte vorhanden, aber Länge oder Endwerte sind unvollständig."));
	const facts = element("div", "gnd-wb-source-band__facts");
	for (const segment of band.segments) {
		const card = element("div", "gnd-wb-source-band__fact");
		card.dataset.sourceRow = segment.rowRef ?? "unknown";
		card.append(
			element("strong", "", `${segment.padStart ?? "?"} → ${segment.padEnd ?? "?"}`),
			element("span", "", `Typ ${segment.typeCode ?? "?"} · L ${segment.length ?? "?"} m`),
			element("span", "", `${segment.startValue ?? "?"} → ${segment.endValue ?? "?"} ${band.valueUnit}`),
			element("small", "", `${segment.rowRef ?? "ohne Zeilenreferenz"} · ${segment.attachmentStatus}`),
		);
		facts.append(card);
	}
	article.append(facts);
	return article;
}

function sourceBandSvg(band) {
	const points = band.drawableSegments.flatMap((segment) => [
		{ s: segment.startS, value: segment.startValue },
		{ s: segment.endS, value: segment.endValue },
	]);
	const maxS = Math.max(...points.map((point) => point.s), 1);
	const values = points.map((point) => point.value);
	const minValue = Math.min(...values), maxValue = Math.max(...values);
	const span = Math.max(maxValue - minValue, Math.abs(maxValue) * .05, 1e-9);
	const svg = svgElement("svg");
	svg.setAttribute("viewBox", "0 0 1000 180");
	svg.setAttribute("role", "img");
	svg.setAttribute("aria-label", `${band.family} Source-Evidenz`);
	const zeroY = 150 - ((0 - minValue) / span) * 120;
	if (zeroY >= 20 && zeroY <= 160) {
		const zero = svgElement("line");
		zero.setAttribute("x1", "30"); zero.setAttribute("x2", "970"); zero.setAttribute("y1", String(zeroY)); zero.setAttribute("y2", String(zeroY)); zero.setAttribute("class", "gnd-wb-source-band__zero");
		svg.append(zero);
	}
	const polyline = svgElement("polyline");
	polyline.setAttribute("class", "gnd-wb-source-band__line");
	polyline.setAttribute("points", points.map((point) => `${30 + (point.s / maxS) * 940},${150 - ((point.value - minValue) / span) * 120}`).join(" "));
	svg.append(polyline);
	return svg;
}

function renderAlignmentPreview(model, selected) {
	const section = element("section", "gnd-wb-geometry-preview");
	section.dataset.importGeometryPreview = String(model.activeItemId ?? "absent");
	const selectedItems = (model.items ?? []).filter((item) => String(item?.evidenceId ?? "") === String(selected?.evidenceId ?? ""));
	const activeItem = selectedItems.find((item) => String(item?.id ?? "") === String(model.activeItemId ?? "")) ?? selectedItems.find(isEligible) ?? selectedItems[0] ?? null;
	const track = (model.previewTracks ?? []).find((entry) => String(entry?.importItemId ?? "") === String(activeItem?.id ?? "")) ?? null;
	const header = element("header", "gnd-wb-geometry-preview__header");
	header.append(
		element("strong", "", activeItem?.payload?.name ?? activeItem?.source?.objectName ?? activeItem?.id ?? "Alignment-Vorschau"),
		element("span", "", track?.crsId ? `CRS ${track.crsId}` : "Lokale Koordinaten · CRS offen"),
	);
	section.append(header);
	if (!model.datasetCompleteness) section.append(renderRouteWorkspaces(model));
	if (!track?.polyline2d?.length) {
		section.append(element("p", "gnd-wb-geometry-preview__empty", activeItem ? "Keine projizierbare Alignment-Geometrie." : "Kein Alignment-Kandidat ausgewählt."));
		return section;
	}
	const svg = svgElement("svg");
	svg.setAttribute("viewBox", "0 0 1000 420");
	svg.setAttribute("role", "img");
	svg.setAttribute("aria-label", `Alignment-Vorschau ${track.label ?? ""}`);
	for (let x = 100; x < 1000; x += 100) {
		const line = svgElement("line");
		line.setAttribute("x1", x); line.setAttribute("y1", 0); line.setAttribute("x2", x); line.setAttribute("y2", 420);
		line.setAttribute("class", "gnd-wb-geometry-preview__grid"); svg.append(line);
	}
	for (let y = 70; y < 420; y += 70) {
		const line = svgElement("line");
		line.setAttribute("x1", 0); line.setAttribute("y1", y); line.setAttribute("x2", 1000); line.setAttribute("y2", y);
		line.setAttribute("class", "gnd-wb-geometry-preview__grid"); svg.append(line);
	}
	const polyline = svgElement("polyline");
	polyline.setAttribute("class", "gnd-wb-geometry-preview__line");
	polyline.setAttribute("points", previewPoints(track.polyline2d));
	svg.append(polyline);
	section.append(svg);
	return section;
}

function renderRouteWorkspaces(model) {
	const section = element("section", "gnd-route-workspaces");
	section.dataset.gndRouteWorkspaceCount = String(model.routeWorkspaces?.length ?? 0);
	section.append(element("h3", "", "Strecken-Arbeitsräume"));
	for (const route of model.routeWorkspaces ?? []) {
		const card = element("article", `gnd-route-workspace is-${route.status}`);
		card.dataset.gndRouteWorkspace = route.id;
		card.append(element("strong", "", `Strecke ${route.route}`), element("small", "", route.status));
		const roles = element("ul", "gnd-route-workspace__roles");
		for (const role of route.roles) {
			const item = element("li", `is-${role.status}`);
			item.dataset.gndRouteRole = role.code;
			item.append(element("strong", "", `${role.code} · ${role.label}`), element("span", "", ["EL", "EH", "EU", "EK"].map((family) => `${family} ${role.families[family]}`).join(" · ")));
			roles.append(item);
		}
		card.append(roles);
		for (const diagnostic of route.diagnostics) card.append(element("p", "gnd-route-workspace__diagnostic", diagnostic));
		const action = button(`Review-Satz übernehmen (${route.promotableItemIds.length})`, "gnd-promote-route", route.id);
		action.disabled = route.promotableItemIds.length === 0;
		card.append(action);
		section.append(card);
	}
	return section;
}

function renderDatasetCompletenessCockpit(dataset) {
	const section = element("section", "gnd-dataset-cockpit");
	section.dataset.gndDatasetStatus = dataset.status;
	section.append(
		element("p", "gnd-wb-kicker", "GND DATASET COCKPIT"),
		element("h2", "", `${dataset.sourceCount} Quellen · ${dataset.groups.length} Strecken-Prüfgruppen`),
		element("p", "gnd-dataset-cockpit__status", dataset.status),
	);
	const sources = element("details", "gnd-dataset-sources");
	const summary = element("summary", "", `Quellenbestand (${dataset.sources.length})`);
	sources.append(summary);
	const sourceList = element("ol", "gnd-dataset-sources__list");
	for (const source of dataset.sources) {
		const item = element("li");
		item.dataset.datasetSourceIndex = String(source.sourceIndex);
		item.append(element("span", "", source.path), element("strong", "", source.status));
		sourceList.append(item);
	}
	sources.append(sourceList);
	section.append(sources);
	const groups = element("div", "gnd-dataset-groups");
	for (const group of dataset.groups) groups.append(renderDatasetGroup(group));
	section.append(groups);
	return section;
}

function renderDatasetGroup(group) {
	const article = element("article", `gnd-dataset-group is-${group.status}`);
	article.dataset.datasetReviewGroup = group.id;
	article.append(
		element("header", "gnd-dataset-group__header", `Strecke ${group.route} · ${group.status}`),
		element("p", "gnd-dataset-group__fingerprint", group.sourceFingerprint ? `Quelle ${group.sourceFingerprint}` : "Quellfingerprint fehlt · Prüfung erforderlich"),
		element("p", "", group.sourcePaths.join(" · ") || "Quellpfad nicht verfügbar"),
	);
	const families = element("ul", "gnd-dataset-group__families");
	for (const family of ["PP", "EL", "EH", "EU", "EK"]) {
		const item = element("li", `is-${group.families[family]}`);
		item.dataset.datasetFamily = family;
		item.append(element("strong", "", family), element("span", "", group.families[family]));
		families.append(item);
	}
	article.append(families);
	const roles = element("p", "gnd-dataset-group__roles", group.roles.map((role) => `${role.code} ${role.status}`).join(" · "));
	article.append(roles, element("p", "gnd-dataset-group__association", `Quellenassoziation ${group.associationStatus}`));
	for (const diagnostic of group.diagnostics) article.append(element("p", "gnd-route-workspace__diagnostic", diagnostic));
	const actions = element("div", "gnd-wb-actions");
	for (const association of group.associationActions.filter((entry) => entry.status !== "reviewed")) {
		const review = button("Quellenassoziation prüfen", "dataset-source-association-review", association.candidateId);
		review.dataset.evidenceId = association.evidenceId;
		actions.append(review);
	}
	const promote = button(`Review-Satz übernehmen (${group.promotableItemIds.length})`, "gnd-promote-route", group.id);
	promote.disabled = group.promotableItemIds.length === 0;
	actions.append(promote);
	for (const objectId of group.canonicalObjectIds) actions.append(button(`Objekt ${objectId} öffnen`, "reopen-workspace-object", objectId));
	article.append(actions);
	return article;
}

function previewPoints(points) {
	const finite = (points ?? []).map((point) => ({ x: Number(point?.x), y: Number(point?.y) })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
	if (!finite.length) return "";
	const xs = finite.map((point) => point.x), ys = finite.map((point) => point.y);
	const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
	const spanX = Math.max(maxX - minX, 1), spanY = Math.max(maxY - minY, 1);
	return finite.map((point) => `${50 + ((point.x - minX) / spanX) * 900},${370 - ((point.y - minY) / spanY) * 320}`).join(" ");
}

function svgElement(tag) {
	return typeof document.createElementNS === "function" ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
}

function renderOutbox(model, selected) {
	const aside = element("aside", "gnd-wb-outbox");
	aside.append(element("p", "gnd-wb-pane-label", "OUTBOX"));
	if (!selected) {
		aside.append(element("p", "", "Kein übernehmbarer Alignment-Befund."));
		return aside;
	}
	const items = [...(model.items ?? []), ...(model.rejectedItems ?? [])]
		.filter((item) => String(item?.evidenceId ?? "") === String(selected.evidenceId));
	const eligible = items.filter(isEligible);
	aside.append(
		element("strong", "gnd-wb-pane-title", selected?.source?.fileName ?? selected.evidenceId),
		element("p", "", `${eligible.length} übernehmbar · ${items.length - eligible.length} zurückgehalten`),
	);
	for (const item of items) {
		const card = element("article", `gnd-wb-outbox-item ${isEligible(item) ? "is-ready" : "is-withheld"}`);
		card.append(
			element("strong", "", item?.payload?.name ?? item?.source?.objectName ?? item.id),
			element("span", "", `${geometryCount(item)} Elemente`),
			element("small", "", isEligible(item) ? "bereit zur Übernahme" : "fachlich zurückgehalten"),
		);
		if (isEligible(item)) card.append(button("Vorschau", "gnd-preview", item.id));
		card.append(button(isEligible(item) ? "Übernehmen & anzeigen" : "Nicht übernehmbar", "gnd-promote", item.id));
		card.children[card.children.length - 1].disabled = !isEligible(item);
		aside.append(card);
	}
	return aside;
}

function renderSevenLinePlan(model, selected) {
	const section = element("section", "gnd-wb-seven-line");
	section.dataset.sevenLinePlan = selected?.evidenceId ?? "absent";
	const header = element("header", "gnd-wb-seven-line__header");
	header.append(
		element("strong", "", "7-Linien-Plan"),
		element("span", "", "Kernel-Evidenz · Gleiszuordnung prüfen · keine automatische Gleiszuordnung"),
	);
	section.append(header);
	const rows = model.sevenLineRoleAssembly?.rows ?? [
		["gradient-right", "Gradiente rechts"], ["gradient-left", "Gradiente links"], ["cant-left", "Überhöhung links"],
		["curvature-left", "Krümmung links"], ["curvature-kilometer", "Krümmung km · Kilometrierung"], ["curvature-right", "Krümmung rechts"], ["cant-right", "Überhöhung rechts"],
	].map(([id, label]) => ({ id, label, status: "missing", reason: "PP role evidence unavailable" }));
	const graph = element("div", "gnd-wb-seven-line__graph");
	for (const entry of rows) {
		const status = String(entry?.status ?? "missing");
		const row = element("div", `gnd-wb-seven-line__row is-${status}`);
		row.dataset.evidenceStatus = status;
		row.dataset.sevenLineRole = entry.id;
		row.append(
			element("span", "gnd-wb-seven-line__label", entry.label),
			element("span", "gnd-wb-seven-line__track", ""),
			element("small", "", entry.placement === "presentation-placement-only" ? `${lineStatus(status)} · eingleisig · Darstellungsplatz, keine Gleisseite` : `${lineStatus(status)}${entry.reason ? ` · ${entry.reason}` : ""}`),
		);
		graph.append(row);
	}
	section.append(graph);
	return section;
}

function lineStatus(status) {
	if (status === "constructive") return "konstruktiv · Gleiszuordnung prüfen";
	if (status === "partial-evidence") return "Evidenz vorhanden · Zuordnung offen";
	if (status === "not-covered") return "nicht abgedeckt";
	if (status === "not-applicable") return "nicht anwendbar";
	if (status === "review-required") return "Prüfung erforderlich";
	if (status === "unassigned") return "nicht zugeordnet";
	return "fehlend";
}

function renderAlignmentFinding(model) {
	const section = element("section", "gnd-wb-alignment-finding");
	section.dataset.alignmentFinding = model?.context?.evidenceId ?? "unqualified";
	section.append(
		element("p", "gnd-wb-kicker", "Alignment-Befund"),
		element("h2", "", "Was ist fachlich verwendbar?"),
	);
	const list = element("ul", "gnd-wb-alignment-finding__grid");
	for (const key of ["horizontal", "vertical", "cant", "chainage"]) {
		const entry = model?.capabilities?.[key];
		if (!entry) continue;
		const item = element("li", "gnd-wb-alignment-finding__item");
		item.dataset.alignmentCapability = key;
		item.dataset.alignmentCapabilityStatus = entry.status;
		item.append(
			element("strong", "", entry.name),
			element("span", "", entry.status),
			element("small", "", entry.code ?? entry.reason ?? entry.evidenceId ?? ""),
		);
		list.append(item);
	}
	section.append(list);
	return section;
}

function renderWorkspaceStart(model) {
	const section = element("section", "gnd-wb-workspace-start");
	section.dataset.workspaceStartState = model.workspacePhase ?? "loading";
	section.append(
		element("p", "gnd-wb-start-brand", "alignmentOS · Wissenskern"),
		element("h1", "", "AIM Engineering Workspace"),
		element("p", "gnd-wb-start-lead", "Alignment-Wissen unten. Sichtbare Planung, Prüfung und Services oben."),
	);
	if (model.workspacePhase === "loading") {
		section.append(element("strong", "", "Arbeitsbereich wird geladen …"));
		return section;
	}
	if (model.workspacePhase === "error") {
		section.append(
			element("strong", "", "Arbeitsbereich nicht verfügbar"),
			element("p", "", "Der vorhandene Arbeitsstand konnte nicht gelesen werden."),
			button("Erneut laden", "workspace-retry", "true"),
		);
		return section;
	}
	const objects = Array.isArray(model.workspaceObjects) ? model.workspaceObjects : [];
	if (!objects.length) {
		const paths = element("div", "gnd-wb-start-paths");
		const importActions = element("div", "gnd-wb-start-actions");
		importActions.append(button("Dateien wählen", "import-choose-files", "true"));
		if (model.directoryPickerSupported === true) importActions.append(button("Ordner wählen", "import-choose-directory", "true"));
		else importActions.append(element("span", "gnd-wb-start-capability", "Ordner per Drag & Drop"));
		const createActions = element("div", "gnd-wb-start-actions gnd-wb-new-alignment");
		const name = element("input", "input"); name.dataset.newAlignmentName = ""; name.type = "text"; name.placeholder = "Name des Alignments"; name.setAttribute("aria-label", "Name des neuen Alignments"); name.disabled = model.newAlignmentPhase === "creating";
		const create = button(model.newAlignmentPhase === "creating" ? "Alignment wird angelegt …" : model.newAlignmentPhase === "error" ? "Erneut anlegen" : "Neues Alignment anlegen", "create-alignment", "true"); create.disabled = model.newAlignmentPhase === "creating";
		createActions.append(name, create);
		paths.append(
			startPath("01", "Daten hier ablegen / Datei wählen", "Mehrere Dateien und ganze Verzeichnisse hineinziehen; sie werden als ein Dataset gemeinsam analysiert.", importActions, true),
			startPath("02", "Vorhandene Objekte öffnen", "Persistierte Arbeitsstände im Objekt-Overlay suchen und fokussieren.", button("Objekte öffnen", "open-workspace-objects", "true")),
			startPath("03", "Neue Trasse anlegen", "Explizit benannt, zunächst ohne erfundene Geometrie, Geschwindigkeit, Stationierung oder CRS-Zuordnung.", createActions),
		);
		section.append(paths);
	} else {
		section.append(
			element("p", "gnd-wb-kicker", "Vorhandenen Arbeitsbereich wieder öffnen"),
			element("h2", "", "Weiterarbeiten"),
			element("p", "gnd-wb-start-count", `${objects.length} kanonische${objects.length === 1 ? "s Objekt" : " Objekte"} im Arbeitsstand`),
		);
		const list = element("ul", "gnd-wb-workspace-objects");
		for (const [index, object] of objects.entries()) {
			const item = element("li");
			item.append(
				element("span", "", `${String(object?.meta?.label ?? object?.name ?? object?.id)} · ${String(object?.id)}`),
				button(index === 0 ? "Weiterarbeiten" : "Öffnen", "reopen-workspace-object", String(object?.id)),
			);
			list.append(item);
		}
		section.append(list, button("Alle Objekte", "open-workspace-objects", "true"));
	}
	if (model.workspaceFeedback) section.append(message(model.workspaceFeedback, "error"));
	return section;
}

function startPath(number, title, copy, action, primary = false) {
	const article = element("article", `gnd-wb-start-path${primary ? " is-primary" : ""}`);
	article.append(
		element("span", "gnd-wb-start-path__number", number),
		element("h2", "", title),
		element("p", "", copy),
		action,
	);
	return article;
}

function renderImportLifecycle(model) {
	const detail = model.dropState ?? model.lifecycle;
	if (!detail) {
		const ready = element("section", "gnd-wb-drop-state gnd-wb-drop-state--ready");
		ready.dataset.importLifecycleState = "ready";
		ready.append(element("strong", "", "Bereit."));
		return ready;
	}
	const state = String(detail?.state ?? "unknown");
	const section = element("section", `gnd-wb-drop-state gnd-wb-drop-state--${state}`);
	section.dataset.importLifecycleState = state;
	if (state === "drag-active") {
		section.dataset.importDropTarget = "active";
		section.append(
			element("strong", "", "Dateien hier ablegen"),
			element("p", "", "Die Dateien werden nach dem Ablegen analysiert."),
		);
		return section;
	}
	const fileNames = Array.isArray(detail?.fileNames) ? detail.fileNames : [];
	const fileStates = Array.isArray(detail?.fileStates) ? detail.fileStates : [];
	const fileCount = Number(detail?.fileCount ?? fileNames.length ?? 0);
	const job = model.jobSnapshot ?? detail?.job ?? null;
	const busy = ["accepted", "processing"].includes(state);
	if (busy) section.dataset.importBusy = "true";
	section.append(
		element("strong", "", lifecycleLabel(state, model)),
		element("p", "", `${fileCount} Datei${fileCount === 1 ? "" : "en"} zur Analyse angenommen · ein Dataset`),
	);
	if (fileStates.length || fileNames.length) {
		const list = element("ul", "gnd-wb-drop-files");
		const hasExplicitFileStates = fileStates.length > 0;
		const rows = hasExplicitFileStates
			? fileStates
			: fileNames.map((fileName) => ({ fileName, state: busy ? "processing" : state }));
		for (const row of rows) {
			const item = element("li", `gnd-wb-drop-file gnd-wb-drop-file--${String(row?.state ?? "unknown")}`);
			item.dataset.importFileState = String(row?.state ?? "unknown");
			item.append(
				element("span", "gnd-wb-drop-file__name", !hasExplicitFileStates && busy
					? `${String(row?.fileName ?? "")} wird verarbeitet …`
					: String(row?.fileName ?? "")),
				element("strong", "gnd-wb-drop-file__state", fileStateLabel(row?.state, row?.phase)),
			);
			list.append(item);
		}
		section.append(list);
	}
	if (busy) {
		const activeFileName = String(detail?.activeFileName ?? fileNames[0] ?? "Datei");
		const importCode = detail?.importPhase?.code;
		const phaseEvidence = importCode
			? `${activeFileName}: ${String(importCode)} …`
			: `${activeFileName}: ${String(job?.phase ?? state)} …`;
		const progress = element("p", "gnd-wb-import-progress", `⏳ ${phaseEvidence}`);
		progress.dataset.importJobPhase = String(job?.phase ?? state);
		progress.dataset.importHeartbeat = String(job?.heartbeatAt ?? "pending");
		if (importCode) progress.dataset.importPhase = String(importCode);
		section.append(progress);
	} else if (detail?.message || detail?.code) {
		section.append(element("p", "gnd-wb-import-result", detail?.message ?? detail?.code));
	}
	if (["failed", "rejected", "cancelled"].includes(state)) {
		section.append(button("Import erneut versuchen", "import-retry", "true"));
	}
	return section;
}

function fileStateLabel(state, phase) {
	if (state === "queued") return "wartet";
	if (state === "processing") return phase ? `aktiv · ${phase}` : "aktiv";
	if (state === "staged") return "analysiert";
	if (state === "completed") return "abgeschlossen";
	if (state === "failed") return "fehlgeschlagen";
	if (state === "unsupported") return "nicht unterstützt";
	return String(state ?? "unbekannt");
}

function lifecycleLabel(state, model) {
	if (state === "accepted") return "Drop-Inhalt wird gelesen …";
	if (state === "processing") return "Import wird analysiert";
	if (state === "completed") return completedLabel(model?.fileOutcomes);
	if (state === "cancelled") return "Import abgebrochen";
	if (state === "failed") return "Import fehlgeschlagen";
	if (state === "rejected") return "Import abgelehnt";
	return `Import: ${state}`;
}

function completedLabel(fileOutcomes = []) {
	const statuses = (Array.isArray(fileOutcomes) ? fileOutcomes : [])
		.map((entry) => String(entry?.status ?? "").toLowerCase());
	const hasFailure = statuses.some((status) => ["failed", "rejected", "unsupported", "unknown"].includes(status));
	const hasResult = statuses.some((status) => !["failed", "rejected", "unsupported", "unknown"].includes(status));
	if (hasFailure && hasResult) return "Import teilweise erkannt";
	if (statuses.some((status) => status === "partial")) return "Import teilweise erkannt";
	if (statuses.some((status) => status === "unsupported")) return "Import nicht unterstützt";
	if (statuses.some((status) => status === "unknown")) return "Import nicht erkannt";
	if (statuses.some((status) => status === "rejected")) return "Import abgelehnt";
	if (statuses.some((status) => status === "failed")) return "Import fehlgeschlagen";
	return "Import erkannt / abgeschlossen";
}

function isImportBusy(model) {
	return ["accepted", "processing"].includes(String(model.lifecycle?.state ?? ""));
}

function renderFileOutcomes(model) {
	const section = element("section", "gnd-wb-outcomes");
	section.dataset.importFileOutcomes = "";
	section.append(element("h2", "", "Import outcomes"));
	for (const outcome of model.fileOutcomes) {
		const article = element("article", "gnd-wb-outcome");
		article.dataset.importFileOutcome = String(outcome?.fileName ?? outcome?.status ?? "unknown");
		const facts = element("dl", "gnd-wb-facts gnd-wb-facts--wide");
		addFact(facts, "Filename", outcome?.fileName);
		addFact(facts, "Parser", outcome?.parserId);
		addFact(facts, "Status", outcome?.status);
		addFact(facts, "Reason", outcome?.reason);
		addFact(facts, "Items", outcome?.itemCount);
		addFact(facts, "Rejected", outcome?.rejectedCount);
		addFact(facts, "Evidence published", String(outcome?.evidencePublished === true));
		article.append(facts);
		section.append(article);
	}
	return section;
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
	if (model.feedback) {
		const feedback = message(t(model.feedback), model.feedback.endsWith("failed") ? "error" : "success");
		if (model.promotedObjectId) feedback.dataset.promotedObjectId = model.promotedObjectId;
		section.append(feedback);
	}
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
	const transferred = item?.status?.accepted === true || String(model.promotedItemId ?? "") === String(item.id);
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
	const promote = button(transferred ? t("gnd_workbench.transferred") : "Übernehmen & anzeigen", "gnd-promote", item.id);
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
