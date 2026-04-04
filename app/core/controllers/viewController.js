// app/core/controllers/viewController.js
//
// ViewController
//
// Window-local projection/render orchestration.
//
// Responsibilities:
// - reads canonical objects
// - reads window-local focus/context
// - projects current view slice
// - renders this window
//
// Rule:
// canonical change -> local reprojection -> local rerender
//
// Important:
// Windows do not sync each other directly.
// They sync against the same canonical truth.
//
// ViewController
//
// Rolle:
// - verbindet Auswahl (SPOT) mit Visualisierung
// - orchestriert: Auswahl → Projektion → Rendering
//
// Grundprinzip:
// - Nur SPOT-Objects werden visualisiert
// - Auswahl (focus) bestimmt, was dargestellt wird
//
// Pipeline:
// SPOT selection → Projection → Render (2D/3D)
//
// Aufgaben:
// - reagiert auf State-Änderungen (store / messaging)
// - wählt aktives Objekt (focus)
// - stößt Projektion (AlignmentProjectionService) an
// - übergibt Ergebnis an Renderer (ThreeAdapter / View)
//
// NICHT:
// - keine Import-Logik
// - keine SPOT-Erzeugung
// - keine Parser-/Formatlogik
// - keine dauerhafte Datenhaltung
//
// Wichtig:
// - kein direkter Zugriff auf Rohdaten außerhalb von SPOT
// - keine Schattenmodelle oder parallele Datenpfade
//
// Ziel:
// Dünne Orchestrierungsschicht zwischen SPOT und View.
//
// ViewController (UI/Render glue):
// - owns store.subscribe for "store -> UI + 3D"
// - computes sectionInfo from import_polyline2d + cursor.s
// - updates overlays (bands/section text)
// - updates three viewer via ThreeAdapter (floating origin)
// - detects "active geometry changed" and applies policy:
//    off | recenter | fit | softfit | softfitanimated
//
// MS15.x:
// - viewer-only "chunks" (ephemeral), rendered as aux tracks
// - two-click range via Shift+click (start/end)

import { t } from "@app/i18n/strings.js";
import { formatNum } from "@src/utils/helpers.js";

import {
	samplePointAndTangent,
	isPolylineValid,
	computeChainage,
	makeSectionLine,
	unionBbox,
	pickBboxFromArtifactOrPolyline,
	buildChunkMetrics,
	makeActiveGeomKey,
} from "@app/core/controllers/viewGeometry.js";

import { createViewAuxTracks } from "@app/core/controllers/viewAuxTracks.js";
import { createViewPropsPanel } from "@app/core/controllers/viewPropsPanel.js";

import {
	syncRouteProjectSelect,
	syncSpotBaseIdDatalist,
	syncCursorInput,
	syncOverlays,
	syncSectionBoard,
	syncPinsBadge,
	syncSpotPanel,
	syncTransitionEditorControls,
} from "@app/core/controllers/viewUiSync.js";

// ------------------------------------------------------------
// ViewController
// ------------------------------------------------------------

