import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	GRA_COUPLED_CANT_GRADIENT_EVIDENCE_VERSION,
	extractGraSourceRecords,
} from "../src/import/parsers/technet/vermEsn/extractGraSourceRecords.js";
import { decodeBinary } from "../src/import/parsers/technet/vermEsn/sharedVermesn.js";

test("GRA header separates grade breaks from coupled track-scissor claims", () => {
	const profile = { station: 10, height: 100, radius: 0, tangentL: 0, pointNumber: 1 };
	const scissor = { station: 20, height: 30, radius: 40, tangentL: 2130, pointNumber: 900 };
	const result = extractGraSourceRecords(
		{ station: 1, pointNumber: 1 },
		[profile, scissor]
	);

	assert.deepEqual(result.profileRows, [profile]);
	assert.equal(result.trackScissorClaims.length, 1);
	assert.deepEqual(result.trackScissorClaims[0].construction, {
		rampEnd1Station: 20,
		rampIntersectionStation: 30,
		rampEnd2Station: 40,
		rampCode: 2,
		cant1Millimetres: 130,
		cant2Millimetres: 90,
	});
	assert.equal(
		result.trackScissorClaims[0].contractVersion,
		GRA_COUPLED_CANT_GRADIENT_EVIDENCE_VERSION
	);
	assert.equal(result.trackScissorClaims[0].coupling.curvatureTransitionBinding, "not-established");
	assert.equal(result.trackScissorClaims[0].coupling.profileAdmission, "prohibited-without-tra-binding");
	assert.equal(result.trackScissorClaims[0].provenance.sourceCells.RA.locator.cycle, 2);
	assert.ok(Object.isFrozen(result.trackScissorClaims[0]));
});

test("packed ramp field preserves negative first cant around its nearest ramp code", () => {
	const result = extractGraSourceRecords(
		{ station: 0, pointNumber: 1 },
		[{ station: 1, height: 2, radius: 3, tangentL: 1870, pointNumber: 400 }]
	);

	assert.equal(result.trackScissorClaims[0].construction.rampCode, 2);
	assert.equal(result.trackScissorClaims[0].construction.cant1Millimetres, -130);
	assert.equal(result.trackScissorClaims[0].construction.cant2Millimetres, 40);
});

test("invalid or contradictory header counts fail closed without creating profile points", () => {
	const row = { station: 10, height: 100 };
	const invalid = extractGraSourceRecords({ station: 1.5, pointNumber: 0 }, [row]);
	assert.deepEqual(invalid.profileRows, []);
	assert.equal(invalid.unclassifiedRows.length, 1);
	assert.equal(invalid.diagnostics[0].code, "GRA_HEADER_COUNTS_INVALID");

	const mismatch = extractGraSourceRecords({ station: 1, pointNumber: 1 }, [row]);
	assert.deepEqual(mismatch.profileRows, []);
	assert.equal(mismatch.trackScissorClaims.length, 0);
	assert.equal(mismatch.unclassifiedRows.length, 1);
	assert.equal(mismatch.diagnostics[0].code, "GRA_HEADER_DATA_COUNT_MISMATCH");
});

test("public metroB GRA retains its real Gleisschere outside the profile sequence", async () => {
	const bytes = await readFile(new URL("./samples/metroB/5904067R.GRA", import.meta.url));
	const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
	const decoded = decodeBinary(buffer, "GRA");
	const result = extractGraSourceRecords(decoded.rowsRaw[0], decoded.rowsRaw.slice(1));

	assert.equal(result.gradeBreakCount, 19);
	assert.equal(result.trackScissorCount, 1);
	assert.equal(result.profileRows.length, 19);
	assert.equal(result.trackScissorClaims.length, 1);
	assert.deepEqual(result.trackScissorClaims[0].construction, {
		rampEnd1Station: 67936.95071899184,
		rampIntersectionStation: 68096.82489626457,
		rampEnd2Station: 68207.50701899185,
		rampCode: 2,
		cant1Millimetres: 130,
		cant2Millimetres: 90,
	});
	assert.deepEqual(result.diagnostics, []);
});
