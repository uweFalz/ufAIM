import { buildGndNormalizedSourceLayer } from "../parsers/technet/gndEdit/gnd/buildGndNormalizedSourceLayer.js";

const TRACK_CLASSES = Object.freeze({ "0": "single-track", "1": "direction-track", "2": "opposite-direction-track", "3": "kilometer-line", "4": "yard-track" });

export function buildGndSevenLineRoleEvidence(evidence) {
	const envelope = evidence?.sourceEnvelope;
	const fingerprint = String(envelope?.source?.sha256 ?? "").trim();
	if (!fingerprint) return null;
	const layer = buildGndNormalizedSourceLayer(envelope);
	const pp = uniquePpContexts(layer.records);
	const relations = evidence.relationEvidence ?? compactRelations(evidence);
	const assignments = [];
	for (const family of ["EL", "EH", "EU", "EK"]) {
		for (const group of groupEdges(layer.records.filter((record) => record.family === family))) {
			const contexts = [...new Set(group.pads.map((pad) => pp.get(pad)?.signature).filter(Boolean))];
			if (contexts.length !== 1 || group.pads.some((pad) => !pp.has(pad))) continue;
			const context = pp.get(group.pads[0]);
			const targetItemIds = family === "EL" ? exactTargetsForSourceIds(relations.candidates, group.sourceIds) : [];
			assignments.push({ family, route: context.route, directionCode: context.directionCode, trackClass: TRACK_CLASSES[context.directionCode] ?? "unclassified", targetItemIds, sourceIds: group.sourceIds, rowRefs: group.rowRefs, directedPadChain: group.pads, ppSourceIds: group.pads.flatMap((pad) => pp.get(pad).sourceIds), status: family === "EL" ? "constructive" : "source-evidence" });
		}
	}
	return Object.freeze({ schema: "ufAIM.gnd-seven-line-role-evidence", version: 1, fingerprint, assignments: Object.freeze(assignments.map(freeze)), relationEvidence: relations, provenance: Object.freeze({ method: "exact-pp-route-direction-and-directed-source-chain", filenameInference: false, orderInference: false, proximityInference: false }) });
}

function compactRelations(evidence) {
	const candidates = (evidence?.relationCandidates ?? []).map((candidate) => ({ id: candidate.id, to: candidate.to ?? candidate.toId, associationKind: candidate.associationKind, family: candidate?.provenance?.source?.family ?? candidate?.source?.family, targetSourceIds: candidate?.provenance?.source?.target?.map?.((entry) => entry.sourceId) ?? candidate?.source?.target?.map?.((entry) => entry.sourceId) ?? [], attachmentSourceIds: candidate?.provenance?.source?.attachment?.map?.((entry) => entry.sourceId) ?? candidate?.source?.attachment?.map?.((entry) => entry.sourceId) ?? [], claimScope: candidate.claimScope }));
	const reviewedCandidateId = evidence?.relationDecision?.reviewedCandidateId ?? null;
	return { status: reviewedCandidateId ? "reviewed" : candidates.length ? "open-candidates" : "missing", reviewedCandidateId, candidates };
}

function uniquePpContexts(records) {
	const grouped = new Map();
	for (const record of records.filter((entry) => entry.family === "PP")) {
		const pad = text(record?.normalized?.PAD), route = text(record?.normalized?.STRECKE ?? record?.normalized?.PSTRECKE), directionCode = text(record?.normalized?.STRRIKZ ?? record?.normalized?.PSTRRIKZ);
		if (!pad || !route || !Object.hasOwn(TRACK_CLASSES, directionCode)) continue;
		const entry = grouped.get(pad) ?? [];
		entry.push({ route, directionCode, sourceId: record.sourceId }); grouped.set(pad, entry);
	}
	const result = new Map();
	for (const [pad, values] of grouped) {
		const signatures = [...new Set(values.map((entry) => `${entry.route}|${entry.directionCode}`))];
		if (signatures.length === 1) result.set(pad, { ...values[0], signature: signatures[0], sourceIds: values.map((entry) => entry.sourceId) });
	}
	return result;
}

function groupEdges(records) {
	return records.map((record) => { const a = text(record?.normalized?.PAD1), b = text(record?.normalized?.PAD2); return a && b ? { pads: [a, b], sourceIds: [record.sourceId], rowRefs: [`${record.sheet}:${record.row}`] } : null; }).filter(Boolean);
}
function exactTargetsForSourceIds(candidates, sourceIds) { const signature = [...sourceIds].sort().join("|"); return [...new Set((candidates ?? []).filter((candidate) => [...(candidate.targetSourceIds ?? [])].sort().join("|") === signature).map((candidate) => candidate.to).filter(Boolean))]; }
function freeze(value) { return Object.freeze({ ...value, targetItemIds: Object.freeze([...(value.targetItemIds ?? [])]), sourceIds: Object.freeze([...value.sourceIds]), rowRefs: Object.freeze([...value.rowRefs]), directedPadChain: Object.freeze([...value.directedPadChain]), ppSourceIds: Object.freeze([...value.ppSourceIds]) }); }
function text(value) { return String(value ?? "").trim(); }

export default buildGndSevenLineRoleEvidence;
