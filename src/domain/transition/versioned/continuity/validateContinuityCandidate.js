const STATES = new Set([
	"solved",
	"solved-with-residual",
	"underdetermined",
	"overdetermined",
	"inconsistent",
	"not-converged",
	"invalid-input",
]);

export function validateContinuityCandidate(candidate) {
	const errors = [];
	if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
		return { ok: false, errors: [{ code: "CONTINUITY_CANDIDATE_INVALID", reason: "candidate must be an object" }] };
	}
	requiredString(candidate.candidateId, "candidateId", errors);
	requiredString(candidate.sourceProblemId, "sourceProblemId", errors);
	requiredString(candidate.transitionRecordId, "transitionRecordId", errors);
	if (!STATES.has(candidate.state)) errors.push({ code: "CONTINUITY_CANDIDATE_STATE_INVALID", path: "state", reason: `unsupported candidate state '${candidate.state}'` });
	for (const field of ["solvedParameters", "unchangedKnownParameters", "unchangedFixedParameters", "provenance", "convergence", "objective"]) {
		if (!isObject(candidate[field])) errors.push({ code: "CONTINUITY_CANDIDATE_FIELD_INVALID", path: field, reason: `${field} must be an object` });
	}
	for (const field of ["remainingFreeParameters", "activeConstraints", "endpointResiduals", "joinResiduals", "warnings", "diagnostics", "evaluatorQuantities", "requestedOutputQuantities"]) {
		if (!Array.isArray(candidate[field])) errors.push({ code: "CONTINUITY_CANDIDATE_FIELD_INVALID", path: field, reason: `${field} must be an array` });
	}
	for (const [index, residual] of (candidate.joinResiduals ?? []).entries()) {
		if (!residual?.joinId || !residual?.quantity || !(residual.residual == null || Number.isFinite(residual.residual))) {
			errors.push({ code: "CONTINUITY_JOIN_RESIDUAL_INVALID", path: `joinResiduals[${index}]`, reason: "join residual requires joinId, quantity and finite-or-null residual" });
		}
	}
	if (candidate.reviewStatus !== "unreviewed-calculation-candidate" || candidate.authoritative !== false) {
		errors.push({ code: "CONTINUITY_CANDIDATE_AUTHORITY_INVALID", path: "reviewStatus", reason: "solver candidate must remain unreviewed and non-authoritative" });
	}
	try {
		JSON.stringify(candidate);
	} catch {
		errors.push({ code: "CONTINUITY_CANDIDATE_NOT_SERIALIZABLE", reason: "candidate must be JSON serializable" });
	}
	return { ok: errors.length === 0, errors };
}

function requiredString(value, path, errors) {
	if (!String(value ?? "").trim()) errors.push({ code: "CONTINUITY_CANDIDATE_FIELD_REQUIRED", path, reason: `${path} is required` });
}

function isObject(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
