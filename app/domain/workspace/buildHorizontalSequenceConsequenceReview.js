export function buildHorizontalSequenceConsequenceReview({ alignmentData = null, spotObject = null } = {}) {
	const editElements = Array.isArray(alignmentData?.editModel?.elements) ? alignmentData.editModel.elements : [];
	const sparse = sparseElements(alignmentData, spotObject); const sparseById = new Map(sparse.map((entry) => [String(entry?.id ?? ""), entry]));
	const rows = editElements.map((element, index) => {
		const id = String(element?.id ?? ""); const type = String(element?.type ?? "unknown").toLowerCase(); const realized = sparseById.get(id) ?? null;
		const realizedKind = String(realized?.kind ?? realized?.type ?? "").toLowerCase();
		const compatibleFixed = (type === "straight" && realizedKind === "straight") || (type === "arc" && realizedKind === "arc");
		const curvature = compatibleFixed && Number.isFinite(realized?.curvature) ? realized.curvature : null;
		return Object.freeze({
			index, id, type,
			length: finite(element?.parameters?.length ?? element?.length ?? element?.arcLength),
			domain: Number.isFinite(realized?.sStart) && Number.isFinite(realized?.sEnd) ? Object.freeze({ startS: realized.sStart, endS: realized.sEnd }) : null,
			startCurvature: curvature, endCurvature: curvature,
			curvatureStatus: curvature === null ? "not-covered" : "available",
			validation: existingFinding(element?.validation), continuity: existingFinding(element?.continuity),
			provenancePresent: Boolean(element?.meta || realized?.meta || element?.provenance || realized?.provenance),
		});
	});
	return Object.freeze({
		objectId: String(spotObject?.id ?? alignmentData?.id ?? "") || null,
		status: rows.length ? "available" : "empty",
		rows: Object.freeze(rows),
		validation: existingFinding(alignmentData?.validation),
		continuity: existingFinding(alignmentData?.continuity),
	});
}

function sparseElements(alignmentData, spotObject) { for (const value of [alignmentData?.sparseAlignment, spotObject?.data?.alignmentData?.sparseAlignment, spotObject?.data?.kernel, spotObject?.kernel]) { const list = value?.elements ?? value?.sparse; if (Array.isArray(list)) return list; } return []; }
function finite(value) { if (value == null || String(value).trim() === "") return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function existingFinding(value) {
	const provenancePresent = Boolean(value?.provenance || value?.source || value?.sourceRefs);
	const explicitResult = Boolean(String(value?.status ?? "").trim()) || typeof value?.ok === "boolean" || Boolean(String(value?.code ?? "").trim());
	if (!value || typeof value !== "object" || !provenancePresent || !explicitResult) return Object.freeze({ status: "not-covered", code: null, provenancePresent: false });
	return Object.freeze({ status: String(value.status ?? (value.ok === true ? "passed" : value.ok === false ? "failed" : "available")), code: value.code ?? null, provenancePresent: true });
}

export default buildHorizontalSequenceConsequenceReview;
