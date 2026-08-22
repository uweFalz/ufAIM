// src/import/build/buildImportResultFromParsed.js
//
// Build canonical import result from one parsed payload.
//
// Purpose:
// - accept parser output
// - normalize to canonical ImportSessionItem list
// - derive sparseAlignment for alignment payloads when possible
// - derive light-weight comparison metadata for later relation inference
// - derive relation candidates between imported items
// - extract embedded landFAT attachment datasets from alignments
// - keep parser/container role strictly separated from internal import session model
//
// NOT:
// - no UI text generation
// - no store mutation
// - no SPOT mutation
// - no vague candidate/workItem abstractions
//
// Rule:
// parser output -> canonical ImportSessionItems + relationCandidates
//
// Notes:
// - landFAT is import interface only
// - sparse / Spot-compatibility decides promotability
// - rejected payloads may be reported, but are not promoted
//
// @baustelle [META_LAYER]
// This file assigns comparison-friendly metadata to profile/cant/staEq/relation
// items, analogous to alignment meta built elsewhere.
// This metadata is NOT canonical project truth.
// It only supports grouping / candidate inference / UI.
//
// @baustelle [RELATION_CANDIDATES]
// relationCandidates are only inferred suggestions.
// They are NOT canonical relations and must not be treated as truth.

import { buildAlignmentImportOutcome } from "./buildAlignmentImportOutcome.js";
import {
	makeProfileImportItem,
	makeCantImportItem,
	makeStaEqImportItem,
	makeRelationImportItem,
	makeRejectedImportItem,
} from "./importItemFactories.js";
import { IMPORT_REASONS } from "./importReasons.js";
import { deriveImportRelations } from "../relations/deriveImportRelations.js";
import { deriveGndAttachmentRelationCandidates } from "../relations/deriveGndAttachmentRelationCandidates.js";
import { buildGndNormalizedSourceLayer } from "../parsers/technet/gndEdit/gnd/buildGndNormalizedSourceLayer.js";

// -----------------------------------------------------------------------------
// public
// -----------------------------------------------------------------------------

export function buildImportResultFromParsed({
	parsed,
	source = {},
} = {}) {
	const meta = {
		sourceFormat: source?.parserId ?? source?.format ?? parsed?.meta?.sourceFormat ?? null,
		fileName: source?.fileName ?? source?.file ?? null,
		containerType: parsed?.type ?? null,
	};

	if (!isObject(parsed)) {
		return makeEmptyResult({
			meta,
			status: "invalid",
			reason: IMPORT_REASONS.INVALID_PARSED_INPUT,
		});
	}

	// -------------------------------------------------------------------------
	// case 1: canonical landFAT container
	// -------------------------------------------------------------------------
	if (parsed.type === "landFAT") {
		return buildResultFromLandFAT({ doc: parsed, source, meta });
	}

	// -------------------------------------------------------------------------
	// case 2: legacy single alignment-like object
	// -------------------------------------------------------------------------
	if (looksLikeSingleAlignmentPayload(parsed)) {
		const outcome = buildAlignmentImportOutcome({
			alignment: parsed,
			source: makeObjectSource(source, {
				objectName: parsed.name ?? parsed.id ?? null,
			}),
			containerSpatialRef: null,
		});

		return finalizeResult({
			meta,
			source,
			items: collectAcceptedItems([outcome]),
			rejected: collectRejectedItems([outcome]),
		});
	}

	// -------------------------------------------------------------------------
	// case 3: unknown / unsupported parser output
	// -------------------------------------------------------------------------
	return makeEmptyResult({
		meta,
		status: "unknown",
		reason: IMPORT_REASONS.UNKNOWN_PARSED_RESULT,
	});
}

// -----------------------------------------------------------------------------
// landFAT
// -----------------------------------------------------------------------------

