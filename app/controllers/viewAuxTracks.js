// app/controllers/viewAuxTracks.js
//
// Aux-/Chunk-track helper factory for ViewController.
// Keeps viewer-only chunk state local to this module.
//
// No store.subscribe here.
// No DOM rendering here.
// threeA access only through the injected setAuxTracks callback.

import { nowMs } from "@app/utils/appHelpers.js";

import {
	isPolylineValid,
	clipPolylineByChainage,
	computeBboxUnionFromTracks,
	computeAuxAlphaByAge,
} from "@app/controllers/viewGeometry.js";
import {
	getWorkspaceContextIds,
	getWorkspacePrimaryId,
} from "@src/shared/runtime/workspaceSelectionAccess.js";

// ------------------------------------------------------------
// local pure helpers
// ------------------------------------------------------------

function makeStyleForAuxTrack(cfg, previewId) {
	return function styleForAuxTrack(id, meta = {}) {
		if (!cfg.auxStyleByAge) return null;

		const now = Date.now();
		const ageSec = Math.max(0, (now - (meta.at ?? now)) / 1000);

		let alpha = computeAuxAlphaByAge(ageSec, {
			minA: cfg.auxMinAlpha,
			maxA: cfg.auxMaxAlpha,
			fadeSec: cfg.auxFadeSec,
		});

		let width = (ageSec > cfg.auxFadeSec * 0.6) ? cfg.auxWidthOld : cfg.auxWidth;
		let dashed = false;

		if (id === previewId) {
			alpha = 0.95;
			width = Math.max(width, 2.5);
			dashed = true;
		}

		if (meta.frozen) {
			alpha = Math.max(alpha, 0.7);
			width = Math.max(width, 2.0);
		}

		return {
			alpha,
			width,
			dashed,
		};
	};
}

function pushAlignmentTrack(out, state, id, activeId) {
	if (!id || id === activeId) return;

	const track = findTrackById(state, id);
	if (!track) return;

	out.push(track);
}

function findTrackById(state, id) {

	const want = String(id ?? "");
	if (!want) return null;
	const fromVisibleTracks = findTrackInTrackList(state.workspace_visible_tracks, want);
	if (fromVisibleTracks) return fromVisibleTracks;
	const fromArtifact = findTrackInArtifacts(state, want);
	if (fromArtifact) return fromArtifact;
	const fromPreviewItem = findTrackInPreviewItem(state.preview_item, want);
	if (fromPreviewItem) return fromPreviewItem;
	return null;

}

function findTrackInArtifacts(state, id) {

	const art = state.artifacts?.[id];
	if (!art || art.domain !== "alignment2d") return null;
	const polyline2d = art.payload?.polyline2d;
	if (!Array.isArray(polyline2d) || polyline2d.length < 2) return null;
	return {
		id,
		objectId: id,
		polyline2d,
		bbox: art?.payload?.bbox ?? null,
		source: "artifact",
		crsId: art?.payload?.crsId ?? null,
	};

}

function findTrackInTrackList(list, id) {

	const arr = Array.isArray(list) ? list : [];
	for (const t of arr) {
		const tid = String(t?.id ?? t?.objectId ?? t?.rpId ?? "");
		if (tid !== id) continue;
		const polyline2d = t?.polyline2d;
		if (!Array.isArray(polyline2d) || polyline2d.length < 2) continue;
		return {
			id,
			objectId: t?.objectId ?? id,
			polyline2d,
			bbox: t?.bbox ?? null,
			source: t?.source ?? "track",
			crsId: t?.crsId ?? null,
		};
	}
	return null;

}

function findTrackInPreviewItem(item, id) {

	if (!item) return null;
	const itemId = String(item?.id ?? item?.objectId ?? "");
	if (itemId !== id) return null;
	const polyline2d = item?.polyline2d;
	if (!Array.isArray(polyline2d) || polyline2d.length < 2) return null;
	return {
		id,
		objectId: item?.objectId ?? id,
		polyline2d,
		bbox: item?.bbox ?? null,
		source: item?.source ?? "preview",
		crsId: item?.crsId ?? null,
	};

}

