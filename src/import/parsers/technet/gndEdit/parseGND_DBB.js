import { extractGndDbb } from "./gnd/extractGndDbb.js";
import { validateGndSourceEnvelope } from "./gnd/validateGndSourceEnvelope.js";
import { parseGNDSourceEnvelope } from "./parseGND_XLSX.js";

export async function parseGND_DBB({ file, bytes, context = {} } = {}) {
	const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? await file.arrayBuffer());
	const phase = (code, detail = {}) => context?.onImportPhase?.({ code, ...detail });
	phase("file-recognized", { format: "dbb" });
	const envelope = await extractGndDbb({ bytes: input, fileName: file?.name, limits: context.dbbLimits, signal: context.signal, onHeartbeat: context.onHeartbeat });
	phase("fingerprinted", { sha256: envelope.source.sha256 });
	phase("tables-extracted", { tableCount: envelope.inventory.length });
	try { validateGndSourceEnvelope(envelope, { requireCompleteCore: true }); }
	catch (error) { error.sourceEnvelope = envelope; throw error; }
	const parsed = parseGNDSourceEnvelope({ envelope, context });
	phase("gnd-evidence-interpreted");
	phase("truthfulness-gate", { status: parsed.alignments?.length ? "constructive" : "unresolved" });
	return parsed;
}
