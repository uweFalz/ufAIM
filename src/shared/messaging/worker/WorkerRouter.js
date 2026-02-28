// src/shared/messaging/worker/WorkerRouter.js

export function startWorkerRouter(self) {
	self.onconnect = (e) => {
		const port = e.ports[0];
		port.start();

		port.onmessage = (evt) => {
			// TODO: routing
			port.postMessage({ ok: true, echo: evt.data });
		};
	};
}
