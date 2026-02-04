// app/core/viewController.js
//
// ViewController (UI/Render glue):
// - owns store.subscribe for "store -> UI + 3D"
// - computes sectionInfo from import_polyline2d + cursor.s
// - updates overlays (bands/section text)
// - updates three viewer via ThreeAdapter (floating origin)
// - detects "active geometry changed" and applies policy:
//    off | recenter | fit | softfit | softfitanimated
// - MS12.x: fitActive()
// - MS13.2: softfit (no target jump)
// - MS13.2b: softfitanimated (smooth zoom animation)
//
// MS15.x:
// - viewer-only "chunks" (ephemeral), rendered as aux tracks
// - two-click range via Shift+click (start/end)

import { mirrorQuickHooksFromActive } from "../io/importApply.js";

// ------------------------------------------------------------
// Refactor v4:
// - consolidate prefs into a single cfg block
// - group state/selector helpers (keep subscribe handler “flat”)
// - remove accidental duplicate helper definitions (buildChunkAuxTracks)
// - avoid wiring side-effects before subscribe() (only wire in subscribe)
// ------------------------------------------------------------

// ------------------------------------------------------------
// Refactor v3:
// - wiring extracted (props panel + spot panel + track click)
// - key parsing unified (rpId/spotId keys share same parser)
// - duplicate buildChunkAuxTracks removed (keep the small helpers)
// ------------------------------------------------------------

function clampNumber(value, min, max) {
	const v = Number(value);
	if (!Number.isFinite(v)) return min;
	return Math.max(min, Math.min(max, v));
}

function formatNum(v, digits = 3) {
	return Number.isFinite(v) ? v.toFixed(digits) : "—";
}

