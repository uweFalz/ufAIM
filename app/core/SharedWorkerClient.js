// app/core/SharedWorkerClient.js

export class SharedWorkerClient {
	constructor(workerUrl, { debugEcho = false } = {}) {
		this.worker = new SharedWorker(workerUrl, { type: "module" });
		this.port = this.worker.port;

		this.port.onmessage = (e) => this._onMessage?.(e.data);
		this.port.start();

		console.log("[SharedWorkerClient] connected –", workerUrl);

		// <-- Prefs-Flag sofort setzen
		this.send({ type: "worker:setDebug", echo: !!debugEcho });
	}

	send(msg) {
		try { this.port.postMessage(msg); } catch (e) {}
	}

	onMessage(fn) { this._onMessage = fn; }
}
