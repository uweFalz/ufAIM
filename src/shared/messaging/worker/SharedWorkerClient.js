// src/shared/messaging/worker/SharedWorkerClient.js

export class SharedWorkerClient {
	constructor({ url, debug = false } = {}) {
		this.url = url;
		this.debug = !!debug;
		this._handlers = new Map();
		this._pending = new Map(); // reqId -> {resolve,reject}
		this._port = null;
		this._helloReceived = false;
	}

	async connect() {
		const worker = new SharedWorker(this.url, {
			name: "ufAIM-shared-messaging",
		});

		this._port = worker.port;
		this._port.onmessage = (ev) => this._deliver(ev.data);
		this._port.start();

		await this.waitForHello({ timeoutMs: 6000 });

		if (this.debug) console.log("[SharedWorkerClient] connected", this.url);
	}

	waitForHello({ timeoutMs = 6000 } = {}) {
		if (this._helloReceived) return Promise.resolve();

		return new Promise((resolve, reject) => {
			const deadline = Date.now() + Math.max(1, Number(timeoutMs) || 6000);

			const poll = () => {
				if (this._helloReceived) {
					resolve();
					return;
				}

				if (Date.now() >= deadline) {
					reject(new Error(`SharedWorkerClient: worker hello timeout (${Math.max(1, Number(timeoutMs) || 6000)}ms)`));
					return;
				}

				setTimeout(poll, 25);
			};

			poll();
		});
	}

	on(name, fn) {
		const key = String(name);
		if (!this._handlers.has(key)) this._handlers.set(key, new Set());
		this._handlers.get(key).add(fn);
		return () => this._handlers.get(key)?.delete(fn);
	}

	onCmd(name, handler) {
		throw new Error("SharedWorkerClient.onCmd: not supported in view-client");
	}

	emitEvt(name, payload = {}) {
		return this.send({ type: "evt", name: String(name), payload });
	}

	// legacy helper; MessagingClient.sendCmdAwait is the preferred path
	sendCmd(name, payload = {}) {
		const reqId = `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
		return new Promise((resolve, reject) => {
			this._pending.set(reqId, { resolve, reject });
			this.send({ type: "cmd", id: reqId, name: String(name), payload });
		});
	}

	send(msg) {
		if (!this._port) throw new Error("SharedWorkerClient: not connected");
		if (this.debug) console.log("[SharedWorkerClient.send]", msg);
		this._port.postMessage(msg);
	}

	broadcast(msg) {
		return this.send({ ...msg, broadcast: true });
	}

	_deliver(msg) {
		if (this.debug) console.log("[SharedWorkerClient.recv]", msg);

		if (msg?.type === "worker:hello") {
			this._helloReceived = true;
		}

		// 1) resolve pending legacy promises
		if (msg?.type === "ack" || msg?.type === "err") {
			const reqId = msg?.corr?.reqId || msg?.replyTo || msg?.reply_to;
			const p = reqId ? this._pending.get(reqId) : null;
			if (p) {
				this._pending.delete(reqId);
				if (msg.type === "err") p.reject(msg);
				else p.resolve(msg.payload);
			}
		}

		// 2) dispatch by TYPE
		const typeKey = (msg && typeof msg === "object") ? msg.type : null;
		if (typeKey) {
			const setT = this._handlers.get(String(typeKey));
			if (setT) {
				for (const fn of setT) {
					try { fn(msg); } catch (e) { console.error(e); }
				}
			}
		}

		// 3) dispatch by NAME
		const nameKey = (msg && typeof msg === "object") ? msg.name : null;
		if (nameKey) {
			const setN = this._handlers.get(String(nameKey));
			if (setN) {
				for (const fn of setN) {
					try { fn(msg); } catch (e) { console.error(e); }
				}
			}
		}
	}
}
