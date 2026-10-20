// axtran2/worker.js
//
// The fit runs off the page: a module worker takes the TRA's bytes and the
// lists, calls the shared calculation and posts the result back. The page
// stays responsive for the minutes a 22 km alignment takes.

import { fitTraFromBytes } from "../src/services/axtran2/fitTraCore.js";

self.onmessage = async (event) => {
	const { id, bytes, name, points, zwang, options } = event.data;
	try {
		const started = Date.now();
		const result = await fitTraFromBytes({ bytes: new Uint8Array(bytes), name, points, zwang, ...options });
		const tra = result.tra.buffer.slice(result.tra.byteOffset, result.tra.byteOffset + result.tra.byteLength);
		self.postMessage({ id, ok: true, report: result.report, csv: result.csv, tra, seconds: (Date.now() - started) / 1000 }, [tra]);
	} catch (error) {
		self.postMessage({ id, ok: false, code: error?.code ?? error?.name ?? "ERROR", message: String(error?.message ?? error) });
	}
};
