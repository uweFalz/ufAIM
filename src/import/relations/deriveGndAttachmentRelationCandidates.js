const ATTACHMENTS = Object.freeze({
	profile: { family: "EH", associationKind: "profile-source-evidence" },
	cant: { family: "EU", associationKind: "cant-source-evidence" },
});

export function deriveGndAttachmentRelationCandidates({ alignments = [], items = [], sourceLayer = null, source = {} } = {}) {
	const parserAlignments = array(alignments);
	const fingerprint = text(sourceLayer?.sourceDocument?.fingerprint);
	if (!fingerprint || !sourceDocumentMatches({ sourceLayer, source })) return [];
	const records = array(sourceLayer?.records);
	const candidates = [];

	for (let index = 0; index < parserAlignments.length; index += 1) {
		const alignment = parserAlignments[index];
		const sequence = alignment?.extras?.gndSequence;
		const auditKey = text(sequence?.attachmentKey);
		const target = findExactTarget({ alignment, index, items: array(items), sourceLayer, source });
		if (!target) continue;
		const targetRecords = resolveEdgeRecords({ family: "EL", rowRefs: edgeRowRefs(sequence?.edgeChain), records, fingerprint });
		const targetChain = directedChain(targetRecords);
		if (!targetChain) continue;

		for (const [kind, definition] of Object.entries(ATTACHMENTS)) {
			for (const evidence of oneOrMany(alignment?.extras?.unresolvedAttachments?.[kind])) {
				const candidate = deriveCandidate({
					evidence, kind, ...definition,
					auditKey, sequence, target, targetRecords, targetChain, records, sourceLayer, fingerprint,
				});
				if (candidate) candidates.push(candidate);
			}
		}
	}
	return removeCollidingEvidenceClaims(candidates);
}

function deriveCandidate({ evidence, kind, family, associationKind, auditKey, sequence, target, targetRecords, targetChain, records, sourceLayer, fingerprint }) {
	if (!isObject(evidence) || evidence.kind !== kind || evidence.attachmentStatus !== "uniquely-attachable" || evidence.constructive !== false) return null;
	if (text(evidence?.source?.fileName) !== text(sourceLayer?.sourceDocument?.fileName)) return null;
	const sourceElements = array(evidence.sourceElements);
	if (!sourceElements.length || sourceElements.some((entry) => entry?.family !== family)) return null;
	const attachmentRecords = resolveEdgeRecords({ family, rowRefs: sourceElements.map((entry) => text(entry?.rowRef)), records, fingerprint });
	const attachmentChain = directedChain(attachmentRecords);
	if (!attachmentChain || !sameArray(attachmentChain, targetChain)) return null;
	if (!matchesSingleCandidate(evidence?.candidateHorizontalReferenceSystems, sequence?.lsys)) return null;
	if (!matchesSingleStationContext(evidence?.candidateStationContexts, sequence)) return null;
	if (family === "EH" && !matchesSingleCandidate(evidence?.candidateVerticalReferenceSystems, evidence?.sourceReferenceRequirements?.requiredHsys ?? sequence?.hsys)) return null;

	const pads = targetChain;
	const pp = resolvePadContexts({ family: "PP", pads, records, fingerprint, expected: { STRECKE: sequence?.strecke, STRRIKZ: sequence?.strRikz }, valueFields: ["STATION"] });
	const pl = resolvePadContexts({ family: "PL", pads, records, fingerprint, expected: { LSYS: sequence?.lsys }, valueFields: ["Y", "X"] });
	if (!pp || !pl) return null;
	const ph = family === "EH"
		? resolvePadContexts({ family: "PH", pads, records, fingerprint, expected: { HSYS: evidence?.sourceReferenceRequirements?.requiredHsys ?? sequence?.hsys }, valueFields: ["H"] })
		: [];
	if (family === "EH" && !ph) return null;

	const targetSourceIds = targetRecords.map((record) => record.sourceId);
	const attachmentSourceIds = attachmentRecords.map((record) => record.sourceId);
	const identityParts = [fingerprint, ...targetSourceIds, ...attachmentSourceIds, ...pads, ...contextIdentity(pp), ...contextIdentity(pl), ...contextIdentity(ph)];
	const fromId = `gnd-source-evidence:${identityParts.map(encodeURIComponent).join(":")}`;
	const type = "gndSourceEvidenceAssociation";
	return {
		id: `rel_${type}_${associationKind}_${fromId}_${target.id}`,
		kind: "relation", type, relationType: type, associationKind,
		claimScope: "source-association-only", intrinsicMappingStatus: "not-established", domainRelationStatus: "not-established",
		fromId, toId: target.id, context: "routeProject", role: "source-association-review-candidate",
		evidenceClass: "partial-evidence", constructive: false,
		source: {
			fingerprint,
			fileName: sourceLayer.sourceDocument.fileName,
			parserId: target.source.parserId,
			extractorId: sourceLayer.sourceDocument.parserId,
			objectName: target.source.objectName,
			family,
			auditAttachmentKey: auditKey,
			target: edgeProvenance(targetRecords),
			attachment: edgeProvenance(attachmentRecords),
			directedPadChain: [...pads],
			contexts: { pp, pl, ph },
		},
		origin: "parser-qualified-gnd-raw-source-evidence",
		derivedBy: "deriveGndAttachmentRelationCandidates",
		method: "exact-fingerprint-source-record-directed-chain-and-raw-context",
		reasons: ["source-fingerprint-present", "exact-source-record-resolution", "exact-directed-pad-chain", "unique-conflict-free-raw-context"],
		status: { valid: true, accepted: false, stage: "candidate" },
	};
}

