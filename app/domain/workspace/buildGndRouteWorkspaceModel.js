const ROLE_LABELS = Object.freeze({ "0": "Eingleisige Strecke", "1": "Richtungsgleis", "2": "Gegenrichtung", "3": "Kilometrierungslinie", "4": "Bahnhof / Yard" });

export function buildGndRouteWorkspaceModel({ records = [], items = [], objects = [] } = {}) {
	const groups = new Map();
	for (const record of records) {
		const evidence = record?.sevenLineRoleEvidence;
		const sourceFingerprint = fingerprint(record);
		for (const assignment of evidence?.assignments ?? []) {
			const route = text(assignment.route);
			if (!route) continue;
			const sourceKey = sourceFingerprint || `evidence:${text(record?.evidenceId) || "unknown"}`;
			const key = `route:${route}:source:${sourceKey}`;
			const group = groups.get(key) ?? createGroup(key, route, sourceFingerprint);
			group.assignments.push(assignment);
			group.evidenceIds.add(record.evidenceId);
			groups.set(key, group);
		}
	}
	const byEvidenceItemId = new Map(items.map((item) => [text(item.evidenceItemId ?? item.id), item]));
	const byImportItemId = new Map(objects.map((object) => [text(object?.meta?.importItemId), object]));
	return Object.freeze([...groups.values()].map((group) => finalize(group, byEvidenceItemId, byImportItemId)));
}

function createGroup(id, route, sourceFingerprint) { return { id, route, sourceFingerprint, evidenceIds: new Set(), assignments: [] }; }
function finalize(group, itemMap, objectMap) {
	const roles = ["0", "1", "2", "3", "4"].map((code) => {
		const assignments = group.assignments.filter((entry) => text(entry.directionCode) === code);
		const targetIds = [...new Set(assignments.flatMap((entry) => entry.targetItemIds ?? []))];
		const items = targetIds.map((id) => itemMap.get(id)).filter(Boolean);
		const objects = targetIds.map((id) => objectMap.get(id)).filter(Boolean);
		return Object.freeze({ code, label: ROLE_LABELS[code], status: assignments.length ? "present" : "missing", families: familyStatuses(assignments), targetItemIds: Object.freeze(targetIds), promotableItemIds: Object.freeze(items.filter((item) => item?.status?.promotable === true && item?.status?.accepted !== true).map((item) => item.id)), canonicalObjectIds: Object.freeze(objects.map((object) => object.id)) });
	});
	const codes = new Set(group.assignments.map((entry) => text(entry.directionCode)));
	const diagnostics = [];
	if (codes.has("1") && codes.has("2") && !codes.has("3")) diagnostics.push("KM_LINE_REQUIRED");
	const promotableItemIds = [...new Set(roles.flatMap((role) => role.promotableItemIds))];
	if (!group.sourceFingerprint) diagnostics.push("SOURCE_FINGERPRINT_REQUIRED");
	return Object.freeze({ id: group.id, route: group.route, sourceFingerprint: group.sourceFingerprint, evidenceIds: Object.freeze([...group.evidenceIds]), status: diagnostics.length ? "review-required" : "ready", roles: Object.freeze(roles), diagnostics: Object.freeze(diagnostics), promotableItemIds: Object.freeze(promotableItemIds), canonicalObjectIds: Object.freeze([...new Set(roles.flatMap((role) => role.canonicalObjectIds))]) });
}
function familyStatuses(assignments) { return Object.freeze(Object.fromEntries(["EL", "EH", "EU", "EK"].map((family) => [family, assignments.some((entry) => entry.family === family) ? (family === "EL" ? "constructive" : "source-evidence") : "missing"]))); }
function fingerprint(record) { return text(record?.source?.sha256 ?? record?.sourceEnvelope?.source?.sha256); }
function text(value) { return String(value ?? "").trim(); }
export default buildGndRouteWorkspaceModel;
