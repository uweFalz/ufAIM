export function runGndMdbWorker({
	bytes,
	fileName,
	coreTableNames,
	limits = {},
	signal,
	onHeartbeat,
	WorkerClass = Worker,
}) {
	const timeoutMs = limits.maxExecutionMs ?? 30_000;
	return new Promise((resolve, reject) => {
		const worker = new WorkerClass(new URL("./vendor/mdb-reader-worker-3.2.0.js", import.meta.url), { type: "module", name: "gnd-mdb-extraction" });
		const timer = setTimeout(
			() => finish(Object.assign(new Error("MDB worker timed out"), {
				code: "MDB_WORKER_TIMEOUT",
			})),
			timeoutMs + 250
		);
		const heartbeat = setInterval(() => {
			try {
				onHeartbeat?.();
			} catch {
				// Observability must never control worker lifetime.
			}
		}, 500);
		let settled = false;
		const abort = () => finish(makeAbortError(signal?.reason));
		function finish(error, value) {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			clearInterval(heartbeat);
			signal?.removeEventListener?.("abort", abort);
			worker.onmessage = null;
			worker.onerror = null;
			worker.terminate();
			error ? reject(error) : resolve(value);
		}
		if (signal?.aborted) {
			finish(makeAbortError(signal.reason));
			return;
		}
		signal?.addEventListener?.("abort", abort, { once: true });
		worker.onerror = (event) => finish(Object.assign(
			new Error(event?.message || "MDB worker failed"),
			{ code: "MDB_WORKER_FAILED" }
		));
		worker.onmessage = ({ data } = {}) => {
			if (data?.type === "result") {
				finish(null, data.envelope);
			} else if (data?.type === "error") {
				finish(Object.assign(
					new Error(data?.error?.message || "MDB worker failed"),
					{ code: data?.error?.code || "MDB_WORKER_FAILED" }
				));
			}
		};
		const transferable = bytes instanceof Uint8Array ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes.slice(0);
		try {
			worker.postMessage({ type: "extract", id: crypto.randomUUID(), payload: { bytes: transferable, fileName, coreTableNames, limits } }, [transferable]);
		} catch (error) {
			finish(error);
		}
	});
}

function makeAbortError(reason) {
	const error = new Error(String(reason ?? "Import cancelled"));
	error.name = "AbortError";
	error.code = "IMPORT_JOB_CANCELLED";
	return error;
}
