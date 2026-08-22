const ALLOWED_STATES = new Set(["constructive", "partial-evidence", "missing", "not-covered", "review-required"]);

function capability(name, input, fallback = "missing") {
	const status = ALLOWED_STATES.has(input?.status) ? input.status : fallback;
	return Object.freeze({
		name,
		status,
		code: input?.code ?? null,
		reason: input?.reason ?? null,
		evidenceId: input?.evidenceId ?? null,
		sourceRefs: Object.freeze([...(input?.sourceRefs ?? [])]),
		value: input?.value ?? null,
		provenancePresent: Boolean(input?.provenancePresent || input?.evidenceId || input?.sourceRefs?.length),
		relationStatus: input?.relationStatus ?? null,
		reviewedCandidateId: input?.reviewedCandidateId ?? null,
		reviewRevision: Number(input?.reviewRevision ?? 0),
		claimScope: input?.claimScope ?? null,
		intrinsicMappingStatus: input?.intrinsicMappingStatus ?? null,
		domainRelationStatus: input?.domainRelationStatus ?? null,
		reviewProvenancePresent: Boolean(input?.reviewProvenance),
	});
}

export function buildExistingAlignmentIntelligenceModel({
	mode = "main",
	context = {},
	evidence = {},
	sevenLineRoleAssembly = null,
	projections = {},
} = {}) {
	const objectId = String(context?.objectId ?? "").trim() || null;
	const s = Number(context?.s);
	return Object.freeze({
		status: objectId && Number.isFinite(s) ? "active" : "finding",
		mode: ["main", "q", "l"].includes(mode) ? mode : "main",
		context: Object.freeze({
			objectId,
			revision: context?.revision ?? null,
			s: Number.isFinite(s) ? s : null,
			evidenceId: context?.evidenceId ?? evidence?.evidenceId ?? null,
			provenance: context?.provenance ?? evidence?.provenance ?? null,
			...(context?.route ? { route: context.route } : {}),
			...(context?.sourceRole ? { sourceRole: context.sourceRole } : {}),
		}),
		capabilities: Object.freeze({
			horizontal: capability("EL / horizontal", projections?.horizontal ?? evidence?.EL),
			vertical: capability("EH / profile", projections?.vertical ?? evidence?.EH),
			cant: capability("EU / cant", projections?.cant ?? evidence?.EU),
			chainage: capability("EK / chainage", projections?.chainage ?? evidence?.EK),
			crs: capability("CRS / world", projections?.crs, "not-covered"),
			speed: capability("Speed-qualified state", projections?.speed),
			topology: capability("Topology", projections?.topology, "not-covered"),
			section: capability("Initial cross-section", projections?.section, "not-covered"),
		}),
		sevenLineRoleAssembly,
	});
}

export default buildExistingAlignmentIntelligenceModel;
