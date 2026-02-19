// app/view/transitionEditorView.js
//
// Normierter Transition-Editor: u ∈ [0,1]
// Plot modes (store.te_plot):
//   "k"  -> κ(u)   (already normalized to [0,1])
//   "k1" -> κ′(u)  (auto-ranged into [0,1] for display)
//   "k2" -> κ″(u)  (auto-ranged into [0,1] for display)
//
// Splits (store.te_w1 / store.te_w2):
//   [0, w1]   -> segment 1 (dashed)
//   [w1, w2]  -> segment 2 (solid)
//   [w2, 1]   -> segment 3 (dashed)
//
// Presets come from registry.compilePreset(store.te_presetId)
// Registry API expected:
//   - registry.compilePreset(presetId) -> { kappa(u), kappaPrime(u), kappa2(u), kappaInt(u), cuts01:{w1,w2}, meta:{} }

import * as JXG from "jsxgraph";
import { clampNumber } from "../utils/helpers.js";

export function makeTransitionEditorView(store, registry) {
	if (!store?.getState || !store?.subscribe) {
		throw new Error("TransitionEditorView: missing store (getState/subscribe)");
	}
	if (!registry?.compilePreset) {
		throw new Error("TransitionEditorView: missing registry.compilePreset");
	}

	let board = null;

	let curveIn = null;
	let curveMid = null;
	let curveOut = null;

	let vline1 = null;
	let vline2 = null;

	let hline0 = null;
	let hline1 = null;

	let hsplit1 = null;
	let hsplit2 = null;

	let cursor = null;
	let legendEl = null;

	// ------------------------------------------------------------
	// State helpers (single source: store)
	// ------------------------------------------------------------
	function getPreset(st) {
		const id = String(st?.te_presetId ?? "");
		if (!id) return null;
		try {
			return registry.compilePreset(id);
		} catch (e) {
			// don't kill the editor if a preset is temporarily invalid
			console.error("[TransitionEditorView] compilePreset failed:", e);
			return null;
		}
	}

	function getSplits(st) {
		// store overrides are authoritative (bridge writes them)
		let w1 = Number(st?.te_w1);
		let w2 = Number(st?.te_w2);

		const okW1 = Number.isFinite(w1);
		const okW2 = Number.isFinite(w2);

		// fallback: preset cuts if store doesn't have valid splits yet
		if (!okW1 || !okW2) {
			const p = getPreset(st);
			const cuts = p?.cuts01 ?? null;
			if (cuts) {
				w1 = Number(cuts.w1);
				w2 = Number(cuts.w2);
			}
		}

		if (!Number.isFinite(w1)) w1 = 0.33;
		if (!Number.isFinite(w2)) w2 = 0.66;

		w1 = clampNumber(w1, 0, 1);
		w2 = clampNumber(w2, 0, 1);
		
		if (w2 < w1) {
			const t = w1; w1 = w2; w2 = t;
		}

		return { w1, w2 };
	}

	function getU(st) {
		const u = Number(st?.te_u);
		if (!Number.isFinite(u)) return 0;
		return clampNumber(u, 0, 1);
	}

	function modeLabel(st) {
		if (st?.te_plot === "k1") return "κ′";
		if (st?.te_plot === "k2") return "κ″";
		return "κ";
	}

	function plotValue(u, st) {
		const p = getPreset(st);
		if (!p) return 0;

		if (st?.te_plot === "k1") return p.kappaPrime(u);
		if (st?.te_plot === "k2") return p.kappa2(u);
		return p.kappa(u);
	}

	// ------------------------------------------------------------
	// Auto-range for derivative plots (k1 / k2)
	// ------------------------------------------------------------
	const autoRange = { key: "", ymin: 0, ymax: 1 };

	function makeKey(st) {
		const { w1, w2 } = getSplits(st);
		const id = String(st?.te_presetId ?? "");
		const plot = String(st?.te_plot ?? "k");
		const sw1 = Math.round(w1 * 1000) / 1000;
		const sw2 = Math.round(w2 * 1000) / 1000;
		return `${id}|${plot}|${sw1}|${sw2}`;
	}

	function computeRange(st) {
		// κ is normalized by design
		if (st?.te_plot === "k") return { ymin: 0, ymax: 1 };

		const N = 260;
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

		const span = ymax - ymin;
		if (span < 1e-10) {
			const c = ymin;
			return { ymin: c - 1, ymax: c + 1 };
		}

		const pad = span * 0.12;
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

	function yMap(y, st) {
		// κ already 0..1
		if (st?.te_plot === "k") return clampNumber(y, 0, 1);

		ensureRange(st);
		const ymin = autoRange.ymin;
		const ymax = autoRange.ymax;
		const span = Math.max(1e-12, ymax - ymin);

		const yn = (y - ymin) / span;
		return clampNumber(yn, 0, 1);
	}

	function updateLegend(st) {
		if (!legendEl) legendEl = document.getElementById("teLegend");
		if (!legendEl) return;

		if (st?.te_plot === "k") {
			legendEl.textContent = `${modeLabel(st)}  |  y∈[0..1]`;
			return;
		}

		ensureRange(st);
		legendEl.textContent =
		`${modeLabel(st)}  |  auto-range: y∈[${autoRange.ymin.toFixed(3)} .. ${autoRange.ymax.toFixed(3)}] → [0..1]`;
	}

	function updateSplitVisibility(st) {
		// Berlinish didactic: show image-splits only for κ plot
		const show = (st?.te_plot === "k");
		if (hsplit1) hsplit1.setAttribute({ visible: show });
		if (hsplit2) hsplit2.setAttribute({ visible: show });
	}

	// ------------------------------------------------------------
	// JSXGraph init
	// ------------------------------------------------------------
	async function init() {
		if (board) return; // idempotent
		
		const host = document.getElementById("transBoard");
		if (!host) throw new Error("TransitionEditorView: missing #transBoard");

		board = JXG.JSXGraph.initBoard("transBoard", {
			boundingbox: [-0.05, 1.05, 1.05, -0.05],
			axis: true,
			showNavigation: false,
			showCopyright: false,

			// verhindert "unabsichtliches zoom" per wheel/trackpad:
			zoom: { wheel: false, needshift: false, pinch: false },
			pan:  { enabled: false },

			// optional, aber stabil:
			keepaspectratio: false
		});
		
		// after initBoard:
		const resizeBoard = () => {
			if (!board) return;
			const w = host.clientWidth || 1;
			const h = host.clientHeight || 1;
			board.resizeContainer(w, h);
			board.fullUpdate();
		};

		// one frame later, when layout is settled:
		requestAnimationFrame(() => resizeBoard());

		// also: prevent any wheel from reaching JSXGraph (Safari trackpad!)
		host.addEventListener("wheel", (ev) => { ev.preventDefault(); }, { passive: false });
		host.addEventListener("touchmove", (ev) => { ev.preventDefault(); }, { passive:false });

		// We draw the same function as 3 segments by returning NaN outside segment.
		function segY(u, st, a, b) {
			if (u < a || u > b) return NaN;
			return yMap(plotValue(u, st), st);
		}

		curveIn = board.create("curve", [
		(u) => u,
		(u) => {
			const st = store.getState();
			const { w1 } = getSplits(st);
			return segY(u, st, 0, w1);
		},
		0, 1
		], { strokeWidth: 2, dash: 2 });

		curveMid = board.create("curve", [
		(u) => u,
		(u) => {
			const st = store.getState();
			const { w1, w2 } = getSplits(st);
			return segY(u, st, w1, w2);
		},
		0, 1
		], { strokeWidth: 4 });

		curveOut = board.create("curve", [
		(u) => u,
		(u) => {
			const st = store.getState();
			const { w2 } = getSplits(st);
			return segY(u, st, w2, 1);
		},
		0, 1
		], { strokeWidth: 2, dash: 2 });

		// Split lines (vertical at w1/w2)
		vline1 = board.create("line", [
		() => {
			const st = store.getState();
			const { w1 } = getSplits(st);
			return [w1, 0];
		},
		() => {
			const st = store.getState();
			const { w1 } = getSplits(st);
			return [w1, 1];
		}
		], { straightFirst: false, straightLast: false, dash: 2 });

		vline2 = board.create("line", [
		() => {
			const st = store.getState();
			const { w2 } = getSplits(st);
			return [w2, 0];
		},
		() => {
			const st = store.getState();
			const { w2 } = getSplits(st);
			return [w2, 1];
		}
		], { straightFirst: false, straightLast: false, dash: 2 });

		// Frame (0 and 1)
		hline0 = board.create("line", [[0, 0], [1, 0]], { straightFirst: false, straightLast: false, dash: 1 });
		hline1 = board.create("line", [[0, 1], [1, 1]], { straightFirst: false, straightLast: false, dash: 1 });

		// Image split lines (horizontal at w1/w2) — show only for κ mode
		hsplit1 = board.create("line", [
		() => {
			const st = store.getState();
			const { w1 } = getSplits(st);
			return [0, w1];
		},
		() => {
			const st = store.getState();
			const { w1 } = getSplits(st);
			return [1, w1];
		}
		], { straightFirst: false, straightLast: false, dash: 2 });

		hsplit2 = board.create("line", [
		() => {
			const st = store.getState();
			const { w2 } = getSplits(st);
			return [0, w2];
		},
		() => {
			const st = store.getState();
			const { w2 } = getSplits(st);
			return [1, w2];
		}
		], { straightFirst: false, straightLast: false, dash: 2 });

		// Cursor point at (u, plot(u))
		cursor = board.create("point", [
		() => getU(store.getState()),
		() => {
			const st = store.getState();
			const u = getU(st);
			return yMap(plotValue(u, st), st);
		}
		], { name: "", size: 4, fixed: true });

		// initial paint
		{
			const st = store.getState();
			updateLegend(st);
			updateSplitVisibility(st);
			board.fullUpdate();
		}

		// subscribe store updates
		store.subscribe(() => {
			const st = store.getState();
			updateLegend(st);
			updateSplitVisibility(st);
			board.fullUpdate();
		});
	}

	return {
		init,
		resize() {
			if (!board) return;
			const host = document.getElementById("transBoard");
			if (!host) return;
			const w = host.clientWidth || 1;
			const h = host.clientHeight || 1;
			board.resizeContainer(w, h);
			board.fullUpdate();
		},
		// debugging helpers
		_debug: {
			getPreset: () => getPreset(store.getState()),
			plotValue,
			ensureRange,
			autoRange
		}
	};
}
