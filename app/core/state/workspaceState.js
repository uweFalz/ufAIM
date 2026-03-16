// app/core/state/workspaceState.js
//
// workspaceState is currently a temporary combined window-side store.
//
// During the current wiring / test phase it contains three kinds of local state:
//
// 1) window session core
//    - activeRouteProjectId
//    - activeSlot
//
// 2) workspace / UI state
//    - cursor
//    - view_pins
//    - view_chunks
//    - te_*
//
// 3) transitional workflow state
//    - import_meta
//    - artifacts
//    - spot_decisions
//
// Important:
// - workspaceState does NOT own canonical project data.
// - canonical project data belongs to the Master Runtime / SPOT store.
// - this store only holds local window-side state.
//
// Architectural status:
// - focus-related logic is gradually moving to WindowSessionController
// - workspaceState should become dumber over time
// - side effects and orchestration should leave the store
//
// Target direction:
// - windowSessionState  -> focus / working context
// - workspaceState      -> workspace / UI state
// - controller layer    -> orchestration / side effects
//
// For now, workspaceState remains a pragmatic combined store
// until the wiring cleanup is complete.

import { makeInitialState, ensureStateShape } from "./storeShape.js";
import { clamp01range } from "@app/utils/helpers.js";

// ...
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
		setActiveRouteProject(id) {
			setState({ activeRouteProjectId: id ?? null });
		},

		setActiveSlot(slot) {
			const v = String(slot ?? "right");
			const safe = (v === "left" || v === "km" || v === "right") ? v : "right";
			setState({ activeSlot: safe });
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

				const arts0 = st.artifacts ?? {};
				const arts = {};
				for (const [aid, a] of Object.entries(arts0)) {
					if (a?.baseId === id) continue;
					arts[aid] = a;
				}

				const pins0 = Array.isArray(st.view_pins) ? st.view_pins : [];
				const pins = pins0.filter((p) => p?.rpId !== id);

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
		
		// ---- TransitionEditor UI state (no notify; use setState) ----
		setTeOpen(isOpen) {
			setState({ te_open: Boolean(isOpen) });
		},

		setTePresetId(id) {
			setState({ te_presetId: String(id ?? "") });
		},

		setTeW1(w1) {
			const v = Number(w1);
			setState({ te_w1: Number.isFinite(v) ? v : 0 });
		},

		setTeW2(w2) {
			const v = Number(w2);
			setState({ te_w2: Number.isFinite(v) ? v : 0 });
		},

		setTePlot(mode) {
			setState({ te_plot: String(mode ?? "k") });
		},
		
		setTePresetSpec(spec) {
			setState((s) => {
				const want = String(s.te_presetId ?? "");
				const got  = String(spec?.presetId ?? "");
				return (want && got && want === got)
				? ({ ...s, te_presetSpec: spec })
				: s;
			});
		},
		
		setTeSplitsPresetId(id) {
			setState({ te_splitsPresetId: String(id ?? "") });
		},
		
		setTeSplitsDirty(flag) {
			setState({ te_splitsDirty: Boolean(flag) });
		},
		
		// ------------------------------------------------------------
		// Alias-Begriffe
		// ------------------------------------------------------------
		
		setFocusObjectId(id) {
			actions.setActiveRouteProject(id);
		},

		setFocusSlot(slot) {
			actions.setActiveSlot(slot);
		},
	};

	return { getState, setState, subscribe, actions };
}
