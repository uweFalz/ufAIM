import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import MDBReader from "../../../src/import/parsers/technet/gndEdit/mdb/node_modules/mdb-reader/lib/node/index.js";
import { extractGndMdb } from "../../../src/import/parsers/technet/gndEdit/gnd/extractGndMdb.js";
import { createImportResultEvidencePublication } from "../../../src/import/evidence/importResultEvidence.js";
import { buildGndRouteWorkspaceModel } from "../../../app/domain/workspace/buildGndRouteWorkspaceModel.js";
import { buildSpotUiState } from "../../../src/model/spot/ui/buildSpotUiState.js";
import { makeGndImportWorkbenchController } from "../../../app/gndImportWorkbench/gndImportWorkbenchController.js";

const repositoryUrl = new URL("../../../", import.meta.url);
const aliases = { "@src/": "src/", "@kimport/": "src/import/", "@spot/": "src/model/spot/", "@kgeom/": "src/lib/geom/", "@kmath/": "src/lib/math/", "@utils/": "src/lib/utils/" };
registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "sheetjs") return nextResolve(new URL("test/gnd-mdb-spike/node_modules/xlsx/xlsx.mjs", repositoryUrl).href, context); for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), repositoryUrl).href, context); return nextResolve(specifier, context); } });
globalThis.Worker = class NodeFixtureWorker { postMessage(message) { queueMicrotask(async () => { try { const envelope = await extractGndMdb({ ...message.payload, bytes: Buffer.from(message.payload.bytes), MDBReader }); this.onmessage?.({ data: { type: "result", envelope } }); } catch (error) { this.onmessage?.({ data: { type: "error", error: { code: error.code, message: error.message } } }); } }); } terminate() {} };
const { runImportPipeline } = await import("../../../src/import/runImportPipeline.js");

function assignment(family, directionCode, targetItemIds = []) { return { family, route: "1720", directionCode, targetItemIds }; }
test("groups exact PP route roles and exposes one explicit review set", () => {
	const records = [{ evidenceId: "E", source: { sha256: "fingerprint-e" }, sevenLineRoleEvidence: { assignments: [assignment("EL", "1", ["Q1"]), assignment("EH", "1"), assignment("EL", "2", ["Q2"]), assignment("EK", "3")] } }];
	const items = [{ id: "A1", evidenceItemId: "Q1", status: { promotable: true } }, { id: "A2", evidenceItemId: "Q2", status: { promotable: true } }];
	const [route] = buildGndRouteWorkspaceModel({ records, items });
	assert.equal(route.route, "1720");
	assert.deepEqual(route.promotableItemIds, ["A1", "A2"]);
	assert.equal(route.roles[1].families.EL, "constructive");
	assert.equal(route.roles[1].families.EH, "source-evidence");
	assert.equal(route.roles[3].label, "Kilometrierungslinie");
	assert.deepEqual(route.diagnostics, []);
});

test("paired tracks without role 3 remain review-required and distinct routes never merge", () => {
	const records = [{ evidenceId: "E1", sevenLineRoleEvidence: { assignments: [assignment("EL", "1"), assignment("EL", "2")] } }, { evidenceId: "E2", sevenLineRoleEvidence: { assignments: [{ ...assignment("EL", "1"), route: "1730" }] } }];
	const routes = buildGndRouteWorkspaceModel({ records });
	assert.equal(routes.length, 2);
	assert.ok(routes[0].diagnostics.includes("KM_LINE_REQUIRED"));
	assert.equal(routes[0].status, "review-required");
});

test("canonical objects recover route and role membership through exact importItemId", () => {
	const records = [{ evidenceId: "E", sevenLineRoleEvidence: { assignments: [assignment("EL", "0", ["Q0"])] } }];
	const objects = [{ id: "A", meta: { importItemId: "Q0" } }];
	const [route] = buildGndRouteWorkspaceModel({ records, objects });
	assert.deepEqual(route.canonicalObjectIds, ["A"]);
	assert.deepEqual(route.roles[0].canonicalObjectIds, ["A"]);
});

test("multi-file evidence with the same exact PP route forms one provenance-retaining workspace", () => {
	const records = [{ evidenceId: "E1", source: { sha256: "same-fingerprint" }, sevenLineRoleEvidence: { assignments: [assignment("EL", "1")] } }, { evidenceId: "E2", source: { sha256: "same-fingerprint" }, sevenLineRoleEvidence: { assignments: [assignment("EK", "3")] } }];
	const routes = buildGndRouteWorkspaceModel({ records });
	assert.equal(routes.length, 1);
	assert.deepEqual(routes[0].evidenceIds, ["E1", "E2"]);
});

