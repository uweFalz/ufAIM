// src/shared/messaging/local/LocalBus.js

function routeKeyFromMsg(msg) {
	// v0 legacy: msg.type
	// v1 contract: msg.name
	return String(msg?.name ?? msg?.type ?? "");
}

export class LocalBus {
	constructor({ debug = false, echo = false } = {}) {
		this.debug = debug;
		this.echo = echo;

		this._handlers = new Map();      // key -> Set(fn)   (key = name || type)
		this._cmdHandlers = new Map();   // cmdName -> fn(payload,msg) => result | Promise
		this._runtimeHandler = null;     // optional “server side”
	}

	async connect() {}

	attachRuntime(handlerFn) {
		this._runtimeHandler = handlerFn;
	}

	on(key, fn) {
		const k = String(key || "");
		if (!k) throw new Error("LocalBus.on: missing key");
		if (!this._handlers.has(k)) this._handlers.set(k, new Set());
		this._handlers.get(k).add(fn);
		return () => this._handlers.get(k)?.delete(fn);
	}

	// --- Command helpers (local mode only) ---
	onCmd(name, handlerFn) {
		const n = String(name || "");
		if (!n) throw new Error("LocalBus.onCmd: missing name");
		this._cmdHandlers.set(n, handlerFn);
		return () => this._cmdHandlers.delete(n);
	}

	async sendCmd(name, payload = {}, opts = {}) {
		const n = String(name || "");
		if (!n) throw new Error("LocalBus.sendCmd: missing name");

		const msg = {
			type: "cmd",
			name: n,
			payload: payload ?? {},
			ts: Date.now(),
			id: opts.id ?? `m_${Date.now()}_${Math.random().toString(16).slice(2)}`
		};

		if (this.debug) console.log("[LocalBus.sendCmd]", msg);

		const h = this._cmdHandlers.get(n);
		if (!h) throw new Error(`LocalBus.sendCmd: no handler for "${n}"`);

		const result = await h(msg.payload, msg);
		return result;
	}

	emitEvt(name, payload = {}) {
		const msg = {
			type: "evt",
			name: String(name || ""),
			payload: payload ?? {},
			ts: Date.now(),
			id: `e_${Date.now()}_${Math.random().toString(16).slice(2)}`
		};
		return this.send(msg);
	}

	async send(msg) {
		if (this.debug) console.log("[LocalBus.send]", msg);

		// 1) deliver to runtime (server-side) if present
		if (this._runtimeHandler) {
			const maybe = await this._runtimeHandler(msg);
			if (maybe) this._deliver(maybe);
		}

		// 2) deliver to local subscribers
		this._deliver(msg);

		// optional echo
		if (this.echo) this._deliver({ ...msg, _echo: true });
	}

	broadcast(msg) {
		// local mode: broadcast == send (only one window)
		return this.send({ ...msg, broadcast: true });
	}

	_deliver(msg) {
		const key = routeKeyFromMsg(msg);
		if (!key) return;

		const set = this._handlers.get(key);
		if (!set) return;

		for (const fn of set) {
			try { fn(msg); } catch (e) { console.error(e); }
		}
	}
}
