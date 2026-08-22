const FAMILIES = ["EL", "EH", "EU", "EK"];
import { buildGndSevenLineRoleAssembly } from "./buildGndSevenLineRoleAssembly.js";

export function buildPromotedGndWorkspaceEvidence(spotObject) {
	const snapshot = readSourceEvidenceSnapshot(spotObject);
	if (!snapshot || snapshot?.schema !== "ufAIM.spot-import-evidence") return null;
	const compactFamilies = Array.isArray(snapshot.familyEvidence) ? snapshot.familyEvidence : [];
	const families = Object.fromEntries(FAMILIES.map((family) => {
		const source = compactFamilies.find((entry) => String(entry?.family ?? "").toUpperCase() === family) ?? null;
		const status = normalizeFamilyStatus(family, source?.status);
		return [family, { status, code: source?.diagnosticCodes?.[0] ?? null, reason: status === "missing" ? `${family} source evidence missing` : null, evidenceId: snapshot.evidenceId ?? null, sourceRefs: [...(source?.sourceRefs ?? [])], rowCount: Number(source?.rowCount ?? 0), unresolvedCount: Number(source?.unresolvedCount ?? 0) }];
	}));
	const relation = snapshot.relationEvidence ?? { status: "missing", candidateCount: 0, candidates: [] };
	const reviewedCandidateId = relation.reviewedCandidateId ?? relation.confirmedCandidateId ?? null;
	const targetItemId = String(spotObject?.meta?.importItemId ?? "").trim();
	const relationCandidates = [...(relation.candidates ?? [])].filter((candidate) => {
		const candidateTarget = String(candidate?.to ?? candidate?.toId ?? "").trim();
		return targetItemId && candidateTarget === targetItemId;
	});
	const targetReviewedCandidateId = relationCandidates.some((candidate) => String(candidate?.id ?? "") === String(reviewedCandidateId ?? "")) ? reviewedCandidateId : null;
	const reviewProvenance = relation.reviewProvenance ?? relation.decisionProvenance ?? null;
	const decisionCandidateId = reviewProvenance?.candidateId ?? null;
	const targetDecisionApplies = Boolean(targetReviewedCandidateId) || relationCandidates.some((candidate) => String(candidate?.id ?? "") === String(decisionCandidateId ?? ""));
	const relationStatus = targetReviewedCandidateId ? "reviewed" : relationCandidates.length ? "open-candidates" : "missing";
	const hasRelationEvidence = relationStatus === "open-candidates" || relationStatus === "reviewed";
	const relationProjection = Object.freeze({
		status: hasRelationEvidence ? "partial-evidence" : "missing",
		relationStatus,
		reason: relationStatus === "reviewed" ? "Source association explicitly reviewed; intrinsic mapping and domain relation remain not established" : relationStatus === "open-candidates" ? "Source association candidates require explicit review" : "No qualified source association evidence",
		evidenceId: snapshot.evidenceId ?? null,
		candidateCount: relationCandidates.length,
		reviewedCandidateId: targetReviewedCandidateId,
		reviewRevision: targetDecisionApplies ? Number(relation.reviewRevision ?? relation.decisionRevision ?? 0) : 0,
		reviewProvenance: targetDecisionApplies ? reviewProvenance : null,
		claimScope: "source-association-only",
		intrinsicMappingStatus: "not-established",
		domainRelationStatus: "not-established",
		candidates: Object.freeze(relationCandidates.map((candidate) => Object.freeze({
			...candidate,
			status: String(candidate?.id ?? "") === String(targetReviewedCandidateId ?? "") ? "reviewed" : "candidate",
			claimScope: candidate?.claimScope ?? "source-association-only",
			intrinsicMappingStatus: candidate?.intrinsicMappingStatus ?? "not-established",
			domainRelationStatus: candidate?.domainRelationStatus ?? "not-established",
		}))),
	});
	const sevenLineRoleAssembly = buildGndSevenLineRoleAssembly({ ...(snapshot.sevenLineRoleEvidence ?? {}), relationEvidence: { ...relation, status: relationStatus, reviewedCandidateId: targetReviewedCandidateId, candidates: relationCandidates } }, { targetItemId });
	const targetAssignments = (snapshot.sevenLineRoleEvidence?.assignments ?? []).filter((entry) => (entry?.targetItemIds ?? []).some((id) => String(id) === targetItemId));
	const routes = [...new Set(targetAssignments.map((entry) => String(entry?.route ?? "").trim()).filter(Boolean))];
	const roles = [...new Set(targetAssignments.map((entry) => String(entry?.directionCode ?? "").trim()).filter(Boolean))];
	const routeContext = Object.freeze({ route: routes.length === 1 ? routes[0] : null, sourceRole: roles.length === 1 ? roles[0] : null, status: routes.length === 1 && roles.length === 1 ? "constructive" : "review-required" });
	return Object.freeze({ evidenceId: snapshot.evidenceId ?? null, provenance: snapshot.source ?? null, routeContext, sevenLineRoleEvidence: snapshot.sevenLineRoleEvidence ?? null, sevenLineRoleAssembly, ...families, relation: relationProjection });
}

function readSourceEvidenceSnapshot(spotObject) {
	return spotObject?.meta?.sourceEvidence
		?? spotObject?.data?.sourceEvidence
		?? spotObject?.data?.alignmentData?.meta?.sourceEvidence
		?? null;
}

function normalizeFamilyStatus(family, status) {
	if (family === "EL") return status === "constructive" ? "constructive" : status === "partial-evidence" ? "partial-evidence" : "missing";
	return status === "missing" ? "missing" : "partial-evidence";
}

export default buildPromotedGndWorkspaceEvidence;
