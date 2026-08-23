import assert from "node:assert/strict";
import test from "node:test";
import { buildGndConstructiveStationFrameEvidence } from "../src/import/evidence/buildGndConstructiveStationFrameEvidence.js";
import { makeCompactSpotEvidenceSnapshot } from "../src/import/evidence/importResultEvidence.js";

const row = (ordinal, values) => ({ ordinal, cells: Object.entries(values).map(([columnName, value]) => ({ columnName, state: value === 0 ? "zero" : "value", value })) });
const table = (name, rows) => ({ name, rows });

test("EK type 6 becomes an immutable evidence-only jump candidate without invented chainage", () => {
	const frame = buildGndConstructiveStationFrameEvidence({
		evidenceId: "EV1",
		sourceEnvelope: {
			source: { sha256: "abc", fileName: "jump.mdb", format: "Jet 4 MDB" },
			tables: [
				table("X_ASC11_PP", [row(1, { PAD: "P1", PSTRECKE: 1720, PSTRRIKZ: 1, STATION: 59123 }), row(2, { PAD: "P2", PSTRECKE: 1720, PSTRRIKZ: 1, STATION: 59123 })]),
				table("X_ASC24_EK", [row(7, { PAD1: "P1", PAD2: "P2", EKSYS: "DB_REF", EKTYP: 6, EKPAR1: -200, EKAKM: 596187, EKEKM: 596000 })]),
			],
		},
	});
	assert.equal(frame.status, "evidence-only");
	assert.equal(frame.constructiveAdmission, "not-performed");
	assert.equal(frame.claims[0].claimKind, "kilometre-jump-candidate");
	assert.deepEqual(frame.claims[0].externalAddressClaims, { start: 596187, end: 596000, encoding: "source-value-uninterpreted" });
	assert.equal(frame.claims[0].stationContexts.start.length, 1);
	assert.equal(frame.claims[0].stationContexts.end.length, 1);
	assert.deepEqual(frame.claims[0].stationContexts.start[0].sourceCells.STATION, { state: "value", rawValue: 59123, normalizedValue: 59123, locator: { table: "X_ASC11_PP", row: 1, column: "STATION", cellOrdinal: 3 } });
	assert.deepEqual(frame.claims[0].sourceCells.EKAKM, { state: "value", rawValue: 596187, normalizedValue: 596187, locator: { table: "X_ASC24_EK", row: 7, column: "EKAKM", cellOrdinal: 5 } });
	assert.ok(frame.claims[0].blockers.includes("GND_STATION_ENCODING_PROFILE_REQUIRED"));
	assert.ok(frame.claims[0].blockers.includes("INTRINSIC_S_BINDING_NOT_ESTABLISHED"));
	assert.equal(Object.hasOwn(frame.claims[0], "mapping"), false);
	assert.ok(Object.isFrozen(frame));
	assert.ok(Object.isFrozen(frame.claims[0]));
});

test("PP raw station representation survives normalization", () => {
	const frame = buildGndConstructiveStationFrameEvidence({ sourceEnvelope: { source: {}, tables: [
		table("X_ASC11_PP", [row(1, { PAD: "P1", PSTRECKE: "01720", PSTRRIKZ: 1, STATION: "0059,123" }), row(2, { PAD: "P2", PSTRECKE: "01720", PSTRRIKZ: 1, STATION: "0060,000" })]),
		table("X_ASC24_EK", [row(3, { PAD1: "P1", PAD2: "P2", EKSYS: "L", EKTYP: 6, EKAKM: "0059,123", EKEKM: "0060,000" })]),
	] } });
	const station = frame.claims[0].stationContexts.start[0].sourceCells.STATION;
	assert.equal(station.rawValue, "0059,123");
	assert.equal(station.normalizedValue, 59.123);
});

test("conflicting PP claims remain multiple and block admission", () => {
	const frame = buildGndConstructiveStationFrameEvidence({ sourceEnvelope: { source: {}, tables: [
		table("X_ASC11_PP", [row(1, { PAD: "P1", PSTRECKE: 1720, PSTRRIKZ: 1, STATION: 10 }), row(2, { PAD: "P1", PSTRECKE: 1720, PSTRRIKZ: 1, STATION: 11 })]),
		table("X_ASC24_EK", [row(3, { PAD1: "P1", PAD2: "P2", EKSYS: "L", EKTYP: 0, EKAKM: 10, EKEKM: 20 })]),
	] } });
	assert.equal(frame.claims[0].stationContexts.start.length, 2);
	assert.ok(frame.claims[0].blockers.includes("PP_STATION_CONTEXT_AMBIGUOUS"));
});

test("missing EK table produces no station frame", () => {
	assert.equal(buildGndConstructiveStationFrameEvidence({ sourceEnvelope: { tables: [] } }), null);
});

test("compact SPOT evidence projects station claims to the target route and role", () => {
	const base = { schema: "ufAIM.gnd-constructive-station-frame-evidence", version: 1, diagnostics: [], claims: [
		{ claimId: "A", blockers: [], stationContexts: { start: [{ route: 1720, directionCode: 1 }], end: [] } },
		{ claimId: "B", blockers: [], stationContexts: { start: [{ route: 1730, directionCode: 2 }], end: [] } },
	] };
	const evidence = { evidenceId: "EV", source: {}, inventory: [], diagnostics: [], unresolvedEvidence: [], truthfulnessStatus: "safe-construction-available", constructiveStationFrame: base, sevenLineRoleEvidence: { assignments: [
		{ route: 1720, directionCode: 1, targetItemIds: ["ITEM-A"] },
		{ route: 1730, directionCode: 2, targetItemIds: ["ITEM-B"] },
	] }, relationCandidates: [] };
	const snapshot = makeCompactSpotEvidenceSnapshot({ id: "ITEM-A", evidenceId: "EV" }, evidence);
	assert.deepEqual(snapshot.constructiveStationFrame.claims.map((claim) => claim.claimId), ["A"]);
	assert.equal(JSON.stringify(snapshot).includes('"claimId":"B"'), false);
});
