// src/shared/messaging/createMessagingClient.js
// src/shared/messaging/createMessagingTransport.js

import { LocalBus } from "./local/LocalBus.js";
import { SharedWorkerClient } from "./worker/SharedWorkerClient.js";
import { MessagingClient } from "./MessagingClient.js";

export async function createMessagingClient(prefs, { windowId, role = "view" } = {}) {
	const cfg = prefs?.messaging ?? {};
	const mode = String(cfg.mode ?? "local");

	let transport;

	if (mode === "sharedWorker") {
		const url = String(cfg.workerUrl || "");
		if (!url) throw new Error("createMessagingClient: missing prefs.messaging.workerUrl");
		transport = new SharedWorkerClient({ url, debug: !!cfg.debug, echo: !!cfg.workerEcho });
		await transport.connect();
	} else {
		transport = new LocalBus({ debug: !!cfg.debug, echo: !!cfg.workerEcho });
		await transport.connect(); // no-op
	}

	// ✅ ALWAYS wrap transport
	return new MessagingClient({ transport, windowId, role });
}
