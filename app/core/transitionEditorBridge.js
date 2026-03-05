// app/core/transitionEditorBridge.js
//
// Bridge: UI <-> store.te_*  (no rendering, no registry creation)
//
// Responsibilities:
// - Load preset list (via worker cmd)
// - On preset change: fetch preset spec, push to store, sync sliders to preset cuts
// - On slider edit: keep w1/w2 non-crossing, mark splits as "dirty" and owned by current preset
// - Open/close overlay + lazy-init view
//
// Notes:
// - No registry here, no math here.
// - Everything goes through store actions + messaging commands.

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

	if (activeId && items.some((x) => x.id === activeId)) {
		sel.value = activeId;
	}
}

export function makeTransitionEditorBridge({ store, ui, messaging, view } = {}) {
	if (!store?.getState) throw new Error("TransitionEditorBridge: missing store");
	if (!ui?.elements) throw new Error("TransitionEditorBridge: missing ui.elements");
	if (!messaging?.sendCmdAwait) throw new Error("TransitionEditorBridge: missing messaging.sendCmdAwait");

	// ---- UI elements ----
	const elPresetMain = ui.elements.tePresetSelMain ?? null;
	const elPresetAlt  = ui.elements.tePresetSelAlt ?? null;

	const elW1 = ui.elements.teW1 ?? null;
	const elW2 = ui.elements.teW2 ?? null;

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

	// ---- Store action helpers ----
	function setPresetId(id) {
		if (store.actions?.setTePresetId) return store.actions.setTePresetId(id);
		if (store.actions?.setTransitionPresetId) return store.actions.setTransitionPresetId(id);
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

	function setSplitsPresetId(pid) {
		if (store.actions?.setTeSplitsPresetId) return store.actions.setTeSplitsPresetId(String(pid ?? ""));
	}

	function setSplitsDirty(flag) {
		if (store.actions?.setTeSplitsDirty) return store.actions.setTeSplitsDirty(Boolean(flag));
	}

	function setPresetSpec(spec) {
		if (store.actions?.setTePresetSpec) return store.actions.setTePresetSpec(spec);
	}

	function setPlot(mode) {
		if (store.actions?.setTePlot) return store.actions.setTePlot(String(mode ?? "k"));
	}

	function openOverlay()  { ui.openTransition?.(); }
	function closeOverlay() { ui.closeTransition?.(); }

	function getPresetIdFromState(st) {
		return st?.te_presetId ?? st?.te_preset ?? st?.transitionPresetId ?? "";
	}

	// ---- slider helpers ----
	function syncBounds(a, b) {
		if (!elW1 || !elW2) return;
		elW1.max = String(b);
		elW2.min = String(a);
	}

	function setSliderUIFromW(w1, w2) {
		const a = Math.round(clamp01(w1) * 1000);
		const b = Math.round(clamp01(w2) * 1000);

		if (elW1) elW1.value = String(a);
		if (elW2) elW2.value = String(b);

		setText(elW1Val, `${Math.round((a / 1000) * 100)}%`);
		setText(elW2Val, `${Math.round((b / 1000) * 100)}%`);

		syncBounds(a, b);
	}

	function setStoreSplits(w1, w2) {
		setW1?.(w1);
		setW2?.(w2);
	}

	// ---- commands ----
	async function fetchPresetSpec(presetId) {
		// This must return: { presetId, cuts01, defs?, meta?... }
		return messaging.sendCmdAwait("Transition.GetPresetSpec", { presetId });
	}

	// Race-safety: only the latest apply wins
	let _reqSeq = 0;

	async function applyPresetSpecToUI(presetId) {
		const wantId = String(presetId ?? "");
		if (!wantId) return;

		const seq = ++_reqSeq;

		// 0) set preset immediately (so store guard accepts spec)
		setPresetId?.(wantId);

		// 1) fetch spec
		const spec = await fetchPresetSpec(wantId);

		// ignore out-of-order responses
		if (seq !== _reqSeq) return;

		const pid  = String(spec?.presetId ?? wantId);
		const cuts = spec?.cuts01 ?? null;

		// 2) store: spec (guarded in action)
		setPresetSpec?.(spec);

		// 3) store: reset ownership + dirty
		setSplitsPresetId?.(pid);
		setSplitsDirty?.(false);

		// 4) defaults from cuts
		const w1 = clamp01(cuts?.w1 ?? 0.25);
		const w2 = clamp01(cuts?.w2 ?? 0.75);

		// 5) UI + store sync
		setSliderUIFromW(w1, w2);
		setStoreSplits(w1, w2);
	}

	async function loadPresetsIntoUI() {
		const items = await messaging.sendCmdAwait("Transition.ListPresets", {});
		const st = store.getState?.() ?? {};
		const current = String(getPresetIdFromState(st) ?? "");

		const ids = items.map((x) => x.id);
		const active = (current && ids.includes(current)) ? current : (ids[0] ?? "");

		fillSelect(elPresetMain, items, active);
		fillSelect(elPresetAlt, items, active);

		if (active) {
			await applyPresetSpecToUI(active);
		}
	}

	// ---- UI wiring ----
	function wirePresetSelect(sel) {
		if (!sel) return;
		sel.addEventListener("change", async () => {
			const id = String(sel.value || "");
			if (!id) return;
			await applyPresetSpecToUI(id);
		});
	}

	function wireSplitSliders() {
		if (!elW1 || !elW2) return;

		function onInput() {
			let a = Number(elW1.value || 0);
			let b = Number(elW2.value || 1000);

			// never cross
			if (a > b) {
				if (document.activeElement === elW1) a = b;
				else b = a;
			}

			// write back clamped values
			elW1.value = String(a);
			elW2.value = String(b);
			syncBounds(a, b);

			const w1 = clamp01(a / 1000);
			const w2 = clamp01(b / 1000);

			setText(elW1Val, `${Math.round(w1 * 100)}%`);
			setText(elW2Val, `${Math.round(w2 * 100)}%`);

			// store: overrides
			setStoreSplits(w1, w2);

			// store: mark user override for current preset
			const pid = String(store.getState()?.te_presetId ?? "");
			setSplitsPresetId?.(pid);
			setSplitsDirty?.(true);
		}

		elW1.addEventListener("input", onInput);
		elW2.addEventListener("input", onInput);

		// initial bounds (from current slider values)
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

		ov?.addEventListener("click", (event) => {
			if (event.target !== ov) return;
			closeOverlay();
			setOpen?.(false);
		});

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

		for (const el of nodes) {
			el.addEventListener("change", () => {
				if (el.type === "radio" && !el.checked) return;
				const v = String(el.value || "").toLowerCase();
				if (v) setPlot?.(v);
			});
		}

		// initial store -> UI sync
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

		// Ensure: if presetId is already set (reload), apply spec once.
		const st = store.getState?.() ?? {};
		const pid = String(getPresetIdFromState(st) ?? "");
		if (pid) {
			// This will also reset sliders to preset defaults unless you later add "restore dirty owned splits"
			await applyPresetSpecToUI(pid);
		}
	}

	return {
		wire,
		loadPresetsIntoUI,
		applyPresetSpecToUI,
	};
}
