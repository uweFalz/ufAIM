// src/shared/messaging/service/ImportSessionService.js

export function createImportSessionService({ getState, setState, router } = {}) {
	if (typeof getState !== "function") {
		throw new Error("ImportSessionService: missing getState");
	}
	if (typeof setState !== "function") {
		throw new Error("ImportSessionService: missing setState");
	}

	function cloneState() {
		return JSON.parse(JSON.stringify(getState()));
	}

	function broadcastStateChanged() {
		router?.broadcastEvt?.("Import.StateChanged", cloneState());
	}

	function beginSession({ source } = {}) {
		setState({
			sessionId: `imp_${Date.now()}`,
			phase: "collecting",
			items: [],
			error: null,
			source: source ?? null,
		});

		broadcastStateChanged();
		return cloneState();
	}

	function normalizeItems(items = []) {
		return items.map((it, i) => ({
			id: it?.id ?? `item_${Date.now()}_${i}`,
			name: it?.name ?? "unknown",
			size: Number(it?.size ?? 0),
			kind: it?.kind ?? "unknown",
			status: it?.status ?? "dropped",
			meta: it?.meta ?? null,
			source: it?.source ?? null,
			payload: it?.payload ?? null,
		}));
	}

	function addItems({ items = [] } = {}) {
		const st = getState();
		const normalized = normalizeItems(items);

		setState({
			...st,
			items: [...(Array.isArray(st.items) ? st.items : []), ...normalized],
		});

		broadcastStateChanged();
		return cloneState();
	}

	function getSessionState() {
		return cloneState();
	}

	return {
		getState: getSessionState,
		beginSession,
		addItems,
	};
}
