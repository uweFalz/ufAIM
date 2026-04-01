// app/view/shell/panelLayoutStore.js
//
// simple localStorage-backed panel layout persistence

const STORAGE_KEY = "ufaim.panelLayout.v1";

function safeParse(json, fallback = {}) {
	try {
		return JSON.parse(json);
	} catch {
		return fallback;
	}
}

function loadAll() {
	try {
		return safeParse(localStorage.getItem(STORAGE_KEY), {});
	} catch {
		return {};
	}
}

function saveAll(map) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(map ?? {}));
	} catch {
		// ignore quota/private-mode errors
	}
}

export function loadPanelLayout(panelId) {
	const all = loadAll();
	return all?.[panelId] ?? null;
}

export function savePanelLayout(panelId, layout) {
	if (!panelId) return;
	const all = loadAll();
	all[panelId] = {
		...(all[panelId] ?? {}),
		...(layout ?? {}),
	};
	saveAll(all);
}

export function clearPanelLayout(panelId) {
	if (!panelId) return;
	const all = loadAll();
	delete all[panelId];
	saveAll(all);
}

export function clearAllPanelLayouts() {
	saveAll({});
}
