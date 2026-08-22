const DEFINITIONS = Object.freeze([
	["gradient-right", "Gradiente rechts", "EH", "1"], ["gradient-left", "Gradiente links", "EH", "2"],
	["cant-left", "Überhöhung links", "EU", "2"], ["curvature-left", "Krümmung links", "EL", "2"],
	["curvature-kilometer", "Krümmung km · Kilometrierung", "EK", "3"], ["curvature-right", "Krümmung rechts", "EL", "1"],
	["cant-right", "Überhöhung rechts", "EU", "1"],
]);

export function buildGndSevenLineRoleAssembly(source, { targetItemId = null } = {}) {
	const embedded = source?.sevenLineRoleEvidence ?? source;
	const evidence = source?.sevenLineRoleEvidence ? { ...embedded, relationEvidence: liveRelationEvidence(source) } : embedded;
	const assignments = Array.isArray(evidence?.assignments) ? evidence.assignments : [];
	const routes = [...new Set(assignments.map((entry) => entry.route).filter(Boolean))];
	if (routes.length !== 1) return assembly(DEFINITIONS.map(([id, label]) => row(id, label, "unassigned", { reason: routes.length ? "mixed-route" : "missing-pp-reference" })), routes[0] ?? null, [routes.length ? "MIXED_ROUTE_REVIEW_REQUIRED" : "PP_REFERENCE_REQUIRED"]);
	const route = routes[0];
	const routeAssignments = assignments.filter((entry) => entry.route === route);
	const codes = new Set(routeAssignments.map((entry) => String(entry.directionCode)));
	const single = codes.has("0") && !codes.has("1") && !codes.has("2");
	const diagnostics = [];
	if (codes.has("1") && codes.has("2") && !codes.has("3")) diagnostics.push("KM_LINE_REQUIRED");
	if (codes.has("4") && !source?.explicitYardClassification) diagnostics.push("YARD_CLASSIFICATION_REVIEW_REQUIRED");
	const rows = DEFINITIONS.map(([id, label, family, directionCode]) => {
		if (single && ["gradient-left", "cant-left", "curvature-left"].includes(id)) return row(id, label, "not-applicable", { trackClass: "single-track", trackSide: "not-applicable", reason: "single-track" });
		let displayCode = directionCode;
		let placement = null;
		if (single && ["gradient-right", "curvature-right", "cant-right"].includes(id)) { displayCode = "0"; placement = "presentation-placement-only"; }
		const candidates = routeAssignments.filter((entry) => entry.family === family && String(entry.directionCode) === displayCode);
		if (family === "EK" && displayCode !== "3") return row(id, label, "unassigned", { reason: "kilometer-line-requires-code-3" });
		if (!candidates.length) return row(id, label, diagnostics.includes("KM_LINE_REQUIRED") && family === "EK" ? "review-required" : "missing", { reason: family === "EK" ? "code-3-evidence-missing" : "source-evidence-missing" });
		if (["EH", "EU"].includes(family)) {
			const reviewed = reviewedAssociation(evidence.relationEvidence, candidates, targetItemId, family);
			if (!reviewed) return row(id, label, "unassigned", { reason: "reviewed-source-association-required", family, trackClass: candidates[0].trackClass });
			return row(id, label, "partial-evidence", { family, trackClass: candidates[0].trackClass, trackSide: single ? "not-applicable" : displayCode === "1" ? "right" : "left", placement, claimScope: "source-association-only", associationId: reviewed.id, sourceRefs: candidates.flatMap((entry) => entry.sourceIds) });
		}
		return row(id, label, family === "EL" ? "constructive" : "partial-evidence", { family, trackClass: candidates[0].trackClass, trackSide: single ? "not-applicable" : displayCode === "1" ? "right" : displayCode === "2" ? "left" : "not-applicable", placement, sourceRefs: candidates.flatMap((entry) => entry.sourceIds) });
	});
	return assembly(rows, route, diagnostics);
}

function liveRelationEvidence(source) {
	const reviewedCandidateId = source?.relationDecision?.reviewedCandidateId ?? source?.relationDecision?.confirmedCandidateId ?? null;
	const candidates = (source?.relationCandidates ?? []).map((candidate) => ({ id: candidate.id, to: candidate.to ?? candidate.toId, family: candidate?.provenance?.source?.family ?? candidate?.source?.family, claimScope: candidate.claimScope, attachmentSourceIds: (candidate?.provenance?.source?.attachment ?? candidate?.source?.attachment ?? []).map((entry) => entry.sourceId) }));
	return { status: reviewedCandidateId ? "reviewed" : candidates.length ? "open-candidates" : "missing", reviewedCandidateId, candidates };
}

function reviewedAssociation(relation, assignments, targetItemId, family) {
	if (relation?.status !== "reviewed" || !relation.reviewedCandidateId || !targetItemId) return null;
	const candidate = (relation.candidates ?? []).find((entry) => entry.id === relation.reviewedCandidateId && (entry.to ?? entry.toId) === targetItemId && entry.claimScope === "source-association-only" && (!entry.family || entry.family === family));
	if (!candidate) return null;
	const sources = new Set(assignments.flatMap((entry) => entry.sourceIds));
	return (candidate.attachmentSourceIds ?? []).every((id) => sources.has(id)) ? candidate : null;
}
function row(id, label, status, extra = {}) { return Object.freeze({ id, label, status, ...extra, sourceRefs: Object.freeze([...(extra.sourceRefs ?? [])]) }); }
function assembly(rows, route, diagnostics) { return Object.freeze({ schema: "ufAIM.gnd-seven-line-role-assembly", route, rows: Object.freeze(rows), diagnostics: Object.freeze(diagnostics), fixedOrder: true }); }
export default buildGndSevenLineRoleAssembly;
