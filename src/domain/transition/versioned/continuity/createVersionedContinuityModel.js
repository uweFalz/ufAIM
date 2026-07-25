import { KappaFcnBuilder } from "../../build/KappaFcnBuilder.js";
import {
	TransitionQuantityRole,
	TRANSITION_SCHEMA_VERSION,
} from "../quantityRoles.js";

const EPS = 1e-12;
const QUANTITIES = [
	TransitionQuantityRole.CURVATURE,
	TransitionQuantityRole.CURVATURE_FIRST_DERIVATIVE,
	TransitionQuantityRole.CURVATURE_SECOND_DERIVATIVE,
];

export function createVersionedContinuityModel({
	registryResolver,
	kappaBuilder = KappaFcnBuilder,
} = {}) {
	if (!registryResolver?.resolveTransitionDescriptor) {
		throw new Error("createVersionedContinuityModel: missing registryResolver");
	}

	function evaluate({ transitionRecord, parameters = {} } = {}) {
		const recordId = String(transitionRecord?.id ?? "").toLowerCase();
		if (!recordId) return failure("TRANSITION_RECORD_MISSING", "transition record id is required");
		if (transitionRecord?.schemaVersion !== TRANSITION_SCHEMA_VERSION) {
			return failure("TRANSITION_SCHEMA_UNSUPPORTED", `unsupported schema '${transitionRecord?.schemaVersion ?? "missing"}'`);
		}

		const w1 = numberOr(parameters.w1, transitionRecord?.typedParameters?.w1?.value);
		const w2 = numberOr(parameters.w2, transitionRecord?.typedParameters?.w2?.value);
		if (!Number.isFinite(w1) || !Number.isFinite(w2) || w1 < 0 || w2 < w1 || w2 > 1) {
			return failure("TRANSITION_PARTITION_INVALID", "partition must satisfy 0 <= w1 <= w2 <= 1", { parameter: "w1,w2" });
		}

		try {
			const descriptor = registryResolver.resolveTransitionDescriptor(recordId);
			const familyPackage = kappaBuilder.buildFamiliesFromDescriptor(descriptor, { w1, w2 });
			const lengths = [w1, w2 - w1, 1 - w2];
			const anchors = familyPackage.normCrvAnchor;
			const families = familyPackage.kappaFamilies;
			const components = transitionRecord.components.map((component, index) =>
				evaluateComponent({
					component,
					length: lengths[index],
					startValue: anchors[index],
					endValue: anchors[index + 1],
					family: families[index],
				})
			);

			const joins = [];
			const inactiveJoins = [];
			for (let index = 0; index < components.length - 1; index += 1) {
				const left = components[index];
				const right = components[index + 1];
				const joinId = `${left.componentId}->${right.componentId}`;
				if (!left.active || !right.active) {
					inactiveJoins.push({
						id: joinId,
						leftComponentId: left.componentId,
						rightComponentId: right.componentId,
						reason: !left.active && !right.active ? "both-components-zero-length" : "zero-length-component",
					});
					continue;
				}
				joins.push(buildJoin(joinId, left, right));
			}

			// When a zero-length middle component is retained structurally, the two
			// neighboring active intervals still have one physical join.
			const activeComponents = components.filter((component) => component.active);
			if (activeComponents.length >= 2) {
				for (let index = 0; index < activeComponents.length - 1; index += 1) {
					const left = activeComponents[index];
					const right = activeComponents[index + 1];
					const id = `${left.componentId}->${right.componentId}`;
					if (!joins.some((join) => join.id === id)) joins.push(buildJoin(id, left, right));
				}
			}

			const first = activeComponents[0] ?? null;
			const last = activeComponents.at(-1) ?? null;
			return {
				ok: true,
				recordId,
				parameters: { ...parameters, w1, w2 },
				components,
				joins,
				inactiveJoins,
				endpoints: {
					start: first ? endpoint(first.componentId, first.start) : emptyEndpoint("no-active-component"),
					end: last ? endpoint(last.componentId, last.end) : emptyEndpoint("no-active-component"),
				},
				evaluatorQuantities: QUANTITIES,
				provenance: structuredClone(transitionRecord.provenance ?? null),
			};
		} catch (error) {
			return failure("TRANSITION_EVALUATION_FAILED", String(error?.message ?? error));
		}
	}

	return { evaluate };
}

function evaluateComponent({ component, length, startValue, endValue, family }) {
	const active = Number.isFinite(length) && length > EPS;
	const componentId = String(component?.componentId ?? component?.role ?? "component");
	if (!active) {
		return {
			componentId,
			role: component?.role ?? null,
			active: false,
			normalizedLength: length,
			start: null,
			end: null,
			provenance: structuredClone(component?.provenance ?? null),
		};
	}
	const delta = endValue - startValue;
	return {
		componentId,
		role: component?.role ?? null,
		active: true,
		normalizedLength: length,
		start: valuesAt(0, length, startValue, delta, family),
		end: valuesAt(1, length, startValue, delta, family),
		provenance: structuredClone(component?.provenance ?? null),
	};
}

function valuesAt(local, length, start, delta, family) {
	return {
		[TransitionQuantityRole.CURVATURE]: start + delta * family.kappa(local),
		[TransitionQuantityRole.CURVATURE_FIRST_DERIVATIVE]: delta * family.kappa1(local) / length,
		[TransitionQuantityRole.CURVATURE_SECOND_DERIVATIVE]: delta * family.kappa2(local) / (length * length),
	};
}

function buildJoin(id, left, right) {
	const quantities = {};
	for (const quantity of QUANTITIES) {
		const leftValue = Number(left.end?.[quantity]);
		const rightValue = Number(right.start?.[quantity]);
		quantities[quantity] = {
			left: finiteOrNull(leftValue),
			right: finiteOrNull(rightValue),
			residual: Number.isFinite(leftValue) && Number.isFinite(rightValue) ? leftValue - rightValue : null,
		};
	}
	return {
		id,
		active: true,
		leftComponentId: left.componentId,
		rightComponentId: right.componentId,
		quantities,
	};
}

function endpoint(componentId, values) {
	return { active: true, componentId, quantities: structuredClone(values) };
}

function emptyEndpoint(reason) {
	return { active: false, componentId: null, quantities: {}, reason };
}

function failure(code, reason, detail = {}) {
	return { ok: false, error: { code, reason, ...detail } };
}

function numberOr(value, fallback) {
	return value == null ? Number(fallback) : Number(value);
}

function finiteOrNull(value) {
	return Number.isFinite(value) ? value : null;
}
