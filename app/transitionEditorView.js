// transitionEditorView.js
// Normierter Transition-Editor: u∈[0,1]
// Modes:
//   te_plot="k"  -> κ(u)  in [0,1]
//   te_plot="k1" -> κ'(u) (scaled into view)
//   te_plot="k2" -> κ''(u) (scaled into view)
// Stückweise: halfWave1 auf [0,w1], linear auf [w1,w2], halfWave2 auf [w2,1]

import { clamp01 } from "./transitionModel.js";
import { getTransitionFamily } from "./transition/transitionFamily.js";

export function makeTransitionEditorView(store) {
	let board = null;
	let curveIn = null;
	let curveMid = null;
	let curveOut = null;

	let vline1 = null, vline2 = null;
	let hline0 = null, hline1 = null;
	let hsplit1 = null, hsplit2 = null;
	let cursor = null;
	
	let legendEl = null;

	function modeLabel(st){
		if (st.te_plot === "k1") return "κ′";
		if (st.te_plot === "k2") return "κ″";
		return "κ";
	}

	function updateLegend(st){
		if (!legendEl) legendEl = document.getElementById("teLegend");
		if (!legendEl) return;

		if (st.te_plot === "k") {
			legendEl.textContent = `${modeLabel(st)}  |  y∈[0..1]`;
			return;
		}

		// ensureRange() comes from the Auto-Range patch you inserted
		ensureRange(st);
		const ymin = autoRange.ymin;
		const ymax = autoRange.ymax;

		legendEl.textContent =
		`${modeLabel(st)}  |  auto-range: y∈[${ymin.toFixed(3)} .. ${ymax.toFixed(3)}] → [0..1]`;
	}

	function getFamilyAndParams(st) {
		const fam = getTransitionFamily(st.te_family) || getTransitionFamily("linear-clothoid");
		const def = fam.defaults();

		const p = {
			w1: st.te_w1 ?? def.w1,
			w2: st.te_w2 ?? def.w2,
			m:  st.te_m  ?? def.m ?? 1.0
		};

		// safety
		p.w1 = clamp01(p.w1);
		p.w2 = clamp01(p.w2);
		if (p.w2 < p.w1) { const tmp = p.w1; p.w1 = p.w2; p.w2 = tmp; }

		return { fam, p };
	}

	function updateSplitVisibility(st) {
		const show = (st.te_plot === "k");
		if (hsplit1) hsplit1.setAttribute({ visible: show });
		if (hsplit2) hsplit2.setAttribute({ visible: show });
	}

	function plotValue(u, st) {
		const { fam, p } = getFamilyAndParams(st);

		if (st.te_plot === "k1") return fam.dkappa(u, p);
		if (st.te_plot === "k2") return fam.d2kappa(u, p);
		return fam.kappa(u, p);
	}

	// --- auto-range cache for derivative plots (k1/k2) ---
	const autoRange = {
		key: "",
		ymin: 0,
		ymax: 1
	};

	function makeKey(st) {
		const w1 = Math.round(clamp01(st.te_w1) * 1000) / 1000;
		const w2 = Math.round(clamp01(st.te_w2) * 1000) / 1000;
		const m  = Math.round((st.te_m ?? 1.0) * 1000) / 1000;
		const fam = st.te_family ?? "linear-clothoid";
		return `${fam}|${st.te_plot}|${w1}|${w2}|${m}`;
	}

	function computeRange(st) {
		// For κ(u): already normalized
		if (st.te_plot === "k") {
			return { ymin: 0, ymax: 1 };
		}

		const N = 240; // sampling resolution; fast enough
		let ymin = +Infinity;
		let ymax = -Infinity;

		for (let i = 0; i <= N; i++) {
			const u = i / N;
			const y = plotValue(u, st);
			if (!Number.isFinite(y)) continue;
			if (y < ymin) ymin = y;
			if (y > ymax) ymax = y;
		}

		if (!Number.isFinite(ymin) || !Number.isFinite(ymax)) {
			return { ymin: -1, ymax: 1 };
		}

		// If plot is (almost) constant, center it
		const span = ymax - ymin;
		if (span < 1e-9) {
			const c = ymin;
			return { ymin: c - 1, ymax: c + 1 };
		}

		// Add padding so we don't clamp at the border
		const pad = span * 0.12; // 12% margin
		return { ymin: ymin - pad, ymax: ymax + pad };
	}

	function ensureRange(st) {
		const key = makeKey(st);
		if (key === autoRange.key) return;
		autoRange.key = key;
		const r = computeRange(st);
		autoRange.ymin = r.ymin;
		autoRange.ymax = r.ymax;
	}

	// κ is already 0..1. For derivatives we auto-range into [0..1] window.
	function yMap(y, st) {
		if (st.te_plot === "k") return y;

		ensureRange(st);
		const ymin = autoRange.ymin;
		const ymax = autoRange.ymax;
		const span = Math.max(1e-12, ymax - ymin);

		// normalize to [0,1]
		const yn = (y - ymin) / span;

		// Keep inside the editor window (small overshoots ok, but clamp for stability)
		return clamp01(yn);
	}

	async function init() {
		const JXG = await new Promise((resolve) => {
			const tick = () => (window.JXG ? resolve(window.JXG) : requestAnimationFrame(tick));
			tick();
		});

		board = JXG.JSXGraph.initBoard("transBoard", {
			boundingbox: [-0.05, 1.05, 1.05, -0.05],
			axis: true,
			showNavigation: false,
			showCopyright: false
		});

		// --- 3 segment curves (didactic Berlin-dogma) ---
		// We draw the SAME function, but as 3 separate visible segments.
		// Outside the segment we return NaN → JSXGraph breaks the curve nicely.

		function segY(t, st, a, b) {
			if (t < a || t > b) return NaN;
			return yMap(plotValue(t, st), st);
		}

		curveIn = board.create("curve", [
		(t) => t,
		(t) => {
			const st = store.getState();
			const { p } = getFamilyAndParams(st);
			return segY(t, st, 0, p.w1);
		},
		0, 1
		], { strokeWidth: 2, dash: 2 });

		curveMid = board.create("curve", [
		(t) => t,
		(t) => {
			const st = store.getState();
			const { p } = getFamilyAndParams(st);
			return segY(t, st, p.w1, p.w2);
		},
		0, 1
		], { strokeWidth: 4 });

		curveOut = board.create("curve", [
		(t) => t,
		(t) => {
			const st = store.getState();
			const { p } = getFamilyAndParams(st);
			return segY(t, st, p.w2, 1);
		},
		0, 1
		], { strokeWidth: 2, dash: 2 });

		// Domain split lines (vertical at w1/w2)
		vline1 = board.create("line", [
		() => {
			const { p } = getFamilyAndParams(store.getState());
			return [p.w1, 0];
		},
		() => {
			const { p } = getFamilyAndParams(store.getState());
			return [p.w1, 1];
		}
		], { straightFirst:false, straightLast:false, dash:2 });

		vline2 = board.create("line", [
		() => {
			const { p } = getFamilyAndParams(store.getState());
			return [p.w2, 0];
		},
		() => {
			const { p } = getFamilyAndParams(store.getState());
			return [p.w2, 1];
		}
		], { straightFirst:false, straightLast:false, dash:2 });

		// Frame (0 and 1)
		hline0 = board.create("line", [[0,0],[1,0]], { straightFirst:false, straightLast:false, dash:1 });
		hline1 = board.create("line", [[0,1],[1,1]], { straightFirst:false, straightLast:false, dash:1 });

		// Image split lines (horizontal at w1/w2) — "Berlin raster"
		hsplit1 = board.create("line", [
		() => [0, store.getState().te_w1],
		() => [1, store.getState().te_w1]
		], { straightFirst:false, straightLast:false, dash:2 });

		hsplit2 = board.create("line", [
		() => [0, store.getState().te_w2],
		() => [1, store.getState().te_w2]
		], { straightFirst:false, straightLast:false, dash:2 });

		// Cursor point at (u, plot(u))
		cursor = board.create("point", [
		() => store.getState().u,
		() => {
			const st = store.getState();
			return yMap(plotValue(st.u, st), st);
		}
		], { name:"", size:4, fixed:true });

		store.subscribe(() => {
			const st = store.getState();
			updateLegend(st);
			updateSplitVisibility(st);
			board.update();
		}, { immediate: true });
	}

	return {
		init,
		_debug: { getFamilyAndParams, plotValue, ensureRange, autoRange }
	};
}
