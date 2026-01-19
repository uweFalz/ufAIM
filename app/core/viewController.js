// app/core/viewController.js
//
// ViewController (UI/Render glue):
// - owns store.subscribe for "store -> UI + 3D"
// - computes sectionInfo from import_polyline2d + cursor.s
// - updates overlays (bands/section text)
// - updates three viewer via ThreeAdapter (floating origin)
// - detects "active geometry changed" and re-centers/zoom-to-fit

function clampNumber(value, min, max) {
	const v = Number(value);
	if (!Number.isFinite(v)) return min;
	return Math.max(min, Math.min(max, v));
}

function formatNum(v, digits = 3) {
	return Number.isFinite(v) ? v.toFixed(digits) : "—";
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
		// deterministisch, exakt das was wir rendern wollen
		return `${aa.baseId ?? ""}::${aa.slot ?? ""}::${aa.alignmentArtifactId ?? ""}`;
	}

	// Fallback (sollte nur in Übergangsphasen passieren)
	const rpId = state.activeRouteProjectId ?? "";
	const slot = state.activeSlot ?? "right";
	return `${rpId}::${slot}::(no-activeArtifacts)`;
}

// ...
export function makeViewController({ store, ui, threeA, propsElement, prefs } = {}) {
	if (!store?.getState || !store?.subscribe) throw new Error("ViewController: missing store");
	if (!ui) throw new Error("ViewController: missing ui");
	if (!threeA) throw new Error("ViewController: missing three adapter");

	let cachedCum = null;
	let lastGeomKey = null;

	// --- helpers ------------------------------------------------

	function getActiveAlignmentArtifact(state) {
		const aa = state?.import_activeArtifacts;
		const id = aa?.alignmentArtifactId;
		if (!id) return null;
		return state?.artifacts?.[id] ?? null;
	}

	function extractBboxFromAlignmentArtifact(art) {
		// support both shapes:
		// A) payload.bbox = {minX,minY,maxX,maxY}
		// B) payload.bbox = { bbox: {minX,...} }   (your "box patch")
		const p = art?.payload;
		const b = p?.bbox;

		const bbox =
			(b && b.bbox) ? b.bbox :
			(b ?? null);

		if (!bbox) return null;

		const minX = Number(bbox.minX);
		const minY = Number(bbox.minY);
		const maxX = Number(bbox.maxX);
		const maxY = Number(bbox.maxY);

		if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
		return { minX, minY, maxX, maxY };
	}

	function fitToBboxENU(bbox) {
		if (!bbox) return false;
		threeA.setOriginFromBbox?.(bbox);
		threeA.zoomToFitWorldBbox?.(bbox, { padding: 1.35 });
		return true;
	}

	// --- props --------------------------------------------------

	function updateProps(state) {
		if (!propsElement) return;

		propsElement.textContent = JSON.stringify(
			{
				activeRouteProjectId: state.activeRouteProjectId ?? null,
				activeSlot: state.activeSlot ?? "right",
				cursor: state.cursor ?? {},
				import_meta: state.import_meta ?? null,

				import_activeArtifacts: state.import_activeArtifacts ?? null,

				hasAlignment: Array.isArray(state.import_polyline2d) && state.import_polyline2d.length >= 2,
				hasProfile: Array.isArray(state.import_profile1d) && state.import_profile1d.length >= 2,
				hasCant: Array.isArray(state.import_cant1d) && state.import_cant1d.length >= 2,
			},
			null,
			2
		);
	}

	function clear3D() {
		threeA.clearTrack?.();
		threeA.clearMarker?.();
		threeA.clearSectionLine?.();
	}

	// --- PUBLIC: Fit button action ------------------------------

	function fitActive() {
		const state = store.getState();

		// 1) deterministisch: activeArtifacts -> alignmentArtifact
		const art = getActiveAlignmentArtifact(state);
		if (!art) {
			ui.logInfo?.("fitActive: no active alignment artifact");
			return false;
		}

		// 2) bbox aus Artifact
		const bbox = extractBboxFromAlignmentArtifact(art);
		if (!bbox) {
			ui.logInfo?.(`fitActive: missing bbox for ${art.id ?? "(no-id)"}`);
			return false;
		}

		// 3) origin + fit
		const ok = fitToBboxENU(bbox);
		if (!ok) ui.logInfo?.("fitActive: bbox invalid");
		return ok;
	}

	// --- subscribe ---------------------------------------------

	function subscribe() {
		return store.subscribe((state) => {
			// 0) RP select options
			const ids = Object.keys(state.routeProjects ?? {}).sort((a, b) => a.localeCompare(b));
			ui.setRouteProjectOptions(ids, state.activeRouteProjectId);

			// 1) props
			updateProps(state);

			// 2) overlays
			ui.setBoardBandsText(renderBandsText(state));

			const poly = state.import_polyline2d;
			const geomKey = makeActiveGeomKey(state);
			const geomChanged = geomKey !== lastGeomKey;
			lastGeomKey = geomKey;

			if (!Array.isArray(poly) || poly.length < 2) {
				cachedCum = null;
				ui.setBoardSectionText(renderSectionText(state, null));
				clear3D();
				return;
			}

			// 3) recenter + zoom on active geometry change
			if (geomChanged) {
				// Prefer bbox from active artifact if present (more stable than recomputing)
				const art = getActiveAlignmentArtifact(state);
				const bboxFromArt = extractBboxFromAlignmentArtifact(art);

				if (bboxFromArt) {
					fitToBboxENU(bboxFromArt);
				} else {
					// fallback: compute bbox from polyline
					const bbox = computeBbox(poly);
					if (bbox) fitToBboxENU(bbox);
				}
				cachedCum = null;
			}

			// 4) section sampling
			if (!cachedCum || cachedCum.length !== poly.length) {
				cachedCum = computeChainage(poly);
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

	return { subscribe, fitActive };
}

