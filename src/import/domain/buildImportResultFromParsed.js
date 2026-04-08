// src/import/domain/buildImportResultFromParsed.js
//
// Build canonical import result from one parsed payload.
//
// Purpose:
// - accept parser output
// - normalize to canonical ImportSessionItem list
// - derive sparseAlignment for alignment payloads when possible
// - keep parser/container role strictly separated from internal import session model
//
// NOT:
// - no UI text generation
// - no store mutation
// - no SPOT mutation
// - no vague candidate/workItem abstractions
//
// Rule:
// parser output -> canonical ImportSessionItems
//
// Notes:
// - landFAT is import interface only
// - sparse / Spot-compatibility decides promotability
// - rejected payloads may be reported, but are not promoted

import { buildAlignmentImportOutcome } from "./buildAlignmentImportOutcome.js";
import {
	makeProfileImportItem,
	makeCantImportItem,
	makeStaEqImportItem,
	makeRelationImportItem,
	makeRejectedImportItem,
} from "./importItemFactories.js";
import { IMPORT_REASONS } from "./importReasons.js";

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
		});

		return finalizeResult({
			meta,
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

	const alignments = asArray(doc.alignments);
	const profiles = asArray(doc.profiles);
	const cants = asArray(doc.cants);
	const staEqs = asArray(doc.staEqs ?? doc.staEq ?? doc.stationEquations);
	const relations = asArray(doc.relations);

	for (let i = 0; i < alignments.length; i++) {
		const alignment = alignments[i];
		const objectName = alignment?.name ?? alignment?.id ?? `alignment_${i + 1}`;

		outcomes.push(
			buildAlignmentImportOutcome({
				alignment,
				source: makeObjectSource(source, {
					containerId: doc?.meta?.id ?? null,
					objectName,
					index: i,
				}),
			})
		);
	}

	for (let i = 0; i < profiles.length; i++) {
		const profile = profiles[i];
		if (!isObject(profile)) {
			outcomes.push(
				makeRejectedImportItem({
					kind: "profile",
					source: makeObjectSource(source, {
						containerId: doc?.meta?.id ?? null,
						objectName: `profile_${i + 1}`,
						index: i,
					}),
					payload: {},
					reason: IMPORT_REASONS.INVALID_PROFILE_INPUT,
				})
			);
			continue;
		}

		outcomes.push(
			makeProfileImportItem({
				source: makeObjectSource(source, {
					containerId: doc?.meta?.id ?? null,
					objectName: profile.name ?? profile.id ?? `profile_${i + 1}`,
					index: i,
				}),
				payload: normalizeProfilePayload(profile),
				status: {
					valid: true,
					promotable: false,
					stage: "validated",
					reason: null,
				},
			})
		);
	}

	for (let i = 0; i < cants.length; i++) {
		const cant = cants[i];
		if (!isObject(cant)) {
			outcomes.push(
				makeRejectedImportItem({
					kind: "cant",
					source: makeObjectSource(source, {
						containerId: doc?.meta?.id ?? null,
						objectName: `cant_${i + 1}`,
						index: i,
					}),
					payload: {},
					reason: IMPORT_REASONS.INVALID_CANT_INPUT,
				})
			);
			continue;
		}

		outcomes.push(
			makeCantImportItem({
				source: makeObjectSource(source, {
					containerId: doc?.meta?.id ?? null,
					objectName: cant.name ?? cant.id ?? `cant_${i + 1}`,
					index: i,
				}),
				payload: normalizeCantPayload(cant),
				status: {
					valid: true,
					promotable: false,
					stage: "validated",
					reason: null,
				},
			})
		);
	}

	for (let i = 0; i < staEqs.length; i++) {
		const staEq = staEqs[i];
		if (!isObject(staEq)) {
			outcomes.push(
				makeRejectedImportItem({
					kind: "staEq",
					source: makeObjectSource(source, {
						containerId: doc?.meta?.id ?? null,
						objectName: `staEq_${i + 1}`,
						index: i,
					}),
					payload: {},
					reason: IMPORT_REASONS.INVALID_STAEQ_INPUT,
				})
			);
			continue;
		}

		outcomes.push(
			makeStaEqImportItem({
				source: makeObjectSource(source, {
					containerId: doc?.meta?.id ?? null,
					objectName: staEq.name ?? staEq.id ?? `staEq_${i + 1}`,
					index: i,
				}),
				payload: normalizeStaEqPayload(staEq),
				status: {
					valid: true,
					promotable: false,
					stage: "validated",
					reason: null,
				},
			})
		);
	}

	for (let i = 0; i < relations.length; i++) {
		const relation = relations[i];
		if (!isObject(relation)) {
			outcomes.push(
				makeRejectedImportItem({
					kind: "relation",
					source: makeObjectSource(source, {
						containerId: doc?.meta?.id ?? null,
						objectName: `relation_${i + 1}`,
						index: i,
					}),
					payload: {},
					reason: IMPORT_REASONS.INVALID_RELATION_INPUT,
				})
			);
			continue;
		}

		outcomes.push(
			makeRelationImportItem({
				source: makeObjectSource(source, {
					containerId: doc?.meta?.id ?? null,
					objectName: relation.name ?? relation.id ?? `relation_${i + 1}`,
					index: i,
				}),
				payload: normalizeRelationPayload(relation),
				status: {
					valid: true,
					promotable: false,
					stage: "validated",
					reason: null,
				},
			})
		);
	}

	return finalizeResult({
		meta,
		items: collectAcceptedItems(outcomes),
		rejected: collectRejectedItems(outcomes),
	});
}

// -----------------------------------------------------------------------------
// normalize payloads
// -----------------------------------------------------------------------------

function normalizeProfilePayload(profile) {
	return {
		kind: "profile",
		id: profile.id ?? null,
		name: profile.name ?? profile.id ?? null,
		points: asArray(profile.points ?? profile.pvi ?? profile.profile ?? []),
		stationReference: profile.stationReference ?? profile.ref ?? null,
		meta: isObject(profile.meta) ? profile.meta : {},
		extended: isObject(profile.extended) ? profile.extended : {},
	};
}

function normalizeCantPayload(cant) {
	return {
		kind: "cant",
		id: cant.id ?? null,
		name: cant.name ?? cant.id ?? null,
		points: asArray(cant.points ?? cant.cant ?? []),
		stationReference: cant.stationReference ?? cant.ref ?? null,
		meta: isObject(cant.meta) ? cant.meta : {},
		extended: isObject(cant.extended) ? cant.extended : {},
	};
}

function normalizeStaEqPayload(staEq) {
	return {
		kind: "staEq",
		id: staEq.id ?? null,
		name: staEq.name ?? staEq.id ?? null,
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
// result assembly
// -----------------------------------------------------------------------------

function finalizeResult({ meta, items, rejected }) {
	const validItems = asArray(items);
	const rejectedItems = asArray(rejected);

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
			},
		},

		items: validItems,
		rejected: rejectedItems,
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
			},
		},
		items: [],
		rejected: [],
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
	if (isObject(parsed.sparseAlignment)) return true;
	return false;
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
