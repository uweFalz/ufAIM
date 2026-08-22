import transitionLookup from "../../domain/transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "../../aim-core/transition/registry/RegistryResolver.js";

/**
 * Concrete application adapter for the repository's transition catalogue.
 *
 * This is the only service-layer module that knows the concrete JSON source.
 * All returned records and descriptors retain the canonical resolver's
 * identities and provenance.
 */
export class TransitionCatalogueAdapter {
	constructor({
		catalogue = transitionLookup,
		Resolver = RegistryResolver,
	} = {}) {
		this.catalogue = catalogue;
		this.resolver = new Resolver(catalogue);
	}

	listTransitionIds() {
		return this.resolver.listTransitionIds();
	}

	getTransitionMeta(recordId) {
		return this.resolver.getTransitionMeta(recordId);
	}

	resolveTransitionDescriptor(recordId) {
		return this.resolver.resolveTransitionDescriptor(recordId);
	}

	resolveVersionedTransitionRecord(recordId) {
		return this.resolver.resolveVersionedTransitionRecord(recordId);
	}

	getVersionedRegistry() {
		return this.resolver.getVersionedRegistry();
	}

	getVersionedValidationReport() {
		return this.resolver.getVersionedValidationReport();
	}
}
