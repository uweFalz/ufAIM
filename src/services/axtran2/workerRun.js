// src/services/axtran2/workerRun.js
//
// One job through a worker, with the start repeated when the worker's
// script did not arrive.
//
// A module worker fetches its script and every module behind it. When one
// of those requests fails - a server that drops a connection is enough - the
// worker dies before it computed anything, and the page gets an error event
// that carries no message. That is a load failure, not a crash of the
// calculation: nothing was computed, so starting again is safe, and it is
// what the user would do by hand. An error that carries a message, or one
// that comes after the worker said it was loaded, is the calculation's own
// and is never repeated.

export const WORKER_RUN_VERSION = "axtran2/worker-run/0.1";

export class WorkerRunError extends Error {
	constructor(code, message, detail = {}) {
		super(message);
		this.name = "WorkerRunError";
		this.code = code;
		Object.assign(this, detail);
	}
}

/**
 * @param {object} input
 * @param {() => Worker} input.create        a fresh worker per attempt
 * @param {() => {message: {id: string}, transfer?: Transferable[]}} input.job
 *        the job per attempt: transferred buffers are gone after a post, so
 *        each attempt asks for its own
 * @param {number} [input.attempts]          starts in all, 3 by default
 * @param {number} [input.pauseMs]           pause before the n-th restart: n times this
 * @param {(info: {attempt: number, attempts: number}) => void} [input.onRetry]
 * @returns {{promise: Promise<object>, cancel: () => void}}
 */
export function runInWorker({ create, job, attempts = 3, pauseMs = 300, onRetry = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
	if (typeof create !== "function" || typeof job !== "function") throw new WorkerRunError("INVALID_INPUT", "create and job must be functions");
	if (!Number.isInteger(attempts) || attempts < 1) throw new WorkerRunError("INVALID_INPUT", "attempts must be a positive integer");
	let worker = null;
	let timer = null;
	let settled = false;
	let rejectRun = null;
	const stop = () => {
		worker?.terminate();
		worker = null;
		if (timer !== null) { clearTimer(timer); timer = null; }
	};
	const promise = new Promise((resolve, reject) => {
		rejectRun = reject;
		const finish = (settle, value) => {
			if (settled) return;
			settled = true;
			stop();
			settle(value);
		};
		const start = (attempt) => {
			let loaded = false;
			const mine = create();
			worker = mine;
			const { message, transfer = [] } = job();
			mine.onmessage = (event) => {
				if (worker !== mine) return;
				const data = event?.data;
				if (data?.ready === true) { loaded = true; return; }
				if (data?.id === message.id) finish(resolve, { ...data, attempts: attempt });
			};
			mine.onerror = (event) => {
				if (worker !== mine) return;
				event?.preventDefault?.();
				const text = typeof event?.message === "string" ? event.message.trim() : "";
				const where = event?.filename ? `${event.filename}${event.lineno ? `:${event.lineno}` : ""}` : "";
				if (loaded || text) {
					return finish(reject, new WorkerRunError("WORKER_CRASHED", text || "the worker stopped without a message", { where, attempts: attempt }));
				}
				mine.terminate();
				worker = null;
				if (attempt >= attempts) {
					return finish(reject, new WorkerRunError("WORKER_NOT_LOADED", `the worker's script did not load in ${attempts} attempts`, { attempts: attempt }));
				}
				onRetry({ attempt: attempt + 1, attempts });
				timer = setTimer(() => { timer = null; start(attempt + 1); }, pauseMs * attempt);
			};
			mine.postMessage(message, transfer);
		};
		start(1);
	});
	const cancel = () => {
		if (settled) return;
		settled = true;
		stop();
		rejectRun(new WorkerRunError("CANCELLED", "cancelled"));
	};
	return { promise, cancel };
}
