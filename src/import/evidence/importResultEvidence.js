import { buildGndSevenLineRoleEvidence } from "./buildGndSevenLineRoleEvidence.js";
import { buildGndConstructiveStationFrameEvidence } from "./buildGndConstructiveStationFrameEvidence.js";

export const IMPORT_RESULT_EVIDENCE_SCHEMA = "ufAIM.import-result-evidence";
export const IMPORT_RESULT_EVIDENCE_VERSION = 1;

export function createImportResultEvidencePublication({
	result,
	fileName = null,
	parserId = null,
	idFactory = defaultIdFactory,
	completedAt = null,
} = {}) {
	if (!isObject(result)) throw new Error("import result evidence requires a completed result");
	const envelope = isObject(result.sourceEnvelope) ? result.sourceEnvelope : null;
	const summary = isObject(result?.meta?.gndSource) ? result.meta.gndSource : null;
	// The registry parser id ("gndEdit") identifies the parser family. Evidence
	// provenance must identify the concrete source path because MDB and XLSX have
	// different extraction contracts.
	const resolvedParserId = String(inferParserId(fileName, envelope) ?? parserId ?? result?.meta?.sourceFormat ?? "");
	if (!isGndSource({ fileName, parserId: resolvedParserId, envelope })) return null;

	const sha256 = nonEmpty(envelope?.source?.sha256 ?? summary?.sha256);
	const evidenceId = makeEvidenceId({ sha256, idFactory });
	const sourceScope = makeSourceScope({ sha256, evidenceId });
	const itemIdMap = makeQualifiedItemIdMap([...asArray(result.items), ...asArray(result.rejected)], sourceScope);
	const accepted = asArray(result.items).map((item) => withEvidenceIdentity(item, evidenceId, itemIdMap));
	const rejected = asArray(result.rejected).map((item) => withEvidenceIdentity(item, evidenceId, itemIdMap));
	const diagnostics = clone(asArray(result?.meta?.diagnostics));
	const unresolvedEvidence = collectUnresolvedEvidence([...accepted, ...rejected]);
	const source = {
		fileName: safeFileName(envelope?.source?.fileName ?? summary?.originalFile ?? fileName),
		format: nonEmpty(envelope?.source?.format ?? summary?.format ?? resolvedParserId),
		parserId: resolvedParserId || null,
		container: nonEmpty(envelope?.source?.container ?? summary?.container),
		extractor: normalizeExtractor(envelope?.extractor ?? summary?.extractor),
		sha256,
	};
	const evidence = {
		schema: IMPORT_RESULT_EVIDENCE_SCHEMA,
		version: IMPORT_RESULT_EVIDENCE_VERSION,
		evidenceId,
		source,
		inventory: clone(asArray(envelope?.inventory)),
		diagnostics,
		relationCandidates: qualifyRelationCandidates(asArray(result.relationCandidates), sourceScope, itemIdMap),
		acceptedItemIds: accepted.map((item) => item.id).filter(Boolean),
		rejectedItemIds: rejected.map((item) => item.id).filter(Boolean),
		unresolvedEvidence,
		truthfulnessStatus: deriveTruthfulnessStatus({ result, diagnostics, unresolvedEvidence, envelope }),
		sourceEnvelope: clone(envelope),
		constructiveStationFrame: buildGndConstructiveStationFrameEvidence({ sourceEnvelope: envelope, evidenceId }),
		completedAt: completedAt ?? null,
		provenance: {
			evidenceId: sha256 ? "generated:source-sha256-plus-collision-safe-suffix" : "generated:source-result-plus-collision-safe-suffix",
			source: envelope ? "result.sourceEnvelope.source" : "completed-import-result-and-file-identity",
			inventory: envelope ? "result.sourceEnvelope.inventory" : "unavailable-in-completed-result",
			diagnostics: "result.meta.diagnostics",
			relationCandidates: "result.relationCandidates",
			acceptedItemIds: "result.items[].id",
			rejectedItemIds: "result.rejected[].id",
			unresolvedEvidence: "result.items|rejected[].payload.extended.unresolvedAttachments",
			truthfulnessStatus: "derived-from-existing-result-status-diagnostics-and-evidence-classes",
			sourceEnvelope: envelope ? "result.sourceEnvelope" : "unavailable-in-completed-result",
			completedAt: completedAt == null ? "unavailable-in-completed-result" : "caller-supplied-completion-time",
			constructiveStationFrame: "compact GND EK and PP source-evidence projection; no address decoding or intrinsic binding",
		},
	};
	evidence.sevenLineRoleEvidence = buildGndSevenLineRoleEvidence(evidence);
	return { evidence: deepFreeze(evidence), items: [...accepted, ...rejected] };
}

