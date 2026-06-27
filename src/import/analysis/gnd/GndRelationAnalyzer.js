// src/import/analysis/gnd/GndRelationAnalyzer.js
//
// GndRelationAnalyzer
//
// Purpose
// - diagnostic analysis of relationCandidates
// - understand GND network semantics
// - detect ambiguities / star-relations / duplicate relation groups
// - provide statistics for future hardening
//
// NOT
// - no mutation
// - no filtering
// - no admission decisions
// - no SPOT interaction
// - no runtime behavior changes
//
// Philosophy
// First understand.
// Then classify.
// Then decide.
//
// @baustelle [PHASE-2]
// Pure diagnostics.
// No architectural side effects.

export function analyzeGndRelationCandidates({
	importItems = [],
	relationCandidates = [],
	sampleSize = 10,
} = {}) {
	const relations = arr(relationCandidates);
	const items = arr(importItems);

	const fromIds = new Set();
	const toIds = new Set();

	for (const rel of relations) {
		const fromId = getFromId(rel);
		const toId = getToId(rel);

		if (fromId) fromIds.add(fromId);
		if (toId) toIds.add(toId);
	}

	return {
		totalRelations: relations.length,

		uniqueSourceCount: fromIds.size,
		uniqueTargetCount: toIds.size,

		byType: countBy(relations, getRelationType),
		byConfidence: countBy(relations, (r) => r?.confidence ?? "unknown"),
		byContext: countBy(relations, (r) => r?.context ?? "unknown"),
		byRole: countBy(relations, (r) => r?.role ?? "unknown"),

		itemKindStats: countBy(items, (item) => item?.kind ?? "unknown"),

		duplicateGroups: findDuplicateRelationGroups(relations),
		ambiguousSources: findAmbiguousSources(relations),
		starTargets: findStarTargets(relations),

		sampleRelations: relations.slice(0, sampleSize).map(summarizeRelation),

        duplicateSamples: findDuplicateRelationSamples(relations),
	};
}

// -----------------------------------------------------------------------------
// relation id normalization
// -----------------------------------------------------------------------------

function getRelationType(rel) {
	return (
		rel?.relationType ??
		rel?.type ??
		rel?.kind ??
		"unknown"
	);
}

function getFromId(rel) {
	return (
		rel?.fromId ??
		rel?.sourceId ??
		rel?.from ??
		rel?.source ??
		null
	);
}

function getToId(rel) {
	return (
		rel?.toId ??
		rel?.targetId ??
		rel?.to ??
		rel?.target ??
		null
	);
}

function summarizeRelation(rel) {
	return {
		id: rel?.id ?? null,
		kind: rel?.kind ?? null,
		type: rel?.type ?? null,
		relationType: rel?.relationType ?? null,
		fromId: getFromId(rel),
		toId: getToId(rel),
		context: rel?.context ?? null,
		role: rel?.role ?? null,
		confidence: rel?.confidence ?? null,
		reasons: Array.isArray(rel?.reasons) ? rel.reasons.length : null,
		source: rel?.source ?? null,
		status: rel?.status ?? null,
	};
}

// -----------------------------------------------------------------------------
// diagnostics
// -----------------------------------------------------------------------------

function countBy(list, keyFn) {
	const out = {};

	for (const item of arr(list)) {
		const key = String(keyFn(item) ?? "unknown");
		out[key] = (out[key] ?? 0) + 1;
	}

	return out;
}

function findDuplicateRelationGroups(relations) {
	const groups = new Map();

	for (const rel of arr(relations)) {
		const key = [
			getRelationType(rel),
			getFromId(rel) ?? "unknown",
			getToId(rel) ?? "unknown",
		].join("|");

		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(rel);
	}

	return Array.from(groups.entries())
		.filter(([, list]) => list.length > 1)
		.map(([key, list]) => ({
			key,
			count: list.length,
		}))
		.sort((a, b) => b.count - a.count);
}

function findAmbiguousSources(relations) {
	const map = new Map();

	for (const rel of arr(relations)) {
		const fromId = getFromId(rel);
		if (!fromId) continue;

		if (!map.has(fromId)) map.set(fromId, new Set());
		map.get(fromId).add(getToId(rel) ?? "unknown");
	}

	return Array.from(map.entries())
		.filter(([, targets]) => targets.size > 1)
		.map(([fromId, targets]) => ({
			fromId,
			targetCount: targets.size,
			targets: Array.from(targets).sort(),
		}))
		.sort((a, b) => b.targetCount - a.targetCount);
}

function findStarTargets(relations) {
	const map = new Map();

	for (const rel of arr(relations)) {
		const toId = getToId(rel);
		const fromId = getFromId(rel);

		if (!toId) continue;

		if (!map.has(toId)) map.set(toId, new Set());
		if (fromId) map.get(toId).add(fromId);
	}

	return Array.from(map.entries())
		.filter(([, sources]) => sources.size > 1)
		.map(([toId, sources]) => ({
			toId,
			sourceCount: sources.size,
			sources: Array.from(sources).sort().slice(0, 20),
		}))
		.sort((a, b) => b.sourceCount - a.sourceCount);
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function arr(x) {
	return Array.isArray(x) ? x : [];
}

function findDuplicateRelationSamples(relations) {
	const groups = new Map();

	for (const rel of arr(relations)) {
		const key = [
			getRelationType(rel),
			getFromId(rel) ?? "unknown",
			getToId(rel) ?? "unknown",
		].join("|");

		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(rel);
	}

	return Array.from(groups.entries())
		.filter(([, list]) => list.length > 1)
		.map(([key, list]) => ({
			key,
			count: list.length,
			samples: list.slice(0, 5).map(summarizeRelation),
		}))
		.sort((a, b) => b.count - a.count);
}
