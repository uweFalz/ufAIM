// src/import/domain/importItemFactories.js
//
// Small item/candidate factories used by buildImportResultFromParsed.
//
// deliberately NO:
// - parser logic
// - sparse building
// - validation
// - classification

function makeId(prefix) {
	return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function makeWorkingItem({
	kind,
	name,
	sourceFormat,
	sourceFile,
	payload,
	meta = {},
} = {}) {
	return {
		id: makeId("wrk"),
		kind,
		name: name ?? "unnamed",
		source: {
			format: sourceFormat ?? "unknown",
			file: sourceFile ?? null,
		},
		payload,
		status: {
			selected: false,
			validated: false,
			assigned: false,
		},
		meta,
	};
}

export function buildAlignmentSpotCandidate({
	alignment,
	fileName,
	sourceFormat,
	fallbackName = "alignment",
	crs = null,
	classification = {},
} = {}) {
	const sparseAlignment = alignment?.sparseAlignment ?? null;
	if (!sparseAlignment) return null;

	return {
		id: makeId("spot"),
		kind: "alignmentSpotCandidate",
		name: alignment?.name ?? fallbackName,
		source: {
			format: sourceFormat ?? "unknown",
			file: fileName ?? null,
		},
		payload: {
			type: "alignmentSpotCandidatePayload",

			// target object
			sparseAlignment,

			// TEMP legacy bridge payloads
			// remove once downstream uses sparseAlignment-only
			coordGeom: alignment?.coordGeom ?? null,
			geometry: alignment?.geometry ?? null,
			alignmentSource: alignment,
		},
		meta: {
			alignmentName: alignment?.name ?? null,
			objectId: alignment?.name ?? fallbackName,
			crs,
			classification,
		},
	};
}
