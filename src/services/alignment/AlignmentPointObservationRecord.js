import { preparePointObservationInput } from "./AlignmentPointEvidenceRequest.js";

export const POINT_OBSERVATION_RECORD_VERSION = "alignment-point-observation-record/1";
export const POINT_OBSERVATION_REQUEST_VERSION = "alignment-point-observation-request/1";

const DEFAULT_OPTIONS = Object.freeze({
	maxIterations: 200,
	hessian: "gauss-newton",
	fitMode: "keep-plan",
	planSigma: 0.05,
	heldPoses: [],
	heldElements: [],
	turnout: null,
});

function requireText(value, name) {
	if (typeof value !== "string" || !value.trim()) throw new Error(`Point observation: ${name} is required`);
}

// Structured storage, not JSON encoding: actual solver diagnostics can contain
// Infinity (e.g. an undetermined direction). Never silently turn it into null.
export function copyObservationData(value, ancestors = new Set()) {
	if (value === null || typeof value !== "object") {
		if (["undefined", "string", "number", "boolean"].includes(typeof value) || value === null) return value;
		throw new Error("Point observation: unsupported stored value");
	}
	if (ancestors.has(value)) throw new Error("Point observation: cyclic stored value");
	if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
		throw new Error("Point observation: stored objects must be plain data");
	}
	ancestors.add(value);
	const result = Array.isArray(value) ? [] : {};
	for (const key of Reflect.ownKeys(value)) {
		if (Array.isArray(value) && key === "length") continue;
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (typeof key !== "string" || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
			throw new Error("Point observation: stored values must have enumerable data properties");
		}
		Object.defineProperty(result, key, {
			value: copyObservationData(descriptor.value, ancestors), enumerable: true, writable: true, configurable: true,
		});
	}
	if (Array.isArray(value)) result.length = value.length;
	ancestors.delete(value);
	return result;
}

export function sameObservationData(left, right) {
	if (Object.is(left, right)) return true;
	if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
	const keys = Object.keys(left);
	return (!Array.isArray(left) || left.length === right.length)
		&& keys.length === Object.keys(right).length
		&& keys.every((key) => Object.hasOwn(right, key) && sameObservationData(left[key], right[key]));
}

function normalizeOptions(options) {
	if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Point observation: invalid options");
	for (const key of Object.keys(options)) {
		if (!Object.hasOwn(DEFAULT_OPTIONS, key)) throw new Error(`Point observation: unsupported option ${key}`);
	}
	const result = copyObservationData({ ...DEFAULT_OPTIONS, ...options });
	if (!Number.isInteger(result.maxIterations) || result.maxIterations < 0
		|| !["gauss-newton", "bfgs", "auto"].includes(result.hessian)
		|| !["keep-plan", "measurements-only"].includes(result.fitMode)
		|| !Number.isFinite(result.planSigma) || result.planSigma <= 0
		|| !Array.isArray(result.heldPoses) || !Array.isArray(result.heldElements)) {
		throw new Error("Point observation: invalid solver options");
	}
	return result;
}

/** Source evidence and engineering assignments are separate from both geometries. */
export function createPointObservationRequest({ runId, object, afterAlignmentData, pointObservationInput, options = {} } = {}) {
	requireText(runId, "runId");
	const before = object?.data?.alignmentData;
	const revision = before?.meta?.modifiedAt ?? object?.meta?.modifiedAt;
	requireText(revision, "alignment revision");
	if (object?.type !== "alignment" || typeof object.id !== "string" || before?.id !== object.id || !Array.isArray(before?.editModel?.elements)) {
		throw new Error("Point observation: a native alignment object is required");
	}
	const after = afterAlignmentData === undefined ? before : afterAlignmentData;
	if (after?.id !== object.id || !Array.isArray(after?.editModel?.elements)) throw new Error("Point observation: invalid proposed alignment");
	const prepared = preparePointObservationInput(pointObservationInput);
	return copyObservationData({
		version: POINT_OBSERVATION_REQUEST_VERSION,
		id: runId,
		objectId: object.id,
		alignmentRevision: revision,
		objectMeta: object.meta ?? {},
		objectRefs: object.refs ?? {},
		beforeAlignmentData: before,
		afterAlignmentData: after,
		pointObservationInput: {
			observationSet: prepared.observationSet,
			assignments: prepared.assignments,
			alignmentMetricContext: prepared.alignmentMetricContext,
		},
		options: normalizeOptions(options),
	});
}

/** Validation is a data-integrity boundary, not authentication of outside producers. */
export function validatePointObservationRecord(input) {
	const entry = copyObservationData(input);
	const request = entry?.request;
	if (entry?.version !== POINT_OBSERVATION_RECORD_VERSION || request?.version !== POINT_OBSERVATION_REQUEST_VERSION) {
		throw new Error("Point observation: invalid record version");
	}
	const rebuilt = createPointObservationRequest({
		runId: request.id,
		object: {
			id: request.objectId, type: "alignment",
			data: { alignmentData: request.beforeAlignmentData }, meta: request.objectMeta, refs: request.objectRefs,
		},
		afterAlignmentData: request.afterAlignmentData,
		pointObservationInput: request.pointObservationInput,
		options: request.options,
	});
	if (!sameObservationData(request, rebuilt)) throw new Error("Point observation: invalid request snapshot");
	const result = entry.result;
	const source = request.pointObservationInput.observationSet;
	const binding = result?.pointObservation;
	if (result?.type !== "axtran2-consequence-evidence" || result.status !== "evidence-only" || result.admission !== "evidence-only"
		|| result.admissible !== false || typeof result.proposalStatus !== "string" || typeof result.ok !== "boolean"
		|| result.objective !== "points" || result.fitMode !== request.options.fitMode
		|| result.planSigma !== (request.options.fitMode === "keep-plan" ? request.options.planSigma : null)
		|| !result.diagnostics || !result.candidate
		|| binding?.mode !== "external-observations" || binding.setId !== source.id || binding.setRevision !== source.revision
		|| !sameObservationData(binding.pointIds, request.pointObservationInput.assignments.map((assignment) => assignment.pointId))
		|| !sameObservationData(binding.metricContext, request.pointObservationInput.alignmentMetricContext)
		|| !sameObservationData(binding.evaluatedInput, {
			beforeAlignmentData: request.beforeAlignmentData,
			afterAlignmentData: request.afterAlignmentData,
			pointObservationInput: request.pointObservationInput,
			options: request.options,
		})) {
		throw new Error("Point observation: invalid or unbound result");
	}
	return entry;
}

export function matchesPointObservationSnapshot(object, request) {
	return object?.type === "alignment" && object.id === request.objectId
		&& (object.data?.alignmentData?.meta?.modifiedAt ?? object.meta?.modifiedAt) === request.alignmentRevision
		&& sameObservationData(object.data?.alignmentData, request.beforeAlignmentData)
		&& sameObservationData(object.meta ?? {}, request.objectMeta)
		&& sameObservationData(object.refs ?? {}, request.objectRefs);
}
