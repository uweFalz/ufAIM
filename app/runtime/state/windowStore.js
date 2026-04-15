// app/runtime/state/windowStore.js
//
// workspaceState (windowStore)
//
// ⚠️ TRANSITIONAL BRIDGE STORE ⚠️
//
// This store currently mixes:
//
// 1) legacy focus mirror
//    - activeRouteProjectId
//    - activeSlot
//
// 2) actual window/view state
//    - cursor
//    - view_pins
//    - view_chunks
//    - te_*
//
// 3) transitional mirror / cache state (must shrink over time)
//    - artifacts
//    - routeProjects
//    - import_meta
//    - import_* quick hooks
//    - spot_decisions
//
// ------------------------------------------------------------
// IMPORTANT ARCHITECTURAL RULES
// ------------------------------------------------------------
//
// - This store is NOT the source of truth for project data.
// - Canonical data belongs to runtime / worker-side services.
// - routeProjects / artifacts / import_* are mirror fields only.
// - New logic must NOT be built on transitional mirror fields.
// - This store must become progressively "dumber".
//
// ------------------------------------------------------------
// TARGET ARCHITECTURE
// ------------------------------------------------------------
//
// windowSessionState:
//   -> focus (objectId, slot)
//
// workspaceState (this store):
//   -> UI + view-only state
//
// controller layer:
//   -> orchestration / side effects
//
// canonical runtime:
//   -> SPOT / ImportInbox / WorkingSet / project data
//
// ------------------------------------------------------------
// MIGRATION STATUS
// ------------------------------------------------------------
//
// - activeRouteProjectId / activeSlot are legacy names
//   -> should be replaced by "focus"
//
// - routeProjects / artifacts / import_* are transitional mirrors
//   -> do NOT extend their usage here
//
// - spot_decisions are currently local UI/workflow cache
//   -> decide later whether they remain local or move to runtime
//
// - deleteRouteProject() is legacy shadow-project cleanup
//   -> remove once worker/runtime owns deletion flow
//
// ------------------------------------------------------------
// RULE OF THUMB
// ------------------------------------------------------------
//
// 👉 workspaceState is a bridge, not the truth.
//

import { clamp01range } from "@utils/helpers.js";

import { makeInitialState, ensureStateShape } from "./storeShape.js";

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

export function createWindowStore(initial) {
	let state = ensureStateShape(initial ?? makeInitialState());
	const listeners = new Set();

	function getState() {
		return state;
	}

	function setState(patch) {
		const nextPatch = typeof patch === "function" ? patch(state) : patch;
		state = ensureStateShape({ ...state, ...(nextPatch ?? {}) });

		for (const fn of listeners) {
			try {
				fn(state);
			} catch (err) {
				// Never let UI/render listeners break core state transitions.
				console.error("[workspaceState] listener crashed (isolated):", err);
			}
		}
	}

	function subscribe(fn) {
		listeners.add(fn);
		return () => listeners.delete(fn);
	}

	const actions = {
		setPreviewItem({ item = null, source = null } = {}) {
			setState({
				preview_item: item && typeof item === "object" ? item : null,
				preview_source: source && typeof source === "object" ? source : null,
			});
		},

		clearPreviewItem() {
			setState({
				preview_item: null,
				preview_source: null,
			});
		},

		setImportPreviewCollection({ items = [], source = null } = {}) {
			setState({
				import_preview_collection: Array.isArray(items) ? items : [],
				import_preview_source: source && typeof source === "object" ? source : null,
			});
		},

		clearImportPreviewCollection() {
			setState({
				import_preview_collection: [],
				import_preview_source: null,
			});
		},

		// ------------------------------------------------------------
		// @transition legacy focus mirror
		// Canonical focus should be accessed via WindowSession / FocusManager.
		// ------------------------------------------------------------
		setActiveRouteProject(id) {
			setState({ activeRouteProjectId: id ?? null });
		},

		// ------------------------------------------------------------
		// @transition legacy focus mirror
		// Canonical focus should be accessed via WindowSession / FocusManager.
		// ------------------------------------------------------------
		setActiveSlot(slot) {
			const v = String(slot ?? "right");
			const safe = (v === "left" || v === "km" || v === "right") ? v : "right";
			setState({ activeSlot: safe });
		},

		// ------------------------------------------------------------
		// @transition temporary local decision cache
		// Do not expand this into canonical SPOT logic here.
		// ------------------------------------------------------------
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

		// ------------------------------------------------------------
		// @transition temporary local decision cache
		// ------------------------------------------------------------
		clearSpotDecisions() {
			setState((s) => ({ ...s, spot_decisions: {} }));
		},

		// ------------------------------------------------------------
		// view pins
		// ------------------------------------------------------------
		setPins(pins) {
			const arr = Array.isArray(pins) ? pins : [];
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

		// ------------------------------------------------------------
		// @transition legacy shadow-project cleanup
		// Remove once runtime/worker owns project deletion flow.
		// ------------------------------------------------------------
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
		// @transition temporary import mirror cleanup helper
		// No new logic should depend on import_meta here.
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
		// chunks (viewer-defined chainage ranges)
		// ------------------------------------------------------------
		addChunk({ alignmentArtifactId, rpId, slot, s0, s1, label } = {}) {
			const aId = alignmentArtifactId ? String(alignmentArtifactId) : null;
			const range = clamp01range(s0, s1);
			if (!aId || !range) return;

			const ch = {
				id: makeChunkId(),
				alignmentArtifactId: aId,
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
				const got = String(spec?.presetId ?? "");
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
		// Alias terms
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
