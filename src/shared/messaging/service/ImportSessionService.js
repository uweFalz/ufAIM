// src/shared/messaging/service/ImportSessionService.js
//
// ImportSessionService
//
// Canonical import-session state host.
//
// Responsibilities:
// - owns shared import session state
// - starts / resets import sessions
// - accepts canonical ImportSessionItems only
// - separates accepted vs rejected items
// - stores explicit acceptance decisions
// - broadcasts session state changes
//
// NOT:
// - no parsing
// - no normalization
// - no SPOT promotion
// - no UI formatting
//
// Rule:
// parser/domain layer builds canonical ImportSessionItems first,
// this service only stores validated session data.

import { validateImportSessionItem } from "../../../import/validation/validateImportSessionItem.js";

export function createImportSessionService({
	getState,
	setState,
	router,
} = {}) {
	if (typeof getState !== "function") {
		throw new Error("ImportSessionService: missing getState");
	}
	if (typeof setState !== "function") {
		throw new Error("ImportSessionService: missing setState");
	}

	function getImportState() {
		return ensureShape(getState());
	}

	function replaceImportState(next) {
		const safe = ensureShape(next);
		setState(safe);
		broadcastStateChanged(safe);
		return publicState(safe);
	}

	function patchImportState(patch) {
		const prev = getImportState();
		const next = ensureShape({
			...prev,
			...patch,
		});
		setState(next);
		broadcastStateChanged(next);
		return next;
	}

	function broadcastStateChanged(state) {
		router?.broadcastEvt?.("Import.StateChanged", publicState(state));
	}

	function beginSession({ source = null } = {}) {
		const next = ensureShape({
			sessionId: makeSessionId(),
			phase: "collecting",
			source: normalizeSource(source),
			items: [],
			rejectedItems: [],
			error: null,
			stats: makeStats(),
		});

		return replaceImportState(next);
	}

	function clearSession() {
		return replaceImportState(makeInitialState());
	}

	function getSessionState({ projection = "full" } = {}) {
		// Import.GetState is deliberately the public/session projection. Do not
		// normalize the private resultEvidence collection only to discard it in
		// publicState: physical GND datasets can retain hundreds of megabytes of
		// source evidence, while callers here need only items and session status.
		if (projection === "summary") return publicStateSummary(getState());
		return publicState(getState());
	}

	function getResultEvidence({ evidenceId = null, projection = "full" } = {}) {
		const rawState = getState();
		const records = Array.isArray(rawState?.resultEvidence)
			? rawState.resultEvidence.filter(isObject)
			: [];
		if (isNonEmptyString(evidenceId)) {
			const record = records.find((entry) => entry.evidenceId === evidenceId) ?? null;
			const projected = record && projection === "workbench" ? projectEvidenceForWorkbench(record) : record;
			return clone({ schema: "ufAIM.import-result-evidence", version: 1, found: Boolean(record), evidenceId, record: projected });
		}
		const projected = projection === "workbench" ? records.map(projectEvidenceForWorkbench) : records;
		return clone({ schema: "ufAIM.import-result-evidence", version: 1, found: true, records: projected });
	}

	function publishResultEvidence({ evidence, items = [] } = {}) {
		if (!isObject(evidence) || !isNonEmptyString(evidence.evidenceId)) throw new Error("Import result evidence requires evidenceId");
		if (evidence.schema !== "ufAIM.import-result-evidence" || evidence.version !== 1) throw new Error("Unsupported import result evidence schema");
		const prev = getImportState();
		if (prev.resultEvidence.some((entry) => entry.evidenceId === evidence.evidenceId)) throw new Error(`Import result evidence already published: ${evidence.evidenceId}`);
		const accepted = [];
		const rejected = [];
		for (const raw of Array.isArray(items) ? items : []) {
			const linked = isObject(raw) ? { ...raw, evidenceId: evidence.evidenceId } : raw;
			const validation = normalizeAndValidateImportItem(linked);
			if (!validation.ok) rejected.push({ ...makeRejectedEnvelope(linked, validation.validation), evidenceId: evidence.evidenceId });
			else {
				const normalized = normalizeItemAcceptance(validation.item);
				if (isRejectedImportItem(normalized)) rejected.push(normalized); else accepted.push(normalized);
			}
		}
		const record = deepFreeze(clone({ ...evidence, acceptedItemIds: accepted.map((item) => item.id), rejectedItemIds: rejected.map((item) => item.id) }));
		return replaceImportState({
			...prev,
			phase: derivePhase({ items: [...prev.items, ...accepted], rejectedItems: [...prev.rejectedItems, ...rejected] }),
			items: dedupeById([...prev.items, ...accepted]),
			rejectedItems: dedupeById([...prev.rejectedItems, ...rejected]),
			resultEvidence: [...prev.resultEvidence, record],
			error: null,
		});
	}

	function commitJob({ batchId, source = null, files } = {}) {
		if (!isNonEmptyString(batchId)) throw new Error("Import.CommitJob requires batchId");
		if (!Array.isArray(files) || files.length === 0) {
			throw new Error("Import.CommitJob requires non-empty files");
		}
		const accepted = [];
		const rejected = [];
		const resultEvidence = [];
		const jobIds = new Set();
		const itemIds = new Set();
		const evidenceIds = new Set();

		for (const file of files) {
			if (!isObject(file) || !isNonEmptyString(file.jobId) || !isNonEmptyString(file.fileName)) {
				throw new Error("Import.CommitJob file requires jobId and fileName");
			}
			if (jobIds.has(file.jobId)) throw new Error(`Import.CommitJob duplicate jobId: ${file.jobId}`);
			jobIds.add(file.jobId);
			if (!isObject(file.publication) || !isObject(file.publication.evidence)) {
				throw new Error(`Import.CommitJob invalid publication: ${file.jobId}`);
			}
			if (!Array.isArray(file.items) || !Array.isArray(file.rejectedItems)) {
				throw new Error(`Import.CommitJob invalid item arrays: ${file.jobId}`);
			}
			const evidence = file.publication.evidence;
			if (
				evidence.schema !== "ufAIM.import-result-evidence"
				|| evidence.version !== 1
				|| !isNonEmptyString(evidence.evidenceId)
			) {
				throw new Error(`Import.CommitJob invalid evidence: ${file.jobId}`);
			}
			if (evidenceIds.has(evidence.evidenceId)) {
				throw new Error(`Import.CommitJob duplicate evidenceId: ${evidence.evidenceId}`);
			}
			evidenceIds.add(evidence.evidenceId);
			const publishedItems = Array.isArray(file.publication.items) ? file.publication.items.filter(isObject) : [];
			const qualifiedBySourceItemId = new Map();
			const qualifiedPublicationIds = new Set();
			let hasQualifiedPublicationItems = false;
			for (const published of publishedItems) {
				if (!isNonEmptyString(published?.sourceItemId) || !isNonEmptyString(published?.id)) continue;
				hasQualifiedPublicationItems = true;
				const sourceItemId = String(published.sourceItemId);
				const publicationId = String(published.id);
				if (qualifiedBySourceItemId.has(sourceItemId)) throw new Error(`Import.CommitJob ambiguous publication sourceItemId: ${sourceItemId}`);
				if (qualifiedPublicationIds.has(publicationId)) throw new Error(`Import.CommitJob ambiguous publication item ID: ${publicationId}`);
				qualifiedBySourceItemId.set(sourceItemId, publicationId);
				qualifiedPublicationIds.add(publicationId);
			}
			const fileAccepted = [];
			const fileRejected = [];
			const rawItemIds = new Set();
			const rawItems = [...file.items, ...file.rejectedItems];
			for (const raw of rawItems) {
				const sourceItemId = isObject(raw) && isNonEmptyString(raw.id) ? String(raw.id) : null;
				if (!sourceItemId || rawItemIds.has(sourceItemId)) {
					throw new Error(`Import.CommitJob duplicate or invalid item ID: ${String(sourceItemId ?? "")}`);
				}
				rawItemIds.add(sourceItemId);
			}
			for (const raw of rawItems) {
				const sourceItemId = String(raw.id);
				const evidenceItemId = qualifiedBySourceItemId.get(sourceItemId)
					?? (qualifiedPublicationIds.has(sourceItemId) ? sourceItemId : null);
				if (hasQualifiedPublicationItems && sourceItemId && !evidenceItemId) throw new Error(`Import.CommitJob publication item identity missing: ${sourceItemId}`);
				const linked = isObject(raw) ? { ...raw, evidenceId: evidence.evidenceId, ...(evidenceItemId ? { evidenceItemId } : {}) } : raw;
				const validation = normalizeAndValidateImportItem(linked);
				const normalized = validation.ok
					? normalizeItemAcceptance(validation.item)
					: { ...makeRejectedEnvelope(linked, validation.validation), evidenceId: evidence.evidenceId };
				if (!isNonEmptyString(normalized?.id) || itemIds.has(normalized.id)) {
					throw new Error(`Import.CommitJob duplicate or invalid item ID: ${String(normalized?.id ?? "")}`);
				}
				itemIds.add(normalized.id);
				if (isRejectedImportItem(normalized)) fileRejected.push(normalized);
				else fileAccepted.push(normalized);
			}
			accepted.push(...fileAccepted);
			rejected.push(...fileRejected);
			resultEvidence.push(deepFreeze(clone({
				...evidence,
				acceptedItemIds: fileAccepted.map((item) => item.evidenceItemId ?? item.id),
				rejectedItemIds: fileRejected.map((item) => item.evidenceItemId ?? item.id),
			})));
		}

		const previous = getImportState();
		const continuesBatch = previous?.sessionId === String(batchId);
		const nextItems = continuesBatch
			? mergeNewById(previous.items, accepted)
			: accepted;
		const nextRejected = continuesBatch
			? mergeNewById(previous.rejectedItems, rejected)
			: rejected;
		const nextEvidence = continuesBatch
			? mergeNewByKey(previous.resultEvidence, resultEvidence, "evidenceId")
			: resultEvidence;
		const next = ensureShape({
			sessionId: String(batchId),
			phase: derivePhase({ items: nextItems, rejectedItems: nextRejected }),
			source: normalizeSource(source),
			items: nextItems,
			rejectedItems: nextRejected,
			resultEvidence: nextEvidence,
			error: null,
			stats: makeStats(nextItems, nextRejected),
		});
		return replaceImportState(next);
	}

	function addItems({ items = [] } = {}) {
		const prev = getImportState();

		if (!Array.isArray(items) || items.length === 0) {
			return prev;
		}

		const accepted = [];
		const rejected = [];

		for (const raw of items) {
			const result = normalizeAndValidateImportItem(raw);

			if (!result.ok) {
				rejected.push(makeRejectedEnvelope(raw, result.validation));
				continue;
			}

			const normalizedItem = normalizeItemAcceptance(result.item);

			if (isRejectedImportItem(normalizedItem)) rejected.push(normalizedItem);
			else accepted.push(normalizedItem);
		}

		const nextItems = dedupeById([...prev.items, ...accepted]);
		const nextRejected = dedupeById([...prev.rejectedItems, ...rejected]);

		const next = ensureShape({
			...prev,
			phase: derivePhase({
				items: nextItems,
				rejectedItems: nextRejected,
				error: null,
			}),
			items: nextItems,
			rejectedItems: nextRejected,
			error: null,
			stats: makeStats(nextItems, nextRejected),
		});

		return replaceImportState(next);
	}

	function setPhase({ phase } = {}) {
		if (!isNonEmptyString(phase)) return getImportState();

		return patchImportState({
			phase,
		});
	}

	function setError({ error } = {}) {
		const prev = getImportState();

		const next = ensureShape({
			...prev,
			phase: "error",
			error: normalizeError(error),
			stats: makeStats(prev.items, prev.rejectedItems),
		});

		return replaceImportState(next);
	}

	function removeItem({ itemId } = {}) {
		if (!isNonEmptyString(itemId)) return getImportState();

		const prev = getImportState();

		const nextItems = prev.items.filter((item) => item?.id !== itemId);
		const nextRejected = prev.rejectedItems.filter((item) => item?.id !== itemId);

		const next = ensureShape({
			...prev,
			phase: derivePhase({
				items: nextItems,
				rejectedItems: nextRejected,
				error: prev.error,
			}),
			items: nextItems,
			rejectedItems: nextRejected,
			stats: makeStats(nextItems, nextRejected),
		});

		return replaceImportState(next);
	}

	function resetToReady() {
		const prev = getImportState();

		const next = ensureShape({
			...prev,
			phase: "ready",
			error: null,
			stats: makeStats(prev.items, prev.rejectedItems),
		});

		return replaceImportState(next);
	}

	function setItemAccepted({ itemId, accepted } = {}) {
		if (!isNonEmptyString(itemId)) return getImportState();

		const prev = getImportState();

		const nextItems = prev.items.map((item) => {
			if (item?.id !== itemId) return item;
			return normalizeItemAcceptance({
				...item,
				status: {
					...(isObject(item?.status) ? item.status : {}),
					accepted: Boolean(accepted),
				},
			});
		});

		const next = ensureShape({
			...prev,
			items: nextItems,
			stats: makeStats(nextItems, prev.rejectedItems),
		});

		return replaceImportState(next);
	}

	function setRelationDecision({ evidenceId, candidateId = null, action, expectedRevision } = {}) {
		if (!isNonEmptyString(evidenceId) || !["review", "withdraw-review", "confirm", "unconfirm"].includes(action)) return { ok: false, code: "INVALID_SOURCE_ASSOCIATION_REVIEW" };
		const reviewAction = action === "confirm" ? "review" : action === "unconfirm" ? "withdraw-review" : action;
		const prev = getImportState();
		const index = prev.resultEvidence.findIndex((entry) => entry?.evidenceId === evidenceId);
		if (index < 0) return { ok: false, code: "RELATION_EVIDENCE_NOT_FOUND" };
		const record = prev.resultEvidence[index];
		const revision = Number(record?.relationDecision?.revision ?? 0);
		if (Number(expectedRevision) !== revision) return { ok: false, code: "STALE_RELATION_DECISION", revision };
		const candidate = record.relationCandidates?.find((entry) => entry?.id === candidateId) ?? null;
		const currentReviewedId = record?.relationDecision?.reviewedCandidateId ?? record?.relationDecision?.confirmedCandidateId ?? null;
		if (reviewAction === "review" && !candidate) return { ok: false, code: "SOURCE_ASSOCIATION_CANDIDATE_NOT_FOUND", revision };
		if (reviewAction === "withdraw-review" && (!candidateId || currentReviewedId !== candidateId)) return { ok: false, code: "SOURCE_ASSOCIATION_NOT_REVIEWED", revision };
		const relationDecision = deepFreeze({ revision: revision + 1, reviewedCandidateId: reviewAction === "review" ? candidateId : null, decidedAt: new Date().toISOString(), provenance: { kind: "explicit-user-import-session-source-association-review", evidenceId, candidateId, claimScope: "source-association-only" } });
		const nextRecord = deepFreeze(clone({ ...record, relationDecision }));
		const resultEvidence = [...prev.resultEvidence]; resultEvidence[index] = nextRecord;
		const patchItem = (item) => item?.evidenceId !== evidenceId ? item : ({ ...item, derived: { ...(item.derived ?? {}), sourceEvidenceSnapshot: updateSnapshotRelation(item?.derived?.sourceEvidenceSnapshot, nextRecord) } });
		replaceImportState({ ...prev, resultEvidence, items: prev.items.map(patchItem), rejectedItems: prev.rejectedItems.map(patchItem) });
		return { ok: true, evidenceId, relationDecision: clone(relationDecision) };
	}

	function acceptItem({ itemId } = {}) {
		return setItemAccepted({ itemId, accepted: true });
	}

	function unacceptItem({ itemId } = {}) {
		return setItemAccepted({ itemId, accepted: false });
	}

	return {
		getState: getSessionState,
		getResultEvidence,
		publishResultEvidence,
		commitJob,
		beginSession,
		clearSession,
		addItems,
		removeItem,
		setPhase,
		setError,
		resetToReady,
		setItemAccepted,
		setRelationDecision,
		acceptItem,
		unacceptItem,
	};
}

