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

// app/core/storeShape.js (MS14.2)
export function makeInitialState() {
	return {
		// selection
		activeRouteProjectId: null,
		activeSlot: "right",

		// cursor
		cursor: { s: 0 },

		// registry
		routeProjects: {},      // rpId -> {id, slots, meta, ...}
		artifacts: {},          // artifactId -> artifact
		
		// state
		spot_decisions: {}, // key -> "accept" | "defer" | "ignore"

		// view cache (quick hooks)
		import_activeArtifacts: null,
		import_polyline2d: null,
		import_marker2d: null,
		import_profile1d: null,
		import_cant1d: null,
		import_meta: null,

		// view state
		view_pins: [],          // [{rpId, slot, at}]
		view_chunks: [],   // ✅ neu
		
		// Transition Editor (canonical)
		te_open: false,
		te_presetId: "",
		te_w1: 0.25,
		te_w2: 0.75,
		te_plot: "k",   // "k" | "k1" | "k2"
		te_u: 0.0,      // 0..1
	};
}

export function ensureStateShape(state) {
	const s = state ?? {};
	const w1 = Number.isFinite(s.te_w1) ? Math.max(0, Math.min(1, s.te_w1)) : 0.25;
	const w2 = Number.isFinite(s.te_w2) ? Math.max(0, Math.min(1, s.te_w2)) : 0.75;
	const plot = (s.te_plot === "k" || s.te_plot === "k1" || s.te_plot === "k2") ? s.te_plot : "k";
	const u = Number.isFinite(s.te_u) ? Math.max(0, Math.min(1, s.te_u)) : 0.0;

	return {
		// SPOT
		activeRouteProjectId: s.activeRouteProjectId ?? null,
		activeSlot: s.activeSlot ?? "right",

		routeProjects: s.routeProjects ?? {},
		artifacts: s.artifacts ?? {},
		
		// state
		spot_decisions: s.spot_decisions ?? {}, // key -> "accept" | "defer" | "ignore"

		// pins must survive
		view_pins: normalizePins(s.view_pins),
		view_chunks : s.view_chunks ?? [],

		// cursor
		cursor: { ...(s.cursor ?? {}), s: Number.isFinite(s.cursor?.s) ? s.cursor.s : 0 },

		// quick hooks
		import_polyline2d: s.import_polyline2d ?? null,
		import_marker2d: s.import_marker2d ?? null,
		import_profile1d: s.import_profile1d ?? null,
		import_cant1d: s.import_cant1d ?? null,
		import_meta: s.import_meta ?? null,
		import_activeArtifacts: s.import_activeArtifacts ?? null,		

		// Transition Editor (canonical, survives reload)
		te_open: Boolean(s.te_open),
		te_presetId: String(s.te_presetId ?? ""),
		te_w1: Math.min(w1, w2),
		te_w2: Math.max(w1, w2),
		te_plot: plot,
		te_u: u,
	};
}
