import { LocalBus } from "./local/LocalBus.js";
import { SharedWorkerClient } from "./worker/SharedWorkerClient.js";
import { MessagingClient } from "./MessagingClient.js";

export async function createMessagingClient(prefs, { windowId, role = "view" } = {}) {
	const cfg = prefs?.messaging ?? {};
	const mode = String(cfg.mode ?? "sharedWorker");

	let transport;

	if (mode === "sharedWorker") {
		const url = String(cfg.workerUrl || "");
		if (!url) throw new Error("createMessagingClient: missing prefs.messaging.workerUrl");
		transport = new SharedWorkerClient({ url, debug: !!cfg.debug, echo: !!cfg.workerEcho });
		await transport.connect();
	}
	else if (mode === "local") {
		transport = new LocalBus({ debug: !!cfg.debug, echo: !!cfg.workerEcho });
		await transport.connect(); // no-op
	}
	else {
		throw new Error(`createMessagingClient: unknown messaging mode '${mode}'`);
	}

	return new MessagingClient({ transport, windowId, role });
}
