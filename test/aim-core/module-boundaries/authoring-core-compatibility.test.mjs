import assert from "node:assert/strict";
import test from "node:test";

const legacyContract = await import(
	"../../../src/domain/alignment/authoring/AlignmentAuthoringContract.js"
);
const canonicalContract = await import(
	"../../../src/aim-core/alignment/authoring/AlignmentAuthoringContract.js"
);
const legacyPort = await import(
	"../../../src/domain/alignment/ports/AlignmentRepositoryPort.js"
);
const canonicalPort = await import(
	"../../../src/aim-core/alignment/authoring/AlignmentRepositoryPort.js"
);

function validRequest(overrides = {}) {
	return {
		contractVersion: "aim-core/alignment-authoring/0.1",
		alignmentId: "alignment-A",
		operation: "update-arc",
		elementId: "arc-1",
		changes: { curvature: 0.003 },
		...overrides,
	};
}

test("legacy and canonical contract exports are equal and reference-identical", () => {
	assert.deepEqual(
		Object.keys(legacyContract).sort(),
		Object.keys(canonicalContract).sort()
	);
	for (const name of Object.keys(canonicalContract)) {
		assert.strictEqual(legacyContract[name], canonicalContract[name], name);
	}
});

test("legacy and canonical port exports are equal and reference-identical", () => {
	assert.deepEqual(Object.keys(legacyPort).sort(), Object.keys(canonicalPort).sort());
	for (const name of Object.keys(canonicalPort)) {
		assert.strictEqual(legacyPort[name], canonicalPort[name], name);
	}
});

test("legacy paths remain importable and frozen constants share one identity", () => {
	assert.equal(typeof legacyContract.validateAlignmentAuthoringRequest, "function");
	assert.equal(typeof legacyPort.assertAlignmentRepositoryPort, "function");
	assert.strictEqual(
		legacyContract.ALIGNMENT_AUTHORING_OPERATIONS,
		canonicalContract.ALIGNMENT_AUTHORING_OPERATIONS
	);
	assert.strictEqual(
		legacyContract.ALIGNMENT_AUTHORING_REJECTION_CODES,
		canonicalContract.ALIGNMENT_AUTHORING_REJECTION_CODES
	);
	assert.equal(Object.isFrozen(legacyContract.ALIGNMENT_AUTHORING_OPERATIONS), true);
	assert.equal(
		Object.isFrozen(legacyContract.ALIGNMENT_AUTHORING_REJECTION_CODES),
		true
	);
});

test("valid and rejected request results are identical through both paths", () => {
	for (const request of [
		validRequest(),
		validRequest({ changes: { radius: 400 } }),
		validRequest({ alignmentId: "" }),
		validRequest({ changes: { curvature: 0.003, radius: 400 } }),
	]) {
		assert.deepEqual(
			legacyContract.validateAlignmentAuthoringRequest(request),
			canonicalContract.validateAlignmentAuthoringRequest(request)
		);
	}
});

test("repository validation shares behavior without duplicate authority", () => {
	const repository = {
		loadById() {},
		saveById() {},
	};
	assert.strictEqual(
		legacyPort.assertAlignmentRepositoryPort(repository),
		repository
	);
	assert.strictEqual(
		canonicalPort.assertAlignmentRepositoryPort(repository),
		repository
	);
	for (const invalid of [null, {}, { loadById() {} }, { saveById() {} }]) {
		assert.throws(
			() => legacyPort.assertAlignmentRepositoryPort(invalid),
			(error) =>
				error instanceof TypeError &&
				error.message ===
					"AlignmentRepositoryPort requires loadById() and saveById()"
		);
		assert.throws(
			() => canonicalPort.assertAlignmentRepositoryPort(invalid),
			(error) =>
				error instanceof TypeError &&
				error.message ===
					"AlignmentRepositoryPort requires loadById() and saveById()"
		);
	}
	assert.strictEqual(
		legacyPort.assertAlignmentRepositoryPort,
		canonicalPort.assertAlignmentRepositoryPort
	);
});
