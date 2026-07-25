export function runGndMdbWorker({ bytes, fileName, coreTableNames, limits = {}, WorkerClass = Worker }) {
	const timeoutMs = limits.maxExecutionMs ?? 30_000;
	return new Promise((resolve, reject) => {
		const worker = new WorkerClass(new URL("./vendor/mdb-reader-worker-3.2.0.js", import.meta.url), { type: "module", name: "gnd-mdb-extraction" });
		const timer = setTimeout(() => finish(new Error("MDB worker timed out")), timeoutMs + 250);
		function finish(error, value) { clearTimeout(timer); worker.terminate(); error ? reject(error) : resolve(value); }
		worker.onerror = (event) => finish(new Error(event.message || "MDB worker failed"));
		worker.onmessage = ({ data }) => data?.type === "result" ? finish(null, data.envelope) : data?.type === "error" ? finish(Object.assign(new Error(data.error.message), { code: data.error.code })) : undefined;
		const transferable = bytes instanceof Uint8Array ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes.slice(0);
		worker.postMessage({ type: "extract", id: crypto.randomUUID(), payload: { bytes: transferable, fileName, coreTableNames, limits } }, [transferable]);
	});
}
