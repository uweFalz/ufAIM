// app/viewSync.js

export function createStore(initialState) {
	let state = structuredClone(initialState);
	const subs = new Set();

	function getState() {
		return state;
	}

	function setState(patch) {
		state = { ...state, ...patch };
		for (const fn of subs) fn(state);
	}

	function subscribe(fn, { immediate = true } = {}) {
		subs.add(fn);
		if (immediate) fn(state);
		return () => subs.delete(fn);
	}

	return { getState, setState, subscribe };
}
