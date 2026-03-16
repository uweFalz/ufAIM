// app/core/bridges/transitionEditorBridge.js
//
// Bridge: UI <-> store.te_*  (no rendering, no math, no registry)
//
// Worker API used (ONLY):
//   - Transition.ListPresets      -> [{id,label}, ...]
//   - Transition.GetPresetSpec    -> { presetId, cuts01, meta, defs, ... }   (pure data)
//
// Responsibilities:
//   - Load preset list into <select>(s)
//   - On preset change:
//       * store.te_presetId set FIRST (so store guards accept spec)
//       * fetch spec from worker
//       * store.te_presetSpec = spec
//       * reset splits ownership to this preset and dirty=false
//       * set sliders to spec.cuts01 and store.te_w1/te_w2 accordingly
//   - On slider input:
//       * keep non-crossing constraints
//       * update store.te_w1/te_w2
//       * mark splitsDirty=true and splitsPresetId=current presetId
//   - Open/close overlay and lazy-init view
//
// Notes:
//   - This bridge does NOT rename presets to "variant" etc.
//     That is an editor-level UX decision for later (and requires edit-state modeling).

import { clamp01 } from "@app/utils/helpers.js";

//
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

function toSliderVal01(v01) {
	return String(Math.round(clamp01(v01) * 1000));
}

function fromSliderVal01(v1000) {
	return clamp01(Number(v1000) / 1000);
}

