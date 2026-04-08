// src/import/domain/buildAlignmentImportOutcome.js
//
// Build one canonical alignment import outcome.
//
// Purpose:
// - convert one normalized alignment-like payload into exactly one
//   ImportSessionItem result
// - derive sparseAlignment when possible
// - validate sparseAlignment
// - return hard machine-readable outcome
//
// NOT:
// - no UI messaging
// - no session mutation
// - no multi-item orchestration
// - no vague "candidate/workItem" abstractions
//
// Rule:
// input = one normalized alignment payload
// output = one canonical alignment ImportSessionItem wrapper

import { buildSparseFromLandFAT } from "./buildSparseFromLandFAT.js";
import { validateSparseAlignment } from "@src/spot/validation/validateSparseAlignment.js";
import {
	makeAlignmentImportItem,
	makeRejectedImportItem,
} from "./importItemFactories.js";
import { IMPORT_REASONS } from "./importReasons.js";

export function buildAlignmentImportOutcome({
	alignment,
	source = {},
	preferredId = null,
	annotations = [],
} = {}) {
	if (!isObject(alignment)) {
		return makeRejectedImportItem({
			id: preferredId ?? null,
			kind: "alignment",
			source,
			payload: {},
			reason: IMPORT_REASONS.INVALID_ALIGNMENT_INPUT,
			annotations: [
				...normalizeAnnotations(annotations),
				makeAnnotation("error", "alignment input missing or invalid"),
			],
		});
	}

	const payload = normalizeAlignmentPayload(alignment);
	const itemId = preferredId ?? deriveAlignmentId(payload, source);

	let sparseAlignment = null;
	let sparseValidation = null;
	let promotable = false;
	let reason = null;

	const nextAnnotations = [...normalizeAnnotations(annotations)];

	if (isObject(alignment.sparseAlignment)) {
		sparseAlignment = alignment.sparseAlignment;
		sparseValidation = validateSparseAlignment(sparseAlignment);

		if (sparseValidation.ok) {
			promotable = true;
		} else {
			reason = IMPORT_REASONS.SPARSE_INVALID;
			nextAnnotations.push(
				makeAnnotation("error", "embedded sparseAlignment invalid", {
					errors: sparseValidation.errors?.length ?? 0,
					warnings: sparseValidation.warnings?.length ?? 0,
				})
			);
			pushValidationAnnotations(nextAnnotations, sparseValidation, "embedded sparseAlignment");
		}
	} else {
		const sparseBuild = tryBuildSparseAlignment(alignment);

		if (sparseBuild.ok) {
			sparseAlignment = sparseBuild.sparseAlignment;
			sparseValidation = validateSparseAlignment(sparseAlignment);

			if (sparseValidation.ok) {
				promotable = true;
				nextAnnotations.push(
					makeAnnotation("info", "sparseAlignment derived from alignment payload")
				);
			} else {
				reason = IMPORT_REASONS.SPARSE_INVALID;
				nextAnnotations.push(
					makeAnnotation("error", "derived sparseAlignment invalid", {
						errors: sparseValidation.errors?.length ?? 0,
						warnings: sparseValidation.warnings?.length ?? 0,
					})
				);
				pushValidationAnnotations(nextAnnotations, sparseValidation, "derived sparseAlignment");
			}
		} else {
			reason = sparseBuild.reason ?? IMPORT_REASONS.SPARSE_BUILD_FAILED;
			nextAnnotations.push(
				makeAnnotation("warn", "sparseAlignment could not be derived", {
					reason,
				})
			);
			if (sparseBuild.error) {
				nextAnnotations.push(
					makeAnnotation("warn", String(sparseBuild.error.message ?? sparseBuild.error))
				);
			}
		}
	}

	const status = {
		valid: true,
		promotable,
		stage: promotable ? "derived" : "validated",
		reason: promotable ? null : (reason ?? IMPORT_REASONS.NOT_PROMOTABLE),
	};

	return makeAlignmentImportItem({
		id: itemId,
		source,
		payload,
		sparseAlignment,
		status,
		annotations: nextAnnotations,
	});
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function tryBuildSparseAlignment(alignment) {
	try {
		const sparseAlignment = buildSparseFromLandFAT(alignment);

		if (!isObject(sparseAlignment)) {
			return {
				ok: false,
				reason: IMPORT_REASONS.SPARSE_BUILD_FAILED,
				error: new Error("buildSparseFromLandFAT returned no sparseAlignment"),
			};
		}

		return {
			ok: true,
			sparseAlignment,
		};
	} catch (error) {
		return {
			ok: false,
			reason: IMPORT_REASONS.SPARSE_BUILD_FAILED,
			error,
		};
	}
}

function normalizeAlignmentPayload(alignment) {
	return {
		kind: "alignment",
		id: alignment.id ?? null,
		name: alignment.name ?? alignment.id ?? null,
		spatialRef: alignment.spatialRef ?? alignment.coordinateSystem ?? null,

		coordGeom: Array.isArray(alignment.coordGeom) ? alignment.coordGeom : [],

		profileRef: alignment.profileRef ?? null,
		cantRef: alignment.cantRef ?? null,
		staEqRef: alignment.staEqRef ?? null,

		meta: isObject(alignment.meta) ? alignment.meta : {},
		extended: isObject(alignment.extended) ? alignment.extended : {},
	};
}

function deriveAlignmentId(payload, source) {
	const seed =
		payload?.id ||
		payload?.name ||
		source?.objectName ||
		source?.fileName ||
		"alignment";

	return `alignment_${slug(seed)}`;
}

function pushValidationAnnotations(out, validation, label) {
	const errors = Array.isArray(validation?.errors) ? validation.errors : [];
	const warnings = Array.isArray(validation?.warnings) ? validation.warnings : [];

	for (const err of errors) {
		out.push(
			makeAnnotation("error", `${label}: ${err.message}`, {
				code: err.code ?? null,
				path: err.path ?? null,
			})
		);
	}

	for (const warn of warnings) {
		out.push(
			makeAnnotation("warn", `${label}: ${warn.message}`, {
				code: warn.code ?? null,
				path: warn.path ?? null,
			})
		);
	}
}

function normalizeAnnotations(annotations) {
	return Array.isArray(annotations) ? annotations.filter(Boolean) : [];
}

function makeAnnotation(level, message, meta = null) {
	return {
		level: String(level ?? "info"),
		message: String(message ?? ""),
		meta: isObject(meta) ? meta : null,
	};
}

function slug(value) {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		replaceAll(/[^a-z0-9_]+/g, "_")
		replaceAll(/^_+|_+$/g, "") || "unnamed";
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
