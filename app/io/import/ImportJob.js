export const IMPORT_JOB_PHASES = Object.freeze([
	"queued",
	"reading",
	"sniffing",
	"parser-loading",
	"extracting",
	"normalizing",
	"staged",
	"committing",
	"succeeded",
	"failed",
	"cancelled",
]);

const LINEAR_PHASES = IMPORT_JOB_PHASES.slice(0, 9);
const TERMINAL_PHASES = new Set(["succeeded", "failed", "cancelled"]);

export class ImportJobTransitionError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "ImportJobTransitionError";
		this.code = code;
	}
}

export function createImportJob({
	file,
	idFactory = () => globalThis.crypto?.randomUUID?.()
		?? `import-${Date.now()}-${Math.random()}`,
	now = () => Date.now(),
	heartbeatIntervalMs = 250,
} = {}) {
	if (!file || typeof file !== "object") {
		throw new TypeError("createImportJob: file is required");
	}
	const jobId = String(idFactory()).trim();
	if (!jobId) throw new TypeError("createImportJob: idFactory returned an empty ID");
	const fileName = String(file.name ?? "");
	const fileSize = Number(file.size ?? 0);
	const createdAt = toIso(now());
	const abortController = new AbortController();
	let phase = "queued";
	let progress = 0;
	let heartbeatAt = createdAt;
	let outcome = null;
	let cancellationReason = null;
	let error = null;
	let completedAt = null;
	let heartbeatTimer = null;
	const intervalMs = Math.min(1000, Math.max(10, Number(heartbeatIntervalMs) || 250));

	function beat() {
		if (TERMINAL_PHASES.has(phase)) return;
		heartbeatAt = toIso(now());
	}

	function startHeartbeat() {
		if (heartbeatTimer != null || TERMINAL_PHASES.has(phase)) return;
		beat();
		heartbeatTimer = setInterval(beat, intervalMs);
	}

	function stopHeartbeat() {
		if (heartbeatTimer == null) return;
		clearInterval(heartbeatTimer);
		heartbeatTimer = null;
	}

	function transition(nextPhase, nextProgress = progress) {
		if (TERMINAL_PHASES.has(phase)) {
			throw new ImportJobTransitionError(
				"IMPORT_JOB_TERMINAL",
				`Import job ${jobId} is already ${phase}`
			);
		}
		if (nextPhase === "failed") {
			// Failure is terminal from every nonterminal phase, including commit.
		} else if (nextPhase === "cancelled") {
			if (phase === "committing") {
				throw new ImportJobTransitionError(
					"IMPORT_JOB_ILLEGAL_TRANSITION",
					`Import job ${jobId} cannot transition from committing to ${nextPhase}`
				);
			}
		} else {
			const currentIndex = LINEAR_PHASES.indexOf(phase);
			const nextIndex = LINEAR_PHASES.indexOf(nextPhase);
			if (currentIndex < 0 || nextIndex !== currentIndex + 1) {
				throw new ImportJobTransitionError(
					"IMPORT_JOB_ILLEGAL_TRANSITION",
					`Import job ${jobId} cannot transition from ${phase} to ${nextPhase}`
				);
			}
		}
		phase = nextPhase;
		progress = nextProgress;
		beat();
		if (TERMINAL_PHASES.has(phase)) {
			completedAt = toIso(now());
			stopHeartbeat();
		}
		return snapshot();
	}

	function update({ phase: nextPhase, progress: nextProgress = progress } = {}) {
		if (!IMPORT_JOB_PHASES.includes(nextPhase)) {
			throw new ImportJobTransitionError(
				"IMPORT_JOB_ILLEGAL_TRANSITION",
				`Import job ${jobId} does not support phase ${String(nextPhase)}`
			);
		}
		return transition(nextPhase, nextProgress);
	}

	function complete(nextOutcome = null) {
		const next = transition("succeeded", 1);
		outcome = nextOutcome;
		return snapshot();
	}

	function fail(nextError) {
		const next = transition("failed", progress);
		error = normalizeError(nextError);
		return snapshot();
	}

	function abort(reason = "user-request") {
		if (TERMINAL_PHASES.has(phase) || phase === "committing") return false;
		cancellationReason = String(reason ?? "user-request");
		abortController.abort(cancellationReason);
		transition("cancelled", progress);
		return true;
	}

	function snapshot() {
		return Object.freeze({
			jobId,
			fileName,
			fileSize,
			phase,
			progress,
			heartbeatAt,
			outcome,
			cancellationReason,
			error,
			createdAt,
			completedAt,
		});
	}

	startHeartbeat();

	return Object.freeze({
		jobId,
		fileName,
		fileSize,
		get phase() { return phase; },
		get progress() { return progress; },
		get heartbeatAt() { return heartbeatAt; },
		get outcome() { return outcome; },
		signal: abortController.signal,
		abort,
		update,
		complete,
		fail,
		snapshot,
	});
}

export function throwIfImportJobAborted(signal) {
	if (!signal?.aborted) return;
	const abortError = new Error(String(signal.reason ?? "Import cancelled"));
	abortError.name = "AbortError";
	abortError.code = "IMPORT_JOB_CANCELLED";
	throw abortError;
}

function normalizeError(value) {
	return Object.freeze({
		name: String(value?.name ?? "Error"),
		message: String(value?.message ?? value ?? "Import failed"),
		code: value?.code == null ? null : String(value.code),
	});
}

function toIso(value) {
	const date = value instanceof Date ? value : new Date(value);
	return date.toISOString();
}
