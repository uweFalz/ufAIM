// app/io/import/preview/buildAlignmentPreviewArtifact.js
//
// Build alignment preview artifact from sparseAlignment.
//
// Canonical preview mode:
//   sparseAlignment -> AlignmentProjectionService -> sampled polyline2d
//
// No parser logic here.
// No format mapping here.
// No legacy poseA-only preview path here.

import { projectAlignmentPreview } from "@src/projection/AlignmentProjectionService.js";
import { validateAlignmentPreviewArtifact } from "./validateAlignmentPreviewArtifact.js";

function unwrapImportObject(x) {
	return x?.importObject ?? x?.data ?? x ?? null;
}

function buildArtifactId(baseId, slot, domain, kind, ts = Date.now()) {
	return `${baseId}::${slot}::${domain}::${kind}::${ts}`;
}

function sourceLabelFromItem(item) {
	const obj = unwrapImportObject(item);
	const fileName =
		String(item?.originFileName ?? obj?.meta?.sourceFile ?? obj?.name ?? "").trim() || null;

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

	if (!sparseAlignment) return null;

	const projected = projectAlignmentPreview({
		sparseAlignment,
		maxStep: 5,
	});

	if (!projected?.polyline2d?.length) return null;

	const artifactKind = kind ?? resolveArtifactKind(item, obj, "ALIGNMENT");

	const art = {
		id: buildArtifactId(baseId, slot, "alignment2d", artifactKind, item?.ts),
		domain: "alignment2d",
		kind: artifactKind,
		slot,
		sourceLabel: sourceLabelFromItem(item),
		payload: {
			polyline2d: projected.polyline2d,
			bbox: projected.bbox,
			bboxCenter: projected.bboxCenter,
		},
		meta: {
			sourceFormat: artifactKind,
			sourceFile: obj?.meta?.sourceFile ?? item?.originFileName ?? null,
			alignmentName: obj?.meta?.alignmentName ?? obj?.name ?? null,
			previewMode: "sampled-sparse",
		},
	};

	validateAlignmentPreviewArtifact(art);
	return art;
}
