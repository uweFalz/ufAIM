// app/core/workspaceState.js

import { makeInitialState, ensureStateShape } from "./storeShape.js";

export function createWorkspaceState(initial) {
	let state = ensureStateShape(initial ?? makeInitialState());
	const listeners = new Set();

	function getState() {
		return state;
	}

	function setState(patch) {
		// Patch darf Objekt oder Funktion(state)->patch sein (optional nice-to-have)
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

		setCursor(patch) {
  setState((s) => ({ cursor: { ...s.cursor, ...(patch ?? {}) } }));
},

setPick(pick) {
  setState((s) => ({ cursor: { ...s.cursor, pick } }));
},
	};

	return { getState, setState, subscribe, actions };
}
