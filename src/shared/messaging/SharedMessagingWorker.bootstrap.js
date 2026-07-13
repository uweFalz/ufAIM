// src/shared/messaging/SharedMessagingWorker.bootstrap.js
//
// Classic SharedWorker entrypoint.
// This wrapper keeps SharedWorker compatibility in runtimes where
// `type: "module"` SharedWorkers are unavailable.

const queuedConnectEvents = [];
let routerOnConnect = null;

function onConnectQueue(event) {
	if (typeof routerOnConnect === "function") {
		routerOnConnect(event);
		return;
	}

	queuedConnectEvents.push(event);
}

self.onconnect = onConnectQueue;

const workerModuleUrl = new URL(
	"/src/shared/messaging/SharedMessagingWorker.js",
	self.location.href
).href;

import(workerModuleUrl)
	.then(() => {
		if (typeof self.onconnect === "function" && self.onconnect !== onConnectQueue) {
			routerOnConnect = self.onconnect;
			self.onconnect = onConnectQueue;
		}

		if (typeof routerOnConnect !== "function") {
			return;
		}

		while (queuedConnectEvents.length > 0) {
			const event = queuedConnectEvents.shift();
			try {
				routerOnConnect(event);
			} catch (error) {
				console.error("[SharedMessagingWorker.bootstrap] queued onconnect failed", error);
			}
		}
	})
	.catch((error) => {
		console.error("[SharedMessagingWorker.bootstrap] failed to load worker module", error);

		const payload = {
			type: "worker:error",
			message: String(error?.message ?? error),
			stack: error?.stack ? String(error.stack) : null,
			ts: Date.now(),
		};

		while (queuedConnectEvents.length > 0) {
			const event = queuedConnectEvents.shift();
			const port = event?.ports?.[0];
			if (!port) continue;
			try {
				port.start?.();
				port.postMessage(payload);
			} catch {
				// ignore dead ports
			}
		}
	});
