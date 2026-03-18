// src/shared/messaging/createWorkerContext.js

import { createSpotStore } from "../../model/spot/SpotStore.js";
import transitionLookup from "../../alignment/transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "../../alignment/transition/registry/RegistryResolver.js";

export function createWorkerContext({ router } = {}) {
	const db = transitionLookup;

	return {
		router,

		// static resources
		db,
		registryResolver: new RegistryResolver(db),

		// state hosts
		projectState: {
			activeRouteProjectId: null,
		},

		importState: {
			sessionId: null,
			phase: "idle",     // idle | collecting | parsing | ready | error
			items: [],
			error: null,
		},

		// stores
		spotStore: createSpotStore(),
	};
}
