import { getWorkspacePrimaryId } from "@src/shared/runtime/workspaceSelectionAccess.js";
import { AlignmentEditorController } from "@app/controllers/alignmentEditorController.js";
import { dispatchProductiveAlignmentChange } from "@app/controllers/alignmentCreationController.js";
import { t } from "@app/i18n/strings.js";
import { buildHorizontalSequenceConsequenceReview } from "@app/domain/workspace/buildHorizontalSequenceConsequenceReview.js";
import { clearDraftAfterCanonicalRefresh, createAuthoringDraftStore } from "@app/domain/workspace/createAuthoringDraftStore.js";
import { createAuthoringChangePreview } from "@app/view/workspace/renderAuthoringChangePreview.js";
import { buildHorizontalRealizationChangeReceipt } from "@app/domain/workspace/buildHorizontalRealizationChangeReceipt.js";
import { renderHorizontalRealizationChangeReceipt } from "@app/view/workspace/renderHorizontalRealizationChangeReceipt.js";

function unwrap(raw) { return raw?.state ?? raw?.payload ?? raw ?? null; }
function asNumber(value) { if (value == null || String(value).trim() === "") return undefined; const number = Number(value); return Number.isFinite(number) ? number : Number.NaN; }

export function resolveArcEditChange({ curvature, radius, authority } = {}) {
	return authority === "radius"
		? { radius: asNumber(radius) }
		: { curvature: asNumber(curvature) };
}

export function resolveAlignmentAuthoringTarget({ activeObjectId = null, requestedObjectId = null, discipline = "horizontal", elementId = null } = {}) {
	const active = String(activeObjectId ?? "").trim();
	const requested = String(requestedObjectId ?? "").trim();
	const element = String(elementId ?? "").trim();
	if (!active || discipline !== "horizontal" || (requested && requested !== active)) return Object.freeze({ supported: false, objectId: active || null, discipline, elementId: element || null });
	return Object.freeze({ supported: true, objectId: active, discipline: "horizontal", elementId: element || null });
}

export function resolveAlignmentEditorElementChoice({ requestedElementId = null, previousElementId = null, workspaceElementId = null, elements = [] } = {}) {
	const ids = new Set(elements.map((entry) => String(entry?.id ?? "")).filter(Boolean));
	const requested = String(requestedElementId ?? "").trim();
	if (requested) return Object.freeze({ requested: true, found: ids.has(requested), selectedId: ids.has(requested) ? requested : "" });
	const selectedId = [previousElementId, workspaceElementId, elements[0]?.id].map((value) => String(value ?? "").trim()).find((value) => ids.has(value)) ?? "";
	return Object.freeze({ requested: false, found: true, selectedId });
}

export function authorizeHorizontalElementRemoval({ activeObjectId = null, snapshotObjectId = null, selectedElementId = null, requestedElementId = null, elements = [] } = {}) {
	const active = String(activeObjectId ?? "").trim();
	const snapshot = String(snapshotObjectId ?? "").trim();
	const selected = String(selectedElementId ?? "").trim();
	const requested = String(requestedElementId ?? "").trim();
	const matches = elements.filter((entry) => String(entry?.id ?? "").trim() === requested);
	const authorized = Boolean(active && active === snapshot && requested && requested === selected && matches.length === 1);
	return Object.freeze({ authorized, objectId: active || null, elementId: requested || null, reason: authorized ? null : "exact active horizontal element unavailable" });
}

