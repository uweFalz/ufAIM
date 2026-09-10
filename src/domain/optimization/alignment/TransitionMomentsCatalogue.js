// src/domain/optimization/alignment/TransitionMomentsCatalogue.js
//
// The moment table of every transition family the registry knows, built once
// per family from its normalised curvature law and kept: what the pose
// Jacobian's chain (`createAlignmentPoseJacobian`) asks for as `momentsFor`.

import { createTransitionMoments, curvatureIntegralFrom } from "./TransitionMoments.js";

export const TRANSITION_MOMENTS_CATALOGUE_VERSION = "axtran2/transition-moments-catalogue/0.1";

/**
 * @param {{descriptorResolver: {resolveTransitionDescriptor(family: string): object},
 *          kappaBuilder: {buildPresetFromDescriptor(descriptor: object): {kappa(u: number): number}}}} deps
 * @returns {(family?: string) => object}  the moments of a family, with its `khat`
 */
export function createTransitionMomentsCatalogue({ descriptorResolver, kappaBuilder } = {}) {
	if (typeof descriptorResolver?.resolveTransitionDescriptor !== "function" || typeof kappaBuilder?.buildPresetFromDescriptor !== "function") {
		throw new Error("createTransitionMomentsCatalogue needs a descriptor resolver and a kappa builder");
	}
	const cache = new Map();
	return function momentsFor(family = "clothoid") {
		if (!cache.has(family)) {
			const preset = kappaBuilder.buildPresetFromDescriptor(descriptorResolver.resolveTransitionDescriptor(family));
			const khat = curvatureIntegralFrom((u) => preset.kappa(Math.max(0, Math.min(1, u))));
			cache.set(family, Object.freeze({ ...createTransitionMoments({ id: family, curvatureIntegral: khat }), khat }));
		}
		return cache.get(family);
	};
}
