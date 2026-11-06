// test/axtran2/worker-run.test.mjs
//
// The page's side of the worker: a worker whose script did not arrive is
// started again, a calculation that crashed is not. Fake workers stand in
// for the browser's; each one plays a script of what happens after the post.

import test from "node:test";
import assert from "node:assert/strict";
import { runInWorker, WorkerRunError, WORKER_RUN_VERSION } from "../../src/services/axtran2/workerRun.js";

// a worker that, once posted to, plays `script(worker, message)`
function fakeWorkers(scripts) {
	const made = [];
	const create = () => {
		const script = scripts[made.length];
		const worker = {
			terminated: false,
			posted: [],
			onmessage: null,
			onerror: null,
			terminate() { this.terminated = true; },
			postMessage(message, transfer = []) {
				this.posted.push({ message, transfer });
				queueMicrotask(() => { if (!this.terminated) script(this, message); });
			},
		};
		made.push(worker);
		return worker;
	};
	return { made, create };
}
const loadFailure = (worker) => worker.onerror({ message: "" });
const answer = (worker, message) => {
	worker.onmessage({ data: { ready: true } });
	worker.onmessage({ data: { id: message.id, ok: true, value: 42 } });
};
const job = () => {
	const bytes = new ArrayBuffer(8);
	return { message: { id: "run-1", bytes }, transfer: [bytes] };
};
// restarts without waiting; the pauses asked for are kept
const timers = () => {
	const pauses = [];
	return { pauses, setTimer: (fn, ms) => { pauses.push(ms); queueMicrotask(fn); return pauses.length; }, clearTimer: () => {} };
};

test("a worker that loads answers on the first start", async () => {
	assert.match(WORKER_RUN_VERSION, /^axtran2\/worker-run\//);
	const { made, create } = fakeWorkers([answer]);
	const retries = [];
	const result = await runInWorker({ create, job, onRetry: (r) => retries.push(r) }).promise;
	assert.deepEqual({ ok: result.ok, value: result.value, attempts: result.attempts }, { ok: true, value: 42, attempts: 1 });
	assert.equal(made.length, 1);
	assert.equal(made[0].terminated, true, "the worker is ended with the answer");
	assert.deepEqual(retries, []);
});

test("a worker whose script did not arrive is started again, with its own bytes each time", async () => {
	const { made, create } = fakeWorkers([loadFailure, loadFailure, answer]);
	const retries = [];
	const t = timers();
	const result = await runInWorker({ create, job, pauseMs: 300, onRetry: (r) => retries.push(r), ...t }).promise;
	assert.equal(result.attempts, 3);
	assert.equal(made.length, 3);
	assert.ok(made.every((w) => w.terminated), "no worker is left behind");
	assert.deepEqual(retries, [{ attempt: 2, attempts: 3 }, { attempt: 3, attempts: 3 }]);
	assert.deepEqual(t.pauses, [300, 600], "the pause grows with the attempt");
	const buffers = made.map((w) => w.posted[0].transfer[0]);
	assert.equal(new Set(buffers).size, 3, "each start was handed a buffer of its own");
});

test("a script that never arrives ends in WORKER_NOT_LOADED after the attempts given", async () => {
	const { made, create } = fakeWorkers([loadFailure, loadFailure, loadFailure, answer]);
	await assert.rejects(runInWorker({ create, job, attempts: 3, ...timers() }).promise, (e) => e instanceof WorkerRunError && e.code === "WORKER_NOT_LOADED" && e.attempts === 3);
	assert.equal(made.length, 3, "no fourth start");
});

test("an error with a message is the calculation's own and is not repeated", async () => {
	const crash = (worker) => worker.onerror({ message: "Uncaught RangeError: Invalid array length", filename: "http://x/src/a.js", lineno: 12 });
	const { made, create } = fakeWorkers([crash, answer]);
	await assert.rejects(runInWorker({ create, job, ...timers() }).promise, (e) => e.code === "WORKER_CRASHED" && /Invalid array length/.test(e.message) && e.where === "http://x/src/a.js:12");
	assert.equal(made.length, 1);
});

test("an error without a message after the worker said it was loaded is not repeated either", async () => {
	const dieLate = (worker) => { worker.onmessage({ data: { ready: true } }); worker.onerror({ message: "" }); };
	const { made, create } = fakeWorkers([dieLate, answer]);
	await assert.rejects(runInWorker({ create, job, ...timers() }).promise, (e) => e.code === "WORKER_CRASHED");
	assert.equal(made.length, 1, "minutes of calculation are not started again unasked");
});

test("cancel ends the worker and the wait for a restart", async () => {
	const never = () => {};
	const first = fakeWorkers([never]);
	const run = runInWorker({ create: first.create, job });
	run.cancel();
	await assert.rejects(run.promise, (e) => e.code === "CANCELLED");
	assert.equal(first.made[0].terminated, true);

	// cancelled while waiting to start again: the restart does not happen
	const second = fakeWorkers([loadFailure, answer]);
	let pending = null, cleared = 0;
	const waiting = runInWorker({ create: second.create, job, setTimer: (fn) => { pending = fn; return 1; }, clearTimer: () => { cleared++; } });
	await new Promise((r) => setTimeout(r, 0));
	assert.equal(typeof pending, "function", "a restart is waiting");
	waiting.cancel();
	await assert.rejects(waiting.promise, (e) => e.code === "CANCELLED");
	assert.equal(cleared, 1);
	assert.equal(second.made.length, 1);
});

test("answers to another job and late events of an ended worker are ignored", async () => {
	const { made, create } = fakeWorkers([
		(worker) => { worker.onmessage({ data: { id: "other", ok: true } }); worker.onerror({ message: "" }); },
		answer,
	]);
	const result = await runInWorker({ create, job, ...timers() }).promise;
	assert.equal(result.attempts, 2);
	// the first worker speaks after it was ended: nothing happens
	made[0].onmessage({ data: { id: "run-1", ok: false } });
	made[0].onerror({ message: "late" });
	assert.equal(result.ok, true);
});

test("the inputs are checked", () => {
	assert.throws(() => runInWorker({ create: null, job }), (e) => e.code === "INVALID_INPUT");
	assert.throws(() => runInWorker({ create: () => ({}), job, attempts: 0 }), (e) => e.code === "INVALID_INPUT");
});
