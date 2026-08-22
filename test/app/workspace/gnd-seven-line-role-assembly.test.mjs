import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import MDBReader from "../../../src/import/parsers/technet/gndEdit/mdb/node_modules/mdb-reader/lib/node/index.js";
import { extractGndMdb } from "../../../src/import/parsers/technet/gndEdit/gnd/extractGndMdb.js";
import { createImportResultEvidencePublication, withSpotEvidenceSnapshot } from "../../../src/import/evidence/importResultEvidence.js";
import { createImportSessionService } from "../../../src/shared/messaging/service/ImportSessionService.js";
import { promoteImportItems } from "../../../src/model/spot/mutate/promoteImportItems.js";
import { createSpotStore } from "../../../src/model/spot/model/SpotStore.js";
import { createSpotService } from "../../../src/shared/messaging/service/SpotService.js";
import { buildPromotedGndWorkspaceEvidence } from "../../../app/domain/workspace/buildPromotedGndWorkspaceEvidence.js";
import { buildGndSevenLineRoleAssembly } from "../../../app/domain/workspace/buildGndSevenLineRoleAssembly.js";

const repositoryUrl = new URL("../../../", import.meta.url);
const aliases = { "@src/": "src/", "@kimport/": "src/import/", "@spot/": "src/model/spot/", "@kgeom/": "src/lib/geom/", "@kmath/": "src/lib/math/", "@utils/": "src/lib/utils/" };
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "sheetjs") return nextResolve(new URL("test/gnd-mdb-spike/node_modules/xlsx/xlsx.mjs", repositoryUrl).href, context); for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), repositoryUrl).href, context); return nextResolve(specifier, context); } });
globalThis.Worker = class NodeFixtureWorker { postMessage(message) { queueMicrotask(async () => { try { const envelope = await extractGndMdb({ ...message.payload, bytes: Buffer.from(message.payload.bytes), MDBReader }); this.onmessage?.({ data: { type: "result", envelope } }); } catch (error) { this.onmessage?.({ data: { type: "error", error: { code: error.code, message: error.message } } }); } }); } terminate() {} };
const { runImportPipeline } = await import("../../../src/import/runImportPipeline.js");

function assignment(family, directionCode, sourceId) { return { family, route: "1720", directionCode, trackClass: directionCode === "0" ? "single-track" : directionCode === "3" ? "kilometer-line" : "track", sourceIds: [sourceId] }; }
function reviewed() { return { status: "reviewed", reviewedCandidateId: "R-EH", candidates: [{ id: "R-EH", to: "A1", family: "EH", claimScope: "source-association-only", attachmentSourceIds: ["EH1"] }, { id: "R-EU", to: "A1", family: "EU", claimScope: "source-association-only", attachmentSourceIds: ["EU1"] }] }; }

test("assembles the railway seven-line order from exact roles and keeps EH source-only", () => {
	const source = { assignments: [assignment("EL", "1", "EL1"), assignment("EL", "2", "EL2"), assignment("EK", "3", "EK3"), assignment("EH", "1", "EH1"), assignment("EU", "1", "EU1")], relationEvidence: reviewed() };
	const model = buildGndSevenLineRoleAssembly(source, { targetItemId: "A1" });
	assert.deepEqual(model.rows.map((row) => row.label), ["Gradiente rechts", "Gradiente links", "Überhöhung links", "Krümmung links", "Krümmung km · Kilometrierung", "Krümmung rechts", "Überhöhung rechts"]);
	assert.equal(model.rows[0].status, "partial-evidence");
	assert.equal(model.rows[0].claimScope, "source-association-only");
	assert.equal(model.rows[4].status, "partial-evidence");
	assert.equal(model.rows[5].status, "constructive");
});

test("direction and opposite-direction tracks require an explicit code-3 kilometer line", () => {
	const model = buildGndSevenLineRoleAssembly({ assignments: [assignment("EL", "1", "EL1"), assignment("EL", "2", "EL2")] });
	assert.ok(model.diagnostics.includes("KM_LINE_REQUIRED"));
	assert.equal(model.rows[4].status, "review-required");
});

test("physical publication promotion and structured reload retain the seven-line evidence", async () => {
	const bytes = await readFile(new URL("../../fixtures/gnd-mdb/valid-minimal-jet4.mdb", import.meta.url));
	const result = await runImportPipeline({ name: "valid-minimal-jet4.mdb", size: bytes.length, async arrayBuffer() { return bytes; } }, { bytes: new Uint8Array(bytes) });
	const publication = createImportResultEvidencePublication({ result, fileName: "valid-minimal-jet4.mdb", parserId: result?.meta?.sourceFormat, idFactory: () => "SEVEN" });
	assert.ok(publication.evidence.sevenLineRoleEvidence?.assignments?.length > 0, "publication lost role evidence");
	let state = { sessionId: null, phase: "idle", items: [], rejectedItems: [], resultEvidence: [], error: null };
	const session = createImportSessionService({ getState: () => state, setState: (next) => { state = next; } });
	session.commitJob({ batchId: "SEVEN", source: { fileName: "valid-minimal-jet4.mdb" }, files: [{ jobId: "J1", fileName: "valid-minimal-jet4.mdb", publication, items: result.items, rejectedItems: result.rejected ?? [] }] });
	const record = session.getResultEvidence().records[0];
	assert.ok(record.sevenLineRoleEvidence?.assignments?.length > 0, "commit lost role evidence");
	const candidate = record.relationCandidates.find((entry) => entry.type === "gndSourceEvidenceAssociation");
	assert.ok(candidate);
	assert.equal(session.setRelationDecision({ evidenceId: record.evidenceId, candidateId: candidate.id, action: "review", expectedRevision: 0 }).ok, true);
	const reviewed = session.getResultEvidence({ evidenceId: record.evidenceId }).record;
	const target = session.getState().items.find((item) => item.evidenceItemId === (candidate.to ?? candidate.toId));
	const enriched = withSpotEvidenceSnapshot(target, reviewed);
	assert.ok(enriched.derived.sourceEvidenceSnapshot.sevenLineRoleEvidence?.assignments?.length > 0, "snapshot lost role evidence");
	const store = createSpotStore(); let serialized = null;
	const spot = createSpotService({ spotStore: store, persistence: { async load() { return null; }, async save(value) { serialized = structuredClone(value); } } });
	await spot.promoteItems({ items: [enriched] });
	const canonical = serialized.objects[target.id];
	assert.ok(canonical.meta.sourceEvidence.sevenLineRoleEvidence?.assignments?.length > 0, "canonical save lost role evidence");
	const fresh = createSpotStore(); const freshSpot = createSpotService({ spotStore: fresh, persistence: { async load() { return structuredClone(serialized); }, async save() {} } });
	await freshSpot.hydrate();
	const projected = buildPromotedGndWorkspaceEvidence(freshSpot.getState().objects[target.id]);
	assert.equal(projected.sevenLineRoleAssembly.rows.length, 7);
});
