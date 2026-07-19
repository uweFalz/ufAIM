// app/controllers/bridges/transitionEditorBridge.js
//
// Bridge: UI <-> store.te_*  (no rendering, no math, no registry)
//
// Worker API used (ONLY):
//   - Transition.ListPresets      -> [{id,label}, ...]
//   - Transition.GetPresetSpec    -> { presetId, descriptor, cuts01?, meta? }  (pure data)

import { clamp01 } from "@utils/helpers.js";
import { getWorkspacePrimaryId } from "@src/shared/runtime/workspaceSelectionAccess.js";
import { AlignmentEditorController } from "@app/controllers/alignmentEditorController.js";
import { t } from "@app/i18n/strings.js";

function setText(el, txt) {
	if (!el) return;
	el.textContent = String(txt ?? "");
}

function fillSelect(sel, items, activeId) {
	if (!sel) return;
	sel.innerHTML = "";

	for (const it of items || []) {
		if (!it?.id) continue;
		const opt = document.createElement("option");
		opt.value = it.id;
		opt.textContent = it.label ?? it.id;
		sel.appendChild(opt);
	}

	if (activeId && (items || []).some((x) => x?.id === activeId)) {
		sel.value = activeId;
	}
}

function fromSliderVal01(v1000) {
	return clamp01(Number(v1000) / 1000);
}

function cuts01FromSpecOrDescriptor(spec) {
	const desc = spec?.descriptor ?? spec ?? null;

	if (spec?.cuts01) {
		return {
			w1: clamp01(spec.cuts01.w1 ?? 0.25),
			w2: clamp01(spec.cuts01.w2 ?? 0.75),
		};
	}

	const lambdas = Array.isArray(desc?.normLengthPartition)
		? desc.normLengthPartition.map((x) => Number(x) || 0)
		: null;

	if (lambdas && lambdas.length === 3) {
		const w1 = clamp01(lambdas[0]);
		const w2 = clamp01(lambdas[0] + lambdas[1]);
		return { w1, w2 };
	}

	return { w1: 0.25, w2: 0.75 };
}

// -----------------------------------------------------------------------------

