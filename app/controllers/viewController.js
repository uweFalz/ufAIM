// app/controllers/viewController.js
//
// ViewController
//
// Window-local projection/render orchestration.
//
// Responsibilities:
// - reads window-local focus/context
// - resolves canonical SPOT objects
// - requests viewable geometry via projection layer
// - renders this window
//
// NOT:
// - no import logic
// - no canonical object ownership
// - no geometry truth in the view
//
// Important:
// - focus is window-local
// - canonical objects come from SPOT
// - viewable geometry is derived on demand
// - SPOT panel UI is event-driven via Spot.UiStateChanged
//
// Rule:
// canonical change -> local reprojection -> local rerender

import { t } from "@app/i18n/strings.js";
import { formatNum } from "@utils/helpers.js";

import { getSpotObjectById } from "@projection/queries/getSpotObjectById.js";
import { projectFocusedSpotObject } from "@projection/ViewProjectionController.js";

import {
	samplePointAndTangent,
	isPolylineValid,
	computeChainage,
	makeSectionLine,
	unionBbox,
	pickBboxFromArtifactOrPolyline,
	buildChunkMetrics,
} from "@app/controllers/viewGeometry.js";

import { createViewAuxTracks } from "@app/controllers/viewAuxTracks.js";
import { createViewPropsPanel } from "@app/controllers/viewPropsPanel.js";

import {
	syncCursorInput,
	syncOverlays,
	syncSectionBoard,
	syncPinsBadge,
	syncTransitionEditorControls,
} from "@app/controllers/viewUiSync.js";

// ------------------------------------------------------------
// ViewController
// ------------------------------------------------------------

