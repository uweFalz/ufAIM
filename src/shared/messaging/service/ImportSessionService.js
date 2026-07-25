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

	function getSessionState() {
		return publicState(getImportState());
	}

	function getResultEvidence({ evidenceId = null } = {}) {
		const records = getImportState().resultEvidence;
		if (isNonEmptyString(evidenceId)) {
			const record = records.find((entry) => entry.evidenceId === evidenceId) ?? null;
			return clone({ schema: "ufAIM.import-result-evidence", version: 1, found: Boolean(record), evidenceId, record });
		}
		return clone({ schema: "ufAIM.import-result-evidence", version: 1, found: true, records });
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
		beginSession,
		clearSession,
		addItems,
		removeItem,
		setPhase,
		setError,
		resetToReady,
		setItemAccepted,
		acceptItem,
		unacceptItem,
	};
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
	const { resultEvidence: _privateEvidence, ...rest } = ensureShape(state);
	return clone(rest);
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