function sourceDocumentMatches({ sourceLayer, source }) {
	const document = sourceLayer?.sourceDocument;
	return Boolean(text(document?.fileName)
		&& text(document?.parserId)
		&& text(source?.fileName) === text(document.fileName)
		&& text(source?.parserId).toLowerCase().includes("gnd"));
}

function findExactTarget({ alignment, index, items, sourceLayer, source }) {
	const objectName = alignment?.name ?? alignment?.id ?? `alignment_${index + 1}`;
	const expectedName = alignment?.name ?? alignment?.id ?? null;
	const matches = items.filter((item) => item?.kind === "alignment"
		&& item?.source?.index === index && item?.source?.objectName === objectName
		&& item?.source?.fileName === sourceLayer.sourceDocument.fileName
		&& item?.source?.parserId === source.parserId
		&& sameOptional(item?.payload?.id, alignment?.id) && sameOptional(item?.payload?.name, expectedName));
	return matches.length === 1 ? matches[0] : null;
}

function resolveEdgeRecords({ family, rowRefs, records, fingerprint = null }) {
	if (!rowRefs.length || rowRefs.some((ref) => !ref)) return null;
	const resolved = [];
	for (const rowRef of rowRefs) {
		const [sheet, rowText] = rowRef.split(":");
		const row = Number(rowText);
		const matches = records.filter((record) => record?.family === family && record?.sheet === sheet && record?.row === row);
		if (matches.length !== 1 || !text(matches[0]?.sourceId)) return null;
		if (fingerprint && !text(matches[0].sourceId).startsWith(`${fingerprint}:`)) return null;
		resolved.push(matches[0]);
	}
	return resolved;
}

function directedChain(records) {
	if (!records?.length) return null;
	const chain = [];
	for (const record of records) {
		const a = text(record?.normalized?.PAD1), b = text(record?.normalized?.PAD2);
		if (!a || !b || (chain.length && chain.at(-1) !== a)) return null;
		if (!chain.length) chain.push(a);
		chain.push(b);
	}
	return chain;
}

function resolvePadContexts({ family, pads, records, fingerprint, expected, valueFields }) {
	const out = [];
	for (const pad of pads) {
		const padRecords = records.filter((record) => record?.family === family && text(record?.normalized?.PAD) === pad);
		if (!padRecords.length) return null;
		if (padRecords.some((record) => !text(record?.sourceId).startsWith(`${fingerprint}:`))) return null;
		const signatures = new Set(padRecords.map((record) => JSON.stringify({
			...Object.fromEntries(Object.entries(expected).map(([field]) => [field, normalizedValue(record, field)])),
			...Object.fromEntries(valueFields.map((field) => [field, normalizedValue(record, field)])),
		})));
		if (signatures.size !== 1) return null;
		const record = padRecords[0];
		for (const [field, value] of Object.entries(expected)) if (text(normalizedValue(record, field)) !== text(value)) return null;
		for (const field of valueFields) if (normalizedValue(record, field) == null) return null;
		out.push({
			pad, classification: padRecords.length > 1 ? "duplicate-equal" : "unique",
			sourceIds: padRecords.map((entry) => entry.sourceId),
			locators: padRecords.map((entry) => ({ sheet: entry.sheet, row: entry.row })),
			identity: Object.fromEntries(Object.keys(expected).map((field) => [field, normalizedValue(record, field)])),
			values: Object.fromEntries(valueFields.map((field) => [field, normalizedValue(record, field)])),
		});
	}
	return out;
}

function matchesSingleCandidate(values, expected) {
	const candidates = [...new Set(array(values).map(text).filter(Boolean))];
	return candidates.length === 1 && candidates[0] === text(expected);
}

function matchesSingleStationContext(values, sequence) {
	const contexts = array(values);
	if (contexts.length !== 1) return false;
	return text(contexts[0]?.strecke) === text(sequence?.strecke)
		&& text(contexts[0]?.strRikz) === text(sequence?.strRikz);
}

function normalizedValue(record, field) {
	if (field === "STRECKE") return record?.normalized?.STRECKE ?? record?.normalized?.PSTRECKE ?? null;
	if (field === "STRRIKZ") return record?.normalized?.STRRIKZ ?? record?.normalized?.PSTRRIKZ ?? null;
	return record?.normalized?.[field] ?? null;
}

function edgeProvenance(records) {
	return records.map((record) => ({ sourceId: record.sourceId, rowRef: `${record.sheet}:${record.row}`, locator: { sheet: record.sheet, row: record.row } }));
}

function contextIdentity(contexts) {
	return array(contexts).flatMap((entry) => [...entry.sourceIds, JSON.stringify(entry.identity), JSON.stringify(entry.values)]);
}

function removeCollidingEvidenceClaims(candidates) {
	const counts = new Map();
	for (const candidate of candidates) {
		const signature = `${candidate.associationKind}|${candidate.fromId}`;
		counts.set(signature, (counts.get(signature) ?? 0) + 1);
	}
	return candidates.filter((candidate) => counts.get(`${candidate.associationKind}|${candidate.fromId}`) === 1);
}

function edgeRowRefs(edges) { return array(edges).map((edge) => text(edge?.extras?.rowRef)); }
function sameArray(a, b) { return a.length === b.length && a.every((value, index) => value === b[index]); }
function sameOptional(actual, expected) { return expected == null ? actual == null : actual === expected; }
function array(value) { return Array.isArray(value) ? value : []; }
function oneOrMany(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }
function text(value) { return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim(); }
function isObject(value) { return value && typeof value === "object" && !Array.isArray(value); }
