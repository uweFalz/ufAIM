// app/runtime/intro/IntroDirector.js
//
// Debug-only intro runtime skeleton.
// No animation. No GeoEngine ownership. No workspace behavior changes.

export const INTRO_SIGNAL = {
	USER_INTERACTION: "INTRO_SIGNAL.USER_INTERACTION",
};

export const INTRO_PHASE = {
	IDLE: "idle",
	ARMED: "armed",
	RUNNING: "running",
	GLOBE_CHASE: "GLOBE_CHASE",
	LOCATE_PROJECT_WORLD: "LOCATE_PROJECT_WORLD",
	DONE: "done",
	SKIPPED: "skipped",
};

export class IntroDirector {
	constructor({ prefs = {}, log = console } = {}) {
		this.prefs = prefs;
		this.log = log;
		this.state = INTRO_PHASE.IDLE;
		this._skipRequested = false;
	}

	get enabled() {
		return Boolean(this.prefs?.intro?.enabled);
	}

	_setState(next) {
		this.state = next;
		this.log.info?.(`[intro] ${next}`);
	}

	arm() {
		if (!this.enabled) {
			this._setState(INTRO_PHASE.IDLE);
			return false;
		}

		this._setState(INTRO_PHASE.ARMED);
		return true;
	}

	start() {
		if (!this.enabled) return false;
		if (this.state !== INTRO_PHASE.ARMED) this.arm();

		this._setState(INTRO_PHASE.RUNNING);
		this._setState(INTRO_PHASE.GLOBE_CHASE);

		return true;
	}

	signal(signalType, meta = {}) {
		if (!this.enabled) return false;

		this.log.info?.(`[intro] signal: ${signalType}`, meta);

		if (
			signalType === INTRO_SIGNAL.USER_INTERACTION &&
			this.state === INTRO_PHASE.GLOBE_CHASE
		) {
			this._setState(INTRO_PHASE.LOCATE_PROJECT_WORLD);
			return true;
		}

		return false;
	}

	complete() {
		if (!this.enabled) return false;
		if (
			this.state !== INTRO_PHASE.RUNNING &&
			this.state !== INTRO_PHASE.GLOBE_CHASE &&
			this.state !== INTRO_PHASE.LOCATE_PROJECT_WORLD
		) {
			return false;
		}

		this._setState(INTRO_PHASE.DONE);
		return true;
	}

	skip(reason = "manual") {
		if (!this.enabled) return false;

		this._skipRequested = true;
		this.log.info?.(`[intro] skip requested: ${reason}`);

		if (
			this.state === INTRO_PHASE.ARMED ||
			this.state === INTRO_PHASE.RUNNING ||
			this.state === INTRO_PHASE.GLOBE_CHASE ||
			this.state === INTRO_PHASE.LOCATE_PROJECT_WORLD
		) {
			this._setState(INTRO_PHASE.SKIPPED);
		}

		return true;
	}
}
