// alignmentBandView.js
// 2D board for reading an embedded alignment:
// - centerline polyline (x/y)
// - curvature band k(s) over station s (physical, 1/m)
// This is NOT the TransitionEditor (which lives in the overlay).

import { clamp01, curvature } from "./transitionModel.js";

export function makeAlignmentBandView(store) {
	let board = null;
	let centerCurve = null;
	let kCurve = null;
	let marker2d = null;
	let bandCursor = null;

	function waitForJXG() {
		return new Promise((resolve) => {
			const tick = () => (window.JXG ? resolve(window.JXG) : requestAnimationFrame(tick));
			tick();
		});
	}

	function getSample() {
		// main.js stores latest sample here (by convention)
		return window.__ufAIM_latestSample || null;
	}

	// physical curvature k(s) in 1/m (lead, transition, arc)
	function k_of_s(sAbs) {
		const st = store.getState();
		const sample = getSample();
		if (!sample) return 0;

		const lead = sample.lead ?? st.lead ?? 60;
		const L = sample.L ?? st.L ?? 120;

		const R = Math.max(1e-9, st.R);
		const k0 = 0;
		const k1 = 1 / R;

		// IMPORTANT: Achsband uses embedded (physical) curvature, not norm-kappa.
		if (sAbs <= lead) return 0;

		if (sAbs <= lead + L) {
			const u = clamp01((sAbs - lead) / Math.max(1e-9, L));
			// For the embedded alignment we can use the currently active transition family params.
			// At the moment we keep it simple: use the store's te_w1/te_w2 as "shape knobs" later,
			// but for 2.0 keep params null -> default / current model.
			// If you want Achsband to reflect editor presets later, we wire params explicitly.
			return curvature(u, { k0, k1 }); // physical k(u)
		}

		return k1;
	}

	// Map station s in [0,total] into a strip on the board
	function bandMapX(s) {
		const sample = getSample();
		const total = Math.max(1, sample?.totalLen || 1);

		const xMin = 20;
		const xMax = 520;
		
		return xMin + (s / total) * (xMax - xMin);
	}

	function bandMapY(k) {
		// k in 1/m. Choose a readable scaling; adjust later if needed.
		// We map k=0 near y=170 and increasing k downwards.
		const y0 = 170;
		const scale = 45000; // tweakable
		
		return y0 - k * scale;
	}

	async function init(boardId = "board2d") {
		const JXG = await waitForJXG();

		board = JXG.JSXGraph.initBoard(boardId, {
			boundingbox: [-40, 200, 560, -220],
			axis: true,
			showNavigation: false,
			showCopyright: false
		});

		// Centerline polyline from latest sample points
		centerCurve = board.create("curve", [
		() => {
			const sample = getSample();
			return (sample?.pts || []).map((p) => p.x);
		},
		() => {
			const sample = getSample();
			return (sample?.pts || []).map((p) => p.y);
		}
		], { strokeWidth: 3 });

		// Curvature band curve: param t in [0,1] -> s -> k(s)
		kCurve = board.create("curve", [
		(t) => {
			const sample = getSample();
			const total = Math.max(1, sample?.totalLen || 1);
			const s = t * total;
			return bandMapX(s);
		},
		(t) => {
			const sample = getSample();
			const total = Math.max(1, sample?.totalLen || 1);
			const s = t * total;
			const k = k_of_s(s);
			return bandMapY(k);
		},
		0, 1
		], { strokeWidth: 2, dash: 2 });

		// A visual "cursor" over the band at current station (lead + u*L)
		bandCursor = board.create("point", [
		() => {
			const st = store.getState();
			const sample = getSample();
			if (!sample) return bandMapX(0);
			const s = (sample.lead ?? st.lead ?? 60) + clamp01(st.te_u) * (sample.L ?? st.L ?? 120);
			return bandMapX(s);
		},
		() => {
			const st = store.getState();
			const sample = getSample();
			if (!sample) return bandMapY(0);
			const s = (sample.lead ?? st.lead ?? 60) + clamp01(st.te_u) * (sample.L ?? st.L ?? 120);
			const k = k_of_s(s);
			return bandMapY(k);
		}
		], { name: "", size: 3, fixed: true });

		// 2D marker synchronized with 3D marker position
		marker2d = board.create("point", [
		() => window.__ufAIM_marker?.x ?? 0,
		() => window.__ufAIM_marker?.y ?? 0
		], { name: "", size: 4, fixed: true });

		// repaint on state changes
		store.subscribe(() => board.update(), { immediate: true });
	}

	return {
		init,
		update: () => board && board.update()
	};
}