function buildResultFromLandFAT({ doc, source, meta }) {
	const outcomes = [];

	const containerSpatialRef = deriveContainerSpatialRef(doc);

	const alignments = asArray(doc.alignments);
	const profiles = asArray(doc.profiles);
	const cants = asArray(doc.cants);
	const staEqs = asArray(doc.staEqs ?? doc.staEq ?? doc.stationEquations);
	const relations = asArray(doc.relations);

	const seenProfileKeys = new Set();
	const seenCantKeys = new Set();
	const seenStaEqKeys = new Set();

	// -------------------------------------------------------------------------
	// alignments + embedded datasets
	// -------------------------------------------------------------------------
	for (let i = 0; i < alignments.length; i++) {
		const alignment = alignments[i];
		const objectName = alignment?.name ?? alignment?.id ?? `alignment_${i + 1}`;

		const alignmentSource = makeObjectSource(source, {
			containerId: doc?.meta?.id ?? null,
			objectName,
			index: i,
		});

		outcomes.push(
		buildAlignmentImportOutcome({
			alignment,
			source: alignmentSource,
			containerSpatialRef,
		})
		);

		// -------------------------------------------------------------
		// embedded profile
		// -------------------------------------------------------------
		if (isObject(alignment?.profile)) {
			const embeddedProfile = alignment.profile;
			const payload = normalizeProfilePayload(embeddedProfile, {
				alignment,
				fallbackName: `${objectName}::profile`,
			});

			const dedupeKey = deriveEmbeddedDatasetKey({
				kind: "profile",
				payload,
				alignment,
			});

			if (!seenProfileKeys.has(dedupeKey)) {
				seenProfileKeys.add(dedupeKey);

				outcomes.push(
				makeProfileImportItem({
					source: makeObjectSource(source, {
						containerId: doc?.meta?.id ?? null,
						objectName: payload.name ?? payload.id ?? `${objectName}::profile`,
						index: i,
					}),
					payload,
					meta: deriveProfileMeta({
						payload,
						source: alignmentSource,
						alignment,
						containerSpatialRef,
						embedded: true,
					}),
					status: {
						valid: true,
						promotable: false,
						stage: "validated",
						reason: null,
					},
				})
				);
			}
		}

		// -------------------------------------------------------------
		// embedded cant dataset
		// -------------------------------------------------------------
		if (Array.isArray(alignment?.cant) && alignment.cant.length > 0) {
			const payload = normalizeCantPayload(
			{
				id: alignment?.cantId ?? null,
				name: alignment?.cantName ?? `${objectName}::cant`,
				points: alignment.cant,
				meta: alignment?.cantMeta ?? {},
			},
			{
				alignment,
				fallbackName: `${objectName}::cant`,
			}
			);

			const dedupeKey = deriveEmbeddedDatasetKey({
				kind: "cant",
				payload,
				alignment,
			});

			if (!seenCantKeys.has(dedupeKey)) {
				seenCantKeys.add(dedupeKey);

				outcomes.push(
				makeCantImportItem({
					source: makeObjectSource(source, {
						containerId: doc?.meta?.id ?? null,
						objectName: payload.name ?? payload.id ?? `${objectName}::cant`,
						index: i,
					}),
					payload,
					meta: deriveCantMeta({
						payload,
						source: alignmentSource,
						alignment,
						containerSpatialRef,
						embedded: true,
					}),
					status: {
						valid: true,
						promotable: false,
						stage: "validated",
						reason: null,
					},
				})
				);
			}
		}

		// -------------------------------------------------------------
		// embedded staEq dataset
		// -------------------------------------------------------------
		if (Array.isArray(alignment?.staEquations) && alignment.staEquations.length > 0) {
			const payload = normalizeStaEqPayload(
			{
				id: alignment?.staEqId ?? null,
				name: alignment?.staEqName ?? `${objectName}::staEq`,
				equations: alignment.staEquations,
				meta: alignment?.staEqMeta ?? {},
			},
			{
				alignment,
				fallbackName: `${objectName}::staEq`,
			}
			);

			const dedupeKey = deriveEmbeddedDatasetKey({
				kind: "staEq",
				payload,
				alignment,
			});

			if (!seenStaEqKeys.has(dedupeKey)) {
				seenStaEqKeys.add(dedupeKey);

				outcomes.push(
				makeStaEqImportItem({
					source: makeObjectSource(source, {
						containerId: doc?.meta?.id ?? null,
						objectName: payload.name ?? payload.id ?? `${objectName}::staEq`,
						index: i,
					}),
					payload,
					meta: deriveStaEqMeta({
						payload,
						source: alignmentSource,
						alignment,
						embedded: true,
					}),
					status: {
						valid: true,
						promotable: false,
						stage: "validated",
						reason: null,
					},
				})
				);
			}
		}
	}

	// -------------------------------------------------------------------------
	// root profiles
	// -------------------------------------------------------------------------
	for (let i = 0; i < profiles.length; i++) {
		const profile = profiles[i];
		const objectSource = makeObjectSource(source, {
			containerId: doc?.meta?.id ?? null,
			objectName: profile?.name ?? profile?.id ?? `profile_${i + 1}`,
			index: i,
		});

		if (!isObject(profile)) {
			outcomes.push(
			makeRejectedImportItem({
				kind: "profile",
				source: objectSource,
				payload: {},
				meta: buildRejectedMeta({
					kind: "profile",
					source: objectSource,
				}),
				reason: IMPORT_REASONS.INVALID_PROFILE_INPUT,
			})
			);
			continue;
		}

		const payload = normalizeProfilePayload(profile);
		const dedupeKey = deriveRootDatasetKey("profile", payload);

		if (seenProfileKeys.has(dedupeKey)) continue;
		seenProfileKeys.add(dedupeKey);

		outcomes.push(
		makeProfileImportItem({
			source: objectSource,
			payload,
			meta: deriveProfileMeta({
				payload,
				source: alignmentSource,
				alignment,
				containerSpatialRef,
				embedded: true,
			}),
			status: {
				valid: true,
				promotable: false,
				stage: "validated",
				reason: null,
			},
		})
		);
	}

	// -------------------------------------------------------------------------
	// root cants
	// -------------------------------------------------------------------------
	for (let i = 0; i < cants.length; i++) {
		const cant = cants[i];
		const objectSource = makeObjectSource(source, {
			containerId: doc?.meta?.id ?? null,
			objectName: cant?.name ?? cant?.id ?? `cant_${i + 1}`,
			index: i,
		});

		if (!isObject(cant)) {
			outcomes.push(
			makeRejectedImportItem({
				kind: "cant",
				source: objectSource,
				payload: {},
				meta: buildRejectedMeta({
					kind: "cant",
					source: objectSource,
				}),
				reason: IMPORT_REASONS.INVALID_CANT_INPUT,
			})
			);
			continue;
		}

		const payload = normalizeCantPayload(cant);
		const dedupeKey = deriveRootDatasetKey("cant", payload);

		if (seenCantKeys.has(dedupeKey)) continue;
		seenCantKeys.add(dedupeKey);

		outcomes.push(
		makeCantImportItem({
			source: objectSource,
			payload,
			meta: deriveCantMeta({
				payload,
				source: alignmentSource,
				alignment,
				containerSpatialRef,
				embedded: true,
			}),
			status: {
				valid: true,
				promotable: false,
				stage: "validated",
				reason: null,
			},
		})
		);
	}

	// -------------------------------------------------------------------------
	// root staEqs
	// -------------------------------------------------------------------------
	for (let i = 0; i < staEqs.length; i++) {
		const staEq = staEqs[i];
		const objectSource = makeObjectSource(source, {
			containerId: doc?.meta?.id ?? null,
			objectName: staEq?.name ?? staEq?.id ?? `staEq_${i + 1}`,
			index: i,
		});

		if (!isObject(staEq)) {
			outcomes.push(
			makeRejectedImportItem({
				kind: "staEq",
				source: objectSource,
				payload: {},
				meta: buildRejectedMeta({
					kind: "staEq",
					source: objectSource,
				}),
				reason: IMPORT_REASONS.INVALID_STAEQ_INPUT,
			})
			);
			continue;
		}

		const payload = normalizeStaEqPayload(staEq);
		const dedupeKey = deriveRootDatasetKey("staEq", payload);

		if (seenStaEqKeys.has(dedupeKey)) continue;
		seenStaEqKeys.add(dedupeKey);

		outcomes.push(
		makeStaEqImportItem({
			source: objectSource,
			payload,
			meta: deriveStaEqMeta({
				payload,
				source: objectSource,
				embedded: false,
			}),
			status: {
				valid: true,
				promotable: false,
				stage: "validated",
				reason: null,
			},
		})
		);
	}

	// -------------------------------------------------------------------------
	// root relations
	// -------------------------------------------------------------------------
	for (let i = 0; i < relations.length; i++) {
		const relation = relations[i];
		const objectSource = makeObjectSource(source, {
			containerId: doc?.meta?.id ?? null,
			objectName: relation?.name ?? relation?.id ?? `relation_${i + 1}`,
			index: i,
		});

		if (!isObject(relation)) {
			outcomes.push(
			makeRejectedImportItem({
				kind: "relation",
				source: objectSource,
				payload: {},
				meta: buildRejectedMeta({
					kind: "relation",
					source: objectSource,
				}),
				reason: IMPORT_REASONS.INVALID_RELATION_INPUT,
			})
			);
			continue;
		}

		const payload = normalizeRelationPayload(relation);

		outcomes.push(
		makeRelationImportItem({
			source: objectSource,
			payload,
			meta: deriveRelationMeta({ payload, source: objectSource }),
			status: {
				valid: true,
				promotable: false,
				stage: "validated",
				reason: null,
			},
		})
		);
	}

	const items = collectAcceptedItems(outcomes);
	const sourceLayer = doc?.meta?.sourceEnvelope && String(source?.parserId ?? "").toLowerCase().includes("gnd")
		? buildGndNormalizedSourceLayer(doc.meta.sourceEnvelope)
		: null;
	return finalizeResult({
		meta,
		source,
		items,
		rejected: collectRejectedItems(outcomes),
		explicitRelationCandidates: deriveGndAttachmentRelationCandidates({ alignments, items, sourceLayer, source }),
	});
}

