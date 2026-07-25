import { TransitionQuantityRole } from "./quantityRoles.js";

export function buildFutureAxtranInputContract({
	transitionId,
	components = [],
	knownParameters = {},
	freeParameters = [],
	fixedParameters = [],
	constraints = [],
	boundaryConditions = {},
	requestedOutputQuantities = [
		TransitionQuantityRole.CURVATURE,
	],
} = {}) {
	return {
		contractVersion: "future-axtran-input/v1",
		transitionId: String(transitionId ?? ""),
		orderedTransitionComponents: components,
		knownParameters,
		freeParameters,
		fixedParameters,
		constraints,
		boundaryConditions,
		requestedOutputQuantities,
		status: "prepared-only",
		note: "This contract is intentionally solver-agnostic and not wired to axtranNew in this package.",
	};
}