import assert from "node:assert/strict";
import test from "node:test";
import { appendChainageSegment, createChainageMapping, mapIntrinsicToChainage } from "../../../src/aim-core/alignment/profile/ChainageMapping.js";
import { createTerminalChainageSegmentDirectionEditController } from "../../../app/controllers/alignment-profile/createTerminalChainageSegmentDirectionEditController.js";

let mapping = appendChainageSegment(createChainageMapping({ id: "CH1", alignmentId: "A1", schemeId: "scheme-demo", schemeVersion: "v1" }),
	{ id: "CHS1", startS: 0, endS: 50, startAddress: 1000, direction: 1, prefixExtension: "kept" });
mapping = appendChainageSegment(mapping, { id: "CHS2", startS: 50, endS: 100, startAddress: 3000, direction: -1, terminalExtension: { retained: true } });
mapping = Object.freeze({ ...mapping, mappingExtension: { source: "persisted" } });
const vertical = { alignmentId: "A1", id: "V1" };
const cant = { alignmentId: "A1", id: "CANT1", elements: [{ id: "C2" }] };
const other = { alignmentId: "A1", id: "OTHER" };
const profileExtension = { retained: true };
const profileState = { vertical, cant, chainageMappings: [mapping, other], profileExtension };
const projection = (revision, s) => ({ alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s } });

function harness({ stale = false, mismatch = false, failure = null } = {}) {
	let writes = 0;
	const controller = createTerminalChainageSegmentDirectionEditController({
		alignmentProfileApplicationService: { async saveProfileState({ profileState: next }) {
			writes += 1; if (failure) throw failure;
			return { presence: "present", revision: 2, vertical: next.vertical, cant: next.cant,
				chainageMappings: mismatch ? profileState.chainageMappings : next.chainageMappings };
		} },
		projectionController: { async projectAt({ revision, s }) { return projection(stale ? 99 : revision, s); } },
	});
	return { controller, writes: () => writes };
}
const request = { alignmentId: "A1", revision: 1, s: 75, profileState, mappingId: "CH1", segmentId: "CHS2", direction: "1" };

test("changes only terminal CHS2 direction and proves canonical forward inverse evidence", async () => {
	const current = harness(); const result = await current.controller.update(request);
	assert.equal(current.writes(), 1);
	assert.strictEqual(result.profileState.vertical, vertical); assert.strictEqual(result.profileState.cant, cant);
	assert.strictEqual(result.profileState.chainageMappings[1], other); assert.strictEqual(result.profileState.profileExtension, profileExtension);
	assert.strictEqual(result.mapping.mappingExtension, mapping.mappingExtension);
	assert.deepEqual(result.mapping.segments[0], mapping.segments[0]);
	assert.deepEqual(result.mapping.segments[1], { ...mapping.segments[1], direction: 1 });
	assert.deepEqual(result.forwardCandidates, [{ segmentId: "CHS2", s: 75, address: 3025, schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit" }]);
	assert.deepEqual(result.inverseCandidates, [{ segmentId: "CHS2", address: 3025, s: 75, alignmentId: "A1", schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit" }]);
	assert.deepEqual(mapIntrinsicToChainage(result.mapping, { s: 50 }), [
		{ segmentId: "CHS1", s: 50, address: 1050, schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit" },
		{ segmentId: "CHS2", s: 50, address: 3000, schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit" },
	]);
});

test("explicit CHS2 direction edit succeeds when the shared cursor is outside CHS2", async () => {
	const current = harness();
	const result = await current.controller.update({ ...request, s: 0 });
	assert.equal(current.writes(), 1);
	assert.deepEqual(result.forwardCandidates, [{
		segmentId: "CHS1", s: 0, address: 1000,
		schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit",
	}]);
	assert.deepEqual(result.inverseCandidates, []);
	assert.deepEqual(mapIntrinsicToChainage(result.mapping, { s: 50 }), [
		{ segmentId: "CHS1", s: 50, address: 1050, schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit" },
		{ segmentId: "CHS2", s: 50, address: 3000, schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit" },
	]);
});

test("invalid no-op wrong nonterminal duplicate and stale targets are zero-write", async () => {
	for (const changes of [{ mappingId: "" }, { segmentId: "" }, { direction: "" }, { direction: " " }, { direction: 0 }, { direction: 2 }, { direction: -1 }, { segmentId: "CHS1" }, { mappingId: "missing" }]) {
		const current = harness(); await assert.rejects(current.controller.update({ ...request, ...changes })); assert.equal(current.writes(), 0);
	}
	const duplicate = harness(); await assert.rejects(duplicate.controller.update({ ...request, profileState: { ...profileState, chainageMappings: [mapping, mapping] } }), { code: "CHAINAGE_MAPPING_IDENTITY_MISMATCH" }); assert.equal(duplicate.writes(), 0);
	const duplicateSegmentMapping = Object.freeze({ ...mapping, segments: [...mapping.segments, mapping.segments[1]] });
	const duplicateSegment = harness(); await assert.rejects(duplicateSegment.controller.update({ ...request, profileState: { ...profileState, chainageMappings: [duplicateSegmentMapping] } }), { code: "CHAINAGE_SEGMENT_IDENTITY_MISMATCH" }); assert.equal(duplicateSegment.writes(), 0);
	const stale = harness({ stale: true }); await assert.rejects(stale.controller.update(request), { code: "PROFILE_READBACK_MISMATCH" }); assert.equal(stale.writes(), 0);
});

test("numeric and string directions work while save/readback failures stay truthful", async () => {
	assert.equal((await harness().controller.update({ ...request, direction: 1 })).mapping.segments.at(-1).direction, 1);
	const mismatch = harness({ mismatch: true }); await assert.rejects(mismatch.controller.update(request), { code: "PROFILE_READBACK_MISMATCH" }); assert.equal(mismatch.writes(), 1);
	const failure = harness({ failure: new Error("offline") }); await assert.rejects(failure.controller.update(request), { code: "TERMINAL_CHAINAGE_DIRECTION_SAVE_FAILED" }); assert.equal(failure.writes(), 1);
});
