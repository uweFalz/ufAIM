// app/runtime/bootWindowApp.js

import { t } from "@app/i18n/strings.js";
import { createRuntimeContext } from "./createRuntimeContext.js";

import { makeTransitionEditorView } from "@app/view/editors/transitionEditorView.js";
import { KappaFcnBuilder } from "@src/domain/transition/build/KappaFcnBuilder.js";

import { initShell } from "@runtime/init/initShell.js";
import { initState } from "@runtime/init/initState.js";
import { initFocus } from "@runtime/init/initFocus.js";
import { initFeatures } from "@runtime/init/initFeatures.js";

export async function bootWindowApp({ prefs, messaging } = {}) {
	if (window.__ufAIM_booted) return;
	window.__ufAIM_booted = true;

	if (!prefs) throw new Error("bootWindowApp: missing prefs (makeSystemPrefs)");

	const ctx = createRuntimeContext({ prefs, messaging });

	initState(ctx);

	ctx.transV = makeTransitionEditorView(ctx.store, {
		messaging: ctx.messaging,
		kappaBuilder: KappaFcnBuilder,
	});

	initShell(ctx);
	initFocus(ctx);

	ctx.ui.setStatus?.(t("boot_ok"));
	ctx.logLine?.(t("boot_ready"));
	ctx.ui.logInfo?.(
		`btnTrans=${!!ctx.ui.elements.buttonTransition} overlay=${!!ctx.ui.elements.transitionOverlay}`
	);

	await initFeatures(ctx);

	return ctx.ui;
}
