// src/shared/messaging/createMessagingClient.js
// src/shared/messaging/createMessagingTransport.js

import { LocalBus } from "./local/LocalBus.js";
import { SharedWorkerClient } from "./worker/SharedWorkerClient.js";

export async function createMessagingClient(prefs) {
	const cfg = prefs?.messaging ?? {};
	const mode = cfg.mode ?? "local";

	if (mode === "sharedWorker") {
		const url = cfg.workerUrl || "@app/core/SharedMessagingWorker.js";
		const client = new SharedWorkerClient({ url, debug: !!cfg.debug });
		await client.connect();
		return client;
	}

	// default: local in-window bus
	const bus = new LocalBus({ debug: !!cfg.debug });
	await bus.connect(); // no-op but keeps symmetry
	return bus;
}