export function makeAlignmentEditorBridge({ store, ui, messaging, receiptSource = null } = {}) {
	if (!store?.getState || !messaging?.sendCmdAwait) throw new Error("AlignmentEditorBridge: missing runtime dependencies");
	const controller = new AlignmentEditorController({ store, messaging });
	const overlay = document.getElementById("alignmentEditorOverlay");
	const openButton = document.getElementById("btnAlignmentEditor");
	const closeButton = document.getElementById("btnAlignmentEditorClose");
	const fields = {
		title: document.getElementById("aeTitle"), element: document.getElementById("aeElementSel"), type: document.getElementById("aeElementType"),
		length: document.getElementById("aeLength"), curvature: document.getElementById("aeCurvature"), radius: document.getElementById("aeRadius"),
		transitionType: document.getElementById("aeTransitionType"), w1: document.getElementById("aeW1"), w2: document.getElementById("aeW2"),
		signedContext: document.getElementById("aeSignedContext"), consequence: document.getElementById("aeConsequence"),
		apply: document.getElementById("aeApply"), undo: document.getElementById("aeUndo"), reset: document.getElementById("aeReset"), status: document.getElementById("aeStatus"),
		technical: document.getElementById("aeTechnicalDetails"),
		sequenceReview: document.getElementById("aeSequenceReview"),
		realizationReceipt: document.getElementById("aeRealizationReceipt"),
	};
	let activeSnapshot = null;
	let requestedElementId = null;
	let arcInputAuthority = null;
	let applying = false;
	let pendingRemovalId = null;
	let changePreview = null;
	const drafts = createAuthoringDraftStore();
	function draftIdentity(element = selectedElement()) { return { objectId: activeSnapshot?.object?.id, discipline: "horizontal", action: "edit", elementId: element?.id }; }
	function draftValues() { return { length: fields.length?.value ?? "", curvature: fields.curvature?.value ?? "", radius: fields.radius?.value ?? "", transitionType: fields.transitionType?.value ?? "", w1: fields.w1?.value ?? "", w2: fields.w2?.value ?? "", arcInputAuthority }; }
	function rememberDraft() { const element=selectedElement();if(element){const draft=draftValues();drafts.write(draftIdentity(element),draft);changePreview?.update(draft);} }
	function renderChangePreview(element,draft=null){if(!overlay)return;const parameters=element?.parameters??element??{},type=String(element?.type??"").toLowerCase(),definitions=type==="straight"?[["Länge","length",parameters.length??element?.length??element?.arcLength]]:type==="arc"?[["Länge","length",parameters.length??element?.length??element?.arcLength],["Krümmung","curvature",parameters.curvature??element?.curvature],["Radius","radius",parameters.radius??element?.radius]]:type==="transition"?[["Länge","length",parameters.length??element?.length??element?.arcLength],["Übergangsfamilie","transitionType",parameters.transitionType??element?.transitionType],["w1","w1",parameters.w1??element?.opts?.w1],["w2","w2",parameters.w2??element?.opts?.w2]]:[];changePreview=createAuthoringChangePreview({documentRef:document,context:{objectId:activeSnapshot?.object?.id,discipline:"horizontal",action:"edit",elementId:element?.id},fields:definitions.map(([label,name,canonicalValue])=>({label,name,canonicalValue})),saving:applying});overlay.querySelector?.("[data-authoring-change-preview]")?.remove?.();overlay.append?.(changePreview.element);changePreview.update(draft);}

	function setOpen(open) {
		store.actions?.setAeOpen?.(Boolean(open));
		if (open) ui.openAlignmentEditor?.(); else ui.closeAlignmentEditor?.();
	}
	function isOpen() { return Boolean(store.getState()?.ae_open) && !overlay?.classList.contains("hidden"); }
	function setAuthoringState(state) { if (overlay?.dataset) overlay.dataset.authoringState = state; }
	function message(key, kind = "info", state = null) { if (fields.status) { fields.status.textContent = t(key); fields.status.dataset.kind = kind; } if (state) setAuthoringState(state); }
	function selectedId() { return String(fields.element?.value ?? "").trim(); }
	function elements() { return activeSnapshot?.alignmentData?.editModel?.elements ?? []; }
	function selectedElement() { const id = selectedId(); return elements().find((entry) => String(entry?.id ?? "") === id) ?? null; }
	function setDisabled(field, disabled) { if (field) field.disabled = Boolean(disabled); }
	function showField(field, visible) {
		if (!field) return;
		field.classList.toggle("hidden", !visible);
		document.querySelector(`label[for="${field.id}"]`)?.classList.toggle("hidden", !visible);
	}
	function technicalDetails(element, index) {
		if (!fields.technical) return;
		const source = activeSnapshot?.alignmentData?.source ?? activeSnapshot?.object?.meta?.source ?? null;
		fields.technical.replaceChildren(...[
			[t("alignment_editor.technical.id"), element?.id ?? "—"],
			[t("alignment_editor.technical.position"), `${index + 1} / ${elements().length}`],
			[t("alignment_editor.technical.provenance"), source?.kind ?? source?.parserId ?? "—"],
			[t("alignment_editor.technical.representation"), activeSnapshot?.derived ? t("alignment_editor.technical.derived") : t("alignment_editor.technical.native")],
		].flatMap(([label, value]) => {
			const dt = document.createElement("dt"); dt.textContent = String(label);
			const dd = document.createElement("dd"); dd.textContent = String(value);
			return [dt, dd];
		}));
	}
	function renderConsequence() {
		const element = selectedElement();
		if (!fields.consequence || !element) return;
		const type = String(element.type ?? "").toLowerCase();
		const length = asNumber(fields.length?.value);
		if (type === "straight") fields.consequence.textContent = t("alignment_editor.preview.straight", { length: Number.isFinite(length) ? length : "—" });
		else if (type === "arc") {
			const curvature = asNumber(fields.curvature?.value);
			const radius = Number.isFinite(curvature) && Math.abs(curvature) > 1e-12 ? 1 / curvature : asNumber(fields.radius?.value);
			fields.consequence.textContent = t("alignment_editor.preview.arc", { length: Number.isFinite(length) ? length : "—", curvature: Number.isFinite(curvature) ? curvature : "—", radius: Number.isFinite(radius) ? radius.toFixed(2) : "—" });
		} else {
			fields.consequence.textContent = t("alignment_editor.preview.transition", {
				length: Number.isFinite(length) ? length : "—",
				family: fields.transitionType?.value || "—",
				w1: fields.w1?.value || "—",
				w2: fields.w2?.value || "—",
			});
		}
	}

	function setWorkspaceElement(elementId, source = "alignment-editor") {
		const state = store.getState(); const selection = state.workspace_selection ?? {};
		store.actions?.setWorkspaceSelection?.({
			primaryId: selection.primaryId ?? null,
			contextIds: Array.isArray(selection.contextIds) ? selection.contextIds : [],
			elementDiscipline: elementId ? "horizontal" : null,
			elementId: String(elementId ?? "").trim() || null,
			source,
			crsId: selection.crsId ?? null,
		});
	}

	function renderForm() {
		arcInputAuthority = null;
		const element = selectedElement();
		if (!element) {
			for (const field of [fields.type, fields.length, fields.curvature, fields.radius, fields.w1, fields.w2]) if (field) field.value = "";
			if (fields.transitionType) fields.transitionType.value = "";
			if (fields.signedContext) fields.signedContext.textContent = "";
			if (fields.consequence) fields.consequence.textContent = t("alignment_editor.preview.none");
			setDisabled(fields.apply, true);
			setDisabled(fields.undo, !controller.service.canUndo());
			renderChangePreview(null, null);
			return;
		}
		const type = String(element.type ?? "").toLowerCase();
		const length = Number(element?.parameters?.length ?? element?.length ?? element?.arcLength);
		const curvature = Number(element?.parameters?.curvature ?? element?.curvature);
		const radius = Number(element?.parameters?.radius ?? element?.radius);
		if (fields.type) fields.type.value = t(`alignment_editor.element_type.${["straight", "arc", "transition"].includes(type) ? type : "unknown"}`);
		if (fields.length) fields.length.value = Number.isFinite(length) ? String(length) : "";
		if (fields.curvature) fields.curvature.value = Number.isFinite(curvature) ? String(curvature) : "";
		if (fields.radius) fields.radius.value = Number.isFinite(radius) ? String(radius) : "";
		if (fields.transitionType) fields.transitionType.value = String(element?.parameters?.transitionType ?? element?.transitionType ?? "");
		if (fields.w1) fields.w1.value = element?.parameters?.w1 ?? element?.opts?.w1 ?? "";
		if (fields.w2) fields.w2.value = element?.parameters?.w2 ?? element?.opts?.w2 ?? "";
		const draft=drafts.read(draftIdentity(element));
		if(draft){for(const name of ["length","curvature","radius","transitionType","w1","w2"])if(fields[name]&&draft[name]!==undefined)fields[name].value=String(draft[name]);arcInputAuthority=draft.arcInputAuthority??null;}
		renderChangePreview(element,draft);
		showField(fields.curvature, type === "arc"); showField(fields.radius, type === "arc");
		showField(fields.transitionType, type === "transition"); showField(fields.w1, type === "transition"); showField(fields.w2, type === "transition");
		setDisabled(fields.apply, false); setDisabled(fields.undo, !controller.service.canUndo());
		const list = elements(); const index = list.indexOf(element);
		const curvatureAt = (candidate) => { const value = Number(candidate?.parameters?.curvature ?? candidate?.curvature); return Number.isFinite(value) ? value.toFixed(6) : "—"; };
		if (fields.signedContext) fields.signedContext.textContent = t("alignment_editor.hint.signed_context", { prev: curvatureAt(list[index - 1]), next: curvatureAt(list[index + 1]) });
		technicalDetails(element, index);
		renderConsequence();
	}

	function renderSequenceReview() {
		if (!fields.sequenceReview) return;
		const review = buildHorizontalSequenceConsequenceReview({ alignmentData: activeSnapshot?.alignmentData, spotObject: activeSnapshot?.object });
		fields.sequenceReview.replaceChildren(); fields.sequenceReview.dataset.sequenceReviewStatus = review.status;
		for (const row of review.rows) {
			const item = document.createElement("div"); item.dataset.sequenceControlRow = row.id;
			const button = document.createElement("button"); button.type = "button"; button.dataset.sequenceElementId = row.id; button.setAttribute("aria-pressed", String(row.id === selectedId()));
			const curvature = row.curvatureStatus === "available" ? `κ ${row.startCurvature} → ${row.endCurvature}` : "κ not-covered";
			const domain = row.domain ? `s ${row.domain.startS}..${row.domain.endS}` : "Domain not-covered";
			button.textContent = `${row.index + 1}. ${row.id} · ${row.type} · L ${row.length ?? "not-covered"} · ${domain} · ${curvature} · Validation ${row.validation.status} · Continuity ${row.continuity.status} · Provenienz ${row.provenancePresent ? "vorhanden" : "nicht belegt"}`;
			button.addEventListener("click", () => { if (!elements().some((entry) => String(entry?.id ?? "") === row.id)) return; pendingRemovalId = null; fields.element.value = row.id; setWorkspaceElement(row.id, "alignment-sequence-review"); renderForm(); renderSequenceReview(); message("alignment_editor.status.element_selected"); });
			item.append(button);
			if (row.id === selectedId()) {
				if (pendingRemovalId === row.id) {
					const confirm = document.createElement("button"), cancel = document.createElement("button"), warning = document.createElement("span");
					warning.textContent = t("alignment_editor.remove.confirm", { id: row.id });
					confirm.type = cancel.type = "button"; confirm.dataset.sequenceConfirmRemove = row.id; cancel.dataset.sequenceCancelRemove = row.id;
					confirm.textContent = t("alignment_editor.remove.confirm_action"); cancel.textContent = t("alignment_editor.remove.cancel");
					confirm.disabled = cancel.disabled = applying;
					confirm.addEventListener("click", () => void removeSelectedElement(row.id));
					cancel.addEventListener("click", () => { pendingRemovalId = null; renderSequenceReview(); });
					item.append(warning, confirm, cancel);
				} else {
					const remove = document.createElement("button"); remove.type = "button"; remove.dataset.sequenceRequestRemove = row.id; remove.textContent = t("alignment_editor.remove.action"); remove.disabled = applying;
					remove.addEventListener("click", () => { pendingRemovalId = row.id; renderSequenceReview(); }); item.append(remove);
				}
			}
			fields.sequenceReview.append(item);
		}
	}

	async function loadTransitionFamilies() {
		const raw = await messaging.sendCmdAwait("Transition.ListPresets", {});
		const items = Array.isArray(raw) ? raw : raw?.items ?? [];
		if (!fields.transitionType) return;
		fields.transitionType.replaceChildren(...items.filter((item) => item?.id).map((item) => { const option = document.createElement("option"); option.value = String(item.id); option.textContent = String(item.label ?? item.id); return option; }));
	}

	async function readActiveSnapshot() {
		const primaryId = getWorkspacePrimaryId(store.getState());
		const spotState = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
		const objects = Array.isArray(spotState?.objects) ? spotState.objects : Object.values(spotState?.objects ?? {});
		const object = objects.find((entry) => String(entry?.id ?? "") === String(primaryId ?? "")) ?? null;
		if (!object || object.type !== "alignment") return null;
		const embedded = controller.mapper.readAlignmentDataFromSpotObject(object);
		let alignmentData = embedded;
		if (!controller.service.hasNativeEditModel(embedded)) {
			try { alignmentData = controller.service.materializeAlignmentDataFromSparse(object); }
			catch (error) { return { object, alignmentData: null, derived: false, rejection: { ok: false, status: "rejected", code: "ALIGNMENT_EDIT_REPRESENTATION_UNAVAILABLE", reason: String(error?.message ?? error) } }; }
		}
		return alignmentData ? { object, alignmentData, derived: alignmentData !== embedded } : null;
	}

	async function refresh({
		preserveSelection = true,
		verifiedChange = null,
	} = {}) {
		pendingRemovalId = null;
		if (!verifiedChange) renderHorizontalRealizationChangeReceipt(fields.realizationReceipt, null);
		ui.applyI18n?.(overlay);
		const previous = preserveSelection ? selectedId() : "";
		const requested = requestedElementId;
		const activeId =
			getWorkspacePrimaryId(
				store.getState()
			);
		activeSnapshot =
			verifiedChange?.alignmentData &&
			verifiedChange?.spotObject &&
			String(verifiedChange.objectId ?? verifiedChange.spotObject.id) ===
				String(activeId ?? "")
				? {
					object: verifiedChange.spotObject,
					alignmentData: verifiedChange.alignmentData,
					derived: false,
				}
				: await readActiveSnapshot();
		await loadTransitionFamilies();
		const list = elements();
		const choice = resolveAlignmentEditorElementChoice({ requestedElementId: requested, previousElementId: previous, workspaceElementId: store.getState()?.workspace_selection?.elementId, elements: list });
		if (fields.element) {
			fields.element.replaceChildren(...list.map((element) => { const option = document.createElement("option"); option.value = String(element.id); option.textContent = `${element.id} · ${t(`alignment_editor.element_type.${element.type}`)}`; return option; }));
			fields.element.value = choice.selectedId;
		}
		requestedElementId = null;
		renderForm();
		renderSequenceReview();
		if (!activeSnapshot?.alignmentData) message("alignment_editor.status.no_editable_elements", "warn");
		else if (!choice.found) message("alignment_editor.status.focus_target_missing", "error", "error");
		else if (requested) message("alignment_editor.status.focus_applied", "ok");
		else message("alignment_editor.status.state_loaded", "ok");
		return Boolean(activeSnapshot?.alignmentData) && choice.found;
	}

	async function open({
		objectId = null,
		discipline = "horizontal",
		elementId = null,
		source = "alignment-editor",
		verifiedChange = null,
	} = {}) {
		try {
			const target = resolveAlignmentAuthoringTarget({ activeObjectId: getWorkspacePrimaryId(store.getState()), requestedObjectId: objectId, discipline, elementId });
			if (!target.supported) {
				message("alignment_editor.status.focus_target_missing", "warn", "error");
				return false;
			}
			requestedElementId = target.elementId;
			setOpen(true);
			const refreshed = await refresh({
				preserveSelection: !requestedElementId,
				verifiedChange,
			});
			if (!refreshed) return false;
			if (selectedId()) setWorkspaceElement(selectedId(), source);
			return true;
		} catch {
			message("alignment_editor.status.calculation_failed", "error");
			return false;
		}
	}

	async function apply() {
		if (applying) return false;
		renderHorizontalRealizationChangeReceipt(fields.realizationReceipt, null);
		const element = selectedElement();
		if (!element) return message("alignment_editor.status.no_element_selected", "warn");
		rememberDraft(); applying = true; renderChangePreview(element,draftValues()); setDisabled(fields.apply, true); message("alignment_editor.action.apply", "info", "saving");
		const id = String(element.id); const type = String(element.type).toLowerCase();
		const beforeAlignmentData = activeSnapshot?.alignmentData;
		let result;
		let persistedReceipt = false;
		try {
		if (type === "straight") result = await controller.updateStraightLengthOnActiveAlignment({ elementId: id, length: asNumber(fields.length?.value) });
		else if (type === "arc") {
			const arcChange = resolveArcEditChange({
				curvature: fields.curvature?.value,
				radius: fields.radius?.value,
				authority: arcInputAuthority,
			});
			result = await controller.updateArcOnActiveAlignment({ elementId: id, length: asNumber(fields.length?.value), ...arcChange });
		}
		else if (type === "transition") result = await controller.updateTransitionOnActiveAlignment({ elementId: id, length: asNumber(fields.length?.value), transitionType: fields.transitionType?.value, w1: asNumber(fields.w1?.value), w2: asNumber(fields.w2?.value) });
		else result = { changed: false, ok: false, status: "rejected", code: "ALIGNMENT_EDIT_UNSUPPORTED" };
		if (result?.ok === false || result?.status === "rejected") { message("alignment_editor.status.validation_failed", "error", "error"); return false; }
		if (result?.changed === false) { message("alignment_editor.status.no_changes_applied", "info", "ready"); return false; }
		const receipt = buildHorizontalRealizationChangeReceipt({ beforeAlignmentData, alignmentChange: result.alignmentChange, activeObjectId: activeSnapshot?.object?.id, activeElementId: id });
		requestedElementId = id;const refreshed=await clearDraftAfterCanonicalRefresh({refresh:()=>refresh({ preserveSelection: false, verifiedChange: result.alignmentChange }),clear:()=>drafts.clear(draftIdentity(element))});if(!refreshed)return false;
		if (String(activeSnapshot?.object?.id ?? "") !== receipt.objectId || selectedId() !== receipt.elementId) throw new Error("verified receipt context changed");
		setWorkspaceElement(id); renderHorizontalRealizationChangeReceipt(fields.realizationReceipt, receipt); persistedReceipt = true; message("alignment_editor.status.recalculated", "ok", "saved");
		try {
			await dispatchProductiveAlignmentChange({
				...(result.alignmentChange ?? {}),
				objectId: result.alignmentChange?.objectId ?? activeSnapshot?.object?.id ?? null,
				elementId: id,
				source: "alignment-editor",
			});
		} catch (error) {
			if (fields.status) {
				fields.status.textContent = `Geometrie gespeichert · Folgeansicht noch nicht aktualisiert (${String(error?.message ?? error)})`;
				fields.status.dataset.kind = "warn";
			}
			setAuthoringState("saved");
		}
		try {
			receiptSource?.publish?.({verified:true,objectId:result.alignmentChange?.objectId??activeSnapshot?.object?.id,revision:result.alignmentChange?.revision,discipline:"horizontal",elementId:id,operation:type.startsWith("update")?type:`update-${type}`,source:result.alignmentChange?.source??"alignment-editor"});
		} catch (error) {
			if (fields.status) {
				fields.status.textContent = `Geometrie gespeichert · Folgeansicht noch nicht aktualisiert (${String(error?.message ?? error)})`;
				fields.status.dataset.kind = "warn";
			}
			setAuthoringState("saved");
		}
		return true;
		} catch (error) {
			if (persistedReceipt) {
				if (fields.status) {
					fields.status.textContent = `Geometrie gespeichert · Folgeansicht noch nicht aktualisiert (${String(error?.message ?? error)})`;
					fields.status.dataset.kind = "warn";
				}
				setAuthoringState("saved");
				return true;
			}
			message("alignment_editor.status.calculation_failed", "error", "error"); return false;
		}
		finally { applying = false; renderForm(); }
	}

	async function removeSelectedElement(elementId) {
		if (applying) return false;
		const authority = authorizeHorizontalElementRemoval({ activeObjectId: getWorkspacePrimaryId(store.getState()), snapshotObjectId: activeSnapshot?.object?.id, selectedElementId: selectedId(), requestedElementId: elementId, elements: elements() });
		if (!authority.authorized || pendingRemovalId !== authority.elementId) { pendingRemovalId = null; renderSequenceReview(); message("alignment_editor.status.remove_target_missing", "error", "error"); return false; }
		const removedElement = selectedElement(); applying = true; renderSequenceReview(); message("alignment_editor.status.removing", "info", "saving");
		try {
			const result = await controller.removeElementFromActiveAlignment({ elementId: authority.elementId });
			if (result?.ok === false || result?.status === "rejected" || result?.changed !== true) { message("alignment_editor.status.remove_rejected", "error", "error"); if (fields.status && (result?.reason || result?.code)) fields.status.textContent = `${t("alignment_editor.status.remove_rejected")} · ${String(result.reason ?? result.code)}`; return false; }
			const refreshed = await refresh({ preserveSelection: false });
			if (!refreshed) { message("alignment_editor.status.calculation_failed", "error", "error"); return false; }
			drafts.clear(draftIdentity(removedElement)); pendingRemovalId = null; message("alignment_editor.status.removed", "ok", "saved");
			await dispatchProductiveAlignmentChange({ ...(result.alignmentChange ?? {}), objectId: result.alignmentChange?.objectId ?? activeSnapshot?.object?.id ?? null, elementId: result.alignmentChange?.elementId ?? store.getState()?.workspace_selection?.elementId ?? null, source: "alignment-editor-remove-element" });
			return true;
		} catch (error) { message("alignment_editor.status.calculation_failed", "error", "error"); if (fields.status && error?.message) fields.status.textContent = `${t("alignment_editor.status.calculation_failed")} · ${String(error.message)}`; return false; }
		finally { applying = false; renderForm(); renderSequenceReview(); }
	}

	async function undo() {
		const result = await controller.undoLastAlignmentChange();
		if (!result?.changed) return message("alignment_editor.status.undo_unavailable", "warn");
		await refresh({ preserveSelection: true });
		message("alignment_editor.status.undone", "ok");
		await dispatchProductiveAlignmentChange({
			objectId: activeSnapshot?.object?.id ?? null,
			elementId: selectedId() || null,
			source: "alignment-editor-undo",
		});
	}

	function wire() {
		if(overlay&&!overlay.querySelector?.("[data-authoring-draft-notice]")){const note=document.createElement("small");note.dataset.authoringDraftNotice="";note.textContent="Eingaben bleiben beim Schließen in diesem Fenster erhalten.";overlay.append(note);}
		openButton?.addEventListener("click", () => void open());
		closeButton?.addEventListener("click", () => setOpen(false));
		overlay?.addEventListener("click", (event) => { if (event.target === overlay) setOpen(false); });
		window.addEventListener("keydown", (event) => { if (event.key === "Escape" && isOpen()) setOpen(false); });
		fields.element?.addEventListener("change", () => { renderForm(); setWorkspaceElement(selectedId()); message("alignment_editor.status.element_selected"); });
		fields.apply?.addEventListener("click", () => void apply().catch(() => message("alignment_editor.status.calculation_failed", "error")));
		fields.undo?.addEventListener("click", () => void undo().catch(() => message("alignment_editor.status.calculation_failed", "error")));
		fields.reset?.addEventListener("click", () => { drafts.clear(draftIdentity());renderForm(); message("alignment_editor.status.inputs_reset"); });
		fields.curvature?.addEventListener("input", () => {
			const curvature = asNumber(fields.curvature.value);
			if (String(fields.curvature.value).trim()) {
				arcInputAuthority = "curvature";
				if (Number.isFinite(curvature) && Math.abs(curvature) > 1e-12 && fields.radius) fields.radius.value = String(1 / curvature);
			} else if (String(fields.radius?.value ?? "").trim()) arcInputAuthority = "radius";
		});
		fields.radius?.addEventListener("input", () => {
			const radius = asNumber(fields.radius.value);
			if (String(fields.radius.value).trim()) {
				arcInputAuthority = "radius";
				if (Number.isFinite(radius) && Math.abs(radius) > 1e-12 && fields.curvature) fields.curvature.value = String(1 / radius);
			} else if (String(fields.curvature?.value ?? "").trim()) arcInputAuthority = "curvature";
		});
		for (const field of [fields.length, fields.curvature, fields.radius, fields.transitionType, fields.w1, fields.w2]) {
			field?.addEventListener("input", () => { rememberDraft();renderConsequence(); message("alignment_editor.status.preview_only", "info", "dirty"); });
		}
		window.addEventListener("ufaim:alignment-editor-focus-element", (event) => {
			const detail = event?.detail ?? {};
			void open({
				elementId: detail.elementId,
				source: detail.source ?? "alignment-editor",
				verifiedChange: detail.verifiedChange ?? null,
			});
		});
		let lastPrimary = getWorkspacePrimaryId(store.getState());
		store.subscribe(() => { const next = getWorkspacePrimaryId(store.getState()); if (String(next ?? "") === String(lastPrimary ?? "")) return; lastPrimary = next; if (isOpen()) void refresh({ preserveSelection: false }); });
		if (store.getState()?.ae_open || !overlay?.classList.contains("hidden")) void open();
	}

	return { wire, open, close: () => setOpen(false), stop:()=>drafts.clearAll(),refresh, focusElementInEditor: ({ objectId, discipline = "horizontal", elementId, source } = {}) => open({ objectId, discipline, elementId, source }) };
}
