// transitionEditorView.js
// Normierter Transition-Editor: u∈[0,1]
// Modes:
//   te_plot="k"  -> κ(u)  in [0,1]
//   te_plot="k1" -> κ'(u) (scaled into view)
//   te_plot="k2" -> κ''(u) (scaled into view)
// Stückweise: halfWave1 auf [0,w1], linear auf [w1,w2], halfWave2 auf [w2,1]

import { clamp01 } from "./transitionModel.js"; // keep one clamp impl only

// halfWave1: f(0)=0,f(1)=1,f'(0)=0,f'(1)=1
function halfIn(t) { return -t*t*t + 2*t*t; }
function halfIn1(t) { return -3*t*t + 4*t; }
function halfIn2(t) { return -6*t + 4; }

// halfWave2: g(0)=0,g(1)=1,g'(0)=1,g'(1)=0
function halfOut(t) { return -t*t*t + t*t + t; }
function halfOut1(t) { return -3*t*t + 2*t + 1; }
function halfOut2(t) { return -6*t + 2; }

export function makeTransitionEditorView(store){
	let board = null;
	let curve = null;

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

	// κ(u) piecewise (Berlin-dogma core)
	function kappaCore(u, w1, w2) {
		u = clamp01(u);
		w1 = clamp01(w1);
		w2 = clamp01(w2);
		if (w2 < w1) { const tmp=w1; w1=w2; w2=tmp; }

		// special: if middle collapsed (bloss-like), still define piecewise
		if (u <= w1) {
			if (w1 <= 1e-9) return 0;
			const t = u / w1;
			return w1 * halfIn(t);
		}
		if (u >= w2) {
			if ((1 - w2) <= 1e-9) return 1;
			const t = (u - w2) / (1 - w2);
			return w2 + (1 - w2) * halfOut(t);
		}
		// middle linear: κ(u)=u
		return u;
	}

	// κ'(u)
	function kappa1(u, w1, w2) {
		u = clamp01(u);
		w1 = clamp01(w1);
		w2 = clamp01(w2);
		if (w2 < w1) { const tmp=w1; w1=w2; w2=tmp; }

		if (u <= w1) {
			if (w1 <= 1e-9) return 1;
			const t = u / w1;
			return halfIn1(t);
		}
		if (u >= w2) {
			if((1 - w2) <= 1e-9) return 1;
			const t = (u - w2) / (1 - w2);
			return halfOut1(t);
		}
		return 1;
	}

	// κ''(u)
	function kappa2(u, w1, w2) {
		u = clamp01(u);
		w1 = clamp01(w1);
		w2 = clamp01(w2);
		if (w2 < w1) { const tmp=w1; w1=w2; w2=tmp; }

		if (u <= w1) {
			if (w1 <= 1e-9) return 0;
			const t = u / w1;
			return halfIn2(t) / w1;
		}
		if(u >= w2){
			if ((1 - w2) <= 1e-9) return 0;
			const t = (u - w2) / (1 - w2);
			return halfOut2(t) / (1 - w2);
		}
		return 0;
	}

	function plotValue(u, st) {
		const w1 = st.te_w1;
		const w2 = st.te_w2;

		if (st.te_plot === "k1") return kappa1(u, w1, w2);
		if (st.te_plot === "k2") return kappa2(u, w1, w2);
		return kappaCore(u, w1, w2);
	}

	// --- auto-range cache for derivative plots (k1/k2) ---
	const autoRange = {
		key: "",
		ymin: 0,
		ymax: 1
	};

	function makeKey(st) {
		// rounding to avoid re-sampling on tiny slider jitter
		const w1 = Math.round(clamp01(st.te_w1) * 1000) / 1000;
		const w2 = Math.round(clamp01(st.te_w2) * 1000) / 1000;
		return `${st.te_plot}|${w1}|${w2}`;
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
			const tick=() => (window.JXG ? resolve(window.JXG) : requestAnimationFrame(tick));
			tick();
		});

		board = JXG.JSXGraph.initBoard("transBoard", {
			boundingbox: [-0.05, 1.05, 1.05, -0.05],
			axis: true,
			showNavigation: false,
			showCopyright: false
		});

		// Main curve (mode-dependent)
		curve = board.create("curve", [
		(t) => t,
		(t) => {
			const st = store.getState();
			return yMap(plotValue(t, st), st);
		},
		0, 1
		], { strokeWidth: 3 });

		// Domain split lines (vertical at w1/w2)
		vline1 = board.create("line", [
		() => [store.getState().te_w1, 0],
		() => [store.getState().te_w1, 1]
		], { straightFirst:false, straightLast:false, dash:2 });

		vline2 = board.create("line", [
		() => [store.getState().te_w2, 0],
		() => [store.getState().te_w2, 1]
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
		() => clamp01(store.getState().u),
		() => {
			const st = store.getState();
			const u = clamp01(st.u);
			return yMap(plotValue(u, st), st);
		}
		], { name:"", size:4, fixed:true });

		store.subscribe(() => {
			// keep legend in sync with plot/mode + w1/w2
			updateLegend(store.getState());
			board.update();
		}, { immediate: true });
	}

	return {
		init,
		// export for debugging if you want
		kappaCore, kappa1, kappa2
	};
}
