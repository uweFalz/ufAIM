import { runGndMdbWorker } from "./gnd/runGndMdbWorker.js";
import { validateGndSourceEnvelope } from "./gnd/validateGndSourceEnvelope.js";
import { parseGNDSourceEnvelope } from "./parseGND_XLSX.js";
import { TECHNET_SHEET_NAMES } from "../sharedTechnet.js";

export async function parseGND_MDB({ file, bytes, context = {} } = {}) {
	const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? await file.arrayBuffer());
	const phase = (code, detail = {}) => context?.onImportPhase?.({ code, ...detail });
	phase("file-recognized", { format: "mdb" });
	const envelope = await runGndMdbWorker({
		bytes: input,
		fileName: file?.name ?? "unknown.mdb",
		coreTableNames: Object.values(TECHNET_SHEET_NAMES),
		limits: context?.mdbLimits,
		signal: context?.signal,
		onHeartbeat: context?.onHeartbeat,
	});
	phase("fingerprinted", { sha256: envelope.source.sha256 });
	phase("access-format-checked", { format: envelope.source.format });
	phase("tables-extracted", { tableCount: envelope.inventory.length });
	try {
		validateGndSourceEnvelope(envelope, { requireCompleteCore: true });
	} catch (error) {
		// Keep structural evidence available for a visible rejection without
		// interpreting or constructing from an incomplete source.
		error.sourceEnvelope = envelope;
		throw error;
	}
	const parsed = parseGNDSourceEnvelope({ envelope, context });
	phase("gnd-evidence-interpreted");
	phase("truthfulness-gate", { status: parsed.alignments?.length ? "constructive" : "unresolved" });
	return parsed;
}
