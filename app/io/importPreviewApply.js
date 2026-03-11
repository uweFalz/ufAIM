// app/io/importPreviewApply.js
//
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

// ...
function ensureObject(x) {
	return (x && typeof x === "object") ? x : {};
}

function ensureStoreShape(state) {
	const s = ensureObject(state);
	return {
		activeRouteProjectId: s.activeRouteProjectId ?? null,
		activeSlot: s.activeSlot ?? "right",
		cursor: ensureObject(s.cursor),

		routeProjects: ensureObject(s.routeProjects),
		artifacts: ensureObject(s.artifacts),

		import_polyline2d: s.import_polyline2d ?? null,
		import_marker2d: s.import_marker2d ?? null,
		import_profile1d: s.import_profile1d ?? null,
		import_cant1d: s.import_cant1d ?? null,
		import_meta: s.import_meta ?? null,
		import_activeArtifacts: s.import_activeArtifacts ?? null,

		view_pins: Array.isArray(s.view_pins) ? s.view_pins : [],
	};
}

function pickMarkerFromPolyline(polyline2d) {
	if (!Array.isArray(polyline2d) || polyline2d.length < 1) return null;
	return polyline2d[0];
}

//
// ...
//
export function getActiveArtifactIds(state) {
	const s = ensureStoreShape(state);

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

//
// ...
//
export function applyImportPreview(state) {
	const s = ensureStoreShape(state);

	const active = getActiveArtifactIds(s);
	if (!active) {
		return {
			...s,
			import_polyline2d: null,
			import_marker2d: null,
			import_profile1d: null,
			import_cant1d: null,
			import_activeArtifacts: null,
		};
	}

	const { alignmentArtifactId, profileArtifactId, cantArtifactId } = active;

	const patch = { ...s };

	// deterministic ids / active artifact refs
	patch.import_activeArtifacts = active;

	// alignment quickhook
	const a = alignmentArtifactId ? s.artifacts?.[alignmentArtifactId] : null;

	const poly =
	a?.payload?.polyline2d ??
	a?.payload?.pts ??
	null;

	if (poly) {
		patch.import_polyline2d = poly;
		patch.import_marker2d = a?.payload?.bboxCenter ?? pickMarkerFromPolyline(poly);
	} else {
		patch.import_polyline2d = null;
		patch.import_marker2d = null;
	}

	// profile quickhook
	const p = profileArtifactId ? s.artifacts?.[profileArtifactId] : null;
	patch.import_profile1d = p?.payload?.profile1d ?? null;

	// cant quickhook
	const c = cantArtifactId ? s.artifacts?.[cantArtifactId] : null;
	patch.import_cant1d = c?.payload?.cant1d ?? null;

	return patch;
}

//
// ...
//
export function mirrorImportPreview({ getState, setState } = {}) {
	if (!getState || !setState) return;
	const prev = getState();
	const next = applyImportPreview(prev);
	setState(next);
}
