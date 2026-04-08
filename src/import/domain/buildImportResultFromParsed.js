// src/import/domain/buildImportResultFromParsed.js
// PATCHED: permissive fallback (no more empty import)

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

	if (parsed.type === "landFAT") {
		return buildResultFromLandFAT({ doc: parsed, source, meta });
	}

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

	// 🔥 fallback instead of empty
	return finalizeResult({
		meta,
		items: [{
			kind: "raw",
			source: makeObjectSource(source),
			payload: parsed,
			status: { valid: true, promotable: false, stage: "raw" }
		}],
		rejected: [],
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
		if (!isObject(profile)) continue;

		outcomes.push(
			makeProfileImportItem({
				source: makeObjectSource(source),
				payload: normalizeProfilePayload(profile),
				status: { valid: true, promotable: false, stage: "validated" },
			})
		);
	}

	for (let i = 0; i < cants.length; i++) {
		const cant = cants[i];
		if (!isObject(cant)) continue;

		outcomes.push(
			makeCantImportItem({
				source: makeObjectSource(source),
				payload: normalizeCantPayload(cant),
				status: { valid: true, promotable: false, stage: "validated" },
			})
		);
	}

	for (let i = 0; i < staEqs.length; i++) {
		const staEq = staEqs[i];
		if (!isObject(staEq)) continue;

		outcomes.push(
			makeStaEqImportItem({
				source: makeObjectSource(source),
				payload: normalizeStaEqPayload(staEq),
				status: { valid: true, promotable: false, stage: "validated" },
			})
		);
	}

	for (let i = 0; i < relations.length; i++) {
		const relation = relations[i];
		if (!isObject(relation)) continue;

		outcomes.push(
			makeRelationImportItem({
				source: makeObjectSource(source),
				payload: normalizeRelationPayload(relation),
				status: { valid: true, promotable: false, stage: "validated" },
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
// normalize payloads (unchanged)
// -----------------------------------------------------------------------------

function normalizeProfilePayload(profile) {
	return {
		kind: "profile",
		id: profile.id ?? null,
		name: profile.name ?? profile.id ?? null,
		points: asArray(profile.points ?? profile.pvi ?? profile.profile ?? []),
	};
}

function normalizeCantPayload(cant) {
	return {
		kind: "cant",
		id: cant.id ?? null,
		name: cant.name ?? cant.id ?? null,
		points: asArray(cant.points ?? cant.cant ?? []),
	};
}

function normalizeStaEqPayload(staEq) {
	return {
		kind: "staEq",
		id: staEq.id ?? null,
		name: staEq.name ?? staEq.id ?? null,
		equations: asArray(staEq.equations ?? staEq.items ?? []),
	};
}

function normalizeRelationPayload(relation) {
	return {
		kind: "relation",
		id: relation.id ?? null,
		name: relation.name ?? relation.id ?? null,
	};
}

// -----------------------------------------------------------------------------
// result assembly (patched filter)
// -----------------------------------------------------------------------------

function finalizeResult({ meta, items, rejected }) {
	const validItems = asArray(items);
	const rejectedItems = asArray(rejected);

	return {
		ok: validItems.length > 0,
		status: validItems.length > 0 ? "ok" : "no-items",
		reason: validItems.length > 0 ? null : IMPORT_REASONS.NO_IMPORT_ITEMS,
		meta,
		items: validItems,
		rejected: rejectedItems,
	};
}

function collectAcceptedItems(outcomes) {
	const out = [];

	for (const result of asArray(outcomes)) {
		const item = unwrapItem(result);
		if (!item) continue;

		// 🔥 only hard reject filtered
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

		if (item.status?.reason === IMPORT_REASONS.REJECTED) {
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

function makeEmptyResult({ meta, status, reason }) {
	return {
		ok: false,
		status,
		reason,
		meta,
		items: [],
		rejected: [],
	};
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function makeObjectSource(source = {}, extra = {}) {
	return {
		fileName: source.fileName ?? source.file ?? null,
		parserId: source.parserId ?? source.format ?? null,
		...extra,
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
