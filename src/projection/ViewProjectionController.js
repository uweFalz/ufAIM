// src/projection/ViewProjectionController.js

import { projectAlignmentToPolyline } from "./AlignmentProjectionService.js";

export function _buildViewGeometry(spotSlice, opts = {}) {
	const alignments = spotSlice.alignments || [];

	return alignments.map(a => ({
		id: a.id,
		geometry: projectAlignmentToPolyline(a, opts)
	}));
}

export function buildViewGeometry(spotSlice) {
	const alignments = spotSlice.alignments || [];

	return alignments.map(a => ({
		id: a.id,
		...projectAlignmentToPolyline(a, { step: 5 })
	}));
}
