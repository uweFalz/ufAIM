const ORDER = ["horizontal", "vertical", "cant", "chainage", "crs", "speed", "topology", "section"];

export class ExistingAlignmentIntelligenceView {
	constructor({ documentRef = globalThis.document, actions = {} } = {}) {
		this.document = documentRef;
		this.root = documentRef?.getElementById?.("alignmentIntelligence") ?? null;
		this.actions = actions;
	}

	render(model) {
		const root = this.document?.getElementById?.("alignmentIntelligence") ?? this.root;
		if (!root) return false;
		this.root = root;
		root.dataset.alignmentIntelligenceStatus = model?.status ?? "finding";
		root.dataset.alignmentIntelligenceMode = model?.mode ?? "main";
		root.dataset.alignmentObjectId = model?.context?.objectId ?? "";
		root.dataset.alignmentEvidenceId = model?.context?.evidenceId ?? "";
		this.renderContextBar(model?.contextBar);
		this.renderHud(root, model?.hud);
		this.renderDesignSessionBoard(root, model?.designSessionBoard);
		this.renderReceiptRail(root,model?.receiptRail);
		this.renderIssueNavigator(root,model?.issueNavigator);
		this.renderTaskRail(root, model?.taskRail);
		this.renderGeoreferenceQualification(root, model?.georeferenceQualification);
		this.renderQLokEngineeringView(root, model?.qLokEngineeringView);
		this.renderElementSelection(root, model?.elementSelection);
		const identity = root.querySelector("[data-alignment-intelligence-identity]");
		if (identity) {
			const context = model?.context ?? {};
			identity.textContent = context.objectId
				? `${String(context.objectId)} · revision ${String(context.revision ?? "unknown")} · s ${String(context.s)}`
				: `Import finding · ${String(context.evidenceId ?? "no evidence")}`;
			const crs = model?.capabilities?.crs;
			const camera = this.document.createElement("small");
			camera.dataset.alignmentCameraContext = "";
			camera.textContent = model?.mode === "l" ? "intrinsic s camera" : model?.mode === "q" ? `Lok camera · ${crs?.status === "constructive" ? "qualified source · local engineering view" : "local engineering view"}` : crs?.status === "constructive" ? "qualified map context" : "local map · no EPSG claim";
			identity.append?.(camera);
		}
		const list = root.querySelector("[data-alignment-intelligence-capabilities]");
		if (!list) return true;
		list.replaceChildren();
		for (const key of ORDER) {
			const entry = model?.capabilities?.[key];
			if (!entry) continue;
			const item = this.document.createElement("li");
			item.dataset.alignmentCapability = key;
			item.dataset.alignmentCapabilityStatus = entry.status;
			const label = this.document.createElement("strong");
			label.textContent = entry.name;
			const status = this.document.createElement("span");
			status.textContent = entry.status;
			const reason = this.document.createElement("small");
			reason.textContent = entry.code ?? entry.reason ?? entry.evidenceId ?? "";
			item.append(label, status, reason);
			if (key === "topology") {
				const detail = this.document.createElement("small");
				detail.dataset.alignmentTopologyEvidence = "";
				detail.textContent = [
					entry.relationStatus,
					entry.reviewedCandidateId ? `candidate ${entry.reviewedCandidateId}` : null,
					entry.reviewRevision > 0 ? `revision ${entry.reviewRevision}` : null,
					entry.claimScope,
					entry.intrinsicMappingStatus ? `intrinsic-mapping ${entry.intrinsicMappingStatus}` : null,
					entry.domainRelationStatus ? `domain-relation ${entry.domainRelationStatus}` : null,
					entry.reviewProvenancePresent ? "review-provenance present" : null,
				].filter(Boolean).join(" · ");
				item.append(detail);
			}
			if (entry.sourceRefs?.length) item.dataset.alignmentCapabilitySources = entry.sourceRefs.join(",");
			list.append(item);
		}
		if (model?.sevenLineRoleAssembly) {
		let bands = root.querySelector("[data-alignment-seven-line-bands]");
		if (!bands?.dataset || !Object.hasOwn(bands.dataset, "alignmentSevenLineBands")) { bands = this.document.createElement("section"); bands.dataset.alignmentSevenLineBands = ""; root.append?.(bands); }
		bands.replaceChildren?.();
		bands.hidden = model?.mode !== "l";
		for (const entry of model.sevenLineRoleAssembly.rows ?? []) {
			const line = this.document.createElement("div");
			line.dataset.sevenLineRole = entry.id; line.dataset.evidenceStatus = entry.status;
			line.textContent = `${entry.label} · ${entry.status}${entry.placement === "presentation-placement-only" ? " · eingleisig · Darstellungsplatz, keine Gleisseite" : ""}`;
			bands.append(line);
		}
		}
		return true;
	}

