// src/shared/messaging/createMessagingTransport.js

import { createWorkerUrl } from "./createWorkerUrl.js";

export function createMessagingTransport() {
	const url = createWorkerUrl("@src/shared/messaging/SharedMessagingWorker.js");

	// prefer SharedWorker, fallback Worker
	if ("SharedWorker" in globalThis) {
		try {
			const sw = new SharedWorker(url, { type: "module" });
			const port = sw.port;
			port.start();
			return { kind: "sharedworker", port, terminate: () => {/* sharedworker doesn't terminate */} };
		} catch (e) {
			console.warn("SharedWorker failed, falling back to Worker:", e);
		}
	}

	// fallback Worker
	const w = new Worker(url, { type: "module" });
	return {
		kind: "worker",
		port: {
			postMessage: (m) => w.postMessage(m),
			addEventListener: (...a) => w.addEventListener(...a),
			removeEventListener: (...a) => w.removeEventListener(...a),
			start: () => {},
		},
		terminate: () => w.terminate(),
	};
}
