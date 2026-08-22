import assert from "node:assert/strict";
import test from "node:test";

import {
	appendChainageSegment,
	createChainageMapping,
	mapChainageToIntrinsic,
	mapIntrinsicToChainage,
} from "../../../src/aim-core/alignment/profile/ChainageMapping.js";
import { createChainageSegmentAppendController } from "../../../app/controllers/alignment-profile/createChainageSegmentAppendController.js";

let mapping = appendChainageSegment(createChainageMapping({ id: "CH1", alignmentId: "A1", schemeId: "scheme-demo", schemeVersion: "v1" }), {
	id: "CHS1", startS: 0, endS: 50, startAddress: 1000, direction: 1, retained: "segment-extension",
});
mapping = Object.freeze({ ...mapping, retainedMapping: { source: "persisted" } });
const vertical = { alignmentId: "A1", id: "V1" };
const cant = { alignmentId: "A1", id: "CANT1" };
const otherMapping = { alignmentId: "A1", id: "OTHER" };
const profileExtension = { provenance: "persisted" };
const profileState = { vertical, cant, chainageMappings: [mapping, otherMapping], profileExtension };
const projection = (revision, s) => ({ alignmentId: "A1", revision, cursor: { parameterKind: "intrinsic-s", s }, chainage: { status: "evaluated" } });

function harness({ stale = false, mismatch = false, saveFailure = null } = {}) {
	let writes = 0;
	const controller = createChainageSegmentAppendController({
		alignmentProfileApplicationService: { async saveProfileState({ profileState: next }) {
			writes += 1;
			if (saveFailure) throw saveFailure;
			return { presence: "present", revision: 2, vertical: next.vertical, cant: next.cant, chainageMappings: mismatch ? profileState.chainageMappings : next.chainageMappings };
		} },
		projectionController: { async projectAt({ revision, s }) { return projection(stale ? 99 : revision, s); } },
	});
	return { controller, writes: () => writes };
}

const request = { alignmentId: "A1", revision: 1, s: 75, profileState, mappingId: "CH1", segmentId: "CHS2", startS: "50", endS: "100", startAddress: "2000", direction: "-1" };

test("appends explicit CHS2 and verifies exact canonical forward and inverse evidence", async () => {
	const { controller, writes } = harness();
	const result = await controller.append(request);
	assert.equal(writes(), 1);
	assert.strictEqual(result.profileState.vertical, vertical);
	assert.strictEqual(result.profileState.cant, cant);
	assert.strictEqual(result.profileState.profileExtension, profileExtension);
	assert.strictEqual(result.profileState.chainageMappings[1], otherMapping);
	assert.deepEqual(result.mapping.segments[0], mapping.segments[0]);
	assert.strictEqual(result.mapping.retainedMapping, mapping.retainedMapping);
	assert.equal(result.mapping.schemeId, "scheme-demo");
	assert.equal(result.mapping.schemeVersion, "v1");
	assert.deepEqual(result.mapping.segments[1], { id: "CHS2", startS: 50, endS: 100, startAddress: 2000, direction: -1 });
	assert.deepEqual(result.forwardCandidates, mapIntrinsicToChainage(result.mapping, { s: 75 }));
	assert.deepEqual(result.forwardCandidates, [{ segmentId: "CHS2", s: 75, address: 1975, schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit" }]);
	assert.deepEqual(mapChainageToIntrinsic(result.mapping, { address: 1975 }), [{ segmentId: "CHS2", address: 1975, s: 75, alignmentId: "A1", schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit" }]);
	assert.deepEqual(mapIntrinsicToChainage(result.mapping, { s: 50 }), [
		{ segmentId: "CHS1", s: 50, address: 1050, schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit" },
		{ segmentId: "CHS2", s: 50, address: 2000, schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit" },
	]);
});

test("invalid duplicate overlap identity and stale requests reject with zero writes", async () => {
	for (const changes of [
		{ mappingId: "", segmentId: "CHS2" },
		{ mappingId: "CH1", segmentId: "" },
		{ startS: " " },
		{ endS: "" },
		{ startAddress: Number.NaN },
		{ direction: "" },
		{ direction: "0" },
		{ segmentId: "CHS1" },
		{ startS: 40 },
		{ startS: 60, endS: 60 },
		{ mappingId: "missing" },
	]) {
		const { controller, writes } = harness();
		await assert.rejects(controller.append({ ...request, ...changes }));
		assert.equal(writes(), 0);
	}
	const duplicated = harness();
	await assert.rejects(duplicated.controller.append({ ...request, profileState: { ...profileState, chainageMappings: [mapping, mapping] } }), { code: "CHAINAGE_MAPPING_IDENTITY_MISMATCH" });
	assert.equal(duplicated.writes(), 0);
	const stale = harness({ stale: true });
	await assert.rejects(stale.controller.append(request), { code: "PROFILE_READBACK_MISMATCH" });
	assert.equal(stale.writes(), 0);
});

test("numeric zero remains explicit while save and readback failures stay truthful", async () => {
	const zeroMapping = appendChainageSegment(createChainageMapping({ id: "ZERO", alignmentId: "A1", schemeId: "S", schemeVersion: "1" }), { id: "Z1", startS: -10, endS: 0, startAddress: 10, direction: -1 });
	const zeroState = { vertical, cant, chainageMappings: [zeroMapping] };
	const zero = harness();
	const result = await zero.controller.append({ ...request, profileState: zeroState, mappingId: "ZERO", segmentId: "Z2", startS: "0", endS: "1", startAddress: "0", direction: "1", s: 0 });
	assert.equal(result.mapping.segments[1].startS, 0);
	assert.equal(result.mapping.segments[1].startAddress, 0);
	const mismatch = harness({ mismatch: true });
	await assert.rejects(mismatch.controller.append(request), { code: "PROFILE_READBACK_MISMATCH" });
	assert.equal(mismatch.writes(), 1);
	const failure = harness({ saveFailure: new Error("offline") });
	await assert.rejects(failure.controller.append(request), { code: "CHAINAGE_SEGMENT_SAVE_FAILED" });
	assert.equal(failure.writes(), 1);
});