export function makeCompactSpotEvidenceSnapshot(item, evidence) {
	if (!isObject(item) || !isObject(evidence) || item.evidenceId !== evidence.evidenceId) return null;
	const candidateDiagnostics = asArray(evidence.diagnostics).filter((diagnostic) => diagnosticBelongsToItem(diagnostic, item));
	return deepFreeze({
		schema: "ufAIM.spot-import-evidence",
		version: 1,
		evidenceId: evidence.evidenceId,
		source: clone(evidence.source),
		inventorySummary: asArray(evidence.inventory).map(({ name, rowCount, columnCount, interpreted }) => ({ name, rowCount, columnCount, interpreted })),
		familyEvidence: makeCompactFamilyEvidence(evidence),
		constructiveStationFrame: makeItemStationFrame(evidence, item),
		sevenLineRoleEvidence: clone(evidence.sevenLineRoleEvidence),
		relationEvidence: makeCompactRelationEvidence(evidence),
		spatialResolution: clone(item?.derived?.spatialRef ?? item?.payload?.spatialRef ?? null),
		diagnostics: clone(candidateDiagnostics),
		unresolvedAttachments: clone(asArray(item?.payload?.extended?.unresolvedAttachments)),
		truthfulnessStatus: evidence.truthfulnessStatus,
		candidate: { itemId: item.evidenceItemId ?? item.id ?? null, kind: item.kind ?? null },
		provenance: {
			source: "import-result-evidence.source",
			inventorySummary: "import-result-evidence.inventory:summary",
			familyEvidence: "import-result-evidence.inventory|diagnostics|unresolvedEvidence:family-summary",
			constructiveStationFrame: "import-result-evidence.constructiveStationFrame:evidence-only-compact-projection",
			relationEvidence: "import-result-evidence.relationCandidates:identity-preserving-summary",
			spatialResolution: "import-session-item.derived.spatialRef|payload.spatialRef",
			diagnostics: "import-result-evidence.diagnostics:candidate-filtered",
			unresolvedAttachments: "import-session-item.payload.extended.unresolvedAttachments",
			truthfulnessStatus: "import-result-evidence.truthfulnessStatus",
			candidate: "import-session-item.identity",
		},
	});
}

function makeCompactFamilyEvidence(evidence) {
	return ["EL", "EH", "EU", "EK"].map((family) => {
		const inventory = asArray(evidence.inventory).filter((entry) => familyFromInventoryName(entry?.name) === family);
		const diagnostics = asArray(evidence.diagnostics).filter((entry) => String(entry?.family ?? "").toUpperCase() === family);
		const unresolved = asArray(evidence.unresolvedEvidence).filter((entry) => asArray(entry?.sourceElements).some((source) => String(source?.family ?? "").toUpperCase() === family));
		const rowCount = inventory.reduce((sum, entry) => sum + finiteCount(entry?.rowCount), 0);
		const constructive = family === "EL" && rowCount > 0 && (
			diagnostics.some((entry) => entry?.geometryUsable === true) ||
			String(evidence?.truthfulnessStatus ?? "").includes("construction-available")
		);
		return { family, status: constructive ? "constructive" : rowCount > 0 || diagnostics.length || unresolved.length ? "partial-evidence" : "missing", rowCount, sourceRefs: inventory.map((entry) => entry?.name).filter(Boolean), diagnosticCodes: diagnostics.map((entry) => entry?.code).filter(Boolean), unresolvedCount: unresolved.length };
	});
}

