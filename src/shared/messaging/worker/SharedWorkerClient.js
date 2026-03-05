// src/shared/messaging/worker/SharedWorkerClient.js

export class SharedWorkerClient {
	constructor({ url, debug = false } = {}) {
		this.url = url;
		this.debug = debug;
		this._handlers = new Map();
		this._pending = new Map(); // reqId -> {resolve,reject}
		this._port = null;
	}

	async connect() {
		// SharedWorker muss als Modul laufen
		const worker = new SharedWorker(this.url, { type: "module", name: "ufAIM-shared-messaging" });
		this._port = worker.port;
		this._port.onmessage = (ev) => this._deliver(ev.data);
		this._port.start();
		if (this.debug) console.log("[SharedWorkerClient] connected", this.url);
	}

	on(name, fn) {
		const key = String(name);
		if (!this._handlers.has(key)) this._handlers.set(key, new Set());
		this._handlers.get(key).add(fn);
		return () => this._handlers.get(key)?.delete(fn);
	}


	onCmd(name, handler) {
		// In worker-mode: command handlers live in the master/runtime, not in the view.
		// Keep API symmetric, but don't execute locally.
		throw new Error("SharedWorkerClient.onCmd: not supported in view-client");
	}

	emitEvt(name, payload = {}) {
		return this.send({ type: "evt", name: String(name), payload });
	}

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

		// 1) resolve pending cmd promises (optional legacy path; can stay)
		if (msg?.type === "ack" || msg?.type === "err") {
			const reqId = msg?.corr?.reqId || msg?.replyTo || msg?.reply_to;
			const p = reqId ? this._pending.get(reqId) : null;
			if (p) {
				this._pending.delete(reqId);
				if (msg.type === "err") p.reject(msg);
				else p.resolve(msg.payload);
				// NOTE: do NOT return here; we still want to notify listeners ("ack"/"err")
				// return;
			}
		}

		// 2) dispatch by TYPE first (this is what MessagingClient.sendCmdAwait expects)
		const typeKey = (msg && typeof msg === "object") ? msg.type : null;
		if (typeKey) {
			const setT = this._handlers.get(String(typeKey));
			if (setT) for (const fn of setT) {
				try { fn(msg); } catch (e) { console.error(e); }
			}
		}

		// 3) additionally dispatch by NAME (useful for evt/cmd subscriptions, etc.)
		const nameKey = (msg && typeof msg === "object") ? msg.name : null;
		if (nameKey) {
			const setN = this._handlers.get(String(nameKey));
			if (setN) for (const fn of setN) {
				try { fn(msg); } catch (e) { console.error(e); }
			}
		}
	}
}
