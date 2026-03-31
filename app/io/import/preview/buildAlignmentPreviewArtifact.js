// app/io/import/preview/buildAlignmentPreviewArtifact.js
//
// Build alignment preview artifact from sparseAlignment.
//
// Current preview mode:
//   poseA-polyline
//
// Input:
//   { baseId, slot, item, kind? }
//
// Expects:
//   unwrapImportObject(item) -> object with sparseAlignment
//
// Output:
//   artifact(domain="alignment2d") | null
//
// No parser logic here.
// No format mapping here.
// No AlignmentFactory here.
//
// @baustelle [PREVIEW-CONTRACT]
// V1 preview is poseA-polyline only.
// Later versions may use sampled geometry from AlignmentFactory / Projection.
//

import { validateAlignmentPreviewArtifact } from "./validateAlignmentPreviewArtifact.js";

function unwrapImportObject(x) {
	return x?.importObject ?? x?.data ?? x ?? null;
}

function buildArtifactId(baseId, slot, domain, kind, ts = Date.now()) {
	return `${baseId}::${slot}::${domain}::${kind}::${ts}`;
}

function normalizePoint2d(p) {
	if (!p) return null;

	const x = Number(p?.x ?? p?.[0]);
	const y = Number(p?.y ?? p?.[1]);

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

function computeBbox2d(polyline2d) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const p of polyline2d ?? []) {
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

function sourceLabelFromItem(item) {
	const obj = unwrapImportObject(item);
	const fileName = String(item?.originFileName ?? obj?.meta?.sourceFile ?? obj?.name ?? "").trim() || null;

	const internalName =
		String(
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

function resolveArtifactKind(item, obj, fallback = "ALIGNMENT") {
	return String(
		item?.source?.format ??
		obj?.source?.format ??
		obj?.meta?.sourceFormat ??
		obj?.meta?.format ??
		obj?.kind ??
		fallback
	).toUpperCase();
}

function buildPoseAPolylineFromSparse(sparseAlignment) {
	const elements = Array.isArray(sparseAlignment?.sparse) ? sparseAlignment.sparse : [];
	const out = [];

	for (const [i, el] of elements.entries()) {
		const rawPose = el?.poseA ?? null;
		const p = normalizePoint2d(rawPose?.p);
		if (!p) {
			console.warn("[buildAlignmentPreviewArtifact] bad poseA point", {
				index: i,
				poseA: rawPose,
				elementType: el?.type ?? null,
			});
		}
		pushPointIfNew(out, p);
	}

	return out.length >= 2 ? out : null;
}

export function buildAlignmentPreviewArtifact({
	baseId,
	slot,
	item,
	kind = null,
} = {}) {
	const obj = unwrapImportObject(item);
	const sparseAlignment =
		obj?.sparseAlignment ??
		obj?.payload?.sparseAlignment ??
		null;

	// @baustelle [DEBUG]
	// Null-return is currently silent.
	// Later optional diagnostics/log hook may be useful for preview build failures.
	if (!sparseAlignment) return null;

	const polyline2d = buildPoseAPolylineFromSparse(sparseAlignment);
	if (!polyline2d) return null;

	const artifactKind = kind ?? resolveArtifactKind(item, obj, "ALIGNMENT");
	const bbox = computeBbox2d(polyline2d);

	const art = {
		id: buildArtifactId(baseId, slot, "alignment2d", artifactKind, item?.ts),
		domain: "alignment2d",
		kind: artifactKind,
		slot,
		sourceLabel: sourceLabelFromItem(item),
		payload: {
			polyline2d,
			bbox,
			bboxCenter: bboxCenter2d(bbox),
		},
		meta: {
			sourceFormat: artifactKind,
			sourceFile: obj?.meta?.sourceFile ?? item?.originFileName ?? null,
			alignmentName: obj?.meta?.alignmentName ?? obj?.name ?? null,
			previewMode: "poseA-polyline",
		},
	};

	validateAlignmentPreviewArtifact(art);
	return art;
}
