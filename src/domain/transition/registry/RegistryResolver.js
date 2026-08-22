import transitionLookup from "../transitionLookup.json" with { type: "json" };
import {
	RegistryResolver as CoreRegistryResolver,
} from "../../../aim-core/transition/registry/RegistryResolver.js";

export class RegistryResolver extends CoreRegistryResolver {
	constructor(db = transitionLookup) {
		super(db);
	}
}
