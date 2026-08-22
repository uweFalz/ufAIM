// src/import/build/importItemFactories.js
//
// Import item factories
//
// Purpose:
// - single construction point for ImportSessionItem objects
// - thin adapter layer for import/build callers
// - no guessing, no repair, no UI logic

import {
	createImportSessionItem,
	createRejectedImportSessionItem,
} from "../factories/createImportSessionItem.js";

function makeSource(source = {}) {
	return {
		fileName: source.fileName ?? source.file ?? null,
		parserId: source.parserId ?? source.format ?? null,
		containerId: source.containerId ?? null,
		objectName: source.objectName ?? source.name ?? null,
		index: Number.isInteger(source.index) ? source.index : null,
	};
}

function makeStatus(status = {}, fallbackStage = "parsed") {
	return {
		valid: Boolean(status.valid),
		promotable: Boolean(status.promotable),
		stage: status.stage ?? fallbackStage,
		reason: status.reason ?? null,
	};
}

function makeAnnotations(annotations = []) {
	return Array.isArray(annotations) ? annotations.filter(Boolean) : [];
}

function makeMeta(meta = null) {
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

	return hasOwnKeys(out) ? out : {};
}

function makeDerived({ sparseAlignment = null, derived = null } = {}) {
	const base = isObject(derived) ? { ...derived } : {};
	if (sparseAlignment) base.sparseAlignment = sparseAlignment;
	return hasOwnKeys(base) ? base : {};
}

function unwrap(result) {
	return result?.item ?? null;
}

export function makeAlignmentImportItem({
	id,
	source,
	payload,
	meta = null,
	sparseAlignment = null,
	derived = null,
	status = {},
	annotations = [],
} = {}) {
	const safeDerived = makeDerived({ sparseAlignment, derived });
	const hasSparseAlignment = isObject(safeDerived?.sparseAlignment);

	return createImportSessionItem({
		id,
		kind: "alignment",
		source: makeSource(source),
		payload: payload ?? {},
		status: makeStatus({
			valid: status.valid ?? true,
			promotable: status.promotable ?? hasSparseAlignment,
			stage: status.stage ?? (hasSparseAlignment ? "derived" : "validated"),
			reason: status.reason ?? null,
		}, "validated"),
		meta: makeMeta(meta),
		derived: safeDerived,
		annotations: makeAnnotations(annotations),
	});
}

export function makeProfileImportItem({ id, source, payload, meta = null, derived = null, status = {}, annotations = [] } = {}) {
	return createImportSessionItem({
		id,
		kind: "profile",
		source: makeSource(source),
		payload: payload ?? {},
		status: makeStatus({
			valid: status.valid ?? true,
			promotable: status.promotable ?? false,
			stage: status.stage ?? "validated",
			reason: status.reason ?? null,
		}, "validated"),
		meta: makeMeta(meta),
		derived: makeDerived({ derived }),
		annotations: makeAnnotations(annotations),
	});
}

export function makeCantImportItem({ id, source, payload, meta = null, derived = null, status = {}, annotations = [] } = {}) {
	return createImportSessionItem({
		id,
		kind: "cant",
		source: makeSource(source),
		payload: payload ?? {},
		status: makeStatus({
			valid: status.valid ?? true,
			promotable: status.promotable ?? false,
			stage: status.stage ?? "validated",
			reason: status.reason ?? null,
		}, "validated"),
		meta: makeMeta(meta),
		derived: makeDerived({ derived }),
		annotations: makeAnnotations(annotations),
	});
}

export function makeStaEqImportItem({ id, source, payload, meta = null, derived = null, status = {}, annotations = [] } = {}) {
	return createImportSessionItem({
		id,
		kind: "staEq",
		source: makeSource(source),
		payload: payload ?? {},
		status: makeStatus({
			valid: status.valid ?? true,
			promotable: status.promotable ?? false,
			stage: status.stage ?? "validated",
			reason: status.reason ?? null,
		}, "validated"),
		meta: makeMeta(meta),
		derived: makeDerived({ derived }),
		annotations: makeAnnotations(annotations),
	});
}

export function makeRelationImportItem({ id, source, payload, meta = null, derived = null, status = {}, annotations = [] } = {}) {
	return createImportSessionItem({
		id,
		kind: "relation",
		source: makeSource(source),
		payload: payload ?? {},
		status: makeStatus({
			valid: status.valid ?? true,
			promotable: status.promotable ?? false,
			stage: status.stage ?? "validated",
			reason: status.reason ?? null,
		}, "validated"),
		meta: makeMeta(meta),
		derived: makeDerived({ derived }),
		annotations: makeAnnotations(annotations),
	});
}

export function makeRejectedImportItem({ id, kind, source, payload, meta = null, reason = "rejected", annotations = [] } = {}) {
	return createRejectedImportSessionItem({
		id,
		kind,
		source: makeSource(source),
		payload: payload ?? {},
		meta: makeMeta(meta),
		reason,
		annotations: makeAnnotations(annotations),
	});
}

export function createAlignmentImportItem(args = {}) { return unwrap(makeAlignmentImportItem(args)); }
export function createProfileImportItem(args = {}) { return unwrap(makeProfileImportItem(args)); }
export function createCantImportItem(args = {}) { return unwrap(makeCantImportItem(args)); }
export function createStaEqImportItem(args = {}) { return unwrap(makeStaEqImportItem(args)); }
export function createRelationImportItem(args = {}) { return unwrap(makeRelationImportItem(args)); }
export function createRejectedItem(args = {}) { return unwrap(makeRejectedImportItem(args)); }

function hasOwnKeys(obj) {
	return isObject(obj) && Object.keys(obj).length > 0;
}

function nonEmptyOrNull(value) {
	return (typeof value === "string" && value.trim()) ? value.trim() : null;
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
