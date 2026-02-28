// app/core/WindowRuntime.js (former AppCore.js)

import { createMessagingClient } from "@src/shared/messaging/createMessagingClient.js";

// legacy bootstrap (UI + alignment sandbox)
import { bootApp } from "./AppCore.js";

// optional: local runtime-server (nur im local-mode)
import { AppRuntimeLocal } from "@src/shared/runtime/AppRuntimeLocal.js";

export class WindowRuntime {
	constructor({ prefs }) {
		this.prefs = prefs;
		this.messaging = null;
		this.windowId = `w_${Math.random().toString(16).slice(2)}`;
	}

	async start() {
		this.messaging = await createMessagingClient(this.prefs);

		// Wenn LocalBus: runtime-server im gleichen Fenster einklinken
		if (this.prefs?.messaging?.mode !== "sharedWorker") {
			const runtime = new AppRuntimeLocal({ windowId: this.windowId, debug: !!this.prefs?.messaging?.debug });
			this.messaging.attachRuntime((msg) => runtime.handle(msg));
		}

		// basic hello
		this.messaging.send({ type: "win:hello", windowId: this.windowId, ts: Date.now() });

		// Beispiel: Worker hello loggen
		this.messaging.on("worker:hello", (m) => console.log("[WindowRuntime] worker says hello", m));

		const legacyOn = (this.prefs?.runtime?.legacyAppCore ?? true);
		
		if (legacyOn) {
			bootApp({ prefs: this.prefs, messaging: this.messaging }).catch((error) => {
				console.error(error);
				const logElement = document.getElementById("log");
				if (logElement) logElement.textContent = "boot failed ❌\n" + String(error);
			});
		}


		// TODO: Views init (threeViewer etc) -> nur via this.messaging.send(...)
	}
}