function collectAuxAll(state, activeId) {
	const out = Array.isArray(state.workspace_visible_tracks)
		? state.workspace_visible_tracks
			.filter((t) => String(t?.id ?? t?.objectId ?? "") !== String(activeId ?? ""))
			.filter((t) => Array.isArray(t?.polyline2d) && t.polyline2d.length >= 2)
			.map((t) => ({
				id: String(t?.id ?? t?.objectId ?? ""),
				objectId: t?.objectId != null ? String(t.objectId) : String(t?.id ?? ""),
				polyline2d: t.polyline2d,
				bbox: t?.bbox ?? null,
				source: t?.source ?? "workspace",
				crsId: t?.crsId ?? null,
			}))
		: [];

	for (const [id, art] of Object.entries(state.artifacts ?? {})) {
		if (!art || id === activeId) continue;
		if (art.domain !== "alignment2d") continue;

		const pts = art.payload?.polyline2d;
		if (!Array.isArray(pts) || pts.length < 2) continue;

		out.push({
			id,
			objectId: id,
			polyline2d: pts,
			bbox: art?.payload?.bbox ?? null,
			source: "artifact",
			crsId: art?.payload?.crsId ?? null,
		});
	}

	return out;
}

function collectAuxPinned(state, activeId) {
	const out = [];
	const ids = new Set(getWorkspaceContextIds(state));

	for (const id of ids) {
		pushAlignmentTrack(out, state, id, activeId);
	}

	return out;
}

function collectAuxRouteProject(state, activeId) {
	const out = [];
	const rpId = getWorkspacePrimaryId(state);
	const rp = rpId ? state.routeProjects?.[rpId] : null;
	if (!rp?.slots) return out;

	const ids = new Set();

	for (const slot of Object.values(rp.slots)) {
		const aId = slot?.alignmentArtifactId;
		if (aId) ids.add(aId);

		const other = slot?.otherArtifactIds;
		if (Array.isArray(other)) {
			for (const x of other) ids.add(x);
		}
	}

	for (const id of ids) pushAlignmentTrack(out, state, id, activeId);
	return out;
}

// ------------------------------------------------------------
// factory
// ------------------------------------------------------------

