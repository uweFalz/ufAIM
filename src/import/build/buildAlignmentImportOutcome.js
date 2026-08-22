// src/import/build/buildAlignmentImportOutcome.js
//
// Build one canonical alignment import outcome.
//
// Purpose:
// - convert one normalized alignment-like payload into exactly one
//   ImportSessionItem result
// - derive sparseAlignment when possible
// - validate sparseAlignment
// - derive a first machine-readable interpretation hint
// - derive light-weight import metadata for later matching / grouping
// - derive minimal SPOT-admission-relevant import assessment
// - return hard machine-readable outcome
//
// NOT:
// - no UI messaging
// - no session mutation
// - no multi-item orchestration
// - no vague candidate/workItem abstractions
//
// Rule:
// input = one normalized alignment payload
// output = one canonical alignment ImportSessionItem wrapper
//
// @baustelle [INTERPRETATION_LAYER]
// This file is the first lightweight bridge from raw alignment-like payload
// toward semantic alignment interpretation.
// It does NOT resolve full dataset graphs yet, but it already exposes:
// - geometric minimum viability
// - attachment presence
// - coarse interpretation hints
//
// @baustelle [META_LAYER]
// This file also derives comparison-friendly import metadata.
// This metadata is NOT canonical project truth.
// It is only meant to support later grouping / relation inference / UI.
//
// @baustelle [SPOT_ADMISSION_LAYER]
// This file also emits minimal derived data needed for SPOT admission policy:
// - importAssessment.sourceTrustClass
// - spatialRef.status
//
// @baustelle [SPOT_FUTURE]
// Later, sparse conversion should ideally operate on resolved interpretation
// objects instead of raw landFAT-like alignment blobs.

import { buildSparseFromLandFAT } from "./buildSparseFromLandFAT.js";
import { validateSparseAlignment } from "@src/model/spot/validation/validateSparseAlignment.js";
import {
	makeAlignmentImportItem,
	makeRejectedImportItem,
} from "./importItemFactories.js";
import { IMPORT_REASONS } from "./importReasons.js";

const DEBUG_CRS = false;

// -----------------------------------------------------------------------------
// public
// -----------------------------------------------------------------------------

export function buildAlignmentImportOutcome({
	alignment,
	source = {},
	preferredId = null,
	annotations = [],
	containerSpatialRef = null,
} = {}) {
	if (!isObject(alignment)) {
		return makeRejectedImportItem({
			id: preferredId ?? null,
			kind: "alignment",
			source,
			payload: {},
			meta: buildRejectedMeta({ source }),
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

		if (sparseValidation?.ok) {
			promotable = true;
			nextAnnotations.push(
				makeAnnotation("info", "embedded sparseAlignment accepted")
			);
		} else {
			reason = IMPORT_REASONS.SPARSE_INVALID;
			nextAnnotations.push(
				makeAnnotation("error", "embedded sparseAlignment invalid", {
					errors: countArray(sparseValidation?.errors),
					warnings: countArray(sparseValidation?.warnings),
				})
			);
			pushValidationAnnotations(
				nextAnnotations,
				sparseValidation,
				"embedded sparseAlignment"
			);
		}
	} else {
		const sparseBuild = tryBuildSparseAlignment(alignment);

		if (sparseBuild.ok) {
			sparseAlignment = sparseBuild.sparseAlignment;
			sparseValidation = validateSparseAlignment(sparseAlignment);

			if (sparseValidation?.ok) {
				promotable = true;
				nextAnnotations.push(
					makeAnnotation("info", "sparseAlignment derived from alignment payload")
				);
			} else {
				reason = IMPORT_REASONS.SPARSE_INVALID;
				nextAnnotations.push(
					makeAnnotation("error", "derived sparseAlignment invalid", {
						errors: countArray(sparseValidation?.errors),
						warnings: countArray(sparseValidation?.warnings),
					})
				);
				pushValidationAnnotations(
					nextAnnotations,
					sparseValidation,
					"derived sparseAlignment"
				);
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
					makeAnnotation(
						"warn",
						String(sparseBuild.error?.message ?? sparseBuild.error)
					)
				);
			}
		}
	}

	const interpretation = deriveAlignmentInterpretation({
		payload,
		alignment,
		sparseAlignment,
	});

	pushInterpretationAnnotations(nextAnnotations, interpretation);

	const meta = deriveAlignmentMeta({
		payload,
		source,
		interpretation,
		sparseAlignment,
	});

	const spatialRef = deriveImportSpatialRef({
		alignment,
		payload,
		source,
		containerSpatialRef,
	});

	if (DEBUG_CRS) {
	console.log("[CRS DEBUG]", {
		id: itemId,
		fromAlignment: alignment?.spatialRef ?? null,
		fromPayload: payload?.spatialRef ?? null,
		container: containerSpatialRef,
		derived: spatialRef,
	});
}

	const importAssessment = deriveImportAssessment({
		alignment,
		payload,
		source,
		interpretation,
		spatialRef,
		sparseAlignment,
	});

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
		meta,
		sparseAlignment,
		status,
		annotations: nextAnnotations,
		derived: {
			interpretation,
			importAssessment,
			spatialRef,
		},
	});
}

