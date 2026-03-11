// app/io/buildImportArtifacts.js
//
// Build import artifacts from one grouped import bucket.
//
// Current goals:
// - legacy TRA/GRA support
// - landFAT alignment support
// - output format-agnostic artifacts for registry/apply/preview
//
// Artifact shape:
// {
//   id,
//   domain,          // alignment2d | profile1d | cant1d | unknown
//   kind,            // TRA | GRA | ALIGNMENT | ...
//   slot,            // right | left | km
//   sourceLabel,     // file / internal name for UI
//   payload,         // domain-specific data
//   meta             // free meta for UI/debug/future use
// }

function ensureObject(x) {
	return (x && typeof x === "object") ? x : {};
}

function uniqueStrings(arr) {
	return Array.from(new Set((arr ?? []).filter(Boolean).map(String)));
}

function buildArtifactId(baseId, slot, domain, kind, ts = Date.now()) {
	return `${baseId}::${slot}::${domain}::${kind}::${ts}`;
}

function unwrapImportObject(x) {
	return x?.importObject ?? x?.data ?? x ?? null;
}

function pickLatestByKind(items, kind) {
	const k = String(kind ?? "").toUpperCase();
	const arr = Array.isArray(items) ? items : [];

	let best = null;
	let bestTs = -Infinity;

	for (const it of arr) {
		if (!it) continue;

		const obj = unwrapImportObject(it);
		const kk = String(obj?.kind ?? it?.kind ?? "").toUpperCase();
		if (kk !== k) continue;

		const ts = Number(it?.ts ?? obj?.ts ?? 0);
		if (!best || ts >= bestTs) {
			best = it;
			bestTs = ts;
		}
	}

	return best;
}

function pickLatestLandFATAlignmentItem(items) {
	const arr = Array.isArray(items) ? items : [];

	let best = null;
	let bestTs = -Infinity;

	for (const it of arr) {
		if (!it) continue;

		const obj = unwrapImportObject(it);
		if (!obj?.landFATAlignment) continue;

		const ts = Number(it?.ts ?? obj?.ts ?? 0);
		if (!best || ts >= bestTs) {
			best = it;
			bestTs = ts;
		}
	}

	return best;
}

function pickPolyline2dFromTRA(traObj) {
	return (
		traObj?.geometry?.pts ??
		traObj?.geometry ??
		traObj?.pts ??
		null
	);
}

function pickProfile1dFromGRA(graObj) {
	return (
		graObj?.profile1d ??
		graObj?.profile ??
		null
	);
}

function pickCant1dFromTRA(traObj) {
	return (
		traObj?.cant ??
		traObj?.cant1d ??
		null
	);
}

function normalizePoint2d(p) {
	if (!p) return null;

	const x = Number(p?.x ?? p?.[0]);
	const y = Number(p?.y ?? p?.[1]);

	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return { x, y };
}

function computeBbox2d(polyline2d) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

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

function bboxCenter2d(bbox) {
	if (!bbox) return null;

	const x = (Number(bbox.minX) + Number(bbox.maxX)) * 0.5;
	const y = (Number(bbox.minY) + Number(bbox.maxY)) * 0.5;

	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return { x, y };
}

function normalizePolyline2d(poly) {
	if (!Array.isArray(poly)) return null;

	const out = poly
		.map(normalizePoint2d)
		.filter(Boolean);

	return out.length >= 2 ? out : null;
}

function sourceLabelFromItem(item) {
	const obj = unwrapImportObject(item);
	const fileName = String(item?.originFileName ?? obj?.meta?.sourceFile ?? obj?.name ?? "").trim() || null;

	const internalName =
		String(
			obj?.meta?.alignmentName ??
			obj?.meta?.axisName ??
			obj?.meta?.alignmentId ??
			obj?.meta?.routeName ??
			obj?.landFATAlignment?.name ??
			obj?.name ??
			""
		).trim() || null;

	if (fileName && internalName && fileName !== internalName) {
		return `${fileName} → ${internalName}`;
	}
	return fileName ?? internalName ?? "—";
}