export function createViewAuxTracks({
	store,
	cfg,
	ensureChainageCache,
	setAuxTracks,
	getActivePolyline,
	buildChunkMetrics,
} = {}) {
	if (!store?.getState) throw new Error("createViewAuxTracks: missing store");
	if (typeof ensureChainageCache !== "function") {
		throw new Error("createViewAuxTracks: missing ensureChainageCache");
	}
	if (typeof setAuxTracks !== "function") {
		throw new Error("createViewAuxTracks: missing setAuxTracks");
	}
	if (getActivePolyline != null && typeof getActivePolyline !== "function") {
		throw new Error("createViewAuxTracks: invalid getActivePolyline");
	}
	if (typeof buildChunkMetrics !== "function") {
		throw new Error("createViewAuxTracks: missing buildChunkMetrics");
	}

	const PREVIEW_ID = "chunk_preview";
	const MAX_CHUNKS = 12;

	let pendingChunkStartS = null;
	const chunkTracks = []; // newest first

	const styleForAuxTrack = makeStyleForAuxTrack(cfg, PREVIEW_ID);

	// ------------------------------------------------------------
	// aux track collection
	// ------------------------------------------------------------

	function collectAuxTracks(state) {
		if (!cfg.showAuxTracks) return [];

		const activeId = getWorkspacePrimaryId(state) ?? null;

		switch (String(cfg.auxTracksScope ?? "routeproject").toLowerCase()) {
			case "all":
			return collectAuxAll(state, activeId);

			case "pinned":
			return collectAuxPinned(state, activeId);

			case "routeproject":
			default:
			return collectAuxRouteProject(state, activeId);
		}
	}

	// ------------------------------------------------------------
	// chunk preview / chunk list
	// ------------------------------------------------------------

	function buildChunkPreviewTrack(state) {
		if (pendingChunkStartS == null) return null;

		const poly = getActivePolyline?.(state) ?? state.import_polyline2d;
		if (!isPolylineValid(poly)) return null;

		const cum = ensureChainageCache(poly);
		if (!cum) return null;

		const s0 = pendingChunkStartS;
		const s1 = Number(state.cursor?.s ?? 0);

		const pts = clipPolylineByChainage(poly, cum, s0, s1);
		if (!pts || pts.length < 2) return null;

		return { id: PREVIEW_ID, objectId: PREVIEW_ID, polyline2d: pts, source: "chunk-preview" };
	}

	function buildAuxTracksOnly(state) {
		const aux = collectAuxTracks(state).slice(0, cfg.auxTracksMax);
		const now = nowMs();

		return aux.map((t) => ({
			...t,
			style: styleForAuxTrack(t.id, { at: now }),
		}));
	}

	function buildChunkTracksOnly(state) {
		const chunks = chunkTracks
		.filter((c) => c && !c.hidden)
		.map((c) => ({
			id: c.id,
			objectId: c.objectId ?? c.id,
			polyline2d: c.polyline2d,
			bbox: c.bbox ?? null,
			source: c.source ?? "chunk",
			style: styleForAuxTrack(c.id, c),
		}));

		const preview = buildChunkPreviewTrack(state);
		if (preview) {
			return [
			...chunks,
			{
				...preview,
				style: styleForAuxTrack(PREVIEW_ID, { at: nowMs() }),
			},
			];
		}

		return chunks;
	}

	function buildImportTracksOverlay(state) {
	const visibleTracks = Array.isArray(state.workspace_visible_tracks)
		? state.workspace_visible_tracks
		: [];

	const activeId = getWorkspacePrimaryId(state) ?? null;

	return visibleTracks
		.filter((t) => String(t?.id ?? t?.objectId ?? "") !== String(activeId ?? ""))
		.map((t) => ({
			id: `${t.source ?? "track"}_${t.id ?? t.objectId}`,
			objectId: t?.objectId ?? t?.id ?? null,
			polyline2d: t.polyline2d,
			bbox: t?.bbox ?? null,
			crsId: t?.crsId ?? null,
			source: t?.source ?? "track",
			style: {
				alpha: t.source === "spot" ? 0.65 : 0.45,
				width: t.source === "spot" ? 2.0 : 1.6,
				dashed: false,
			},
		}))
		.filter((t) => Array.isArray(t.polyline2d) && t.polyline2d.length >= 2);
}

	function buildChunkAuxTracks(state) {
		return [
		...buildImportTracksOverlay(state),
		...buildAuxTracksOnly(state),
		...buildChunkTracksOnly(state),
		];
	}

	function redrawAuxFromState(state = store.getState()) {
		setAuxTracks(buildChunkAuxTracks(state));
	}

	// ------------------------------------------------------------
	// chunk mutation helpers
	// ------------------------------------------------------------

	function makeChunkId() {
		return `chunk_${Date.now()}_${Math.random().toString(16).slice(2)}`;
	}

	function pruneChunksIfNeeded() {
		if (chunkTracks.length <= MAX_CHUNKS) return;

		const frozen = chunkTracks.filter((c) => c?.frozen);
		const live = chunkTracks.filter((c) => !c?.frozen);

		while ((frozen.length + live.length) > MAX_CHUNKS) {
			live.pop();
		}

		chunkTracks.length = 0;
		chunkTracks.push(...frozen, ...live);
		chunkTracks.sort((a, b) => (b?.at ?? 0) - (a?.at ?? 0));
	}

	function findChunkIndexById(id) {
		if (!id) return -1;
		return chunkTracks.findIndex((c) => c?.id === id);
	}

	function toggleChunkFrozen(id) {
		const idx = findChunkIndexById(id);
		if (idx < 0) return false;

		chunkTracks[idx].frozen = !chunkTracks[idx].frozen;
		return true;
	}

	function toggleChunkHidden(id) {
		const idx = findChunkIndexById(id);
		if (idx < 0) return false;

		chunkTracks[idx].hidden = !chunkTracks[idx].hidden;
		return true;
	}

	function clearChunks() {
		chunkTracks.length = 0;
		pendingChunkStartS = null;
	}

	function removeChunk(id) {
		const idx = findChunkIndexById(id);
		if (idx < 0) return false;

		chunkTracks.splice(idx, 1);
		return true;
	}

	function createChunkFromRange(s0, s1, state = store.getState()) {
		const poly = getActivePolyline?.(state) ?? state.import_polyline2d;
		const cum = ensureChainageCache(poly);

		if (!isPolylineValid(poly) || !cum) return null;

		const polyline2d = clipPolylineByChainage(poly, cum, s0, s1);
		if (!polyline2d || polyline2d.length < 2) return null;

		const sMin = Math.min(s0, s1);
		const sMax = Math.max(s0, s1);
		const metrics = buildChunkMetrics(polyline2d, sMin, sMax);

		const chunk = {
			id: makeChunkId(),
			objectId: null,
			polyline2d,
			bbox: null,
			s0: sMin,
			s1: sMax,
			at: Date.now(),
			frozen: false,
			hidden: false,
			metrics,
			source: "chunk",
			label: "",
		};

		chunkTracks.unshift(chunk);
		pruneChunksIfNeeded();

		return chunk;
	}

	function beginPendingChunk(s) {
		if (!Number.isFinite(Number(s))) return false;
		pendingChunkStartS = Number(s);
		return true;
	}

	function cancelPendingChunk() {
		pendingChunkStartS = null;
	}

	function finalizePendingChunk(endS, state = store.getState()) {
		if (pendingChunkStartS == null) return null;

		const startS = pendingChunkStartS;
		pendingChunkStartS = null;

		return createChunkFromRange(startS, endS, state);
	}

	// ------------------------------------------------------------
	// bbox helpers
	// ------------------------------------------------------------

	function computeAuxBboxUnion(state) {
		return computeBboxUnionFromTracks(collectAuxTracks(state));
	}

	function computeChunkBboxUnion(state) {
		return computeBboxUnionFromTracks(buildChunkTracksOnly(state));
	}

	// ------------------------------------------------------------
	// readonly snapshot helpers
	// ------------------------------------------------------------

	function getPendingChunkStartS() {
		return pendingChunkStartS;
	}

	function getChunkTracks() {
		return chunkTracks;
	}

	function getChunkSnapshot() {
		return {
			pendingChunkStartS,
			chunkTracks: chunkTracks.slice(),
			PREVIEW_ID,
			MAX_CHUNKS,
		};
	}

	return {
		// constants/state views
		PREVIEW_ID,
		MAX_CHUNKS,
		getPendingChunkStartS,
		getChunkTracks,
		getChunkSnapshot,

		// aux/chunk build
		collectAuxTracks,
		buildChunkPreviewTrack,
		buildAuxTracksOnly,
		buildChunkTracksOnly,
		buildImportTracksOverlay,
		buildChunkAuxTracks,
		redrawAuxFromState,

		// chunk mutations
		beginPendingChunk,
		cancelPendingChunk,
		finalizePendingChunk,
		createChunkFromRange,
		clearChunks,
		removeChunk,
		findChunkIndexById,
		toggleChunkFrozen,
		toggleChunkHidden,
		pruneChunksIfNeeded,

		// bbox
		computeAuxBboxUnion,
		computeChunkBboxUnion,
	};
}