// -----------------------------------------------------------------------------
// normalize payloads
// -----------------------------------------------------------------------------

function normalizeProfilePayload(profile, ctx = {}) {
	const fallbackName =
	ctx?.fallbackName ??
	profile?.name ??
	profile?.id ??
	null;

	const rawPoints =
	profile?.points ??
	profile?.pvi ??
	profile?.profile ??
	profile?.profAlign?.pvis ??
	[];

	return {
		kind: "profile",
		id: profile.id ?? null,
		name: profile.name ?? profile.id ?? fallbackName,
		points: asArray(rawPoints),
		stationReference:
		profile.stationReference ??
		profile.ref ??
		profile?.profAlign?.name ??
		null,
		meta: isObject(profile.meta) ? profile.meta : {},
		extended: isObject(profile.extended) ? profile.extended : {},
	};
}

function normalizeCantPayload(cant, ctx = {}) {
	const fallbackName =
	ctx?.fallbackName ??
	cant?.name ??
	cant?.id ??
	null;

	return {
		kind: "cant",
		id: cant.id ?? null,
		name: cant.name ?? cant.id ?? fallbackName,
		points: asArray(cant.points ?? cant.cant ?? []),
		stationReference: cant.stationReference ?? cant.ref ?? null,
		meta: isObject(cant.meta) ? cant.meta : {},
		extended: isObject(cant.extended) ? cant.extended : {},
	};
}

