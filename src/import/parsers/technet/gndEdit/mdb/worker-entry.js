import MDBReader from "mdb-reader";
import { extractGndMdb } from "../gnd/extractGndMdb.js";

self.onmessage = async ({ data }) => {
	if (data?.type !== "extract") return;
	try {
		const envelope = await extractGndMdb({ ...data.payload, bytes: Buffer.from(data.payload.bytes), MDBReader });
		self.postMessage({ type: "result", id: data.id, envelope });
	} catch (error) {
		self.postMessage({ type: "error", id: data.id, error: { code: error?.code ?? "MDB_WORKER_FAILURE", message: String(error?.message ?? error), diagnostics: error?.diagnostics ?? [] } });
	}
};