// -----------------------------------------------------------------------------
// sparse build
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

// -----------------------------------------------------------------------------
// interpretation
// -----------------------------------------------------------------------------

function deriveAlignmentInterpretation({
	payload,
	alignment,
	sparseAlignment,
} = {}) {
	const hasCoordGeom = countCoordGeomElements(payload?.coordGeom) > 0;

	const inlineProfile = isObject(alignment?.profile);
	const inlineCant =
		isObject(alignment?.cant) ||
		(Array.isArray(alignment?.cant) && alignment.cant.length > 0);
	const inlineStaEq =
		Array.isArray(alignment?.staEquations) && alignment.staEquations.length > 0;

	const hasProfile = Boolean(payload?.profileRef) || inlineProfile;
	const hasCant = Boolean(payload?.cantRef) || inlineCant;
	const hasStaEq = Boolean(payload?.staEqRef) || inlineStaEq;

	let type = "genericAlignment";
	let completeness = "non_geometric";
	let intent = "unknown";

	if (hasCoordGeom) {
		type = "genericAlignment";
		completeness = "geometry_only";
		intent = "horizontal_geometry";
	}

	if (hasCoordGeom && hasStaEq && !hasProfile && !hasCant) {
		type = "referenceLine";
		completeness = "reference_candidate";
		intent = "reference_geometry";
	}

	if (hasCoordGeom && hasProfile && !hasCant) {
		type = "trackAxis";
		completeness = "track_candidate";
		intent = "track_geometry";
	}

	if (hasCoordGeom && hasProfile && hasCant) {
		type = "trackAxis";
		completeness = "track_enriched";
		intent = "track_geometry";
	}

	if (hasCoordGeom && hasCant && !hasProfile) {
		type = "genericAlignment";
		completeness = "geometry_with_cant";
		intent = "horizontal_geometry";
	}

	return {
		type,
		intent,
		completeness,

		hasCoordGeom,
		hasStaEq,
		hasProfile,
		hasCant,

		coordGeomElementCount: countCoordGeomElements(payload?.coordGeom),
		sparseConvertible: Boolean(sparseAlignment),
	};
}

function pushInterpretationAnnotations(out, interpretation) {
	if (!isObject(interpretation)) return;

	out.push(
		makeAnnotation("info", "alignment interpretation derived", {
			type: interpretation.type,
			completeness: interpretation.completeness,
			intent: interpretation.intent,
		})
	);

	if (!interpretation.hasCoordGeom) {
		out.push(
			makeAnnotation("warn", "alignment has no coordGeom and cannot be geometric")
		);
		return;
	}

	if (interpretation.type === "referenceLine") {
		out.push(
			makeAnnotation("info", "alignment resembles referenceLine semantics")
		);
	}

	if (interpretation.type === "trackAxis" && !interpretation.hasProfile) {
		out.push(
			makeAnnotation("warn", "track-like alignment lacks profile reference")
		);
	}
}

// -----------------------------------------------------------------------------
// meta derivation
// -----------------------------------------------------------------------------

function deriveAlignmentMeta({
	payload,
	source,
	interpretation,
	sparseAlignment,
} = {}) {
	const label = deriveAlignmentLabel(payload, source);
	const sourceGroup = deriveSourceGroup(source);
	const stationRange = deriveAlignmentStationRange(payload, sparseAlignment);
	const spatialRefHint = deriveSpatialRefHint(payload);
	const roleHint = deriveRoleHintFromInterpretation(interpretation);
	const objectSignature = deriveObjectSignature({
		kind: "alignment",
		label,
		sourceGroup,
		stationRange,
		roleHint,
	});

	return compactObject({
		label,
		roleHint,
		stationRange,
		spatialRefHint,
		sourceGroup,
		objectSignature,
	});
}

