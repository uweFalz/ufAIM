// app/core/workspaceState.js

import { makeInitialState, ensureStateShape } from "./storeShape.js";

export function createWorkspaceState(initial) {
	let state = ensureStateShape(initial ?? makeInitialState());
	const listeners = new Set();

	function getState() { return state; }

	function setState(patch) {
		const nextPatch = typeof patch === "function" ? patch(state) : patch;
		state = ensureStateShape({ ...state, ...(nextPatch ?? {}) });
		for (const fn of listeners) fn(state);
	}

	function subscribe(fn) {
		listeners.add(fn);
		return () => listeners.delete(fn);
	}

	const actions = {
		setActiveRouteProject(id) {
			setState({ activeRouteProjectId: id ?? null });
		},

		// G: NEW
		setActiveSlot(slot) {
			const v = String(slot ?? "right");
			const safe = (v === "left" || v === "km" || v === "right") ? v : "right";
			setState({ activeSlot: safe });
		},

		setCursor(patch) {
			setState({ cursor: { ...state.cursor, ...(patch ?? {}) } });
		},

		setPick(pick) {
			setState({ cursor: { ...state.cursor, pick } });
		},
	};

	return { getState, setState, subscribe, actions };
}
