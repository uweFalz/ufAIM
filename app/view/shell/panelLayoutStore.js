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

function asPlainObject(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function loadAll() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		return asPlainObject(safeParse(raw, {}));
	} catch {
		return {};
	}
}

function saveAll(map) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(asPlainObject(map)));
	} catch {
		// ignore quota/private-mode errors
	}
}

export function loadPanelLayout(panelId) {
	const all = loadAll();
	return asPlainObject(all[panelId]);
}

export function savePanelLayout(panelId, layout) {
	if (!panelId) return;

	const all = loadAll();
	const prev = asPlainObject(all[panelId]);

	all[panelId] = {
		...prev,
		...asPlainObject(layout),
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
