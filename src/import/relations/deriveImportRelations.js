// src/import/relations/deriveImportRelations.js

export function deriveImportRelations({ items = [], source = {} } = {}) {
	const list = Array.isArray(items) ? items : [];
	const relations = [];

	relations.push(...deriveStationReferenceRelations(list, source));
	relations.push(...deriveParallelRelations(list, source));
	relations.push(...deriveSamePhysicalRelations(list, source));

	logDuplicateRelationSignatures(relations);

	return deduplicateRelationsBySignature(relations);
}

function deriveStationReferenceRelations(items, source) {
	const out = [];

	const alignments = items.filter((i) => i?.kind === "alignment");
	const profiles = items.filter((i) => i?.kind === "profile");
	const cants = items.filter((i) => i?.kind === "cant");
	const staEqs = items.filter((i) => i?.kind === "staEq");

	const isGnd = isGndSource(source, items);

	const reference = isGnd
		? null
		: findReferenceAlignmentCandidate(alignments);

	if (!isGnd) {
		for (const alignment of alignments) {
			if (!reference || alignment.id === reference.id) continue;

			out.push(makeRelation({
				type: "stationReference",
				fromId: alignment.id,
				toId: reference.id,
				reason: "alignment_station_reference_candidate",
				source,
				derivedBy: "deriveStationReferenceRelations",
				method: "non_gnd_alignment_reference",
			}));
		}
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
			derivedBy: "deriveStationReferenceRelations",
			method: "profile_best_alignment_for_series",
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
			derivedBy: "deriveStationReferenceRelations",
			method: "cant_best_alignment_for_series",
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
			derivedBy: "deriveStationReferenceRelations",
			method: "staeq_reference_line",
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
				derivedBy: "deriveParallelRelations",
				method: "looks_like_parallel_pair",
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
				derivedBy: "deriveSamePhysicalRelations",
				method: "same_name_different_crs",
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
	derivedBy = null,
	method = null,
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
		origin: "deriveImportRelations",
		derivedBy,
		method,
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

	if (
		(la.includes("_l") || la.includes("left" ) || la.includes("li")) &&
		(lb.includes("_r") || lb.includes("right") || lb.includes("re"))
	) {
		return true;
	}

	if (
		(lb.includes("_l") || lb.includes("left") || lb.includes("li")) &&
		(la.includes("_r") || la.includes("right") || la.includes("re"))
	) {
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

function isGndSource(source, items = []) {
	const text = [
		source?.parserId,
		source?.format,
		source?.fileName,
		source?.file,
		source?.objectName,
		...items.map((i) => i?.source?.parserId),
		...items.map((i) => i?.source?.format),
		...items.map((i) => i?.source?.fileName),
		...items.map((i) => i?.source?.file),
		...items.map((i) => i?.source?.objectName),
		...items.map((i) => i?.meta?.sourceFormat),
	].filter(Boolean).join(" ").toLowerCase();

	return text.includes("gnd");
}

function logDuplicateRelationSignatures(relationCandidates = []) {
	const relations = Array.isArray(relationCandidates) ? relationCandidates : [];
	const groups = new Map();

	for (const rel of relations) {
		const relationType = rel?.relationType ?? rel?.type ?? null;
		const fromId = rel?.fromId ?? rel?.sourceId ?? rel?.from ?? rel?.source ?? null;
		const toId = rel?.toId ?? rel?.targetId ?? rel?.to ?? rel?.target ?? null;

		const signature = [relationType, fromId, toId].join("|");

		if (!groups.has(signature)) {
			groups.set(signature, []);
		}

		groups.get(signature).push(rel);
	}

	const duplicates = [];

	for (const [signature, rels] of groups.entries()) {
		if (rels.length <= 1) continue;

		duplicates.push({
			signature,
			count: rels.length,
			relationIds: rels.map((r) => r?.id ?? null),
			relationTypes: rels.map((r) => r?.relationType ?? r?.type ?? null),
			fromIds: rels.map((r) => r?.fromId ?? r?.sourceId ?? r?.from ?? r?.source ?? null),
			toIds: rels.map((r) => r?.toId ?? r?.targetId ?? r?.to ?? r?.target ?? null),
			confidences: rels.map((r) => r?.confidence ?? null),
			reasons: rels.map((r) => r?.reasons ?? null),
			sourceGroups: rels.map((r) => r?.sourceGroup ?? r?.meta?.sourceGroup ?? null),
			sources: rels.map((r) => ({
				source: r?.source ?? null,
				origin: r?.origin ?? null,
				derivedBy: r?.derivedBy ?? null,
				method: r?.method ?? null,
			})),
		});
	}

	if (!duplicates.length) return;

	console.groupCollapsed("[deriveImportRelations] duplicate relation signatures");

	console.table(duplicates.map((d) => ({
		signature: d.signature,
		count: d.count,
		relationIds: d.relationIds.join(", "),
		relationTypes: d.relationTypes.join(", "),
		fromIds: d.fromIds.join(", "),
		toIds: d.toIds.join(", "),
		confidences: d.confidences.join(", "),
	})));

	console.log("duplicate relation signature details", duplicates);
	console.groupEnd();
}

function deduplicateRelationsBySignature(relationCandidates = []) {
	const relations = Array.isArray(relationCandidates) ? relationCandidates : [];
	const seen = new Set();
	const out = [];

	for (const rel of relations) {
		const signature = makeRelationSignature(rel);
		if (!signature || seen.has(signature)) continue;

		seen.add(signature);
		out.push(rel);
	}

	return out;
}

function makeRelationSignature(rel) {
	const relationType = rel?.relationType ?? rel?.type ?? null;
	const fromId = rel?.fromId ?? rel?.sourceId ?? rel?.from ?? rel?.source ?? null;
	const toId = rel?.toId ?? rel?.targetId ?? rel?.to ?? rel?.target ?? null;

	if (!relationType || !fromId || !toId) return null;
	return `${relationType}|${fromId}|${toId}`;
}