export function makeTransitionEditorBridge({ store, ui, messaging, view } = {}) {
	if (!store?.getState) throw new Error("TransitionEditorBridge: missing store");
	if (!ui?.elements) throw new Error("TransitionEditorBridge: missing ui.elements");
	if (!messaging?.sendCmdAwait) throw new Error("TransitionEditorBridge: missing messaging.sendCmdAwait");

	const elPresetMain = ui.elements.tePresetSelMain ?? null;
	const elPresetAlt = ui.elements.tePresetSelAlt ?? null;

	const elW1 = ui.elements.teW1 ?? null;
	const elW2 = ui.elements.teW2 ?? null;

	const elW1Val = ui.elements.teW1Val ?? null;
	const elW2Val = ui.elements.teW2Val ?? null;

	const btnOpen = ui.elements.buttonTransition ?? document.getElementById("btnTrans");
	const btnClose = ui.elements.buttonTransitionClose ?? document.getElementById("btnTransClose");
	const ov = ui.elements.transitionOverlay ?? document.getElementById("transOverlay");

	const alignmentEditor = new AlignmentEditorController({
		store,
		messaging,
		mapper: null,
	});

	// -----------------------------------------------------------------------------
	// view init

	let _viewInitPromise = null;
	async function ensureViewInitOnce() {
		if (!view?.init) return;
		if (_viewInitPromise) return _viewInitPromise;
		_viewInitPromise = (async () => { await view.init(); })();
		return _viewInitPromise;
	}

	// -----------------------------------------------------------------------------
	// store helpers

	function setPresetId(id) {
		if (store.actions?.setTePresetId) return store.actions.setTePresetId(String(id ?? ""));
		if (store.actions?.setTransitionPresetId) return store.actions.setTransitionPresetId(String(id ?? ""));
		if (store.actions?.setTePreset) return store.actions.setTePreset(String(id ?? ""));
	}

	function setOpen(isOpen) {
		if (store.actions?.setTeOpen) return store.actions.setTeOpen(Boolean(isOpen));
		if (store.actions?.setTransitionOpen) return store.actions.setTransitionOpen(Boolean(isOpen));
	}

	function setW1(w1) {
		if (store.actions?.setTeW1) return store.actions.setTeW1(Number(w1));
		if (store.actions?.setTransitionW1) return store.actions.setTransitionW1(Number(w1));
	}

	function setW2(w2) {
		if (store.actions?.setTeW2) return store.actions.setTeW2(Number(w2));
		if (store.actions?.setTransitionW2) return store.actions.setTransitionW2(Number(w2));
	}

	function setPresetSpec(spec) {
		if (store.actions?.setTePresetSpec) return store.actions.setTePresetSpec(spec);
	}

	function setSplitsPresetId(id) {
		if (store.actions?.setTeSplitsPresetId) return store.actions.setTeSplitsPresetId(String(id ?? ""));
	}

	function setSplitsDirty(flag) {
		if (store.actions?.setTeSplitsDirty) return store.actions.setTeSplitsDirty(Boolean(flag));
	}

	function syncSelectedElementToWorkspace(elementId, source = "editor") {
		const id = String(elementId ?? "").trim();
		const state = store.getState?.() ?? {};
		const selection = state.workspace_selection ?? {};

		store.actions?.setWorkspaceSelection?.({
			primaryId: selection.primaryId ?? getWorkspacePrimaryId(state) ?? null,
			contextIds: Array.isArray(selection.contextIds) ? selection.contextIds : [],
			elementId: id || null,
			source,
			crsId: selection.crsId ?? null,
		});
	}

	function setPlot(mode) {
		if (store.actions?.setTePlot) return store.actions.setTePlot(String(mode ?? "k"));
	}

	function getPresetIdFromState(st) {
		return String(st?.te_presetId ?? st?.te_preset ?? st?.transitionPresetId ?? "");
	}

	// -----------------------------------------------------------------------------
	// UI helpers

	function syncBounds(a1000, b1000) {
		if (!elW1 || !elW2) return;
		elW1.max = String(b1000);
		elW2.min = String(a1000);
	}

	function setSliderPairAndLabels(w1, w2) {
		const a = Math.round(clamp01(w1) * 1000);
		const b = Math.round(clamp01(w2) * 1000);

		if (elW1) elW1.value = String(a);
		if (elW2) elW2.value = String(b);

		setText(elW1Val, `${Math.round(clamp01(w1) * 100)}%`);
		setText(elW2Val, `${Math.round(clamp01(w2) * 100)}%`);

		syncBounds(a, b);
	}

	function markDirtyOwnedByCurrentPreset() {
		const st = store.getState?.() ?? {};
		const pid = String(st.te_presetId ?? "");
		if (!pid) return;

		if (String(st.te_splitsPresetId ?? "") !== pid) setSplitsPresetId(pid);
		if (!Boolean(st.te_splitsDirty)) setSplitsDirty(true);
	}

	// -----------------------------------------------------------------------------
	// worker

	async function listPresets() {
		return messaging.sendCmdAwait("Transition.ListPresets", {});
	}

	async function getPresetSpec(presetId) {
		return messaging.sendCmdAwait("Transition.GetPresetSpec", { presetId });
	}

	// -----------------------------------------------------------------------------
	// cache

	const _specCache = new Map();
	let _applySeq = 0;

	// -----------------------------------------------------------------------------
	// native alignment element edit UI state

	let _editUi = null;
	let _activeAlignmentSnapshot = null;
	let _focusElementId = "";

	function tx(key, params = {}) {
		return t(key, params);
	}

	function readLocalizedElementType(type) {
		switch (String(type ?? "").toLowerCase()) {
			case "straight":
				return tx("alignment_editor.element_type.straight");
			case "arc":
				return tx("alignment_editor.element_type.arc");
			case "transition":
				return tx("alignment_editor.element_type.transition");
			default:
				return tx("alignment_editor.element_type.unknown");
		}
	}

	function setEditMessage(text, kind = "info") {
		if (!_editUi?.status) return;
		_editUi.status.textContent = String(text ?? "");
		_editUi.status.dataset.kind = String(kind ?? "info");
	}

	function getOverlayBody() {
		if (!ov) return null;
		return ov.querySelector(".uf-panel__body") ?? null;
	}

	function ensureEditUi() {
		if (_editUi) return _editUi;

		const body = getOverlayBody();
		if (!body) return null;

		const root = document.createElement("section");
		root.className = "uf-align-edit";
		root.innerHTML = `
			<div id="aeTitle" class="uf-align-edit__head"></div>
			<div class="uf-align-edit__grid">
				<label id="aeElementSelLabel" for="aeElementSel"></label>
				<select id="aeElementSel" class="select"></select>

				<label id="aeElementTypeLabel" for="aeElementType"></label>
				<input id="aeElementType" class="input" type="text" readonly />

				<label id="aeLengthLabel" for="aeLength"></label>
				<input id="aeLength" class="input" type="number" step="0.001" />

				<label id="aeCurvatureLabel" for="aeCurvature"></label>
				<input id="aeCurvature" class="input" type="number" step="0.000001" />

				<label id="aeRadiusLabel" for="aeRadius"></label>
				<input id="aeRadius" class="input" type="number" step="0.001" />

				<label id="aeTransitionTypeLabel" for="aeTransitionType"></label>
				<select id="aeTransitionType" class="select"></select>

				<label id="aeW1Label" for="aeW1"></label>
				<input id="aeW1" class="input" type="number" min="0" max="1" step="0.001" />

				<label id="aeW2Label" for="aeW2"></label>
				<input id="aeW2" class="input" type="number" min="0" max="1" step="0.001" />
			</div>
			<div id="aeSignedContext" class="uf-align-edit__hint"></div>
			<div class="uf-align-edit__actions">
				<button id="aeApply" type="button" class="btn"></button>
				<button id="aeReset" type="button" class="btn btn--ghost"></button>
			</div>
			<div id="aeStatus" class="uf-align-edit__status" data-kind="info"></div>
		`;

		body.appendChild(root);

		_editUi = {
			root,
			title: root.querySelector("#aeTitle"),
			elementSelLabel: root.querySelector("#aeElementSelLabel"),
			typeLabel: root.querySelector("#aeElementTypeLabel"),
			lengthLabel: root.querySelector("#aeLengthLabel"),
			curvatureLabel: root.querySelector("#aeCurvatureLabel"),
			radiusLabel: root.querySelector("#aeRadiusLabel"),
			transitionTypeLabel: root.querySelector("#aeTransitionTypeLabel"),
			w1Label: root.querySelector("#aeW1Label"),
			w2Label: root.querySelector("#aeW2Label"),
			elementSel: root.querySelector("#aeElementSel"),
			type: root.querySelector("#aeElementType"),
			length: root.querySelector("#aeLength"),
			curvature: root.querySelector("#aeCurvature"),
			radius: root.querySelector("#aeRadius"),
			transitionType: root.querySelector("#aeTransitionType"),
			w1: root.querySelector("#aeW1"),
			w2: root.querySelector("#aeW2"),
			signedContext: root.querySelector("#aeSignedContext"),
			apply: root.querySelector("#aeApply"),
			reset: root.querySelector("#aeReset"),
			status: root.querySelector("#aeStatus"),
		};

		localizeEditUiText();

		_editUi.elementSel?.addEventListener("change", () => {
			renderSelectedElementForm();
			syncSelectedElementToWorkspace(selectedElementId(), "editor");
			setEditMessage(tx("alignment_editor.status.element_selected"), "info");
		});

		_editUi.apply?.addEventListener("click", () => {
			void applyCurrentElementEdit();
		});

		_editUi.reset?.addEventListener("click", () => {
			renderSelectedElementForm();
			setEditMessage(tx("alignment_editor.status.inputs_reset"), "info");
		});

		return _editUi;
	}

	function localizeEditUiText() {
		if (!_editUi) return;
		_editUi.title.textContent = tx("alignment_editor.title");
		_editUi.elementSelLabel.textContent = tx("alignment_editor.label.element");
		_editUi.typeLabel.textContent = tx("alignment_editor.label.type");
		_editUi.lengthLabel.textContent = tx("alignment_editor.label.length_m");
		_editUi.curvatureLabel.textContent = tx("alignment_editor.label.curvature_inv_m");
		_editUi.radiusLabel.textContent = tx("alignment_editor.label.radius_m");
		_editUi.transitionTypeLabel.textContent = tx("alignment_editor.label.transition_family");
		_editUi.w1Label.textContent = tx("alignment_editor.label.w1");
		_editUi.w2Label.textContent = tx("alignment_editor.label.w2");
		_editUi.apply.textContent = tx("alignment_editor.action.apply");
		_editUi.reset.textContent = tx("alignment_editor.action.reset");
	}

	function unwrapSpotState(raw) {
		if (!raw) return null;
		if (raw.state && typeof raw.state === "object") return raw.state;
		if (raw.ok && raw.payload && typeof raw.payload === "object") return raw.payload;
		if (typeof raw === "object") return raw;
		return null;
	}

	function getActiveAlignmentFromSpotState(spotState) {
		const primaryId = getWorkspacePrimaryId(store.getState?.() ?? {});
		if (!primaryId) return null;

		const objects = Array.isArray(spotState?.objects)
			? spotState.objects
			: (
				spotState?.objects && typeof spotState.objects === "object"
					? Object.values(spotState.objects)
					: (Array.isArray(spotState?.items) ? spotState.items : [])
			);

		const active = objects.find((o) => String(o?.id ?? "") === String(primaryId));
		if (!active) return null;

		const alignmentData = active?.data?.alignmentData ?? null;
		if (!alignmentData?.editModel?.elements) return null;

		return {
			objectId: String(active.id),
			alignmentData,
		};
	}

	function formatElementOptionLabel(el) {
		const type = String(el?.type ?? "element").toLowerCase();
		const id = String(el?.id ?? "-");
		const length = Number(el?.parameters?.length ?? el?.length ?? el?.arcLength);
		const lenLabel = Number.isFinite(length)
			? tx("alignment_editor.option.length_m", { value: length.toFixed(3) })
			: tx("alignment_editor.value.missing");
		return `${id} · ${readLocalizedElementType(type)} · ${lenLabel}`;
	}

	function setFieldDisabled(el, disabled) {
		if (!el) return;
		el.disabled = Boolean(disabled);
	}

	function selectedElementId() {
		return String(_editUi?.elementSel?.value ?? "").trim();
	}

	function findSelectedElement() {
		const id = selectedElementId();
		if (!id) return null;
		const elements = _activeAlignmentSnapshot?.alignmentData?.editModel?.elements;
		if (!Array.isArray(elements)) return null;
		return elements.find((el) => String(el?.id ?? "") === id) ?? null;
	}

	function updateSignedContext(el) {
		if (!_editUi?.signedContext) return;

		if (!el) {
			_editUi.signedContext.textContent = "";
			return;
		}

		const list = _activeAlignmentSnapshot?.alignmentData?.editModel?.elements ?? [];
		const idx = list.findIndex((x) => String(x?.id ?? "") === String(el?.id ?? ""));
		if (idx < 0) {
			_editUi.signedContext.textContent = "";
			return;
		}

		let prevCurv = null;
		let nextCurv = null;
		for (let i = idx - 1; i >= 0; i--) {
			const k = Number(list[i]?.parameters?.curvature ?? list[i]?.curvature);
			if (Number.isFinite(k)) { prevCurv = k; break; }
		}
		for (let i = idx + 1; i < list.length; i++) {
			const k = Number(list[i]?.parameters?.curvature ?? list[i]?.curvature);
			if (Number.isFinite(k)) { nextCurv = k; break; }
		}

		const prevLabel = Number.isFinite(prevCurv) ? prevCurv.toFixed(6) : "—";
		const nextLabel = Number.isFinite(nextCurv) ? nextCurv.toFixed(6) : "—";
		_editUi.signedContext.textContent = tx("alignment_editor.hint.signed_context", {
			prev: prevLabel,
			next: nextLabel,
		});
	}

	function renderSelectedElementForm() {
		if (!_editUi) return;
		const el = findSelectedElement();

		if (!el) {
			_editUi.type.value = "";
			_editUi.length.value = "";
			_editUi.curvature.value = "";
			_editUi.radius.value = "";
			_editUi.transitionType.value = "";
			_editUi.w1.value = "";
			_editUi.w2.value = "";
			updateSignedContext(null);
			setFieldDisabled(_editUi.apply, true);
			return;
		}

		const type = String(el.type ?? "").toLowerCase();
		const length = Number(el?.parameters?.length ?? el?.length ?? el?.arcLength);
		const curvature = Number(el?.parameters?.curvature ?? el?.curvature);
		const radius = Number(el?.parameters?.radius ?? el?.radius);
		const transType = String(el?.parameters?.transitionType ?? el?.transitionType ?? el?.transType ?? "");

		_editUi.type.value = readLocalizedElementType(type);
		_editUi.length.value = Number.isFinite(length) ? String(length) : "";
		_editUi.curvature.value = Number.isFinite(curvature) ? String(curvature) : "";
		_editUi.radius.value = Number.isFinite(radius) ? String(radius) : "";
		_editUi.transitionType.value = transType;
		_editUi.w1.value = Number.isFinite(Number(el?.parameters?.w1 ?? el?.opts?.w1)) ? String(el?.parameters?.w1 ?? el?.opts?.w1) : "";
		_editUi.w2.value = Number.isFinite(Number(el?.parameters?.w2 ?? el?.opts?.w2)) ? String(el?.parameters?.w2 ?? el?.opts?.w2) : "";

		const isStraight = type === "straight";
		const isArc = type === "arc";
		const isTransition = type === "transition";

		setFieldDisabled(_editUi.length, false);
		setFieldDisabled(_editUi.curvature, !isArc);
		setFieldDisabled(_editUi.radius, !isArc);
		setFieldDisabled(_editUi.transitionType, !isTransition);
		setFieldDisabled(_editUi.w1, !isTransition);
		setFieldDisabled(_editUi.w2, !isTransition);
		setFieldDisabled(_editUi.apply, false);

		if (isStraight) {
			_editUi.curvature.value = "";
			_editUi.radius.value = "";
			_editUi.transitionType.value = "";
			_editUi.w1.value = "";
			_editUi.w2.value = "";
		}

		updateSignedContext(el);
	}

	async function loadTransitionFamiliesForEditorUi() {
		if (!_editUi?.transitionType) return;

		const res = await listPresets();
		const items = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : []);

		_editUi.transitionType.innerHTML = "";
		for (const item of items) {
			if (!item?.id) continue;
			const opt = document.createElement("option");
			opt.value = String(item.id);
			opt.textContent = String(item.label ?? item.id);
			_editUi.transitionType.appendChild(opt);
		}
	}

	async function refreshActiveAlignmentEditorUi({ preserveSelection = true } = {}) {
		const editUi = ensureEditUi();
		if (!editUi?.elementSel) return;
		localizeEditUiText();

		const spotRaw = await messaging.sendCmdAwait("Spot.GetState", {});
		const spotState = unwrapSpotState(spotRaw);
		const active = getActiveAlignmentFromSpotState(spotState);
		_activeAlignmentSnapshot = active;

		await loadTransitionFamiliesForEditorUi();

		const requested = String(_focusElementId ?? "").trim();
		const prevSel = preserveSelection ? selectedElementId() : "";
		editUi.elementSel.innerHTML = "";

		const elements = active?.alignmentData?.editModel?.elements;
		if (!Array.isArray(elements) || elements.length === 0) {
			if (requested) {
				setEditMessage(tx("alignment_editor.status.focus_target_missing"), "warn");
			} else {
				setEditMessage(tx("alignment_editor.status.no_editable_elements"), "warn");
			}
			_focusElementId = "";
			renderSelectedElementForm();
			return;
		}

		for (const el of elements) {
			const opt = document.createElement("option");
			opt.value = String(el?.id ?? "");
			opt.textContent = formatElementOptionLabel(el);
			editUi.elementSel.appendChild(opt);
		}

		let wanted = String(elements[0]?.id ?? "");
		if (requested && elements.some((el) => String(el?.id ?? "") === requested)) {
			wanted = requested;
		} else if (prevSel && elements.some((el) => String(el?.id ?? "") === prevSel)) {
			wanted = prevSel;
		}

		editUi.elementSel.value = wanted;
		renderSelectedElementForm();
		if (requested && wanted !== requested) {
			setEditMessage(tx("alignment_editor.status.focus_target_missing"), "warn");
		} else if (requested && wanted === requested) {
			setEditMessage(tx("alignment_editor.status.focus_applied"), "ok");
		} else {
			setEditMessage(tx("alignment_editor.status.state_loaded"), "ok");
		}
			syncSelectedElementToWorkspace(wanted, "editor");
		_focusElementId = "";
	}

	async function applyCurrentElementEdit() {
		try {
			if (!_editUi) return;
			const el = findSelectedElement();
			if (!el) {
				setEditMessage(tx("alignment_editor.status.no_element_selected"), "warn");
				return;
			}

			const type = String(el?.type ?? "").toLowerCase();
			const id = String(el?.id ?? "");
			const lengthRaw = _editUi.length?.value;
			const curvatureRaw = _editUi.curvature?.value;
			const radiusRaw = _editUi.radius?.value;
			const transitionTypeRaw = _editUi.transitionType?.value;
			const w1Raw = _editUi.w1?.value;
			const w2Raw = _editUi.w2?.value;

			const maybeNum = (v) => {
				if (v == null || String(v).trim() === "") return undefined;
				const n = Number(v);
				return Number.isFinite(n) ? n : Number.NaN;
			};

			let result = null;
			if (type === "straight") {
				result = await alignmentEditor.updateStraightLengthOnActiveAlignment({
					elementId: id,
					length: maybeNum(lengthRaw),
				});
			} else if (type === "arc") {
				result = await applyArcEditToActiveAlignment({
					alignmentEditor,
					elementId: id,
					length: maybeNum(lengthRaw),
					curvature: maybeNum(curvatureRaw),
					radius: maybeNum(radiusRaw),
				});
			} else if (type === "transition") {
				const w1 = maybeNum(w1Raw);
				const w2 = maybeNum(w2Raw);
				result = await applyTransitionEditToActiveAlignment({
					alignmentEditor,
					elementId: id,
					length: maybeNum(lengthRaw),
					transitionType: String(transitionTypeRaw ?? "").trim() || undefined,
					w1,
					w2,
					useCurrentSplits: false,
				});
			} else {
				setEditMessage(tx("alignment_editor.status.unsupported_operation"), "warn");
				return;
			}

			if (!result) {
				setEditMessage(tx("alignment_editor.status.no_edit_result"), "warn");
				return;
			}

			if (result?.ok === false || result?.changed === false && result?.status === "rejected") {
				setEditMessage(tx("alignment_editor.status.validation_failed"), "error");
				return;
			}

			if (result?.changed === false) {
				setEditMessage(tx("alignment_editor.status.no_changes_applied"), "info");
				return;
			}

			await refreshActiveAlignmentEditorUi({ preserveSelection: true });
			setEditMessage(tx("alignment_editor.status.recalculated"), "ok");
		} catch {
			setEditMessage(tx("alignment_editor.status.calculation_failed"), "error");
		}
	}

	async function openOverlayAndSync({ preserveSelection = true } = {}) {
		ui.openTransition?.();
		setOpen(true);

		await ensureViewInitOnce();

		const st = store.getState?.() ?? {};
		const presetId = getPresetIdFromState(st);

		if (presetId) {
			await applyPresetSpecToStoreAndUI(presetId);
			if (elPresetMain) elPresetMain.value = presetId;
			if (elPresetAlt) elPresetAlt.value = presetId;
		}

		await refreshActiveAlignmentEditorUi({ preserveSelection });

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				view?.resize?.();
			});
		});
	}

	async function focusElementInEditor({ elementId } = {}) {
		const id = String(elementId ?? "").trim();
		if (!id) {
			setEditMessage(tx("alignment_editor.status.focus_target_invalid"), "warn");
			return false;
		}

		_focusElementId = id;
		await openOverlayAndSync({ preserveSelection: false });

		if (selectedElementId() === id) {
			return true;
		}

		for (let attempt = 0; attempt < 3; attempt++) {
			_focusElementId = id;
			await new Promise((resolve) => setTimeout(resolve, 30));
			await refreshActiveAlignmentEditorUi({ preserveSelection: false });
			if (selectedElementId() === id) {
				syncSelectedElementToWorkspace(id, "editor");
				return true;
			}
		}

		setEditMessage(tx("alignment_editor.status.focus_target_missing"), "warn");
		syncSelectedElementToWorkspace(null, "editor");
		return false;
	}

	function getCachedOrCurrentSpec(presetId) {
		const pid = String(presetId ?? "");
		if (!pid) return null;

		const st = store.getState?.() ?? {};
		const current = st.te_presetSpec ?? null;

		if (current && String(current.presetId ?? "") === pid) {
			return current;
		}

		return _specCache.get(pid) ?? null;
	}

	// -----------------------------------------------------------------------------
	// main apply

	async function applyPresetSpecToStoreAndUI(presetId, { force = false } = {}) {
		const wantId = String(presetId ?? "");
		if (!wantId) return null;

		setPresetId(wantId);

		if (!force) {
			const cached = getCachedOrCurrentSpec(wantId);
			if (cached) {
				const cuts = cuts01FromSpecOrDescriptor(cached);
				const w1 = clamp01(cuts.w1);
				const w2 = clamp01(cuts.w2);

				setPresetSpec(cached);
				setSplitsPresetId(wantId);
				setSplitsDirty(false);
				setSliderPairAndLabels(w1, w2);
				setW1(w1);
				setW2(w2);

				return cached;
			}
		}

		const seq = ++_applySeq;
		const raw = await getPresetSpec(wantId);
		if (seq !== _applySeq) return null;

		const desc = raw?.descriptor ?? raw ?? null;
		if (!desc) {
			console.warn("[TE Bridge] missing descriptor/spec for preset", { wantId, raw });
			return null;
		}

		const gotId = String(raw?.presetId ?? desc?.id ?? wantId ?? "");
		const cuts = cuts01FromSpecOrDescriptor(raw);

		const spec = {
			presetId: gotId,
			descriptor: desc,
			cuts01: cuts,
			meta: raw?.meta ?? desc?.meta ?? null,
		};

		_specCache.set(gotId, spec);

		setPresetSpec(spec);
		setSplitsPresetId(gotId);
		setSplitsDirty(false);

		const w1 = clamp01(cuts.w1);
		const w2 = clamp01(cuts.w2);

		setSliderPairAndLabels(w1, w2);
		setW1(w1);
		setW2(w2);

		return spec;
	}

	// -----------------------------------------------------------------------------
	// init

	async function loadPresetsIntoUI() {
		const res = await listPresets();
		const items = Array.isArray(res)
			? res
			: (Array.isArray(res?.items) ? res.items : []);

		const st = store.getState?.() ?? {};
		const current = getPresetIdFromState(st);

		const ids = items.map((x) => x?.id).filter(Boolean);
		const active = (current && ids.includes(current)) ? current : (ids[0] ?? "");

		fillSelect(elPresetMain, items, active);
		fillSelect(elPresetAlt, items, active);

		if (active) {
			setPresetId(active);
		}
	}

	// -----------------------------------------------------------------------------
	// wiring

	function wirePresetSelect(sel) {
		if (!sel) return;
		sel.addEventListener("change", async () => {
			const id = String(sel.value || "");
			if (!id) return;

			if (sel === elPresetMain && elPresetAlt) elPresetAlt.value = id;
			if (sel === elPresetAlt && elPresetMain) elPresetMain.value = id;

			await applyPresetSpecToStoreAndUI(id);
		});
	}

	function wireSplitSliders() {
		if (!elW1 || !elW2) return;

		function onInput() {
			let a = Number(elW1.value || 0);
			let b = Number(elW2.value || 1000);

			if (a > b) {
				if (document.activeElement === elW1) a = b;
				else b = a;
			}

			elW1.value = String(a);
			elW2.value = String(b);
			syncBounds(a, b);

			const w1 = fromSliderVal01(a);
			const w2 = fromSliderVal01(b);

			setText(elW1Val, `${Math.round(w1 * 100)}%`);
			setText(elW2Val, `${Math.round(w2 * 100)}%`);

			setW1(w1);
			setW2(w2);

			markDirtyOwnedByCurrentPreset();
		}

		const markDirty = () => markDirtyOwnedByCurrentPreset();

		elW1.addEventListener("pointerdown", markDirty);
		elW2.addEventListener("pointerdown", markDirty);
		elW1.addEventListener("mousedown", markDirty);
		elW2.addEventListener("mousedown", markDirty);
		elW1.addEventListener("touchstart", markDirty, { passive: true });
		elW2.addEventListener("touchstart", markDirty, { passive: true });

		elW1.addEventListener("input", onInput);
		elW2.addEventListener("input", onInput);

		syncBounds(Number(elW1.value || 0), Number(elW2.value || 1000));
	}

	function wireOverlayOpenClose() {
		btnOpen?.addEventListener("click", async () => {
			await openOverlayAndSync({ preserveSelection: true });
		});

		btnClose?.addEventListener("click", () => {
			ui.closeTransition?.();
			setOpen(false);
		});

		ov?.addEventListener("click", (event) => {
			if (event.target !== ov) return;
			ui.closeTransition?.();
			setOpen(false);
		});

		window.addEventListener("keydown", (event) => {
			if (event.key !== "Escape") return;
			ui.closeTransition?.();
			setOpen(false);
		});
	}

	function isOverlayOpen() {
		return !!ov && !ov.classList.contains("hidden");
	}

	function wireExternalFocusRequests() {
		window.addEventListener("ufaim:alignment-editor-focus-element", (event) => {
			const elementId = String(event?.detail?.elementId ?? "").trim();
			void focusElementInEditor({ elementId });
		});
	}

	function wirePlotMode() {
		const nodes =
			(ui.elements.tePlotNodes && ui.elements.tePlotNodes.length)
				? Array.from(ui.elements.tePlotNodes)
				: [ui.elements.tePlotK, ui.elements.tePlotK1, ui.elements.tePlotK2].filter(Boolean);

		if (!nodes.length) return;

		for (const el of nodes) {
			el.addEventListener("change", () => {
				if (el.type === "radio" && !el.checked) return;
				const v = String(el.value || "").toLowerCase();
				if (v) setPlot(v);
			});
		}

		const st = store.getState?.() ?? {};
		const plot = String(st.te_plot ?? "k");
		for (const el of nodes) {
			el.checked = (String(el.value) === plot);
		}
	}

	// -----------------------------------------------------------------------------
	// public API

	async function wire() {
		if (ui.elements.__teBridgeWired) return;
		ui.elements.__teBridgeWired = true;

		await loadPresetsIntoUI();

		wirePlotMode();
		wireOverlayOpenClose();
		wirePresetSelect(elPresetMain);
		wirePresetSelect(elPresetAlt);
		wireSplitSliders();
		wireExternalFocusRequests();

		const st = store.getState?.() ?? {};
		const pid = getPresetIdFromState(st);
		const hasSpec =
			!!st.te_presetSpec &&
			String(st.te_presetSpec?.presetId ?? "") === String(pid ?? "");

		if (pid && !hasSpec) {
			await applyPresetSpecToStoreAndUI(pid);
			if (elPresetMain) elPresetMain.value = pid;
			if (elPresetAlt) elPresetAlt.value = pid;
		}

		const overlayAlreadyOpen =
			!ov?.classList?.contains("hidden") ||
			Boolean(store.getState?.()?.te_open);

		if (overlayAlreadyOpen) {
			await openOverlayAndSync({ preserveSelection: true });
		}

		messaging.onEvt?.("Spot.UiStateChanged", async () => {
			if (!isOverlayOpen()) return;
			await refreshActiveAlignmentEditorUi({ preserveSelection: true });
		});

		let lastPrimaryId = getWorkspacePrimaryId(store.getState?.() ?? {});
		store.subscribe?.(() => {
			const nextPrimaryId = getWorkspacePrimaryId(store.getState?.() ?? {});
			if (String(nextPrimaryId ?? "") === String(lastPrimaryId ?? "")) return;
			lastPrimaryId = nextPrimaryId;
			if (!isOverlayOpen()) return;
			void refreshActiveAlignmentEditorUi({ preserveSelection: true });
		});
	}

	async function applyTransitionEditToActiveAlignment({
		alignmentEditor,
		elementId,
		length,
		transitionType,
		w1,
		w2,
		useCurrentSplits = true,
	} = {}) {
		if (!alignmentEditor?.updateTransitionOnActiveAlignment) {
			return {
				changed: false,
				ok: false,
				status: "rejected",
				code: "ALIGNMENT_EDIT_TRANSITION_REJECTED",
				reason: "alignment editor updateTransition is unavailable",
			};
		}

		const id = String(elementId ?? "").trim();
		if (!id) {
			return {
				changed: false,
				ok: false,
				status: "rejected",
				code: "ALIGNMENT_EDIT_TRANSITION_REJECTED",
				reason: "elementId is required",
			};
		}

		const st = store.getState?.() ?? {};
		const presetId = String(transitionType ?? st.te_presetId ?? st.te_preset ?? "").trim();
		const splitW1 = useCurrentSplits ? Number(st.te_w1) : w1;
		const splitW2 = useCurrentSplits ? Number(st.te_w2) : w2;

		return alignmentEditor.updateTransitionOnActiveAlignment({
			elementId: id,
			length,
			transitionType: presetId,
			w1: Number.isFinite(splitW1) ? splitW1 : undefined,
			w2: Number.isFinite(splitW2) ? splitW2 : undefined,
		});
	}

	async function applyArcEditToActiveAlignment({
		alignmentEditor,
		elementId,
		length,
		curvature,
		radius,
	} = {}) {
		if (!alignmentEditor?.updateArcOnActiveAlignment) {
			return {
				changed: false,
				ok: false,
				status: "rejected",
				code: "ALIGNMENT_EDIT_ARC_REJECTED",
				reason: "alignment editor updateArc is unavailable",
			};
		}

		const id = String(elementId ?? "").trim();
		if (!id) {
			return {
				changed: false,
				ok: false,
				status: "rejected",
				code: "ALIGNMENT_EDIT_ARC_REJECTED",
				reason: "elementId is required",
			};
		}

		return alignmentEditor.updateArcOnActiveAlignment({
			elementId: id,
			length,
			curvature,
			radius,
		});
	}

	return {
		wire,
		loadPresetsIntoUI,
		applyPresetSpecToStoreAndUI,
		applyTransitionEditToActiveAlignment,
		applyArcEditToActiveAlignment,
		focusElementInEditor,
		refreshActiveAlignmentEditorUi,
	};
}
