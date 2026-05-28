// app/runtime/intro/introRuntimeBridge.js
//
// Runtime bridge for IntroDirector.
//
// All methods are intentionally soft:
// if geoView does not support an action yet, nothing breaks.

export function makeIntroRuntimeBridge({
	store,
	messaging,
	geoView,
	logLine,
} = {}) {
	function log(msg) {
		logLine?.(msg);
	}

	async function prepareIntroScene() {
		log("[Intro] prepare scene");

		store?.actions?.setUiMode?.({
			mode: "intro",
			source: "intro",
		});

		geoView?.setIntroMode?.(true);
		geoView?.setGlobeMode?.();
	}

	async function runGlobeChase() {
		log("[Intro] globe chase");

		await softCall(geoView?.flyIntroGlobeChase);
	}

	async function runLocateWorld() {
		log("[Intro] locate project world");

		await softCall(geoView?.flyIntroLocateWorld);
	}

	async function handoverToWorkspace() {
		log("[Intro] handover");

		geoView?.setIntroMode?.(false);
		geoView?.setWorkspaceMode?.();

		store?.actions?.setUiMode?.({
			mode: "workspace",
			source: "intro",
		});
	}

	async function abortIntro(reason = "skip") {
		log(`[Intro] skipped: ${reason}`);

		geoView?.setIntroMode?.(false);

		store?.actions?.setUiMode?.({
			mode: "workspace",
			source: "intro-skip",
		});
	}

	async function finishIntro() {
		log("[Intro] done");
	}

	function dispose() {}

	return {
		prepareIntroScene,
		runGlobeChase,
		runLocateWorld,
		handoverToWorkspace,
		abortIntro,
		finishIntro,
		dispose,
	};
}

async function softCall(fn) {
	if (typeof fn !== "function") return;
	await fn();
}
