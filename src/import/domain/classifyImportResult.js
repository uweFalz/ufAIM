// src/import/domain/classifyImportResult.js

import { IMPORT_REASONS } from "./importReasons.js";

export function classifyAlignmentForSpot(alignment, { imported } = {}) {
	const crs = resolveEffectiveCRS(imported, alignment);

	if (!alignment?.sparseAlignment) {
		return {
			ok: false,
			code: IMPORT_REASONS.SPARSE_BUILD_FAILED,
			crs: { status: "needed" },
		};
	}

	if (!crs?.authority || !crs?.code) {
		return {
			ok: false,
			code: IMPORT_REASONS.CRS_NEEDED,
			crs: { status: "needed" },
		};
	}

	if (alignment?.transitionMappingOk === false) {
		return {
			ok: false,
			code: IMPORT_REASONS.TRANSITION_MAPPING_NEEDED,
			crs,
		};
	}

	return {
		ok: true,
		code: IMPORT_REASONS.SPOT_READY,
		crs,
	};
}

function resolveEffectiveCRS(imported, alignment) {
	return (
		alignment?.crs ??
		imported?.meta?.crs ??
		imported?.crs ??
		null
	);
}