	renderIssueNavigator(root,model){if(!model)return;let panel=root.querySelector?.("[data-design-issue-navigator]");if(!panel){panel=this.document.createElement("section");panel.dataset.designIssueNavigator="";root.append?.(panel);}panel.dataset.issueNavigatorStatus=model.status;panel.dataset.issueNavigatorMode=model.mode;panel.replaceChildren?.();const heading=this.document.createElement("strong");heading.textContent="Befunde";panel.append?.(heading);if(model.status==="empty"){const empty=this.document.createElement("p");empty.textContent=model.message??"Keine transportierten Befunde";panel.append?.(empty);return;}const list=this.document.createElement("ol");list.dataset.designIssueList="";for(const issue of model.issues){const row=this.document.createElement("li");row.dataset.designIssueId=issue.id;row.dataset.designIssueDiscipline=issue.discipline;row.dataset.designIssueStatus=issue.status;const title=this.document.createElement("strong");title.textContent=`${issue.category} · ${issue.status}`;const detail=this.document.createElement("span");detail.textContent=[issue.code,issue.reason,issue.elementId?`Element ${issue.elementId}`:null,issue.mappingId?`Mapping ${issue.mappingId}`:null,`Provenienz ${issue.provenancePresent?"vorhanden":"nicht belegt"}`].filter(Boolean).join(" · ");const action=this.document.createElement("button");action.type="button";action.textContent="Öffnen";const target={source:"design-issue-navigator",objectId:issue.objectId,discipline:issue.discipline,elementId:issue.elementId,mappingId:issue.mappingId,targetAction:issue.targetAction},handler=this.actions?.[issue.action];action.disabled=typeof handler!=="function"||this.actions?.canOpenIssue?.(target)!==true;if(action.disabled)action.title=issue.reason??"Passende bestehende Aktion nicht verfügbar";else action.addEventListener?.("click",()=>handler(target));row.append?.(title,detail,action);list.append?.(row);}panel.append?.(list);}

	renderReceiptRail(root,model){if(!model)return;let rail=root.querySelector?.("[data-canonical-authoring-receipt-rail]");if(!rail){rail=this.document.createElement("aside");rail.dataset.canonicalAuthoringReceiptRail="";root.append?.(rail);}rail.hidden=model.status==="empty";rail.replaceChildren?.();if(rail.hidden)return;rail.dataset.receiptStatus=model.status;const receipt=model.receipt,title=this.document.createElement("strong");title.textContent="Kanonischer Readback bestätigt";const facts=this.document.createElement("span");facts.textContent=[receipt.objectId,`revision ${String(receipt.revision)}`,receipt.discipline,receipt.elementId?`Element ${receipt.elementId}`:null,receipt.operation,receipt.source,`lokales Event ${String(receipt.occurredAt)}`].filter(Boolean).join(" · ");const note=this.document.createElement("small");note.textContent="Fensterlokale Rückmeldung · kein Audit-Log und keine Historie";const focus=this.document.createElement("button");focus.type="button";focus.textContent="Ergebnis fokussieren";focus.disabled=!model.actionable||typeof this.actions?.focusReceipt!=="function";if(!focus.disabled)focus.addEventListener?.("click",()=>this.actions.focusReceipt(receipt));rail.append?.(title,facts,note,focus);}

