import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	IMPORT_JOB_PHASES,
	ImportJobTransitionError,
	createImportJob,
} from "../../app/io/import/ImportJob.js";
import { runGndMdbWorker } from "../../src/import/parsers/technet/gndEdit/gnd/runGndMdbWorker.js";

function fakeFile(name = "test.mdb") {
	return { name, size: 42 };
}

test("uses the exact import-job phase vocabulary and stable file identity", () => {
	assert.deepEqual(IMPORT_JOB_PHASES, [
		"queued", "reading", "sniffing", "parser-loading", "extracting",
		"normalizing", "staged", "committing", "succeeded", "failed", "cancelled",
	]);
	const job = createImportJob({
		file: fakeFile(),
		idFactory: () => "job-A",
		now: () => 0,
	});
	assert.deepEqual(job.snapshot(), {
		jobId: "job-A",
		fileName: "test.mdb",
		fileSize: 42,
		phase: "queued",
		progress: 0,
		heartbeatAt: "1970-01-01T00:00:00.000Z",
		outcome: null,
		cancellationReason: null,
		error: null,
		createdAt: "1970-01-01T00:00:00.000Z",
		completedAt: null,
	});
	job.abort("test-cleanup");
});

test("accepts only the legal linear success transitions", () => {
	const job = createImportJob({ file: fakeFile(), idFactory: () => "job-linear" });
	for (const phase of IMPORT_JOB_PHASES.slice(1, 7)) job.update({ phase });
	job.update({ phase: "committing" });
	const result = job.complete({ ok: true });
	assert.equal(result.phase, "succeeded");
	assert.deepEqual(result.outcome, { ok: true });
});

test("illegal and terminal transitions expose stable structured errors", () => {
	const job = createImportJob({ file: fakeFile(), idFactory: () => "job-illegal" });
	assert.throws(
		() => job.update({ phase: "extracting" }),
		(error) => error instanceof ImportJobTransitionError
			&& error.code === "IMPORT_JOB_ILLEGAL_TRANSITION"
	);
	job.abort("stop");
	assert.throws(
		() => job.update({ phase: "reading" }),
		(error) => error instanceof ImportJobTransitionError
			&& error.code === "IMPORT_JOB_TERMINAL"
	);
});

test("failure and cancellation are accepted before committing", () => {
	const failed = createImportJob({ file: fakeFile(), idFactory: () => "job-failed" });
	failed.update({ phase: "reading" });
	assert.equal(failed.fail(Object.assign(new Error("broken"), { code: "BROKEN" })).phase, "failed");
	assert.equal(failed.snapshot().error.code, "BROKEN");
	const cancelled = createImportJob({ file: fakeFile(), idFactory: () => "job-cancelled" });
	cancelled.update({ phase: "reading" });
	assert.equal(cancelled.abort("operator"), true);
	assert.equal(cancelled.signal.aborted, true);
	assert.equal(cancelled.snapshot().cancellationReason, "operator");
});

test("cancellation during committing is refused", () => {
	const job = createImportJob({ file: fakeFile(), idFactory: () => "job-commit" });
	for (const phase of IMPORT_JOB_PHASES.slice(1, 7)) job.update({ phase });
	job.update({ phase: "committing" });
	assert.equal(job.abort("too-late"), false);
	assert.equal(job.phase, "committing");
	job.complete();
});

test("commit failure terminates a committing job without mutating it twice", () => {
	const job = createImportJob({ file: fakeFile(), idFactory: () => "job-commit-failed" });
	for (const phase of IMPORT_JOB_PHASES.slice(1, 7)) job.update({ phase });
	job.update({ phase: "committing" });
	const terminal = job.fail(Object.assign(new Error("commit timeout"), {
		code: "IMPORT_COMMIT_TIMEOUT",
	}));
	assert.equal(terminal.phase, "failed");
	assert.equal(terminal.error.code, "IMPORT_COMMIT_TIMEOUT");
	const beforeLateFailure = job.snapshot();
	assert.throws(
		() => job.fail(new Error("late failure")),
		(error) => error instanceof ImportJobTransitionError
			&& error.code === "IMPORT_JOB_TERMINAL"
	);
	assert.deepEqual(job.snapshot(), beforeLateFailure);
});

test("late completion cannot replace an already terminal outcome", () => {
	const job = createImportJob({ file: fakeFile(), idFactory: () => "job-late-complete" });
	for (const phase of IMPORT_JOB_PHASES.slice(1, 7)) job.update({ phase });
	job.update({ phase: "committing" });
	job.complete({ accepted: true });
	const terminal = job.snapshot();
	assert.throws(
		() => job.complete({ late: true }),
		(error) => error instanceof ImportJobTransitionError
			&& error.code === "IMPORT_JOB_TERMINAL"
	);
	assert.deepEqual(job.snapshot(), terminal);
});

test("heartbeat advances at no more than one-second intervals and stops terminally", async () => {
	let current = 0;
	const job = createImportJob({
		file: fakeFile(),
		idFactory: () => "job-heartbeat",
		now: () => current,
		heartbeatIntervalMs: 10,
	});
	current = 25;
	await new Promise((resolve) => setTimeout(resolve, 30));
	assert.equal(job.snapshot().heartbeatAt, "1970-01-01T00:00:00.025Z");
	job.abort("done");
	const terminalHeartbeat = job.snapshot().heartbeatAt;
	current = 100;
	await new Promise((resolve) => setTimeout(resolve, 20));
	assert.equal(job.snapshot().heartbeatAt, terminalHeartbeat);
});

