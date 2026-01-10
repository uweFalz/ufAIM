// app/core/uiWiring.js

import { clamp01 } from "../transitionModel.js";

export function wireUI(store, hooks = {}) {
	const el = {
		status: document.getElementById("status"),
		log: document.getElementById("log"),
		props: document.getElementById("props"),

		s: document.getElementById("s"),
		u: document.getElementById("u"),
		uVal: document.getElementById("uVal"),
		sVal: document.getElementById("sVal"),

		L: document.getElementById("L"),
		LVal: document.getElementById("LVal"),

		R: document.getElementById("R"),
		RVal: document.getElementById("RVal"),

		btnReset: document.getElementById("btnReset"),

		// overlay
		btnTrans: document.getElementById("btnTrans"),
		btnTransClose: document.getElementById("btnTransClose"),
		overlay: document.getElementById("transOverlay"),

		w1: document.getElementById("w1"),
		w2: document.getElementById("w2"),
		w1Val: document.getElementById("w1Val"),
		w2Val: document.getElementById("w2Val"),
		preset: document.getElementById("preset"),

		// 3x3 readout
		k0Val: document.getElementById("k0Val"),
		k1Val: document.getElementById("k1Val"),
		kappaVal: document.getElementById("kappaVal"),
		LShow: document.getElementById("LShow"),
		RShow: document.getElementById("RShow"),

		familySel: document.getElementById("familySel"),

		// IO buttons (if present)
		btnSave: document.getElementById("btnSave"),
		btnExport: document.getElementById("btnExport"),
		btnImport: document.getElementById("btnImport"),
		fileImport: document.getElementById("fileImport")
	};

	function setStatus(s) { if (el.status) el.status.textContent = s; }

	function log(msg) {
		if (!el.log) return;
		el.log.textContent = (el.log.textContent ? el.log.textContent + "\n" : "") + msg;
	}

	function showProps(obj) {
		if (!el.props) return;
		el.props.textContent = Object.entries(obj)
		.map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(6) : v}`)
		.join("\n");
	}

	// sliders
	el.s?.addEventListener("input", () => store.setState({ s: Number(el.s.value) }));
	el.u?.addEventListener("input", () => store.setState({ u: Number(el.u.value) / 1000 }));
	el.L?.addEventListener("input", () => store.setState({ L: Number(el.L.value) }));
	el.R?.addEventListener("input", () => store.setState({ R: Number(el.R.value) }));

	// reset
	el.btnReset?.addEventListener("click", () => {
		store.setState({ s: 90, L: 120, R: 800 });
		log("reset: s/L/R");
	});

	// overlay toggle
	el.btnTrans?.addEventListener("click", async () => {
		const st = store.getState();
		const next = !st.te_visible;
		store.setState({ te_visible: next });
		if (hooks.onToggleTransEditor) await hooks.onToggleTransEditor(next);
	});

	el.btnTransClose?.addEventListener("click", () => store.setState({ te_visible: false }));

	// overlay sliders
	el.w1?.addEventListener("input", () => store.setState({ te_w1: Number(el.w1.value) / 1000 }));
	el.w2?.addEventListener("input", () => store.setState({ te_w2: Number(el.w2.value) / 1000 }));

	// preset -> w1/w2
	function setPreset(p) {
		if (p === "clothoid") store.setState({ te_w1: 0.0, te_w2: 1.0 });
		if (p === "bloss") store.setState({ te_w1: 0.5, te_w2: 0.5 });
		if (p === "berlin") store.setState({ te_w1: 0.18, te_w2: 0.82 });
	}
	el.preset?.addEventListener("change", () => setPreset(el.preset.value));

	// family select
	el.familySel?.addEventListener("change", () => {
		store.setState({ te_family: el.familySel.value });
		log("family: " + el.familySel.value);
	});

	// IO: Save/Export/Import
	el.btnSave?.addEventListener("click", () => { hooks.onSave?.(); log("save: local"); });
	el.btnExport?.addEventListener("click", () => { hooks.onExport?.(); log("export: file"); });

	el.btnImport?.addEventListener("click", () => el.fileImport?.click());
	el.fileImport?.addEventListener("change", async () => {
		const file = el.fileImport.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const obj = JSON.parse(text);
			hooks.onProjectLoaded?.(obj);
			log("import: ok ✅ " + file.name);
		} catch (e) {
			log("import: failed ❌ " + String(e));
		} finally {
			el.fileImport.value = "";
		}
	});

	function toast({ text, level = "info", ms = 2500 }) {
		const host = document.getElementById("toasts");
		if (!host) {
			// fallback
			log(`🔔 ${level}: ${text}`);
			return;
		}

		const el = document.createElement("div");
		el.className = "toast";
		el.dataset.level = level;
		el.textContent = text;

		host.appendChild(el);

		// simple lifetime
		setTimeout(() => {
			el.remove();
		}, ms);
	}

	setStatus("ready ✅");

	return {
		hooks, // so appCore can call hooks.onMarkerClick via threeViewer
		log,
		setStatus,
		showProps,
		updateReadouts({ st, marker, readout }) {
			// footer readout
			const u = clamp01((st.s - st.lead) / Math.max(1e-9, st.L));

			if (el.sVal) el.sVal.textContent = `s≈ ${Math.round(st.s)} m`;
			if (el.uVal) el.uVal.textContent = `u=${u.toFixed(3)}`;

			if (el.s) el.s.value = String(Math.round(st.s));
			
			if (el.LVal) el.LVal.textContent = String(st.L);
			if (el.RVal) el.RVal.textContent = String(st.R);

			// 3x3 block
			if (el.k0Val) el.k0Val.textContent = (readout.k0 ?? 0).toFixed(6) + " 1/m";
			if (el.k1Val) el.k1Val.textContent = (readout.k1 ?? 0).toFixed(6) + " 1/m";
			if (el.kappaVal) el.kappaVal.textContent = (readout.kappaNorm ?? 0).toFixed(6);
			if (el.LShow) el.LShow.textContent = `${st.L} m`;
			if (el.RShow) el.RShow.textContent = `${st.R} m`;

			// overlay show/hide + slider text
			if (el.overlay) el.overlay.classList.toggle("hidden", !st.te_visible);

			if (el.w1) el.w1.value = String(Math.round((st.te_w1 ?? 0) * 1000));
			if (el.w2) el.w2.value = String(Math.round((st.te_w2 ?? 1) * 1000));
			if (el.w1Val) el.w1Val.textContent = (st.te_w1 ?? 0).toFixed(3);
			if (el.w2Val) el.w2Val.textContent = (st.te_w2 ?? 1).toFixed(3);
		},
		toast,
		hooks
	};
}
