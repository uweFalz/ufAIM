const DISCIPLINES = new Set(["horizontal", "vertical", "cant", "chainage"]);

export function resolveViewerElementSelection({ selectedElementId = null, selectedDiscipline = null, segmentIds = new Set() } = {}) {
	if (selectedElementId && selectedDiscipline && selectedDiscipline !== "horizontal") return Object.freeze({ retainShared: true, clearShared: false, viewerElementId: null });
	if (selectedElementId && !segmentIds.has(selectedElementId)) return Object.freeze({ retainShared: false, clearShared: true, viewerElementId: null });
	return Object.freeze({ retainShared: Boolean(selectedElementId), clearShared: false, viewerElementId: selectedElementId });
}

export function buildCrossViewElementSelectionModel({ state = {}, mode = "main", horizontalSource = null, profileSource = null } = {}) {
	const selection = state?.workspace_selection ?? {};
	const objectId = String(selection?.primaryId ?? "").trim();
	const discipline = DISCIPLINES.has(selection?.elementDiscipline) ? selection.elementDiscipline : null;
	const elementId = String(selection?.elementId ?? "").trim();
	if (!objectId || !discipline || !elementId) return Object.freeze({ status: "empty", selection: null, property: null });
	const candidate = findCandidate({ objectId, discipline, elementId, horizontalSource, profileSource });
	if (!candidate) return Object.freeze({ status: "invalid", selection: Object.freeze({ objectId, discipline, elementId }), property: null });
	const entry = candidate.entry;
	return Object.freeze({
		status: "selected",
		mode,
		selection: Object.freeze({ objectId, discipline, elementId }),
		property: Object.freeze({ type: entry?.type ?? entry?.kind ?? (discipline === "chainage" ? "segment" : null), domain: finiteDomain(entry), properties: entry?.properties ?? entry, provenancePresent: Boolean(entry?.provenance || candidate.provenancePresent), action: actionFor(discipline), mappingId: entry?.mappingId ?? null }),
	});
}

function findCandidate({ objectId, discipline, elementId, horizontalSource, profileSource }) {
	if (discipline === "horizontal") {
		if (String(horizontalSource?.objectId ?? "") !== objectId) return null;
		return candidate((horizontalSource?.elements ?? []).find((entry) => String(entry?.id ?? entry?.elementId ?? "") === elementId));
	}
	if (String(profileSource?.alignmentId ?? "") !== objectId) return null;
	return candidate((profileSource?.selectableElements?.[discipline] ?? []).find((entry) => String(entry?.elementId ?? entry?.id ?? "") === elementId));
}
function candidate(entry) { return entry ? { entry, provenancePresent: hasExplicitProvenance(entry) } : null; }
function hasExplicitProvenance(entry) {
	const value = entry?.properties ?? entry;
	return Boolean(entry?.provenance || entry?.sourceRefs || entry?.evidenceId || value?.provenance || value?.sourceRefs || value?.evidenceId);
}
function finiteDomain(entry) {
	const startS = Number.isFinite(entry?.startS) ? entry.startS : entry?.s0;
	const endS = Number.isFinite(entry?.endS) ? entry.endS : entry?.s1;
	return Number.isFinite(startS) && Number.isFinite(endS) ? Object.freeze({ startS, endS }) : null;
}
function actionFor(discipline) { return ({ horizontal: "openHorizontal", vertical: "openVertical", cant: "openCant", chainage: "openChainage" })[discipline]; }

export default buildCrossViewElementSelectionModel;
