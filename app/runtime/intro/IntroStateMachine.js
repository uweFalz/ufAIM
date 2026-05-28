// app/runtime/intro/IntroStateMachine.js

import { INTRO_STATES } from "./introStates.js";
import { INTRO_SIGNALS } from "./introSignals.js";

const TRANSITIONS = {
	[INTRO_STATES.IDLE]: {
		[INTRO_SIGNALS.START]: INTRO_STATES.PREPARE,
		[INTRO_SIGNALS.SKIP]: INTRO_STATES.SKIPPED,
	},

	[INTRO_STATES.PREPARE]: {
		[INTRO_SIGNALS.READY]: INTRO_STATES.GLOBE_CHASE,
		[INTRO_SIGNALS.SKIP]: INTRO_STATES.SKIPPED,
	},

	[INTRO_STATES.GLOBE_CHASE]: {
		[INTRO_SIGNALS.NEXT]: INTRO_STATES.LOCATE_PROJECT_WORLD,
		[INTRO_SIGNALS.SKIP]: INTRO_STATES.SKIPPED,
	},

	[INTRO_STATES.LOCATE_PROJECT_WORLD]: {
		[INTRO_SIGNALS.NEXT]: INTRO_STATES.HANDOVER_TO_WORKSPACE,
		[INTRO_SIGNALS.SKIP]: INTRO_STATES.SKIPPED,
	},

	[INTRO_STATES.HANDOVER_TO_WORKSPACE]: {
		[INTRO_SIGNALS.DONE]: INTRO_STATES.DONE,
		[INTRO_SIGNALS.SKIP]: INTRO_STATES.SKIPPED,
	},
};

export function makeIntroStateMachine({
	initialState = INTRO_STATES.IDLE,
	onTransition,
} = {}) {
	let state = initialState;

	function getState() {
		return state;
	}

	function send(signal, payload = {}) {
		const next = TRANSITIONS[state]?.[signal] ?? null;
		if (!next) return false;

		const from = state;
		state = next;

		onTransition?.({
			from,
			to: next,
			signal,
			payload,
		});

		return true;
	}

	return {
		getState,
		send,
	};
}
