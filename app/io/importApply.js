// app/io/importApply.js
// Apply Import -> Store
// - Creates/updates RouteProject registry (minimal, no artifacts yet)
// - Writes quick-render hooks for 3D + Bands + Cant
// - Does NOT depend on any other helpers

function nowIso() {
	return new Date().toISOString();
}

function detectKind({ imp, draft }) {
	const k = imp?.kind || imp?.type || draft?.kind || draft?.type || "unknown";
	const s = String(k).toLowerCase();
	if (s.includes("tra")) return "TRA";
	if (s.includes("gra")) return "GRA";
	return String(k).toUpperCase();
}

function pickBaseId({ imp, draft }) {
	// prefer draft.id (importSession sets it), else imp.name, else fallback
	return draft?.id || imp?.name || imp?.id || imp?.baseId || "unknown";
}

function ensureRouteProject(routeProjects, baseId) {
	const existing = routeProjects?.[baseId];
	if (existing) return existing;

	return {
		id: baseId,
		createdAt: nowIso(),
		updatedAt: nowIso(),
		slots: {
			right: {},
			left: {},
			km: {},
		},
		meta: {},
	};
}

function extractAlignmentPolyline({ draft, slot = "right" }) {
	return (
	draft?.[slot]?.polyline2d ??
	draft?.right?.polyline2d ??
	draft?.polyline2d ??
	null
	);
}

function extractMarker({ draft, polyline2d, slot = "right" }) {
	return (
	draft?.[slot]?.bboxCenter ??
	draft?.right?.bboxCenter ??
	draft?.bboxCenter ??
	(Array.isArray(polyline2d) ? polyline2d[0] : null)
	);
}

function extractProfile({ draft, slot = "right" }) {
	return (
	// current (your draft uses right.profile1d)
	draft?.[slot]?.profile1d ??
	draft?.right?.profile1d ??
	draft?.profile1d ??

	// legacy aliases
	draft?.[slot]?.gradient1d ??
	draft?.right?.gradient1d ??
	draft?.gradient1d ??

	draft?.[slot]?.profilePts ??
	draft?.right?.profilePts ??
	draft?.profilePts ??

	draft?.[slot]?.gradientPts ??
	draft?.right?.gradientPts ??
	draft?.gradientPts ??

	null
	);
}

function extractCant({ draft, slot = "right" }) {
	return (
	draft?.[slot]?.cant1d ??
	draft?.right?.cant1d ??
	draft?.cant1d ??
	null
	);
}

export function applyImportToProject({ store, imp, draft, slot = "right" }) {
	if (!store?.setState || !store?.getState) {
		return [{ type: "log", level: "error", message: "importApply: missing store" }];
	}

	const baseId = pickBaseId({ imp, draft });
	const kind = detectKind({ imp, draft });
	const source = draft?.source ?? imp?.source ?? { file: imp?.name ?? null };

	// Extract payloads (optional)
	const polyline2d = extractAlignmentPolyline({ draft, slot });
	const marker2d = extractMarker({ draft, polyline2d, slot });
	const profile1d = extractProfile({ draft, slot });
	const cant1d = extractCant({ draft, slot });

	// Pull previous state
	const prev = store.getState() ?? {};
	const routeProjects = { ...(prev.routeProjects ?? {}) };

	// Upsert RP + minimal flags into slots
	const rp = ensureRouteProject(routeProjects, baseId);
	rp.updatedAt = nowIso();

	const slotObj = rp.slots?.[slot] ?? (rp.slots[slot] = {});
	if (Array.isArray(polyline2d) && polyline2d.length >= 2) slotObj.hasAlignment = true;
	if (Array.isArray(profile1d) && profile1d.length >= 2) slotObj.hasProfile = true;
	if (Array.isArray(cant1d) && cant1d.length >= 2) slotObj.hasCant = true;

	routeProjects[baseId] = rp;

	// Patch (always creates RP + selects it)
	const patch = {
		routeProjects,
		activeRouteProjectId: baseId,

		import_meta: {
			base: baseId,
			slot,
			kind,
			source,
			at: nowIso(),
		},
	};

	const effects = [];

	// QuickHooks
	if (Array.isArray(polyline2d) && polyline2d.length >= 2) {
		patch.import_polyline2d = polyline2d;
		patch.import_marker2d = marker2d;

		effects.push({ type: "log", level: "info", message: `applyImport[TRA]: ${baseId} pts=${polyline2d.length}` });
		effects.push({ type: "props", object: { import: baseId, kind: "TRA", pts: polyline2d.length, slot } });
	}

	if (Array.isArray(profile1d) && profile1d.length >= 2) {
		patch.import_profile1d = profile1d;

		effects.push({ type: "log", level: "info", message: `applyImport[GRA]: ${baseId} pts=${profile1d.length}` });
		effects.push({ type: "props", object: { import: baseId, kind: "GRA", pts: profile1d.length, slot } });
	}

	if (Array.isArray(cant1d) && cant1d.length >= 2) {
		patch.import_cant1d = cant1d;

		effects.push({ type: "log", level: "info", message: `applyImport[CANT]: ${baseId} pts=${cant1d.length}` });
		effects.push({ type: "props", object: { import: baseId, kind: "CANT", pts: cant1d.length, slot } });
	}

	const any =
	(Array.isArray(polyline2d) && polyline2d.length >= 2) ||
	(Array.isArray(profile1d) && profile1d.length >= 2) ||
	(Array.isArray(cant1d) && cant1d.length >= 2);

	if (!any) {
		effects.push({
			type: "log",
			level: "info",
			message: `applyImport: stored meta only (no renderable payload) base=${baseId} kind=${kind}`,
		});
	}

	store.setState(patch);
	return effects;
}
