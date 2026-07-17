// src/model/spot/model/createAlignmentSpotObject.js

/**
 * Create a canonical Alignment SpotObject entry.
 *
 * This helper preserves the existing SPOT entry shape used by
 * promoteImportItems.js while allowing native editor alignments to use
 * the same construction path.
 *
 * Rules:
 * - data.kernel is the projection / representation input.
 * - data.alignmentData is native editor intent.
 * - data.kernel may be null for valid but not yet renderable editor objects.
 * - The caller remains responsible for crsStatus and meta.
 */
export function createAlignmentSpotObject(input = {}) {
	const {
		id,
		crsId = null,
		crsStatus = null,

		name = null,
		kernel = null,
		alignmentData = null,
		sparseAlignment = null,

		meta = {},
		extended = {},
		refs = {},
	} = input;

	if (!id) {
		throw new Error("createAlignmentSpotObject: missing id");
	}

	const resolvedName =
		name ??
		alignmentData?.name ??
		kernel?.name ??
		id;

	return {
		id: String(id),
		type: "alignment",
		crsId,
		crsStatus,

		data: {
			name: resolvedName,
			kernel,
			alignmentData,
			...(sparseAlignment != null ? { sparseAlignment } : {}),
			meta: isObject(meta) ? { ...meta } : {},
			extended: isObject(extended) ? { ...extended } : {},
		},

		refs: {
			profileRelationIds: [],
			cantRelationIds: [],
			staEquationRelationIds: [],
			...refs,
		},

		meta: isObject(meta) ? { ...meta } : {},
	};
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

export default createAlignmentSpotObject;
