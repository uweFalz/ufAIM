// src/domain/optimization/alignment/SolverDependencies.js
//
// AXTRAN2 Calculation Kernel - what every solve needs from the transition
// kernel: the descriptor resolver over the registry's lookup, the curvature
// function builder, and the moments catalogue built from them. Lifted from
// test/axtran2/corpus/createTraScenario.mjs on 2026-10-21 so that the
// adapter, the evidence service and the corpus build from one definition.

import transitionLookup from "../../transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "../../transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "../../transition/build/KappaFcnBuilder.js";
import { createTransitionMomentsCatalogue } from "./TransitionMomentsCatalogue.js";

/** { descriptorResolver, kappaBuilder } as the alignment factory and the sparse builder take them */
export const deps = Object.freeze({ descriptorResolver: new RegistryResolver(transitionLookup), kappaBuilder: KappaFcnBuilder });

/** the transition moments the pose Jacobian chain integrates with */
export const momentsFor = createTransitionMomentsCatalogue(deps);
