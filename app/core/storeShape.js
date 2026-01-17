// app/core/storeShape.js

export function makeInitialState() {
	return {
		activeRouteProjectId: null,
		activeSlot: "right",          // <— G: NEW

		cursor: {},

		routeProjects: {},
		artifacts: {},

		// quick-render hooks
		import_polyline2d: null,
		import_marker2d: null,
		import_profile1d: null,
		import_cant1d: null,

		import_meta: null,
	};
}

export function ensureStateShape(state) {
	const s = state ?? {};
	return {
		activeRouteProjectId: s.activeRouteProjectId ?? null,
		activeSlot: s.activeSlot ?? "right",    // <— G: NEW

		cursor: s.cursor ?? {},

		routeProjects: s.routeProjects ?? {},
		artifacts: s.artifacts ?? {},

		import_polyline2d: s.import_polyline2d ?? null,
		import_marker2d: s.import_marker2d ?? null,

		import_profile1d: s.import_profile1d ?? null,
		import_cant1d: s.import_cant1d ?? null,

		import_meta: s.import_meta ?? null,
	};
}
