// app/view/editors/transitionEditorView.js
//
// Normierter Transition-Editor: u ∈ [0,1]
//
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
// New contract:
//   - store.te_presetSpec contains pure data only
//   - preferred shape:
//       {
//         presetId,
//         descriptor,
//         cuts01,
//         meta
//       }
//   - runtime preset functions are built locally via
//       kappaBuilder.buildPresetFromDescriptor(descriptor, { w1, w2 })
//
// No rendering math or registry logic in bridge/worker.
// No defs-based runtime building in this view anymore.

import * as JXG from "jsxgraph";
import { clampNumber } from "@src/utils/helpers.js";

export function makeTransitionEditorView(store, { messaging, kappaBuilder } = {}) {
	if (!store?.getState || !store?.subscribe) {
		throw new Error("TransitionEditorView: missing store");
	}
	if (!messaging?.sendCmdAwait) {
		throw new Error("TransitionEditorView: missing messaging.sendCmdAwait");
	}
	if (!kappaBuilder?.buildPresetFromDescriptor) {
		throw new Error("TransitionEditorView: missing kappaBuilder.buildPresetFromDescriptor");
	}

	let board = null;

	// ------------------------------------------------------------
	// local caches / rev
	// ------------------------------------------------------------

	// presetId -> { id, spec, desc, base, variants: Map() }
	const _presetCache = new Map();

	// view rev for cache invalidation
	let _rev = 0;

	function bumpRev() {
		_rev++;
		for (const entry of _presetCache.values()) {
			entry?.variants?.clear?.();
		}
	}

	// ------------------------------------------------------------
	// preset loading (async only here)
	// ------------------------------------------------------------
	
	function normalizeDescriptorSpec(raw) {
	if (!raw) return null;

	// already new-style?
	if (
		raw?.simpleFcn &&
		raw?.halfWave1?.protoDef &&
		raw?.halfWave2?.protoDef &&
		raw?.core?.protoDef
	) {
		return raw;
	}

	const defs = raw?.defs ?? null;
	if (!defs) return raw?.descriptor ?? raw ?? null;

	const presetId = String(raw?.presetId ?? raw?.id ?? "");
	const label =
		String(raw?.meta?.label ?? raw?.label ?? presetId);

	const normLengthPartition =
	Array.isArray(raw?.normLengthPartition) ? raw.normLengthPartition :
	Array.isArray(raw?.lambdas) ? raw.lambdas :
	[0, 1, 0];

	const hw1ProtoId = raw?.halfWave1?.protoId;
	const hw2ProtoId = raw?.halfWave2?.protoId;
	const coreProtoId = raw?.core?.protoId ?? "clothoCore";

	return {
		id: presetId,
		label,
		normLengthPartition,

		halfWave1: {
			...raw?.halfWave1,
			protoDef: defs?.protoFcn?.[hw1ProtoId] ?? null,
		},

		halfWave2: {
			...raw?.halfWave2,
			protoDef: defs?.protoFcn?.[hw2ProtoId] ?? null,
		},

		core: {
			...raw?.core,
			protoDef: defs?.protoFcn?.[coreProtoId] ?? null,
		},

		simpleFcn: defs?.simpleFcn ?? {},
		meta: raw?.meta ?? null,
	};
}

	async function ensurePresetLoaded(id) {
		if (!id) return null;

		const key = String(id);
		if (_presetCache.has(key)) return _presetCache.get(key);

		const spec = await messaging.sendCmdAwait("Transition.GetPresetSpec", { presetId: key });
		const desc = normalizeDescriptorSpec(spec?.descriptor ?? spec ?? null);

		if (!desc) {
			console.warn("[TE] missing descriptor for preset", { id: key, spec });
			return null;
		}

		let base = null;
		try {
			base = kappaBuilder.buildPresetFromDescriptor(desc);
		} catch (err) {
			console.warn("[TE] failed to build base preset from descriptor", {
				id: key,
				desc,
				err: String(err?.message ?? err),
			});
			return null;
		}

		const entry = {
			id: key,
			spec,
			desc,
			base,
			variants: new Map(),
			rev: _rev,
		};

		_presetCache.set(key, entry);
		return entry;
	}

	function getCachedBasePreset(presetId) {
		return _presetCache.get(String(presetId ?? ""))?.base ?? null;
	}

	// ------------------------------------------------------------
	// state helpers
	// ------------------------------------------------------------

	function getPresetIdFromState(st) {
		return String(st?.te_presetId ?? "");
	}

	function getSpec(st) {
		const spec = st?.te_presetSpec ?? null;
		const id = getPresetIdFromState(st);
		if (!spec || !id) return null;

		const specId = String(spec?.presetId ?? spec?.descriptor?.id ?? spec?.id ?? "");
		if (specId && specId !== id) return null;

		return spec;
	}

	function getDescriptor(st) {
		const spec = getSpec(st);
		if (!spec) return null;
		return spec?.descriptor ?? spec ?? null;
	}

	function getDefaultCutsFromSpec(st) {
		const spec = getSpec(st);
		const desc = spec?.descriptor ?? spec ?? null;

		const cuts = spec?.cuts01 ?? null;
		if (cuts) {
			let w1 = Number(cuts.w1);
			let w2 = Number(cuts.w2);

			if (!Number.isFinite(w1)) w1 = 0.33;
			if (!Number.isFinite(w2)) w2 = 0.66;

			w1 = clampNumber(w1, 0, 1);
			w2 = clampNumber(w2, 0, 1);
			if (w2 < w1) [w1, w2] = [w2, w1];

			return { w1, w2 };
		}

		const lambdas = Array.isArray(desc?.normLengthPartition)
			? desc.normLengthPartition.map((x) => Number(x) || 0)
			: null;

		if (lambdas && lambdas.length === 3) {
			let w1 = clampNumber(lambdas[0], 0, 1);
			let w2 = clampNumber(lambdas[0] + lambdas[1], 0, 1);
			if (w2 < w1) [w1, w2] = [w2, w1];
			return { w1, w2 };
		}

		return { w1: 0.33, w2: 0.66 };
	}

	function getSplits(st) {
		const presetId = getPresetIdFromState(st);
		const ownerId = String(st?.te_splitsPresetId ?? "");
		const dirty = Boolean(st?.te_splitsDirty);

		const defaultCuts = getDefaultCutsFromSpec(st);
		const ownedByPreset = presetId && ownerId === presetId;

		let w1;
		let w2;

		if (!dirty || !ownedByPreset) {
			w1 = Number(defaultCuts?.w1);
			w2 = Number(defaultCuts?.w2);
		} else {
			w1 = Number(st?.te_w1);
			w2 = Number(st?.te_w2);
		}

		if (!Number.isFinite(w1)) w1 = 0.33;
		if (!Number.isFinite(w2)) w2 = 0.66;

		w1 = clampNumber(w1, 0, 1);
		w2 = clampNumber(w2, 0, 1);
		if (w2 < w1) [w1, w2] = [w2, w1];

		return { w1, w2 };
	}

	function getPreset(st) {
		const presetId = getPresetIdFromState(st);
		if (!presetId) return null;

		const entry = _presetCache.get(presetId);
		if (!entry?.base) return null;

		const { w1, w2 } = getSplits(st);

		if (!Number.isFinite(w1) || !Number.isFinite(w2)) {
			return entry.base;
		}

		const key = `${Math.round(w1 * 1000) / 1000}::${Math.round(w2 * 1000) / 1000}`;
		if (entry.variants.has(key)) {
			return entry.variants.get(key);
		}

		const desc = entry.desc;
		if (!desc) {
			console.warn("[TE] no descriptor in preset entry yet -> using base preset", { id: presetId });
			return entry.base;
		}

		let variant = null;
		try {
			variant = kappaBuilder.buildPresetFromDescriptor(desc, { w1, w2 });
		} catch (err) {
			console.warn("[TE] failed to build preset variant from descriptor -> using base preset", {
				id: presetId,
				w1,
				w2,
				err: String(err?.message ?? err),
			});
			return entry.base;
		}

		entry.variants.set(key, variant);
		return variant;
	}

	function modeLabel(st) {
		if (st?.te_plot === "k1") return "κ′";
		if (st?.te_plot === "k2") return "κ″";
		return "κ";
	}

	function plotValue(u, st) {
		const p = getPreset(st);
		if (!p) return 0;

		if (st?.te_plot === "k1") return p.kappa1(u);
		if (st?.te_plot === "k2") return p.kappa2(u);
		return p.kappa(u);
	}

	// ------------------------------------------------------------
	// auto-range
	// ------------------------------------------------------------

	const autoRange = { key: "", ymin: 0, ymax: 1 };

	function makeRangeKey(st) {
		const { w1, w2 } = getSplits(st);
		const id = getPresetIdFromState(st);
		const plot = String(st?.te_plot ?? "k");
		const sw1 = Math.round(w1 * 1000) / 1000;
		const sw2 = Math.round(w2 * 1000) / 1000;
		return `${id}|${plot}|${sw1}|${sw2}`;
	}

	function computeRange(st) {
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
		const key = makeRangeKey(st);
		if (key === autoRange.key) return;

		autoRange.key = key;
		const r = computeRange(st);
		autoRange.ymin = r.ymin;
		autoRange.ymax = r.ymax;
	}

	function yMap(y, st) {
		if (st?.te_plot === "k") return clampNumber(y, 0, 1);

		ensureRange(st);
		const ymin = autoRange.ymin;
		const ymax = autoRange.ymax;
		const span = Math.max(1e-12, ymax - ymin);

		const yn = (y - ymin) / span;
		return clampNumber(yn, 0, 1);
	}

	let legendEl = null;

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

	// ------------------------------------------------------------
	// JSXGraph
	// ------------------------------------------------------------

	let curveIn = null;
	let curveMid = null;
	let curveOut = null;

	let vline1 = null;
	let vline2 = null;

	let hline0 = null;
	let hline1 = null;

	let hsplit1 = null;
	let hsplit2 = null;

	function updateSplitVisibility(st) {
		const p = getPreset(st);
		const show =
			(st?.te_plot === "k") &&
			!!p?.cutsCrv &&
			Number.isFinite(p.cutsCrv.c1) &&
			Number.isFinite(p.cutsCrv.c2);

		if (hsplit1) hsplit1.setAttribute({ visible: show });
		if (hsplit2) hsplit2.setAttribute({ visible: show });
	}

	async function init() {
		if (board) return;

		const host = document.getElementById("transBoard");
		if (!host) throw new Error("TransitionEditorView: missing #transBoard");

		board = JXG.JSXGraph.initBoard("transBoard", {
			boundingbox: [-0.05, 1.05, 1.05, -0.05],
			axis: true,
			showNavigation: false,
			showCopyright: false,
			zoom: { wheel: false, needshift: false, pinch: false },
			pan: { enabled: false },
			keepaspectratio: false,
		});

		const resizeBoard = () => {
			if (!board) return;
			const w = host.clientWidth || 1;
			const h = host.clientHeight || 1;
			board.resizeContainer(w, h);
			board.fullUpdate();
		};

		requestAnimationFrame(() => resizeBoard());

		host.addEventListener("wheel", (ev) => { ev.preventDefault(); }, { passive: false });
		host.addEventListener("touchmove", (ev) => { ev.preventDefault(); }, { passive: false });

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

		hline0 = board.create("line", [[0, 0], [1, 0]], {
			straightFirst: false,
			straightLast: false,
			dash: 1
		});

		hline1 = board.create("line", [[0, 1], [1, 1]], {
			straightFirst: false,
			straightLast: false,
			dash: 1
		});

		hsplit1 = board.create("line", [
			() => {
				const st = store.getState();
				const p = getPreset(st);
				const c1 = p?.cutsCrv?.c1;
				return [0, Number.isFinite(c1) ? c1 : NaN];
			},
			() => {
				const st = store.getState();
				const p = getPreset(st);
				const c1 = p?.cutsCrv?.c1;
				return [1, Number.isFinite(c1) ? c1 : 0];
			}
		], {
			straightFirst: false,
			straightLast: false,
			dash: 2,
			visible: false
		});

		hsplit2 = board.create("line", [
			() => {
				const st = store.getState();
				const p = getPreset(st);
				const c2 = p?.cutsCrv?.c2;
				return [0, Number.isFinite(c2) ? c2 : NaN];
			},
			() => {
				const st = store.getState();
				const p = getPreset(st);
				const c2 = p?.cutsCrv?.c2;
				return [1, Number.isFinite(c2) ? c2 : 0];
			}
		], {
			straightFirst: false,
			straightLast: false,
			dash: 2,
			visible: false
		});

		{
			const st = store.getState();
			updateLegend(st);
			updateSplitVisibility(st);
			board.fullUpdate();
		}

		let _pending = false;
		let _lastPresetId = "";
		let _lastPlot = "";
		let _lastDescRef = null;

		function requestBoardUpdate() {
			if (!board || _pending) return;
			_pending = true;

			requestAnimationFrame(() => {
				_pending = false;

				const st = store.getState();
				const pid = getPresetIdFromState(st);
				const plot = String(st?.te_plot ?? "k");

				if (pid && pid !== _lastPresetId) {
					_lastPresetId = pid;
					void ensurePresetLoaded(pid).then(() => {
						updateLegend(store.getState());
						updateSplitVisibility(store.getState());
						board?.fullUpdate();
					});
				}

				if (plot !== _lastPlot) {
					_lastPlot = plot;
				}

				const descRef = getDescriptor(st);
				if (descRef && descRef !== _lastDescRef) {
					_lastDescRef = descRef;
					bumpRev();
				}

				updateLegend(st);
				updateSplitVisibility(st);
				board.fullUpdate();
			});
		}

		store.subscribe(() => {
			requestBoardUpdate();
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

		_debug: {
			getPreset: () => getPreset(store.getState()),
			getCachedBasePreset,
			ensureRange,
			autoRange,
			plotValue,
		},
	};
}
