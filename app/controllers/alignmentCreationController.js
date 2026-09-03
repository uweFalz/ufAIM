import { AlignmentEditorController } from "@app/controllers/alignmentEditorController.js";
import { getWorkspacePrimaryId, getWorkspaceSelectedElementId } from "@src/shared/runtime/workspaceSelectionAccess.js";
import { t } from "@app/i18n/strings.js";

function unwrap(raw) { return raw?.state ?? raw?.payload ?? raw ?? null; }
function objects(state) { return Array.isArray(state?.objects) ? state.objects : Object.values(state?.objects ?? {}); }
export function normalizeExplicitAlignmentName(value) { return String(value ?? "").trim(); }
export async function createAlignmentFromExplicitName(editor, { name } = {}) {
	const explicitName = normalizeExplicitAlignmentName(name);
	if (!explicitName) return { ok: false, changed: false, status: "rejected", code: "ALIGNMENT_NAME_REQUIRED" };
	return editor.newAlignment({ name: explicitName });
}

export function buildHorizontalSequenceAddRequest({ type, length, arcLength = null, arcAuthority = null, signedValue = null, transitionType = null, w1 = null, w2 = null, availableTransitionTypes = [] } = {}) {
	const kind = String(type ?? "").trim();
	const explicitLength = explicitNumber(length);
	if (!["straight", "arc", "transition"].includes(kind) || !Number.isFinite(explicitLength) || explicitLength <= 0) return Object.freeze({ ok: false, code: "HORIZONTAL_EXPLICIT_INPUT_REQUIRED" });
	if (kind === "straight") return Object.freeze({ ok: true, method: "straight", args: Object.freeze({ length: explicitLength }) });
	if (kind === "arc") {
		const authority = String(arcAuthority ?? ""); const value = explicitNumber(signedValue);
		if (!["curvature", "radius"].includes(authority) || !Number.isFinite(value) || Math.abs(value) <= 1e-12) return Object.freeze({ ok: false, code: "ARC_SIGNED_AUTHORITY_REQUIRED" });
		return Object.freeze({ ok: true, method: "arc", args: Object.freeze({ length: explicitLength, [authority]: value }) });
	}
	const family = String(transitionType ?? "").trim();
	if (!family || !new Set(availableTransitionTypes).has(family)) return Object.freeze({ ok: false, code: "TRANSITION_CATALOGUE_FAMILY_REQUIRED" });
	const explicitArcLength = explicitNumber(arcLength), authority = String(arcAuthority ?? ""), value = explicitNumber(signedValue);
	if (!Number.isFinite(explicitArcLength) || explicitArcLength <= 0 || !["curvature", "radius"].includes(authority) || !Number.isFinite(value) || Math.abs(value) <= 1e-12) return Object.freeze({ ok: false, code: "TRANSITION_ARC_EXPLICIT_INPUT_REQUIRED" });
	const args = { transitionLength: explicitLength, arcLength: explicitArcLength, transitionType: family, [authority]: value };
	const hasW1 = String(w1 ?? "").trim() !== "", hasW2 = String(w2 ?? "").trim() !== "";
	if (hasW1 !== hasW2) return Object.freeze({ ok: false, code: "TRANSITION_PARAMETER_PAIR_REQUIRED" });
	if (hasW1) { const valueW1 = explicitNumber(w1), valueW2 = explicitNumber(w2); if (!Number.isFinite(valueW1) || !Number.isFinite(valueW2)) return Object.freeze({ ok: false, code: "TRANSITION_PARAMETER_INVALID" }); args.w1 = valueW1; args.w2 = valueW2; }
	return Object.freeze({ ok: true, method: "transition-arc", args: Object.freeze(args) });
}

function explicitNumber(value) { if (value == null || String(value).trim() === "") return Number.NaN; return Number(value); }

