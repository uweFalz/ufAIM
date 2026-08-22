import assert from "node:assert/strict";
import test from "node:test";

import {
	appendChainageSegment,
	createChainageMapping,
} from "../../../src/aim-core/alignment/profile/ChainageMapping.js";
import { createChainageAddressLookupController } from "../../../app/controllers/alignment-profile/createChainageAddressLookupController.js";

const mapping = appendChainageSegment(createChainageMapping({
	id: "CH1", alignmentId: "A1", schemeId: "scheme-demo", schemeVersion: "v1",
}), { id: "CHS1", startS: 0, endS: 50, startAddress: 1000, direction: 1 });
const profileState = { vertical: null, cant: null, chainageMappings: [mapping] };
const projectionController = { async projectAt({ alignmentId, revision, s }) {
	return { alignmentId, revision, cursor: { parameterKind: "intrinsic-s", s } };
} };

test("looks up the exact canonical inverse candidate without mutation", async () => {
	const controller = createChainageAddressLookupController({ projectionController });
	const before = structuredClone(profileState);
	const result = await controller.lookup({ alignmentId: "A1", revision: 7, s: 0, profileState, mappingId: "CH1", address: "1025" });
	assert.equal(result.status, "unique");
	assert.deepEqual(result.candidates, [{ segmentId: "CHS1", address: 1025, s: 25, alignmentId: "A1", schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit" }]);
	assert.deepEqual(profileState, before);
	assert.ok(Object.isFrozen(result));
	assert.ok(Object.isFrozen(result.candidates));
});

test("reports zero candidates and accepts explicit numeric zero", async () => {
	const controller = createChainageAddressLookupController({ projectionController });
	assert.equal((await controller.lookup({ alignmentId: "A1", revision: 7, s: 0, profileState, mappingId: "CH1", address: 2000 })).status, "not-covered");
	const zeroMapping = appendChainageSegment(createChainageMapping({ id: "ZERO", alignmentId: "A1", schemeId: "s", schemeVersion: "v" }), { id: "ZS", startS: 0, endS: 1, startAddress: 0, direction: 1 });
	const zero = await controller.lookup({ alignmentId: "A1", revision: 7, s: 0, profileState: { vertical: null, cant: null, chainageMappings: [zeroMapping] }, mappingId: "ZERO", address: "0" });
	assert.equal(zero.candidates[0].s, 0);
});

test("preserves multiple inverse candidates without selecting one", async () => {
	const controller = createChainageAddressLookupController({ projectionController });
	let ambiguousMapping = appendChainageSegment(createChainageMapping({ id: "AMB", alignmentId: "A1", schemeId: "scheme", schemeVersion: "v1" }), { id: "S1", startS: 0, endS: 10, startAddress: 100, direction: 1 });
	ambiguousMapping = appendChainageSegment(ambiguousMapping, { id: "S2", startS: 20, endS: 30, startAddress: 100, direction: 1 });
	const result = await controller.lookup({ alignmentId: "A1", revision: 7, s: 0, profileState: { vertical: null, cant: null, chainageMappings: [ambiguousMapping] }, mappingId: "AMB", address: 105 });
	assert.equal(result.status, "ambiguous");
	assert.deepEqual(result.candidates.map((candidate) => [candidate.segmentId, candidate.s]), [["S1", 5], ["S2", 25]]);
});

test("rejects missing explicit inputs and mismatched context", async () => {
	const controller = createChainageAddressLookupController({ projectionController });
	for (const address of ["", "   ", "not-a-number", Infinity]) {
		await assert.rejects(controller.lookup({ alignmentId: "A1", revision: 7, s: 0, profileState, mappingId: "CH1", address }), { code: "INVALID_CHAINAGE_LOOKUP" });
	}
	await assert.rejects(controller.lookup({ alignmentId: "A1", revision: 7, s: 0, profileState, mappingId: "missing", address: 1025 }), { code: "CHAINAGE_MAPPING_NOT_FOUND" });
	const stale = createChainageAddressLookupController({ projectionController: { async projectAt() { return { alignmentId: "A1", revision: 8, cursor: { parameterKind: "intrinsic-s", s: 0 } }; } } });
	await assert.rejects(stale.lookup({ alignmentId: "A1", revision: 7, s: 0, profileState, mappingId: "CH1", address: 1025 }), { code: "CHAINAGE_LOOKUP_CONTEXT_MISMATCH" });
});
