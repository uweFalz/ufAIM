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
		return safe;
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
		router?.broadcastEvt?.("Import.StateChanged", state);
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
		return getImportState();
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

			if (isRejectedImportItem(result.item)) rejected.push(result.item);
			else accepted.push(result.item);
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

	return {
		getState: getSessionState,
		beginSession,
		clearSession,
		addItems,
		removeItem,
		setPhase,
		setError,
		resetToReady,
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
		error: null,
		stats: makeStats(),
	};
}

function ensureShape(state) {
	const base = isObject(state) ? state : {};

	const items = Array.isArray(base.items) ? base.items.filter(isObject) : [];
	const rejectedItems = Array.isArray(base.rejectedItems) ? base.rejectedItems.filter(isObject) : [];

	return {
		sessionId: base.sessionId ?? null,
		phase: normalizePhase(base.phase),
		source: base.source ? normalizeSource(base.source) : null,
		items,
		rejectedItems,
		error: base.error ? normalizeError(base.error) : null,
		stats: makeStats(items, rejectedItems),
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
