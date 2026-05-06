// src/import/relations/deriveImportRelations.js

export function deriveImportRelations({ items = [], source = {} } = {}) {
	const list = Array.isArray(items) ? items : [];
	const relations = [];

	relations.push(...deriveStationReferenceRelations(list, source));
	relations.push(...deriveParallelRelations(list, source));
	relations.push(...deriveSamePhysicalRelations(list, source));

	return relations;
}

function deriveStationReferenceRelations(items, source) {
	const out = [];

	const alignments = items.filter((i) => i?.kind === "alignment");
	const profiles = items.filter((i) => i?.kind === "profile");
	const cants = items.filter((i) => i?.kind === "cant");
	const staEqs = items.filter((i) => i?.kind === "staEq");

	const reference = findReferenceAlignmentCandidate(alignments);

	for (const alignment of alignments) {
		if (!reference || alignment.id === reference.id) continue;

		out.push(makeRelation({
			type: "stationReference",
			fromId: alignment.id,
			toId: reference.id,
			reason: "alignment_station_reference_candidate",
			source,
		}));
	}

	for (const profile of profiles) {
		const target = findBestAlignmentForSeries(profile, alignments) ?? reference;
		if (!target) continue;

		out.push(makeRelation({
			type: "stationReference",
			fromId: profile.id,
			toId: target.id,
			reason: "profile_station_reference_candidate",
			source,
		}));
	}

	for (const cant of cants) {
		const target = findBestAlignmentForSeries(cant, alignments) ?? reference;
		if (!target) continue;

		out.push(makeRelation({
			type: "stationReference",
			fromId: cant.id,
			toId: target.id,
			reason: "cant_station_reference_candidate",
			source,
		}));
	}

	for (const staEq of staEqs) {
		if (!reference) continue;

		out.push(makeRelation({
			type: "stationReference",
			fromId: staEq.id,
			toId: reference.id,
			reason: "staeq_belongs_to_reference_line",
			source,
		}));
	}

	return out;
}

function deriveParallelRelations(items, source) {
	const alignments = items.filter((i) => i?.kind === "alignment");
	const out = [];

	for (let i = 0; i < alignments.length; i += 1) {
		for (let j = i + 1; j < alignments.length; j += 1) {
			const a = alignments[i];
			const b = alignments[j];

			if (!looksLikeParallelPair(a, b)) continue;

			out.push(makeRelation({
				type: "parallelTo",
				fromId: a.id,
				toId: b.id,
				reason: "name_or_station_parallel_candidate",
				source,
			}));
		}
	}

	return out;
}

function deriveSamePhysicalRelations(items, source) {
	const out = [];
	const byNormName = new Map();

	for (const item of items) {
		const key = normalizeName(readLabel(item));
		if (!key) continue;

		const prev = byNormName.get(key);
		if (!prev) {
			byNormName.set(key, item);
			continue;
		}

		if (prev.id !== item.id && prev.kind === item.kind && prev.crsId !== item.crsId) {
			out.push(makeRelation({
				type: "samePhysical",
				fromId: item.id,
				toId: prev.id,
				reason: "same_name_different_crs_candidate",
				source,
			}));
		}
	}

	return out;
}

function makeRelation({
	type,
	fromId,
	toId,
	reason,
	source,
	confidence = 0.5,
} = {}) {
	return {
		id: `rel_${type}_${fromId}_${toId}`,
		kind: "relation",
		type,
		relationType: type,
		fromId,
		toId,
		context: "routeProject",
		role: "candidate",
		confidence,
		reasons: [reason].filter(Boolean),
		source: {
			fileName: source?.fileName ?? null,
			parserId: source?.parserId ?? null,
			objectName: source?.objectName ?? null,
		},
		status: {
			valid: true,
			promotable: true,
			accepted: false,
			stage: "candidate",
		},
	};
}

function findReferenceAlignmentCandidate(alignments) {
	return (
		alignments.find((a) => /km|ref|station|achse|axis/i.test(readLabel(a))) ??
		alignments[0] ??
		null
	);
}

function findBestAlignmentForSeries(series, alignments) {
	const label = normalizeName(readLabel(series));

	return alignments.find((a) => {
		const aLabel = normalizeName(readLabel(a));
		return label && aLabel && (label.includes(aLabel) || aLabel.includes(label));
	}) ?? null;
}

function looksLikeParallelPair(a, b) {
	const la = readLabel(a).toLowerCase();
	const lb = readLabel(b).toLowerCase();

	if ((la.includes("_l") || la.includes("left") || la.includes("li")) &&
		(lb.includes("_r") || lb.includes("right") || lb.includes("re"))) {
		return true;
	}

	if ((lb.includes("_l") || lb.includes("left") || lb.includes("li")) &&
		(la.includes("_r") || la.includes("right") || la.includes("re"))) {
		return true;
	}

	return false;
}

function readLabel(item) {
	return (
		item?.payload?.name ??
		item?.payload?.id ??
		item?.source?.objectName ??
		item?.id ??
		""
	);
}

function normalizeName(value) {
	return String(value ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}
