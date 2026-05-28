// app/runtime/intro/IntroDirector.js
//
// IntroDirector
//
// Role:
// - owns optional app-start intro flow
// - coordinates intro state machine
// - translates runtime signals into intro transitions
//
// NOT:
// - no rendering engine implementation
// - no direct DOM layout ownership
// - no project/model mutation
//
// Idea:
// Catch-the-globe / playful engineering entry,
// but always skippable and never blocking real work.

import { makeIntroStateMachine } from "./IntroStateMachine.js";
import { INTRO_STATES } from "./introStates.js";
import { shouldStartIntro, shouldSkipIntro } from "./introPolicies.js";
import { INTRO_SIGNALS } from "./introSignals.js";
import { makeIntroRuntimeBridge } from "./introRuntimeBridge.js";

export class IntroDirector {
	constructor({
		store,
		messaging,
		geoView,
		logLine,
		prefs = {},
	} = {}) {
		this.store = store ?? null;
		this.messaging = messaging ?? null;
		this.geoView = geoView ?? null;
		this.logLine = typeof logLine === "function" ? logLine : () => {};
		this.prefs = prefs;

		this.bridge = makeIntroRuntimeBridge({
			store: this.store,
			messaging: this.messaging,
			geoView: this.geoView,
			logLine: this.logLine,
		});

		this.machine = makeIntroStateMachine({
			initialState: INTRO_STATES.IDLE,
			onTransition: (ev) => this._onTransition(ev),
		});

		this._started = false;
		this._disposed = false;
		this._abortController = new AbortController();
	}

	start() {
		if (this._disposed || this._started) return false;
		this._started = true;

		if (!shouldStartIntro(this.prefs)) {
			this.machine.send(INTRO_SIGNALS.SKIP);
			return false;
		}

		this._wireUserAbortSignals();

		this.machine.send(INTRO_SIGNALS.START);
		return true;
	}

	skip(reason = "user") {
		if (this._disposed) return false;

		this.machine.send(INTRO_SIGNALS.SKIP, { reason });
		return true;
	}

	dispose() {
		this._disposed = true;
		this._abortController.abort();
		this.bridge.dispose?.();
	}

	_wireUserAbortSignals() {
		const signal = this._abortController.signal;

		window.addEventListener(
			"pointerdown",
			() => {
				if (shouldSkipIntro(this.machine.getState())) {
					this.skip("pointerdown");
				}
			},
			{ signal }
		);

		window.addEventListener(
			"keydown",
			(ev) => {
				if (ev.key === "Escape") {
					this.skip("escape");
				}
			},
			{ signal }
		);
	}

	async _onTransition({ from, to, signal, payload }) {
		this.logLine?.(`[Intro] ${from} -> ${to}`);

		switch (to) {
			case INTRO_STATES.PREPARE:
				await this.bridge.prepareIntroScene?.();
				this.machine.send(INTRO_SIGNALS.READY);
				return;

			case INTRO_STATES.GLOBE_CHASE:
				await this.bridge.runGlobeChase?.();
				this.machine.send(INTRO_SIGNALS.NEXT);
				return;

			case INTRO_STATES.LOCATE_PROJECT_WORLD:
				await this.bridge.runLocateWorld?.();
				this.machine.send(INTRO_SIGNALS.NEXT);
				return;

			case INTRO_STATES.HANDOVER_TO_WORKSPACE:
				await this.bridge.handoverToWorkspace?.();
				this.machine.send(INTRO_SIGNALS.DONE);
				return;

			case INTRO_STATES.SKIPPED:
				await this.bridge.abortIntro?.(payload?.reason ?? "skip");
				return;

			case INTRO_STATES.DONE:
				await this.bridge.finishIntro?.();
				return;

			default:
				return;
		}
	}
}
