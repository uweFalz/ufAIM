// app/io/import/buildImportArtifacts.js

/**
* @baustelle [PREVIEW-CONTRACT]
* Alignment preview now uses the unified sparse-based preview path:
*   sparseAlignment -> poseA-polyline -> alignment2d artifact
*
* @baustelle [ARCH]
* Format-specific extraction should continue to move out of this module.
* This builder should only assemble artifacts from normalized inputs.
*
* @baustelle [GROUP-REBUILD]
* This builder is currently called on full grouped buckets, not on per-item deltas.
* Therefore artifacts must be deduplicated per domain/source to avoid repeated
* emission of already known alignment/profile/cant previews on embedded updates.
*
* @baustelle [GROUP-CONTRACT]
* Aktuell wird pro Gruppe höchstens ein alignment2d-Artifact gebaut
* ("latest sparse item wins").
* Falls Gruppen künftig mehrere gleichberechtigte Alignment-Kandidaten tragen,
* muss diese Datei auf multi-alignment pro Gruppe umgestellt werden.
*/

import { buildAlignmentPreviewArtifact } from "./preview/buildAlignmentPreviewArtifact.js";

// -----------------------------------------------------------------------------
// basics
// -----------------------------------------------------------------------------

function ensureObject(x) {
	return x && typeof x === "object" ? x : {};
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

// -----------------------------------------------------------------------------
// normalized access helpers
// -----------------------------------------------------------------------------

function getSparseAlignmentFromItem(item) {
	const obj = unwrapImportObject(item);
	return obj?.sparseAlignment ?? obj?.payload?.sparseAlignment ?? null;
}

// -----------------------------------------------------------------------------
// latest pick helpers
// -----------------------------------------------------------------------------

function pickLatestByPredicate(items, predicate) {
	const arr = Array.isArray(items) ? items : [];

	let best = null;
	let bestTs = -Infinity;

	for (const it of arr) {
		if (!it) continue;

		const obj = unwrapImportObject(it);
		if (!predicate(it, obj)) continue;

		const ts = Number(it?.ts ?? obj?.ts ?? 0);
		if (!best || ts >= bestTs) {
			best = it;
			bestTs = ts;
		}
	}

	return best;
}

function pickLatestSparseAlignmentItem(items) {
	return pickLatestByPredicate(items, (it) => {
		return !!getSparseAlignmentFromItem(it);
	});
}

function pickLatestProfileItem(items) {
	return pickLatestByPredicate(items, (it, obj) => {
		const kind = String(obj?.kind ?? it?.kind ?? "").toUpperCase();

		if (kind === "LANDFATPROFILE") return true;
		if (kind === "GRA") return true;
		if (Array.isArray(obj?.profile1d) && obj.profile1d.length >= 2) return true;
		if (Array.isArray(obj?.points) && obj.points.length >= 2) return true;

		return false;
	});
}

function pickLatestCantItem(items) {
	return pickLatestByPredicate(items, (it, obj) => {
		const kind = String(obj?.kind ?? it?.kind ?? "").toUpperCase();

		if (kind === "LANDFATCANT") return true;
		if (kind === "CANT") return true;
		if (kind === "TRA") return true;
		if (Array.isArray(obj?.cant1d) && obj.cant1d.length >= 2) return true;
		if (Array.isArray(obj?.cant) && obj.cant.length >= 2) return true;
		if (Array.isArray(obj?.points) && obj.points.length >= 2) return true;

		return false;
	});
}

// -----------------------------------------------------------------------------
// domain readers
// -----------------------------------------------------------------------------

function pickProfile1dFromObject(obj) {
	if (Array.isArray(obj?.profile1d)) return obj.profile1d;
	if (Array.isArray(obj?.profile)) return obj.profile;

	if (Array.isArray(obj?.points)) {
		return obj.points.map((x) => ({
			s: x?.station ?? null,
			z: x?.elevation ?? null,
			R: x?.radius ?? null,
			T: x?.tangentLength ?? null,
			pointNumber: x?.pointNumber ?? null,
			pointKey: x?.pointKey ?? null,
		}));
	}

	return null;
}

function pickCant1dFromObject(obj) {
	if (Array.isArray(obj?.cant1d)) return obj.cant1d;
	if (Array.isArray(obj?.cant)) return obj.cant;
	if (Array.isArray(obj?.points)) return obj.points;
	return null;
}

// -----------------------------------------------------------------------------
// labels / kinds
// -----------------------------------------------------------------------------

function sourceLabelFromItem(item) {
	const obj = unwrapImportObject(item);

	const fileName = String(
	item?.originFileName ??
	obj?.meta?.sourceFile ??
	obj?.source?.file ??
	obj?.name ??
	""
	).trim() || null;

	const internalName = String(
	obj?.meta?.alignmentName ??
	obj?.meta?.axisName ??
	obj?.meta?.alignmentId ??
	obj?.meta?.routeName ??
	obj?.name ??
	""
	).trim() || null;

	if (fileName && internalName && fileName !== internalName) {
		return `${fileName} → ${internalName}`;
	}

	return fileName ?? internalName ?? "—";
}

function resolveArtifactKind(item, obj, fallback = "UNKNOWN") {
	return String(
	item?.source?.format ??
	obj?.source?.format ??
	obj?.meta?.sourceFormat ??
	obj?.meta?.format ??
	obj?.kind ??
	fallback
	).toUpperCase();
}

// -----------------------------------------------------------------------------
// artifact builders
// -----------------------------------------------------------------------------

function buildAlignmentArtifact({ baseId, slot, item }) {
	const sparseAlignment = getSparseAlignmentFromItem(item);
	if (!sparseAlignment) return null;

	const obj = unwrapImportObject(item);
	const kind = resolveArtifactKind(item, obj, "ALIGNMENT");

	return buildAlignmentPreviewArtifact({
		baseId,
		slot,
		item,
		kind,
	});
}

function buildProfileArtifact({ baseId, slot, item }) {
	const obj = unwrapImportObject(item);
	const profile1d = pickProfile1dFromObject(obj);

	if (!Array.isArray(profile1d) || profile1d.length < 2) return null;

	const kind = resolveArtifactKind(item, obj, "GRA");

	return {
		id: buildArtifactId(baseId, slot, "profile1d", kind, item?.ts),
		domain: "profile1d",
		kind,
		slot,
		sourceLabel: sourceLabelFromItem(item),
		payload: { profile1d },
		meta: {
			sourceFormat: kind,
			sourceFile: obj?.meta?.sourceFile ?? item?.originFileName ?? null,
		},
	};
}

function buildCantArtifact({ baseId, slot, item }) {
	const obj = unwrapImportObject(item);
	const cant1d = pickCant1dFromObject(obj);

	if (!Array.isArray(cant1d) || cant1d.length < 2) return null;

	const kind = resolveArtifactKind(item, obj, "CANT");

	return {
		id: buildArtifactId(baseId, slot, "cant1d", kind, item?.ts),
		domain: "cant1d",
		kind,
		slot,
		sourceLabel: sourceLabelFromItem(item),
		payload: { cant1d },
		meta: {
			sourceFormat: kind,
			sourceFile: obj?.meta?.sourceFile ?? item?.originFileName ?? null,
		},
	};
}

// -----------------------------------------------------------------------------
// dedupe
// -----------------------------------------------------------------------------

function dedupeArtifacts(artifacts) {
	const out = [];
	const seen = new Set();

	for (const art of artifacts ?? []) {
		if (!art) continue;

		const key = [
		art.domain ?? "unknown",
		art.kind ?? "UNKNOWN",
		art.slot ?? "right",
		art.sourceLabel ?? "—",
		].join("::");

		if (seen.has(key)) continue;
		seen.add(key);
		out.push(art);
	}

	return out;
}

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------

export function buildArtifactsFromGroup(group, opts = {}) {
	const g = ensureObject(group);
	const baseId = String(g.groupKey ?? "");

	const slot =
	opts?.slotHint === "left" || opts?.slotHint === "km" || opts?.slotHint === "right"
	? opts.slotHint
	: (g.slot_user ?? g.slot_attachHint ?? "right");

	const items = Array.isArray(g.items) ? g.items : [];
	const out = [];

	const sparseItem = pickLatestSparseAlignmentItem(items);
	const profileItem = pickLatestProfileItem(items);
	const cantItem = pickLatestCantItem(items);

	const aPreview = sparseItem
	? buildAlignmentArtifact({ baseId, slot, item: sparseItem })
	: null;

	const pPreview = profileItem
	? buildProfileArtifact({ baseId, slot, item: profileItem })
	: null;

	const cPreview = cantItem
	? buildCantArtifact({ baseId, slot, item: cantItem })
	: null;

	if (aPreview) out.push(aPreview);
	if (pPreview) out.push(pPreview);
	if (cPreview) out.push(cPreview);

	const deduped = dedupeArtifacts(out);

	if (sparseItem && !aPreview) {
		console.warn("[buildArtifactsFromGroup] sparse item found but no alignment preview", {
			baseId,
			slot,
			itemCount: items.length,
			sparseItemName:
			sparseItem?.name ??
			unwrapImportObject(sparseItem)?.name ??
			null,
			sparseAlignment: getSparseAlignmentFromItem(sparseItem),
		});
	}

	if (!deduped.length && items.length) {
		console.warn("[buildArtifactsFromGroup] fallback unknown", {
			baseId,
			slot,
			itemCount: items.length,
			hasSparseItem: !!sparseItem,
			hasProfileItem: !!profileItem,
			hasCantItem: !!cantItem,
			sparseItemName:
			sparseItem?.name ??
			unwrapImportObject(sparseItem)?.name ??
			null,
		});

		const labels = uniqueStrings(items.map(sourceLabelFromItem));

		deduped.push({
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

	return deduped;
}
