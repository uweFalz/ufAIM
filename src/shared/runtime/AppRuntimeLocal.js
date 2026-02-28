// src/shared/runtime/AppRuntimeLocal.js

export class AppRuntimeLocal {
	constructor({ windowId, debug = false } = {}) {
		this.windowId = windowId;
		this.debug = debug;
	}

	async handle(msg) {
		if (this.debug) console.log("[AppRuntimeLocal.handle]", msg);

		// v1: nur ein Ping/Pong Beispiel
		if (msg?.type === "win:hello") {
			return { type: "app:hello", ok: true, ts: Date.now() };
		}

		return null;
	}
}