function buildRejectedMeta({ source } = {}) {
	const sourceGroup = deriveSourceGroup(source);

	return compactObject({
		label: source?.objectName ?? stripExtension(source?.fileName) ?? null,
		sourceGroup,
		objectSignature: sourceGroup ? `alignment|${sourceGroup}|rejected` : null,
	});
}

function deriveAlignmentLabel(payload, source) {
	return firstNonEmptyString(
		payload?.name,
		payload?.id,
		source?.objectName,
		stripExtension(source?.fileName),
		null
	);
}

function deriveRoleHintFromInterpretation(interpretation) {
	if (!isObject(interpretation)) return "genericAlignmentCandidate";

	switch (interpretation.type) {
		case "referenceLine":
			return "referenceLineCandidate";

		case "trackAxis":
			return "trackAxisCandidate";

		default:
			return "genericAlignmentCandidate";
	}
}

function deriveAlignmentStationRange(payload, sparseAlignment) {
	const explicit =
		normalizeStationRange(
			payload?.meta?.stationRange ??
			payload?.extended?.stationRange ??
			null
		);

	if (explicit) return explicit;

	const fromCoordGeom = deriveCoordGeomStationRange(payload?.coordGeom);
	if (fromCoordGeom) return fromCoordGeom;

	const fromSparse = deriveSparseStationRange(sparseAlignment);
	if (fromSparse) return fromSparse;

	return null;
}

function deriveCoordGeomStationRange(coordGeom) {
	const elements = Array.isArray(coordGeom?.elements) ? coordGeom.elements : [];
	if (!elements.length) return null;

	const vals = [];

	for (const seg of elements) {
		pushFinite(vals, seg?.staStart);
		pushFinite(vals, seg?.staEnd);
		pushFinite(vals, seg?.stationStart);
		pushFinite(vals, seg?.stationEnd);

		if (isObject(seg?.startStation)) pushFinite(vals, seg.startStation.value);
		if (isObject(seg?.endStation)) pushFinite(vals, seg.endStation.value);
	}

	if (!vals.length) return null;

	return {
		sMin: Math.min(...vals),
		sMax: Math.max(...vals),
	};
}

function deriveSparseStationRange(sparseAlignment) {
	if (!isObject(sparseAlignment)) return null;

	const total =
		Number.isFinite(sparseAlignment.totalLength) ? sparseAlignment.totalLength :
		Number.isFinite(sparseAlignment.arcLength) ? sparseAlignment.arcLength :
		sumElementLengths(sparseAlignment.elements);

	if (!Number.isFinite(total) || total <= 0) return null;

	return {
		sMin: 0,
		sMax: total,
	};
}

function deriveSpatialRefHint(payload) {
	const sr = payload?.spatialRef;

	if (typeof sr === "string" && sr.trim()) return sr.trim();

	if (isObject(sr)) {
		return firstNonEmptyString(
			sr.horizontalCrsId,
			sr.crsId,
			sr.name,
			sr.code,
			sr.horizontalCoordinateSystemName,
			null
		);
	}

	return null;
}

// -----------------------------------------------------------------------------
// SPOT admission support
// -----------------------------------------------------------------------------

function deriveImportAssessment({
	alignment,
	payload,
	source,
	interpretation,
	spatialRef,
	sparseAlignment,
} = {}) {
	const hasSparse = isObject(sparseAlignment);
	const hasCoordGeom = countCoordGeomElements(payload?.coordGeom) > 0;
	const hasProfile = Boolean(payload?.profileRef) || isObject(alignment?.profile);
	const hasCant =
		Boolean(payload?.cantRef) ||
		isObject(alignment?.cant) ||
		(Array.isArray(alignment?.cant) && alignment.cant.length > 0);
	const hasStaEq =
		Boolean(payload?.staEqRef) ||
		(Array.isArray(alignment?.staEquations) && alignment.staEquations.length > 0);

	const carriesAttachments = hasProfile || hasCant || hasStaEq;
	const hasDeclaredSpatialRef =
	spatialRef?.status === "declared" ||
	spatialRef?.status === "resolved" ||
	Boolean(spatialRef?.horizontalCrsId) ||
	Boolean(spatialRef?.horizontalCoordinateSystemName) ||
	Boolean(spatialRef?.horizontal);

	let sourceTrustClass = "unknown";

	// authoritative_context:
	// geometric object + CRS + enough structured context/attachments
	if (hasSparse && hasDeclaredSpatialRef && carriesAttachments) {
		sourceTrustClass = "authoritative_context";
	}
	// conditional_container:
	// structured object with CRS, but not enough context to call it authoritative
	else if (hasSparse && hasDeclaredSpatialRef) {
		sourceTrustClass = "conditional_container";
	}
	// geometry_only:
	// sparse geometry exists, but no usable CRS context
	else if (hasSparse || hasCoordGeom) {
		sourceTrustClass = "geometry_only";
	}

	return compactObject({
		sourceTrustClass,
		hasSparse,
		hasCoordGeom,
		hasProfile,
		hasCant,
		hasStaEq,
		carriesAttachments,
		hasDeclaredSpatialRef,
		parserHint: nonEmptyOrNull(source?.parserId),
		interpretationType: nonEmptyOrNull(interpretation?.type),
	});
}

