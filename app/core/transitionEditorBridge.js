// app/core/transitionEditorBridge.js
//
// Bridge: UI <-> store.te_*  (no rendering, no registry creation)
// - expects registry to be passed from appCore (single instance)
// - optionally can lazily init a provided view (if you inject it)

function clamp01(x) {
	const v = Number(x);
	if (!Number.isFinite(v)) return 0;
	return Math.max(0, Math.min(1, v));
}

function setText(el, txt) {
	if (!el) return;
	el.textContent = String(txt ?? "");
}

function fillSelect(sel, items, activeId) {
	if (!sel) return;
	sel.innerHTML = "";

	for (const it of items) {
		if (!it?.id) continue;
		const opt = document.createElement("option");
		opt.value = it.id;
		opt.textContent = it.label ?? it.id;
		sel.appendChild(opt);
	}

	if (activeId && items.some(x => x.id === activeId)) {
		sel.value = activeId;
	}
}

export function makeTransitionEditorBridge({ store, ui, registry, view } = {}) {
	if (!store?.getState) throw new Error("TransitionEditorBridge: missing store");
	if (!ui?.elements) throw new Error("TransitionEditorBridge: missing ui.elements");
	if (!registry) throw new Error("TransitionEditorBridge: missing registry");

	// ---- UI elements (robust lookup; accept your current naming) ----
	// You said: familySel is now used as preset list.
	const elPresetMain = ui.elements.tePresetSelMain ?? null;
	const elPresetAlt  = ui.elements.tePresetSelAlt ?? null;

	const elW1 = ui.elements.teW1 ?? null;
	const elW2 = ui.elements.teW2 ?? null;

	const elW1Val = ui.elements.teW1Val ?? null;
	const elW2Val = ui.elements.teW2Val ?? null;

	const btnOpen  = ui.elements.buttonTransition ?? document.getElementById("btnTrans");
	const btnClose = ui.elements.buttonTransitionClose ?? document.getElementById("btnTransClose");
	const ov       = ui.elements.transitionOverlay ?? document.getElementById("transOverlay");

	let _viewInited = false;
	function ensureViewInitOnce() {
		if (!view?.init) return;
		if (_viewInited) return;
		_viewInited = true;
		view.init?.();
	}

	// ---- Store action helpers (support both naming schemes) ----
	function setPresetId(id) {
		if (store.actions?.setTePresetId) return store.actions.setTePresetId(id);
		if (store.actions?.setTransitionPresetId) return store.actions.setTransitionPresetId(id);
		// fallback (if you store it directly)
		if (store.actions?.setTePreset) return store.actions.setTePreset(id);
	}

	function setW1(w1) {
		if (store.actions?.setTeW1) return store.actions.setTeW1(w1);
		if (store.actions?.setTransitionW1) return store.actions.setTransitionW1(w1);
	}

	function setW2(w2) {
		if (store.actions?.setTeW2) return store.actions.setTeW2(w2);
		if (store.actions?.setTransitionW2) return store.actions.setTransitionW2(w2);
	}

	function setOpen(isOpen) {
		if (store.actions?.setTeOpen) return store.actions.setTeOpen(Boolean(isOpen));
		if (store.actions?.setTransitionOpen) return store.actions.setTransitionOpen(Boolean(isOpen));
	}
	
	function openOverlay()  { ui.openTransition?.(); }
	function closeOverlay() { ui.closeTransition?.(); }

	function getPresetIdFromState(st) {
		return st?.te_presetId ?? st?.te_preset ?? st?.transitionPresetId ?? "";
	}

	// ---- Registry → UI ----
	function buildPresetItems() {
		const ids = registry.listPresetIds?.() ?? [];
		const metas = ids
		.map(id => registry.getPresetMeta?.(id))
		.filter(Boolean);

		return metas.map(m => ({
			id: m.id,
			label: m.label ?? m.id,
		}));
	}

	function applyPresetCutsToSliders(presetId) {
		const compiled = registry.compilePreset?.(presetId);
		const cuts = compiled?.cuts01 ?? compiled?.meta?.cuts01 ?? null;
		if (!cuts) return;

		const w1 = clamp01(cuts.w1);
		const w2 = clamp01(cuts.w2);

		// sliders are 0..1000
		if (elW1) elW1.value = String(Math.round(w1 * 1000));
		if (elW2) elW2.value = String(Math.round(w2 * 1000));

		setText(elW1Val, `${Math.round(w1 * 100)}%`);
		setText(elW2Val, `${Math.round(w2 * 100)}%`);

		// also commit into store (so transEd reads consistent state)
		setW1?.(w1);
		setW2?.(w2);
	}

	function loadPresetsIntoUI() {
		const items = buildPresetItems();
		const st = store.getState?.() ?? {};
		const current = getPresetIdFromState(st);

		// pick default if invalid
		const ids = items.map(x => x.id);
		const active = (current && ids.includes(current)) ? current : (ids[0] ?? "");

		fillSelect(elPresetMain, items, active);
		fillSelect(elPresetAlt, items, active);

		// commit active preset into store (single source)
		if (active) setPresetId?.(active);

		// and sync sliders to preset cuts
		if (active) applyPresetCutsToSliders(active);
	}

	// ---- UI → Store wiring ----
	function wirePresetSelect(sel) {
		if (!sel) return;
		sel.addEventListener("change", () => {
			const id = String(sel.value || "");
			if (!id) return;
			setPresetId?.(id);
			applyPresetCutsToSliders(id);
		});
	}

	function wireSplitSliders() {
		const onW = () => {
			const w1 = clamp01((Number(elW1?.value ?? 0) || 0) / 1000);
			const w2 = clamp01((Number(elW2?.value ?? 0) || 0) / 1000);

			setText(elW1Val, `${Math.round(w1 * 100)}%`);
			setText(elW2Val, `${Math.round(w2 * 100)}%`);

			// overrides live in store
			setW1?.(w1);
			setW2?.(w2);
		};

		elW1?.addEventListener("input", onW);
		elW2?.addEventListener("input", onW);
	}
	
	function wireOverlayOpenClose() {
		btnOpen?.addEventListener("click", () => {
			openOverlay();
			setOpen?.(true);

			ensureViewInitOnce(); // lazy init once per session
			requestAnimationFrame(() => view?.resize?.());
		});

		btnClose?.addEventListener("click", () => {
			closeOverlay();
			setOpen?.(false);
		});

		// backdrop click closes (and updates store)
		ov?.addEventListener("click", (event) => {
			if (event.target !== ov) return;
			closeOverlay();
			setOpen?.(false);
		});

		// ESC closes (and updates store)
		window.addEventListener("keydown", (event) => {
			if (event.key !== "Escape") return;
			// don't fight other overlays; closing transition is always safe
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

		// UI -> Store
		for (const el of nodes) {
			el.addEventListener("change", () => {
				// radio: checked only one; checkbox: value still works if user clicks
				if (el.type === "radio" && !el.checked) return;
				const v = String(el.value || "").toLowerCase();
				if (v) store.actions?.setTePlot?.(v);
			});
		}

		// Store -> UI (initial)
		const st = store.getState?.() ?? {};
		const plot = String(st.te_plot ?? "k");
		for (const el of nodes) el.checked = (String(el.value) === plot);
	}

	function wire() {
		// idempotent guard (prevents double wiring)
		if (ui.elements.__teBridgeWired) return;
		ui.elements.__teBridgeWired = true;

		loadPresetsIntoUI();
		wirePlotMode();

		wireOverlayOpenClose();
		wirePresetSelect(elPresetMain);
		wirePresetSelect(elPresetAlt);
		wireSplitSliders();

		// initial: if store already has preset, reflect it
		const st = store.getState?.() ?? {};
		const presetId = getPresetIdFromState(st);
		if (presetId) applyPresetCutsToSliders(presetId);
	}

	return {
		wire,
		// handy for debugging
		loadPresetsIntoUI,
		applyPresetCutsToSliders,
		registry,
	};
}