function normalizeStaEqPayload(staEq, ctx = {}) {
	const fallbackName =
	ctx?.fallbackName ??
	staEq?.name ??
	staEq?.id ??
	null;

	return {
		kind: "staEq",
		id: staEq.id ?? null,
		name: staEq.name ?? staEq.id ?? fallbackName,
		equations: asArray(staEq.equations ?? staEq.items ?? staEq.values ?? []),
		meta: isObject(staEq.meta) ? staEq.meta : {},
		extended: isObject(staEq.extended) ? staEq.extended : {},
	};
}

function normalizeRelationPayload(relation) {
	return {
		kind: "relation",
		id: relation.id ?? null,
		name: relation.name ?? relation.id ?? null,
		relationType: relation.relationType ?? relation.type ?? null,
		fromRef: relation.fromRef ?? relation.from ?? null,
		toRef: relation.toRef ?? relation.to ?? null,
		meta: isObject(relation.meta) ? relation.meta : {},
		extended: isObject(relation.extended) ? relation.extended : {},
	};
}

// -----------------------------------------------------------------------------
// meta derivation
// -----------------------------------------------------------------------------

function deriveProfileMeta({
	payload,
	source,
	alignment = null,
	containerSpatialRef = null,
	embedded = false,
} = {}) {
	const label = deriveGenericLabel(payload, source);
	const sourceGroup = deriveSourceGroup(source, alignment);
	const stationRange = deriveProfileStationRange(payload);
	const roleHint = "profileCandidate";
	const objectSignature = deriveObjectSignature({
		kind: "profile",
		label,
		sourceGroup,
		stationRange,
		roleHint,
	});

	const sourceSpatialRef = deriveSourceSpatialRefEvidence({
		alignment,
		containerSpatialRef,
		embedded,
	});

	return compactObject({
		label,
		roleHint,
		stationRange,
		sourceGroup,
		objectSignature,
		embedded: embedded ? true : null,
		embeddedInAlignmentId: embedded ? alignment?.id ?? null : null,
		embeddedInAlignmentName: embedded ? alignment?.name ?? alignment?.id ?? null : null,
		sourceSpatialRef,
	});
}