export function makeViewController({ store, ui, threeA, propsElement, prefs } = {}) {
	if (!store?.getState || !store?.subscribe) throw new Error("ViewController: missing store");
	if (!ui) throw new Error("ViewController: missing ui");
	if (!threeA) throw new Error("ViewController: missing three adapter");

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
	};

	// policy: off | recenter | fit | softfit | softfitanimated
	let onGeomChange = String(prefs?.view?.onGeomChange ?? "recenter").toLowerCase();

	let autoFitOnGeomChange =
		(prefs?.view?.autoFitOnGeomChange !== undefined)
			? Boolean(prefs.view.autoFitOnGeomChange)
			: false;

	let cachedCum = null;
	let lastGeomKey = null;
	let lastPolyRef = null;

	const selectors = {
		activeAlignmentArtifact(state) {
			const aa = state.import_activeArtifacts;
			if (!aa?.alignmentArtifactId) return null;
			return state.artifacts?.[aa.alignmentArtifactId] ?? null;
		},
		pickBbox(art, poly) {
			return pickBboxFromArtifactOrPolyline(art, poly);
		},
	};

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
		} else {
			threeA.setAuxTracksFromWorldPolylines?.(
				tracks.map((t) => ({ id: t.id, points: t.points }))
			);
		}
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

	function computeFitBboxFromState(state, poly, opts = {}) {
		const includePins =
			(opts.includePins !== undefined) ? Boolean(opts.includePins) : cfg.fitIncludesPins;
		const includeChunks =
			(opts.includeChunks !== undefined) ? Boolean(opts.includeChunks) : true;

		const activeArt = selectors.activeAlignmentArtifact(state);
		let bbox = selectors.pickBbox(activeArt, poly);

		if (includePins) bbox = unionBbox(bbox, computeAuxBboxUnion(state));
		if (includeChunks) bbox = unionBbox(bbox, computeChunkBboxUnion(state));

		return bbox;
	}

	function recenterToActive() {
		const st = store.getState();
		const poly = st.import_polyline2d;
		if (!Array.isArray(poly) || poly.length < 2) return false;

		const art = selectors.activeAlignmentArtifact(st);
		const bbox = selectors.pickBbox(art, poly);
		if (!bbox) return false;

		threeA.setOriginFromBbox(bbox);
		return true;
	}

	function fitActive(opts = {}) {
		const st = store.getState();
		const poly = st.import_polyline2d;
		if (!Array.isArray(poly) || poly.length < 2) return false;

		const bbox = computeFitBboxFromState(st, poly, opts);
		if (!bbox) return false;

		const padding = Number.isFinite(opts.padding) ? opts.padding : cfg.fitPadding;

		threeA.setOriginFromBbox(bbox);
		threeA.zoomToFitWorldBbox?.(bbox, { padding });
		return true;
	}

	function softFitActive(opts = {}) {
		const st = store.getState();
		const poly = st.import_polyline2d;
		if (!Array.isArray(poly) || poly.length < 2) return false;

		const bbox = computeFitBboxFromState(st, poly, opts);
		if (!bbox) return false;

		const padding = Number.isFinite(opts.padding) ? opts.padding : cfg.fitPadding;

		threeA.setOriginFromBbox(bbox);
		threeA.zoomToFitWorldBboxSoft?.(bbox, { padding }) ??
			threeA.zoomToFitWorldBbox?.(bbox, { padding });
		return true;
	}

	function softFitActiveAnimated(opts = {}) {
		const st = store.getState();
		const poly = st.import_polyline2d;
		if (!Array.isArray(poly) || poly.length < 2) return false;

		const bbox = computeFitBboxFromState(st, poly, opts);
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

	function applyGeomChangePolicy() {
		switch (onGeomChange) {
			case "fit":
				return fitActive();
			case "softfit":
				return softFitActive();
			case "softfitanimated":
				return softFitActiveAnimated();
			case "recenter":
				return recenterToActive();
			default:
				return false;
		}
	}

	function setCursorS(s, opts = {}) {
		const ss = Number(s);
		if (!Number.isFinite(ss)) return false;

		if (store.actions?.setCursorS) store.actions.setCursorS(ss);
		else if (store.actions?.setCursor) store.actions.setCursor({ s: ss });
		else return false;

		if (opts.fit === true) {
			softFitActive({ includePins: true, includeChunks: true });
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

	function handleTrackClick({ s, event }) {
		const ss = Number(s);
		if (!Number.isFinite(ss)) return;

		setCursorS(ss);

		if (event?.shiftKey) {
			const st = store.getState?.() ?? {};
			const poly = st.import_polyline2d;
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
			softFitActiveAnimated({ durationMs: cfg.fitDurationMs });
		}
	}

	function wireTrackClickOnce() {
		if (threeA.__ufAIM_trackClickWired) return;
		threeA.__ufAIM_trackClickWired = true;
		threeA.onTrackClick?.(handleTrackClick);
	}

	function clear3DKeepAux() {
		threeA.clearTrack?.();
		threeA.clearMarker?.();
		threeA.clearSectionLine?.();
	}

	function syncGeometryPolicyIfNeeded(state, poly, geomChanged) {
		if (!geomChanged) return;

		cachedCum = null;
		lastPolyRef = null;

		applyGeomChangePolicy();

		if (autoFitOnGeomChange) {
			const art = selectors.activeAlignmentArtifact(state);
			const bbox = selectors.pickBbox(art, poly);
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

		const handler = (state) => {
			try {
				syncRouteProjectSelect(ui, state);
				syncSpotBaseIdDatalist(state);
				propsPanel?.updateProps(state);
				syncCursorInput(ui, state);
				syncOverlays(ui, state);
				syncTransitionEditorControls(state);
				syncPinsBadge(ui, state);
				syncSpotPanel(ui, state);

				const poly = state.import_polyline2d;
				const geomKey = makeActiveGeomKey(state);
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

				syncGeometryPolicyIfNeeded(state, poly, geomChanged);
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

		const unsub = store.subscribe(handler);
		handler(store.getState());
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
	};
}
