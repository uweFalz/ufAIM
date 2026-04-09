// src/import/domain/classifyImportResult.js

/**
 * @baustelle [VALIDATION]
 * SPOT_READY darf nur nach bestandenem Sparse-Kernvertrag vergeben werden.
 * Die Sparse-Validierung wird upstream erzeugt und hier nur noch ausgewertet.
 *
 * @baustelle [CRS]
 * Fehlendes CRS wird aktuell als "assumed" behandelt.
 * Später ggf. eigener ImportReason / eigener Workflow.
 */

import { IMPORT_REASONS } from "./importReasons.js";

//
// ...
//
export function classifyAlignmentForSpot(alignment, { imported } = {}) {
	const crs = resolveEffectiveCRS(imported, alignment);
	const sparse = alignment?.sparseAlignment ?? null;
	const validation = alignment?.sparseValidation ?? null;

	if (!sparse) {
		return {
			ok: false,
			code: IMPORT_REASONS.SPARSE_BUILD_FAILED,
			crs: { status: "needed" },
			validation: validation ?? {
				ok: false,
				errors: [{ code: "missing_sparse", message: "alignment.sparseAlignment missing" }],
				warnings: [],
			},
		};
	}

	if (!validation?.ok) {
		return {
			ok: false,
			code: IMPORT_REASONS.SPARSE_BUILD_FAILED,
			crs: crs ?? { status: "needed" },
			validation: validation ?? {
				ok: false,
				errors: [{ code: "missing_validation", message: "alignment.sparseValidation missing" }],
				warnings: [],
			},
		};
	}

	if (alignment?.transitionMappingOk === false) {
		return {
			ok: false,
			code: IMPORT_REASONS.TRANSITION_MAPPING_NEEDED,
			crs: crs ?? { status: "needed" },
			validation,
		};
	}

	if (!crs?.authority || !crs?.code) {
		return {
			ok: true,
			code: IMPORT_REASONS.SPOT_READY,
			crs: { status: "assumed" },
			validation,
		};
	}

	return {
		ok: true,
		code: IMPORT_REASONS.SPOT_READY,
		crs,
		validation,
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