function deriveImportSpatialRef({
	alignment,
	payload,
	source,
	containerSpatialRef = null,
} = {}) {
	const raw =
		alignment?.spatialRef ??
		payload?.spatialRef ??
		alignment?.coordinateSystem ??
		containerSpatialRef ??
		null;

	if (typeof raw === "string" && raw.trim()) {
		const value = raw.trim();

		return {
			status: "declared",
			crsId: value,
			horizontalCrsId: value,
			horizontalCoordinateSystemName: value,
			source: source?.parserId ?? null,
		};
	}

	if (isObject(raw)) {
		const horizontal = firstNonEmptyString(
			raw.horizontalCrsId,
			raw.horizontalCoordinateSystemName,
			raw.horizontal,
			raw.crsId,
			raw.name,
			raw.code,
			null
		);

		const vertical = firstNonEmptyString(
			raw.verticalCrsId,
			raw.verticalCoordinateSystemName,
			raw.vertical,
			null
		);

		return compactObject({
			...raw,
			status: raw.status ?? (horizontal ? "declared" : "missing"),
			crsId: raw.crsId ?? horizontal,
			horizontalCrsId: raw.horizontalCrsId ?? horizontal,
			horizontalCoordinateSystemName: raw.horizontalCoordinateSystemName ?? horizontal,
			horizontal: raw.horizontal ?? horizontal,
			verticalCrsId: raw.verticalCrsId ?? vertical,
			verticalCoordinateSystemName: raw.verticalCoordinateSystemName ?? vertical,
			vertical: raw.vertical ?? vertical,
			source: raw.source ?? source?.parserId ?? null,
		});
	}

	return {
		status: "missing",
		source: source?.parserId ?? null,
	};
}

// -----------------------------------------------------------------------------
// payload normalization
// -----------------------------------------------------------------------------

function normalizeAlignmentPayload(alignment) {
	return {
		kind: "alignment",
		id: alignment.id ?? null,
		name: alignment.name ?? alignment.id ?? null,
		spatialRef: alignment.spatialRef ?? alignment.coordinateSystem ?? null,

		coordGeom: normalizeCoordGeom(alignment.coordGeom),

		profileRef: alignment.profileRef ?? inferInlineRef(alignment?.profile, "profile"),
		cantRef: alignment.cantRef ?? inferInlineRef(alignment?.cant, "cant"),
		staEqRef:
			alignment.staEqRef ??
			inferStaEqRef(alignment?.staEquations ?? alignment?.staEq ?? null),

		meta: isObject(alignment.meta) ? alignment.meta : {},
		extended: isObject(alignment.extended) ? alignment.extended : {},
	};
}

function normalizeCoordGeom(coordGeom) {
	if (isObject(coordGeom)) {
		return {
			...coordGeom,
			elements: Array.isArray(coordGeom.elements) ? coordGeom.elements : [],
		};
	}

	if (Array.isArray(coordGeom)) {
		return { elements: coordGeom };
	}

	return { elements: [] };
}

function inferInlineRef(value, fallbackPrefix) {
	if (isObject(value)) {
		return value.id ?? value.name ?? `${fallbackPrefix}_embedded`;
	}

	if (Array.isArray(value) && value.length > 0) {
		const first = value[0];
		if (isObject(first)) {
			return first.id ?? first.name ?? `${fallbackPrefix}_embedded`;
		}
		return `${fallbackPrefix}_embedded`;
	}

	return null;
}

function inferStaEqRef(value) {
	if (Array.isArray(value) && value.length > 0) {
		const first = value[0];
		if (isObject(first)) {
			return first.id ?? first.name ?? "staEq_embedded";
		}
		return "staEq_embedded";
	}

	if (isObject(value)) {
		return value.id ?? value.name ?? "staEq_embedded";
	}

	return null;
}

// -----------------------------------------------------------------------------
// misc helpers
// -----------------------------------------------------------------------------