export function makeViewController({
	store,
	ui,
	threeA,
	propsElement,
	prefs,
	messaging,
} = {}) {
	if (!store?.getState || !store?.subscribe) {
		throw new Error("ViewController: missing store");
	}
	if (!ui) {
		throw new Error("ViewController: missing ui");
	}
	if (!threeA) {
		throw new Error("ViewController: missing three adapter");
	}
	if (!messaging?.sendCmdAwait) {
		throw new Error("ViewController: missing messaging.sendCmdAwait");
	}

	const cfg = {
		fitPadding: Number.isFinite(prefs?.view?.fitPadding) ? prefs.view.fitPadding : 1.35,
		fitDurationMs: Number.isFinite(prefs?.view?.fitDurationMs) ? prefs.view.fitDurationMs : 240,
		fitIncludesPins:
			(prefs?.view?.fitIncludesPins !== undefined) ? Boolean(prefs.view.fitIncludesPins) : true,

		showAuxTracks:
			(prefs?.view?.showAuxTracks !== undefined) ? Boolean(prefs.view.showAuxTracks) : true,
		auxTracksScope: String(prefs?.view?.auxTracksScope ?? "routeProject").toLowerCase(),
		auxTracksMax: Number.isFinite(prefs?.view?.auxTracksMax) ? prefs.view.auxTracksMax : 12,

		auxStyleByAge:
			(prefs?.view?.auxStyleByAge !== undefined) ? Boolean(prefs.view.auxStyleByAge) : true,
		auxMaxAlpha: Number.isFinite(prefs?.view?.auxMaxAlpha) ? prefs.view.auxMaxAlpha : 0.85,
		auxMinAlpha: Number.isFinite(prefs?.view?.auxMinAlpha) ? prefs.view.auxMinAlpha : 0.15,
		auxFadeSec: Number.isFinite(prefs?.view?.auxFadeSec) ? prefs.view.auxFadeSec : 45,
		auxWidth: Number.isFinite(prefs?.view?.auxWidth) ? prefs.view.auxWidth : 2.0,
		auxWidthOld: Number.isFinite(prefs?.view?.auxWidthOld) ? prefs.view.auxWidthOld : 1.0,

		sampleStep: Number.isFinite(prefs?.view?.sampleStep) ? prefs.view.sampleStep : 5,
		spotStateCacheMs: Number.isFinite(prefs?.view?.spotStateCacheMs) ? prefs.view.spotStateCacheMs : 150,
	};

	let onGeomChange = String(prefs?.view?.onGeomChange ?? "recenter").toLowerCase();

	let autoFitOnGeomChange =
		(prefs?.view?.autoFitOnGeomChange !== undefined)
			? Boolean(prefs.view.autoFitOnGeomChange)
			: false;

	let cachedCum = null;
	let lastGeomKey = null;
	let lastPolyRef = null;

	let cachedSpotState = null;
	let cachedSpotStateAt = 0;
	let pendingSpotStatePromise = null;

	let cachedFocusObjectId = null;
	let cachedActiveGeometry = null;

	function getFocusObjectId(state) {
		return state?.focus?.objectId ?? state?.activeRouteProjectId ?? null;
	}

	function invalidateSpotCache() {
		cachedSpotState = null;
		cachedSpotStateAt = 0;
		pendingSpotStatePromise = null;
	}

	function invalidateGeometryCache() {
		cachedFocusObjectId = null;
		cachedActiveGeometry = null;
	}

	function invalidateAllCaches() {
		cachedCum = null;
		lastPolyRef = null;
		invalidateSpotCache();
		invalidateGeometryCache();
	}

	async function getSpotStateCached() {
		const now = Date.now();

		if (cachedSpotState && (now - cachedSpotStateAt) <= cfg.spotStateCacheMs) {
			return cachedSpotState;
		}

		if (pendingSpotStatePromise) {
			return await pendingSpotStatePromise;
		}

		pendingSpotStatePromise = messaging.sendCmdAwait("Spot.GetState", {})
			.then((spotState) => {
				cachedSpotState = spotState ?? null;
				cachedSpotStateAt = Date.now();
				return cachedSpotState;
			})
			.catch((err) => {
				invalidateSpotCache();
				throw err;
			})
			.finally(() => {
				pendingSpotStatePromise = null;
			});

		return await pendingSpotStatePromise;
	}

	function wireSpotUiUpdatesOnce() {
		if (wireSpotUiUpdatesOnce._done) return;
		wireSpotUiUpdatesOnce._done = true;

		messaging.onEvt?.("Spot.UiStateChanged", (spotUiState) => {
			invalidateSpotCache();
			invalidateGeometryCache();

			if (!spotUiState) return;
			ui?.setSpotState?.(spotUiState);
			ui?.refreshSpot?.(store.getState());
		});
	}

	async function getActiveGeometry(state) {
		const focusObjectId = getFocusObjectId(state);

		if (!focusObjectId) {
			invalidateGeometryCache();
			return null;
		}

		if (cachedFocusObjectId === focusObjectId && cachedActiveGeometry) {
			return cachedActiveGeometry;
		}

		const spotState = await getSpotStateCached();
		const spotObject = getSpotObjectById(spotState, focusObjectId);

		if (!spotObject) {
			invalidateGeometryCache();
			console.warn("[ViewController] SPOT object not found for focusObjectId:", focusObjectId);
			return null;
		}

		const geom = projectFocusedSpotObject(spotObject, {
			maxStep: cfg.sampleStep,
		});

		if (!geom?.polyline2d || geom.polyline2d.length < 2) {
			invalidateGeometryCache();
			console.warn("[ViewController] projected geometry invalid for focusObjectId:", focusObjectId);
			return null;
		}

		cachedFocusObjectId = focusObjectId;
		cachedActiveGeometry = {
			objectId: String(focusObjectId),
			spotObject,
			polyline2d: geom.polyline2d,
			bbox: geom.bbox ?? null,
			bboxCenter: geom.bboxCenter ?? null,
		};

		return cachedActiveGeometry;
	}

	function makeGeomKey(activeGeometry) {
		if (!activeGeometry) return "(none)";
		return String(activeGeometry.objectId ?? "(none)");
	}

	function ensureChainageCache(poly) {
		if (!poly) return null;

		if (!cachedCum || lastPolyRef !== poly) {
			cachedCum = computeChainage(poly);
			lastPolyRef = poly;
		}

		return cachedCum;
	}

	function setAuxTracks(tracks) {
		if (typeof threeA.setAuxTracksFromWorldPolylinesStyled === "function") {
			threeA.setAuxTracksFromWorldPolylinesStyled(tracks);
			return;
		}

		threeA.setAuxTracksFromWorldPolylines?.(
			tracks.map((t) => ({ id: t.id, points: t.points }))
		);
	}

	const aux = createViewAuxTracks({
		store,
		cfg,
		ensureChainageCache,
		setAuxTracks,
		buildChunkMetrics,
	});

	function redrawAuxFromState(state = store.getState()) {
		aux.redrawAuxFromState(state);
	}

	function computeAuxBboxUnion(state) {
		return aux.computeAuxBboxUnion(state);
	}

	function computeChunkBboxUnion(state) {
		return aux.computeChunkBboxUnion(state);
	}

	function computeFitBboxFromState(state, activeGeometry, opts = {}) {
		const includePins =
			(opts.includePins !== undefined) ? Boolean(opts.includePins) : cfg.fitIncludesPins;
		const includeChunks =
			(opts.includeChunks !== undefined) ? Boolean(opts.includeChunks) : true;

		let bbox = activeGeometry?.bbox ?? null;

		if (includePins) bbox = unionBbox(bbox, computeAuxBboxUnion(state));
		if (includeChunks) bbox = unionBbox(bbox, computeChunkBboxUnion(state));

		return bbox;
	}

	async function recenterToActive() {
		const st = store.getState();
		const activeGeometry = await getActiveGeometry(st);
		const poly = activeGeometry?.polyline2d;

		if (!Array.isArray(poly) || poly.length < 2) return false;

		const bbox = activeGeometry?.bbox ?? pickBboxFromArtifactOrPolyline(null, poly);
		if (!bbox) return false;

		threeA.setOriginFromBbox(bbox);
		return true;
	}

	async function fitActive(opts = {}) {
		const st = store.getState();
		const activeGeometry = await getActiveGeometry(st);
		const poly = activeGeometry?.polyline2d;

		if (!Array.isArray(poly) || poly.length < 2) return false;

		const bbox = computeFitBboxFromState(st, activeGeometry, opts);
		if (!bbox) return false;

		const padding = Number.isFinite(opts.padding) ? opts.padding : cfg.fitPadding;

		threeA.setOriginFromBbox(bbox);
		threeA.zoomToFitWorldBbox?.(bbox, { padding });
		return true;
	}

	async function softFitActive(opts = {}) {
		const st = store.getState();
		const activeGeometry = await getActiveGeometry(st);
		const poly = activeGeometry?.polyline2d;

		if (!Array.isArray(poly) || poly.length < 2) return false;

		const bbox = computeFitBboxFromState(st, activeGeometry, opts);
		if (!bbox) return false;

		const padding = Number.isFinite(opts.padding) ? opts.padding : cfg.fitPadding;

		threeA.setOriginFromBbox(bbox);

		if (typeof threeA.zoomToFitWorldBboxSoft === "function") {
			threeA.zoomToFitWorldBboxSoft(bbox, { padding });
		} else {
			threeA.zoomToFitWorldBbox?.(bbox, { padding });
		}

		return true;
	}

	async function softFitActiveAnimated(opts = {}) {
		const st = store.getState();
		const activeGeometry = await getActiveGeometry(st);
		const poly = activeGeometry?.polyline2d;

		if (!Array.isArray(poly) || poly.length < 2) return false;

		const bbox = computeFitBboxFromState(st, activeGeometry, opts);
		if (!bbox) return false;

		const padding = Number.isFinite(opts.padding) ? opts.padding : cfg.fitPadding;
		const durationMs = Number.isFinite(opts.durationMs) ? opts.durationMs : cfg.fitDurationMs;

		threeA.setOriginFromBbox(bbox);
		threeA.zoomToFitWorldBboxSoftAnimated?.(bbox, { padding, durationMs });
		return true;
	}

	function setOnGeomChange(mode) {
		const m = String(mode || "").toLowerCase();
		if (["off", "recenter", "fit", "softfit", "softfitanimated"].includes(m)) {
			onGeomChange = m;
		}
	}

	function setAutoFitEnabled(on) {
		autoFitOnGeomChange = Boolean(on);
	}

	async function applyGeomChangePolicy() {
		switch (onGeomChange) {
			case "fit":
				return await fitActive();
			case "softfit":
				return await softFitActive();
			case "softfitanimated":
				return await softFitActiveAnimated();
			case "recenter":
				return await recenterToActive();
			default:
				return false;
		}
	}

	function setCursorS(s, opts = {}) {
		const ss = Number(s);
		if (!Number.isFinite(ss)) return false;

		if (store.actions?.setCursorS) {
			store.actions.setCursorS(ss);
		} else if (store.actions?.setCursor) {
			store.actions.setCursor({ s: ss });
		} else {
			return false;
		}

		if (opts.fit === true) {
			void softFitActive({ includePins: true, includeChunks: true });
		}

		return true;
	}

	const propsPanel = propsElement
		? createViewPropsPanel({
			store,
			ui,
			propsElement,
			aux,
			setCursorS,
			redrawAuxFromState,
		})
		: null;

	async function handleTrackClick({ s, event }) {
		const ss = Number(s);
		if (!Number.isFinite(ss)) return;

		setCursorS(ss);

		if (event?.shiftKey) {
			const st = store.getState?.() ?? {};
			const activeGeometry = await getActiveGeometry(st);
			const poly = activeGeometry?.polyline2d;
			const cum = ensureChainageCache(poly);

			if (!isPolylineValid(poly) || !cum) {
				ui?.logInfo?.(t("chunk_no_active_polyline"));
				return;
			}

			if (aux.getPendingChunkStartS() == null) {
				aux.beginPendingChunk(ss);
				ui?.logInfo?.(t("chunk_start_set", { s: formatNum(ss, 1) }));
				redrawAuxFromState(st);
				propsPanel?.updateProps(st);
				return;
			}

			const chunk = aux.finalizePendingChunk(ss, st);

			if (!chunk) {
				ui?.logInfo?.(t("chunk_invalid_range"));
				propsPanel?.updateProps(st);
				redrawAuxFromState(st);
				return;
			}

			redrawAuxFromState(st);
			propsPanel?.updateProps(st);

			ui?.logInfo?.(
				t("chunk_created", {
					s0: formatNum(chunk.s0, 1),
					s1: formatNum(chunk.s1, 1),
				})
			);
			return;
		}

		if (event?.altKey) {
			void softFitActiveAnimated({ durationMs: cfg.fitDurationMs });
		}
	}

	function wireTrackClickOnce() {
		if (threeA.__ufAIM_trackClickWired) return;
		threeA.__ufAIM_trackClickWired = true;

		threeA.onTrackClick?.((payload) => {
			void handleTrackClick(payload);
		});
	}

	function clear3DKeepAux() {
		threeA.clearTrack?.();
		threeA.clearMarker?.();
		threeA.clearSectionLine?.();
	}

	async function syncGeometryPolicyIfNeeded(state, activeGeometry, geomChanged) {
		if (!geomChanged) return;

		cachedCum = null;
		lastPolyRef = null;

		await applyGeomChangePolicy();

		if (autoFitOnGeomChange) {
			const bbox = activeGeometry?.bbox ?? null;
			if (bbox) {
				threeA.setOriginFromBbox(bbox);
				threeA.zoomToFitWorldBbox?.(bbox, { padding: cfg.fitPadding });
			}
		}
	}

	function syncSectionSamplingAndMarker(state, poly) {
		const cum = ensureChainageCache(poly);

		if (!cum) {
			syncSectionBoard(ui, state, null);
			threeA.clearMarker?.();
			threeA.clearSectionLine?.();
			return;
		}

		const cursorS = Number(state.cursor?.s ?? 0);
		const sectionInfo = samplePointAndTangent(poly, cum, cursorS);

		if (sectionInfo) {
			threeA.setMarkerFromWorld?.({ x: sectionInfo.x, y: sectionInfo.y, z: 0 });
			const line = makeSectionLine(sectionInfo, 30);
			threeA.setSectionLineFromWorld?.(line.p0, line.p1);
		} else {
			threeA.clearMarker?.();
			threeA.clearSectionLine?.();
		}

		syncSectionBoard(ui, state, sectionInfo);
	}

	function syncActiveTrack(poly) {
		threeA.setTrackFromWorldPolyline?.(poly);
	}

	function subscribe() {
		wireTrackClickOnce();
		propsPanel?.wirePropsPanelOnce();
		wireSpotUiUpdatesOnce();

		let renderToken = 0;

		const handler = async (state) => {
			const token = ++renderToken;

			try {
				propsPanel?.updateProps(state);
				syncCursorInput(ui, state);
				syncOverlays(ui, state);
				syncTransitionEditorControls(state);
				syncPinsBadge(ui, state);

				const activeGeometry = await getActiveGeometry(state);

				if (token !== renderToken) return;

				const poly = activeGeometry?.polyline2d ?? null;
				const geomKey = makeGeomKey(activeGeometry);
				const geomChanged = geomKey !== lastGeomKey;
				lastGeomKey = geomKey;

				if (!isPolylineValid(poly)) {
					cachedCum = null;
					lastPolyRef = null;
					syncSectionBoard(ui, state, null);
					redrawAuxFromState(state);
					clear3DKeepAux();
					return;
				}

				await syncGeometryPolicyIfNeeded(state, activeGeometry, geomChanged);

				if (token !== renderToken) return;

				redrawAuxFromState(state);
				syncSectionSamplingAndMarker(state, poly);
				syncActiveTrack(poly);
			} catch (err) {
				console.error("[ViewController] handler crashed (isolated):", err);
				ui?.logInfo?.(
					t("viewcontroller_crashed", { message: String(err?.message ?? err) })
				);
			}
		};

		const unsub = store.subscribe((state) => {
			void handler(state);
		});

		void handler(store.getState());
		return unsub;
	}

	return {
		subscribe,
		recenterToActive,
		fitActive,
		softFitActive,
		softFitActiveAnimated,
		setAutoFitEnabled,
		setOnGeomChange,
		invalidateSpotCache,
		invalidateGeometryCache,
		invalidateAllCaches,
	};
}
