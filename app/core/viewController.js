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

import { mirrorQuickHooksFromActive } from "../io/importApply.js";

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

export function makeViewController({ store, ui, threeA, propsElement, prefs } = {}) {
	if (!store?.getState || !store?.subscribe) throw new Error("ViewController: missing store");
	if (!ui) throw new Error("ViewController: missing ui");
	if (!threeA) throw new Error("ViewController: missing three adapter");

	const defaultFitPadding = Number.isFinite(prefs?.view?.fitPadding) ? prefs.view.fitPadding : 1.35;
	const defaultFitDurationMs = Number.isFinite(prefs?.view?.fitDurationMs) ? prefs.view.fitDurationMs : 240;
	const defaultFitIncludesPins = (prefs?.view?.fitIncludesPins !== undefined)
		? Boolean(prefs.view.fitIncludesPins)
		: true;
	const showAuxTracks = (prefs?.view?.showAuxTracks !== undefined)
		? Boolean(prefs.view.showAuxTracks)
		: true;
	const auxTracksScope = String(prefs?.view?.auxTracksScope ?? "routeProject").toLowerCase();

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

	// MS13.5: click-to-chainage (track pick) -> cursor.s
	function setCursorS(s, opts = {}) {
		const ss = Number(s);
		if (!Number.isFinite(ss)) return false;

		if (store.actions?.setCursor) {
			store.actions.setCursor({ s: ss });
		} else {
			const prev = store.getState();
			store.setState({ ...prev, cursor: { ...(prev.cursor ?? {}), s: ss } });
		}

		if (opts.fit === true) {
			// shift-click convenience
			fitActive({ mode: "softFit" });
		}
		return true;
	}

	// Install pick handler once (if supported by adapter/viewer)
	threeA.onTrackClick?.(({ s, event }) => {
		if (!setCursorS(s)) return;
		// Convenience: Shift+click gives a gentle animated zoom without target jump.
		if (event?.shiftKey) softFitActiveAnimated({ durationMs: prefs?.view?.fitDurationMs ?? 240 });
	});
	function getActiveAlignmentArtifact(state) {
		const aa = state.import_activeArtifacts;
		if (!aa?.alignmentArtifactId) return null;
		return state.artifacts?.[aa.alignmentArtifactId] ?? null;
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
			<div class="propsJson"><pre>${escapeHtml(json)}</pre></div>
		`;
	}

	function clear3D() {
		threeA.clearTrack?.();
		threeA.clearAuxTracks?.();
		threeA.clearMarker?.();
		threeA.clearSectionLine?.();
	}

	// ------------------------------------------------------------
	// MS13.12b: interactive pin list in props panel
	// ------------------------------------------------------------
	function parsePinKey(key) {
		const parts = String(key ?? "").split("::");
		if (parts.length < 2) return null;
		const slot = parts.pop();
		const rpId = parts.join("::");
		if (!rpId || !slot) return null;
		return { rpId, slot };
	}

	function wirePropsPins() {
		if (!propsElement || propsElement.__ufAIM_pinsWired) return;
		propsElement.__ufAIM_pinsWired = true;

		propsElement.addEventListener("click", (ev) => {
			const t = ev?.target;
			if (!t || typeof t.closest !== "function") return;

			const jumpBtn = t.closest("[data-pin-jump]");
			const unpinBtn = t.closest("[data-pin-unpin]") || t.closest("[data-pin-remove]"); // legacy attr
			const key =
				jumpBtn?.getAttribute?.("data-pin-jump") ??
				unpinBtn?.getAttribute?.("data-pin-unpin") ??
				unpinBtn?.getAttribute?.("data-pin-remove") ??
				null;
			if (!key) return;
			ev.preventDefault?.();

			if (unpinBtn) {
				const st = store.getState?.() ?? {};
				const pins = normalizePins(st.view_pins);
				const parsed = parsePinKey(key);
				if (!parsed) return;
				const next = pins.filter(p => !(p.rpId === parsed.rpId && p.slot === parsed.slot));
				store.setState?.({ view_pins: next });
				return;
			}

			const parsed = parsePinKey(key);
			if (!parsed) return;

			store.actions?.setActiveRouteProject?.(parsed.rpId);
			store.actions?.setActiveSlot?.(parsed.slot);
			mirrorQuickHooksFromActive(store);
		});
	}

	// do it once
	wirePropsPins();

	// MS13.9: collect background alignments
	function collectAuxTracks(state) {
		if (!showAuxTracks) return [];

		const activeId = state.import_activeArtifacts?.alignmentArtifactId ?? null;
		const out = [];

		// Scope: "routeProject" (default) or "all"
		if (auxTracksScope === "all") {
			for (const [id, art] of Object.entries(state.artifacts ?? {})) {
				if (!art || id === activeId) continue;
				if (art.domain !== "alignment2d") continue;
				const pts = art.payload?.polyline2d;
				if (!Array.isArray(pts) || pts.length < 2) continue;
				out.push({ id, points: pts });
			}
			return out;
		}

		// pinned scope (MS13.12)
		if (auxTracksScope === "pinned") {
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

		// routeProject scope
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

	function computeFitBboxFromState(state, poly, opts = {}) {
		const includePins = (opts.includePins !== undefined)
			? Boolean(opts.includePins)
			: defaultFitIncludesPins;

		const activeArt = getActiveAlignmentArtifact(state);
		let bbox = pickBboxFromArtifactOrPolyline(activeArt, poly);

		if (includePins) {
			const aux = collectAuxTracks(state);
			for (const t of aux) {
				const b = computeBbox(t.points);
				bbox = unionBbox(bbox, b);
			}
		}
		return bbox;
	}

	// ---- public methods (closures, no globals) ----
	function recenterToActive() {
		const st = store.getState();
		const poly = st.import_polyline2d;
		if (!Array.isArray(poly) || poly.length < 2) return false;

		const art = getActiveAlignmentArtifact(st);
		const bbox = pickBboxFromArtifactOrPolyline(art, poly);
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

		const padding = Number.isFinite(opts.padding) ? opts.padding : defaultFitPadding;

		threeA.setOriginFromBbox(bbox);
		threeA.zoomToFitWorldBbox?.(bbox, { padding });
		return true;
	}

	// MS13.2: zoom only (no target jump)
	function softFitActive(opts = {}) {
		const st = store.getState();
		const poly = st.import_polyline2d;
		if (!Array.isArray(poly) || poly.length < 2) return false;

		const bbox = computeFitBboxFromState(st, poly, opts);
		if (!bbox) return false;

		const padding = Number.isFinite(opts.padding) ? opts.padding : defaultFitPadding;

		threeA.setOriginFromBbox(bbox);
		threeA.zoomToFitWorldBboxSoft?.(bbox, { padding });
		return true;
	}

	// MS13.2b: zoom only, animated
	function softFitActiveAnimated(opts = {}) {
		const st = store.getState();
		const poly = st.import_polyline2d;
		if (!Array.isArray(poly) || poly.length < 2) return false;

		const bbox = computeFitBboxFromState(st, poly, opts);
		if (!bbox) return false;

		const padding = Number.isFinite(opts.padding) ? opts.padding : defaultFitPadding;
		const durationMs = Number.isFinite(opts.durationMs) ? opts.durationMs : defaultFitDurationMs;

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

	function subscribe() {
		return store.subscribe((state) => {
			// 0) RP select options
			const ids = Object.keys(state.routeProjects ?? {}).sort((a, b) => a.localeCompare(b));
			ui.setRouteProjectOptions(ids, state.activeRouteProjectId);

			// 1) props
			updateProps(state);

			// MS13.8: keep cursor input in sync with state (but don't fight while user edits)
			const cursorEl = ui.elements?.cursorSInput;
			if (cursorEl && document.activeElement !== cursorEl) {
				ui.setCursorSInputValue?.(state.cursor?.s ?? 0);
			}

			// 2) overlays
			ui.setBoardBandsText(renderBandsText(state));

			// MS13.14a: pin counter in topbar
			const pinsNow = normalizePins(state.view_pins);
			ui.setPinsInfoText?.(`Pins: ${pinsNow.length}`);

			const poly = state.import_polyline2d;
			const geomKey = makeActiveGeomKey(state);
			const geomChanged = geomKey !== lastGeomKey;
			lastGeomKey = geomKey;

			if (!Array.isArray(poly) || poly.length < 2) {
				// Pinned tracks should stay visible even if no active geometry is selected.
				threeA.setAuxTracksFromWorldPolylines?.(collectAuxTracks(state));

				cachedCum = null;
				lastPolyRef = null;
				ui.setBoardSectionText(renderSectionText(state, null));
				clear3D();
				return;
			}

			// 3) geom change policy (MS13.1/13.2/13.2b)
			if (geomChanged) {
				cachedCum = null;
				lastPolyRef = null;

				applyGeomChangePolicy();

				// legacy toggle (optional)
				if (autoFitOnGeomChange) {
					const art = getActiveAlignmentArtifact(state);
					const bbox = pickBboxFromArtifactOrPolyline(art, poly);
					if (bbox) {
						threeA.setOriginFromBbox(bbox);
						threeA.zoomToFitWorldBbox?.(bbox, { padding: defaultFitPadding });
					}
				}
			}

			// MS13.15a: render pinned background tracks AFTER any origin/fit change
			// (otherwise they may be transformed with the previous origin and look “stuck”)
			threeA.setAuxTracksFromWorldPolylines?.(collectAuxTracks(state));

			// 4) section sampling
			if (!cachedCum || lastPolyRef !== poly) {
				cachedCum = computeChainage(poly);
				lastPolyRef = poly;
			}

			const cursorS = Number(state.cursor?.s ?? 0);
			const sectionInfo = samplePointAndTangent(poly, cachedCum, cursorS);

			if (sectionInfo) {
				threeA.setMarkerFromWorld?.({ x: sectionInfo.x, y: sectionInfo.y, z: 0 });

				const line = makeSectionLine(sectionInfo, 30);
				threeA.setSectionLineFromWorld?.(line.p0, line.p1);
			} else {
				threeA.clearMarker?.();
				threeA.clearSectionLine?.();
			}

			ui.setBoardSectionText(renderSectionText(state, sectionInfo));

			// 5) track render (WORLD -> LOCAL via adapter)
			threeA.setTrackFromWorldPolyline(poly);
		}, { immediate: true });
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