	renderDesignSessionBoard(root, board) {
		if (!board) return;
		let section = root.querySelector?.("[data-alignment-design-session]");
		if (!section) { section = this.document.createElement("section"); section.dataset.alignmentDesignSession = ""; root.append?.(section); }
		section.hidden = board.status !== "active"; section.replaceChildren?.();
		if (section.hidden) return;
		section.dataset.objectId = board.context.objectId; section.dataset.sessionMode = board.mode;
		const header = this.document.createElement("header"); const title = this.document.createElement("strong"); title.textContent = "Design-Session";
		const context = this.document.createElement("span"); context.textContent = `${board.context.objectId} · revision ${String(board.context.revision ?? "nicht belegt")} · s ${String(board.context.s ?? "nicht belegt")}`; header.append?.(title, context); section.append?.(header);
		const list = this.document.createElement("div"); list.dataset.designSessionAreas = "";
		for (const area of board.areas) {
			const card = this.document.createElement("article"); card.dataset.designSessionArea = area.id; card.dataset.designSessionStatus = area.status;
			const label = this.document.createElement("strong"); label.textContent = area.label;
			const facts = this.document.createElement("span"); facts.textContent = [area.status, area.count !== null ? `${area.count} Elemente` : "Anzahl nicht belegt", area.selectedElementId ? `Auswahl ${area.selectedElementId}` : null].filter(Boolean).join(" · ");
			const detail = this.document.createElement("small"); detail.textContent = [area.reason, `Provenienz ${area.provenancePresent ? "vorhanden" : "nicht belegt"}`,area.receipt?`Readback revision ${String(area.receipt.revision)}`:null].filter(Boolean).join(" · ");
			const button = this.document.createElement("button"); button.type = "button"; button.textContent = `${area.label} öffnen`; button.disabled = !area.enabled || typeof this.actions?.[area.action] !== "function"; if (!button.disabled) button.addEventListener?.("click", () => this.actions[area.action]({ source: "design-session", objectId: board.context.objectId, discipline: area.id, elementId: area.selectedElementId }));
			card.append?.(label, facts, detail, button); list.append?.(card);
		}
		section.append?.(list);
	}

	renderContextBar(model) {
		const bar = this.document?.getElementById?.("workspaceContextBar");
		if (!bar || !model) return;
		bar.dataset.contextBarStatus = model.status; bar.dataset.contextBarMode = model.mode; bar.dataset.objectId = model.context?.objectId ?? ""; bar.replaceChildren?.();
		const facts = this.document.createElement("div"); facts.dataset.contextBarFacts = "";
		for (const value of [model.context?.objectId ?? "Kein aktives Objekt", model.context?.route ? `Strecke ${model.context.route}` : null, model.context?.sourceRole ? `Rolle ${model.context.sourceRole}` : null, model.context?.objectId ? (Number.isFinite(model.context?.s) ? `s ${model.context.s}` : "s nicht belegt") : null, model.context?.coordinateMode]) { if (!value) continue; const item = this.document.createElement("span"); item.textContent = value; facts.append?.(item); }
		const modes = this.document.createElement("div"); modes.dataset.contextBarModes = "";
		for (const mode of model.actions?.modes ?? []) { const button = this.document.createElement("button"); button.type = "button"; button.dataset.contextBarMode = mode; button.textContent = mode === "main" ? "Main" : mode === "q" ? "q · Lok" : "L · Bänder"; button.setAttribute?.("aria-pressed", String(mode === model.mode)); button.addEventListener?.("click", () => this.actions?.activateMode?.(mode)); modes.append?.(button); }
		const actions = this.document.createElement("div"); actions.dataset.contextBarActions = "";
		this.appendContextAction(actions, "Workbench", this.actions?.openReview, model.actions?.openWorkbench);
		this.appendContextAction(actions, "Objekte", this.actions?.openObjects, model.actions?.openObjects);
		this.appendContextAction(actions, "Tasks", this.actions?.openTaskRail, model.actions?.openTaskRail);
		this.appendContextAction(actions, "Wechseln", this.actions?.openQuickSwitcher, true);
		bar.append?.(facts, modes, actions);
	}