function deriveCantMeta({
	payload,
	source,
	alignment = null,
	containerSpatialRef = null,
	embedded = false,
} = {}) {
	const label = deriveGenericLabel(payload, source);
	const sourceGroup = deriveSourceGroup(source, alignment);
	const stationRange = derivePointSeriesStationRange(payload?.points);
	const roleHint = "cantCandidate";
	const objectSignature = deriveObjectSignature({
		kind: "cant",
		label,
		sourceGroup,
		stationRange,
		roleHint,
	});

	const sourceSpatialRef = deriveSourceSpatialRefEvidence({
		alignment,
		containerSpatialRef,
		embedded,
	});

	return compactObject({
		label,
		roleHint,
		stationRange,
		sourceGroup,
		objectSignature,
		embedded: embedded ? true : null,
		embeddedInAlignmentId: embedded ? alignment?.id ?? null : null,
		embeddedInAlignmentName: embedded ? alignment?.name ?? alignment?.id ?? null : null,
		sourceSpatialRef,
	});
}

function deriveStaEqMeta({ payload, source, alignment = null, embedded = false } = {}) {
	const label = deriveGenericLabel(payload, source);
	const sourceGroup = deriveSourceGroup(source, alignment);
	const stationRange = deriveStaEqStationRange(payload);
	const roleHint = "staEqCandidate";
	const objectSignature = deriveObjectSignature({
		kind: "staEq",
		label,
		sourceGroup,
		stationRange,
		roleHint,
	});

	return compactObject({
		label,
		roleHint,
		stationRange,
		sourceGroup,
		objectSignature,
		embedded: embedded ? true : null,
		embeddedInAlignmentId: embedded ? alignment?.id ?? null : null,
		embeddedInAlignmentName: embedded ? alignment?.name ?? alignment?.id ?? null : null,
	});
}

function deriveRelationMeta({ payload, source } = {}) {
	const label = deriveGenericLabel(payload, source);
	const sourceGroup = deriveSourceGroup(source);
	const roleHint = "relationCandidate";
	const objectSignature = deriveObjectSignature({
		kind: "relation",
		label,
		sourceGroup,
		stationRange: null,
		roleHint,
	});

	return compactObject({
		label,
		roleHint,
		sourceGroup,
		objectSignature,
	});
}

function deriveSourceSpatialRefEvidence({
	alignment = null,
	containerSpatialRef = null,
	embedded = false,
} = {}) {
	if (!embedded) return null;

	const alignmentSpatialRef = isObject(alignment?.spatialRef)
	? alignment.spatialRef
	: null;

	const sourceRef = alignmentSpatialRef ?? containerSpatialRef ?? null;

	if (!isObject(sourceRef)) return null;

	const horizontal = firstNonEmptyString(
	sourceRef.horizontalCrsId,
	sourceRef.crsId,
	sourceRef.horizontal,
	sourceRef.horizontalCoordinateSystemName,
	sourceRef.name,
	null
	);

	const vertical = firstNonEmptyString(
	sourceRef.verticalCrsId,
	sourceRef.vertical,
	sourceRef.verticalCoordinateSystemName,
	null
	);

	const horizontalCandidates = asArray(sourceRef.horizontalCandidates);
	const verticalCandidates = asArray(sourceRef.verticalCandidates);

	if (
	!horizontal &&
	!vertical &&
	horizontalCandidates.length === 0 &&
	verticalCandidates.length === 0
	) {
		return null;
	}

	const from = alignmentSpatialRef ? "alignment" : "container";

	return compactObject({
		status: "inherited",
		from,
		originalStatus: sourceRef.status ?? null,
		source: sourceRef.source ?? null,

		horizontalCrsId: horizontal,
		horizontal,
		horizontalCoordinateSystemName: horizontal,

		verticalCrsId: vertical,
		vertical,
		verticalCoordinateSystemName: vertical,

		horizontalCandidates,
		verticalCandidates,

		evidence: [
		compactObject({
			type: "sourceSpatialRef",
			from,
			alignmentId: alignment?.id ?? null,
			alignmentName: alignment?.name ?? null,
			originalStatus: sourceRef.status ?? null,
			source: sourceRef.source ?? null,
		}),
		],
	});
}

