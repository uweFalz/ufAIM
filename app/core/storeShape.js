// app/core/storeShape.js
//
// WorkspaceState "contract" (single source of truth for app-wide state keys)
//
// Categories:
// - SPOT (Single Point of Truth):
//     routeProjects, artifacts, view_pins, activeRouteProjectId, activeSlot
// - UI caches / quick hooks (derived, can be regenerated from SPOT):
//     import_* (polyline/profile/cant/meta/activeArtifacts), cursor
//
// Notes:
// - cursor is a small UI control state (currently: { s } in meters).
// - view_pins are user intent and must survive ensureStateShape().
//
// If you add state keys: update BOTH makeInitialState() + ensureStateShape().

function normalizeCursor(cursor) {
	const c = (cursor && typeof cursor === "object") ? cursor : {};
	const s = Number(c.s);
	return { s: Number.isFinite(s) ? s : 0 };
}

function normalizePins(pins) {
	if (!Array.isArray(pins)) return [];
	// Keep it tolerant; UI/VC can accept legacy shapes.
	// Expected: [{ rpId, slot, at? }, ...]
	return pins
		.filter(Boolean)
		.map((p) => {
			if (typeof p === "string") {
				const [rpId, slot] = p.split("::");
				return { rpId, slot: slot || "right" };
			}
			if (typeof p === "object") {
				return {
					rpId: String(p.rpId ?? p.baseId ?? ""),
					slot: String(p.slot ?? "right"),
					at: p.at ?? undefined,
				};
			}
			return null;
		})
		.filter(p => p?.rpId);
}

export function makeInitialState() {
	return {
		// ---- SPOT (authoritative) ----
		activeRouteProjectId: null,    // string|null
		activeSlot: "right",           // string (e.g. "right"|"left"|...)

		routeProjects: {},             // { [rpId]: RouteProject }
		artifacts: {},                 // { [artifactId]: Artifact }

		view_pins: [],                 // [{rpId, slot, at?}]

		// ---- UI control state ----
		cursor: { s: 0 },              // { s:number }

		// ---- quick-render hooks (derived caches) ----
		import_polyline2d: null,        // [{x,y,z?},...] | null
		import_marker2d: null,          // {x,y,z?} | null
		import_profile1d: null,         // [{s,z,...},...] | null
		import_cant1d: null,            // [{s,u,...},...] | null
		import_meta: null,              // any | null
		import_activeArtifacts: null,   // { baseId, slot, alignmentArtifactId, ... } | null
	};
}

export function ensureStateShape(state) {
	const s = state ?? {};
	return {
		// SPOT
		activeRouteProjectId: s.activeRouteProjectId ?? null,
		activeSlot: s.activeSlot ?? "right",

		routeProjects: s.routeProjects ?? {},
		artifacts: s.artifacts ?? {},

		// pins must survive
		view_pins: normalizePins(s.view_pins),

		// cursor
		cursor: normalizeCursor(s.cursor),

		// quick hooks
		import_polyline2d: s.import_polyline2d ?? null,
		import_marker2d: s.import_marker2d ?? null,
		import_profile1d: s.import_profile1d ?? null,
		import_cant1d: s.import_cant1d ?? null,
		import_meta: s.import_meta ?? null,
		import_activeArtifacts: s.import_activeArtifacts ?? null,
	};
}
