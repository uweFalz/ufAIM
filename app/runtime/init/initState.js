// app/runtime/init/initState.js

import { createWindowStore } from "@runtime/state/windowStore.js";
import { createWindowSessionState } from "@runtime/session/windowSessionState.js";
import { createWindowSessionController } from "@runtime/session/windowSessionController.js";

export function initState(ctx) {
	ctx.store = createWindowStore();
	if (ctx.prefs.isDev) window.__ufAIM_store = ctx.store;

	ctx.windowSessionState = createWindowSessionState();
	if (ctx.prefs.isDev) window.__ufAIM_windowSessionState = ctx.windowSessionState;

	ctx.windowSession = createWindowSessionController({
		store: ctx.store,
		sessionState: ctx.windowSessionState,
	});
	if (ctx.prefs.isDev) window.__ufAIM_windowSession = ctx.windowSession;
}
