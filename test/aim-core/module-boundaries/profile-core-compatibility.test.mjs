import assert from "node:assert/strict";
import test from "node:test";

const MODULE_PAIRS = [
	[
		"../../../src/domain/alignment/vertical/VerticalConstructiveState.js",
		"../../../src/aim-core/alignment/profile/VerticalConstructiveState.js",
	],
	[
		"../../../src/domain/alignment/cant/CantConstructiveState.js",
		"../../../src/aim-core/alignment/profile/CantConstructiveState.js",
	],
	[
		"../../../src/domain/alignment/chainage/ChainageMapping.js",
		"../../../src/aim-core/alignment/profile/ChainageMapping.js",
	],
	[
		"../../../src/domain/alignment/ports/AlignmentProfileStateReaderPort.js",
		"../../../src/aim-core/alignment/profile/AlignmentProfileStateReaderPort.js",
	],
	[
		"../../../src/domain/alignment/services/AlignmentProfileEvaluationService.js",
		"../../../src/aim-core/alignment/profile/AlignmentProfileEvaluationService.js",
	],
];

for (const [legacyPath, canonicalPath] of MODULE_PAIRS) {
	test(`legacy facade ${legacyPath} has the canonical export set and identities`, async () => {
		const legacy = await import(legacyPath);
		const canonical = await import(canonicalPath);
		assert.deepEqual(Object.keys(legacy).sort(), Object.keys(canonical).sort());
		for (const name of Object.keys(canonical)) {
			assert.strictEqual(legacy[name], canonical[name], name);
		}
	});
}

test("legacy and canonical APIs produce identical Profile results without duplicate authority", async () => {
	const legacy = await import("../../../src/domain/alignment/vertical/VerticalConstructiveState.js");
	const canonical = await import("../../../src/aim-core/alignment/profile/VerticalConstructiveState.js");
	const initial = legacy.createVerticalConstructiveState({ id: "vertical-A", alignmentId: "alignment-A" });
	const state = legacy.appendVerticalElement(initial, {
		id: "grade-A",
		type: "constant-gradient",
		startS: 0,
		endS: 100,
		startElevation: 10,
		gradient: 0.01,
	});
	assert.deepEqual(
		legacy.evaluateVerticalAt(state, { s: 50 }),
		canonical.evaluateVerticalAt(state, { s: 50 })
	);
	assert.strictEqual(legacy.VerticalConstructiveStateError, canonical.VerticalConstructiveStateError);
});
