const REASON = "conflicting-reference-evidence";

export function assessGndReferenceEvidence({ result, parsed = null, sourceEnvelope = null } = {}) {
	const items = Array.isArray(result?.items) ? result.items : [];
	const envelope = sourceEnvelope ?? parsed?.meta?.sourceEnvelope ?? result?.sourceEnvelope ?? null;
	const padCandidates = readPadReferenceCandidates(envelope);
	const conflictingPads = new Map(
		[...padCandidates].filter(([, candidates]) => candidates.size > 1)
	);
	const affectedItemIds = [];
	const affectedCandidates = new Set();
	const affectedCandidatesByItemId = {};
	const ambiguousItemIds = [];
	const unsupportedItemIds = [];

	for (const item of items) {
		if (item?.kind !== "alignment") continue;
		const pads = itemPads(item, parsed);
		const conflicts = pads.flatMap((pad) => [...(conflictingPads.get(pad) ?? [])]);
		const itemCandidates = itemReferenceCandidates(item);
		const spatialStatus = normalized(item?.derived?.spatialRef?.status ?? item?.payload?.spatialRef?.status)?.toLowerCase();
		const unsupported = /unsupported|graphical/.test(spatialStatus ?? "");
		const ambiguous = !unsupported && (/ambiguous/.test(spatialStatus ?? "") || itemCandidates.length > 1);
		if (unsupported) unsupportedItemIds.push(item.id);
		if (ambiguous) ambiguousItemIds.push(item.id);
		if (conflicts.length || ambiguous) {
			affectedItemIds.push(item.id);
			const candidates = conflicts.length ? conflicts : itemCandidates;
			affectedCandidatesByItemId[item.id] = [...new Set(candidates)].sort();
			for (const candidate of candidates) affectedCandidates.add(candidate);
		}
	}

	const canonicalCandidates = new Set(
		items
			.filter((item) => item?.kind === "alignment")
			.flatMap((item) => itemReferenceCandidates(item))
	);
	const envelopeCandidates = new Set([...padCandidates.values()].flatMap((values) => [...values]));
	const allCandidates = new Set([...envelopeCandidates, ...canonicalCandidates]);
	const hasAffectedCandidates = affectedItemIds.length > 0;
	const source = envelope ? "source-envelope" : parsed?.meta?.analysis ? "parsed-analysis" : "canonical-items";
	const state = hasAffectedCandidates
		? conflictingPads.size > 0
			? "conflicting"
			: "ambiguous"
		: unsupportedItemIds.length > 0
			? "unsupported"
		: allCandidates.size === 0
			? "missing"
			: "unique";

	return {
		state,
		candidateHorizontalReferenceSystems: [...allCandidates].sort(),
		candidateVerticalReferenceSystems: readVerticalCandidates(parsed),
		source,
		affectedItemIds,
		affectedCandidatesByItemId,
		ambiguousItemIds,
		unsupportedItemIds,
		reason: hasAffectedCandidates ? REASON : null,
		anySafelyPromotable: items.some((item) =>
			item?.kind === "alignment" &&
			item?.status?.promotable === true &&
			!affectedItemIds.includes(item.id)
		),
	};
}

function readPadReferenceCandidates(envelope) {
	const result = new Map();
	const table = envelope?.tables?.find?.((entry) => entry?.name === "X_ASC12_PL");
	for (const row of table?.rows ?? []) {
		const values = Object.fromEntries((row?.cells ?? []).map((cell) => [cell?.columnName, cell?.value]));
		const pad = normalized(values.PAD);
		const lsys = normalized(values.LSYS);
		if (!pad || !lsys) continue;
		if (!result.has(pad)) result.set(pad, new Set());
		result.get(pad).add(lsys);
	}
	return result;
}

function itemPads(item, parsed) {
	const parsedAlignment = (parsed?.alignments ?? []).find((alignment) =>
		String(alignment?.id ?? "") === String(item?.payload?.id ?? item?.source?.objectName ?? "")
	);
	const sequence =
		item?.payload?.extended?.gndSequence ??
		item?.derived?.gndSequence ??
		parsedAlignment?.extras?.gndSequence ??
		null;
	return [sequence?.padStart, sequence?.padEnd].map(normalized).filter(Boolean);
}

function itemReferenceCandidates(item) {
	const spatialRef = item?.derived?.spatialRef ?? item?.payload?.spatialRef ?? {};
	return [...new Set([
		...(spatialRef?.candidateHorizontalReferenceSystems ?? []),
		spatialRef?.horizontalCrsId,
		spatialRef?.crsId,
		spatialRef?.horizontalCoordinateSystemName,
	].map(normalized).filter(Boolean))];
}

function readVerticalCandidates(parsed) {
	const candidates = parsed?.extras?.gndCrs?.verticalCandidates ?? [];
	return [...new Set(candidates.map(normalized).filter(Boolean))].sort();
}

function normalized(value) {
	const text = String(value ?? "").trim();
	return text || null;
}
