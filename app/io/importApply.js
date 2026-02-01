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

		// ✅ MS14.1 pins survive patching too
		view_pins: Array.isArray(s.view_pins) ? s.view_pins : [],
	};
}

function computeBbox2d(polyline2d) {
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

function bboxCenter2d(bbox) {
	if (!bbox) return null;
	const cx = (Number(bbox.minX) + Number(bbox.maxX)) * 0.5;
	const cy = (Number(bbox.minY) + Number(bbox.maxY)) * 0.5;
	if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
	return { x: cx, y: cy };
}

/**
* Normalize + enrich artifact payloads so View hooks are stable.
* - alignment2d: ensures payload.polyline2d, payload.bbox, payload.bboxCenter
* - profile1d: (optional later) ranges, etc.
* - cant1d:    (optional later) ranges, etc.
*/
function normalizeArtifactPayload({ domain, payload }) {
	const p = ensureObject(payload);

	// ---- alignment2d ----
	if (domain === "alignment2d") {
		// accept a couple of legacy aliases (future-proof)
		const polyline2d =
		p.polyline2d ??
		p.pts ??                 // optional alias if later used
		p.geometry?.pts ??        // optional alias
		null;

		const bbox = p.bbox ?? computeBbox2d(polyline2d);
		const center = p.bboxCenter ?? bboxCenter2d(bbox) ?? pickMarkerFromPolyline(polyline2d);

		return {
			...p,
			polyline2d,
			bbox,
			bboxCenter: center,
		};
	}

	// ---- profile1d ----
	if (domain === "profile1d") {
		// keep as-is; (optional later: add range)
		return p;
	}

	// ---- cant1d ----
	if (domain === "cant1d") {
		// keep as-is; (optional later: add range)
		return p;
	}

	return p;
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
			right: {},
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

	if (artifact.domain === "alignment2d") s.alignmentArtifactId = artifact.id;
	else if (artifact.domain === "profile1d") s.profileArtifactId = artifact.id;
	else if (artifact.domain === "cant1d") s.cantArtifactId = artifact.id;
	else {
		if (!Array.isArray(s.otherArtifactIds)) s.otherArtifactIds = [];
		s.otherArtifactIds.push(artifact.id);
	}

	rp.meta.lastDomain = artifact.domain;
	rp.meta.lastKind = artifact.kind;
}

function pickMarkerFromPolyline(polyline2d) {
	if (!Array.isArray(polyline2d) || polyline2d.length < 1) return null;
	return polyline2d[0];
}

// MS8: public helper (optional use)
export function getActiveArtifactIds(state) {
	const s = ensureStoreShape(state);

	const baseId = s.activeRouteProjectId;
	if (!baseId) return null;

	const rp = s.routeProjects?.[baseId];
	if (!rp) return null;

	const slot = s.activeSlot ?? "right";
	const slotObj = rp.slots?.[slot] ?? null;
	if (!slotObj) {
		return { baseId, slot, alignmentArtifactId: null, profileArtifactId: null, cantArtifactId: null };
	}

	return {
		baseId,
		slot,
		alignmentArtifactId: slotObj.alignmentArtifactId ?? null,
		profileArtifactId: slotObj.profileArtifactId ?? null,
		cantArtifactId: slotObj.cantArtifactId ?? null,
	};
}

// ...
export function applyQuickHooksFromActive(state) {
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

	// MS8: always set deterministic ids (even if payload missing)
	patch.import_activeArtifacts = active;

	// alignment quickhook
	const a = alignmentArtifactId ? s.artifacts?.[alignmentArtifactId] : null;

	const poly =
	a?.payload?.polyline2d ??
	a?.payload?.pts ??
	null;

	if (poly) {
		patch.import_polyline2d = poly;
		patch.import_marker2d = a.payload?.bboxCenter ?? pickMarkerFromPolyline(poly);
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

// ...
export function applyImportToProject({
	store,
	baseId,
	slot = "right",
	source = null,
	artifacts = [],
	ui,
	emitProps = false,     // ✅ MS10.3: default AUS
} = {}) {
	if (!store?.getState || !store?.setState) {
		return [{ type: "log", level: "error", message: "importApply: missing store" }];
	}
	if (!baseId) {
		return [{ type: "log", level: "error", message: "importApply: missing baseId" }];
	}

	const prev = ensureStoreShape(store.getState());

	const nextArtifacts = { ...prev.artifacts };
	const nextRouteProjects = { ...prev.routeProjects };
	const rp = upsertRouteProject(nextRouteProjects, baseId);

	const effects = [];

	for (const inArt of artifacts) {
		if (!inArt) continue;

		const domain = inArt.domain ?? "unknown";
		const kind = inArt.kind ?? "unknown";
		const id = inArt.id ?? makeArtifactId({ baseId, slot, domain, kind });

		const artifact = {
			id,
			baseId,
			slot,
			domain,
			kind,
			createdAt: nowIso(),
			source: inArt.source ?? source ?? null,
			meta: inArt.meta ?? null,
			payload: normalizeArtifactPayload({ domain, payload: inArt.payload ?? null }),
		};

		nextArtifacts[id] = artifact;
		attachArtifactToSlot({ rp, slot, artifact });

		effects.push({ type: "log", level: "info", message: `artifact: + ${id}` });
	}

	const nextActive = baseId; // statt prev.activeRouteProjectId ?? baseId

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

	const patchFinal = applyQuickHooksFromActive({ ...prev, ...patchBase });
	store.setState(patchFinal);

	// props effect (optional / DEV)
	if (emitProps) {
		effects.push({
			type: "props",
			object: {
				active: patchFinal.activeRouteProjectId,
				base: baseId,
				slot,
				activeArtifacts: patchFinal.import_activeArtifacts ?? null,
				artifactCount: Object.keys(patchFinal.artifacts ?? {}).length,
				rpCount: Object.keys(patchFinal.routeProjects ?? {}).length,
			},
		});
	}

	return effects;
}

export function mirrorQuickHooksFromActive(store) {
	if (!store?.getState || !store?.setState) return;
	const prev = store.getState();
	const next = applyQuickHooksFromActive(prev);
	store.setState(next);
}

// app/io/importApply.js

// New: tiny "single entry" wrapper for controllers.
// Keeps ImportController minimal and future-proof.
export function applyIngestResult({ store, ui, ingest, emitProps } = {}) {
	if (!store?.getState || !store?.setState || !ingest) {
		return [{ type: "log", level: "error", message: "applyIngestResult: missing store/ingest" }];
	}

	if (!store) return [{ type: "log", message: "applyIngestResult: missing store" }];

	// ✅ accept envelope or single ingest
	const ingests = Array.isArray(ingest?.ingests) ? ingest.ingests : [ingest].filter(Boolean);

	const effects = [];
	for (const one of ingests) {
		effects.push(
		...applyImportToProject({
			store,
			baseId: one.baseId,
			slot: one.slot,
			source: one.source,
			artifacts: one.artifacts,
			ui,
			emitProps: Boolean(emitProps),
		})
		);
	}
	return effects;
}
