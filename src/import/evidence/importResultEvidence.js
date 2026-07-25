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
	const accepted = asArray(result.items).map((item) => withEvidenceId(item, evidenceId));
	const rejected = asArray(result.rejected).map((item) => withEvidenceId(item, evidenceId));
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
		relationCandidates: clone(asArray(result.relationCandidates)),
		acceptedItemIds: accepted.map((item) => item.id).filter(Boolean),
		rejectedItemIds: rejected.map((item) => item.id).filter(Boolean),
		unresolvedEvidence,
		truthfulnessStatus: deriveTruthfulnessStatus({ result, diagnostics, unresolvedEvidence, envelope }),
		sourceEnvelope: clone(envelope),
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
		},
	};
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
		spatialResolution: clone(item?.derived?.spatialRef ?? item?.payload?.spatialRef ?? null),
		diagnostics: clone(candidateDiagnostics),
		unresolvedAttachments: clone(asArray(item?.payload?.extended?.unresolvedAttachments)),
		truthfulnessStatus: evidence.truthfulnessStatus,
		candidate: { itemId: item.id ?? null, kind: item.kind ?? null },
		provenance: {
			source: "import-result-evidence.source",
			inventorySummary: "import-result-evidence.inventory:summary",
			spatialResolution: "import-session-item.derived.spatialRef|payload.spatialRef",
			diagnostics: "import-result-evidence.diagnostics:candidate-filtered",
			unresolvedAttachments: "import-session-item.payload.extended.unresolvedAttachments",
			truthfulnessStatus: "import-result-evidence.truthfulnessStatus",
			candidate: "import-session-item.identity",
		},
	});
}

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

function withEvidenceId(item, evidenceId) { return isObject(item) ? { ...item, evidenceId } : item; }
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
