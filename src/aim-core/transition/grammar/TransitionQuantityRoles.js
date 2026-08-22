export const TRANSITION_SCHEMA_VERSION = "berlinish-transition-grammar/v1";
export const TRANSITION_UPGRADER_VERSION = "APP-TRANSITION-SYSTEM-001.v1";

export const TransitionQuantityRole = Object.freeze({
	NORMALIZED_LONGITUDINAL_PARAMETER: "normalized-longitudinal-parameter",
	NORMALIZED_COMPONENT_LENGTH: "normalized-component-length",
	PHYSICAL_LENGTH: "physical-length",
	CURVATURE: "curvature",
	CURVATURE_FIRST_DERIVATIVE: "curvature-first-derivative",
	CURVATURE_SECOND_DERIVATIVE: "curvature-second-derivative",
	CURVATURE_INTEGRAL: "curvature-integral",
	DIMENSIONLESS_COEFFICIENT: "dimensionless-coefficient",
	ANGLE: "angle",
});

export const TransitionComponentRole = Object.freeze({
	HALFWAVE_IN: "halfwave-in",
	CLOTHOID_CORE: "clothoid-core",
	HALFWAVE_OUT: "halfwave-out",
});

export const TransitionRepresentationLevel = Object.freeze({
	KAPPA: "kappa",
	KAPPA_1: "kappa1",
	KAPPA_2: "kappa2",
	KAPPA_INT: "kappaInt",
});

export const TRANSITION_COMPONENT_ORDER = Object.freeze([
	TransitionComponentRole.HALFWAVE_IN,
	TransitionComponentRole.CLOTHOID_CORE,
	TransitionComponentRole.HALFWAVE_OUT,
]);

export const ZERO_LENGTH_POLICY = Object.freeze({
	id: "explicit-three-components",
	description: "All three Berlinish components are retained explicitly; zero-length is represented by per-component state.",
});

export const SUPPORTED_EVALUATION_QUANTITIES = Object.freeze([
	TransitionQuantityRole.CURVATURE,
	TransitionQuantityRole.CURVATURE_FIRST_DERIVATIVE,
	TransitionQuantityRole.CURVATURE_SECOND_DERIVATIVE,
	TransitionQuantityRole.CURVATURE_INTEGRAL,
]);

export function isSupportedEvaluationQuantity(quantityRole) {
	return SUPPORTED_EVALUATION_QUANTITIES.includes(quantityRole);
}
