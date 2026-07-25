export const IMPORT_ELIGIBILITY_REASONS = Object.freeze({
	CONFLICTING_REFERENCE_EVIDENCE: "conflicting-reference-evidence",
});

export function applyImportTruthfulnessEligibility(result, referenceEvidence = result?.meta?.referenceEvidence ?? null) {
	if (!result || !Array.isArray(result.items)) return result;
	if (!["ambiguous", "conflicting"].includes(referenceEvidence?.state)) return result;

	const reason = IMPORT_ELIGIBILITY_REASONS.CONFLICTING_REFERENCE_EVIDENCE;
	const affected = new Set(referenceEvidence.affectedItemIds ?? []);
	result.items = result.items.map((item) => {
		if (item?.kind !== "alignment" || !affected.has(item.id)) return item;
		return {
			...item,
			payload: withConflictingSpatialRef(item.payload, referenceEvidence, item.id),
			derived: withConflictingSpatialRef(item.derived, referenceEvidence, item.id),
			status: {
				...(item.status ?? {}),
				promotable: false,
				reason,
				eligibility: { eligible: false, reason },
			},
		};
	});
	result.meta = {
		...(result.meta ?? {}),
		truthfulnessEligibility: {
			eligible: referenceEvidence.anySafelyPromotable === true,
			reason,
			affectedItemIds: [...affected],
			candidateReferenceSystems: referenceEvidence.candidateHorizontalReferenceSystems ?? [],
			referenceEvidenceState: referenceEvidence.state,
			source: referenceEvidence.source,
		},
	};
	return result;
}

function withConflictingSpatialRef(container, assessment, itemId) {
	if (!container || typeof container !== "object") return container;
	const spatialRef = container.spatialRef;
	if (!spatialRef || typeof spatialRef !== "object") return container;
	return {
		...container,
		spatialRef: {
			...spatialRef,
			status: "conflicting",
			crsId: null,
			horizontalCrsId: null,
			horizontalCoordinateSystemName: null,
			horizontal: null,
			candidateHorizontalReferenceSystems:
				assessment.affectedCandidatesByItemId?.[itemId] ??
				assessment.candidateHorizontalReferenceSystems ??
				[],
			resolution: {
				...(spatialRef.resolution ?? {}),
				status: "conflicting",
				resolvedEpsg: null,
				reason: IMPORT_ELIGIBILITY_REASONS.CONFLICTING_REFERENCE_EVIDENCE,
			},
		},
	};
}