function makeCompactRelationEvidence(evidence) {
	const candidates = asArray(evidence.relationCandidates).map((association) => ({ id: association?.id ?? null, type: association?.type ?? association?.kind ?? null, from: association?.from ?? association?.fromId ?? null, to: association?.to ?? association?.toId ?? null, status: "candidate", claimScope: association?.claimScope ?? "source-association-only", intrinsicMappingStatus: association?.intrinsicMappingStatus ?? "not-established", domainRelationStatus: association?.domainRelationStatus ?? "not-established", provenance: clone(association?.provenance ?? { source: association?.source ?? null, origin: association?.origin ?? null, derivedBy: association?.derivedBy ?? null, method: association?.method ?? null, reasons: association?.reasons ?? null }) }));
	const reviewedCandidateId = evidence?.relationDecision?.reviewedCandidateId ?? evidence?.relationDecision?.confirmedCandidateId ?? null;
	return { status: reviewedCandidateId ? "reviewed" : candidates.length ? "open-candidates" : "missing", candidateCount: candidates.length, reviewedCandidateId, reviewRevision: Number(evidence?.relationDecision?.revision ?? 0), reviewProvenance: clone(evidence?.relationDecision?.provenance ?? null), claimScope: "source-association-only", intrinsicMappingStatus: "not-established", domainRelationStatus: "not-established", candidates: candidates.map((candidate) => ({ ...candidate, status: candidate.id === reviewedCandidateId ? "reviewed" : "candidate" })) };
}

function makeItemStationFrame(evidence, item) {
	const frame = evidence?.constructiveStationFrame;
	if (!isObject(frame)) return null;
	const itemId = String(item?.id ?? "");
	const contexts = asArray(evidence?.sevenLineRoleEvidence?.assignments)
		.filter((assignment) => asArray(assignment?.targetItemIds).some((id) => String(id) === itemId))
		.map((assignment) => ({ route: assignment?.route ?? null, directionCode: assignment?.directionCode ?? null }));
	if (!contexts.length) return null;
	const claims = asArray(frame.claims).filter((claim) => contexts.some((context) => claimMatchesContext(claim, context)));
	return clone({ ...frame, claims, status: claims.length ? "evidence-only" : "missing", diagnostics: [...new Set(claims.flatMap((claim) => asArray(claim?.blockers)))] });
}

function claimMatchesContext(claim, context) {
	const stationContexts = [...asArray(claim?.stationContexts?.start), ...asArray(claim?.stationContexts?.end)];
	return stationContexts.some((entry) => String(entry?.route ?? "") === String(context.route ?? "") && String(entry?.directionCode ?? "") === String(context.directionCode ?? ""));
}

function familyFromInventoryName(name) { return /(?:^|_)(EL|EH|EU|EK)$/i.exec(String(name ?? ""))?.[1]?.toUpperCase() ?? null; }
function finiteCount(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; }

export function withSpotEvidenceSnapshot(item, evidence) {
	const snapshot = makeCompactSpotEvidenceSnapshot(item, evidence);
	if (!snapshot) return item;
	return { ...item, derived: { ...(item.derived ?? {}), sourceEvidenceSnapshot: snapshot } };
}

function collectUnresolvedEvidence(items) {
	return clone(items.flatMap((item) => asArray(item?.payload?.extended?.unresolvedAttachments).map((entry) => ({
		itemId: item.id ?? null,
		kind: entry?.kind ?? null,
		evidenceClass: entry?.evidenceClass ?? null,
		status: entry?.status ?? null,
		attachmentStatus: entry?.attachmentStatus ?? null,
		padStart: entry?.padStart ?? null,
		padEnd: entry?.padEnd ?? null,
		reason: entry?.ambiguityReason ?? entry?.rejectionReason ?? entry?.message ?? null,
		candidateHorizontalReferenceSystems: clone(asArray(entry?.candidateHorizontalReferenceSystems ?? entry?.candidateReferenceSystems)),
		candidateVerticalReferenceSystems: clone(asArray(entry?.candidateVerticalReferenceSystems)),
		sourceElements: clone(asArray(entry?.sourceElements)),
	}))));
}

function deriveTruthfulnessStatus({ result, diagnostics, unresolvedEvidence, envelope }) {
	const codes = diagnostics.map((entry) => String(entry?.code ?? "").toLowerCase());
	const classes = unresolvedEvidence.map((entry) => String(entry?.evidenceClass ?? "").toLowerCase());
	const reason = String(result?.reason ?? "").toLowerCase();
	if (/unsupported/.test(reason)) return "unsupported-source";
	if (/extract|corrupt|limit|timeout|encrypted/.test(reason)) return "extraction-failure";
	if (/incomplete/.test(reason) || asArray(envelope?.diagnostics).some((entry) => /absent|unreadable/.test(String(entry?.code ?? "").toLowerCase()))) return "incomplete-source";
	if (codes.some((code) => /conflict/.test(code))) return "conflicting-evidence";
	if (classes.some((value) => value.includes("ambiguous")) || codes.some((code) => /ambiguous/.test(code))) return "ambiguous-evidence-retained";
	if (result?.ok === false || result?.status === "invalid" || result?.status === "rejected") return "rejected-source";
	const construction = asArray(result?.items).some((item) => item?.kind === "alignment" && item?.status?.promotable === true);
	if (construction && unresolvedEvidence.length) return "construction-available-with-unresolved-evidence";
	if (construction) return "safe-construction-available";
	return "rejected-source";
}

