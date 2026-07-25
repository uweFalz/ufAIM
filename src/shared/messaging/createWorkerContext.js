// src/shared/messaging/createWorkerContext.js

import { createSpotStore } from "../../model/spot/model/SpotStore.js";
import transitionLookup from "../../domain/transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "../../domain/transition/registry/RegistryResolver.js";

export function createWorkerContext({ router } = {}) {
	const db = transitionLookup;

	return {
		router,

		// static resources
		db,
		registryResolver: new RegistryResolver(db),

		// state hosts
		projectState: {
			workspace_selection: {
				primaryId: null,
				contextIds: [],
			},
		},

		importState: {
			sessionId: null,
			phase: "idle",     // idle | collecting | parsing | ready | error
			items: [],
			resultEvidence: [],
			error: null,
		},

		// stores
		spotStore: createSpotStore(),
	};
}