test("MDB cancellation terminates exactly once and ignores late messages", async () => {
	const instances = [];
	class DelayedWorker {
		constructor() {
			this.terminations = 0;
			instances.push(this);
		}
		postMessage() {}
		terminate() { this.terminations += 1; }
	}
	const controller = new AbortController();
	const pending = runGndMdbWorker({
		bytes: new Uint8Array([1, 2, 3]),
		fileName: "cancel.mdb",
		coreTableNames: [],
		signal: controller.signal,
		WorkerClass: DelayedWorker,
	});
	controller.abort("cancel");
	await assert.rejects(pending, (error) => error.code === "IMPORT_JOB_CANCELLED");
	instances[0].onmessage?.({ data: { type: "result", envelope: { late: true } } });
	assert.equal(instances[0].terminations, 1);
});

test("MDB worker reports heartbeat and cleans up after success", async () => {
	let heartbeats = 0;
	class SuccessfulWorker {
		postMessage() {
			setTimeout(() => this.onmessage?.({
				data: { type: "result", envelope: { ok: true } },
			}), 520);
		}
		terminate() { this.terminations = (this.terminations ?? 0) + 1; }
	}
	const result = await runGndMdbWorker({
		bytes: new Uint8Array([1]),
		fileName: "ok.mdb",
		coreTableNames: [],
		onHeartbeat: () => { heartbeats += 1; },
		WorkerClass: SuccessfulWorker,
	});
	assert.deepEqual(result, { ok: true });
	assert(heartbeats >= 1);
});

test("MDB timeout terminates exactly once and ignores late completion", async () => {
	const instances = [];
	class TimedOutWorker {
		constructor() {
			this.terminations = 0;
			instances.push(this);
		}
		postMessage() {}
		terminate() { this.terminations += 1; }
	}
	const pending = runGndMdbWorker({
		bytes: new Uint8Array([1]),
		fileName: "timeout.mdb",
		coreTableNames: [],
		limits: { maxExecutionMs: -249 },
		WorkerClass: TimedOutWorker,
	});
	await assert.rejects(pending, (error) => error.code === "MDB_WORKER_TIMEOUT");
	instances[0].onmessage?.({ data: { type: "result", envelope: { late: true } } });
	assert.equal(instances[0].terminations, 1);
});

test("MDB synchronous dispatch failure cleans up exactly once", async () => {
	const instances = [];
	class ThrowingWorker {
		constructor() {
			this.terminations = 0;
			instances.push(this);
		}
		postMessage() { throw Object.assign(new Error("dispatch failed"), { code: "DISPATCH_FAILED" }); }
		terminate() { this.terminations += 1; }
	}
	await assert.rejects(
		runGndMdbWorker({
			bytes: new Uint8Array([1]),
			fileName: "dispatch.mdb",
			coreTableNames: [],
			WorkerClass: ThrowingWorker,
		}),
		(error) => error.code === "DISPATCH_FAILED"
	);
	assert.equal(instances[0].terminations, 1);
});

test("source contract reads once, carries bytes, and uses only atomic commit publication", async () => {
	const pipeline = await readFile(
		new URL("../../src/import/runImportPipeline.js", import.meta.url),
		"utf8"
	);
	const sniffer = await readFile(
		new URL("../../src/import/sniffers/sniffImportFile.js", import.meta.url),
		"utf8"
	);
	const controller = await readFile(
		new URL("../../app/controllers/importController.js", import.meta.url),
		"utf8"
	);
	assert.equal((pipeline.match(/file\.arrayBuffer\(\)/g) ?? []).length, 1);
	assert.equal((pipeline.match(/file\.text\(\)/g) ?? []).length, 0);
	assert.match(pipeline, /advanceJobToNormalizing\(\);/);
	assert(sniffer.includes("context?.bytes"));
	const productive = controller.slice(
		controller.indexOf("async function runImportBatch"),
		controller.indexOf("function importFiles")
	);
	assert(productive.includes('"Import.CommitJob"'));
	assert.match(productive, /const commitCandidates = \[\.\.\.stagedFiles\]/);
	assert.match(productive, /for \(const staged of commitCandidates\)/);
	assert.match(productive, /files: \[\{/);
	assert.match(productive, /evidencePublished: Boolean\(publication\?\.evidence\)/);
	assert(!productive.includes('"Import.BeginSession"'));
	assert(!productive.includes('"Import.PublishResultEvidence"'));
	assert(!productive.includes('"Import.AddItems"'));
	assert(productive.indexOf('"Import.CommitJob"') < productive.indexOf("setImportSummary"));
	assert.match(productive, /catch \(error\) \{\s*staged\.job\.fail\(error\)/);
	assert.match(productive, /for \(const staged of stagedFiles\) \{\s*staged\.job\.abort\("batch-cancelled"\)/);
	assert(controller.includes("getActiveImportJob"));
	assert(controller.includes("cancelActiveImportJob"));
});
