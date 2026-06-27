// src/import/analysis/gnd/GndCrsAnalyzer.js
//
// GndCrsAnalyzer
//
// Purpose
// - diagnostic CRS analysis for GND import items
// - expose CRS distribution across alignment/profile/cant items
// - detect missing / ambiguous CRS hints
// - support future relation-confidence decisions
//
// NOT
// - no mutation
// - no CRS transformation
// - no CRS guessing
// - no SPOT interaction
// - no runtime behavior changes
//
// @baustelle [PHASE-2]
// Pure diagnostics.
// CRS is evidence, not truth.

export function analyzeGndCrs({
	importItems = [],
	relationCandidates = [],
} = {}) {
	const items = arr(importItems);
	const relations = arr(relationCandidates);

	const alignments = items.filter((i) => i?.kind === "alignment");
	const profiles = items.filter((i) => i?.kind === "profile");
	const cants = items.filter((i) => i?.kind === "cant");
	const staEqs = items.filter((i) => i?.kind === "staEq");

	return {
		totalItems: items.length,
		totalRelations: relations.length,

		byKind: countBy(items, (i) => i?.kind ?? "unknown"),

		byCrs: countBy(items, deriveItemCrsId),
		alignmentsByCrs: countBy(alignments, deriveItemCrsId),
		profilesByCrs: countBy(profiles, deriveItemCrsId),
		cantsByCrs: countBy(cants, deriveItemCrsId),
		staEqsByCrs: countBy(staEqs, deriveItemCrsId),

		missingCrsCount: items.filter((i) => !deriveItemCrsId(i)).length,
		missingCrsByKind: countBy(
			items.filter((i) => !deriveItemCrsId(i)),
			(i) => i?.kind ?? "unknown"
		),

		crsSamples: makeCrsSamples(items),
		relationCrsStats: analyzeRelationCrs({ items, relations }),
	};
}

function analyzeRelationCrs({ items, relations }) {
	const byId = new Map(items.map((item) => [item?.id, item]));

	let sameCrs = 0;
	let differentCrs = 0;
	let missingCrs = 0;

	const differentCrsRelations = [];

	for (const rel of relations) {
		const fromId = getFromId(rel);
		const toId = getToId(rel);

		const from = byId.get(fromId);
		const to = byId.get(toId);

		const fromCrs = deriveItemCrsId(from);
		const toCrs = deriveItemCrsId(to);

		if (!fromCrs || !toCrs) {
			missingCrs += 1;
			continue;
		}

		if (fromCrs === toCrs) {
			sameCrs += 1;
			continue;
		}

		differentCrs += 1;

		differentCrsRelations.push({
			relationId: rel?.id ?? null,
			relationType: rel?.relationType ?? rel?.type ?? null,

			fromId,
			fromName: getItemName(from),
			fromKind: from?.kind ?? null,
			fromCrs,

			toId,
			toName: getItemName(to),
			toKind: to?.kind ?? null,
			toCrs,

			sourceGroup:
				from?.meta?.sourceGroup ??
				to?.meta?.sourceGroup ??
				null,

			confidence: rel?.confidence ?? null,
			reasons: rel?.reasons ?? null,

			evidenceSource: {
				from: deriveCrsEvidenceSource(from),
				to: deriveCrsEvidenceSource(to),
			},
		});
	}

	return {
		total: relations.length,
		sameCrs,
		differentCrs,
		missingCrs,
		differentCrsRelations,
	};
}

function makeCrsSamples(items) {
	return items.slice(0, 20).map((item) => ({
		id: item?.id ?? null,
		kind: item?.kind ?? null,
		name: item?.payload?.name ?? item?.payload?.id ?? item?.id ?? null,
		crsId: deriveItemCrsId(item),
		sourceGroup: item?.meta?.sourceGroup ?? null,
		roleHint: item?.meta?.roleHint ?? null,
	}));
}

function deriveItemCrsId(item) {
	const sr =
		item?.derived?.spatialRef ??
		item?.payload?.spatialRef ??
		item?.spatialRef ??
		item?.meta?.sourceSpatialRef ??
		null;

	return (
		item?.crsId ??
		sr?.crsId ??
		sr?.horizontalCrsId ??
		sr?.horizontal ??
		sr?.horizontalCoordinateSystemName ??
		item?.meta?.crsId ??
		item?.meta?.horizontalCrsId ??
		item?.meta?.horizontal ??
		null
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

function getItemName(item) {
	return (
		item?.payload?.name ??
		item?.payload?.id ??
		item?.meta?.label ??
		item?.id ??
		null
	);
}

function deriveCrsEvidenceSource(item) {
	if (item?.derived?.spatialRef) return "derived.spatialRef";
	if (item?.payload?.spatialRef) return "payload.spatialRef";
	if (item?.spatialRef) return "item.spatialRef";
	if (item?.meta?.sourceSpatialRef) return "meta.sourceSpatialRef";
	if (item?.crsId) return "item.crsId";
	if (item?.meta?.crsId) return "meta.crsId";
	if (item?.meta?.horizontalCrsId) return "meta.horizontalCrsId";
	if (item?.meta?.horizontal) return "meta.horizontal";
	return null;
}

function countBy(list, keyFn) {
	const out = {};

	for (const item of arr(list)) {
		const key = String(keyFn(item) ?? "missing");
		out[key] = (out[key] ?? 0) + 1;
	}

	return out;
}

function arr(x) {
	return Array.isArray(x) ? x : [];
}