function buildRejectedMeta({ kind, source } = {}) {
	const label = firstNonEmptyString(
	source?.objectName,
	stripExtension(source?.fileName),
	null
	);

	const sourceGroup = deriveSourceGroup(source);
	const roleHint = kind ? `${kind}Candidate` : null;
	const objectSignature = deriveObjectSignature({
		kind: nonEmptyOrNull(kind) ?? "item",
		label,
		sourceGroup,
		stationRange: null,
		roleHint,
	});

	return compactObject({
		label,
		roleHint,
		sourceGroup,
		objectSignature,
	});
}

function deriveGenericLabel(payload, source) {
	return firstNonEmptyString(
	payload?.name,
	payload?.id,
	source?.objectName,
	stripExtension(source?.fileName),
	null
	);
}

function deriveSourceGroup(source = {}, alignment = null) {
	const raw = firstNonEmptyString(
	alignment?.name,
	alignment?.id,
	source?.objectName,
	stripExtension(source?.fileName),
	null
	);

	if (!raw) return null;

	return String(raw)
	.replace(/\.(tra|gra|xml|ifcxml|xlsx|xls|landxml)$/i, "")
	.trim() || null;
}

function deriveProfileStationRange(payload) {
	const explicit =
	normalizeStationRange(
	payload?.meta?.stationRange ??
	payload?.extended?.stationRange ??
	null
	);

	if (explicit) return explicit;

	const fromPoints = derivePointSeriesStationRange(payload?.points);
	if (fromPoints) return fromPoints;

	return null;
}

function deriveStaEqStationRange(payload) {
	const explicit =
	normalizeStationRange(
	payload?.meta?.stationRange ??
	payload?.extended?.stationRange ??
	null
	);

	if (explicit) return explicit;

	const equations = asArray(payload?.equations);
	if (!equations.length) return null;

	const vals = [];

	for (const eq of equations) {
		pushFinite(vals, eq?.station);
		pushFinite(vals, eq?.sta);
		pushFinite(vals, eq?.back);
		pushFinite(vals, eq?.ahead);
		pushFinite(vals, eq?.raw);
		pushFinite(vals, eq?.value);

		if (isObject(eq?.station)) pushFinite(vals, eq.station.value);
		if (isObject(eq?.staAhead)) pushFinite(vals, eq.staAhead.value);
		if (isObject(eq?.staBack)) pushFinite(vals, eq.staBack.value);
		if (isObject(eq?.staInternal)) pushFinite(vals, eq.staInternal.value);
		if (isObject(eq?.delta)) pushFinite(vals, eq.delta.value);
	}

	if (!vals.length) return null;

	return {
		sMin: Math.min(...vals),
		sMax: Math.max(...vals),
	};
}

