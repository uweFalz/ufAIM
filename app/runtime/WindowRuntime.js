// app/runtime/WindowRuntime.js

import { createMessagingClient } from "@shared/messaging/createMessagingClient.js";
import { setMessagingService } from "@shared/runtime/runtimeServices.js";
import { AppRuntimeLocal } from "@shared/runtime/AppRuntimeLocal.js";
import { debugLog, debugError } from "@shared/debug/debugLog.js";

import { bootWindowApp } from "./bootWindowApp.js";

export class WindowRuntime {
	constructor({ prefs } = {}) {
		this.prefs = prefs ?? {};
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
				messaging: this.messaging,
			});

			this.messaging.attachRuntime((msg) => runtime.handle(msg));
		}

		this.installDebugHooks();

		this.messaging.emitEvt("Window.Register", {
			title: document.title || "ufAIM",
			capabilities: ["alignment.view", "transition.editor"],
		});

		if (this.prefs?.runtime?.legacyAppCore ?? true) {
			bootWindowApp({
				prefs: this.prefs,
				messaging: this.messaging,
			}).catch((error) => {
				debugError("WindowRuntime", "bootWindowApp failed", {
					message: error?.message ?? String(error),
					stack: error?.stack ?? null,
				});

				const logElement = document.getElementById("log");
				if (logElement) {
					logElement.textContent = "boot failed ❌\n" + String(error);
				}
			});
		}
	}

	installDebugHooks() {
		this.messaging.on("worker:hello", (msg) => {
			debugLog("WindowRuntime", "worker says hello", msg);
		});

		this.messaging.onEvt("Debug.Log", (payload) => {
			const level = payload?.level ?? "log";
			const scope = payload?.scope ?? "debug";
			const message = payload?.message ?? "";
			const meta = payload?.meta ?? null;

			if (level === "error") {
				debugError(scope, message, meta);
			} else {
				debugLog(scope, message, meta);
			}

			const logElement = document.getElementById("log");
			if (!logElement) return;

			const line = meta == null
				? `[${scope}] ${message}\n`
				: `[${scope}] ${message} ${safeStringify(meta)}\n`;

			logElement.textContent += line;
		});
	}
}

function safeStringify(value) {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}
