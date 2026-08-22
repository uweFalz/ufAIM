export {
	TRANSITION_SCHEMA_VERSION,
	TRANSITION_UPGRADER_VERSION,
	TransitionQuantityRole,
	TransitionComponentRole,
	TransitionRepresentationLevel,
	TRANSITION_COMPONENT_ORDER,
	ZERO_LENGTH_POLICY,
	SUPPORTED_EVALUATION_QUANTITIES,
	isSupportedEvaluationQuantity,
} from "../grammar/TransitionQuantityRoles.js";

export {
	upgradeLegacyTransitionLookup,
	toLegacyTransitionDescriptor,
	createLegacyRoundTripSnapshot,
} from "./upgradeLegacyTransitionLookup.js";

export {
	validateVersionedTransitionRegistry,
} from "../registry/validateVersionedTransitionRegistry.js";

export {
	createVersionedTransitionEvaluator,
} from "./VersionedTransitionEvaluator.js";

export {
	buildFutureAxtranInputContract,
} from "../axtran/buildFutureAxtranInputContract.js";
