// src/import/factories/createImportSessionItem.js

import { validateImportSessionItem } from "../validation/validateImportSessionItem.js";

export function createImportSessionItem({
	id,
	kind,
	source,
	payload,
	status,
	meta = {},
	derived = {},
	annotations = [],
} = {}) {
	const item = {
		id: normalizeId(id, kind, source),
		kind: String(kind ?? "").trim(),
		source: normalizeSource(source),
		payload: normalizePayload(payload, kind),
		status: normalizeStatus(status),
		meta: normalizeMeta(meta),
		derived: normalizeDerived(derived),
		annotations: Array.isArray(annotations) ? annotations : [],
	};

	const validation = validateImportSessionItem(item);

	return {
		item,
		validation,
		ok: validation.ok,
	};
}

export function createRejectedImportSessionItem({
	id,
	kind,
	source,
	payload = {},
	meta = {},
	reason = "rejected",
	annotations = [],
} = {}) {
	return createImportSessionItem({
		id,
		kind,
		source,
		payload,
		meta,
		status: {
			valid: false,
			promotable: false,
			stage: "rejected",
			reason,
		},
		annotations,
	});
}

function normalizeId(id, kind, source) {
	if (typeof id === "string" && id.trim()) return id.trim();

	const seed =
		source?.containerId ||
		source?.objectName ||
		source?.fileName ||
		kind ||
		"item";

	return `imp_${slug(seed)}`;
}

function normalizeSource(source) {
	if (!isObject(source)) return {};

	return {
		fileName: source.fileName ?? null,
		parserId: source.parserId ?? null,
		containerId: source.containerId ?? null,
		objectName: source.objectName ?? null,
		index: Number.isInteger(source.index) ? source.index : null,
	};
}

function normalizePayload(payload, kind) {
	const out = isObject(payload) ? { ...payload } : {};
	if (out.kind == null && typeof kind === "string" && kind) out.kind = kind;
	return out;
}

function normalizeStatus(status) {
	const s = isObject(status) ? status : {};

	return {
		valid: Boolean(s.valid),
		promotable: Boolean(s.promotable),
		stage: s.stage ?? "parsed",
		reason: s.reason ?? null,
	};
}

function normalizeMeta(meta) {
	if (!isObject(meta)) return {};

	const stationRange = isObject(meta.stationRange)
		? {
			sMin: Number.isFinite(meta.stationRange.sMin) ? Number(meta.stationRange.sMin) : null,
			sMax: Number.isFinite(meta.stationRange.sMax) ? Number(meta.stationRange.sMax) : null,
		}
		: null;

	const out = {
		label: nonEmptyOrNull(meta.label),
		roleHint: nonEmptyOrNull(meta.roleHint),
		stationRange:
			stationRange &&
			(stationRange.sMin != null || stationRange.sMax != null)
				? stationRange
				: null,
		spatialRefHint: nonEmptyOrNull(meta.spatialRefHint),
		sourceSpatialRef: isObject(meta.sourceSpatialRef) ? meta.sourceSpatialRef : null,
		sourceGroup: nonEmptyOrNull(meta.sourceGroup),
		objectSignature: nonEmptyOrNull(meta.objectSignature),
	};

	for (const key of Object.keys(out)) {
		if (out[key] == null) delete out[key];
	}

	return Object.keys(out).length ? out : {};
}

function normalizeDerived(derived) {
	if (!isObject(derived)) return {};

	const out = { ...derived };

	for (const key of Object.keys(out)) {
		const v = out[key];
		if (isObject(v) && Object.keys(v).length === 0) delete out[key];
	}

	return Object.keys(out).length ? out : {};
}

function nonEmptyOrNull(value) {
	return (typeof value === "string" && value.trim()) ? value.trim() : null;
}

function slug(value) {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, "_")
		.replace(/^_+|_+$/g, "") || "unnamed";
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
