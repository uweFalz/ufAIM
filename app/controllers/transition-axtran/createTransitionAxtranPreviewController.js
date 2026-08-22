import { createTransitionAxtranPreviewProjection } from "./createTransitionAxtranPreviewProjection.js";

const REQUIRED_SERVICE_METHODS = Object.freeze([
	"resolveTransition",
	"evaluate",
	"evaluateContinuity",
	"solveContinuity",
	"prepareAxtranInput",
]);

/**
 * Orchestrates a read-only engineering preview over an injected application
 * service. It never applies the candidate or prepared AXTRAN declaration.
 */
export function createTransitionAxtranPreviewController({
	transitionAxtranApplicationService,
} = {}) {
	assertService(transitionAxtranApplicationService);

	return Object.freeze({
		createPreview(request = {}) {
			return createPreview(transitionAxtranApplicationService, request);
		},
	});
}

function createPreview(service, request) {
	const active = normalizeActive(request?.active);
	const selected = normalizeSelected(request?.selected);
	const provenance = request?.provenance ?? null;
	const errors = [...active.errors, ...selected.errors];
	const context = {
		active: active.value,
		selected: selected.value,
		provenance,
		errors,
	};

	if (errors.length > 0) {
		return createTransitionAxtranPreviewProjection(context);
	}

	const recordId = selected.value.recordId;
	const parameters = selected.value.parameters;
	const resolved = capture(errors, "descriptor", () =>
		service.resolveTransition(recordId)
	);
	const evaluation = capture(errors, "evaluation", () =>
		service.evaluate({
			...(request.evaluation ?? {}),
			recordId,
			parameters,
		})
	);
	const continuityEvaluation = capture(errors, "continuity-evaluation", () =>
		service.evaluateContinuity({ recordId, parameters })
	);
	const solved = capture(errors, "continuity-candidate", () =>
		service.solveContinuity({
			...(request.continuityProblem ?? {}),
			recordId,
			transitionRecord: resolved?.record,
		})
	);
	const axtranContract = capture(errors, "axtran-contract", () =>
		service.prepareAxtranInput({
			...(request.axtranInput ?? {}),
			recordId,
			transitionId: recordId,
			knownParameters: parameters,
		})
	);

	return createTransitionAxtranPreviewProjection({
		...context,
		descriptor: resolved?.descriptor ?? null,
		evaluation,
		continuityEvaluation,
		continuityCandidate: solved?.candidate ?? null,
		continuityValidation: solved?.validation ?? null,
		axtranContract,
		errors,
	});
}

function normalizeActive(active) {
	const errors = [];
	if (!isNonEmptyString(active?.alignmentId)) {
		errors.push(validationError("active.alignmentId"));
	}
	if (!isRevision(active?.revision)) {
		errors.push(validationError("active.revision"));
	}
	if (!isNonEmptyString(active?.elementId)) {
		errors.push(validationError("active.elementId"));
	}
	return {
		value: {
			alignmentId: active?.alignmentId ?? null,
			revision: active?.revision ?? null,
			elementId: active?.elementId ?? null,
		},
		errors,
	};
}

function normalizeSelected(selected) {
	const errors = [];
	if (!isNonEmptyString(selected?.recordId)) {
		errors.push(validationError("selected.recordId"));
	}
	if (!isRecord(selected?.parameters)) {
		errors.push(validationError("selected.parameters"));
	}
	return {
		value: {
			recordId: selected?.recordId ?? null,
			parameters: isRecord(selected?.parameters) ? selected.parameters : {},
		},
		errors,
	};
}

function capture(errors, stage, operation) {
	try {
		return operation();
	} catch (error) {
		errors.push({
			stage,
			code: "TRANSITION_AXTRAN_PREVIEW_FAILED",
			name: String(error?.name ?? "Error"),
			message: String(error?.message ?? error),
		});
		return null;
	}
}

function validationError(path) {
	return {
		stage: "request",
		code: "TRANSITION_AXTRAN_PREVIEW_INVALID_REQUEST",
		path,
		message: `${path} is required`,
	};
}

function assertService(service) {
	for (const method of REQUIRED_SERVICE_METHODS) {
		if (typeof service?.[method] !== "function") {
			throw new TypeError(
				`createTransitionAxtranPreviewController: transitionAxtranApplicationService.${method} is required`
			);
		}
	}
}

function isNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function isRevision(value) {
	return (
		(typeof value === "string" && value.trim().length > 0) ||
		(typeof value === "number" && Number.isFinite(value))
	);
}

function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
