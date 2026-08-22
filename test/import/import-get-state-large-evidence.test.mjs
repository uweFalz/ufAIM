import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";
import MDBReader from "../../src/import/parsers/technet/gndEdit/mdb/node_modules/mdb-reader/lib/node/index.js";
import { extractGndMdb } from "../../src/import/parsers/technet/gndEdit/gnd/extractGndMdb.js";

const rootUrl = new URL("../../", import.meta.url);
const aliases = { "@src/": "src/", "@kimport/": "src/import/", "@spot/": "src/model/spot/", "@kgeom/": "src/lib/geom/", "@kmath/": "src/lib/math/", "@utils/": "src/lib/utils/" };
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "sheetjs") return nextResolve(new URL("test/gnd-mdb-spike/node_modules/xlsx/xlsx.mjs", rootUrl).href, context); for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), rootUrl).href, context); return nextResolve(specifier, context); } });

globalThis.Worker = class NodeFixtureWorker {
	postMessage(message) {
		queueMicrotask(async () => {
			try {
				const envelope = await extractGndMdb({ ...message.payload, bytes: Buffer.from(message.payload.bytes), MDBReader });
				this.onmessage?.({ data: { type: "result", envelope } });
			} catch (error) {
				this.onmessage?.({ data: { type: "error", error: { code: error.code, message: error.message } } });
			}
		});
	}
	terminate() {}
};

const { runImportPipeline } = await import("../../src/import/runImportPipeline.js");
const { createImportResultEvidencePublication } = await import("../../src/import/evidence/importResultEvidence.js");
const { createImportSessionService } = await import("../../src/shared/messaging/service/ImportSessionService.js");

test("physical DS260801 GetState excludes and does not traverse private result evidence", { timeout: 120_000 }, async () => {
	const bytes = await fs.readFile(new URL("../samples/TRASSENDATEN_DS260801.MDB", import.meta.url));
	const result = await runImportPipeline({ name: "TRASSENDATEN_DS260801.MDB", size: bytes.length, async arrayBuffer() { return bytes; } }, { bytes: new Uint8Array(bytes) });
	const publication = createImportResultEvidencePublication({ result, fileName: "TRASSENDATEN_DS260801.MDB", parserId: result.meta?.sourceFormat, completedAt: "2026-08-18T00:00:00.000Z" });
	let state = null;
	const service = createImportSessionService({ getState: () => state, setState: (next) => { state = next; } });
	service.commitJob({ batchId: "physical-ds260801", source: { fileName: "TRASSENDATEN_DS260801.MDB" }, files: [{ jobId: "physical-job", fileName: "TRASSENDATEN_DS260801.MDB", publication, items: result.items, rejectedItems: result.rejected ?? [] }] });
	assert.ok(JSON.stringify(state.resultEvidence).length > 100_000_000, "fixture must retain the large private evidence that caused the timeout");

	const privateEvidence = state.resultEvidence;
	Object.defineProperty(state, "resultEvidence", { configurable: true, get() { throw new Error("Import.GetState traversed private evidence"); } });
	const publicState = service.getState();
	Object.defineProperty(state, "resultEvidence", { configurable: true, writable: true, value: privateEvidence });

	assert.equal(publicState.sessionId, "physical-ds260801");
	assert.equal(publicState.items.length, result.items.length);
	assert.equal(Object.hasOwn(publicState, "resultEvidence"), false);
	assert.ok(JSON.stringify(publicState).length < 12_000_000);

	const summaryState = service.getState({ projection: "summary" });
	assert.equal(summaryState.sessionId, "physical-ds260801");
	assert.equal(summaryState.stats.accepted, result.items.length);
	assert.equal(Object.hasOwn(summaryState, "items"), false);
	assert.equal(Object.hasOwn(summaryState, "rejectedItems"), false);
	assert.ok(JSON.stringify(summaryState).length < 10_000);

	const compactEvidence = service.getResultEvidence({ projection: "workbench" });
	assert.equal(compactEvidence.records.length, 1);
	assert.equal(compactEvidence.records[0].sourceEnvelope.projection, "workbench-summary");
	assert.ok(compactEvidence.records[0].sourceEnvelope.tables.length > 0);
	assert.equal(compactEvidence.records[0].sourceEnvelope.tables.some((table) => Object.hasOwn(table, "rows")), false);
	assert.ok(JSON.stringify(compactEvidence).length < 20_000_000);
	const fullEvidence = service.getResultEvidence({ evidenceId: compactEvidence.records[0].evidenceId });
	assert.ok(fullEvidence.record.sourceEnvelope.tables.some((table) => Array.isArray(table.rows) && table.rows.length));
});
