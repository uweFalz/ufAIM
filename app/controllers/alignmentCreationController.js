import { AlignmentEditorController } from "@app/controllers/alignmentEditorController.js";
import { getWorkspacePrimaryId, getWorkspaceSelectedElementId } from "@src/shared/runtime/workspaceSelectionAccess.js";
import { t } from "@app/i18n/strings.js";

function unwrap(raw) { return raw?.state ?? raw?.payload ?? raw ?? null; }
function objects(state) { return Array.isArray(state?.objects) ? state.objects : Object.values(state?.objects ?? {}); }

export function makeAlignmentCreationController({ store, messaging, curvatureBand, cockpit, viewController } = {}) {
	if (!store?.getState || !messaging?.sendCmdAwait) throw new Error("AlignmentCreationController: missing runtime dependencies");
	const editor = new AlignmentEditorController({ store, messaging });
	let busy = false;
	let root = null;
	let status = null;

	function installStyles() {
		if (document.querySelector('link[data-alignment-creation-style]')) return;
		const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "/app/styles/alignmentCreation.css"; link.dataset.alignmentCreationStyle = ""; document.head.append(link);
	}

	function buildUi() {
		const band = document.getElementById("curvatureBand");
		if (!band || band.querySelector("[data-alignment-creation]")) return;
		root = document.createElement("section"); root.className = "alignmentCreation"; root.dataset.alignmentCreation = "";
		root.innerHTML = `<button class="alignmentCreation__new" data-create>${t("alignment_creation.new")}</button><div class="alignmentCreation__construct"><button data-add="straight">${t("alignment_creation.straight")}</button><button data-add="transition">${t("alignment_creation.transition")}</button><button data-add="arc">${t("alignment_creation.arc")}</button><span class="alignmentCreation__divider"></span><button data-remove>${t("alignment_creation.remove")}</button><button data-undo>${t("alignment_creation.undo")}</button><button data-details>${t("alignment_creation.details")}</button></div><output data-creation-status></output>`;
		status = root.querySelector("[data-creation-status]"); band.insertBefore(root, document.getElementById("curvatureBandSvg"));
		root.addEventListener("click", onClick);
		window.addEventListener("ufaim:language-changed", renderLabels);
	}

	function renderLabels() {
		if (!root) return;
		root.querySelector("[data-create]").textContent = t("alignment_creation.new");
		for (const type of ["straight", "transition", "arc"]) root.querySelector(`[data-add="${type}"]`).textContent = t(`alignment_creation.${type}`);
		root.querySelector("[data-remove]").textContent = t("alignment_creation.remove"); root.querySelector("[data-undo]").textContent = t("alignment_creation.undo"); root.querySelector("[data-details]").textContent = t("alignment_creation.details");
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
				store.actions?.setWorkspaceSelection?.({ primaryId: result.spotObject?.id ?? selection.primaryId, contextIds: selection.contextIds ?? [], elementId, source: "alignment-creation", crsId: null });
			}
		}
		await curvatureBand?.refresh?.(); await cockpit?.refreshSpotState?.(); cockpit?.render?.(); await viewController?.refresh?.();
		await render(); return result;
	}

	function feedback(result, successKey) {
		if (!status) return;
		const rejected = result?.ok === false || result?.status === "rejected" || result == null;
		status.textContent = t(rejected ? "alignment_creation.rejected" : successKey);
		status.dataset.kind = rejected ? "error" : "ok";
	}

	async function create() { const result = await editor.newAlignment({ name: t("alignment_creation.default_name") }); feedback(result, "alignment_creation.created"); return sync(result); }
	async function add(type) {
		let result;
		if (type === "straight") result = await editor.addStraightToActiveAlignment({ length: 100 });
		else if (type === "transition") result = await editor.addTransitionArcToActiveAlignment({ transitionLength: 60, arcLength: 100, curvature: 0.002, transitionType: "clothoid" });
		else if (type === "arc") result = await editor.addArcToActiveAlignment({ length: 100, curvature: 0.002 });
		feedback(result, "alignment_creation.changed"); return sync(result, { selectLast: true });
	}
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
		const button = event.target.closest("button"); if (!button || busy) return; busy = true; root.classList.add("is-busy");
		try {
			if (button.matches("[data-create]")) await create();
			else if (button.dataset.add) await add(button.dataset.add);
			else if (button.matches("[data-remove]")) await removeSelected();
			else if (button.matches("[data-undo]")) await undo();
			else if (button.matches("[data-details]")) await window.__ufAIM_aeBridge?.open?.({ elementId: getWorkspaceSelectedElementId(store.getState()), source: "alignment-creation" });
		} catch {
			feedback({ ok: false, status: "rejected" }, "alignment_creation.changed");
		} finally { busy = false; root.classList.remove("is-busy"); }
	}

	function start() { installStyles(); buildUi(); store.subscribe(() => { void render().catch(() => {}); }); void render().catch(() => {}); }
	return { start, create, add, removeSelected, updateSelectedArc, undo, render, getUndoDepth: () => editor.service.getUndoDepth(), restoreUndoDepth: (depth) => editor.service.restoreUndoDepth(depth), getDebugState: async () => ({ activeObject: await activeObject(), selectedElementId: getWorkspaceSelectedElementId(store.getState()), canUndo: editor.service.canUndo() }) };
}
