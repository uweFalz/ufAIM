// app/io/apply/importPreviewApply.js
//
// Import preview quickhook mirror.
//
// Reads active RP/slot + artifacts and derives lightweight preview hooks.
//
// deliberately NO:
// - registry mutation
// - parser logic
// - format logic
// - projection generation
//
// note:
// this is a temporary state-mirror helper.
// later this should move toward controller/view projection sync.

import { ensureImportStoreShape } from "./importStoreShape.js";

function pickMarkerFromPolyline(polyline2d) {
	if (!Array.isArray(polyline2d) || polyline2d.length < 1) return null;
	return polyline2d[0];
}

function collectImportTracks2d(artifacts, activeId = null) {
	const out = [];

	for (const [id, art] of Object.entries(artifacts ?? {})) {
		if (!art || art.domain !== "alignment2d") continue;

		const pts = art?.payload?.polyline2d ?? null;
		if (!Array.isArray(pts) || pts.length < 2) continue;

		out.push({
			id,
			name: art?.name ?? art?.payload?.name ?? id,
			points: pts,
			isActive: id === activeId,
			sourceFormat: art?.meta?.sourceFormat ?? art?.source?.format ?? null,
			sourceFile: art?.meta?.sourceFile ?? art?.source?.file ?? null,
		});
	}

	return out;
}

export function getActiveArtifactIds(state) {
	const s = ensureImportStoreShape(state);

	const baseId = s.activeRouteProjectId;
	if (!baseId) return null;

	const rp = s.routeProjects?.[baseId];
	if (!rp) return null;

	const slot = s.activeSlot ?? "right";
	const slotObj = rp.slots?.[slot] ?? null;

	return {
		baseId,
		slot,
		alignmentArtifactId: slotObj?.alignmentArtifactId ?? null,
		profileArtifactId: slotObj?.profileArtifactId ?? null,
		cantArtifactId: slotObj?.cantArtifactId ?? null,
	};
}

export function applyImportPreview(state) {
	const s = ensureImportStoreShape(state);
	const active = getActiveArtifactIds(s);

	const alignmentArtifactId = active?.alignmentArtifactId ?? null;
	const profileArtifactId = active?.profileArtifactId ?? null;
	const cantArtifactId = active?.cantArtifactId ?? null;

	const a = alignmentArtifactId ? s.artifacts?.[alignmentArtifactId] : null;
	const p = profileArtifactId ? s.artifacts?.[profileArtifactId] : null;
	const c = cantArtifactId ? s.artifacts?.[cantArtifactId] : null;

	const polyline2d = Array.isArray(a?.payload?.polyline2d)
		? a.payload.polyline2d
		: null;

	return {
		import_polyline2d: polyline2d,
		import_marker2d:
			a?.payload?.bboxCenter ??
			(polyline2d ? pickMarkerFromPolyline(polyline2d) : null),
		import_profile1d: p?.payload?.profile1d ?? null,
		import_cant1d: c?.payload?.cant1d ?? null,
		import_activeArtifacts: active ?? null,
		import_tracks2d: collectImportTracks2d(s.artifacts, alignmentArtifactId),
	};
}

export function mirrorImportPreview({ getState, setState } = {}) {
	if (!getState || !setState) return;
	setState(applyImportPreview(getState()));
}