function escapeHtml(text) {
	return String(text ?? "")
	.replace(/&/g, "&amp;")
	.replace(/</g, "&lt;")
	.replace(/>/g, "&gt;")
	.replace(/\"/g, "&quot;")
	.replace(/'/g, "&#39;");
}

// key parser for strings like "<id>::<slot>" where <id> can contain "::"
// returns { id, slot } or null
function parseIdSlotKey(key) {
	const parts = String(key ?? "").split("::");
	if (parts.length < 2) return null;
	const slot = parts.pop();
	const id = parts.join("::");
	if (!id || !slot) return null;
	return { id, slot };
}

function computeChainage(polyline2d) {
	if (!Array.isArray(polyline2d) || polyline2d.length < 2) return null;

	const cum = new Array(polyline2d.length);
	cum[0] = 0;

	for (let i = 1; i < polyline2d.length; i++) {
		const a = polyline2d[i - 1];
		const b = polyline2d[i];
		cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y);
	}
	return cum;
}

function samplePointAndTangent(polyline2d, cum, s) {
	if (!cum || !Array.isArray(polyline2d) || polyline2d.length < 2) return null;

	const total = cum[cum.length - 1];
	const ss = clampNumber(s, 0, total);

	let i = 1;
	while (i < cum.length && cum[i] < ss) i++;
	if (i >= cum.length) i = cum.length - 1;

	const s0 = cum[i - 1];
	const s1 = cum[i];
	const a = polyline2d[i - 1];
	const b = polyline2d[i];

	const ds = (s1 - s0) || 1e-9;
	const tt = (ss - s0) / ds;

	const x = a.x + tt * (b.x - a.x);
	const y = a.y + tt * (b.y - a.y);

	let tx = (b.x - a.x);
	let ty = (b.y - a.y);
	const len = Math.hypot(tx, ty) || 1e-9;
	tx /= len; ty /= len;

	return { x, y, tx, ty, s: ss, total };
}

function lerp(a, b, t) { return a + (b - a) * t; }

function isPolylineValid(polyline2d) {
	return Array.isArray(polyline2d) && polyline2d.length >= 2;
}

function pointAtS(polyline2d, cum, s) {
	if (!Array.isArray(polyline2d) || polyline2d.length < 2) return null;
	if (!Array.isArray(cum) || cum.length !== polyline2d.length) return null;

	const total = cum[cum.length - 1];
	const ss = clampNumber(s, 0, total);

	let i = 1;
	while (i < cum.length && cum[i] < ss) i++;
	if (i >= cum.length) i = cum.length - 1;

	const s0 = cum[i - 1];
	const s1 = cum[i];
	const a = polyline2d[i - 1];
	const b = polyline2d[i];

	const ds = (s1 - s0) || 1e-9;
	const t = (ss - s0) / ds;

	return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

// Returns a world polyline representing the segment [sA..sB]
function clipPolylineByChainage(polyline2d, cum, sA, sB) {
	if (!Array.isArray(polyline2d) || polyline2d.length < 2) return null;
	if (!Array.isArray(cum) || cum.length !== polyline2d.length) return null;

	const total = cum[cum.length - 1];
	let a = clampNumber(sA, 0, total);
	let b = clampNumber(sB, 0, total);
	if (!(Number.isFinite(a) && Number.isFinite(b))) return null;

	const s0 = Math.min(a, b);
	const s1 = Math.max(a, b);
	if (!(s1 > s0)) return null;

	const out = [];
	const pStart = pointAtS(polyline2d, cum, s0);
	const pEnd = pointAtS(polyline2d, cum, s1);
	if (!pStart || !pEnd) return null;

	out.push(pStart);

	// include intermediate vertices strictly inside (s0, s1)
	for (let i = 1; i < cum.length - 1; i++) {
		const si = cum[i];
		if (si > s0 && si < s1) out.push(polyline2d[i]);
	}

	out.push(pEnd);

	// degenerate safeguard
	if (out.length < 2) return null;
	return out;
}

function makeSectionLine(sample, halfWidth = 20) {
	const nx = -sample.ty;
	const ny = sample.tx;
	return {
		p0: { x: sample.x - nx * halfWidth, y: sample.y - ny * halfWidth, z: 0 },
		p1: { x: sample.x + nx * halfWidth, y: sample.y + ny * halfWidth, z: 0 },
	};
}

function computeBbox(polyline2d) {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

	for (const p of (polyline2d ?? [])) {
		const x = Number(p?.x);
		const y = Number(p?.y);
		if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}

	if (!Number.isFinite(minX)) return null;
	return { minX, minY, maxX, maxY };
}

function unionBbox(a, b) {
	if (!a) return b ?? null;
	if (!b) return a ?? null;
	return {
		minX: Math.min(a.minX, b.minX),
		minY: Math.min(a.minY, b.minY),
		maxX: Math.max(a.maxX, b.maxX),
		maxY: Math.max(a.maxY, b.maxY),
	};
}

function renderBandsText(state) {
	const profile = state.import_profile1d;
	const cant = state.import_cant1d;

	const lines = [];
	lines.push(`(Bands) cursor.s=${formatNum(state.cursor?.s ?? 0, 1)} m`);

	if (Array.isArray(profile) && profile.length >= 2) {
		lines.push("");
		lines.push(`z(s) (Profile) pts=${profile.length}`);
		for (const p of profile.slice(0, 10)) {
			lines.push(`  s=${formatNum(p.s, 1)}  z=${formatNum(p.z, 3)}  R=${p.R ?? "—"}  T=${p.T ?? "—"}`);
		}
	} else {
		lines.push("");
		lines.push("z(s): (noch kein Profile / GRA)");
	}

	if (Array.isArray(cant) && cant.length >= 2) {
		lines.push("");
		lines.push(`u(s) (Cant/Überhöhung) pts=${cant.length}`);
		for (const p of cant.slice(0, 10)) {
			lines.push(`  s=${formatNum(p.s, 1)}  u=${formatNum(p.u, 4)} m`);
		}
	} else {
		lines.push("");
		lines.push("u(s): (noch keine Überhöhung / Cant)");
	}

	return lines.join("\n");
}

function renderSectionText(state, sectionInfo) {
	const s = state.cursor?.s ?? 0;

	const lines = [];
	lines.push(`(Section) at cursor.s=${formatNum(s, 1)} m`);
	lines.push("");

	if (!sectionInfo) {
		lines.push("No alignment sampling yet.");
		return lines.join("\n");
	}

	lines.push(`sample: x=${formatNum(sectionInfo.x, 3)} y=${formatNum(sectionInfo.y, 3)}`);
	lines.push(`tangent: tx=${formatNum(sectionInfo.tx, 4)} ty=${formatNum(sectionInfo.ty, 4)}`);
	lines.push(`chainage: s=${formatNum(sectionInfo.s, 2)} / total=${formatNum(sectionInfo.total, 2)}`);
	lines.push("");
	lines.push("Querprofil: später (Terrain/Objekte/Lichtraum etc.).");

	return lines.join("\n");
}

function makeActiveGeomKey(state) {
	const aa = state.import_activeArtifacts;
	if (aa) {
		return `${aa.baseId ?? ""}::${aa.slot ?? ""}::${aa.alignmentArtifactId ?? ""}`;
	}
	const rpId = state.activeRouteProjectId ?? "";
	const slot = state.activeSlot ?? "right";
	return `${rpId}::${slot}::(no-activeArtifacts)`;
}

function pickBboxFromArtifactOrPolyline(art, poly) {
	const b =
	art?.payload?.bbox ??
	art?.payload?.bboxENU ??
	art?.payload?.bbox?.bbox ??
	null;

	if (b?.minX != null) return b;
	return computeBbox(poly);
}

// ---- MS13.12x: pins helpers (support legacy string pins + new object pins) ----
function normalizePins(pins) {
	const arr = Array.isArray(pins) ? pins : [];
	const out = [];
	for (const p of arr) {
		if (!p) continue;
		if (typeof p === "string") {
			const [rpId, slot] = String(p).split("::");
			if (rpId) out.push({ rpId, slot: slot || "right" });
			continue;
		}
		if (typeof p === "object") {
			const rpId = p.rpId ?? p.baseId ?? null;
			if (!rpId) continue;
			out.push({ rpId: String(rpId), slot: String(p.slot ?? "right") });
		}
	}
	return out;
}

function makePinKey(pin) {
	if (!pin?.rpId) return "";
	return `${pin.rpId}::${pin.slot ?? "right"}`;
}

//
// ...
//
export function makeViewController({ store, ui, threeA, propsElement, prefs } = {}) {
	if (!store?.getState || !store?.subscribe) throw new Error("ViewController: missing store");
	if (!ui) throw new Error("ViewController: missing ui");
	if (!threeA) throw new Error("ViewController: missing three adapter");
	
	// ------------------------------------------------------------
	// cfg (prefs normalization)
	// ------------------------------------------------------------
	const cfg = {
		fitPadding: Number.isFinite(prefs?.view?.fitPadding) ? prefs.view.fitPadding : 1.35,
		fitDurationMs: Number.isFinite(prefs?.view?.fitDurationMs) ? prefs.view.fitDurationMs : 240,
		fitIncludesPins: (prefs?.view?.fitIncludesPins !== undefined) ? Boolean(prefs.view.fitIncludesPins) : true,
		showAuxTracks: (prefs?.view?.showAuxTracks !== undefined) ? Boolean(prefs.view.showAuxTracks) : true,
		auxTracksScope: String(prefs?.view?.auxTracksScope ?? "routeProject").toLowerCase(),
		auxTracksMax: Number.isFinite(prefs?.view?.auxTracksMax) ? prefs.view.auxTracksMax : 12,
	};
	
	// policy: off | recenter | fit | softfit | softfitanimated
	let onGeomChange = String(prefs?.view?.onGeomChange ?? "recenter").toLowerCase();
	
	// legacy toggle (kept, but policy is the primary behavior)
	let autoFitOnGeomChange =
	(prefs?.view?.autoFitOnGeomChange !== undefined)
	? Boolean(prefs.view.autoFitOnGeomChange)
	: false;

	let cachedCum = null;
	let lastGeomKey = null;
	let lastPolyRef = null;

	// MS15.3: ephemeral chunks rendered in viewer only (no store)
	let pendingChunkStartS = null; // MS15.2: shift two-click range start
	
	const chunkTracks = []; // each: { id, points:[{x,y},...], s0,s1, at }
	const MAX_CHUNKS = 12;
	const PREVIEW_ID = "chunk_preview";
	
	// ------------------------------------------------------------
	// selectors (state-derived helpers)
	// ------------------------------------------------------------
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
	
	function buildChunkPreviewTrack(state) {
		if (pendingChunkStartS == null) return null;
		
		const poly = state.import_polyline2d;
		if (!isPolylineValid(poly)) return null;
		
		const cum = ensureChainageCache(poly);
		if (!cum) return null;
		
		const s0 = pendingChunkStartS;
		const s1 = Number(state.cursor?.s ?? 0);
		const pts = clipPolylineByChainage(poly, cum, s0, s1);
		if (!pts || pts.length < 2) return null;
		return { id: PREVIEW_ID, points: pts };
	}
	
	function buildChunkAuxTracks(state) {
		const aux = collectAuxTracks(state);
		const chunks = chunkTracks.map((c) => ({ id: c.id, points: c.points }));
		const preview = buildChunkPreviewTrack(state);
		return preview ? [...aux, ...chunks, preview] : [...aux, ...chunks];
	}

	function makeChunkId() {
		return `chunk_${Date.now()}_${Math.random().toString(16).slice(2)}`;
	}
	
	function redrawAuxFromState(state) {
		threeA.setAuxTracksFromWorldPolylines?.(buildChunkAuxTracks(state));
	}

	// MS13.5: click-to-chainage (track pick) -> cursor.s
	function setCursorS(s, opts = {}) {
		const ss = Number(s);
		if (!Number.isFinite(ss)) return false;

		if (store.actions?.setCursorS) {
			store.actions.setCursorS(ss);
		} else if (store.actions?.setCursor) {
			store.actions.setCursor({ s: ss });
		} else {
			// MS14.2: ViewController never writes store directly
			return false;
		}

		if (opts.fit === true) {
			fitActive({ mode: "softFit" });
		}
		return true;
	}

	function handleTrackClick({ s, event }) {
		const ss = Number(s);
		if (!Number.isFinite(ss)) return;
		
		// always set cursor (useful)
		setCursorS(ss);
		
		// MS15.3: SHIFT = local two-click chunk creation (viewer-only)
		if (event?.shiftKey) {
			const st = store.getState?.() ?? {};
			const poly = st.import_polyline2d;
			const cum = ensureChainageCache(poly);
			
			if (!isPolylineValid(poly) || !cum) {
				ui?.logInfo?.("Chunk: no active polyline.");
				return;
			}
			
			if (pendingChunkStartS == null) {
				pendingChunkStartS = ss;
				ui?.logInfo?.(`Chunk start set at s=${formatNum(ss, 1)} (Shift+click end)`);
				redrawAuxFromState(st); // show preview immediately
				updateProps(st);        // keep props in sync even without store tick
				return;
			}
			
			// second click => create chunk polyline
			const s0 = pendingChunkStartS;
			const s1 = ss;
			pendingChunkStartS = null;
			
			const points = clipPolylineByChainage(poly, cum, s0, s1);
			if (!points) {
				ui?.logInfo?.("Chunk: invalid range.");
				updateProps(st);
				redrawAuxFromState(st);
				return;
			}
			
			chunkTracks.unshift({
				id: makeChunkId(),
				points,
				s0: Math.min(s0, s1),
				s1: Math.max(s0, s1),
				at: Date.now(),
			});
			if (chunkTracks.length > MAX_CHUNKS) chunkTracks.length = MAX_CHUNKS;
			
			// force immediate redraw without waiting for next store tick:
			redrawAuxFromState(st);
			updateProps(st);
			
			ui?.logInfo?.(`Chunk created: s=${formatNum(Math.min(s0, s1), 1)}..${formatNum(Math.max(s0, s1), 1)}`);
			return;
		}
		
		// keep your old “animated zoom” on ALT now (since SHIFT is chunk)
		if (event?.altKey) softFitActiveAnimated({ durationMs: cfg.fitDurationMs });
	}
	
	function wireTrackClickOnce() {
		if (threeA.__ufAIM_trackClickWired) return;
		threeA.__ufAIM_trackClickWired = true;
		threeA.onTrackClick?.(handleTrackClick);
	}
	
	function updateProps(state) {
		if (!propsElement) return;

		const pins = normalizePins(state.view_pins);
		const pinsHtml = pins.length
		? pins.map((pin) => {
			const key = `${pin.rpId}::${pin.slot}`;
			const safeRp = escapeHtml(pin.rpId ?? "");
			const safeSlot = escapeHtml(pin.slot ?? "right");
			const safeKey = escapeHtml(key);

			const isActive = (pin.rpId === state.activeRouteProjectId) && (pin.slot === (state.activeSlot ?? "right"));
			const activeBadge = isActive ? `<span class="propsPins__badge">active</span>` : ``;

			return `
			<div class="propsPins__row">
			<button class="btn btn--ghost btn--xs" data-pin-jump="${safeKey}" title="Jump to this pinned alignment">Jump</button>
			<div class="propsPins__label">
			<span class="propsPins__rp">${safeRp}</span>
			<span class="propsPins__slot">${safeSlot}</span>
			${activeBadge}
			</div>
			<button class="btn btn--ghost btn--xs" data-pin-unpin="${safeKey}" title="Unpin">×</button>
			</div>
			`;
		}).join("")
		: `<div class="propsPins__empty">(no pins yet)</div>`;
		
		// MS15.x: viewer-only chunks (local, not in store)
		const chunks = chunkTracks;
		const pendingHtml = (pendingChunkStartS != null)
		? `<div class="propsChunks__pending">Shift-chunk start: s=${escapeHtml(formatNum(pendingChunkStartS, 1))} (click end)</div>`
		: ``;

		const chunksHtml = chunkTracks.length
		? chunks
		.slice() // show newest first
		.sort((a, b) => (b?.at ?? 0) - (a?.at ?? 0))
		.map((c) => {
			const mid = (Number(c.s0) + Number(c.s1)) * 0.5;
			const len = Math.abs(Number(c.s1) - Number(c.s0));
			const safeId = escapeHtml(c.id ?? "");
			return `
			<div class="propsChunks__row">
			<div class="propsChunks__label">
			<span class="propsChunks__range">s=${escapeHtml(formatNum(c.s0,1))}..${escapeHtml(formatNum(c.s1,1))}</span>
			<span class="propsChunks__meta">len=${escapeHtml(formatNum(len,1))}m</span>
			</div>
			<button class="btn btn--ghost btn--xs" data-chunk-jump="${safeId}" data-chunk-mid="${escapeHtml(String(mid))}">Jump</button>
			<button class="btn btn--ghost btn--xs" data-chunk-remove="${safeId}">×</button>
			</div>
			`;
		}).join("")
		: `<div class="propsChunks__empty">(no chunks yet) — Shift+click start/end</div>`;

		const json = JSON.stringify(
		{
			activeRouteProjectId: state.activeRouteProjectId ?? null,
			activeSlot: state.activeSlot ?? "right",
			cursor: state.cursor ?? {},
			import_meta: state.import_meta ?? null,
			activeArtifacts: state.import_activeArtifacts ?? null,

			hasAlignment: Array.isArray(state.import_polyline2d) && state.import_polyline2d.length >= 2,
			hasProfile: Array.isArray(state.import_profile1d) && state.import_profile1d.length >= 2,
			hasCant: Array.isArray(state.import_cant1d) && state.import_cant1d.length >= 2,
		},
		null,
		2
		);

		propsElement.innerHTML = `
		<div class="propsPins">
		<div class="propsPins__title">Pinned</div>
		${pinsHtml}
		</div>

		<div class="propsChunks">
		<div class="propsChunks__title">Chunks</div>
		${pendingHtml}
		${chunksHtml}
		<div class="propsChunks__actions">
		<button class="btn btn--ghost btn--xs" data-chunks-clear="1">Clear</button>
		</div>
		</div>

		<div class="propsJson"><pre>${escapeHtml(json)}</pre></div>
		`;
	}

	function clear3D() {
		threeA.clearTrack?.();
		threeA.clearAuxTracks?.();
		threeA.clearMarker?.();
		threeA.clearSectionLine?.();
	}
	
	// MS15.x: when no active geometry, we still want aux tracks (pins/chunks/preview)
	function clear3DKeepAux() {
		threeA.clearTrack?.();
		threeA.clearMarker?.();
		threeA.clearSectionLine?.();
	}
	
	// ------------------------------------------------------------
	// Refactor v2: handler steps (UI / overlays / render)
	// ------------------------------------------------------------
	function syncRouteProjectSelect(state) {
		const ids = Object.keys(state.routeProjects ?? {}).sort((a, b) => a.localeCompare(b));
		ui.setRouteProjectOptions?.(ids, state.activeRouteProjectId);
	}
	
	function syncPropsPanel(state) {
		updateProps(state);
	}
	
	function syncCursorInput(state) {
		// MS13.8: keep cursor input in sync with state (but don't fight while user edits)
		const cursorEl = ui.elements?.cursorSInput;
		if (cursorEl && document.activeElement !== cursorEl) {
			ui.setCursorSInputValue?.(state.cursor?.s ?? 0);
		}
	}
	
	function syncOverlays(state) {
		ui.setBoardBandsText?.(renderBandsText(state));
	}
	
	function syncPinsBadge(state) {
		const pinsNow = normalizePins(state.view_pins);
		ui.setPinsInfoText?.(`Pins: ${pinsNow.length}`);
	}
	
	function syncSpotPanel(state) {
		renderSpotPanel(state);
	}
	
	function syncAuxTracks(state) {
		threeA.setAuxTracksFromWorldPolylines?.(buildChunkAuxTracks(state));
	}
	
	function syncGeometryPolicyIfNeeded(state, poly, geomChanged) {
		if (!geomChanged) return;
		
		// reset chainage cache so section sampling reinitializes on new poly ref
		cachedCum = null;
		lastPolyRef = null;
		
		applyGeomChangePolicy();
		
		// legacy toggle (optional)
		if (autoFitOnGeomChange) {
			const art = selectors.activeAlignmentArtifact(state);
			// const bbox = pickBboxFromArtifactOrPolyline(art, poly);
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
			ui.setBoardSectionText?.(renderSectionText(state, null));
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
		
		ui.setBoardSectionText?.(renderSectionText(state, sectionInfo));
	}
	
	function syncActiveTrack(poly) {
		threeA.setTrackFromWorldPolyline?.(poly);
	}

	// ------------------------------------------------------------
	// Wiring: Props panel (pins + chunks)
	// ------------------------------------------------------------
	function handlePropsPanelClick(ev) {
		const t = ev?.target;
		if (!t || typeof t.closest !== "function") return;
		
		const st = store.getState?.() ?? {};
		
		// chunks (viewer-only)
		const jumpChunkBtn = t.closest("[data-chunk-jump]");
		const removeChunkBtn = t.closest("[data-chunk-remove]");
		const clearChunksBtn = t.closest("[data-chunks-clear]");
		
		if (jumpChunkBtn || removeChunkBtn || clearChunksBtn) {
			ev.preventDefault?.();
			ev.stopPropagation?.();
			
			if (clearChunksBtn) {
				chunkTracks.length = 0;
				pendingChunkStartS = null;
				updateProps(st);
				redrawAuxFromState(st);
				return;
			}
			
			if (removeChunkBtn) {
				const id = removeChunkBtn.getAttribute("data-chunk-remove");
				if (id) {
					const idx = chunkTracks.findIndex((c) => c?.id === id);
					if (idx >= 0) chunkTracks.splice(idx, 1);
					updateProps(st);
					redrawAuxFromState(st);
				}
				return;
			}
			
			if (jumpChunkBtn) {
				const mid = Number(jumpChunkBtn.getAttribute("data-chunk-mid"));
				if (Number.isFinite(mid)) {
					setCursorS(mid, { fit: true });
					softFitActiveAnimated({ durationMs: cfg.fitDurationMs });
				}
				return;
			}
		}
		
		// pins (store-backed)
		const jumpBtn = t.closest("[data-pin-jump]");
		const unpinBtn = t.closest("[data-pin-unpin]") || t.closest("[data-pin-remove]"); // legacy attr
		const key =
		jumpBtn?.getAttribute?.("data-pin-jump") ??
		unpinBtn?.getAttribute?.("data-pin-unpin") ??
		unpinBtn?.getAttribute?.("data-pin-remove") ??
		null;
		if (!key) return;
		
		ev.preventDefault?.();
		ev.stopPropagation?.();
		
		const parsed = parseIdSlotKey(key); // => { id, slot }
		if (!parsed) return;
		const rpId = parsed.id;
		const slot = parsed.slot;
		
		if (unpinBtn) {
			if (store.actions?.unpinRouteProject) {
				store.actions.unpinRouteProject({ rpId, slot });
			} else if (store.actions?.setPins) {
				const pins = Array.isArray(st.view_pins) ? st.view_pins : [];
				const next = pins.filter((p) => !(p?.rpId === rpId && (p?.slot ?? "right") === slot));
				store.actions.setPins(next);
			} else {
				ui?.logInfo?.("unpin: missing store.actions.unpinRouteProject (MS14.2 expected)");
			}
			return;
		}
		
		store.actions?.setActiveRouteProject?.(rpId);
		store.actions?.setActiveSlot?.(slot);
		mirrorQuickHooksFromActive(store);
	}
	
	function wirePropsPanelOnce() {
		if (!propsElement || propsElement.__ufAIM_propsWired) return;
		propsElement.__ufAIM_propsWired = true;
		propsElement.addEventListener("click", handlePropsPanelClick);
	}
	
	// MS13.9: collect background alignments
	function collectAuxAll(state, { activeId }) {
		const out = [];
		for (const [id, art] of Object.entries(state.artifacts ?? {})) {
			if (!art || id === activeId) continue;
			if (art.domain !== "alignment2d") continue;
			const pts = art.payload?.polyline2d;
			if (!Array.isArray(pts) || pts.length < 2) continue;
			out.push({ id, points: pts });
		}
		return out;
	}

	function collectAuxPinned(state, { activeId }) {
		const out = [];
		const pins = normalizePins(state.view_pins);

		const ids = new Set();
		for (const p of pins) {
			const rpId = p?.rpId;
			const slotName = p?.slot;
			if (!rpId || !slotName) continue;
			const rp = state.routeProjects?.[rpId];
			const aId = rp?.slots?.[slotName]?.alignmentArtifactId;
			if (aId) ids.add(aId);
		}

		for (const id of ids) {
			if (!id || id === activeId) continue;
			const art = state.artifacts?.[id];
			if (!art || art.domain !== "alignment2d") continue;
			const pts = art.payload?.polyline2d;
			if (!Array.isArray(pts) || pts.length < 2) continue;
			out.push({ id, points: pts });
		}
		return out;
	}

	function collectAuxRouteProject(state, { activeId }) {
		const out = [];
		const rpId = state.activeRouteProjectId;
		const rp = rpId ? state.routeProjects?.[rpId] : null;
		if (!rp?.slots) return out;

		const ids = new Set();
		for (const slot of Object.values(rp.slots)) {
			const aId = slot?.alignmentArtifactId;
			if (aId) ids.add(aId);
			const other = slot?.otherArtifactIds;
			if (Array.isArray(other)) for (const x of other) ids.add(x);
		}

		for (const id of ids) {
			if (!id || id === activeId) continue;
			const art = state.artifacts?.[id];
			if (!art || art.domain !== "alignment2d") continue;
			const pts = art.payload?.polyline2d;
			if (!Array.isArray(pts) || pts.length < 2) continue;
			out.push({ id, points: pts });
		}
		return out;
	}

	function collectAuxTracks(state) {
		if (!cfg.showAuxTracks) return [];

		const activeId = state.import_activeArtifacts?.alignmentArtifactId ?? null;

		let out = [];
		switch (cfg.auxTracksScope) {
			case "all":
			out = collectAuxAll(state, { activeId });
			break;
			case "pinned":
			out = collectAuxPinned(state, { activeId });
			break;
			case "routeproject":
			case "route_project":
			case "route":
			case "routeprojects":
			out = collectAuxRouteProject(state, { activeId });
			break;
			case "active":
			// "active" here means: don't show anything besides the active track
			out = [];
			break;
			default:
			// default remains routeProject to match existing behavior
			out = collectAuxRouteProject(state, { activeId });
			break;
		}

		// optional: cap (keeps perf + prevents UI clutter)
		const max = cfg.auxTracksMax;
		if (Number.isFinite(max) && max > 0 && out.length > max) out = out.slice(0, max);

		return out;
	}
	
	function computeFitBboxActiveOnly(state, poly) {
		const activeArt = selectors.activeAlignmentArtifact(state);
		return selectors.pickBbox(activeArt, poly);
	}

	function computeFitBboxIncludingAux(state, poly) {
		let bbox = computeFitBboxActiveOnly(state, poly);
		if (!bbox) return null;

		const aux = collectAuxTracks(state);
		for (const t of aux) {
			const b = computeBbox(t.points);
			bbox = unionBbox(bbox, b);
		}
		return bbox;
	}

	// ---- public methods (closures, no globals) ----
	function recenterToActive() {
		const st = store.getState();
		const poly = st.import_polyline2d;
		if (!Array.isArray(poly) || poly.length < 2) return false;

		// const art = getActiveAlignmentArtifact(st);
		const art = selectors.activeAlignmentArtifact(st);
		// const bbox = pickBboxFromArtifactOrPolyline(art, poly);
		const bbox = selectors.pickBbox(art, poly);
		if (!bbox) return false;

		threeA.setOriginFromBbox(bbox);
		return true;
	}

	function fitActive(opts = {}) {
		const st = store.getState();
		const poly = st.import_polyline2d;
		if (!Array.isArray(poly) || poly.length < 2) return false;

		const bbox = (opts.includePins ?? cfg.fitIncludesPins)
		? computeFitBboxIncludingAux(st, poly)
		: computeFitBboxActiveOnly(st, poly);
		if (!bbox) return false;
		
		const padding = Number.isFinite(opts.padding) ? opts.padding : cfg.fitPadding;
		
		threeA.setOriginFromBbox(bbox);
		// threeA.zoomToFitWorldBboxSoft?.(bbox, { padding });
		threeA.zoomToFitWorldBbox?.(bbox, { padding });
		return true;
	}

	// MS13.2: zoom only (no target jump)
	function softFitActive(opts = {}) {
		const st = store.getState();
		const poly = st.import_polyline2d;
		if (!Array.isArray(poly) || poly.length < 2) return false;

		const bbox = (opts.includePins ?? cfg.fitIncludesPins)
		? computeFitBboxIncludingAux(st, poly)
		: computeFitBboxActiveOnly(st, poly);
		if (!bbox) return false;

		// const padding = Number.isFinite(opts.padding) ? opts.padding : defaultFitPadding;
		const padding = Number.isFinite(opts.padding) ? opts.padding : cfg.fitPadding;

		threeA.setOriginFromBbox(bbox);
		// threeA.zoomToFitWorldBboxSoft?.(bbox, { padding });
		threeA.zoomToFitWorldBbox?.(bbox, { padding });
		return true;
	}

	// MS13.2b: zoom only, animated
	function softFitActiveAnimated(opts = {}) {
		const st = store.getState();
		const poly = st.import_polyline2d;
		if (!Array.isArray(poly) || poly.length < 2) return false;

		const bbox = (opts.includePins ?? cfg.fitIncludesPins)
		? computeFitBboxIncludingAux(st, poly)
		: computeFitBboxActiveOnly(st, poly);
		if (!bbox) return false;
		
		const padding = Number.isFinite(opts.padding) ? opts.padding : cfg.fitPadding;
		const durationMs = Number.isFinite(opts.durationMs) ? opts.durationMs : cfg.fitDurationMs;
		
		threeA.setOriginFromBbox(bbox);
		threeA.zoomToFitWorldBboxSoftAnimated?.(bbox, { padding, durationMs });
		return true;
	}

	function setOnGeomChange(mode) {
		const m = String(mode || "").toLowerCase();
		if (["off", "recenter", "fit", "softfit", "softfitanimated"].includes(m)) onGeomChange = m;
	}

	function setAutoFitEnabled(on) {
		autoFitOnGeomChange = Boolean(on);
	}

	function applyGeomChangePolicy() {
		switch (onGeomChange) {
			case "fit":
			fitActive();
			return true;
			case "softfit":
			softFitActive();
			return true;
			case "softfitanimated":
			softFitActiveAnimated();
			return true;
			case "recenter":
			recenterToActive();
			return true;
			default:
			return false; // off
		}
	}
	
	// ------------------------------------------------------------
	// Wiring: Spot panel (importSession list)
	// ------------------------------------------------------------
	function handleSpotPanelClick(ev) {
		const t = ev?.target;
		if (!t || typeof t.closest !== "function") return;
		
		// Decisions: data-spot-key="spotId::slot"
		const decisionBtn = t.closest("[data-spot-decision]");
		if (decisionBtn) {
			const key = decisionBtn.getAttribute("data-spot-key");
			const decRaw = decisionBtn.getAttribute("data-spot-decision"); // "accept" | "defer" | "ignore" | ""
			if (!key) return;
			
			ev.preventDefault?.();
			
			const parsed = parseIdSlotKey(key); // { id: spotId, slot }
			if (!parsed) return;
			
			const decision = decRaw ? decRaw : null;
			if (store.actions?.setSpotDecision) {
				store.actions.setSpotDecision({ spotId: parsed.id, slot: parsed.slot, decision });
			} else {
				ui?.logInfo?.("Spot decision: missing store.actions.setSpotDecision");
			}
			return;
		}
		
		// Activate/Pin: data-spot-activate="rpId::slot" / data-spot-pin="rpId::slot"
		const activate = t.closest("[data-spot-activate]");
		const pin = t.closest("[data-spot-pin]");
		const key =
		activate?.getAttribute("data-spot-activate") ??
		pin?.getAttribute("data-spot-pin") ??
		null;
		if (!key) return;
		
		ev.preventDefault?.();
		
		const parsed = parseIdSlotKey(key); // { id: rpId, slot }
		if (!parsed) return;
		
		if (activate) {
			store.actions?.setActiveRouteProject?.(parsed.id);
			store.actions?.setActiveSlot?.(parsed.slot);
			return;
		}
		
		if (pin) {
			if (store.actions?.togglePinRouteProject) store.actions.togglePinRouteProject({ rpId: parsed.id, slot: parsed.slot });
			else if (store.actions?.togglePinFromActive) {
				store.actions.setActiveRouteProject?.(parsed.id);
				store.actions.setActiveSlot?.(parsed.slot);
				store.actions.togglePinFromActive?.();
			} else {
				ui.logInfo?.("pin: missing action");
			}
		}
	}
	
	function wireSpotPanelOnce() {
		const el = ui.elements?.importSession;
		if (!el || el.__spotWired) return;
		el.__spotWired = true;
		el.addEventListener("click", handleSpotPanelClick);
	}
	
	function renderSpotPanel(state) {
		const spotState = ui.getSpotState?.();
		if (!spotState) {
			ui.setSpotHtml?.(`<div class="spot"><div class="spot__empty">(drop files to create spots)</div></div>`);
			return;
		}
		
		const html = ui.renderSpotState?.({ spotState, storeState: state });
		ui.setSpotHtml?.(html);
	}

	function subscribe() {
		// wiring that depends on constructed closures
		wireTrackClickOnce();
		wirePropsPanelOnce();
		wireSpotPanelOnce();
		
		const handler = (state) => {
			try {
				// A) UI sync
				syncRouteProjectSelect(state);
				syncPropsPanel(state);
				syncCursorInput(state);
				syncOverlays(state);
				syncPinsBadge(state);
				syncSpotPanel(state);
				
				// B) geometry key (active selection)
				const poly = state.import_polyline2d;
				const geomKey = makeActiveGeomKey(state);
				const geomChanged = geomKey !== lastGeomKey;
				lastGeomKey = geomKey;
				
				// C) no active geometry => keep aux, clear main visuals
				if (!isPolylineValid(poly)) {
					cachedCum = null;
					lastPolyRef = null;
					ui.setBoardSectionText?.(renderSectionText(state, null));
					
					syncAuxTracks(state);
					clear3DKeepAux();
					return;
				}
				
				// D) apply geom change policy first (may change origin/fit)
				syncGeometryPolicyIfNeeded(state, poly, geomChanged);
				
				// E) aux tracks after origin changes (prevents “stuck” transforms)
				syncAuxTracks(state);
				
				// F) section sampling + marker/section line + section text
				syncSectionSamplingAndMarker(state, poly);
				
				// G) active track render (WORLD -> LOCAL via adapter)
				syncActiveTrack(poly);
			} catch (err) {
				console.error("[ViewController] handler crashed (isolated):", err);
				ui?.logInfo?.(`❌ ViewController crashed (isolated): ${String(err?.message ?? err)}`);
			}
		};
		
		const unsub = store.subscribe(handler);
		
		// ✅ immediate (Store unterstützt kein {immediate:true})
		handler(store.getState());
		
		return unsub;
	}
	
	return {
		subscribe,

		// MS12.x
		recenterToActive,
		fitActive,

		// MS13.2 / MS13.2b
		softFitActive,
		softFitActiveAnimated,

		// switches
		setAutoFitEnabled,
		setOnGeomChange,
	};
}
