// app/runtime/state/windowStore.js
//
// workspaceState (windowStore)
//
// ⚠️ TRANSITIONAL BRIDGE STORE ⚠️
//
// This store is NOT the source of truth for project data.
// Canonical data belongs to runtime / worker-side services.
//
// Preferred current direction:
//
//   SPOT -> workspace_selection -> ViewController -> View
//
// Core terms:
// - workspace_selection.primaryId  = Fokus
// - workspace_selection.contextIds = Anzeige / zusätzlich sichtbare Objekte
// - workspace_visible_tracks       = fertig projizierte Hilfsspuren für Anzeige
//
// Deprecated transitional aliases still kept:
// - activeRouteProjectId / activeSlot
// - view_pins
// - import_preview_collection
// - routeProjects / artifacts / import_*
//
// Rule of thumb:
// workspaceState is a bridge, not the truth.

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

function normalizeId(id) {
	const v = String(id ?? "").trim();
	return v || null;
}

function normalizeIdList(ids) {
	if (!Array.isArray(ids)) return [];

	return [...new Set(
		ids
			.map((id) => String(id ?? "").trim())
			.filter(Boolean)
	)];
}

function normalizeSource(source) {
	return source && typeof source === "object" && !Array.isArray(source)
		? source
		: null;
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
				console.error("[workspaceState] listener crashed (isolated):", err);
			}
		}
	}

	function subscribe(fn) {
		listeners.add(fn);
		return () => listeners.delete(fn);
	}

	const actions = {
		// ------------------------------------------------------------
		// preview item
		// Local one-off preview, usually before SPOT admission.
		// ------------------------------------------------------------
		setPreviewItem({ item = null, source = null } = {}) {
			setState({
				preview_item: item && typeof item === "object" ? item : null,
				preview_source: normalizeSource(source),
			});
		},

		clearPreviewItem() {
			setState({
				preview_item: null,
				preview_source: null,
			});
		},

		// ------------------------------------------------------------
		// workspace selection
		// Preferred window-side selection model.
		// ------------------------------------------------------------
		setWorkspaceSelection(selection = {}) {
			const primaryId = normalizeId(selection?.primaryId);
			const contextIds = normalizeIdList(selection?.contextIds);

			setState({
				workspace_selection: {
					primaryId,
					contextIds,
					source: selection?.source != null ? String(selection.source) : null,
					crsId: selection?.crsId != null ? String(selection.crsId) : null,
				},

				// @deprecated focus mirror
				activeRouteProjectId: primaryId,
			});
		},

		setWorkspacePrimary({ objectId, source = "local", crsId = null } = {}) {
			const id = normalizeId(objectId);

			setState((st) => {
				const current = st.workspace_selection ?? {};

				return {
					...st,
					workspace_selection: {
						primaryId: id,
						contextIds: Array.isArray(current.contextIds) ? current.contextIds : [],
						source: source != null ? String(source) : null,
						crsId: crsId != null ? String(crsId) : current.crsId ?? null,
					},

					// @deprecated focus mirror
					activeRouteProjectId: id,
				};
			});
		},

		clearWorkspacePrimary() {
			setState((st) => {
				const current = st.workspace_selection ?? {};

				return {
					...st,
					workspace_selection: {
						primaryId: null,
						contextIds: Array.isArray(current.contextIds) ? current.contextIds : [],
						source: current.source ?? null,
						crsId: current.crsId ?? null,
					},

					// @deprecated focus mirror
					activeRouteProjectId: null,
				};
			});
		},

		setWorkspaceContextObjects({ objectIds = [], source = "local", crsId = null } = {}) {
			const contextIds = normalizeIdList(objectIds);

			setState((st) => {
				const current = st.workspace_selection ?? {};

				return {
					...st,
					workspace_selection: {
						primaryId: current.primaryId ?? null,
						contextIds,
						source: source != null ? String(source) : null,
						crsId: crsId != null ? String(crsId) : current.crsId ?? null,
					},

					// @deprecated pin mirror
					view_pins: contextIds.map((id) => ({
						rpId: id,
						slot: normalizeSlot(st.activeSlot),
						at: Date.now(),
					})),
				};
			});
		},

		toggleWorkspaceContextObject({ objectId, source = "local", crsId = null } = {}) {
			const id = normalizeId(objectId);
			if (!id) return;

			setState((st) => {
				const current = st.workspace_selection ?? {};
				const oldIds = Array.isArray(current.contextIds) ? current.contextIds : [];
				const has = oldIds.includes(id);
				const contextIds = has
					? oldIds.filter((x) => x !== id)
					: [...oldIds, id];

				return {
					...st,
					workspace_selection: {
						primaryId: current.primaryId ?? null,
						contextIds,
						source: source != null ? String(source) : null,
						crsId: crsId != null ? String(crsId) : current.crsId ?? null,
					},

					// @deprecated pin mirror
					view_pins: contextIds.map((rpId) => ({
						rpId,
						slot: normalizeSlot(st.activeSlot),
						at: Date.now(),
					})),
				};
			});
		},

		clearWorkspaceContextObjects() {
			setState((st) => {
				const current = st.workspace_selection ?? {};

				return {
					...st,
					workspace_selection: {
						primaryId: current.primaryId ?? null,
						contextIds: [],
						source: current.source ?? null,
						crsId: current.crsId ?? null,
					},

					// @deprecated pin mirror
					view_pins: [],
				};
			});
		},

		clearWorkspaceSelection() {
			setState({
				workspace_selection: {
					primaryId: null,
					contextIds: [],
					source: null,
					crsId: null,
				},

				// @deprecated mirrors
				activeRouteProjectId: null,
				view_pins: [],
			});
		},

		// ------------------------------------------------------------
		// workspace visible tracks
		// Preferred replacement for import_preview_collection.
		// ------------------------------------------------------------
		setWorkspaceVisibleTracks(input = {}) {
			const items = Array.isArray(input)
				? input
				: Array.isArray(input?.items)
				? input.items
				: [];

			const source = Array.isArray(input)
				? { type: "workspace-visible-tracks" }
				: input?.source ?? null;

			setState({
				workspace_visible_tracks: items,
				workspace_visible_tracks_source: normalizeSource(source),

				// @deprecated alias
				import_preview_collection: items,
				import_preview_source: normalizeSource(source),
			});
		},

		clearWorkspaceVisibleTracks() {
			setState({
				workspace_visible_tracks: [],
				workspace_visible_tracks_source: null,

				// @deprecated alias
				import_preview_collection: [],
				import_preview_source: null,
			});
		},

		// @deprecated
		setImportPreviewCollection(input = {}) {
			return actions.setWorkspaceVisibleTracks(input);
		},

		// @deprecated
		clearImportPreviewCollection() {
			return actions.clearWorkspaceVisibleTracks();
		},

		// ------------------------------------------------------------
		// @deprecated legacy focus mirror
		// Use setWorkspacePrimary / clearWorkspacePrimary.
		// ------------------------------------------------------------
		setActiveRouteProject(id) {
			const objectId = normalizeId(id);

			setState((st) => {
				const current = st.workspace_selection ?? {};

				return {
					...st,
					activeRouteProjectId: objectId,
					workspace_selection: {
						primaryId: objectId,
						contextIds: Array.isArray(current.contextIds) ? current.contextIds : [],
						source: current.source ?? "legacy-activeRouteProjectId",
						crsId: current.crsId ?? null,
					},
				};
			});
		},

		// @deprecated slot mirror.
		setActiveSlot(slot) {
			const safe = normalizeSlot(slot);
			setState({ activeSlot: safe });
		},

		// ------------------------------------------------------------
		// @deprecated temporary local decision cache
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

		clearSpotDecisions() {
			setState((s) => ({ ...s, spot_decisions: {} }));
		},

		// ------------------------------------------------------------
		// @deprecated view pins
		// Use workspace_selection.contextIds.
		// ------------------------------------------------------------
		setPins(pins) {
			const arr = Array.isArray(pins) ? pins : [];
			const next = arr
				.filter(Boolean)
				.map((p) => ({
					rpId: String(p.rpId ?? p.baseId ?? "").trim(),
					slot: normalizeSlot(p.slot),
					at: Number.isFinite(Number(p.at)) ? Number(p.at) : Date.now(),
				}))
				.filter((p) => p.rpId);

			setState((st) => {
				const current = st.workspace_selection ?? {};
				const contextIds = normalizeIdList(next.map((p) => p.rpId));

				return {
					...st,
					view_pins: next,
					workspace_selection: {
						primaryId: current.primaryId ?? null,
						contextIds,
						source: current.source ?? "legacy-pins",
						crsId: current.crsId ?? null,
					},
				};
			});
		},

		clearPins() {
			return actions.clearWorkspaceContextObjects();
		},

		pinRouteProject({ rpId, slot = "right" } = {}) {
			const id = normalizeId(rpId);
			if (!id) return;

			setState((st) => {
				const s = normalizeSlot(slot);
				const pins = Array.isArray(st.view_pins) ? st.view_pins.slice() : [];
				const key = `${id}::${s}`;

				if (!pins.some((p) => `${p?.rpId ?? ""}::${p?.slot ?? ""}` === key)) {
					pins.push({ rpId: id, slot: s, at: Date.now() });
				}

				const current = st.workspace_selection ?? {};
				const contextIds = normalizeIdList([
					...(Array.isArray(current.contextIds) ? current.contextIds : []),
					id,
				]);

				return {
					...st,
					view_pins: pins,
					workspace_selection: {
						primaryId: current.primaryId ?? null,
						contextIds,
						source: current.source ?? "legacy-pin",
						crsId: current.crsId ?? null,
					},
				};
			});
		},

		unpinRouteProject({ rpId, slot = "right" } = {}) {
			const id = normalizeId(rpId);
			if (!id) return;

			setState((st) => {
				const s = normalizeSlot(slot);
				const pins = Array.isArray(st.view_pins) ? st.view_pins : [];
				const nextPins = pins.filter((p) => !(p?.rpId === id && normalizeSlot(p?.slot) === s));

				const current = st.workspace_selection ?? {};
				const contextIds = normalizeIdList(
					(Array.isArray(current.contextIds) ? current.contextIds : [])
						.filter((x) => x !== id)
				);

				return {
					...st,
					view_pins: nextPins,
					workspace_selection: {
						primaryId: current.primaryId ?? null,
						contextIds,
						source: current.source ?? "legacy-unpin",
						crsId: current.crsId ?? null,
					},
				};
			});
		},

		togglePinRouteProject({ rpId, slot = "right" } = {}) {
			const id = normalizeId(rpId);
			if (!id) return;

			const s = normalizeSlot(slot);
			const st = getState();
			const pins = Array.isArray(st.view_pins) ? st.view_pins : [];
			const key = `${id}::${s}`;
			const has = pins.some((p) => `${p?.rpId ?? ""}::${p?.slot ?? ""}` === key);

			if (has) actions.unpinRouteProject({ rpId: id, slot: s });
			else actions.pinRouteProject({ rpId: id, slot: s });
		},

		togglePinFromActive() {
			const st = getState();
			const rpId =
				st.workspace_selection?.primaryId ??
				st.activeRouteProjectId ??
				null;

			if (!rpId) return;

			const slot = st.activeSlot ?? "right";
			actions.togglePinRouteProject({ rpId, slot });
		},

		// ------------------------------------------------------------
		// @deprecated legacy shadow-project cleanup
		// Remove once runtime/worker owns project deletion flow.
		// ------------------------------------------------------------
		deleteRouteProject(rpId) {
			const id = normalizeId(rpId);
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

				const current = st.workspace_selection ?? {};
				const contextIds = normalizeIdList(
					(Array.isArray(current.contextIds) ? current.contextIds : [])
						.filter((x) => x !== id)
				);

				let active = st.activeRouteProjectId;
				let primaryId = current.primaryId ?? active ?? null;

				if (active === id || primaryId === id) {
					const ids = Object.keys(rps).sort((a, b) => a.localeCompare(b));
					active = ids[0] ?? null;
					primaryId = active;
				}

				return {
					...st,
					routeProjects: rps,
					artifacts: arts,
					view_pins: pins,
					activeRouteProjectId: active,
					workspace_selection: {
						primaryId,
						contextIds,
						source: current.source ?? "legacy-deleteRouteProject",
						crsId: current.crsId ?? null,
					},
				};
			});
		},

		// ------------------------------------------------------------
		// @deprecated temporary import mirror cleanup helper
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
			actions.setWorkspacePrimary({
				objectId: id,
				source: "focus-alias",
			});
		},

		setFocusSlot(slot) {
			actions.setActiveSlot(slot);
		},
	};

	return { getState, setState, subscribe, actions };
}
