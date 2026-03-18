// app/core/runtime/WindowRuntime.js

import { createMessagingClient } from "@src/shared/messaging/createMessagingClient.js";
import { setMessagingService } from "@src/shared/runtime/runtimeServices.js";

import { bootWindowApp } from "./bootWindowApp.js";

import { AppRuntimeLocal } from "@src/shared/runtime/AppRuntimeLocal.js";

//
// ...
//
export class WindowRuntime {
	
	constructor({ prefs }) {		
		this.prefs = prefs;
		this.messaging = null;
		this.windowId = `w_${Math.random().toString(16).slice(2)}`;
	}

	async start() {
		this.messaging = await createMessagingClient(this.prefs, {
			windowId: this.windowId,
			role: "view",
		});
		
		setMessagingService(this.messaging);

		if (this.prefs?.messaging?.mode !== "sharedWorker") {
			const runtime = new AppRuntimeLocal({
				windowId: this.windowId,
				debug: !!this.prefs?.messaging?.debug,
				messaging: this.messaging
			});
			this.messaging.attachRuntime((msg) => runtime.handle(msg));
		}
		
		this.messaging.on("worker:hello", (m) => console.log("[WindowRuntime] worker says hello", m));
		
		this.messaging.on("Debug.Log", (msg) => {
			
			// console.debug("Debug.Log message arrived ", msg);
			
			const p = msg?.payload ?? {};
			const level = String(p.level ?? "log");
			const scope = String(p.scope ?? "unknown");
			const args = Array.isArray(p.args) ? p.args : [];

			const prefix = `[${scope}]`;

			if (level === "warn") console.warn(prefix, ...args);
			else if (level === "error") console.error(prefix, ...args);
			else console.log(prefix, ...args);

			const el = document.getElementById("log");
			if (el) {
				const line = `${prefix} ${args.map((x) => {
					if (typeof x === "string") return x;
					try { return JSON.stringify(x); }
					catch { return String(x); }
				}).join(" ")}\n`;

				el.textContent += line;
			}
		});
		
		/*
		const presets = await this.messaging.sendCmdAwait("Transition.ListPresets", {});
		console.log("presets", presets?.length, presets?.[0]);

		const spec = await this.messaging.sendCmdAwait("Transition.GetPresetSpec", { presetId: presets[0].id });
		console.log("spec", { presetId: spec?.presetId, cuts01: spec?.cuts01, hasDefs: !!spec?.defs });

		const projectState = await this.messaging.sendCmdAwait("Project.GetState", {});
		console.log("projectState", projectState || null);
		
		const dbg = await this.messaging.sendCmdAwait("Debug.GetWorkerState", {});
		console.log("workerDebug", dbg || null);

		this.messaging.emitEvt("Window.Register", {
			title: document.title || "ufAIM",
			capabilities: ["alignment.view", "transition.editor"],
		});
		*/

		if (this.prefs?.runtime?.legacyAppCore ?? true) {
			bootWindowApp({ prefs: this.prefs, messaging: this.messaging }).catch((error) => {
				console.error(error);
				const logElement = document.getElementById("log");
				if (logElement) logElement.textContent = "boot failed ❌\n" + String(error);
			});
		}
	}
}