function derivePointSeriesStationRange(points) {
	const arr = asArray(points);
	if (!arr.length) return null;

	const vals = [];

	for (const p of arr) {
		pushFinite(vals, p?.station);
		pushFinite(vals, p?.sta);
		pushFinite(vals, p?.s);
		pushFinite(vals, p?.chainage);

		if (isObject(p?.station)) pushFinite(vals, p.station.value);
		if (isObject(p?.stationValue)) pushFinite(vals, p.stationValue.value);
	}

	if (!vals.length) return null;

	return {
		sMin: Math.min(...vals),
		sMax: Math.max(...vals),
	};
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

// -----------------------------------------------------------------------------
// dedupe keys
// -----------------------------------------------------------------------------

function deriveEmbeddedDatasetKey({ kind, payload, alignment } = {}) {
	const a = nonEmptyOrNull(kind) ?? "item";
	const b = nonEmptyOrNull(payload?.id)
	?? nonEmptyOrNull(payload?.name)
	?? "unnamed";
	const c = nonEmptyOrNull(alignment?.id)
	?? nonEmptyOrNull(alignment?.name)
	?? "alignment";
	return `embedded|${a}|${c}|${b}`;
}

function deriveRootDatasetKey(kind, payload) {
	const a = nonEmptyOrNull(kind) ?? "item";
	const b = nonEmptyOrNull(payload?.id)
	?? nonEmptyOrNull(payload?.name)
	?? "unnamed";
	return `root|${a}|${b}`;
}

function deriveContainerSpatialRef(doc) {
	const cs = isObject(doc?.coordinateSystem) ? doc.coordinateSystem : {};
	const gndCrs = isObject(doc?.extras?.gndCrs) ? doc.extras.gndCrs : {};
	const csExtras = isObject(cs?.extras) ? cs.extras : {};

	const horizontal = firstNonEmptyString(
	cs.horizontalCoordinateSystemName,
	cs.horizontalCrsId,
	cs.crsId,
	cs.name,
	null
	);

	const vertical = firstNonEmptyString(
	cs.verticalCoordinateSystemName,
	cs.verticalCrsId,
	null
	);

	const horizontalCandidates = asArray(
	gndCrs.horizontalCandidates ?? csExtras.horizontalCandidates
	);

	const verticalCandidates = asArray(
	gndCrs.verticalCandidates ?? csExtras.verticalCandidates
	);

	const status =
	firstNonEmptyString(gndCrs.status, csExtras.status, null) ??
	(horizontal ? "declared" : "missing");

	return compactObject({
		status,
		source: firstNonEmptyString(gndCrs.source, csExtras.source, "landFAT.coordinateSystem"),
		horizontal,
		vertical,
		horizontalCoordinateSystemName: horizontal,
		verticalCoordinateSystemName: vertical,
		horizontalCandidates,
		verticalCandidates,
	});
}

// -----------------------------------------------------------------------------
// result assembly
// -----------------------------------------------------------------------------

function finalizeResult({ meta, source, items, rejected, explicitRelationCandidates = [] }) {
	const validItems = asArray(items);
	const rejectedItems = asArray(rejected);

	const relationCandidates = [
		...deriveImportRelations({
		items: validItems,
		source,
		}),
		...asArray(explicitRelationCandidates),
	];

	if (validItems.length === 0 && rejectedItems.length === 0) {
		return makeEmptyResult({
			meta,
			status: "no-items",
			reason: IMPORT_REASONS.NO_IMPORT_ITEMS,
		});
	}

	return {
		ok: validItems.length > 0,
		status: validItems.length > 0 ? "ok" : "rejected",
		reason: validItems.length > 0 ? null : IMPORT_REASONS.NO_PROMOTABLE_ITEMS,

		meta: {
			...meta,
			count: {
				items: validItems.length,
				rejected: rejectedItems.length,
				relationCandidates: relationCandidates.length,
			},
		},

		items: validItems,
		rejected: rejectedItems,
		relationCandidates,
	};
}

function makeEmptyResult({ meta, status, reason }) {
	return {
		ok: false,
		status: status ?? "no-items",
		reason: reason ?? IMPORT_REASONS.NO_IMPORT_ITEMS,
		meta: {
			...meta,
			count: {
				items: 0,
				rejected: 0,
				relationCandidates: 0,
			},
		},
		items: [],
		rejected: [],
		relationCandidates: [],
	};
}

function collectAcceptedItems(outcomes) {
	const out = [];

	for (const result of asArray(outcomes)) {
		const item = unwrapItem(result);
		if (!item) continue;

		if (item.status?.valid === false) continue;
		if (item.status?.reason === IMPORT_REASONS.REJECTED) continue;

		out.push(item);
	}

	return out;
}

function collectRejectedItems(outcomes) {
	const out = [];

	for (const result of asArray(outcomes)) {
		const item = unwrapItem(result);
		if (!item) continue;

		if (item.status?.valid === false || item.status?.reason === IMPORT_REASONS.REJECTED) {
			out.push(item);
		}
	}

	return out;
}

function unwrapItem(result) {
	if (isObject(result?.item)) return result.item;
	if (isObject(result)) return result;
	return null;
}

// -----------------------------------------------------------------------------
// source / shape helpers
// -----------------------------------------------------------------------------

function makeObjectSource(source = {}, extra = {}) {
	return {
		fileName: source.fileName ?? source.file ?? null,
		parserId: source.parserId ?? source.format ?? null,
		containerId: extra.containerId ?? null,
		objectName: extra.objectName ?? null,
		index: Number.isInteger(extra.index) ? extra.index : null,
	};
}

function looksLikeSingleAlignmentPayload(parsed) {
	if (!isObject(parsed)) return false;
	if (parsed.type === "landFAT") return false;
	if (Array.isArray(parsed.coordGeom)) return true;
	if (isObject(parsed.coordGeom)) return true;
	if (isObject(parsed.sparseAlignment)) return true;
	return false;
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

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