function updateSnapshotRelation(snapshot, record) {
	if (!isObject(snapshot)) return snapshot;
	const reviewedCandidateId = record?.relationDecision?.reviewedCandidateId ?? record?.relationDecision?.confirmedCandidateId ?? null;
	const candidates = Array.isArray(record?.relationCandidates) ? record.relationCandidates.map((entry) => ({ id: entry?.id ?? null, type: entry?.type ?? entry?.kind ?? null, from: entry?.from ?? entry?.fromId ?? null, to: entry?.to ?? entry?.toId ?? null, status: entry?.id === reviewedCandidateId ? "reviewed" : "candidate", claimScope: entry?.claimScope ?? "source-association-only", intrinsicMappingStatus: entry?.intrinsicMappingStatus ?? "not-established", domainRelationStatus: entry?.domainRelationStatus ?? "not-established", provenance: clone(entry?.provenance ?? { source: entry?.source ?? null, origin: entry?.origin ?? null, derivedBy: entry?.derivedBy ?? null, method: entry?.method ?? null, reasons: entry?.reasons ?? null }) })) : [];
	return deepFreeze(clone({ ...snapshot, relationEvidence: { status: reviewedCandidateId ? "reviewed" : candidates.length ? "open-candidates" : "missing", candidateCount: candidates.length, reviewedCandidateId, reviewRevision: Number(record?.relationDecision?.revision ?? 0), reviewProvenance: record?.relationDecision?.provenance ?? null, claimScope: "source-association-only", intrinsicMappingStatus: "not-established", domainRelationStatus: "not-established", candidates } }));
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function makeInitialState() {
	return {
		sessionId: null,
		phase: "idle", // idle | collecting | parsing | ready | error
		source: null,
		items: [],
		rejectedItems: [],
		resultEvidence: [],
		error: null,
		stats: makeStats(),
	};
}

function ensureShape(state) {
	const base = isObject(state) ? state : {};

	const items = Array.isArray(base.items)
		? base.items.filter(isObject).map(normalizeItemAcceptance)
		: [];

	const rejectedItems = Array.isArray(base.rejectedItems)
		? base.rejectedItems.filter(isObject)
		: [];
	const resultEvidence = Array.isArray(base.resultEvidence)
		? base.resultEvidence.filter(isObject).map((record) => deepFreeze(clone(record)))
		: [];

	return {
		sessionId: base.sessionId ?? null,
		phase: normalizePhase(base.phase),
		source: base.source ? normalizeSource(base.source) : null,
		items,
		rejectedItems,
		resultEvidence,
		error: base.error ? normalizeError(base.error) : null,
		stats: makeStats(items, rejectedItems),
	};
}

function publicState(state) {
	const base = isObject(state) ? state : {};
	const items = Array.isArray(base.items)
		? base.items.filter(isObject).map(normalizeItemAcceptance)
		: [];
	const rejectedItems = Array.isArray(base.rejectedItems)
		? base.rejectedItems.filter(isObject)
		: [];
	return clone({
		sessionId: base.sessionId ?? null,
		phase: normalizePhase(base.phase),
		source: base.source ? normalizeSource(base.source) : null,
		items,
		rejectedItems,
		error: base.error ? normalizeError(base.error) : null,
		stats: makeStats(items, rejectedItems),
	});
}

function publicStateSummary(state) {
	const base = isObject(state) ? state : {};
	const items = Array.isArray(base.items) ? base.items.filter(isObject) : [];
	const rejectedItems = Array.isArray(base.rejectedItems) ? base.rejectedItems.filter(isObject) : [];
	return clone({
		sessionId: base.sessionId ?? null,
		phase: normalizePhase(base.phase),
		source: base.source ? normalizeSource(base.source) : null,
		error: base.error ? normalizeError(base.error) : null,
		stats: makeStats(items, rejectedItems),
	});
}

function projectEvidenceForWorkbench(record) {
	const envelope = isObject(record?.sourceEnvelope) ? record.sourceEnvelope : null;
	const tables = Array.isArray(envelope?.tables) ? envelope.tables : [];
	return {
		...record,
		sourceEnvelope: envelope ? {
			source: clone(envelope.source ?? null),
			extractor: clone(envelope.extractor ?? null),
			inventory: clone(envelope.inventory ?? null),
			diagnostics: clone(envelope.diagnostics ?? null),
			tables: tables.map((table, index) => ({
				name: table?.name ?? null,
				rowCount: Number.isFinite(Number(table?.rowCount)) ? Number(table.rowCount) : Array.isArray(table?.rows) ? table.rows.length : null,
				columnCount: Number.isFinite(Number(table?.columnCount)) ? Number(table.columnCount) : Array.isArray(table?.columns) ? table.columns.length : null,
				tableIndex: index,
				rowsDeferred: true,
			})),
			projection: "workbench-summary",
		} : null,
	};
}

function normalizeAndValidateImportItem(raw) {
	if (!isObject(raw)) {
		return {
			ok: false,
			item: null,
			validation: {
				ok: false,
				errors: [{ code: "item_type", message: "item must be object", path: "" }],
				warnings: [],
			},
		};
	}

	const item = raw.item && isObject(raw.item) ? raw.item : raw;
	const validation = validateImportSessionItem(item);

	return {
		ok: validation.ok,
		item,
		validation,
	};
}

function normalizeItemAcceptance(item) {
	if (!isObject(item)) return item;

	const status = isObject(item.status) ? item.status : {};

	return {
		...item,
		status: {
			...status,
			accepted: status.accepted === true,
		},
	};
}

function makeRejectedEnvelope(raw, validation) {
	const base = isObject(raw?.item) ? raw.item : (isObject(raw) ? raw : {});

	return {
		id: String(base.id ?? makeFallbackRejectedId()),
		kind: String(base.kind ?? "unknown"),
		source: isObject(base.source) ? base.source : {},
		payload: isObject(base.payload) ? base.payload : {},
		status: {
			valid: false,
			promotable: false,
			accepted: false,
			stage: "rejected",
			reason: "invalid-import-session-item",
		},
		derived: {},
		annotations: [
			{
				level: "error",
				message: "ImportSessionItem validation failed",
				meta: {
					errors: validation?.errors ?? [],
					warnings: validation?.warnings ?? [],
				},
			},
		],
	};
}

function isRejectedImportItem(item) {
	return item?.status?.valid === false || item?.status?.stage === "rejected";
}

function dedupeById(items) {
	const map = new Map();

	for (const item of items) {
		if (!isObject(item)) continue;
		if (!isNonEmptyString(item.id)) continue;
		map.set(item.id, item);
	}

	return [...map.values()];
}

function mergeNewById(existing, incoming) {
	return mergeNewByKey(existing, incoming, "id");
}

function mergeNewByKey(existing, incoming, key) {
	const out = Array.isArray(existing) ? [...existing] : [];
	const seen = new Set(out.map((entry) => String(entry?.[key] ?? "")).filter(Boolean));
	for (const entry of Array.isArray(incoming) ? incoming : []) {
		const value = String(entry?.[key] ?? "");
		if (!value || seen.has(value)) continue;
		seen.add(value);
		out.push(entry);
	}
	return out;
}

function derivePhase({ items = [], rejectedItems = [], error = null } = {}) {
	if (error) return "error";
	if (items.length > 0 || rejectedItems.length > 0) return "ready";
	return "collecting";
}

function normalizePhase(phase) {
	const p = String(phase ?? "").toLowerCase();

	if (["idle", "collecting", "parsing", "ready", "error"].includes(p)) {
		return p;
	}
	return "idle";
}

function normalizeSource(source) {
	if (!isObject(source)) return null;

	return {
		fileName: source.fileName ?? source.file ?? null,
		parserId: source.parserId ?? source.format ?? null,
		containerId: source.containerId ?? null,
		objectName: source.objectName ?? null,
		index: Number.isInteger(source.index) ? source.index : null,
	};
}

function normalizeError(error) {
	if (error == null) return null;

	if (typeof error === "string") {
		return { message: error };
	}

	if (isObject(error)) {
		return {
			message: String(error.message ?? "unknown error"),
			code: error.code ?? null,
		};
	}

	return { message: String(error) };
}

function makeStats(items = [], rejectedItems = []) {
	const accepted = Array.isArray(items) ? items : [];
	const rejected = Array.isArray(rejectedItems) ? rejectedItems : [];

	return {
		total: accepted.length + rejected.length,
		accepted: accepted.length,
		rejected: rejected.length,
		byKind: countByKind(accepted),
		rejectedByKind: countByKind(rejected),
		promotable: accepted.filter((item) => item?.status?.promotable === true).length,
		explicitlyAccepted: accepted.filter((item) => item?.status?.accepted === true).length,
	};
}

function countByKind(items) {
	const out = {};

	for (const item of items) {
		const kind = String(item?.kind ?? "unknown");
		out[kind] = (out[kind] ?? 0) + 1;
	}

	return out;
}

function makeSessionId() {
	return `import_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function makeFallbackRejectedId() {
	return `rejected_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

function isNonEmptyString(x) {
	return typeof x === "string" && x.trim().length > 0;
}

function clone(value) { return value == null ? value : structuredClone(value); }
function deepFreeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; Object.freeze(value); for (const entry of Object.values(value)) deepFreeze(entry); return value; }
