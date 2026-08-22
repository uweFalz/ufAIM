// src/domain/alignment/editor/buildSparseAlignment.js

import transitionLookup from "@transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "@transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "@src/aim-core/transition/runtime/KappaFcnBuilder.js";
import {
	buildSparseAlignment as buildSparseAlignmentCore,
	buildSparseFromEditModel as buildSparseFromEditModelCore,
} from "@src/aim-core/alignment/aggregate/SparseAlignmentBuilder.js";

const descriptorResolver = new RegistryResolver(transitionLookup);
const dependencies = {
	descriptorResolver,
	kappaBuilder: KappaFcnBuilder,
};

export function buildSparseAlignment(alignmentData) {
	return buildSparseAlignmentCore(alignmentData, dependencies);
}

export function buildSparseFromEditModel(alignmentData) {
	return buildSparseFromEditModelCore(alignmentData, dependencies);
}

export default buildSparseAlignment;
