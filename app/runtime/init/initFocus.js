// app/runtime/init/initFocus.js

import { createFocusManager } from "@app/controllers/focusManager.js";

export function initFocus(ctx) {
	ctx.focusManager = createFocusManager({
		windowSession: ctx.windowSession,
		store: ctx.store,
	});

	if (ctx.prefs.isDev) window.__ufAIM_focusManager = ctx.focusManager;
	if (ctx.prefs.isDev) window.__ufAIM_getFocus = () => ctx.focusManager?.getFocus?.();
	if (ctx.prefs.isDev) window.__ufAIM_getFocusLegacy = () => ctx.focusManager?.getFocusSnapshot?.();
}
