export function buildGndRelationReviewModel(record) {
	const candidates = Array.isArray(record?.relationCandidates) ? record.relationCandidates : [];
	const decision = record?.relationDecision ?? null;
	const reviewedCandidateId = decision?.reviewedCandidateId ?? decision?.confirmedCandidateId ?? null;
	return Object.freeze({
		evidenceId: record?.evidenceId ?? null,
		revision: Number(decision?.revision ?? 0),
		reviewedCandidateId,
		status: reviewedCandidateId ? "reviewed" : candidates.length ? "open-candidates" : "missing",
		provenance: decision?.provenance ?? null,
		candidates: Object.freeze(candidates.map((candidate) => Object.freeze({
			id: candidate?.id ?? null,
			from: candidate?.from ?? candidate?.fromId ?? null,
			to: candidate?.to ?? candidate?.toId ?? null,
			type: candidate?.type ?? candidate?.kind ?? null,
			status: String(candidate?.id ?? "") === String(reviewedCandidateId ?? "") ? "reviewed" : "candidate",
			claimScope: candidate?.claimScope ?? "source-association-only",
			intrinsicMappingStatus: candidate?.intrinsicMappingStatus ?? "not-established",
			domainRelationStatus: candidate?.domainRelationStatus ?? "not-established",
			provenance: Object.freeze({
				source: candidate?.source ?? candidate?.provenance?.source ?? record?.source ?? null,
				origin: candidate?.origin ?? candidate?.provenance?.origin ?? null,
				derivedBy: candidate?.derivedBy ?? candidate?.provenance?.derivedBy ?? null,
				method: candidate?.method ?? candidate?.provenance?.method ?? null,
				reasons: candidate?.reasons ?? candidate?.provenance?.reasons ?? null,
			}),
		}))),
	});
}

export default buildGndRelationReviewModel;
