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

import { clampNumber } from "@utils/helpers.js";

//
// ...
//
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
	let boardHost = null;
	let observedRenderer = null;
	let rendererRecovery = null;
	let engineeringPreview = null;

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

	async function samplePreset(presetId, { w1, w2, count = 81 } = {}) {
		const entry = await ensurePresetLoaded(String(presetId ?? ""));
		if (!entry?.desc) return null;
		let preset = entry.base;
		if (Number.isFinite(w1) && Number.isFinite(w2)) {
			preset = kappaBuilder.buildPresetFromDescriptor(entry.desc, {
				w1: clampNumber(w1, 0, 1),
				w2: clampNumber(w2, 0, 1),
			});
		}
		const n = Math.max(3, Math.min(401, Math.trunc(Number(count) || 81)));
		return {
			presetId: entry.id,
			domain: { normalized: [0, 1], physical: null },
			cutsCrv: preset?.cutsCrv ?? null,
			samples: Array.from({ length: n }, (_, index) => {
				const u = index / (n - 1);
				return { u, k: preset.kappa(u), k1: preset.kappa1(u), k2: preset.kappa2(u) };
			}),
		};
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

	function plotValueForMode(u, st, mode) {
		const p = getPreset(st);
		if (!p) return 0;
		if (mode === "k1") return p.kappa1(u);
		if (mode === "k2") return p.kappa2(u);
		return p.kappa(u);
	}

	function normalizedReferenceValue(u, st, mode) {
		if (mode === "k") return clampNumber(plotValueForMode(u, st, mode), 0, 1);
		let lo = Infinity;
		let hi = -Infinity;
		for (let index = 0; index <= 120; index += 1) {
			const value = plotValueForMode(index / 120, st, mode);
			if (!Number.isFinite(value)) continue;
			lo = Math.min(lo, value);
			hi = Math.max(hi, value);
		}
		if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 0.5;
		if (Math.abs(hi - lo) < 1e-12) return 0.5;
		return clampNumber((plotValueForMode(u, st, mode) - lo) / (hi - lo), 0, 1);
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
			legendEl.textContent = `κ · κ′ · κ″  |  active: ${modeLabel(st)}  |  normalized comparison`;
			return;
		}

		ensureRange(st);
		legendEl.textContent =
			`κ · κ′ · κ″  |  active: ${modeLabel(st)}  |  auto-range y∈[${autoRange.ymin.toFixed(3)} .. ${autoRange.ymax.toFixed(3)}] → [0..1]`;
	}

	// ------------------------------------------------------------
	// JSXGraph
	// ------------------------------------------------------------

	let curveIn = null;
	let curveMid = null;
	let curveOut = null;

	let vline1 = null;
	let vline2 = null;
	let vlineHit1 = null;
	let vlineHit2 = null;

	let hline0 = null;
	let hline1 = null;

	let hsplit1 = null;
	let hsplit2 = null;
	let referenceCurves = [];

	function resetBoardReferences() {
		curveIn = null;
		curveMid = null;
		curveOut = null;
		vline1 = null;
		vline2 = null;
		vlineHit1 = null;
		vlineHit2 = null;
		hline0 = null;
		hline1 = null;
		hsplit1 = null;
		hsplit2 = null;
		referenceCurves = [];
	}

	function releaseBoard() {
		vlineHit1?.rendNode?.remove?.();
		vlineHit2?.rendNode?.remove?.();
		if (board) {
			try {
				JXG.JSXGraph.freeBoard(board);
			} catch {
				// A detached or partially restored renderer may already be absent.
			}
		}
		board = null;
		boardHost = null;
		resetBoardReferences();
	}

	function renderEngineeringPreview(projection) {
		const host = document.getElementById("teDetails");
		if (!host) return null;
		if (!engineeringPreview?.isConnected) {
			engineeringPreview = document.createElement("section");
			engineeringPreview.dataset.transitionAxtranEngineeringPreview = "";
			engineeringPreview.setAttribute("aria-label", "Transition AXTRAN Engineering Preview");
			host.append(engineeringPreview);
		}
		const model = createTransitionAxtranEngineeringPreviewViewModel(projection);
		engineeringPreview.replaceChildren();
		const heading = document.createElement("h3");
		heading.textContent = "Engineering Preview";
		const status = document.createElement("strong");
		status.dataset.previewStatus = model.status;
		status.textContent = "UNAPPLIED / NICHT ANGEWENDET";
		const grid = document.createElement("dl");
		for (const [label, value] of model.rows) {
			const dt = document.createElement("dt");
			dt.textContent = label;
			const dd = document.createElement("dd");
			const pre = document.createElement("pre");
			pre.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
			dd.append(pre);
			grid.append(dt, dd);
		}
		engineeringPreview.append(heading, status, grid);
		return engineeringPreview;
	}

	function rendererRect(host) {
		const renderer = host?.querySelector?.(":scope > svg, :scope > canvas");
		return renderer?.getBoundingClientRect?.() ?? null;
	}

	function currentRenderer(host = boardHost) {
		return host?.querySelector?.(":scope > svg, :scope > canvas") ?? null;
	}

	const rendererSizeObserver = new ResizeObserver(() => {
		const host = document.getElementById("transBoard");
		const rect = rendererRect(host);
		if (
			host?.isConnected
			&& host.getClientRects().length
			&& (!rect || rect.width <= 1 || rect.height <= 1)
		) {
			scheduleRendererRecovery();
		}
	});

	function observeRenderer(host) {
		const renderer = currentRenderer(host);
		if (renderer === observedRenderer) return;
		if (observedRenderer) rendererSizeObserver.unobserve(observedRenderer);
		observedRenderer = renderer;
		if (renderer) {
			renderer.dataset.transedPlotRole = "primary-function-renderer";
			rendererSizeObserver.observe(renderer);
		}
	}

	function ownsVisibleHost(host) {
		if (!board || !host?.isConnected || boardHost !== host || board.containerObj !== host) return false;
		const rect = rendererRect(host);
		return Boolean(rect && rect.width > 1 && rect.height > 1);
	}

	async function prepareVisibleHost(host) {
		host.dataset.transedPlotRole = "primary-function-host";
		host.style.removeProperty("width");
		host.style.removeProperty("height");
		for (let frame = 0; frame < 12; frame += 1) {
			const rect = host.getBoundingClientRect();
			if (host.isConnected && host.getClientRects().length && rect.width >= 160 && rect.height >= 120) {
				return { width: Math.round(rect.width), height: Math.round(rect.height) };
			}
			await new Promise((resolve) => requestAnimationFrame(resolve));
		}
		const rect = host.getBoundingClientRect();
		throw new Error(`TransitionEditorView: visible #transBoard has degenerate layout ${rect.width}x${rect.height}`);
	}

	function scheduleRendererRecovery() {
		if (rendererRecovery) return rendererRecovery;
		rendererRecovery = (async () => {
			await new Promise((resolve) => requestAnimationFrame(resolve));
			const host = document.getElementById("transBoard");
			if (!host?.isConnected || !host.getClientRects().length) return false;
			const rect = rendererRect(host);
			if (ownsVisibleHost(host) && rect.width > 1 && rect.height > 1) return true;
			await init();
			return ownsVisibleHost(host);
		})().catch((error) => {
			console.error("TransitionEditorView: renderer recovery failed", error);
			return false;
		}).finally(() => {
			rendererRecovery = null;
		});
		return rendererRecovery;
	}

	function restorePlotVisibility() {
		for (const element of [
			curveIn, curveMid, curveOut,
			...referenceCurves,
			vline1, vline2, hline0, hline1,
			board?.defaultAxes?.x, board?.defaultAxes?.y,
		]) {
			if (element?.rendNode) board?.renderer?.display?.(element, true);
		}
	}

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

	function commitSplit(which, rawValue) {
		const st = store.getState();
		const current = getSplits(st);
		const value = clampNumber(Number(rawValue), 0, 1);
		const w1 = which === "w1" ? Math.min(value, current.w2) : current.w1;
		const w2 = which === "w2" ? Math.max(value, current.w1) : current.w2;
		store.actions?.setTeSplitsPresetId?.(getPresetIdFromState(st));
		store.actions?.setTeSplitsDirty?.(true);
		store.actions?.setTeW1?.(w1);
		store.actions?.setTeW2?.(w2);
		updateSeparatorAccessibility({ w1, w2 });
		board?.fullUpdate?.();
		restorePlotVisibility();
		return { w1, w2 };
	}

	function updateSeparatorAccessibility({ w1, w2 } = getSplits(store.getState())) {
		for (const [element, which, now, min, max] of [
			[vlineHit1, "w1", w1, 0, w2],
			[vlineHit2, "w2", w2, w1, 1],
		]) {
			const node = element?.rendNode;
			if (!node) continue;
			node.setAttribute("aria-label", which);
			node.setAttribute("aria-valuemin", String(min));
			node.setAttribute("aria-valuemax", String(max));
			node.setAttribute("aria-valuenow", String(now));
			node.style.left = `${((now + 0.05) / 1.1) * 100}%`;
		}
	}

	function createSeparatorControl() {
		const node = document.createElement("button");
		node.type = "button";
		node.style.position = "absolute";
		node.style.zIndex = "4";
		node.style.top = "0";
		node.style.bottom = "0";
		node.style.width = "18px";
		node.style.transform = "translateX(-50%)";
		node.style.border = "0";
		node.style.padding = "0";
		node.style.background = "transparent";
		node.style.opacity = "0";
		boardHost.append(node);
		return { rendNode: node };
	}

	function wireSeparatorControl(element, which) {
		const node = element?.rendNode;
		if (!node) return;
		node.dataset.transedSeparator = which;
		node.setAttribute("role", "slider");
		node.setAttribute("tabindex", "0");
		node.setAttribute("aria-label", which);
		node.style.cursor = "ew-resize";
		let pointerId = null;
		const valueFromPointer = (event) => {
			const rect = boardHost.getBoundingClientRect();
			const normalized = ((event.clientX - rect.left) / rect.width) * 1.1 - 0.05;
			return clampNumber(normalized, 0, 1);
		};
		const move = (event) => {
			if (event.pointerId !== pointerId) return;
			commitSplit(which, valueFromPointer(event));
			event.preventDefault();
		};
		const finish = (event) => {
			if (event.pointerId !== pointerId) return;
			pointerId = null;
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", finish);
			window.removeEventListener("pointercancel", finish);
		};
		node.addEventListener("pointerdown", (event) => {
			if (pointerId !== null) return;
			pointerId = event.pointerId;
			try { node.setPointerCapture(pointerId); } catch {}
			window.addEventListener("pointermove", move);
			window.addEventListener("pointerup", finish);
			window.addEventListener("pointercancel", finish);
			commitSplit(which, valueFromPointer(event));
			event.preventDefault();
		});
		node.addEventListener("lostpointercapture", (event) => finish(event));
		node.addEventListener("keydown", (event) => {
			if (!["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"].includes(event.key)) return;
			const current = getSplits(store.getState())[which];
			const step = event.shiftKey ? 0.01 : 0.001;
			const next = event.key === "Home" ? 0
				: event.key === "End" ? 1
					: current + (["ArrowLeft", "ArrowDown"].includes(event.key) ? -step : step);
			commitSplit(which, next);
			event.preventDefault();
		});
	}

	async function init() {
		const host = document.getElementById("transBoard");
		if (!host) throw new Error("TransitionEditorView: missing #transBoard");
		const size = await prepareVisibleHost(host);
		if (ownsVisibleHost(host)) return;
		releaseBoard();

		board = JXG.JSXGraph.initBoard("transBoard", {
			boundingbox: [-0.05, 1.05, 1.05, -0.05],
			axis: true,
			showNavigation: false,
			showCopyright: false,
			zoom: { wheel: false, needshift: false, pinch: false },
			pan: { enabled: false },
			resize: { enabled: false },
			keepaspectratio: false,
		});
		boardHost = host;
		observeRenderer(host);

		const resizeBoard = () => {
			if (!board || boardHost !== host || !host.isConnected) return;
			host.style.removeProperty("width");
			host.style.removeProperty("height");
			const w = host.clientWidth || size.width;
			const h = host.clientHeight || size.height;
			board.resizeContainer(w, h, true);
			board.fullUpdate();
			restorePlotVisibility();
			observeRenderer(host);
		};

		requestAnimationFrame(() => resizeBoard());
		window.addEventListener("resize", () => {
			requestAnimationFrame(() => {
				if (host.getClientRects().length) resizeBoard();
			});
		});

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

		referenceCurves = [
			["k", "#20d5cc", 0],
			["k1", "#ffb454", 2],
			["k2", "#a99cff", 3],
		].map(([mode, color, dash]) => board.create("curve", [
			(u) => u,
			(u) => normalizedReferenceValue(u, store.getState(), mode),
			0,
			1,
		], {
			strokeColor: color,
			strokeWidth: () => (store.getState()?.te_plot ?? "k") === mode ? 3 : 1.35,
			strokeOpacity: () => (store.getState()?.te_plot ?? "k") === mode ? 0.95 : 0.55,
			dash,
			highlight: false,
			fixed: true,
		}));

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

		vlineHit1 = createSeparatorControl();
		vlineHit2 = createSeparatorControl();
		wireSeparatorControl(vlineHit1, "w1");
		wireSeparatorControl(vlineHit2, "w2");
		updateSeparatorAccessibility();

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
			restorePlotVisibility();
		}

		let _pending = false;
		let _lastPresetId = "";
		let _lastPlot = "";
		let _lastDescRef = null;
		let _renderedPlotState = readPlotRenderState(store.getState());

		function readPlotRenderState(st) {
			const { w1, w2 } = getSplits(st);
			return {
				presetId: getPresetIdFromState(st),
				descriptor: getDescriptor(st),
				plot: String(st?.te_plot ?? "k"),
				w1,
				w2,
			};
		}

		function isSamePlotRenderState(left, right) {
			return Boolean(
				left
				&& right
				&& left.presetId === right.presetId
				&& left.descriptor === right.descriptor
				&& left.plot === right.plot
				&& left.w1 === right.w1
				&& left.w2 === right.w2
			);
		}

		function requestBoardUpdate() {
			if (!board || _pending) return;
			if (isSamePlotRenderState(readPlotRenderState(store.getState()), _renderedPlotState)) return;
			_pending = true;

			requestAnimationFrame(() => {
				_pending = false;

				const st = store.getState();
				const nextPlotState = readPlotRenderState(st);
				if (isSamePlotRenderState(nextPlotState, _renderedPlotState)) return;
				const pid = getPresetIdFromState(st);
				const plot = String(st?.te_plot ?? "k");

				if (pid && pid !== _lastPresetId) {
					_lastPresetId = pid;
					void ensurePresetLoaded(pid).then(() => {
						updateLegend(store.getState());
						updateSplitVisibility(store.getState());
						board?.fullUpdate();
						_renderedPlotState = readPlotRenderState(store.getState());
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
				updateSeparatorAccessibility();
				board.fullUpdate();
				restorePlotVisibility();
				_renderedPlotState = nextPlotState;
			});
		}

		store.subscribe(() => {
			requestBoardUpdate();
		});
	}

	return {
		init,
		samplePreset,
		renderEngineeringPreview,

		async resize() {
			const host = document.getElementById("transBoard");
			if (!host) return;
			await init();
			const { width, height } = await prepareVisibleHost(host);
			if (!ownsVisibleHost(host)) {
				await init();
			}
			const w = host.clientWidth || width;
			const h = host.clientHeight || height;
			board.resizeContainer(w, h, true);
			board.fullUpdate();
			restorePlotVisibility();
			observeRenderer(host);
			const rendered = rendererRect(host);
			if (!rendered || rendered.width <= 1 || rendered.height <= 1) {
				releaseBoard();
				await init();
			}
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

export function createTransitionAxtranEngineeringPreviewViewModel(projection) {
	const value = projection ?? {
		status: "unapplied",
		active: null,
		selected: null,
		descriptor: null,
		evaluation: null,
		continuity: { evaluation: null, candidate: null, validation: null },
		axtranContract: null,
		provenance: null,
		errors: [{ code: "TRANSITION_AXTRAN_PREVIEW_UNAVAILABLE", message: "Active Alignment context unavailable" }],
	};
	return Object.freeze({
		status: "unapplied",
		rows: Object.freeze([
			Object.freeze(["Active Alignment", value.active]),
			Object.freeze(["Descriptor / record", {
				recordId: value.selected?.recordId ?? null,
				descriptor: value.descriptor,
			}]),
			Object.freeze(["Representative κ evaluation", value.evaluation]),
			Object.freeze(["Continuity status / residuals", value.continuity?.evaluation]),
			Object.freeze(["Continuity candidate validation", {
				candidate: value.continuity?.candidate ?? null,
				validation: value.continuity?.validation ?? null,
			}]),
			Object.freeze(["Prepared AXTRAN contract", {
				contractVersion: value.axtranContract?.contractVersion ?? null,
				status: value.axtranContract?.status ?? null,
				contract: value.axtranContract,
			}]),
			Object.freeze(["Provenance", value.provenance]),
			Object.freeze(["Structured errors", value.errors ?? []]),
		]),
	});
}
