// app/io/apply/importPreviewApply.js

/**
 * @baustelle [PREVIEW-CONTRACT]
 * Mirror assumes the unified alignment preview artifact contract:
 *   domain="alignment2d" + payload.polyline2d
 * If legacy artifacts still exist elsewhere, they must be normalized before apply.
 */

// View-side mirror for import preview.
// No registry changes here.
// No format logic here.
// No ProjectModel here.
//
// Input:
//   state
//
// Output:
//   patched state with import_* preview hooks updated from active RP/slot

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
	if (!slotObj) {
		return {
			baseId,
			slot,
			alignmentArtifactId: null,
			profileArtifactId: null,
			cantArtifactId: null,
		};
	}

	return {
		baseId,
		slot,
		alignmentArtifactId: slotObj.alignmentArtifactId ?? null,
		profileArtifactId: slotObj.profileArtifactId ?? null,
		cantArtifactId: slotObj.cantArtifactId ?? null,
	};
}

export function applyImportPreview(state) {
	const s = ensureImportStoreShape(state);
	const active = getActiveArtifactIds(s);

	if (!active) {
		return {
			...s,
			import_polyline2d: null,
			import_marker2d: null,
			import_profile1d: null,
			import_cant1d: null,
			import_activeArtifacts: null,
			import_tracks2d: collectImportTracks2d(s.artifacts, null),
		};
	}

	const { alignmentArtifactId, profileArtifactId, cantArtifactId } = active;
	const patch = { ...s };

	patch.import_activeArtifacts = active;
	patch.import_tracks2d = collectImportTracks2d(s.artifacts, alignmentArtifactId);

	// alignment quickhook
	const a = alignmentArtifactId ? s.artifacts?.[alignmentArtifactId] : null;
	const poly = a?.payload?.polyline2d ?? null;

	patch.import_polyline2d = Array.isArray(poly) ? poly : null;
	patch.import_marker2d =
		a?.payload?.bboxCenter ??
		(Array.isArray(poly) ? pickMarkerFromPolyline(poly) : null);

	// profile quickhook
	const p = profileArtifactId ? s.artifacts?.[profileArtifactId] : null;
	patch.import_profile1d = p?.payload?.profile1d ?? null;

	// cant quickhook
	const c = cantArtifactId ? s.artifacts?.[cantArtifactId] : null;
	patch.import_cant1d = c?.payload?.cant1d ?? null;

	return patch;
}

export function mirrorImportPreview({ getState, setState } = {}) {
	if (!getState || !setState) return;
	const prev = getState();
	const next = applyImportPreview(prev);
	setState(next);
}
