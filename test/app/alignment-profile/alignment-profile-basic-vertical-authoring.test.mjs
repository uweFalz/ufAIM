import assert from "node:assert/strict";
import test from "node:test";

import {
	createBasicVerticalProfileAuthoringController,
} from "../../../app/controllers/alignment-profile/createBasicVerticalProfileAuthoringController.js";
import {
	createAlignmentProfileProjectionController,
} from "../../../app/controllers/alignment-profile/createAlignmentProfileProjectionController.js";
import {
	AlignmentProfileApplicationService,
} from "../../../src/services/alignment/AlignmentProfileApplicationService.js";

function makeRepository() {
	let stored = {
		type: "AlignmentData",
		id: "alignment-A",
		revision: 1,
		editModel: { elements: [] },
		profileState: {
			vertical: null,
			cant: null,
			chainageMappings: [],
		},
	};
	const saves = [];
	return {
		saves,
		async loadById(id) {
			assert.equal(id, "alignment-A");
			return structuredClone(stored);
		},
		async saveById(id, next) {
			assert.equal(id, "alignment-A");
			stored = structuredClone({
				...next,
				revision: stored.revision + 1,
			});
			saves.push(structuredClone(stored));
			return structuredClone(stored);
		},
		read() {
			return structuredClone(stored);
		},
	};
}

function setup() {
	const repository = makeRepository();
	const service = new AlignmentProfileApplicationService({
		alignmentRepository: repository,
	});
	const projectionController =
		createAlignmentProfileProjectionController({
			alignmentProfileApplicationService: service,
		});
	return {
		repository,
		controller: createBasicVerticalProfileAuthoringController({
			alignmentProfileApplicationService: service,
			projectionController,
		}),
	};
}

const REQUEST = Object.freeze({
	alignmentId: "alignment-A",
	revision: 1,
	s: 25,
	segmentId: "V1",
	startS: 0,
	endS: 100,
	startElevation: 10,
	gradient: 0.01,
});

test("constructs, saves once, reads back, and evaluates one canonical segment", async () => {
	const { repository, controller } = setup();
	const result = await controller.submit(REQUEST);

	assert.equal(repository.saves.length, 1);
	assert.deepEqual(
		Object.keys(repository.saves[0].profileState),
		["vertical", "cant", "chainageMappings"]
	);
	assert.equal(repository.saves[0].profileState.cant, null);
	assert.deepEqual(
		repository.saves[0].profileState.chainageMappings,
		[]
	);
	assert.equal(result.snapshot.revision, 2);
	assert.deepEqual(result.profileState.vertical.elements, [{
		id: "V1",
		type: "constant-gradient",
		startS: 0,
		endS: 100,
		startElevation: 10,
		gradient: 0.01,
	}]);
	assert.deepEqual(result.projection.vertical, {
		status: "evaluated",
		value: {
			elementId: "V1",
			s: 25,
			elevation: 10.25,
			gradient: 0.01,
		},
	});
	assert.deepEqual(result.projection.chainage, {
		status: "absent",
		mappings: [],
	});
	assert.deepEqual(result.projection.cant, {
		status: "absent",
		reference: { status: "absent" },
	});
});

test("validation, stale context, and repeated no-op never claim another save", async () => {
	const { repository, controller } = setup();
	for (const invalid of [
		{ ...REQUEST, segmentId: "" },
		{ ...REQUEST, startS: Number.NaN },
		{ ...REQUEST, endS: 0 },
		{ ...REQUEST, gradient: Number.POSITIVE_INFINITY },
	]) {
		await assert.rejects(
			() => controller.submit(invalid),
			(error) =>
				error.code === "INVALID_BASIC_VERTICAL_PROFILE"
		);
	}
	await assert.rejects(
		() => controller.submit({ ...REQUEST, revision: 99 }),
		(error) => error.code === "REVISION_MISMATCH"
	);
	assert.equal(repository.saves.length, 0);

	await controller.submit(REQUEST);
	await assert.rejects(
		() => controller.submit({ ...REQUEST, revision: 2 }),
		(error) => error.code === "VERTICAL_PROFILE_NO_CHANGE"
	);
	assert.equal(repository.saves.length, 1);
});

test("a mismatched repository readback is rejected without success", async () => {
	const profileService = {
		async saveProfileState({ profileState }) {
			return {
				presence: "present",
				revision: 2,
				vertical: profileState.vertical,
				cant: { unexpected: true },
				chainageMappings: [],
			};
		},
	};
	const projectionController = {
		async projectAt(context) {
			return {
				status: "projected",
				alignmentId: context.alignmentId,
				revision: context.revision,
				cursor: {
					parameterKind: "intrinsic-s",
					s: context.s,
				},
				vertical: { status: "absent" },
				cant: { status: "absent" },
				chainage: { status: "absent" },
			};
		},
	};
	const controller = createBasicVerticalProfileAuthoringController({
		alignmentProfileApplicationService: profileService,
		projectionController,
	});
	await assert.rejects(
		() => controller.submit(REQUEST),
		(error) => error.code === "PROFILE_READBACK_MISMATCH"
	);
});