// -----------------------------------------------------------------------------
// landFAT preview extraction
// -----------------------------------------------------------------------------
//
// NOTE:
// This is intentionally only a V0 preview path.
// It extracts visible anchor points from landFAT CoordGeom.
// Later this should be replaced by:
//   landFAT -> sparse -> sampler -> preview polyline
//

function pickPointFromNamedPoint(p) {
	if (!p) return null;

	const x = Number(p?.x);
	const y = Number(p?.y);

	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return { x, y };
}

function pushPointIfNew(out, p, eps = 1e-9) {
	if (!p) return;
	if (!out.length) {
		out.push(p);
		return;
	}

	const last = out[out.length - 1];
	if (Math.abs(last.x - p.x) <= eps && Math.abs(last.y - p.y) <= eps) return;

	out.push(p);
}

function buildPreviewPolylineFromLandFATAlignment(alignment) {
	const geom = Array.isArray(alignment?.coordGeom) ? alignment.coordGeom : [];
	const out = [];

	for (const seg of geom) {
		const type = String(seg?.type ?? "");

		if (type === "Line") {
			pushPointIfNew(out, pickPointFromNamedPoint(seg.start));
			pushPointIfNew(out, pickPointFromNamedPoint(seg.end));
			continue;
		}

		if (type === "Curve") {
			// V0: only anchor preview, not sampled arc
			pushPointIfNew(out, pickPointFromNamedPoint(seg.start));
			pushPointIfNew(out, pickPointFromNamedPoint(seg.end));
			continue;
		}

		if (type === "Spiral") {
			// V0: only anchor preview, not sampled spiral
			pushPointIfNew(out, pickPointFromNamedPoint(seg.start));
			pushPointIfNew(out, pickPointFromNamedPoint(seg.end));
			continue;
		}
	}

	return out.length >= 2 ? out : null;
}

// -----------------------------------------------------------------------------
// artifact builders
// -----------------------------------------------------------------------------

function buildAlignmentArtifactFromTRA({ baseId, slot, item }) {
	const obj = unwrapImportObject(item);
	const polyline2d = normalizePolyline2d(pickPolyline2dFromTRA(obj));
	if (!polyline2d) return null;

	const bbox = computeBbox2d(polyline2d);

	return {
		id: buildArtifactId(baseId, slot, "alignment2d", String(obj?.kind ?? "TRA").toUpperCase(), item?.ts),
		domain: "alignment2d",
		kind: String(obj?.kind ?? "TRA").toUpperCase(),
		slot,
		sourceLabel: sourceLabelFromItem(item),
		payload: {
			polyline2d,
			bbox,
			bboxCenter: bboxCenter2d(bbox),
		},
		meta: {
			sourceFormat: obj?.meta?.sourceFormat ?? null,
			alignmentName: obj?.meta?.alignmentName ?? null,
			sourceFile: obj?.meta?.sourceFile ?? item?.originFileName ?? null,
			previewMode: "raw-polyline",
		},
	};
}

function buildProfileArtifactFromGRA({ baseId, slot, item }) {
	const obj = unwrapImportObject(item);
	const profile1d = pickProfile1dFromGRA(obj);

	if (!Array.isArray(profile1d) || profile1d.length < 2) return null;

	return {
		id: buildArtifactId(baseId, slot, "profile1d", String(obj?.kind ?? "GRA").toUpperCase(), item?.ts),
		domain: "profile1d",
		kind: String(obj?.kind ?? "GRA").toUpperCase(),
		slot,
		sourceLabel: sourceLabelFromItem(item),
		payload: {
			profile1d,
		},
		meta: {
			sourceFormat: obj?.meta?.sourceFormat ?? null,
			sourceFile: obj?.meta?.sourceFile ?? item?.originFileName ?? null,
		},
	};
}