	appendContextAction(host, label, action, enabled) { const button = this.document.createElement("button"); button.type = "button"; button.textContent = label; button.disabled = !enabled || typeof action !== "function"; if (!button.disabled) button.addEventListener?.("click", action); host.append?.(button); }

	renderElementSelection(root, model) {
		if (!model) return;
		let panel = root.querySelector?.("[data-cross-view-element-property]");
		if (!panel) { panel = this.document.createElement("section"); panel.dataset.crossViewElementProperty = ""; root.append?.(panel); }
		panel.hidden = model.status !== "selected"; panel.replaceChildren?.(); if (panel.hidden) return;
		panel.dataset.elementDiscipline = model.selection.discipline; panel.dataset.elementId = model.selection.elementId;
		const title = this.document.createElement("strong"); title.textContent = `${model.selection.discipline} · ${model.selection.elementId}`;
		const domain = this.document.createElement("span"); domain.textContent = model.property.domain ? `${model.property.type ?? "Element"} · s ${String(model.property.domain.startS)}..${String(model.property.domain.endS)}` : `${model.property.type ?? "Element"} · Domain nicht belegt`;
		const properties = this.document.createElement("pre"); properties.dataset.crossViewElementProperties = ""; properties.textContent = JSON.stringify(model.property.properties, null, 2);
		const provenance = this.document.createElement("small"); provenance.textContent = `Provenienz ${model.property.provenancePresent ? "vorhanden" : "nicht belegt"}`;
		const edit = this.document.createElement("button"); edit.type = "button"; edit.textContent = "Bestehende Bearbeitung öffnen"; edit.disabled = typeof this.actions?.[model.property.action] !== "function"; edit.dataset.authoringDiscipline = model.selection.discipline; edit.dataset.authoringElementId = model.selection.elementId; if (!edit.disabled) edit.addEventListener?.("click", () => this.actions[model.property.action]({ source: "workspace-property", ...model.selection }));
		panel.append?.(title, domain, properties, provenance, edit);
	}

	renderQLokEngineeringView(root, lok) {
		if (!lok) return;
		let panel = root.querySelector?.("[data-q-lok-engineering-view]");
		if (!panel) { panel = this.document.createElement("section"); panel.dataset.qLokEngineeringView = ""; root.append?.(panel); }
		panel.hidden = !lok.visible; panel.replaceChildren?.();
		if (!lok.visible) return;
		panel.dataset.objectId = lok.context?.objectId ?? ""; panel.dataset.cursorS = String(lok.context?.s ?? "");
		const header = this.document.createElement("header");
		const title = this.document.createElement("strong"); title.textContent = "q · Lok-View";
		const context = this.document.createElement("span"); context.textContent = [lok.context?.objectId, Number.isFinite(lok.context?.s) ? `s ${lok.context.s}` : null, lok.context?.route ? `Strecke ${lok.context.route}` : null, lok.context?.sourceRole ? `Quellrolle ${lok.context.sourceRole}` : null, "LOCAL engineering camera"].filter(Boolean).join(" · ");
		header.append?.(title, context); panel.append?.(header);
		const current = this.document.createElement("div"); current.dataset.qLokCurrent = "";
		for (const field of lok.fields ?? []) {
			const card = this.document.createElement("article"); card.dataset.qLokField = field.id; card.dataset.qLokStatus = field.status;
			const label = this.document.createElement("strong"); label.textContent = field.label;
			const value = this.document.createElement("span"); value.textContent = formatHudValue(field.value) ?? field.reason ?? "—";
			const status = this.document.createElement("small"); status.textContent = `${field.status} · Provenienz ${field.provenancePresent ? "vorhanden" : "nicht belegt"}${field.reason ? ` · ${field.reason}` : ""}`;
			card.append?.(label, value, status); current.append?.(card);
		}
		panel.append?.(current);
		const ahead = this.document.createElement("aside"); ahead.dataset.qLokAhead = "";
		ahead.textContent = lok.ahead ? `Voraus · nächste vorhandene Grenze s ${String(lok.ahead.s)} · ${lok.ahead.lanes.join(", ")}` : "Voraus · keine vorhandene nächste Grenze belegt";
		panel.append?.(ahead);
	}