function diagnosticBelongsToItem(diagnostic, item) {
	const attachments = asArray(item?.payload?.extended?.unresolvedAttachments);
	if (!attachments.length) return diagnostic?.geometryUsable === true || diagnostic?.family === "EL" || diagnostic?.family === "EK";
	const families = new Set(attachments.flatMap((entry) => asArray(entry?.sourceElements).map((element) => element?.family).filter(Boolean)));
	const rowRefs = new Set(attachments.flatMap((entry) => asArray(entry?.sourceElements).map((element) => element?.rowRef).filter(Boolean)));
	return families.has(diagnostic?.family) || rowRefs.has(diagnostic?.rowRef) || diagnostic?.geometryUsable === true;
}

function makeSourceScope({ sha256, evidenceId }) {
	return `src_${sha256 || evidenceId.replace(/^evidence_v1_nohash_/, "")}`;
}

function makeQualifiedItemIdMap(items, sourceScope) {
	return new Map(items
		.filter((item) => isObject(item) && nonEmpty(item.id))
		.map((item) => [String(item.id), `${String(item.id)}__${sourceScope}`]));
}

function withEvidenceIdentity(item, evidenceId, itemIdMap) {
	if (!isObject(item)) return item;
	const sourceItemId = nonEmpty(item.id);
	return {
		...item,
		id: sourceItemId ? itemIdMap.get(sourceItemId) : item.id,
		evidenceId,
		sourceItemId,
	};
}

function qualifyRelationCandidates(relations, sourceScope, itemIdMap) {
	return clone(relations.map((relation) => {
		if (!isObject(relation)) return relation;
		const qualifyReference = (value) => itemIdMap.get(String(value ?? "")) ?? value;
		const sourceRelationId = nonEmpty(relation.id);
		return {
			...relation,
			id: sourceRelationId ? `${sourceRelationId}__${sourceScope}` : relation.id,
			sourceRelationId,
			...(Object.hasOwn(relation, "from") ? { from: qualifyReference(relation.from) } : {}),
			...(Object.hasOwn(relation, "to") ? { to: qualifyReference(relation.to) } : {}),
			...(Object.hasOwn(relation, "fromId") ? { fromId: qualifyReference(relation.fromId) } : {}),
			...(Object.hasOwn(relation, "toId") ? { toId: qualifyReference(relation.toId) } : {}),
		};
	}));
}
function makeEvidenceId({ sha256, idFactory }) { return `evidence_v1_${sha256 ? sha256.slice(0, 16) : "nohash"}_${String(idFactory()).replace(/[^a-zA-Z0-9_-]/g, "")}`; }
function defaultIdFactory() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function inferParserId(fileName, envelope) { const lower = String(fileName ?? "").toLowerCase(); if (lower.endsWith(".mdb")) return "gnd-edit-mdb"; if (envelope?.source?.format === "XLSX") return "gnd-edit-xlsx"; return null; }
function isGndSource({ fileName, parserId, envelope }) { return /gnd/i.test(parserId) || String(fileName ?? "").toLowerCase().endsWith(".mdb") || asArray(envelope?.inventory).some((entry) => String(entry?.name ?? "").startsWith("X_ASC")); }
function normalizeExtractor(value) { return isObject(value) ? { id: value.id ?? null, version: value.version ?? null } : null; }
function safeFileName(value) { return String(value ?? "").split(/[\\/]/).pop() || null; }
function nonEmpty(value) { const text = String(value ?? "").trim(); return text || null; }
function asArray(value) { return Array.isArray(value) ? value : []; }
function isObject(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
function clone(value) { return value == null ? value : structuredClone(value); }
function deepFreeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; Object.freeze(value); for (const entry of Object.values(value)) deepFreeze(entry); return value; }
