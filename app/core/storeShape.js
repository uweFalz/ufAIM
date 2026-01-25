// app/core/storeShape.js

export function makeInitialState() {
	return {
		activeRouteProjectId: null,
		activeSlot: "right",

		cursor: {},

		routeProjects: {},
		artifacts: {},

		// quick-render hooks
		import_polyline2d: null,
		import_marker2d: null,
		import_profile1d: null,
		import_cant1d: null,

		import_meta: null,

		// MS8: deterministic active artifact ids for current (RP,slot)
		import_activeArtifacts: null, // { baseId, slot, alignmentArtifactId, profileArtifactId, cantArtifactId }

			// MS13.12: pinned artifacts (for multi-track view)
			view_pins: [], // [{ baseId, slot, alignmentArtifactId, pinnedAt }]
	};
}

export function ensureStateShape(state) {
	const s = state ?? {};

	// MS13.12c: allow legacy string pins ("rpId::slot") but normalize to objects
	let pins = Array.isArray(s.view_pins) ? s.view_pins : [];
	pins = pins.map((p) => {
		if (!p) return null;
		if (typeof p === "string") {
			const [rpId, slot] = p.split("::");
			if (!rpId) return null;
			return { rpId, slot: slot ?? "right", createdAt: null };
		}
		if (typeof p === "object") {
			const rpId = p.rpId ?? p.baseId ?? null;
			if (!rpId) return null;
			return {
				rpId,
				slot: p.slot ?? "right",
				createdAt: p.createdAt ?? null,
			};
		}
		return null;
	}).filter(Boolean);

	return {
		activeRouteProjectId: s.activeRouteProjectId ?? null,
		activeSlot: s.activeSlot ?? "right",

		cursor: s.cursor ?? {},

		routeProjects: s.routeProjects ?? {},
		artifacts: s.artifacts ?? {},

		import_polyline2d: s.import_polyline2d ?? null,
		import_marker2d: s.import_marker2d ?? null,

		import_profile1d: s.import_profile1d ?? null,
		import_cant1d: s.import_cant1d ?? null,

		import_meta: s.import_meta ?? null,

		import_activeArtifacts: s.import_activeArtifacts ?? null,
		view_pins: pins,
	};
}
