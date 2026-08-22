import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/transition/continuity/validateContinuityCandidate.js";
import * as continuityBarrel from "../../../src/aim-core/transition/continuity/index.js";
import * as legacyDirect from "../../../src/domain/transition/versioned/continuity/validateContinuityCandidate.js";
import * as legacyIndex from "../../../src/domain/transition/versioned/continuity/index.js";
import * as transition from "../../../src/aim-core/transition/index.js";
import * as root from "../../../src/aim-core/index.js";

function validCandidate() {
	return {
		candidateId: "candidate-1",
		sourceProblemId: "problem-1",
		transitionRecordId: "transition-1",
		state: "solved",
		solvedParameters: {},
		unchangedKnownParameters: {},
		unchangedFixedParameters: {},
		provenance: {},
		convergence: {},
		objective: {},
		remainingFreeParameters: [],
		activeConstraints: [],
		endpointResiduals: [],
		joinResiduals: [],
		warnings: [],
		diagnostics: [],
		evaluatorQuantities: [],
		requestedOutputQuantities: [],
		reviewStatus: "unreviewed-calculation-candidate",
		authoritative: false,
	};
}

test("all Continuity validator paths share one function authority", () => {
	assert.deepEqual(Object.keys(legacyDirect).sort(), Object.keys(canonical).sort());
	for (const api of [
		legacyDirect,
		legacyIndex,
		continuityBarrel,
		transition,
		root,
	]) {
		assert.strictEqual(
			api.validateContinuityCandidate,
			canonical.validateContinuityCandidate
		);
	}
});

test("representative valid and invalid primitive reports remain identical", () => {
	for (const candidate of [validCandidate(), null, "invalid"]) {
		assert.deepEqual(
			legacyDirect.validateContinuityCandidate(candidate),
			canonical.validateContinuityCandidate(candidate)
		);
	}
});

test("invalid state and authority reports remain identical", () => {
	const candidate = validCandidate();
	candidate.state = "approved";
	candidate.authoritative = true;
	candidate.reviewStatus = "approved";
	assert.deepEqual(
		legacyDirect.validateContinuityCandidate(candidate),
		canonical.validateContinuityCandidate(candidate)
	);
});

test("malformed fields and residual reports remain identical", () => {
	const candidate = validCandidate();
	candidate.candidateId = " ";
	candidate.solvedParameters = [];
	candidate.warnings = {};
	candidate.joinResiduals = [
		{ joinId: "", quantity: "", residual: Number.POSITIVE_INFINITY },
	];
	assert.deepEqual(
		legacyDirect.validateContinuityCandidate(candidate),
		canonical.validateContinuityCandidate(candidate)
	);
});

test("non-serializable cyclic candidates retain identical report behavior", () => {
	const candidate = validCandidate();
	candidate.provenance.self = candidate;
	assert.deepEqual(
		legacyDirect.validateContinuityCandidate(candidate),
		canonical.validateContinuityCandidate(candidate)
	);
	assert.ok(
		canonical
			.validateContinuityCandidate(candidate)
			.errors.some(
				(error) => error.code === "CONTINUITY_CANDIDATE_NOT_SERIALIZABLE"
			)
	);
});

test("validation leaves representative inputs unchanged", () => {
	const candidate = validCandidate();
	const before = structuredClone(candidate);
	canonical.validateContinuityCandidate(candidate);
	assert.deepEqual(candidate, before);
});