function deriveSourceGroup(source = {}) {
	const raw = firstNonEmptyString(
		source?.objectName,
		stripExtension(source?.fileName),
		null
	);

	if (!raw) return null;

	return String(raw)
		.replace(/\.(tra|gra|xml|ifcxml|xlsx|xls|landxml)$/i, "")
		.trim() || null;
}

function deriveObjectSignature({
	kind,
	label,
	sourceGroup,
	stationRange,
	roleHint,
} = {}) {
	const a = nonEmptyOrNull(kind) ?? "item";
	const b = nonEmptyOrNull(sourceGroup) ?? nonEmptyOrNull(label) ?? "unlabeled";
	const c = stationRangeToToken(stationRange) ?? "nosta";
	const d = nonEmptyOrNull(roleHint) ?? "norole";
	return `${a}|${b}|${c}|${d}`;
}

function stationRangeToToken(range) {
	if (!isObject(range)) return null;

	const sMin = Number.isFinite(range.sMin) ? formatStaToken(range.sMin) : null;
	const sMax = Number.isFinite(range.sMax) ? formatStaToken(range.sMax) : null;

	if (sMin == null && sMax == null) return null;
	if (sMin != null && sMax != null) return `${sMin}-${sMax}`;
	return sMin != null ? `${sMin}-?` : `?-${sMax}`;
}

function formatStaToken(value) {
	return String(Number(value.toFixed(3)))
		.replace(/[^0-9.\-]+/g, "")
		|| "0";
}

function deriveAlignmentId(payload, source) {
	const seed =
		payload?.id ??
		payload?.name ??
		source?.objectName ??
		source?.fileName ??
		"alignment";

	return `alignment_${slug(seed)}`;
}

function countCoordGeomElements(coordGeom) {
	return Array.isArray(coordGeom?.elements) ? coordGeom.elements.length : 0;
}

function pushValidationAnnotations(out, validation, label) {
	const errors = Array.isArray(validation?.errors) ? validation.errors : [];
	const warnings = Array.isArray(validation?.warnings) ? validation.warnings : [];

	for (const err of errors) {
		out.push(
			makeAnnotation("error", `${label}: ${readValidationMessage(err)}`, {
				code: readValidationCode(err),
				path: readValidationPath(err),
			})
		);
	}

	for (const warn of warnings) {
		out.push(
			makeAnnotation("warn", `${label}: ${readValidationMessage(warn)}`, {
				code: readValidationCode(warn),
				path: readValidationPath(warn),
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

function readValidationMessage(entry) {
	if (typeof entry === "string") return entry;
	return String(entry?.message ?? "validation issue");
}

function readValidationCode(entry) {
	return isObject(entry) ? (entry.code ?? null) : null;
}

function readValidationPath(entry) {
	return isObject(entry) ? (entry.path ?? null) : null;
}

function countArray(value) {
	return Array.isArray(value) ? value.length : 0;
}

function sumElementLengths(elements) {
	const arr = Array.isArray(elements) ? elements : [];
	let sum = 0;

	for (const el of arr) {
		const len = Number(el?.arcLength);
		if (Number.isFinite(len) && len > 0) sum += len;
	}

	return sum > 0 ? sum : null;
}

function normalizeStationRange(value) {
	if (!isObject(value)) return null;

	const sMin = Number.isFinite(value.sMin) ? Number(value.sMin) : null;
	const sMax = Number.isFinite(value.sMax) ? Number(value.sMax) : null;

	if (sMin == null && sMax == null) return null;

	return {
		sMin,
		sMax,
	};
}

function pushFinite(out, value) {
	if (isObject(value) && Number.isFinite(value.value)) {
		out.push(Number(value.value));
		return;
	}

	const n = Number(value);
	if (Number.isFinite(n)) out.push(n);
}

function firstNonEmptyString(...values) {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return null;
}

function nonEmptyOrNull(value) {
	return (typeof value === "string" && value.trim())
		? value.trim()
		: null;
}

function stripExtension(value) {
	const s = firstNonEmptyString(value);
	if (!s) return null;
	return s.replace(/\.[^.]+$/, "");
}

function compactObject(obj) {
	if (!isObject(obj)) return {};
	const out = {};

	for (const [key, value] of Object.entries(obj)) {
		if (value == null) continue;
		if (isObject(value) && Object.keys(value).length === 0) continue;
		out[key] = value;
	}

	return out;
}

function slug(value) {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, "_")
		.replace(/^_+|_+$/g, "") || "unnamed";
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
