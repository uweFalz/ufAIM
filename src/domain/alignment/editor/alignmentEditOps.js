// src/domain/alignment/editor/alignmentEditOps.js

export function addStraightElement(
	alignmentData,
	{ length = 100, now = new Date().toISOString() } = {}
) {
	if (!alignmentData || alignmentData.type !== "AlignmentData") {
		throw new Error("addStraightElement: missing AlignmentData");
	}

	const currentEditModel = alignmentData.editModel ?? {};
	const currentElements = Array.isArray(currentEditModel.elements)
		? currentEditModel.elements
		: [];

	const straight = {
		type: "straight",
		length: Number(length),
		meta: {
			createdBy: "editor",
			createdAt: now,
		},
	};

	return {
		...alignmentData,

		editModel: {
			...currentEditModel,
			elements: [
				...currentElements,
				straight,
			],
		},

		// Phase 2:
		// keep sparseAlignment deferred.
		// Geometry rebuild comes later from domain rebuild, not ViewController.
		sparseAlignment: alignmentData.sparseAlignment ?? null,

		meta: {
			...(alignmentData.meta ?? {}),
			dirty: true,
			modifiedAt: now,
		},
	};
}
