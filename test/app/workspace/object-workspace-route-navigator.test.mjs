import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
const repositoryUrl = new URL("../../../", import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) { const aliases = { "@app/": "app/", "@src/": "src/" }; for (const [prefix, target] of Object.entries(aliases)) if (specifier.startsWith(prefix)) return nextResolve(new URL(target + specifier.slice(prefix.length), repositoryUrl).href, context); return nextResolve(specifier, context); } });
const { buildSpotUiState } = await import("../../../src/model/spot/ui/buildSpotUiState.js");
const { groupSpotRowsForRouteNavigator } = await import("../../../app/view/overlays/spotView.js");

function canonical(id, { fingerprint = "fp-a", route = "1720", role = "1", target = `Q-${id}`, reviewed = false, crsId = null, includeEvidence = true } = {}) {
	const candidate = { id: `R-${id}`, to: target, claimScope: "source-association-only", provenance: { source: { family: "EH", attachment: [{ sourceId: `EH-${id}` }] } } };
	return { id, type: "alignment", crsId, meta: { label: id, importItemId: target, source: { fileName: `${id}.mdb` }, ...(includeEvidence ? { sourceEvidence: { schema: "ufAIM.spot-import-evidence", source: { sha256: fingerprint }, sevenLineRoleEvidence: { assignments: [{ family: "EL", route, directionCode: role, targetItemIds: [target], sourceIds: [`EL-${id}`] }, { family: "EH", route, directionCode: role, targetItemIds: [target], sourceIds: [`EH-${id}`] }] }, relationEvidence: { status: reviewed ? "reviewed" : "open-candidates", reviewedCandidateId: reviewed ? candidate.id : null, reviewRevision: reviewed ? 3 : 0, candidates: [candidate] }, diagnostics: [] } } : {}) }, data: { kernel: {} } };
}

test("canonical SPOT metadata projects exact route navigator facts without changing identity", () => {
	const ui = buildSpotUiState({ objects: { A: canonical("A", { reviewed: true, crsId: "EPSG:25832" }) } });
	assert.equal(ui.rows[0].spotId, "A");
	assert.deepEqual(ui.rows[0].gndNavigator, { route: "1720", role: "1", status: "qualified", sourceFingerprint: "fp-a", sourceAssociationStatus: "reviewed", reviewRevision: 3, sevenLine: { total: 7, constructive: 1, partial: 1, reviewRequired: 0, missing: 5, notApplicable: 0 }, diagnostics: [] });
	assert.equal(ui.rows[0].spatialMode, "local");
});

test("same route label across fingerprints remains separate and missing evidence remains review-required", () => {
	const ui = buildSpotUiState({ objects: { A: canonical("A", { fingerprint: "fp-a" }), B: canonical("B", { fingerprint: "fp-b" }), C: canonical("C", { includeEvidence: false }) } });
	const grouped = groupSpotRowsForRouteNavigator(ui.rows);
	assert.equal(grouped.groups.length, 2);
	assert.deepEqual(grouped.groups.map((group) => group.sourceFingerprint).sort(), ["fp-a", "fp-b"]);
	assert.deepEqual(grouped.reviewRequired.map((row) => row.spotId), ["C"]);
});

test("paired PP roles without code 3 expose KM_LINE_REQUIRED from persisted source evidence", () => {
	const object = canonical("A");
	object.meta.sourceEvidence.sevenLineRoleEvidence.assignments.push({ family: "EL", route: "1720", directionCode: "2", targetItemIds: ["Q-B"] });
	const [row] = buildSpotUiState({ objects: { A: object } }).rows;
	assert.ok(row.gndNavigator.diagnostics.includes("KM_LINE_REQUIRED"));
});

test("reviewing exact EH source evidence never upgrades the sibling EU row", () => {
	const object = canonical("A", { reviewed: true });
	object.meta.sourceEvidence.sevenLineRoleEvidence.assignments.push({ family: "EU", route: "1720", directionCode: "1", targetItemIds: ["Q-A"], sourceIds: ["EU-A"] });
	object.meta.sourceEvidence.relationEvidence.candidates.push({ id: "R-EU", to: "Q-A", claimScope: "source-association-only", provenance: { source: { family: "EU", attachment: [{ sourceId: "EU-A" }] } } });
	object.meta.sourceEvidence.diagnostics = [{ code: "FOREIGN_GLOBAL_DIAGNOSTIC" }];
	const navigator = buildSpotUiState({ objects: { A: object } }).rows[0].gndNavigator;
	assert.deepEqual(navigator.sevenLine, { total: 7, constructive: 1, partial: 1, reviewRequired: 1, missing: 4, notApplicable: 0 });
	assert.deepEqual(navigator.diagnostics, []);
});
