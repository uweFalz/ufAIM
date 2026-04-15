// app/runtime/state/storeShape.js
//
// WorkspaceState contract (window-side transitional state)
//
// Current role:
// - local window/session compatibility
// - UI/view state
// - temporary mirrors of canonical runtime state
//
// IMPORTANT:
// - canonical SPOT / ImportInbox / WorkingSet data do NOT belong here
// - routeProjects / artifacts / import_* are transitional mirror fields only
// - new logic must NOT be built on those fields
//
// Categories:
// - legacy focus mirror:
//     activeRouteProjectId, activeSlot
//
// - transitional mirrors / caches:
//     routeProjects, artifacts, spot_decisions, import_*
//
// - actual window/view state:
//     cursor, view_pins, view_chunks, te_*
//
// If you add state keys: update BOTH makeInitialState() + ensureStateShape().

function normalizePins(pins) {
	if (!Array.isArray(pins)) return [];

	return pins
		.filter(Boolean)
		.map((p) => {
			if (typeof p === "string") {
				const [rpId, slot] = p.split("::");
				return { rpId, slot: slot || "right" };
			}
			if (typeof p === "object") {
				return {
					rpId: String(p.rpId ?? p.baseId ?? ""),
					slot: String(p.slot ?? "right"),
					at: p.at ?? undefined,
				};
			}
			return null;
		})
		.filter((p) => p?.rpId);
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

function normalizePreviewCollection(items) {
	if (!Array.isArray(items)) return [];

	return items
		.filter(isObject)
		.map((item) => ({
			id: item.id ?? null,
			kind: item.kind ?? "alignment",
			name: item.name ?? item.id ?? "preview",
			sparseAlignment: isObject(item.sparseAlignment) ? item.sparseAlignment : null,
			spatialRef: isObject(item.spatialRef) ? item.spatialRef : (item.spatialRef ?? null),
			source: isObject(item.source) ? item.source : {},
		}))
		.filter((item) => item.id && item.sparseAlignment);
}

export function makeInitialState() {
	return {
		// --------------------------------------------------------
		// legacy focus mirror
		// @transition replace by windowSession.focus
		// --------------------------------------------------------
		activeRouteProjectId: null,
		activeSlot: "right",

		// --------------------------------------------------------
		// actual window/view state
		// --------------------------------------------------------
		cursor: { s: 0 },
		view_pins: [],
		view_chunks: [],

		preview_item: null,
		preview_source: null,
		import_preview_collection: [],
		import_preview_source: null,

		// --------------------------------------------------------
		// transitional mirrors / caches
		// @transition do not extend usage
		// --------------------------------------------------------
		routeProjects: {},  // rpId -> {id, slots, meta, ...}
		artifacts: {},      // artifactId -> artifact
		spot_decisions: {}, // key -> "accept" | "defer" | "ignore"

		import_activeArtifacts: null,
		import_polyline2d: null,
		import_marker2d: null,
		import_profile1d: null,
		import_cant1d: null,
		import_meta: null,
		import_tracks2d: [],

		// --------------------------------------------------------
		// Transition Editor (window/view state)
		// --------------------------------------------------------
		te_open: false,
		te_presetId: "",
		te_presetSpec: null,
		te_splitsPresetId: "",
		te_splitsDirty: false,
		te_w1: 0.25,
		te_w2: 0.75,
		te_plot: "k",
		te_u: 0.0,
	};
}

export function ensureStateShape(state) {
	const s = state ?? {};

	// --- TE presetSpec: keep if it matches current presetId ---
	const pid = String(s.te_presetId ?? "");
	const ps = (s.te_presetSpec && typeof s.te_presetSpec === "object") ? s.te_presetSpec : null;
	const safePresetSpec =
		(ps && String(ps.presetId ?? ps.presetID ?? "") === pid) ? ps : null;

	const w1 = Number.isFinite(s.te_w1) ? Math.max(0, Math.min(1, s.te_w1)) : 0.25;
	const w2 = Number.isFinite(s.te_w2) ? Math.max(0, Math.min(1, s.te_w2)) : 0.75;
	const plot = (s.te_plot === "k" || s.te_plot === "k1" || s.te_plot === "k2") ? s.te_plot : "k";
	const u = Number.isFinite(s.te_u) ? Math.max(0, Math.min(1, s.te_u)) : 0.0;

	return {
		// --------------------------------------------------------
		// legacy focus mirror
		// @transition replace by windowSession.focus
		// --------------------------------------------------------
		activeRouteProjectId: s.activeRouteProjectId ?? null,
		activeSlot: s.activeSlot ?? "right",

		// --------------------------------------------------------
		// transitional mirrors / caches
		// @transition do not extend usage
		// --------------------------------------------------------
		routeProjects: s.routeProjects ?? {},
		artifacts: s.artifacts ?? {},
		spot_decisions: s.spot_decisions ?? {},

		import_polyline2d: s.import_polyline2d ?? null,
		import_marker2d: s.import_marker2d ?? null,
		import_profile1d: s.import_profile1d ?? null,
		import_cant1d: s.import_cant1d ?? null,
		import_meta: s.import_meta ?? null,
		import_activeArtifacts: s.import_activeArtifacts ?? null,
		import_tracks2d: Array.isArray(s.import_tracks2d) ? s.import_tracks2d : [],

		// --------------------------------------------------------
		// actual window/view state
		// --------------------------------------------------------
		view_pins: normalizePins(s.view_pins),
		view_chunks: s.view_chunks ?? [],
		cursor: { ...(s.cursor ?? {}), s: Number.isFinite(s.cursor?.s) ? s.cursor.s : 0 },

		preview_item: isObject(s.preview_item) ? s.preview_item : null,
		preview_source: isObject(s.preview_source) ? s.preview_source : null,

		import_preview_collection: normalizePreviewCollection(s.import_preview_collection),
		import_preview_source: isObject(s.import_preview_source) ? s.import_preview_source : null,

		// --------------------------------------------------------
		// Transition Editor (window/view state)
		// --------------------------------------------------------
		te_open: Boolean(s.te_open),
		te_presetId: String(s.te_presetId ?? ""),
		te_presetSpec: safePresetSpec,
		te_splitsPresetId: String(s.te_splitsPresetId ?? ""),
		te_splitsDirty: Boolean(s.te_splitsDirty),
		te_w1: Math.min(w1, w2),
		te_w2: Math.max(w1, w2),
		te_plot: plot,
		te_u: u,
	};
}