export async function dispatchProductiveAlignmentChange(change = {}) {
	const pending = [];
	const detail = {
		...change,
		waitUntil(promise) { pending.push(Promise.resolve(promise)); },
	};
	window.dispatchEvent(new CustomEvent("ufaim:alignment-changed", { detail }));
	await Promise.all(pending);
	return detail;
}

export function makeAlignmentCreationController({ store, messaging, curvatureBand, cockpit, viewController } = {}) {
	if (!store?.getState || !messaging?.sendCmdAwait) throw new Error("AlignmentCreationController: missing runtime dependencies");
	const editor = new AlignmentEditorController({ store, messaging });
	let busy = false;
	let root = null;
	let status = null;
	let transitionTypes = [];

	function installStyles() {
		if (document.querySelector('link[data-alignment-creation-style]')) return;
		const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "/app/styles/alignmentCreation.css"; link.dataset.alignmentCreationStyle = ""; document.head.append(link);
	}

	function buildUi() {
		const band = document.getElementById("curvatureBand");
		if (!band || band.querySelector("[data-alignment-creation]")) return;
		root = document.createElement("section"); root.className = "alignmentCreation"; root.dataset.alignmentCreation = "";
		root.innerHTML = `<div class="alignmentCreation__new"><input data-create-name type="text" aria-label="${t("alignment_creation.new")}" placeholder="${t("alignment_creation.new")}" /><button data-create>${t("alignment_creation.new")}</button></div><div class="alignmentCreation__construct"><select data-add-type aria-label="Elementtyp"><option value="straight">${t("alignment_creation.straight")}</option><option value="arc">${t("alignment_creation.arc")}</option><option value="transition">${t("alignment_creation.transition")}</option></select><input data-add-length type="number" step="0.001" min="0" aria-label="${t("alignment_editor.label.length_m")}" placeholder="${t("alignment_editor.label.length_m")}" /><input data-add-arc-length type="number" step="0.001" min="0" aria-label="Bogenlänge [m]" placeholder="Bogenlänge [m]" /><select data-add-arc-authority aria-label="Bogenautorität"><option value="curvature">${t("alignment_editor.label.curvature_inv_m")}</option><option value="radius">${t("alignment_editor.label.radius_m")}</option></select><input data-add-signed-value type="number" step="any" aria-label="Signed curvature or radius" placeholder="Signed curvature or radius" /><select data-add-transition-family aria-label="${t("alignment_editor.label.transition_family")}"><option value="">${t("alignment_editor.label.transition_family")}</option></select><input data-add-w1 type="number" min="0" max="1" step="0.001" aria-label="${t("alignment_editor.label.w1")}" placeholder="${t("alignment_editor.label.w1")}" /><input data-add-w2 type="number" min="0" max="1" step="0.001" aria-label="${t("alignment_editor.label.w2")}" placeholder="${t("alignment_editor.label.w2")}" /><span data-transition-pair-hint>w1 und w2 gemeinsam oder beide leer</span><button data-add-submit>Element hinzufügen</button><span class="alignmentCreation__divider"></span><button data-remove>${t("alignment_creation.remove")}</button><button data-undo>${t("alignment_creation.undo")}</button><button data-details>${t("alignment_creation.details")}</button></div><output data-creation-status></output>`;
		band.insertBefore(root, document.getElementById("curvatureBandSvg"));
		status = root.querySelector("[data-creation-status]");
		root.addEventListener("click", onClick);
		root.querySelector("[data-add-type]")?.addEventListener("change", renderAddFields);
		window.addEventListener("ufaim:language-changed", renderLabels);
	}

	function renderLabels() {
		if (!root) return;
		root.querySelector("[data-create]").textContent = t("alignment_creation.new");
		root.querySelector("[data-create-name]").placeholder = t("alignment_creation.new"); root.querySelector("[data-create-name]").setAttribute("aria-label", t("alignment_creation.new"));
		for (const option of root.querySelector("[data-add-type]")?.options ?? []) option.textContent = t(`alignment_creation.${option.value}`);
		root.querySelector("[data-remove]").textContent = t("alignment_creation.remove"); root.querySelector("[data-undo]").textContent = t("alignment_creation.undo"); root.querySelector("[data-details]").textContent = t("alignment_creation.details");
	}

	function renderAddFields() {
		if (!root) return; const type = root.querySelector("[data-add-type]")?.value;
		for (const selector of ["[data-add-arc-authority]", "[data-add-signed-value]"]) { const field = root.querySelector(selector); if (field) field.hidden = type !== "arc" && type !== "transition"; }
		const arcLength = root.querySelector("[data-add-arc-length]"); if (arcLength) arcLength.hidden = type !== "transition";
		for (const selector of ["[data-add-transition-family]", "[data-add-w1]", "[data-add-w2]", "[data-transition-pair-hint]"]) { const field = root.querySelector(selector); if (field) field.hidden = type !== "transition"; }
	}

	async function loadTransitionFamilies() {
		const raw = await messaging.sendCmdAwait("Transition.ListPresets", {}); const items = Array.isArray(raw) ? raw : raw?.items ?? [];
		transitionTypes = items.map((item) => String(item?.id ?? "").trim()).filter(Boolean);
		const select = root?.querySelector("[data-add-transition-family]"); if (!select) return;
		for (const item of items.filter((entry) => entry?.id)) { const option = document.createElement("option"); option.value = String(item.id); option.textContent = String(item.label ?? item.id); select.append(option); }
	}

	async function activeObject() {
		const id = getWorkspacePrimaryId(store.getState()); if (!id) return null;
		const state = unwrap(await messaging.sendCmdAwait("Spot.GetState", {}));
		return objects(state).find((entry) => String(entry?.id ?? "") === String(id)) ?? null;
	}

	async function sync(result, { selectLast = false } = {}) {
		if (result?.changed && selectLast) {
			const elements = result?.alignmentData?.editModel?.elements ?? [];
			const elementId = elements.at(-1)?.id ?? null;
			if (elementId) {
				const selection = store.getState()?.workspace_selection ?? {};
				store.actions?.setWorkspaceSelection?.({ primaryId: result.spotObject?.id ?? selection.primaryId, contextIds: selection.contextIds ?? [], elementDiscipline: "horizontal", elementId, source: "alignment-creation", crsId: null });
			}
		}
		if (result?.changed) {
			try {
				await dispatchProductiveAlignmentChange({
					...(result.alignmentChange ?? {}),
					elementId: getWorkspaceSelectedElementId(store.getState()),
				});
			} catch (error) {
				if (status) {
					status.textContent = `Geometrie gespeichert · Folgeansicht noch nicht aktualisiert (${String(error?.message ?? error)})`;
					status.dataset.kind = "warn";
				}
			}
		}
		await render(); return result;
	}

	async function refreshProductiveViews(change) {
		await cockpit?.refreshSpotState?.(change);
		cockpit?.render?.();
		await viewController?.refresh?.(change);
	}

	function feedback(result, successKey) {
		if (!status) return;
		const rejected = result?.ok === false || result?.status === "rejected" || result == null;
		status.textContent = t(rejected ? "alignment_creation.rejected" : successKey);
		status.dataset.kind = rejected ? "error" : "ok";
	}

	async function create({ name } = {}) {
		try {
			const result = await createAlignmentFromExplicitName(editor, { name }); feedback(result, "alignment_creation.created"); return result?.changed ? await sync(result) : result;
		} finally {
			// Guided creation calls this method directly rather than through onClick.
			// It must hand the authoring rail back in an operable terminal state.
			busy = false;
			root?.classList.remove("is-busy");
			if (root?.dataset) delete root.dataset.creationOperation;
		}
	}
	async function add(request) {
		const qualified = buildHorizontalSequenceAddRequest({ ...request, availableTransitionTypes: transitionTypes });
		if (!qualified.ok) { const result = { ok: false, changed: false, status: "rejected", code: qualified.code }; feedback(result, "alignment_creation.changed"); return result; }
		let result;
		if (qualified.method === "straight") result = await editor.addStraightToActiveAlignment(qualified.args);
		else if (qualified.method === "transition-arc") result = await editor.addTransitionArcToActiveAlignment(qualified.args);
		else result = await editor.addArcToActiveAlignment(qualified.args);
		feedback(result, "alignment_creation.changed"); return sync(result, { selectLast: true });
	}
	function readAddRequest() { return { type: root.querySelector("[data-add-type]")?.value, length: root.querySelector("[data-add-length]")?.value, arcLength: root.querySelector("[data-add-arc-length]")?.value, arcAuthority: root.querySelector("[data-add-arc-authority]")?.value, signedValue: root.querySelector("[data-add-signed-value]")?.value, transitionType: root.querySelector("[data-add-transition-family]")?.value, w1: root.querySelector("[data-add-w1]")?.value, w2: root.querySelector("[data-add-w2]")?.value }; }
	async function removeSelected() { const elementId = getWorkspaceSelectedElementId(store.getState()); const result = elementId ? await editor.removeElementFromActiveAlignment({ elementId }) : { ok: false, status: "rejected" }; feedback(result, "alignment_creation.removed"); return sync(result); }
	async function updateSelectedArc(curvature) { const elementId = getWorkspaceSelectedElementId(store.getState()); const result = elementId ? await editor.updateArcOnActiveAlignment({ elementId, curvature }) : { ok: false, status: "rejected" }; feedback(result, "alignment_creation.changed"); return sync(result); }
	async function undo() { const result = await editor.undoLastAlignmentChange(); feedback(result, "alignment_creation.undone"); return sync(result); }

	async function render() {
		if (!root) return;
		const object = await activeObject(); const editable = object?.type === "alignment" && object?.data?.alignmentData?.editModel;
		root.classList.toggle("has-alignment", Boolean(editable));
		root.querySelector("[data-undo]").disabled = !editor.service.canUndo();
		root.querySelector("[data-remove]").disabled = !getWorkspaceSelectedElementId(store.getState());
	}

	async function onClick(event) {
		const button = event.target.closest("button"); if (!button || busy) return;
		busy = true; root.classList.add("is-busy");
		root.dataset.creationOperation = "pending"; if (status) { status.textContent = `${button.textContent ?? ""} …`; status.dataset.kind = "pending"; }
		try {
			if (button.matches("[data-create]")) await create({ name: root.querySelector("[data-create-name]")?.value });
			else if (button.matches("[data-add-submit]")) await add(readAddRequest());
			else if (button.matches("[data-remove]")) await removeSelected();
			else if (button.matches("[data-undo]")) await undo();
			else if (button.matches("[data-details]")) await window.__ufAIM_aeBridge?.open?.({ elementId: getWorkspaceSelectedElementId(store.getState()), source: "alignment-creation" });
		} catch {
			feedback({ ok: false, status: "rejected" }, "alignment_creation.changed");
		} finally { busy = false; root.classList.remove("is-busy"); delete root.dataset.creationOperation; }
	}

	function onAlignmentChanged(event) {
		event?.detail?.waitUntil?.(refreshProductiveViews(event.detail));
	}

	function start() {
		installStyles();
		buildUi();
		renderAddFields(); void loadTransitionFamilies().catch(() => feedback({ ok: false, status: "rejected" }, "alignment_creation.changed"));
		window.addEventListener("ufaim:alignment-changed", onAlignmentChanged);
		store.subscribe(() => { void render().catch(() => {}); });
		void render().catch(() => {});
	}
	return { start, create, add, removeSelected, updateSelectedArc, undo, render, getUndoDepth: () => editor.service.getUndoDepth(), restoreUndoDepth: (depth) => editor.service.restoreUndoDepth(depth), getDebugState: async () => ({ activeObject: await activeObject(), selectedElementId: getWorkspaceSelectedElementId(store.getState()), canUndo: editor.service.canUndo() }) };
}