	renderGeoreferenceQualification(root, qualification) {
		if (!qualification) return;
		let section = root.querySelector?.("[data-main-georeference-qualification]");
		if (!section) { section = this.document.createElement("section"); section.dataset.mainGeoreferenceQualification = ""; root.append?.(section); }
		section.hidden = !qualification?.visible;
		section.dataset.coordinateMode = qualification?.coordinateMode ?? "local-cartesian";
		section.dataset.mapReady = qualification?.mapReady ? "true" : "false";
		section.replaceChildren?.();
		if (!qualification?.visible) return;
		const heading = this.document.createElement("header");
		const title = this.document.createElement("strong"); title.textContent = "Georeferenz qualifizieren";
		const state = this.document.createElement("span"); state.textContent = qualification.coordinateMode === "qualified" ? `QUALIFIED · ${qualification.resolvedEpsg}` : "LOCAL · kein EPSG-Claim";
		heading.append?.(title, state); section.append?.(heading);
		const facts = this.document.createElement("dl"); facts.dataset.georeferenceFacts = "";
		for (const [label, value] of [
			["Quell-CRS", qualification.sourceCrs ?? "nicht belegt"],
			["Validierung", qualification.validationStatus],
			["Transform", qualification.transformationAvailable ? "vorhandene freigegebene Transformation" : "nicht verfügbar"],
			["Koordinaten-Provenienz", qualification.coordinateProvenance ?? (qualification.provenancePresent ? "vorhanden" : "nicht belegt")],
			["Karte / Marker", qualification.mapReady ? `Karte bereit · Marker ${qualification.markerReady ? "bereit" : "nicht verfügbar"}` : "Karte nicht bereit · Marker nicht verfügbar"],
		]) {
			const row = this.document.createElement("div"); const term = this.document.createElement("dt"); const detail = this.document.createElement("dd");
			term.textContent = label; detail.textContent = String(value); row.append?.(term, detail); facts.append?.(row);
		}
		section.append?.(facts);
		const diagnostic = this.document.createElement("p"); diagnostic.dataset.georeferenceDiagnostic = "";
		diagnostic.textContent = [qualification.reason, ...(qualification.warnings ?? [])].filter(Boolean).join(" · ") || "CRS und Transformation qualifiziert";
		section.append?.(diagnostic);
		const actions = this.document.createElement("div"); actions.dataset.georeferenceActions = "";
		const map = this.document.createElement("button"); map.type = "button"; map.textContent = "Auf Karte zeigen"; map.disabled = !qualification.actions?.showOnMap || typeof this.actions?.showOnMap !== "function";
		if (qualification.reason && map.disabled) map.title = qualification.reason;
		if (!map.disabled) map.addEventListener?.("click", this.actions.showOnMap); actions.append?.(map);
		this.appendHudAction(actions, qualification.actions?.openObjects, "Objekte", this.actions.openObjects);
		this.appendHudAction(actions, qualification.actions?.openImport, "Import öffnen", this.actions.openImport);
		this.appendHudAction(actions, qualification.actions?.openReview, "Review öffnen", this.actions.openReview);
		section.append?.(actions);
	}