test("identical route labels from distinct fingerprints remain separate review groups", () => {
	const records = [{ evidenceId: "E1", source: { sha256: "fingerprint-a" }, sevenLineRoleEvidence: { assignments: [assignment("EL", "1")] } }, { evidenceId: "E2", source: { sha256: "fingerprint-b" }, sevenLineRoleEvidence: { assignments: [assignment("EK", "3")] } }];
	const routes = buildGndRouteWorkspaceModel({ records });
	assert.equal(routes.length, 2);
	assert.deepEqual(routes.map((entry) => entry.sourceFingerprint), ["fingerprint-a", "fingerprint-b"]);
});

test("persisted canonical source evidence projects route role and review into Object Overlay state", () => {
	const object = { id: "A", type: "alignment", meta: { importItemId: "Q1", sourceEvidence: { sevenLineRoleEvidence: { assignments: [{ route: "1720", directionCode: "1", targetItemIds: ["Q1"] }] }, relationEvidence: { status: "reviewed", reviewRevision: 2 } } }, data: { kernel: {} } };
	const ui = buildSpotUiState({ objects: { A: object } });
	assert.deepEqual(ui.rows[0].gndRoute, { route: "1720", role: "1", status: "qualified", sourceAssociationStatus: "reviewed", reviewRevision: 2 });
});

test("physical GND publication binds an exact PP route and code to qualified target identity", async () => {
	const bytes = await readFile(new URL("../../fixtures/gnd-mdb/valid-minimal-jet4.mdb", import.meta.url));
	const result = await runImportPipeline({ name: "valid-minimal-jet4.mdb", size: bytes.length, async arrayBuffer() { return bytes; } }, { bytes: new Uint8Array(bytes) });
	const publication = createImportResultEvidencePublication({ result, fileName: "valid-minimal-jet4.mdb", parserId: result?.meta?.sourceFormat, idFactory: () => "ROUTE" });
	const assignments = publication.evidence.sevenLineRoleEvidence.assignments.filter((entry) => entry.family === "EL" && entry.targetItemIds.length);
	assert.ok(assignments.length > 0);
	for (const entry of assignments) { assert.ok(entry.route); assert.match(entry.directionCode, /^[0-4]$/); assert.ok(entry.targetItemIds.every((id) => publication.items.some((item) => item.id === id))); }
	const model = buildGndRouteWorkspaceModel({ records: [publication.evidence], items: publication.items.map((item) => ({ ...item, status: { ...(item.status ?? {}), promotable: true } })) });
	assert.ok(model.some((route) => route.promotableItemIds.length > 0));
});

function controllerFixture({ failAt = null } = {}) {
	const accepted = [], focused = [];
	const assignments = [assignment("EL", "1", ["Q1"]), assignment("EL", "2", ["Q2"]), assignment("EK", "3")];
	const records = [{ evidenceId: "E", sevenLineRoleEvidence: { assignments }, relationCandidates: [], inventory: [], source: {} }];
	const items = [{ id: "A1", evidenceItemId: "Q1", evidenceId: "E", status: { promotable: true } }, { id: "A2", evidenceItemId: "Q2", evidenceId: "E", status: { promotable: true } }];
	let objects = [];
	const messaging = { async sendCmdAwait(name) { if (name === "Import.GetState") return { items, rejectedItems: [] }; if (name === "Import.GetResultEvidence") return { records }; if (name === "Spot.GetState") return { objects }; return {}; } };
	const cockpit = { async acceptImportItem(id, options) { accepted.push([id, options]); if (accepted.length === failAt) return false; const item = items.find((entry) => entry.id === id); objects.push({ id: `O-${id}`, meta: { importItemId: item.evidenceItemId } }); return true; } };
	const promotedAlignmentJourney = { async activateCanonicalAlignment(id) { focused.push(id); return { ok: true }; } };
	const controller = makeGndImportWorkbenchController({ store: { actions: {} }, messaging, cockpit, promotedAlignmentJourney, alignmentIntelligence: { setFinding() {} } });
	return { controller, accepted, focused };
}

test("route review-set action promotes each listed operational ID once in stable order and focuses first canonical", async () => {
	const { controller, accepted, focused } = controllerFixture();
	await controller.refresh();
	const routeId = controller.getState().routeWorkspaces[0].id;
	assert.equal(await controller.promoteRoute(routeId), 2);
	assert.deepEqual(accepted, [["A1", { show: false }], ["A2", { show: false }]]);
	assert.deepEqual(focused, ["O-A1"]);
	assert.equal(controller.getState().feedback, "gnd_workbench.route_transfer_ok");
});

test("route review-set failure is honest and retains evidence of earlier successful item promotions", async () => {
	const { controller, accepted, focused } = controllerFixture({ failAt: 2 });
	await controller.refresh();
	const routeId = controller.getState().routeWorkspaces[0].id;
	assert.equal(await controller.promoteRoute(routeId), false);
	assert.deepEqual(accepted, [["A1", { show: false }], ["A2", { show: false }]]);
	assert.deepEqual(focused, []);
	assert.equal(controller.getState().feedback, "gnd_workbench.transfer_failed");
});
