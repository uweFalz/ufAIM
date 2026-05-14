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
// - new view logic should use workspace_selection, not import_* / routeProjects
//
// Core direction:
//
//   SPOT -> workspace_selection -> ViewController -> View
//
// Import is only one producer of SPOT objects / selections.
//
// If you add state keys: update BOTH makeInitialState() + ensureStateShape().

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

function normalizePins(pins) {
	if (!Array.isArray(pins)) return [];

	return pins
		.filter(Boolean)
		.map((p) => {
			if (typeof p === "string") {
				const [rpId, slot] = p.split("::");
				return { rpId, slot: slot || "right" };
			}

			if (isObject(p)) {
				return {
					rpId: String(p.rpId ?? p.baseId ?? ""),
					slot: normalizeSlot(p.slot),
					at: Number.isFinite(Number(p.at)) ? Number(p.at) : undefined,
				};
			}

			return null;
		})
		.filter((p) => p?.rpId);
}

function normalizeSlot(slot) {
	const v = String(slot ?? "right");
	return (v === "left" || v === "km" || v === "right") ? v : "right";
}

function normalizeWorkspaceSelection(sel) {
	const x = isObject(sel) ? sel : {};

	const primaryId =
		x.primaryId != null && String(x.primaryId).trim()
			? String(x.primaryId).trim()
			: null;

	const contextIds = Array.isArray(x.contextIds)
		? [...new Set(
			x.contextIds
				.map((id) => String(id ?? "").trim())
				.filter(Boolean)
		)]
		: [];

	return {
		primaryId,
		contextIds,
		source: x.source != null ? String(x.source) : null,
		crsId: x.crsId != null ? String(x.crsId) : null,
	};
}

function normalizePreviewCollection(items) {
	if (!Array.isArray(items)) return [];

	return items
		.filter(isObject)
		.map((item) => {
			// New transitional path:
			// already projected workspace/SPOT track.
			if (Array.isArray(item.points) && item.points.length >= 2) {
				return {
					id: String(item.id ?? item.objectId ?? "track"),
					objectId: item.objectId != null ? String(item.objectId) : String(item.id ?? ""),
					points: item.points,
					source: item.source ?? "spot",
				};
			}

			// Deprecated legacy path:
			// preview item with sparse kernel.
			return {
				id: item.id ?? null,
				kind: item.kind ?? "alignment",
				name: item.name ?? item.id ?? "preview",
				sparseAlignment: isObject(item.sparseAlignment) ? item.sparseAlignment : null,
				spatialRef: isObject(item.spatialRef) ? item.spatialRef : (item.spatialRef ?? null),
				source: isObject(item.source) ? item.source : {},
			};
		})
		.filter((item) => {
			if (Array.isArray(item.points) && item.points.length >= 2) return true;
			return item.id && item.sparseAlignment;
		});
}

function normalizeTrackList(items) {
	if (!Array.isArray(items)) return [];

	return items
		.filter(isObject)
		.map((item) => ({
			...item,
			id: item.id != null ? String(item.id) : null,
			points: Array.isArray(item.points) ? item.points : [],
		}))
		.filter((item) => item.id && item.points.length >= 2);
}

export function makeInitialState() {
	return {
		// --------------------------------------------------------
		// primary window/view selection
		// --------------------------------------------------------
		workspace_selection: {
			primaryId: null,
			contextIds: [],
			source: null,
			crsId: null,
		},

		// --------------------------------------------------------
		// legacy focus mirror
		// @deprecated replace by workspace_selection.primaryId
		// --------------------------------------------------------
		activeRouteProjectId: null,
		activeSlot: "right",

		// --------------------------------------------------------
		// actual window/view state
		// --------------------------------------------------------
		cursor: { s: 0 },
		view_chunks: [],

		// @deprecated replace by workspace_selection.contextIds
		view_pins: [],

		// Single local preview, mostly useful before SPOT admission.
		preview_item: null,
		preview_source: null,

		// @deprecated transitional rendered-context track cache.
		// Use workspace_selection + projection service long-term.
		import_preview_collection: [],
		import_preview_source: null,

		// --------------------------------------------------------
		// transitional mirrors / caches
		// @deprecated do not extend usage
		// --------------------------------------------------------
		routeProjects: {},
		artifacts: {},
		spot_decisions: {},

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

	const pid = String(s.te_presetId ?? "");
	const ps = isObject(s.te_presetSpec) ? s.te_presetSpec : null;
	const safePresetSpec =
		(ps && String(ps.presetId ?? ps.presetID ?? "") === pid) ? ps : null;

	const w1 = Number.isFinite(Number(s.te_w1)) ? Math.max(0, Math.min(1, Number(s.te_w1))) : 0.25;
	const w2 = Number.isFinite(Number(s.te_w2)) ? Math.max(0, Math.min(1, Number(s.te_w2))) : 0.75;
	const plot = (s.te_plot === "k" || s.te_plot === "k1" || s.te_plot === "k2") ? s.te_plot : "k";
	const u = Number.isFinite(Number(s.te_u)) ? Math.max(0, Math.min(1, Number(s.te_u))) : 0.0;

	return {
		// --------------------------------------------------------
		// primary window/view selection
		// --------------------------------------------------------
		workspace_selection: normalizeWorkspaceSelection(s.workspace_selection),

		// --------------------------------------------------------
		// legacy focus mirror
		// @deprecated replace by workspace_selection.primaryId
		// --------------------------------------------------------
		activeRouteProjectId: s.activeRouteProjectId ?? null,
		activeSlot: normalizeSlot(s.activeSlot),

		// --------------------------------------------------------
		// transitional mirrors / caches
		// @deprecated do not extend usage
		// --------------------------------------------------------
		routeProjects: isObject(s.routeProjects) ? s.routeProjects : {},
		artifacts: isObject(s.artifacts) ? s.artifacts : {},
		spot_decisions: isObject(s.spot_decisions) ? s.spot_decisions : {},

		import_polyline2d: Array.isArray(s.import_polyline2d) ? s.import_polyline2d : null,
		import_marker2d: isObject(s.import_marker2d) ? s.import_marker2d : null,
		import_profile1d: s.import_profile1d ?? null,
		import_cant1d: s.import_cant1d ?? null,
		import_meta: isObject(s.import_meta) ? s.import_meta : null,
		import_activeArtifacts: isObject(s.import_activeArtifacts) ? s.import_activeArtifacts : null,
		import_tracks2d: normalizeTrackList(s.import_tracks2d),

		// --------------------------------------------------------
		// actual window/view state
		// --------------------------------------------------------
		view_pins: normalizePins(s.view_pins),
		view_chunks: Array.isArray(s.view_chunks) ? s.view_chunks : [],
		cursor: {
			...(isObject(s.cursor) ? s.cursor : {}),
			s: Number.isFinite(Number(s.cursor?.s)) ? Number(s.cursor.s) : 0,
		},

		preview_item: isObject(s.preview_item) ? s.preview_item : null,
		preview_source: isObject(s.preview_source) ? s.preview_source : null,

		// @deprecated transitional rendered-context track cache.
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
