import { getWorkspacePrimaryId } from "@src/shared/runtime/workspaceSelectionAccess.js";
import { AlignmentEditorController } from "@app/controllers/alignmentEditorController.js";
import { t } from "@app/i18n/strings.js";

function unwrap(raw) { return raw?.state ?? raw?.payload ?? raw ?? null; }
function asNumber(value) { if (value == null || String(value).trim() === "") return undefined; const number = Number(value); return Number.isFinite(number) ? number : Number.NaN; }

export function makeAlignmentEditorBridge({ store, ui, messaging } = {}) {
	if (!store?.getState || !messaging?.sendCmdAwait) throw new Error("AlignmentEditorBridge: missing runtime dependencies");
	const controller = new AlignmentEditorController({ store, messaging });
	const overlay = document.getElementById("alignmentEditorOverlay");
	const openButton = document.getElementById("btnAlignmentEditor");
	const closeButton = document.getElementById("btnAlignmentEditorClose");
	const fields = {
		title: document.getElementById("aeTitle"), element: document.getElementById("aeElementSel"), type: document.getElementById("aeElementType"),
		length: document.getElementById("aeLength"), curvature: document.getElementById("aeCurvature"), radius: document.getElementById("aeRadius"),
		transitionType: document.getElementById("aeTransitionType"), w1: document.getElementById("aeW1"), w2: document.getElementById("aeW2"),
		signedContext: document.getElementById("aeSignedContext"), apply: document.getElementById("aeApply"), reset: document.getElementById("aeReset"), status: document.getElementById("aeStatus"),
	};
	let activeSnapshot = null;
	let requestedElementId = null;

	function setOpen(open) {
		store.actions?.setAeOpen?.(Boolean(open));
		if (open) ui.openAlignmentEditor?.(); else ui.closeAlignmentEditor?.();
	}
	function isOpen() { return Boolean(store.getState()?.ae_open) && !overlay?.classList.contains("hidden"); }
	function message(key, kind = "info") { if (fields.status) { fields.status.textContent = t(key); fields.status.dataset.kind = kind; } }
	function selectedId() { return String(fields.element?.value ?? "").trim(); }
	function elements() { return activeSnapshot?.alignmentData?.editModel?.elements ?? []; }
	function selectedElement() { const id = selectedId(); return elements().find((entry) => String(entry?.id ?? "") === id) ?? null; }
	function setDisabled(field, disabled) { if (field) field.disabled = Boolean(disabled); }

	function setWorkspaceElement(elementId, source = "alignment-editor") {
		const state = store.getState(); const selection = state.workspace_selection ?? {};
		store.actions?.setWorkspaceSelection?.({
			primaryId: selection.primaryId ?? null,
			contextIds: Array.isArray(selection.contextIds) ? selection.contextIds : [],
			elementId: String(elementId ?? "").trim() || null,
			source,
			crsId: selection.crsId ?? null,
		});
	}

	function renderForm() {
		const element = selectedElement();
		if (!element) {
			for (const field of [fields.type, fields.length, fields.curvature, fields.radius, fields.w1, fields.w2]) if (field) field.value = "";
			if (fields.transitionType) fields.transitionType.value = "";
			if (fields.signedContext) fields.signedContext.textContent = "";
			setDisabled(fields.apply, true);
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
		setDisabled(fields.curvature, type !== "arc"); setDisabled(fields.radius, type !== "arc");
		setDisabled(fields.transitionType, type !== "transition"); setDisabled(fields.w1, type !== "transition"); setDisabled(fields.w2, type !== "transition"); setDisabled(fields.apply, false);
		const list = elements(); const index = list.indexOf(element);
		const curvatureAt = (candidate) => { const value = Number(candidate?.parameters?.curvature ?? candidate?.curvature); return Number.isFinite(value) ? value.toFixed(6) : "—"; };
		if (fields.signedContext) fields.signedContext.textContent = t("alignment_editor.hint.signed_context", { prev: curvatureAt(list[index - 1]), next: curvatureAt(list[index + 1]) });
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

	async function refresh({ preserveSelection = true } = {}) {
		ui.applyI18n?.(overlay);
		const previous = preserveSelection ? selectedId() : "";
		const requested = requestedElementId;
		activeSnapshot = await readActiveSnapshot();
		await loadTransitionFamilies();
		const list = elements();
		if (fields.element) {
			fields.element.replaceChildren(...list.map((element) => { const option = document.createElement("option"); option.value = String(element.id); option.textContent = `${element.id} · ${t(`alignment_editor.element_type.${element.type}`)}`; return option; }));
			const wanted = [requestedElementId, previous, store.getState()?.workspace_selection?.elementId, list[0]?.id].map((value) => String(value ?? "")).find((value) => list.some((entry) => String(entry.id) === value)) ?? "";
			fields.element.value = wanted;
		}
		const requestedFound = !requested || list.some((entry) => String(entry.id) === String(requested));
		requestedElementId = null;
		renderForm();
		if (!activeSnapshot?.alignmentData) message("alignment_editor.status.no_editable_elements", "warn");
		else if (!requestedFound) message("alignment_editor.status.focus_target_missing", "warn");
		else if (requested) message("alignment_editor.status.focus_applied", "ok");
		else message("alignment_editor.status.state_loaded", "ok");
	}

	async function open({ elementId = null, source = "alignment-editor" } = {}) {
		try {
			requestedElementId = String(elementId ?? "").trim() || null;
			setOpen(true);
			await refresh({ preserveSelection: !requestedElementId });
			if (requestedElementId || selectedId()) setWorkspaceElement(selectedId(), source);
			return Boolean(activeSnapshot?.alignmentData);
		} catch {
			message("alignment_editor.status.calculation_failed", "error");
			return false;
		}
	}

	async function apply() {
		const element = selectedElement();
		if (!element) return message("alignment_editor.status.no_element_selected", "warn");
		const id = String(element.id); const type = String(element.type).toLowerCase();
		let result;
		if (type === "straight") result = await controller.updateStraightLengthOnActiveAlignment({ elementId: id, length: asNumber(fields.length?.value) });
		else if (type === "arc") result = await controller.updateArcOnActiveAlignment({ elementId: id, length: asNumber(fields.length?.value), curvature: asNumber(fields.curvature?.value), radius: asNumber(fields.radius?.value) });
		else if (type === "transition") result = await controller.updateTransitionOnActiveAlignment({ elementId: id, length: asNumber(fields.length?.value), transitionType: fields.transitionType?.value, w1: asNumber(fields.w1?.value), w2: asNumber(fields.w2?.value) });
		else result = { changed: false, ok: false, status: "rejected", code: "ALIGNMENT_EDIT_UNSUPPORTED" };
		if (result?.ok === false || result?.status === "rejected") return message("alignment_editor.status.validation_failed", "error");
		if (result?.changed === false) return message("alignment_editor.status.no_changes_applied", "info");
		requestedElementId = id; await refresh({ preserveSelection: false }); setWorkspaceElement(id); message("alignment_editor.status.recalculated", "ok");
	}

	function wire() {
		openButton?.addEventListener("click", () => void open());
		closeButton?.addEventListener("click", () => setOpen(false));
		overlay?.addEventListener("click", (event) => { if (event.target === overlay) setOpen(false); });
		window.addEventListener("keydown", (event) => { if (event.key === "Escape" && isOpen()) setOpen(false); });
		fields.element?.addEventListener("change", () => { renderForm(); setWorkspaceElement(selectedId()); message("alignment_editor.status.element_selected"); });
		fields.apply?.addEventListener("click", () => void apply().catch(() => message("alignment_editor.status.calculation_failed", "error")));
		fields.reset?.addEventListener("click", () => { renderForm(); message("alignment_editor.status.inputs_reset"); });
		window.addEventListener("ufaim:alignment-editor-focus-element", (event) => void open({ elementId: event?.detail?.elementId, source: event?.detail?.source ?? "alignment-editor" }));
		let lastPrimary = getWorkspacePrimaryId(store.getState());
		store.subscribe(() => { const next = getWorkspacePrimaryId(store.getState()); if (String(next ?? "") === String(lastPrimary ?? "")) return; lastPrimary = next; if (isOpen()) void refresh({ preserveSelection: false }); });
		if (store.getState()?.ae_open || !overlay?.classList.contains("hidden")) void open();
	}

	return { wire, open, close: () => setOpen(false), refresh, focusElementInEditor: ({ elementId, source } = {}) => open({ elementId, source }) };
}
