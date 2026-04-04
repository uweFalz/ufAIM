// src/import/domain/classifyImportResult.js

/**
 * @baustelle [VALIDATION]
 * SPOT_READY darf nur nach bestandenem Sparse-Kernvertrag vergeben werden.
 * Reines Vorhandensein von alignment.sparseAlignment reicht nicht aus.
 *
 * @baustelle [CRS]
 * Fehlendes CRS wird aktuell als "assumed" behandelt.
 * Später ggf. eigener ImportReason / eigener Workflow.
 */

import { validateSparseAlignment } from "@kernel/validation/validateSparseAlignment.js";

import { IMPORT_REASONS } from "./importReasons.js";

export function classifyAlignmentForSpot(alignment, { imported } = {}) {
	const crs = resolveEffectiveCRS(imported, alignment);
	const sparse = alignment?.sparseAlignment ?? null;

	if (!sparse) {
		return {
			ok: false,
			code: IMPORT_REASONS.SPARSE_BUILD_FAILED,
			crs: { status: "needed" },
			validation: {
				ok: false,
				errors: [{ code: "missing_sparse", message: "alignment.sparseAlignment missing" }],
				warnings: [],
			},
		};
	}

	let validation;
	try {
		validation = validateSparseAlignment(sparse);
	} catch (err) {
		return {
			ok: false,
			code: IMPORT_REASONS.SPARSE_BUILD_FAILED,
			crs: crs ?? { status: "needed" },
			validation: {
				ok: false,
				errors: [{ code: "validator_threw", message: String(err?.message ?? err) }],
				warnings: [],
			},
		};
	}

	if (!validation?.ok) {
		return {
			ok: false,
			code: IMPORT_REASONS.SPARSE_BUILD_FAILED,
			crs: crs ?? { status: "needed" },
			validation,
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
			code: IMPORT_REASONS.SPOT_READY, // @baustelle später evtl. CRS_ASSUMED
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
