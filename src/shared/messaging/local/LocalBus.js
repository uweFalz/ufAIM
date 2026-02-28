// src/shared/messaging/local/LocalBus.js

export class LocalBus {
	constructor({ debug = false } = {}) {
		this.debug = debug;
		this._handlers = new Map(); // name/type -> Set(fn)
		this._cmdHandlers = new Map(); // name -> async handler(payload,msg)
		this._runtimeHandler = null; // optional “server side”
	}

	async connect() {}

	attachRuntime(handlerFn) {
		// handlerFn(msg) -> optional response
		this._runtimeHandler = handlerFn;
	}

	on(name, fn) {
		if (!this._handlers.has(type)) this._handlers.set(type, new Set());
		this._handlers.get(type).add(fn);
		return () => this._handlers.get(type)?.delete(fn);
	}


	onCmd(name, handler) {
		// handler(payload, msg) -> result (or throws)
		this._cmdHandlers.set(String(name), handler);
		return () => this._cmdHandlers.delete(String(name));
	}

	emitEvt(name, payload = {}) {
		return this.send({ type: "evt", name: String(name), payload });
	}

	async sendCmd(name, payload = {}) {
		const key = String(name);
		const handler = this._cmdHandlers.get(key);
		if (!handler) throw new Error(`LocalBus.sendCmd: no handler for '${key}'`);
		return await handler(payload, { type: "cmd", name: key, payload });
	}

	async send(msg) {
		if (this.debug) console.log("[LocalBus.send]", msg);

		// 1) deliver to runtime (server-side)
		if (this._runtimeHandler) {
			const maybe = await this._runtimeHandler(msg);
			if (maybe) this._deliver(maybe);
		}

		// 2) deliver to local subscribers (client-side)
		this._deliver(msg);
	}

	broadcast(msg) {
		// In local mode broadcast == send (only one window anyway)
		return this.send({ ...msg, broadcast: true });
	}

	_deliver(msg) {
		const key = msg?.name || msg?.type;
		const set = this._handlers.get(key);
		if (!set) return;
		for (const fn of set) {
			try { fn(msg); } catch (e) { console.error(e); }
		}
	}
}
