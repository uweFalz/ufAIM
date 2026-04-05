// src/import/domain/buildAlignmentImportOutcome.js

import { buildSparseFromLandFAT } from "./buildSparseFromLandFAT.js";
import { classifyAlignmentForSpot } from "./classifyImportResult.js";
import { IMPORT_REASONS } from "./importReasons.js";
import {
	makeWorkingItem,
	buildAlignmentSpotCandidate,
} from "./importItemFactories.js";

import { validateSparseAlignment } from "@kernel/validation/validateSparseAlignment.js";

const DEBUG_IMPORT_DETAILS = false;
const DEBUG_IMPORT_FLOW = false;

export function buildAlignmentImportOutcome({
	alignment,
	index = 0,
	imported,
	sourceFormat = "unknown",
	sourceFile = null,
	log = () => {},
} = {}) {
	const name = alignment?.name ?? `alignment_${index + 1}`;

	if (DEBUG_IMPORT_FLOW) {
		log(`alignment: ${name}`);
	}

	let sparseValidation = null;

	if (alignment?.sparseAlignment) {
		sparseValidation = validateSparseAlignment(alignment.sparseAlignment);
		alignment.sparseValidation = sparseValidation;

		if (!sparseValidation?.ok) {
			log(`sparse invalid: ${name}`);
			if (DEBUG_IMPORT_DETAILS) {
				log(`sparse detail: ${JSON.stringify(sparseValidation.errors ?? [])}`);
			}
			alignment.sparseAlignment = null;
		}
	}

	if (!alignment?.sparseAlignment) {
		try {
			alignment.sparseAlignment = buildSparseFromLandFAT(alignment);

			if (alignment?.sparseAlignment) {
				sparseValidation = validateSparseAlignment(alignment.sparseAlignment);
				alignment.sparseValidation = sparseValidation;

				if (!sparseValidation?.ok) {
					log(`sparse invalid after build: ${name}`);
					if (DEBUG_IMPORT_DETAILS) {
						log(`sparse detail: ${JSON.stringify(sparseValidation.errors ?? [])}`);
					}
					alignment.sparseAlignment = null;
				}
			}
		} catch (err) {
			log(`buildSparse failed: ${name} / ${String(err?.message ?? err)}`);

			if (DEBUG_IMPORT_DETAILS) {
				log(
					`coordGeom.count=${
						Array.isArray(alignment?.coordGeom?.elements)
							? alignment.coordGeom.elements.length
							: 0
					}`
				);
			}

			alignment.sparseAlignment = null;
		}
	}

	const verdict = classifyAlignmentForSpot(alignment, { imported });

	const sparseOk =
		!!alignment?.sparseAlignment &&
		!!alignment?.sparseAlignment?.startPose &&
		Array.isArray(alignment?.sparseAlignment?.sparse) &&
		alignment.sparseAlignment.sparse.length > 0;

	if (sparseOk && verdict?.code === IMPORT_REASONS.SPARSE_BUILD_FAILED) {
		verdict.ok = true;
		verdict.code = "SPARSE_READY";
	}

	const isProblemCase =
		!verdict?.validation?.ok ||
		!sparseOk ||
		verdict?.code !== "SPOT_READY";

	if (isProblemCase) {
		log(
			`alignment problem: ${name} / verdict=${verdict?.code ?? "UNKNOWN"} / sparse=${!!alignment?.sparseAlignment}`
		);

		if (DEBUG_IMPORT_DETAILS && verdict?.validation?.errors?.length) {
			log(`alignment detail: ${JSON.stringify(verdict.validation.errors)}`);
		}
	}

	if (verdict?.ok) {
		try {
			const spotCandidate = buildAlignmentSpotCandidate({
				alignment,
				fileName: sourceFile,
				sourceFormat,
				fallbackName: name,
				crs: verdict.crs,
				classification: {
					roleCandidate: "unassigned",
					confidence: null,
				},
			});

			if (spotCandidate) {
				log(`spotCandidate: ${spotCandidate.kind} :: ${spotCandidate.name}`);
			}

			return {
				name,
				verdict,
				spotCandidate: spotCandidate ?? null,
				workingItem: null,
			};
		} catch (err) {
			log(`spotCandidate build failed: ${name} / ${String(err?.message ?? err)}`);
		}
	}

	return {
		name,
		verdict,
		spotCandidate: null,
		workingItem: makeWorkingItem({
			kind: "landFATAlignment",
			name,
			sourceFormat,
			sourceFile,
			payload: alignment,
			meta: {
				alignmentName: alignment?.name ?? null,
				crs: verdict?.crs ?? { status: "needed" },
				giftCabinetReason:
					verdict?.code ?? IMPORT_REASONS.SPARSE_BUILD_FAILED,
			},
		}),
	};
}
