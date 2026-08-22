const PRIORITY = Object.freeze({
	main: ["horizontal", "source", "objects", "vertical", "cant", "chainage"],
	q: ["horizontal", "cant", "vertical", "chainage", "source", "objects"],
	l: ["chainage", "vertical", "cant", "horizontal", "source", "objects"],
});

const DEFINITIONS = Object.freeze({
	horizontal: { label: "Horizontal", capability: "horizontal", action: "openHorizontal", actionLabel: "Element bearbeiten" },
	vertical: { label: "Vertical / Gradiente", capability: "vertical", action: "openVertical", actionLabel: "Vertical-Lane öffnen" },
	cant: { label: "Überhöhung", capability: "cant", action: "openCant", actionLabel: "Cant-Lane öffnen" },
	chainage: { label: "Kilometrierung", capability: "chainage", action: "openChainage", actionLabel: "Chainage-Lane öffnen" },
	source: { label: "Quellenprüfung / Import", action: "openSource", actionLabel: "Quellen öffnen" },
	objects: { label: "Objekte", action: "openObjects", actionLabel: "Objekte öffnen" },
});

export function buildAlignmentEngineeringTaskRailModel(intelligence) {
	const mode = ["main", "q", "l"].includes(intelligence?.mode) ? intelligence.mode : "main";
	const objectId = String(intelligence?.context?.objectId ?? "").trim() || null;
	const capabilities = intelligence?.capabilities ?? {};
	const sourceNeedsReview = Object.values(capabilities).some((entry) => entry?.status === "review-required" || entry?.relationStatus === "open-candidates");
	const sourceMissing = Object.values(capabilities).some((entry) => entry?.status === "missing");
	const tasks = PRIORITY[mode].map((id) => {
		const definition = DEFINITIONS[id];
		if (id === "objects") return task(id, definition, { status: objectId ? "constructive" : "not-covered", enabled: Boolean(objectId), reason: objectId ? "Aktives kanonisches Objekt" : "Kein aktives Objekt" });
		if (id === "source") return task(id, definition, { status: sourceNeedsReview ? "review-required" : sourceMissing ? "missing" : "constructive", enabled: Boolean(objectId), reason: !objectId ? "Kein aktives Objekt" : sourceNeedsReview ? "Quellevidenz benötigt Prüfung" : sourceMissing ? "Quellevidenz fehlt" : "Quellevidenz vorhanden", action: sourceNeedsReview ? "openReview" : sourceMissing ? "openImport" : "openReview", actionLabel: sourceNeedsReview ? "Review öffnen" : sourceMissing ? "Import öffnen" : "Quellen ansehen" });
		const capability = capabilities[definition.capability] ?? {};
		const enabled = Boolean(objectId) && (id === "horizontal" ? capability.status === "constructive" : true);
		return task(id, definition, { status: capability.status ?? "missing", enabled, reason: enabled ? capability.reason : !objectId ? "Kein aktives Objekt" : id === "horizontal" ? "Keine konstruktive horizontale Geometrie" : capability.reason, count: existingCount(capability.value), provenancePresent: capability.provenancePresent });
	});
	return Object.freeze({ mode, context: Object.freeze({ objectId, s: Number.isFinite(Number(intelligence?.context?.s)) ? Number(intelligence.context.s) : null }), tasks: Object.freeze(tasks) });
}

function task(id, definition, overrides) {
	return Object.freeze({ id, label: definition.label, status: overrides.status, count: overrides.count ?? null, provenancePresent: Boolean(overrides.provenancePresent), reason: overrides.reason ?? null, action: overrides.action ?? definition.action, actionLabel: overrides.actionLabel ?? definition.actionLabel, enabled: overrides.enabled === true });
}

function existingCount(value) {
	if (Number.isInteger(value?.elementCount) && value.elementCount >= 0) return value.elementCount;
	if (Array.isArray(value?.elements)) return value.elements.length;
	if (Array.isArray(value?.segments)) return value.segments.length;
	return null;
}

export default buildAlignmentEngineeringTaskRailModel;
