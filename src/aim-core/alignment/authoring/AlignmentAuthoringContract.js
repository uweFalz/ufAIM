export const ALIGNMENT_AUTHORING_CONTRACT_VERSION =
	"aim-core/alignment-authoring/0.1";

export const ALIGNMENT_AUTHORING_RESULT_VERSION =
	"aim-core/alignment-authoring-result/0.1";

export const ALIGNMENT_AUTHORING_OPERATIONS = Object.freeze(["update-arc"]);

export const ALIGNMENT_AUTHORING_REJECTION_CODES = Object.freeze([
	"INVALID_REQUEST",
	"ALIGNMENT_NOT_FOUND",
	"ALIGNMENT_ID_MISMATCH",
	"ELEMENT_NOT_FOUND",
	"ELEMENT_TYPE_MISMATCH",
	"INVALID_ARC_PARAMETERS",
	"CONSTRUCTIVE_SEQUENCE_REJECTED",
]);

const CHANGE_KEYS = Object.freeze(["length", "curvature", "radius"]);

function reject(reason) {
	return { ok: false, code: "INVALID_REQUEST", reason };
}

function isRecord(value) {
	return value != null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function hasOwn(value, key) {
	return Object.prototype.hasOwnProperty.call(value, key);
}

export function validateAlignmentAuthoringRequest(request) {
	if (!isRecord(request)) return reject("request must be an object");

	if (request.contractVersion !== ALIGNMENT_AUTHORING_CONTRACT_VERSION) {
		return reject("unsupported contractVersion");
	}
	if (!isNonEmptyString(request.alignmentId)) {
		return reject("alignmentId must be a non-empty string");
	}
	if (request.operation !== "update-arc") {
		return reject("operation must be update-arc");
	}
	if (!isNonEmptyString(request.elementId)) {
		return reject("elementId must be a non-empty string");
	}
	if (!isRecord(request.changes)) {
		return reject("changes must be an object");
	}

	const suppliedKeys = Object.keys(request.changes);
	if (suppliedKeys.length === 0) {
		return reject("at least one arc change is required");
	}
	if (suppliedKeys.some((key) => !CHANGE_KEYS.includes(key))) {
		return reject("changes contains an unsupported member");
	}
	if (
		hasOwn(request.changes, "curvature") &&
		hasOwn(request.changes, "radius")
	) {
		return reject("curvature and radius cannot both be supplied");
	}

	const changes = {};
	if (hasOwn(request.changes, "length")) {
		const { length } = request.changes;
		if (!Number.isFinite(length) || length <= 0) {
			return reject("length must be a finite number greater than zero");
		}
		changes.length = length;
	}

	for (const key of ["curvature", "radius"]) {
		if (!hasOwn(request.changes, key)) continue;
		const value = request.changes[key];
		if (!Number.isFinite(value) || value === 0) {
			return reject(`${key} must be a finite non-zero number`);
		}
		changes[key] = value;
	}

	return {
		ok: true,
		value: {
			contractVersion: ALIGNMENT_AUTHORING_CONTRACT_VERSION,
			alignmentId: request.alignmentId,
			operation: "update-arc",
			elementId: request.elementId,
			changes,
		},
	};
}
