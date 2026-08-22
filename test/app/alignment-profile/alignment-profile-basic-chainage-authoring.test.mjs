import assert from "node:assert/strict";
import test from "node:test";

import { createBasicChainageMappingAuthoringController } from "../../../app/controllers/alignment-profile/createBasicChainageMappingAuthoringController.js";
import { createAlignmentProfileProjectionController } from "../../../app/controllers/alignment-profile/createAlignmentProfileProjectionController.js";
import { AlignmentProfileApplicationService } from "../../../src/services/alignment/AlignmentProfileApplicationService.js";
import { appendVerticalElement, createVerticalConstructiveState } from "../../../src/aim-core/alignment/profile/VerticalConstructiveState.js";

function vertical() {
	return appendVerticalElement(createVerticalConstructiveState({ id: "VP1", alignmentId: "A1" }), {
		id: "V1", type: "constant-gradient", startS: 0, endS: 50,
		startElevation: 10, gradient: 0.01,
	});
}

function setup() {
	let stored = { id: "A1", type: "AlignmentData", revision: 1, profileState: {
		vertical: vertical(), cant: null, chainageMappings: [],
	} };
	const saves = [];
	const repository = {
		async loadById() { return structuredClone(stored); },
		async saveById(id, value) {
			assert.equal(id, "A1");
			stored = structuredClone({ ...value, revision: stored.revision + 1 });
			saves.push(structuredClone(stored));
			return structuredClone(stored);
		},
	};
	const service = new AlignmentProfileApplicationService({ alignmentRepository: repository });
	const projectionController = createAlignmentProfileProjectionController({ alignmentProfileApplicationService: service });
	return { saves, stored: () => stored, controller: createBasicChainageMappingAuthoringController({
		alignmentProfileApplicationService: service, projectionController,
	}) };
}

const REQUEST = Object.freeze({
	alignmentId: "A1", revision: 1, s: 25,
	profileState: null,
	mappingId: "CH1", schemeId: "scheme-demo", schemeVersion: "v1",
	segmentId: "CHS1", startS: 0, endS: 50, startAddress: 1000, direction: 1,
});

test("creates the first canonical mapping, saves once and evaluates the exact address", async () => {
	const fixture = setup();
	const original = fixture.stored().profileState;
	const result = await fixture.controller.submit({ ...REQUEST, profileState: original });
	assert.equal(fixture.saves.length, 1);
	assert.strictEqual(result.profileState.vertical, original.vertical);
	assert.strictEqual(result.profileState.cant, original.cant);
	assert.deepEqual(result.candidates, [{
		segmentId: "CHS1", s: 25, address: 1025,
		schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit",
	}]);
	assert.deepEqual(result.projection.vertical.value, {
		elementId: "V1", s: 25, elevation: 10.25, gradient: 0.01,
	});
	assert.equal(result.projection.cant.status, "absent");
	assert.deepEqual(result.projection.chainage.mappings[0].candidates[0], {
		segmentId: "CHS1", s: 25, address: 1025,
		schemeId: "scheme-demo", schemeVersion: "v1", unit: "alignment-length-unit",
	});
});

test("invalid, stale and already-present requests are zero-write", async () => {
	const fixture = setup();
	const profileState = fixture.stored().profileState;
	for (const request of [
		{ ...REQUEST, profileState, mappingId: "" },
		{ ...REQUEST, profileState, endS: 0 },
		{ ...REQUEST, profileState, direction: 0 },
		{ ...REQUEST, profileState, startAddress: Infinity },
	]) {
		await assert.rejects(() => fixture.controller.submit(request));
	}
	await assert.rejects(
		() => fixture.controller.submit({ ...REQUEST, profileState, revision: 99 }),
		(error) => error.code === "REVISION_MISMATCH"
	);
	assert.equal(fixture.saves.length, 0);
	await fixture.controller.submit({ ...REQUEST, profileState });
	await assert.rejects(
		() => fixture.controller.submit({ ...REQUEST, revision: 2, profileState: fixture.stored().profileState }),
		(error) => error.code === "CHAINAGE_MAPPING_ALREADY_PRESENT"
	);
	assert.equal(fixture.saves.length, 1);
});

test("empty numeric fields are zero-write while explicit zero remains valid", async () => {
	for (const field of ["startS", "endS", "startAddress"]) {
		for (const value of ["", " \t "]) {
			const fixture = setup();
			await assert.rejects(
				() => fixture.controller.submit({
					...REQUEST,
					profileState: fixture.stored().profileState,
					[field]: value,
				}),
				(error) => error.code === "INVALID_CHAINAGE_MAPPING"
			);
			assert.equal(fixture.saves.length, 0);
		}
	}

	const fixture = setup();
	const result = await fixture.controller.submit({
		...REQUEST,
		profileState: fixture.stored().profileState,
		startS: "0",
		startAddress: "0",
	});
	assert.equal(fixture.saves.length, 1);
	assert.equal(result.profileState.chainageMappings[0].segments[0].startS, 0);
	assert.equal(result.profileState.chainageMappings[0].segments[0].startAddress, 0);
});

test("repository mismatch is never reported as saved", async () => {
	const profileState = { vertical: vertical(), cant: null, chainageMappings: [] };
	const projectionController = { async projectAt({ alignmentId, revision, s }) {
		return { alignmentId, revision, cursor: { parameterKind: "intrinsic-s", s } };
	} };
	const controller = createBasicChainageMappingAuthoringController({
		alignmentProfileApplicationService: { async saveProfileState() {
			return { presence: "present", revision: 2, vertical: profileState.vertical, cant: null, chainageMappings: [] };
		} }, projectionController,
	});
	await assert.rejects(
		() => controller.submit({ ...REQUEST, profileState }),
		(error) => error.code === "PROFILE_READBACK_MISMATCH"
	);
});