function buildCantArtifactFromTRA({ baseId, slot, item }) {
	const obj = unwrapImportObject(item);
	const cant1d = pickCant1dFromTRA(obj);

	if (!Array.isArray(cant1d) || cant1d.length < 2) return null;

	return {
		id: buildArtifactId(baseId, slot, "cant1d", String(obj?.kind ?? "TRA").toUpperCase(), item?.ts),
		domain: "cant1d",
		kind: String(obj?.kind ?? "TRA").toUpperCase(),
		slot,
		sourceLabel: sourceLabelFromItem(item),
		payload: {
			cant1d,
		},
		meta: {
			sourceFormat: obj?.meta?.sourceFormat ?? null,
			sourceFile: obj?.meta?.sourceFile ?? item?.originFileName ?? null,
		},
	};
}

function buildAlignmentArtifactFromLandFAT({ baseId, slot, item }) {
	const obj = unwrapImportObject(item);
	const alignment = obj?.landFATAlignment;
	if (!alignment) return null;

	const polyline2d = normalizePolyline2d(buildPreviewPolylineFromLandFATAlignment(alignment));
	if (!polyline2d) return null;

	const bbox = computeBbox2d(polyline2d);

	return {
		id: buildArtifactId(baseId, slot, "alignment2d", "ALIGNMENT", item?.ts),
		domain: "alignment2d",
		kind: "ALIGNMENT",
		slot,
		sourceLabel: sourceLabelFromItem(item),
		payload: {
			polyline2d,
			bbox,
			bboxCenter: bboxCenter2d(bbox),

			// keep the rich source for the later normalizer path
			landFATAlignment: alignment,
		},
		meta: {
			sourceFormat: obj?.meta?.sourceFormat ?? "landXML",
			alignmentName: alignment?.name ?? obj?.meta?.alignmentName ?? null,
			sourceFile: obj?.meta?.sourceFile ?? item?.originFileName ?? null,
			previewMode: "landfat-anchor-preview",
		},
	};
}

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------

export function buildArtifactsFromGroup(group, opts = {}) {
	const g = ensureObject(group);
	const baseId = String(g.groupKey ?? "");
	const slot = (opts?.slotHint === "left" || opts?.slotHint === "km" || opts?.slotHint === "right")
		? opts.slotHint
		: (g.slot_user ?? g.slot_attachHint ?? "right");

	const items = Array.isArray(g.items) ? g.items : [];
	const out = [];

	// legacy TRA/GRA path
	const traItem = g.tra ?? pickLatestByKind(items, "TRA");
	const graItem = g.gra ?? pickLatestByKind(items, "GRA");

	const aTra = traItem ? buildAlignmentArtifactFromTRA({ baseId, slot, item: traItem }) : null;
	if (aTra) out.push(aTra);

	const pGra = graItem ? buildProfileArtifactFromGRA({ baseId, slot, item: graItem }) : null;
	if (pGra) out.push(pGra);

	const cTra = traItem ? buildCantArtifactFromTRA({ baseId, slot, item: traItem }) : null;
	if (cTra) out.push(cTra);

	// landFAT path
	const fatItem = pickLatestLandFATAlignmentItem(items);
	const aFat = fatItem ? buildAlignmentArtifactFromLandFAT({ baseId, slot, item: fatItem }) : null;

	// prefer explicit landFAT alignment artifact only if there is no TRA alignment,
	// or keep both if you later want comparison/debug. For now: one visible alignment only.
	if (aFat && !aTra) {
		out.push(aFat);
	}

	// fallback unknown artifact if nothing useful could be built
	if (!out.length && items.length) {
		const labels = uniqueStrings(items.map(sourceLabelFromItem));

		out.push({
			id: buildArtifactId(baseId, slot, "unknown", "UNKNOWN"),
			domain: "unknown",
			kind: "UNKNOWN",
			slot,
			sourceLabel: labels.join(" · ") || "—",
			payload: {},
			meta: {
				reason: "no-known-artifacts-built",
			},
		});
	}

	return out;
}
