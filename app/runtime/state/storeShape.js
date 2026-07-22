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
// - new view logic should use workspace_selection + workspace_visible_tracks
//
// Core direction:
//
//   SPOT -> workspace_selection -> ViewController -> View
//
// Import is only one producer of SPOT objects / selections.
//
// Naming:
// - workspace_selection.primaryId  = focused object
// - workspace_selection.contextIds = objects additionally shown
// - workspace_visible_tracks       = already projected helper/context tracks
//
// Deprecated mirrors kept for transition:
// - activeSlot
// - import_*
//
// Migration note:
// - legacy import_preview_collection is accepted only as input fallback and
//   normalized into workspace_visible_tracks.
//
// If you add state keys: update BOTH makeInitialState() + ensureStateShape().

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
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
		elementId: x.elementId != null && String(x.elementId).trim()
			? String(x.elementId).trim()
			: null,
		source: x.source != null ? String(x.source) : null,
		crsId: x.crsId != null ? String(x.crsId) : null,
	};
}

function normalizeVisibleTracks(items) {
	if (!Array.isArray(items)) return [];

	return items
		.filter(isObject)
		.map((item) => {
			const polyline2d = Array.isArray(item.polyline2d)
				? item.polyline2d
				: Array.isArray(item.points)
				? item.points
				: Array.isArray(item.payload?.polyline2d)
				? item.payload.polyline2d
				: [];

			return {
				...item,
				id: String(item.id ?? item.objectId ?? "track").trim(),
				objectId:
					item.objectId != null
						? String(item.objectId).trim()
						: item.id != null
						? String(item.id).trim()
						: null,
				polyline2d,
				source: item.source ?? "workspace",
			};
		})
		.filter((item) => item.id && Array.isArray(item.polyline2d) && item.polyline2d.length >= 2);
}

function derivePreviewCrsId(item) {
	const sr = isObject(item?.spatialRef) ? item.spatialRef : null;

	const crsId =
		item?.crsId ??
		sr?.crsId ??
		sr?.horizontalCrsId ??
		sr?.horizontal ??
		sr?.horizontalCoordinateSystemName ??
		null;

	if (crsId == null) return null;

	const normalized = String(crsId).trim();
	return normalized || null;
}

function normalizePreviewItem(item) {
	if (!isObject(item)) return null;

	const kernel = isObject(item.kernel)
		? item.kernel
		: isObject(item.sparseAlignment)
		? item.sparseAlignment
		: null;

	if (!kernel) return null;

	const id = String(
		item.id ??
		item.payload?.id ??
		item.payload?.name ??
		"preview_alignment"
	).trim();

	if (!id) return null;

	const name = String(item.name ?? item.payload?.name ?? id).trim() || id;

	return {
		id,
		kind: String(item.kind ?? "alignment"),
		name,
		kernel,
		crsId: derivePreviewCrsId(item),
		source: isObject(item.source) ? item.source : null,
	};
}

function normalizeTrackList(items) {
	if (!Array.isArray(items)) return [];

	return items
		.filter(isObject)
		.map((item) => {
			const polyline2d = Array.isArray(item.polyline2d)
				? item.polyline2d
				: Array.isArray(item.points)
				? item.points
				: Array.isArray(item.payload?.polyline2d)
				? item.payload.polyline2d
				: [];

			return {
				...item,
				id: item.id != null ? String(item.id) : null,
				objectId:
					item.objectId != null
						? String(item.objectId)
						: item.id != null
						? String(item.id)
						: null,
				polyline2d,
			};
		})
		.filter((item) => item.id && item.polyline2d.length >= 2);
}

export function makeInitialState() {
	return {
		// --------------------------------------------------------
		// primary window/view selection
		// --------------------------------------------------------
		workspace_selection: {
			primaryId: null,
			contextIds: [],
			elementId: null,
			source: null,
			crsId: null,
		},

		// Already projected helper/context tracks for this workspace.
		workspace_visible_tracks: [],
		workspace_visible_tracks_source: null,

		// --------------------------------------------------------
		// legacy slot mirror
		// --------------------------------------------------------
		activeSlot: "right",

		// --------------------------------------------------------
		// actual window/view state
		// --------------------------------------------------------
		cursor: { s: 0 },
		view_chunks: [],

		// Single local preview, mostly useful before SPOT admission.
		preview_item: null,
		preview_source: null,

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
		// Alignment Element Editor has an independent lifecycle.
		ae_open: false,
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

	const w1 = Number.isFinite(Number(s.te_w1))
		? Math.max(0, Math.min(1, Number(s.te_w1)))
		: 0.25;

	const w2 = Number.isFinite(Number(s.te_w2))
		? Math.max(0, Math.min(1, Number(s.te_w2)))
		: 0.75;

	const plot =
		(s.te_plot === "k" || s.te_plot === "k1" || s.te_plot === "k2")
			? s.te_plot
			: "k";

	const u = Number.isFinite(Number(s.te_u))
		? Math.max(0, Math.min(1, Number(s.te_u)))
		: 0.0;

	const workspaceVisibleTracks = normalizeVisibleTracks(
		Array.isArray(s.workspace_visible_tracks)
			? s.workspace_visible_tracks
			: s.import_preview_collection
	);

	return {
		// --------------------------------------------------------
		// primary window/view selection
		// --------------------------------------------------------
		workspace_selection: normalizeWorkspaceSelection(s.workspace_selection),

		workspace_visible_tracks: workspaceVisibleTracks,
		workspace_visible_tracks_source: isObject(s.workspace_visible_tracks_source)
			? s.workspace_visible_tracks_source
			: isObject(s.import_preview_source)
			? s.import_preview_source
			: null,

		// --------------------------------------------------------
		// legacy slot mirror
		// --------------------------------------------------------
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
		view_chunks: Array.isArray(s.view_chunks) ? s.view_chunks : [],

		cursor: {
			...(isObject(s.cursor) ? s.cursor : {}),
			s: Number.isFinite(Number(s.cursor?.s)) ? Number(s.cursor.s) : 0,
		},

		preview_item: normalizePreviewItem(s.preview_item),
		preview_source: isObject(s.preview_source) ? s.preview_source : null,

		// --------------------------------------------------------
		// Transition Editor (window/view state)
		// --------------------------------------------------------
		te_open: Boolean(s.te_open),
		ae_open: Boolean(s.ae_open),
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
