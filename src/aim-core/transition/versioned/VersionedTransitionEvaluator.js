import { KappaFcnBuilder } from "../runtime/KappaFcnBuilder.js";
import { clamp01 } from "../runtime/clamp01.js";
import {
	TRANSITION_SCHEMA_VERSION,
	TransitionQuantityRole,
	isSupportedEvaluationQuantity,
} from "../grammar/TransitionQuantityRoles.js";

const QUANTITY_TO_PRESET_FUNCTION = {
	[TransitionQuantityRole.CURVATURE]: "kappa",
	[TransitionQuantityRole.CURVATURE_FIRST_DERIVATIVE]: "kappa1",
	[TransitionQuantityRole.CURVATURE_SECOND_DERIVATIVE]: "kappa2",
	[TransitionQuantityRole.CURVATURE_INTEGRAL]: "kappaInt",
};

function finiteOrNull(value) {
	return Number.isFinite(value) ? value : null;
}

function asNormalizedPosition(at) {
	if (!at || at.role !== TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER) {
		return {
			ok: false,
			error: {
				code: "TRANSITION_POSITION_ROLE_UNSUPPORTED",
				reason: "Only normalized longitudinal parameter positions are currently supported",
			},
		};
	}

	const raw = Number(at.value);
	if (!Number.isFinite(raw)) {
		return {
			ok: false,
			error: {
				code: "TRANSITION_POSITION_INVALID",
				reason: "Position value must be finite",
			},
		};
	}

	return {
		ok: true,
		value: clamp01(raw),
		clamped: raw !== clamp01(raw),
		raw,
	};
}

export function createVersionedTransitionEvaluator({
	registryResolver,
	kappaBuilder = KappaFcnBuilder,
	boundaryTolerance = 1e-10,
} = {}) {
	if (!registryResolver?.resolveTransitionDescriptor || !registryResolver?.resolveVersionedTransitionRecord) {
		throw new Error("createVersionedTransitionEvaluator: missing resolver with legacy+versioned methods");
	}
	if (!kappaBuilder?.buildPresetFromDescriptor) {
		throw new Error("createVersionedTransitionEvaluator: missing kappaBuilder.buildPresetFromDescriptor");
	}

	function evaluate(request = {}) {
		const transitionId = String(request.recordId ?? request.transitionId ?? "").toLowerCase();
		const quantityRole = String(request.quantity ?? "");

		if (!transitionId) {
			return {
				ok: false,
				error: {
					code: "TRANSITION_RECORD_MISSING",
					reason: "recordId is required",
				},
			};
		}

		if (!isSupportedEvaluationQuantity(quantityRole)) {
			return {
				ok: false,
				error: {
					code: "TRANSITION_QUANTITY_UNSUPPORTED",
					reason: `Unsupported quantity '${quantityRole}'`,
					supported: Object.keys(QUANTITY_TO_PRESET_FUNCTION),
				},
			};
		}

		const normalized = asNormalizedPosition(request.at ?? {});
		if (!normalized.ok) {
			return {
				ok: false,
				error: normalized.error,
			};
		}

		const descriptor = registryResolver.resolveTransitionDescriptor(transitionId);
		const versionedRecord = registryResolver.resolveVersionedTransitionRecord(transitionId);

		const w1 = request?.overrides?.w1;
		const w2 = request?.overrides?.w2;
		const opts = Number.isFinite(Number(w1)) && Number.isFinite(Number(w2))
			? { w1: Number(w1), w2: Number(w2) }
			: {};

		const runtimePreset = kappaBuilder.buildPresetFromDescriptor(descriptor, opts);
		const functionName = QUANTITY_TO_PRESET_FUNCTION[quantityRole];
		const fn = runtimePreset?.[functionName];

		if (typeof fn !== "function") {
			return {
				ok: false,
				error: {
					code: "TRANSITION_QUANTITY_FUNCTION_MISSING",
					reason: `Runtime preset missing function '${functionName}'`,
				},
			};
		}

		const value = Number(fn(normalized.value));
		const isFiniteValue = Number.isFinite(value);

		const kappaAtStart = Number(runtimePreset.kappa(0));
		const kappaAtEnd = Number(runtimePreset.kappa(1));

		return {
			ok: isFiniteValue,
			request: {
				recordId: transitionId,
				quantity: quantityRole,
				at: {
					role: TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER,
					value: normalized.value,
					rawValue: normalized.raw,
					wasClampedToDomain: normalized.clamped,
				},
			},
			result: {
				quantity: quantityRole,
				value: finiteOrNull(value),
				isFinite: isFiniteValue,
			},
			finiteValueDiagnostics: {
				isFiniteValue,
				isNaN: Number.isNaN(value),
				isPositiveInfinity: value === Number.POSITIVE_INFINITY,
				isNegativeInfinity: value === Number.NEGATIVE_INFINITY,
			},
			origin: {
				recordId: transitionId,
				recordKind: "transition",
				representationLevel: versionedRecord?.representationLevel ?? null,
				schemaVersion: TRANSITION_SCHEMA_VERSION,
			},
			normalizedDomain: {
				start: 0,
				end: 1,
				partition: {
					w1: runtimePreset?.cuts01?.w1 ?? null,
					w2: runtimePreset?.cuts01?.w2 ?? null,
				},
			},
			boundaryChecks: {
				kappaStartDeclared: 0,
				kappaEndDeclared: 1,
				kappaStartCalculated: finiteOrNull(kappaAtStart),
				kappaEndCalculated: finiteOrNull(kappaAtEnd),
				kappaStartValid: Number.isFinite(kappaAtStart) ? Math.abs(kappaAtStart) <= boundaryTolerance : false,
				kappaEndValid: Number.isFinite(kappaAtEnd) ? Math.abs(kappaAtEnd - 1) <= boundaryTolerance : false,
				tolerance: boundaryTolerance,
			},
			error: isFiniteValue
				? null
				: {
					code: "TRANSITION_EVALUATION_NONFINITE",
					reason: `Quantity '${quantityRole}' produced a non-finite value`,
				},
		};
	}

	function evaluateBatch(request = {}) {
		const transitionId = String(request.recordId ?? request.transitionId ?? "").toLowerCase();
		const positions = Array.isArray(request.positions)
			? request.positions
			: [];

		const quantities = Array.isArray(request.quantities)
			? request.quantities
			: [];

		return {
			recordId: transitionId,
			positions,
			quantities,
			results: quantities.map((quantity) => positions.map((position) => evaluate({
				recordId: transitionId,
				quantity,
				at: {
					role: TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER,
					value: position,
				},
			}))),
		};
	}

	return {
		evaluate,
		evaluateBatch,
	};
}
