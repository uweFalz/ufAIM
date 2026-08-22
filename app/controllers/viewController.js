// app/controllers/viewController.js

import { t } from "@app/i18n/strings.js";
import { formatNum } from "@utils/helpers.js";
import * as proj4Module from "proj4js";
import { makeDbRefToEtrs89Transform, projectGeographicGeometry } from "@projection/GeographicProjection.js";

import { getSpotObjectById } from "@projection/queries/getSpotObjectById.js";
import {
	projectAlignmentGeometry,
	projectFocusedSpotObject,
} from "@projection/ViewProjectionController.js";

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
import {
	getWorkspacePrimaryId as readWorkspacePrimaryId,
	getWorkspaceContextIds as readWorkspaceContextIds,
	getWorkspaceSelectedElementId as readWorkspaceSelectedElementId,
} from "@src/shared/runtime/workspaceSelectionAccess.js";
import { resolveViewerElementSelection } from "@app/domain/workspace/buildCrossViewElementSelectionModel.js";

export function makeViewController({
	store,
	ui,
	threeA,
	mapA = null,
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
	let cachedSelectionElementId = null;
	let lastRenderSnapshot = {
		objectId: null,
		selectedElementId: null,
		segmentCount: 0,
		boundaryCount: 0,
		segmentKinds: [],
		projectionSignature: null,
		crsId: null,
		mode: "empty",
		placement: "local",
		message: null,
	};

	let auxOwnedTracks = [];
	let workspaceContextTracks = [];

	function getFocusObjectId(state) {
		return readWorkspacePrimaryId(state);
	}

	function getWorkspaceContextIds(state) {
		return readWorkspaceContextIds(state);
	}

	function invalidateSpotCache() {
		cachedSpotState = null;
		cachedSpotStateAt = 0;
		pendingSpotStatePromise = null;
	}

	function invalidateGeometryCache() {
		cachedFocusObjectId = null;
		cachedActiveGeometry = null;
		cachedSelectionElementId = null;
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

	function wireSpotUiUpdatesOnce(onExternalStateChanged) {
		if (wireSpotUiUpdatesOnce._done) return;
		wireSpotUiUpdatesOnce._done = true;

		messaging.onEvt?.("Spot.UiStateChanged", (spotUiState) => {
			invalidateSpotCache();
			invalidateGeometryCache();

			if (spotUiState) {
				ui?.setSpotState?.(spotUiState);
				ui?.refreshSpot?.(store.getState());
			}

			onExternalStateChanged?.();
		});
	}

	function getPreviewGeometryFromState(state) {
		const previewItem = state?.preview_item ?? null;
		const geom = projectAlignmentGeometry({
			objectId: previewItem?.id ?? null,
			geometry: previewItem?.kernel ?? null,
			source: "preview-item",
			crsId: previewItem?.crsId ?? null,
			georeference: previewItem?.georeference ?? null,
			maxStep: cfg.sampleStep,
		});

		if (!geom?.polyline2d || geom.polyline2d.length < 2) return null;

		return {
			objectId: String(previewItem?.id ?? "preview"),
			spotObject: null,
			polyline2d: geom.polyline2d,
			bbox: geom.bbox ?? null,
			bboxCenter: geom.bboxCenter ?? null,
			projection: geom,
			isPreview: true,
		};
	}

	async function getWorkspaceContextGeometries(state) {
		const contextIds = getWorkspaceContextIds(state);
		if (!contextIds.length) return [];

		const focusObjectId = getFocusObjectId(state);
		const spotState = await getSpotStateCached();

		const out = [];

		for (const objectId of contextIds) {
			if (!objectId || objectId === focusObjectId) continue;

			const spotObject = getSpotObjectById(spotState, objectId);
			if (!spotObject) continue;

			const geom = projectFocusedSpotObject(spotObject, {
				maxStep: cfg.sampleStep,
			});

			if (!geom?.polyline2d || geom.polyline2d.length < 2) continue;

			out.push({
				id: String(objectId),
				objectId: String(objectId),
				polyline2d: geom.polyline2d,
				bbox: geom.bbox ?? null,
				crsId: spotObject?.crsId ?? null,
				source: "workspace-context",
			});
		}

		return out;
	}

	async function getActiveGeometry(state) {
		const focusObjectId = getFocusObjectId(state);
		const previewSourceType = String(state?.preview_source?.type ?? state?.preview_source?.kind ?? "");
		if (previewSourceType === "curvature-band" && String(state?.preview_item?.id ?? "") === String(focusObjectId ?? "")) {
			const previewGeometry = getPreviewGeometryFromState(state);
			if (previewGeometry) return previewGeometry;
		}

		if (focusObjectId && cachedFocusObjectId === focusObjectId && cachedActiveGeometry) {
			return cachedActiveGeometry;
		}

		if (focusObjectId) {
			const spotState = await getSpotStateCached();
			const spotObject = getSpotObjectById(spotState, focusObjectId);

			if (spotObject) {
				const geom = projectFocusedSpotObject(spotObject, {
					maxStep: cfg.sampleStep,
				});

				if (geom?.polyline2d && geom.polyline2d.length >= 2) {
					cachedFocusObjectId = focusObjectId;
					cachedSelectionElementId = null;
					cachedActiveGeometry = {
						objectId: String(focusObjectId),
						spotObject,
						polyline2d: geom.polyline2d,
						bbox: geom.bbox ?? null,
						bboxCenter: geom.bboxCenter ?? null,
						projection: geom,
						isPreview: false,
					};
					return cachedActiveGeometry;
				}
			}
		}

		const previewGeometry = getPreviewGeometryFromState(state);
		if (previewGeometry) {
			cachedFocusObjectId = null;
			cachedSelectionElementId = null;
			cachedActiveGeometry = previewGeometry;
			return cachedActiveGeometry;
		}

		invalidateGeometryCache();
		return null;
	}

	function makeGeomKey(activeGeometry) {
		if (!activeGeometry) return "(none)";
		return `${String(activeGeometry.objectId ?? "(none)")}:${activeGeometry.isPreview ? "preview" : "committed"}`;
	}

	function ensureChainageCache(poly) {
		if (!poly) return null;

		if (!cachedCum || lastPolyRef !== poly) {
			cachedCum = computeChainage(poly);
			lastPolyRef = poly;
		}

		return cachedCum;
	}

	function flushAuxTracks() {
		const merged = [
			...(Array.isArray(auxOwnedTracks) ? auxOwnedTracks : []),
			...(Array.isArray(workspaceContextTracks) ? workspaceContextTracks : []),
		];

		if (typeof threeA.setAuxTracksFromWorldPolylinesStyled === "function") {
			threeA.setAuxTracksFromWorldPolylinesStyled(merged);
			return;
		}

		threeA.setAuxTracksFromWorldPolylines?.(
			merged.map((t) => ({ id: t.id, polyline2d: t.polyline2d }))
		);
	}

	function setAuxOwnedTracks(tracks) {
		auxOwnedTracks = Array.isArray(tracks) ? tracks : [];
		flushAuxTracks();
	}

	function setWorkspaceContextTracks(tracks) {
		workspaceContextTracks = Array.isArray(tracks) ? tracks : [];
		flushAuxTracks();
	}

	const aux = createViewAuxTracks({
		store,
		cfg,
		ensureChainageCache,
		setAuxTracks: setAuxOwnedTracks,
		getActivePolyline: () => cachedActiveGeometry?.polyline2d ?? null,
		buildChunkMetrics,
	});

	function redrawAuxFromState(state = store.getState()) {
		aux.redrawAuxFromState(state);
	}

	async function redrawWorkspaceContext(state = store.getState()) {
		const tracks = await getWorkspaceContextGeometries(state);

		setWorkspaceContextTracks(tracks);
	}

	function computeAuxBboxUnion(state) {
		return aux.computeAuxBboxUnion(state);
	}

	function computeChunkBboxUnion(state) {
		return aux.computeChunkBboxUnion(state);
	}

	async function computeWorkspaceContextBboxUnion(state) {
		const tracks = await getWorkspaceContextGeometries(state);
		let bbox = null;

		for (const track of tracks) {
			const trackBbox = pickBboxFromArtifactOrPolyline(null, track?.polyline2d ?? null);
			bbox = unionBbox(bbox, trackBbox);
		}

		return bbox;
	}

	async function computeFitBboxFromState(state, activeGeometry, opts = {}) {
		const includePins =
			(opts.includePins !== undefined) ? Boolean(opts.includePins) : cfg.fitIncludesPins;
		const includeChunks =
			(opts.includeChunks !== undefined) ? Boolean(opts.includeChunks) : true;
		const includeContext =
			(opts.includeContext !== undefined) ? Boolean(opts.includeContext) : true;

		let bbox = activeGeometry?.bbox ?? null;

		if (includePins) bbox = unionBbox(bbox, computeAuxBboxUnion(state));
		if (includeChunks) bbox = unionBbox(bbox, computeChunkBboxUnion(state));
		if (includeContext) bbox = unionBbox(bbox, await computeWorkspaceContextBboxUnion(state));

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

		const bbox = await computeFitBboxFromState(st, activeGeometry, opts);
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

		const bbox = await computeFitBboxFromState(st, activeGeometry, opts);
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

		const bbox = await computeFitBboxFromState(st, activeGeometry, opts);
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

	async function applyGeomChangePolicy(state, activeGeometry) {
		switch (onGeomChange) {
			case "fit":
				return await fitActive({ includeContext: true });

			case "softfit":
				return await softFitActive({ includeContext: true });

			case "softfitanimated":
				return await softFitActiveAnimated({ includeContext: true });

			case "recenter":
				return await recenterToActive();

			default:
				if (!activeGeometry) {
					const bbox = await computeWorkspaceContextBboxUnion(state);
					if (bbox) {
						threeA.setOriginFromBbox(bbox);
						threeA.zoomToFitWorldBbox?.(bbox, { padding: cfg.fitPadding });
						return true;
					}
				}
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
			void softFitActive({ includePins: true, includeChunks: true, includeContext: true });
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
			void softFitActiveAnimated({ durationMs: cfg.fitDurationMs, includeContext: true });
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
		threeA.clearAlignmentProjection?.();
		threeA.setAlignmentSelection?.(null);
		threeA.clearMarker?.();
		threeA.clearSectionLine?.();
	}

	function syncSelectionState(state, activeGeometry) {
		const selectedElementId = readWorkspaceSelectedElementId(state);
		const selectedDiscipline = state?.workspace_selection?.elementDiscipline ?? null;
		const projection = activeGeometry?.projection ?? null;
		const segmentIds = new Set(
			Array.isArray(projection?.segments)
				? projection.segments.map((segment) => String(segment?.elementId ?? segment?.id ?? "")).filter(Boolean)
				: []
		);
		const resolution = resolveViewerElementSelection({ selectedElementId, selectedDiscipline, segmentIds });

		if (resolution.retainShared && resolution.viewerElementId === null) {
			cachedSelectionElementId = null;
			threeA.setAlignmentSelection?.(null);
			return null;
		}

		if (resolution.clearShared) {
			const primaryId = getFocusObjectId(state);
			const contextIds = getWorkspaceContextIds(state);
			if (primaryId) {
				store.actions?.setWorkspaceSelection?.({
					primaryId,
					contextIds,
					elementId: null,
					source: "viewer-stale-selection",
					crsId: state?.workspace_selection?.crsId ?? null,
				});
			}
			cachedSelectionElementId = null;
			threeA.setAlignmentSelection?.(null);
			return null;
		}

		cachedSelectionElementId = selectedElementId;
		threeA.setAlignmentSelection?.({
			objectId: activeGeometry?.objectId ?? null,
			selectedElementId,
		});
		return selectedElementId;
	}

	function syncAlignmentProjection(activeGeometry, state, opts = {}) {
		const projection = activeGeometry?.projection ?? null;
		const selectedElementId = opts.selectedElementId ?? null;
		const projectionSignature = makeProjectionSignature(projection);

		if (!projection?.polyline2d || projection.polyline2d.length < 2) {
			threeA.clearAlignmentProjection?.();
			lastRenderSnapshot = {
				objectId: activeGeometry?.objectId ?? null,
				selectedElementId,
				segmentCount: 0,
				boundaryCount: 0,
				segmentKinds: [],
				projectionSignature: null,
				crsId: activeGeometry?.spotObject?.crsId ?? null,
				mode: activeGeometry?.isPreview ? "preview" : "empty",
				placement: "local",
				message: "no-projection",
			};
			return;
		}

		const crsId = activeGeometry?.spotObject?.crsId ?? null;
		const hasProjectedCrs = typeof crsId === "string" && /^EPSG:/i.test(crsId);
		const placement = hasProjectedCrs ? "projected" : (crsId ? "engineering" : "local");
		const renderMode = activeGeometry?.isPreview ? "preview" : "active";

		threeA.setAlignmentProjection?.({
			objectId: activeGeometry?.objectId ?? null,
			crsId,
			projection,
			selectedElementId,
			isPreview: Boolean(activeGeometry?.isPreview),
			isActive: !activeGeometry?.isPreview,
			placement,
			stateMessage: state?.workspace_selection?.source ?? null,
		});

		lastRenderSnapshot = {
			objectId: activeGeometry?.objectId ?? null,
			selectedElementId,
			segmentCount: Array.isArray(projection?.segments) ? projection.segments.length : 0,
			boundaryCount: Array.isArray(projection?.boundaries) ? projection.boundaries.length : 0,
			segmentKinds: Array.isArray(projection?.segments)
				? [...new Set(projection.segments.map((segment) => String(segment?.kind ?? "unknown")))]
				: [],
			elements: Array.isArray(projection?.segments)
				? projection.segments.map((segment) => ({ id: String(segment?.elementId ?? segment?.id ?? ""), elementId: String(segment?.elementId ?? segment?.id ?? ""), kind: segment?.kind ?? null, s0: segment?.s0, s1: segment?.s1, length: segment?.length, isTransition: Boolean(segment?.isTransition), isArc: Boolean(segment?.isArc), isStraight: Boolean(segment?.isStraight) }))
				: [],
			projectionSignature,
			crsId,
			mode: renderMode,
			placement,
			message: state?.workspace_selection?.source ?? null,
		};
	}

	function makeProjectionSignature(projection) {
		if (!projection?.polyline2d || !Array.isArray(projection.polyline2d)) return null;

		const head = projection.polyline2d[0] ?? null;
		const tail = projection.polyline2d[projection.polyline2d.length - 1] ?? null;
		const segments = Array.isArray(projection.segments) ? projection.segments : [];

		return JSON.stringify({
			points: projection.polyline2d.length,
			head: head ? [round3(head.x), round3(head.y)] : null,
			tail: tail ? [round3(tail.x), round3(tail.y)] : null,
			segments: segments.map((segment) => ({
				id: String(segment?.id ?? segment?.elementId ?? ""),
				kind: String(segment?.kind ?? ""),
				length: round3(segment?.length ?? 0),
				points: Array.isArray(segment?.points2d) ? segment.points2d.length : 0,
			})),
		});
	}

	function round3(value) {
		const number = Number(value);
		if (!Number.isFinite(number)) return null;
		return Math.round(number * 1000) / 1000;
	}

	function selectAlignmentElementFromViewer(payload, state) {
		const elementId = String(payload?.elementId ?? "").trim();
		if (!elementId) return false;

		const objectId = String(payload?.objectId ?? getFocusObjectId(state) ?? "").trim();
		if (!objectId) return false;

		const contextIds = getWorkspaceContextIds(state);
		store.actions?.setWorkspaceSelection?.({
			primaryId: objectId,
			contextIds,
			elementId,
			elementDiscipline: "horizontal",
			source: "viewer",
			crsId: state?.workspace_selection?.crsId ?? null,
		});

		window.dispatchEvent(new CustomEvent("ufaim:alignment-editor-focus-element", {
			detail: { elementId, objectId, source: "viewer" },
		}));

		return true;
	}

	async function syncGeometryPolicyIfNeeded(state, activeGeometry, geomChanged) {
		if (!geomChanged) return;

		cachedCum = null;
		lastPolyRef = null;

		const bbox = activeGeometry?.bbox ?? null;

		if (activeGeometry?.isPreview && bbox) {
			threeA.setOriginFromBbox(bbox);
			threeA.zoomToFitWorldBbox?.(bbox, { padding: cfg.fitPadding });
			return;
		}

		await applyGeomChangePolicy(state, activeGeometry);

		if (autoFitOnGeomChange && bbox) {
			threeA.setOriginFromBbox(bbox);
			threeA.zoomToFitWorldBbox?.(bbox, { padding: cfg.fitPadding });
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
			lastRenderSnapshot.cursor = { s: cursorS, x: sectionInfo.x, y: sectionInfo.y, tangent: { x: sectionInfo.tx, y: sectionInfo.ty } };
			threeA.setMarkerFromWorld?.({ x: sectionInfo.x, y: sectionInfo.y, z: 0 });
			const line = makeSectionLine(sectionInfo, 30);
			threeA.setSectionLineFromWorld?.(line.p0, line.p1);
		} else {
			lastRenderSnapshot.cursor = null;
			threeA.clearMarker?.();
			threeA.clearSectionLine?.();
		}

		syncSectionBoard(ui, state, sectionInfo);
	}

	function syncActiveTrack(poly) {
		threeA.setTrackFromWorldPolyline?.(poly);
	}

	async function syncOperatingMode(activeGeometry, state) {
		const proj4 = proj4Module.default ?? globalThis.proj4 ?? null;
		const sourceContract = activeGeometry?.projection?.georeference ?? null;
		const resolution = sourceContract?.horizontal?.status ? sourceContract.horizontal : sourceContract?.resolution ?? null;
		const transform = makeDbRefToEtrs89Transform(proj4, resolution);
		const geographic = projectGeographicGeometry({ projection: activeGeometry?.projection, resolution, transform });
		const stage = document.getElementById("geoStage");
		const badge = document.getElementById("geoModeBadge");
		const enabled = Boolean(geographic.ok && mapA);
		if (enabled && !mapA.map) {
			const container = document.getElementById("viewMap");
			if (!container) return;
			try { await mapA.mount(container); }
			catch (error) {
				geographic.ok = false;
				geographic.georeference.validationStatus = "transformation-failed";
				geographic.georeference.fallbackReason = "maplibre-activation-failed";
				geographic.georeference.warnings.push(String(error?.message ?? error));
			}
		}
		const mapEnabled = Boolean(geographic.ok && mapA?.map);
		if (!mapEnabled && mapA?.map) mapA.destroy();
		stage?.classList.toggle("is-geographic", mapEnabled);
		if (badge) {
			badge.textContent = mapEnabled ? "GEO" : "LOCAL";
			badge.title = mapEnabled ? `${resolution.resolvedEpsg}; vertical reference unresolved` : String(geographic.georeference?.fallbackReason ?? "local-cartesian");
		}
		if (mapEnabled) {
			mapA.setRenderPrimitives(geographic.geometry);
			const cum = ensureChainageCache(activeGeometry?.polyline2d);
			const cursor = cum ? samplePointAndTangent(activeGeometry.polyline2d, cum, Number(state?.cursor?.s ?? 0)) : null;
			if (cursor) {
				const projected = transform([cursor.x, cursor.y]);
				mapA.setCursor({ longitude: Number(projected?.[0]), latitude: Number(projected?.[1]), objectId: activeGeometry?.objectId ?? null, s: Number(state?.cursor?.s), crsId: resolution?.resolvedEpsg ?? null });
			} else mapA.setCursor(null);
			mapA.fitToContent();
			lastRenderSnapshot.placement = "geographic";
			lastRenderSnapshot.georeference = geographic.georeference;
		} else {
			lastRenderSnapshot.georeference = geographic.georeference;
		}
	}

	function wireAlignmentSelectionOnce() {
		if (threeA.__ufAIM_alignmentSelectionWired) return;
		threeA.__ufAIM_alignmentSelectionWired = true;

		threeA.onAlignmentElementClick?.((payload) => {
			void selectAlignmentElementFromViewer(payload, store.getState());
		});
	}

	function subscribe() {
		wireTrackClickOnce();
		wireAlignmentSelectionOnce();
		propsPanel?.wirePropsPanelOnce();

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
				const selectedElementId = readWorkspaceSelectedElementId(state);

				await redrawWorkspaceContext(state);

				if (!isPolylineValid(poly)) {
					cachedCum = null;
					lastPolyRef = null;
					syncSectionBoard(ui, state, null);
					redrawAuxFromState(state);
					clear3DKeepAux();

					await applyGeomChangePolicy(state, null);
					lastRenderSnapshot = {
						objectId: activeGeometry?.objectId ?? null,
						selectedElementId,
						segmentCount: 0,
						boundaryCount: 0,
						crsId: activeGeometry?.spotObject?.crsId ?? null,
						mode: activeGeometry?.isPreview ? "preview" : "empty",
						placement: "local",
						message: "no-track",
					};
					return;
				}

				await syncGeometryPolicyIfNeeded(state, activeGeometry, geomChanged);

				if (token !== renderToken) return;

				redrawAuxFromState(state);
				const currentSelectedElementId = syncSelectionState(state, activeGeometry);
				syncAlignmentProjection(activeGeometry, state, { selectedElementId: currentSelectedElementId });
				syncSectionSamplingAndMarker(state, poly);
				syncActiveTrack(poly);
				await syncOperatingMode(activeGeometry, state);
			} catch (err) {
				console.error("[ViewController] handler crashed (isolated):", err);
				ui?.logInfo?.(
					t("viewcontroller_crashed", { message: String(err?.message ?? err) })
				);
			}
		};

		wireSpotUiUpdatesOnce(() => {
			void handler(store.getState());
		});

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
		getDebugState: () => ({ ...lastRenderSnapshot }),
		debugSelectAlignmentElement: (elementId) =>
			selectAlignmentElementFromViewer({
				objectId: getFocusObjectId(store.getState()),
				elementId,
			}, store.getState()),
	};
}