	renderTaskRail(root, rail) {
		if (!rail) return;
		let section = root.querySelector?.("[data-alignment-task-rail]");
		if (!section) { section = this.document.createElement("section"); section.dataset.alignmentTaskRail = ""; root.append?.(section); }
		section.dataset.taskRailMode = rail.mode;
		section.dataset.taskRailObjectId = rail.context?.objectId ?? "";
		section.tabIndex = -1;
		section.replaceChildren?.();
		const heading = this.document.createElement("header");
		const title = this.document.createElement("strong"); title.textContent = "Was kann ich mit diesem Alignment tun?";
		const context = this.document.createElement("span"); context.textContent = [rail.context?.objectId, Number.isFinite(rail.context?.s) ? `s ${rail.context.s}` : null].filter(Boolean).join(" · ");
		heading.append?.(title, context); section.append?.(heading);
		const list = this.document.createElement("div"); list.dataset.alignmentTaskList = "";
		for (const task of rail.tasks ?? []) {
			const card = this.document.createElement("article"); card.dataset.alignmentTask = task.id; card.dataset.alignmentTaskStatus = task.status;
			const label = this.document.createElement("strong"); label.textContent = task.label;
			const status = this.document.createElement("span"); status.textContent = `${task.status}${task.count !== null ? ` · ${task.count} Elemente` : ""}`;
			const reason = this.document.createElement("small"); reason.textContent = `${task.reason ?? ""}${task.provenancePresent ? `${task.reason ? " · " : ""}Provenienz vorhanden` : ""}`;
			const button = this.document.createElement("button"); button.type = "button"; button.dataset.alignmentTaskAction = task.action; button.textContent = task.actionLabel; button.disabled = !task.enabled;
			if (!task.enabled && task.reason) button.title = task.reason;
			if (task.enabled && typeof this.actions?.[task.action] === "function") button.addEventListener?.("click", () => this.actions[task.action]({ source: "task-rail", objectId: rail.context?.objectId ?? null, discipline: task.id, elementId: null }));
			else if (task.enabled) { button.disabled = true; button.title = "Aktion ist in diesem Arbeitsraum nicht verfügbar"; }
			card.append?.(label, status, reason, button); list.append?.(card);
		}
		section.append?.(list);
	}

	renderHud(root, hud) {
		if (!hud) return;
		let section = root.querySelector?.("[data-alignment-engineering-hud]");
		if (!section) { section = this.document.createElement("section"); section.dataset.alignmentEngineeringHud = ""; root.append?.(section); }
		section.dataset.hudMode = hud.mode;
		section.replaceChildren?.();
		const context = this.document.createElement("div"); context.dataset.hudContext = "";
		context.textContent = [hud.context?.objectId, hud.context?.route ? `Strecke ${hud.context.route}` : null, hud.context?.sourceRole ? `Quellrolle ${hud.context.sourceRole}` : null, Number.isFinite(hud.context?.s) ? `s ${hud.context.s}` : null].filter(Boolean).join(" · ");
		section.append?.(context);
		const values = this.document.createElement("div"); values.dataset.hudValues = "";
		for (const field of hud.fields ?? []) {
			const item = this.document.createElement("article"); item.dataset.hudField = field.id; item.dataset.hudStatus = field.status;
			const label = this.document.createElement("strong"); label.textContent = field.label;
			const value = this.document.createElement("span"); value.textContent = formatHudValue(field.value) ?? field.reason ?? "—";
			const status = this.document.createElement("small"); status.textContent = `${field.status} · provenance ${field.provenancePresent ? "present" : "absent"}${field.reason ? ` · ${field.reason}` : ""}`;
			item.append?.(label, value, status); values.append?.(item);
		}
		section.append?.(values);
		const actions = this.document.createElement("div"); actions.dataset.hudActions = "";
		this.appendHudAction(actions, hud.actions?.openObjects, "Objekte", this.actions.openObjects);
		this.appendHudAction(actions, hud.actions?.openImport, "Fehlende Quelle importieren", this.actions.openImport);
		this.appendHudAction(actions, hud.actions?.openReview, "Review öffnen", this.actions.openReview);
		section.append?.(actions);
	}

	appendHudAction(host, visible, label, action) {
		if (!visible || typeof action !== "function") return;
		const button = this.document.createElement("button"); button.type = "button"; button.textContent = label; button.addEventListener?.("click", action); host.append?.(button);
	}

	wireModeChanges(handler) {
		if (typeof this.document?.addEventListener !== "function" || typeof handler !== "function") return null;
		const onClick = (event) => {
			if (!event?.target?.closest?.("[data-workspace-view-mode]")) return;
			queueMicrotask(handler);
		};
		this.document.addEventListener("click", onClick);
		return () => this.document.removeEventListener?.("click", onClick);
	}
}

function formatHudValue(value) {
	if (value === null || value === undefined) return null;
	if (typeof value !== "object") return String(value);
	return Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined).map(([key, entry]) => `${key} ${typeof entry === "object" ? JSON.stringify(entry) : String(entry)}`).join(" · ") || null;
}

export default ExistingAlignmentIntelligenceView;
