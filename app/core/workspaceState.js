// app/core/workspaceState.js

import { clamp01range, clamp01 } from "../utils/helpers.js";
import { makeInitialState, ensureStateShape } from "./storeShape.js";
import { mirrorQuickHooksFromActive, applyIngestResult } from "../io/importApply.js";

function spotKey(spotId, slot) {
	return `${spotId}::${slot ?? "right"}`;
}

function makeChunkId() {
	return `chunk_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeSlot(slot) {
	const v = String(slot ?? "right");
	return (v === "left" || v === "km" || v === "right") ? v : "right";
}

//
// ...
//
export function createWorkspaceState(initial) {
	let state = ensureStateShape(initial ?? makeInitialState());
	const listeners = new Set();

	function getState() { return state; }

	function setState(patch) {
		const nextPatch = typeof patch === "function" ? patch(state) : patch;
		state = ensureStateShape({ ...state, ...(nextPatch ?? {}) });
		for (const fn of listeners) {
			try {
				fn(state);
			} catch (err) {
				// Never let UI/render listeners break core state transitions (import/apply, etc.)
				console.error("[workspaceState] listener crashed (isolated):", err);
			}
		}
	}

	function subscribe(fn) {
		listeners.add(fn);
		return () => listeners.delete(fn);
	}

	const actions = {
		applyIngest(ingest, opts = {}) {
			if (!ingest) return [{ type: "log", level: "error", message: "applyIngest: missing ingest" }];

			return applyIngestResult({
				store: { getState, setState },
				ui: opts.ui,
				ingest,
				emitProps: Boolean(opts.emitProps),
			});
		},

		setActiveRouteProject(id) {
			setState({ activeRouteProjectId: id ?? null });
			mirrorQuickHooksFromActive({ getState, setState });
		},

		setActiveSlot(slot) {
			const v = String(slot ?? "right");
			const safe = (v === "left" || v === "km" || v === "right") ? v : "right";
			setState({ activeSlot: safe });
			mirrorQuickHooksFromActive({ getState, setState });
		},
		
		setSpotDecision({ spotId, slot, decision }) {
			const key = spotKey(spotId, slot);
			const d = decision == null ? null : String(decision).toLowerCase();

			if (d !== null && !["accept", "defer", "ignore"].includes(d)) return;

			setState((s) => {
				const next = { ...(s.spot_decisions ?? {}) };
				if (d === null) delete next[key];
				else next[key] = d;
				return { ...s, spot_decisions: next };
			});
		},

		clearSpotDecisions() {
			setState((s) => ({ ...s, spot_decisions: {} }));
		},

		// ------------------------------------------------------------
		// MS14.2: pins lifecycle helpers
		// ------------------------------------------------------------
		setPins(pins) {
			const arr = Array.isArray(pins) ? pins : [];
			// normalize lightly
			const next = arr
			.filter(Boolean)
			.map((p) => ({
				rpId: String(p.rpId ?? p.baseId ?? ""),
				slot: (p.slot === "left" || p.slot === "km" || p.slot === "right") ? p.slot : "right",
				at: Number.isFinite(p.at) ? p.at : Date.now(),
			}))
			.filter((p) => p.rpId);

			setState({ view_pins: next });
		},

		clearPins() {
			setState({ view_pins: [] });
		},

		// MS14.1: view pins live in state
		pinRouteProject({ rpId, slot = "right" } = {}) {
			const id = String(rpId ?? "");
			if (!id) return;
			const s = (slot === "left" || slot === "km" || slot === "right") ? slot : "right";
			setState((st) => {
				const pins = Array.isArray(st.view_pins) ? st.view_pins.slice() : [];
				const key = `${id}::${s}`;
				if (pins.some((p) => `${p?.rpId ?? ""}::${p?.slot ?? ""}` === key)) return st;
				pins.push({ rpId: id, slot: s, at: Date.now() });
				return { ...st, view_pins: pins };
			});
		},

		unpinRouteProject({ rpId, slot = "right" } = {}) {
			const id = String(rpId ?? "");
			if (!id) return;
			const s = (slot === "left" || slot === "km" || slot === "right") ? slot : "right";
			setState((st) => {
				const pins = Array.isArray(st.view_pins) ? st.view_pins : [];
				const next = pins.filter((p) => !(p?.rpId === id && (p?.slot ?? "right") === s));
				return { ...st, view_pins: next };
			});
		},

		togglePinFromActive() {
			const st = getState();
			const rpId = st.activeRouteProjectId;
			if (!rpId) return;
			const slot = st.activeSlot ?? "right";
			actions.togglePinRouteProject({ rpId, slot });
		},

		// MS14.1: allow simple delete for cleanup during tests
		deleteRouteProject(rpId) {
			const id = String(rpId ?? "");
			if (!id) return;
			setState((st) => {
				const rps = { ...(st.routeProjects ?? {}) };
				if (!rps[id]) return st;
				delete rps[id];

				// remove artifacts of this RP
				const arts0 = st.artifacts ?? {};
				const arts = {};
				for (const [aid, a] of Object.entries(arts0)) {
					if (a?.baseId === id) continue;
					arts[aid] = a;
				}

				// drop pins pointing to deleted RP
				const pins0 = Array.isArray(st.view_pins) ? st.view_pins : [];
				const pins = pins0.filter((p) => p?.rpId !== id);

				// choose next active
				let active = st.activeRouteProjectId;
				if (active === id) {
					const ids = Object.keys(rps).sort((a, b) => a.localeCompare(b));
					active = ids[0] ?? null;
				}

				return {
					...st,
					routeProjects: rps,
					artifacts: arts,
					view_pins: pins,
					activeRouteProjectId: active,
				};
			});
			mirrorQuickHooksFromActive({ getState, setState });
		},

		togglePinRouteProject({ rpId, slot = "right" } = {}) {
			const id = String(rpId ?? "");
			if (!id) return;
			const s = (slot === "left" || slot === "km" || slot === "right") ? slot : "right";
			const key = `${id}::${s}`;
			const st = getState();
			const pins = Array.isArray(st.view_pins) ? st.view_pins : [];
			const has = pins.some((p) => `${p?.rpId ?? ""}::${p?.slot ?? ""}` === key);
			if (has) actions.unpinRouteProject({ rpId: id, slot: s });
			else actions.pinRouteProject({ rpId: id, slot: s });
		},

		// ------------------------------------------------------------
		// MS14.2: “AppCore darf kein store.setState({import_meta:null})”
		// ------------------------------------------------------------
		clearImportMeta() {
			setState({ import_meta: null });
		},

		// ------------------------------------------------------------
		// cursor
		// ------------------------------------------------------------
		setCursor(patch) {
			const st = getState();
			setState({ cursor: { ...st.cursor, ...(patch ?? {}) } });
		},

		setCursorS(value) {
			const st = getState();
			const n = Number(value);
			if (!Number.isFinite(n)) return;
			const s = Math.max(0, n);
			setState({ cursor: { ...st.cursor, s } });
		},

		nudgeCursorS(delta) {
			const st = getState();
			const d = Number(delta);
			if (!Number.isFinite(d)) return;
			const s0 = Number(st.cursor?.s ?? 0);
			const s1 = Math.max(0, (Number.isFinite(s0) ? s0 : 0) + d);
			setState({ cursor: { ...st.cursor, s: s1 } });
		},

		setPick(pick) {
			const st = getState();
			setState({ cursor: { ...st.cursor, pick } });
		},
		
		// ------------------------------------------------------------
		// MS15.1: chunks (viewer-defined chainage ranges)
		// ------------------------------------------------------------
		addChunk({ alignmentArtifactId, rpId, slot, s0, s1, label } = {}) {
			const aId = alignmentArtifactId ? String(alignmentArtifactId) : null;
			const range = clamp01range(s0, s1);
			if (!aId || !range) return;

			const ch = {
				id: makeChunkId(),
				alignmentArtifactId: aId,
				// optional context (helpful for UI, not the “identity”):
				rpId: rpId != null ? String(rpId) : null,
				slot: normalizeSlot(slot),
				s0: range.s0,
				s1: range.s1,
				label: label != null ? String(label) : null,
				at: Date.now(),
				source: "viewer",
			};

			setState((st) => {
				const arr = Array.isArray(st.view_chunks) ? st.view_chunks.slice() : [];
				arr.push(ch);
				return { ...st, view_chunks: arr };
			});
		},

		removeChunk(chunkId) {
			const id = String(chunkId ?? "");
			if (!id) return;
			setState((st) => {
				const arr = Array.isArray(st.view_chunks) ? st.view_chunks : [];
				return { ...st, view_chunks: arr.filter((c) => c?.id !== id) };
			});
		},

		clearChunks() {
			setState({ view_chunks: [] });
		},
		
		// ------------------------------------------------------------
		// TransitionEditor (te_*)
		// ------------------------------------------------------------
		
		setTeOpen(on) {
			setState({ te_open: !!on });
		},
		
		setTePresetId(id) {
			setState({ te_presetId: String(id || "") });
		},
		
		setTeW1(x) {
			const w1 = clamp01(+x);
			setState((st) => {
				const w2 = clamp01(st.te_w2);
				return { te_w1: w1, te_w2: Math.max(w1, w2) }; // keep invariant w1<=w2
			});
		},
		
		setTeW2(x) {
			const w2 = clamp01(+x);
			setState((st) => {
				const w1 = clamp01(st.te_w1);
				return { te_w2: w2, te_w1: Math.min(w1, w2) }; // keep invariant w1<=w2
			});
		},
		
		setTePlot(v) {
			const p = String(v || "k");
			if (!["k", "k1", "k2"].includes(p)) return;
			setState({ te_plot: p });
		},

		setTeU(u) {
			setState({ te_u: clamp01(+u) });
		},
	};

	return { getState, setState, subscribe, actions };
}
