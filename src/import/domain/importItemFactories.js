// src/import/domain/importItemFactories.js
//
// Import item factories
//
// Purpose:
// - single construction point for ImportSessionItem objects
// - thin adapter layer for import/domain callers
// - no guessing, no repair, no UI logic
//
// Important:
// This file does NOT define the contract itself.
// Contract + validation live in:
// - src/import/contracts/importSessionItem.contract.js
// - src/import/validation/validateImportSessionItem.js
// - src/import/factories/createImportSessionItem.js
//
// Rule:
// domain code calls these helpers,
// helpers always return validated ImportSessionItem wrappers.

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
	return Array.isArray(annotations) ? annotations : [];
}

function unwrap(result) {
	return result?.item ?? null;
}

export function makeAlignmentImportItem({
	id,
	source,
	payload,
	sparseAlignment = null,
	status = {},
	annotations = [],
} = {}) {
	return createImportSessionItem({
		id,
		kind: "alignment",
		source: makeSource(source),
		payload: payload ?? {},
		status: makeStatus(
			{
				valid: status.valid ?? true,
				promotable: status.promotable ?? Boolean(sparseAlignment),
				stage: status.stage ?? (sparseAlignment ? "derived" : "validated"),
				reason: status.reason ?? null,
			},
			"validated"
		),
		derived: sparseAlignment ? { sparseAlignment } : {},
		annotations: makeAnnotations(annotations),
	});
}

export function makeProfileImportItem({
	id,
	source,
	payload,
	status = {},
	annotations = [],
} = {}) {
	return createImportSessionItem({
		id,
		kind: "profile",
		source: makeSource(source),
		payload: payload ?? {},
		status: makeStatus(
			{
				valid: status.valid ?? true,
				promotable: status.promotable ?? false,
				stage: status.stage ?? "validated",
				reason: status.reason ?? null,
			},
			"validated"
		),
		annotations: makeAnnotations(annotations),
	});
}

export function makeCantImportItem({
	id,
	source,
	payload,
	status = {},
	annotations = [],
} = {}) {
	return createImportSessionItem({
		id,
		kind: "cant",
		source: makeSource(source),
		payload: payload ?? {},
		status: makeStatus(
			{
				valid: status.valid ?? true,
				promotable: status.promotable ?? false,
				stage: status.stage ?? "validated",
				reason: status.reason ?? null,
			},
			"validated"
		),
		annotations: makeAnnotations(annotations),
	});
}

export function makeStaEqImportItem({
	id,
	source,
	payload,
	status = {},
	annotations = [],
} = {}) {
	return createImportSessionItem({
		id,
		kind: "staEq",
		source: makeSource(source),
		payload: payload ?? {},
		status: makeStatus(
			{
				valid: status.valid ?? true,
				promotable: status.promotable ?? false,
				stage: status.stage ?? "validated",
				reason: status.reason ?? null,
			},
			"validated"
		),
		annotations: makeAnnotations(annotations),
	});
}

export function makeRelationImportItem({
	id,
	source,
	payload,
	status = {},
	annotations = [],
} = {}) {
	return createImportSessionItem({
		id,
		kind: "relation",
		source: makeSource(source),
		payload: payload ?? {},
		status: makeStatus(
			{
				valid: status.valid ?? true,
				promotable: status.promotable ?? false,
				stage: status.stage ?? "validated",
				reason: status.reason ?? null,
			},
			"validated"
		),
		annotations: makeAnnotations(annotations),
	});
}

export function makeRejectedImportItem({
	id,
	kind,
	source,
	payload,
	reason = "rejected",
	annotations = [],
} = {}) {
	return createRejectedImportSessionItem({
		id,
		kind,
		source: makeSource(source),
		payload: payload ?? {},
		reason,
		annotations: makeAnnotations(annotations),
	});
}

// -----------------------------------------------------------------------------
// convenience helpers returning only the canonical item
// useful where callers do not care about validation wrapper
// -----------------------------------------------------------------------------

export function createAlignmentImportItem(args = {}) {
	return unwrap(makeAlignmentImportItem(args));
}

export function createProfileImportItem(args = {}) {
	return unwrap(makeProfileImportItem(args));
}

export function createCantImportItem(args = {}) {
	return unwrap(makeCantImportItem(args));
}

export function createStaEqImportItem(args = {}) {
	return unwrap(makeStaEqImportItem(args));
}

export function createRelationImportItem(args = {}) {
	return unwrap(makeRelationImportItem(args));
}

export function createRejectedItem(args = {}) {
	return unwrap(makeRejectedImportItem(args));
}
