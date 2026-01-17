// app/io/importApply.js
// Registry Apply (format-agnostisch)
//
// Input: { baseId, slot, source, artifacts[] }
// Output: store.patch + effects (log/props)
//
// NOTE: QuickHooks sind nur View-Cache (für 3D/Overlays), NICHT die eigentliche Datenhaltung.

function nowIso() {
	return new Date().toISOString();
}

function makeArtifactId({ baseId, slot, domain, kind }) {
	return `${baseId}::${slot}::${domain}::${kind}::${Date.now()}`;
}

function ensureObject(x) {
	return (x && typeof x === "object") ? x : {};
}

function ensureStoreShape(state) {
	const s = ensureObject(state);
	return {
		activeRouteProjectId: s.activeRouteProjectId ?? null,
		cursor: ensureObject(s.cursor),

		routeProjects: ensureObject(s.routeProjects),
		artifacts: ensureObject(s.artifacts),

		// quick-render hooks (View Cache)
		import_polyline2d: s.import_polyline2d ?? null,
		import_marker2d: s.import_marker2d ?? null,
		import_profile1d: s.import_profile1d ?? null,
		import_cant1d: s.import_cant1d ?? null,
		import_meta: s.import_meta ?? null,
	};
}

function upsertRouteProject(routeProjects, baseId) {
	const existing = routeProjects[baseId];
	if (existing) return existing;

	const created = {
		id: baseId,
		createdAt: nowIso(),
		updatedAt: nowIso(),

		// Slots nach 7-Linien-Modell (minimal start)
		slots: {
			right: {}, // { alignmentArtifactId, profileArtifactId, cantArtifactId, otherArtifactIds[] }
			left: {},
			km: {},
		},

		meta: {},
	};

	routeProjects[baseId] = created;
	return created;
}

function attachArtifactToSlot({ rp, slot, artifact }) {
	rp.updatedAt = nowIso();
	const s = rp.slots?.[slot] ?? (rp.slots[slot] = {});

	// Domain routing (minimal)
	if (artifact.domain === "alignment2d") s.alignmentArtifactId = artifact.id;
	else if (artifact.domain === "profile1d") s.profileArtifactId = artifact.id;
	else if (artifact.domain === "cant1d") s.cantArtifactId = artifact.id;
	else {
		if (!Array.isArray(s.otherArtifactIds)) s.otherArtifactIds = [];
		s.otherArtifactIds.push(artifact.id);
	}

	// meta hints
	rp.meta.lastDomain = artifact.domain;
	rp.meta.lastKind = artifact.kind;
}

function pickMarkerFromPolyline(polyline2d) {
	if (!Array.isArray(polyline2d) || polyline2d.length < 1) return null;
	return polyline2d[0];
}

function applyQuickHooksFromActiveRP(state) {
	const s = ensureStoreShape(state);

	const baseId = s.activeRouteProjectId;
	if (!baseId) return s;

	const rp = s.routeProjects?.[baseId];
	if (!rp) return s;

	const slot = "right"; // später: rp.activeSlot etc.
	const slotObj = rp.slots?.[slot] ?? null;
	if (!slotObj) return s;

	const patch = { ...s };

	// alignment quickhook
	const aId = slotObj.alignmentArtifactId;
	const a = aId ? s.artifacts?.[aId] : null;
	if (a?.payload?.polyline2d) {
		patch.import_polyline2d = a.payload.polyline2d;
		patch.import_marker2d = a.payload.bboxCenter ?? pickMarkerFromPolyline(a.payload.polyline2d);
	}

	// profile quickhook
	const pId = slotObj.profileArtifactId;
	const p = pId ? s.artifacts?.[pId] : null;
	if (p?.payload?.profile1d) patch.import_profile1d = p.payload.profile1d;

	// cant quickhook
	const cId = slotObj.cantArtifactId;
	const c = cId ? s.artifacts?.[cId] : null;
	if (c?.payload?.cant1d) patch.import_cant1d = c.payload.cant1d;

	return patch;
}

export function applyImportToProject({ store, baseId, slot = "right", source = null, artifacts = [], ui }) {
	if (!store?.getState || !store?.setState) {
		return [{ type: "log", level: "error", message: "importApply: missing store" }];
	}
	if (!baseId) {
		return [{ type: "log", level: "error", message: "importApply: missing baseId" }];
	}

	const prev = ensureStoreShape(store.getState());

	// clone maps
	const nextArtifacts = { ...prev.artifacts };
	const nextRouteProjects = { ...prev.routeProjects };
	const rp = upsertRouteProject(nextRouteProjects, baseId);

	const effects = [];

	// commit artifacts
	for (const inArt of artifacts) {
		if (!inArt) continue;

		const domain = inArt.domain ?? "unknown";
		const kind = inArt.kind ?? "unknown";

		const id = inArt.id ?? makeArtifactId({ baseId, slot, domain, kind });

		const artifact = {
			id,
			baseId,
			slot,
			domain,      // alignment2d | profile1d | cant1d | unknown
			kind,        // TRA | GRA | ...
			createdAt: nowIso(),
			source: inArt.source ?? source ?? null,
			meta: inArt.meta ?? null,
			payload: inArt.payload ?? null,
		};

		nextArtifacts[id] = artifact;
		attachArtifactToSlot({ rp, slot, artifact });

		effects.push({ type: "log", level: "info", message: `artifact: + ${id}` });
	}

	// selection: if none yet, pick this
	const nextActive = prev.activeRouteProjectId ?? baseId;

	const patchBase = {
		activeRouteProjectId: nextActive,
		routeProjects: nextRouteProjects,
		artifacts: nextArtifacts,
		import_meta: {
			base: baseId,
			slot,
			at: nowIso(),
			source,
			artifacts: artifacts.map(a => ({ domain: a?.domain, kind: a?.kind })),
		},
	};

	// now mirror quickhooks from active RP
	const patchFinal = applyQuickHooksFromActiveRP({ ...prev, ...patchBase });

	store.setState(patchFinal);

	// props effect
	effects.push({
		type: "props",
		object: {
			active: patchFinal.activeRouteProjectId,
			base: baseId,
			slot,
			artifactCount: Object.keys(patchFinal.artifacts ?? {}).length,
			rpCount: Object.keys(patchFinal.routeProjects ?? {}).length,
		},
	});

	return effects;
}
