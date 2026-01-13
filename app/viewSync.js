export function createStore(initialState = {}) {
	let state = { ...initialState };
	const listeners = new Set();

	function getState() {
		return state;
	}

	function setState(patch) {
		state = { ...state, ...patch };
		for (const fn of listeners) fn(state);
	}

	function subscribe(fn, { immediate = false } = {}) {
		listeners.add(fn);
		if (immediate) fn(state);
		return () => listeners.delete(fn);
	}

	return { getState, setState, subscribe };
}
