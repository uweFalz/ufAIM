import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import MDBReader from "../src/import/parsers/technet/gndEdit/mdb/node_modules/mdb-reader/lib/node/index.js";

import { extractGndMdb } from "../src/import/parsers/technet/gndEdit/gnd/extractGndMdb.js";
import { assessGndReferenceEvidence } from "../src/import/evidence/assessGndReferenceEvidence.js";
import { applyImportTruthfulnessEligibility } from "../src/import/evidence/applyImportTruthfulnessEligibility.js";
import { assessSpotAdmission } from "../src/import/spot/assessSpotAdmission.js";

const CORE = ["X_ASC11_PP", "X_ASC12_PL", "X_ASC13_PH", "X_ASC21_EL", "X_ASC22_EH", "X_ASC23_EU", "X_ASC24_EK"];

function alignment(id, crsId, padStart, padEnd) {
	return {
		id,
		kind: "alignment",
		status: { valid: true, promotable: true },
		payload: {
			spatialRef: { status: crsId ? "resolved" : "missing", crsId, horizontalCrsId: crsId },
			extended: { gndSequence: { padStart, padEnd } },
		},
		derived: {
			sparseAlignment: { elements: [] },
			spatialRef: { status: crsId ? "resolved" : "missing", crsId, horizontalCrsId: crsId },
			importAssessment: { sourceTrustClass: "authoritative_context" },
		},
	};
}

function envelope(rows) {
	return {
		tables: [{
			name: "X_ASC12_PL",
			rows: rows.map(({ pad, lsys }, ordinal) => ({
				ordinal,
				cells: [
					{ columnName: "PAD", value: pad, state: "value" },
					{ columnName: "LSYS", value: lsys, state: lsys ? "value" : "empty" },
				],
			})),
		}],
	};
}

function assessAndApply(result, sourceEnvelope) {
	result.sourceEnvelope = sourceEnvelope;
	const assessment = assessGndReferenceEvidence({ result, sourceEnvelope });
	result.meta = { ...(result.meta ?? {}), referenceEvidence: assessment };
	applyImportTruthfulnessEligibility(result, assessment);
	return assessment;
}

test("same PAD/context with multiple LSYS disables only the affected candidate", () => {
	const result = {
		meta: { diagnostics: [{ code: "wording-can-change-freely" }] },
		items: [
			alignment("affected", "L1", "P1", "P2"),
			alignment("safe", "L3", "Q1", "Q2"),
		],
	};
	const sourceEnvelope = envelope([
		{ pad: "P1", lsys: "L1" }, { pad: "P1", lsys: "L2" },
		{ pad: "P2", lsys: "L1" }, { pad: "P2", lsys: "L2" },
		{ pad: "Q1", lsys: "L3" }, { pad: "Q2", lsys: "L3" },
	]);

	const assessment = assessAndApply(result, sourceEnvelope);

	assert.equal(assessment.state, "conflicting");
	assert.deepEqual(assessment.affectedItemIds, ["affected"]);
	assert.equal(assessment.anySafelyPromotable, true);
	assert.equal(result.items[0].status.promotable, false);
	assert.equal(result.items[0].status.eligibility.reason, "conflicting-reference-evidence");
	assert.equal(result.items[0].derived.spatialRef.crsId, null);
	assert.deepEqual(result.items[0].derived.spatialRef.candidateHorizontalReferenceSystems, ["L1", "L2"]);
	assert.equal(result.items[1].status.promotable, true);
	assert.deepEqual(assessSpotAdmission(result.items[0]), {
		admission: "reject",
		reason: "conflicting-reference-evidence",
	});
	assert.equal(result.sourceEnvelope, sourceEnvelope);
});

test("legitimate independent multi-CRS candidates remain promotable", () => {
	const result = {
		meta: { diagnostics: [{ code: "reference-conflict-human-wording" }] },
		items: [
			alignment("one", "L1", "P1", "P2"),
			alignment("two", "L2", "Q1", "Q2"),
		],
	};
	const assessment = assessAndApply(result, envelope([
		{ pad: "P1", lsys: "L1" }, { pad: "P2", lsys: "L1" },
		{ pad: "Q1", lsys: "L2" }, { pad: "Q2", lsys: "L2" },
	]));

	assert.equal(assessment.state, "unique");
	assert.deepEqual(assessment.affectedItemIds, []);
	assert.ok(result.items.every((item) => item.status.promotable));
});