//
// ...
//
export function makeTransitionEditorBridge({ store, ui, messaging, view } = {}) {
	if (!store?.getState) throw new Error("TransitionEditorBridge: missing store");
	if (!ui?.elements) throw new Error("TransitionEditorBridge: missing ui.elements");
	if (!messaging?.sendCmdAwait) throw new Error("TransitionEditorBridge: missing messaging.sendCmdAwait");

	// ---- UI elements (robust lookup; accept your current naming) ----
	const elPresetMain = ui.elements.tePresetSelMain ?? null;
	const elPresetAlt  = ui.elements.tePresetSelAlt ?? null;

	const elW1 = ui.elements.teW1 ?? null;   // expected range 0..1000
	const elW2 = ui.elements.teW2 ?? null;   // expected range 0..1000

	const elW1Val = ui.elements.teW1Val ?? null;
	const elW2Val = ui.elements.teW2Val ?? null;

	const btnOpen  = ui.elements.buttonTransition ?? document.getElementById("btnTrans");
	const btnClose = ui.elements.buttonTransitionClose ?? document.getElementById("btnTransClose");
	const ov       = ui.elements.transitionOverlay ?? document.getElementById("transOverlay");

	// ---- view init gating ----
	let _viewInitPromise = null;
	async function ensureViewInitOnce() {
		if (!view?.init) return;
		if (_viewInitPromise) return _viewInitPromise;
		_viewInitPromise = (async () => { await view.init(); })();
		return _viewInitPromise;
	}

	// ---- Store action helpers (support your current actions) ----
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

	function setSplitsPresetId(presetId) {
		if (store.actions?.setTeSplitsPresetId) return store.actions.setTeSplitsPresetId(String(presetId ?? ""));
	}

	function setSplitsDirty(flag) {
		if (store.actions?.setTeSplitsDirty) return store.actions.setTeSplitsDirty(Boolean(flag));
	}

	function setPlot(mode) {
		if (store.actions?.setTePlot) return store.actions.setTePlot(String(mode ?? "k"));
	}

	function openOverlay()  { ui.openTransition?.(); }
	function closeOverlay() { ui.closeTransition?.(); }

	function getPresetIdFromState(st) {
		return String(st?.te_presetId ?? st?.te_preset ?? st?.transitionPresetId ?? "");
	}

	// ---- internal UI helpers ----
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

		if (String(st.te_splitsPresetId ?? "") !== pid) setSplitsPresetId?.(pid);
		if (!Boolean(st.te_splitsDirty)) setSplitsDirty?.(true);
	}

	// ---- Worker calls (only Transition.*) ----
	async function listPresets() {
		return messaging.sendCmdAwait("Transition.ListPresets", {});
	}

	async function getPresetSpec(presetId) {
		return messaging.sendCmdAwait("Transition.GetPresetSpec", { presetId });
	}

	// ---- race-safe preset applying ----
	let _applySeq = 0;

	async function applyPresetSpecToStoreAndUI(presetId) {
		const wantId = String(presetId ?? "");
		if (!wantId) return;

		// important: set presetId FIRST (so store can accept presetSpec by guard)
		setPresetId?.(wantId);

		const seq = ++_applySeq;

		const spec = await getPresetSpec(wantId);

		// drop stale response (user changed selection while awaiting)
		if (seq !== _applySeq) return;

		const gotId = String(spec?.presetId ?? wantId ?? "");
		const cuts = spec?.cuts01 ?? null;

		// store: presetSpec
		setPresetSpec?.(spec);

		// store: ownership reset + not dirty
		setSplitsPresetId?.(gotId);
		setSplitsDirty?.(false);

		// cuts -> defaults
		const w1 = clamp01(cuts?.w1 ?? 0.25);
		const w2 = clamp01(cuts?.w2 ?? 0.75);

		// UI sliders + labels
		setSliderPairAndLabels(w1, w2);

		// store w1/w2 (even though dirty=false; they reflect defaults)
		setW1?.(w1);
		setW2?.(w2);
	}

	// ---- load preset list + initial selection ----
	async function loadPresetsIntoUI() {
		const items = await listPresets();

		const st = store.getState?.() ?? {};
		const current = getPresetIdFromState(st);

		const ids = (items || []).map((x) => x?.id).filter(Boolean);
		const active = (current && ids.includes(current)) ? current : (ids[0] ?? "");

		fillSelect(elPresetMain, items, active);
		fillSelect(elPresetAlt, items, active);

		if (active) {
			await applyPresetSpecToStoreAndUI(active);
		}
	}

	// ---- UI wiring ----
	function wirePresetSelect(sel) {
		if (!sel) return;
		sel.addEventListener("change", async () => {
			const id = String(sel.value || "");
			if (!id) return;

			// keep both selects in sync visually
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

			// never cross: clamp the one being moved
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

			setW1?.(w1);
			setW2?.(w2);

			// user override
			markDirtyOwnedByCurrentPreset();
		}

		// mark dirty early (nice UX, and avoids any “first input lost” edge)
		const markDirty = () => markDirtyOwnedByCurrentPreset();
		elW1.addEventListener("pointerdown", markDirty);
		elW2.addEventListener("pointerdown", markDirty);
		elW1.addEventListener("mousedown", markDirty);
		elW2.addEventListener("mousedown", markDirty);
		elW1.addEventListener("touchstart", markDirty, { passive: true });
		elW2.addEventListener("touchstart", markDirty, { passive: true });

		elW1.addEventListener("input", onInput);
		elW2.addEventListener("input", onInput);

		// init bounds from current slider DOM values
		syncBounds(Number(elW1.value || 0), Number(elW2.value || 1000));
	}

	function wireOverlayOpenClose() {
		btnOpen?.addEventListener("click", async () => {
			openOverlay();
			setOpen?.(true);

			await ensureViewInitOnce();

			// let layout settle, then resize board
			requestAnimationFrame(() => requestAnimationFrame(() => view?.resize?.()));
		});

		btnClose?.addEventListener("click", () => {
			closeOverlay();
			setOpen?.(false);
		});

		// backdrop click closes
		ov?.addEventListener("click", (event) => {
			if (event.target !== ov) return;
			closeOverlay();
			setOpen?.(false);
		});

		// ESC closes
		window.addEventListener("keydown", (event) => {
			if (event.key !== "Escape") return;
			closeOverlay();
			setOpen?.(false);
		});
	}

	function wirePlotMode() {
		const nodes =
		(ui.elements.tePlotNodes && ui.elements.tePlotNodes.length)
		? Array.from(ui.elements.tePlotNodes)
		: [ui.elements.tePlotK, ui.elements.tePlotK1, ui.elements.tePlotK2].filter(Boolean);

		if (!nodes.length) return;

		// UI -> store
		for (const el of nodes) {
			el.addEventListener("change", () => {
				if (el.type === "radio" && !el.checked) return;
				const v = String(el.value || "").toLowerCase();
				if (v) setPlot?.(v);
			});
		}

		// store -> UI (initial)
		const st = store.getState?.() ?? {};
		const plot = String(st.te_plot ?? "k");
		for (const el of nodes) el.checked = (String(el.value) === plot);
	}

	// ---- public API ----
	async function wire() {
		if (ui.elements.__teBridgeWired) return;
		ui.elements.__teBridgeWired = true;

		await loadPresetsIntoUI();

		wirePlotMode();
		wireOverlayOpenClose();
		wirePresetSelect(elPresetMain);
		wirePresetSelect(elPresetAlt);
		wireSplitSliders();

		// After reload: if a presetId exists but spec missing, re-apply from worker.
		// This keeps the bridge robust without requiring appCore choreography.
		const st = store.getState?.() ?? {};
		const pid = getPresetIdFromState(st);
		const hasSpec = !!st.te_presetSpec && String(st.te_presetSpec?.presetId ?? "") === String(pid ?? "");
		if (pid && !hasSpec) {
			await applyPresetSpecToStoreAndUI(pid);
			// also sync selects visually
			if (elPresetMain) elPresetMain.value = pid;
			if (elPresetAlt)  elPresetAlt.value = pid;
		}
	}

	return {
		wire,
		loadPresetsIntoUI,
		applyPresetSpecToStoreAndUI,
	};
}
