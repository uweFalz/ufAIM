// app/runtime/intro/introPolicies.js

import { INTRO_STATES } from "./introStates.js";

export function shouldStartIntro(prefs = {}) {
	if (prefs?.intro?.enabled === false) return false;
	if (prefs?.dev?.skipIntro === true) return false;
	return true;
}

export function shouldSkipIntro(state) {
	return ![
		INTRO_STATES.IDLE,
		INTRO_STATES.SKIPPED,
		INTRO_STATES.DONE,
	].includes(state);
}