test("missing and explicit local references do not become false conflicts", () => {
	const missing = { meta: {}, items: [alignment("local-missing", null, "P1", "P2")] };
	const missingAssessment = assessAndApply(missing, envelope([
		{ pad: "P1", lsys: null }, { pad: "P2", lsys: null },
	]));
	assert.equal(missingAssessment.state, "missing");
	assert.equal(missing.items[0].status.promotable, true);

	const local = { meta: {}, items: [alignment("local-explicit", "LOCAL_CARTESIAN", "P1", "P2")] };
	const localAssessment = assessAndApply(local, envelope([
		{ pad: "P1", lsys: "LOCAL_CARTESIAN" }, { pad: "P2", lsys: "LOCAL_CARTESIAN" },
	]));
	assert.equal(localAssessment.state, "unique");
	assert.equal(local.items[0].status.promotable, true);
});

test("diagnostic naming does not control safety", () => {
	const sourceEnvelope = envelope([
		{ pad: "P1", lsys: "L1" }, { pad: "P1", lsys: "L2" },
		{ pad: "P2", lsys: "L1" }, { pad: "P2", lsys: "L2" },
	]);
	const outcomes = ["friendly-note", "completely-renamed-warning"].map((code) => {
		const result = { meta: { diagnostics: [{ code }] }, items: [alignment("a", "L1", "P1", "P2")] };
		const assessment = assessAndApply(result, sourceEnvelope);
		return { assessment, status: result.items[0].status };
	});
	assert.deepEqual(outcomes[0], outcomes[1]);
});

test("candidate ambiguity and unsupported graphical references remain distinct", () => {
	const ambiguous = alignment("ambiguous", "L1", "P1", "P2");
	ambiguous.derived.spatialRef = {
		status: "ambiguous",
		candidateHorizontalReferenceSystems: ["L1", "L2"],
	};
	const ambiguousResult = { meta: {}, items: [ambiguous] };
	const ambiguousAssessment = assessAndApply(ambiguousResult, envelope([]));
	assert.equal(ambiguousAssessment.state, "ambiguous");
	assert.equal(ambiguousResult.items[0].status.promotable, false);

	const unsupported = alignment("graphical", null, "Q1", "Q2");
	unsupported.derived.spatialRef.status = "graphical-only";
	const unsupportedResult = { meta: {}, items: [unsupported] };
	const unsupportedAssessment = assessAndApply(unsupportedResult, envelope([]));
	assert.equal(unsupportedAssessment.state, "unsupported");
	assert.deepEqual(unsupportedAssessment.affectedItemIds, []);
});

test("physical conflicting Jet fixture produces structured affected-candidate evidence", async () => {
	const bytes = await fs.readFile(new URL("./fixtures/gnd-mdb/conflicting-evidence-jet4.mdb", import.meta.url));
	const sourceEnvelope = await extractGndMdb({
		bytes,
		fileName: "conflicting-evidence-jet4.mdb",
		MDBReader,
		coreTableNames: CORE,
	});
	const result = { meta: {}, items: [alignment("physical", "SYNTH_LSYS", "P1", "P2")] };
	const assessment = assessAndApply(result, sourceEnvelope);

	assert.equal(assessment.state, "conflicting");
	assert.deepEqual(assessment.candidateHorizontalReferenceSystems, ["CONFLICT_LSYS", "SYNTH_LSYS"]);
	assert.deepEqual(assessment.affectedItemIds, ["physical"]);
	assert.equal(result.items[0].status.promotable, false);
	assert.equal(result.items[0].status.eligibility.reason, "conflicting-reference-evidence");
	assert.equal(result.items[0].derived.spatialRef.crsId, null);
	assert.equal(result.sourceEnvelope, sourceEnvelope);
	assert.equal(assessSpotAdmission(result.items[0]).admission, "reject");
});
