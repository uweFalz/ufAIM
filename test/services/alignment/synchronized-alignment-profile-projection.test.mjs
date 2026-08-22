import assert from "node:assert/strict";
import test from "node:test";

import {
	appendVerticalElement,
	createVerticalConstructiveState,
} from "../../../src/aim-core/alignment/profile/VerticalConstructiveState.js";
import {
	appendCantElement,
	createCantConstructiveState,
} from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";
import {
	appendChainageSegment,
	createChainageMapping,
} from "../../../src/aim-core/alignment/profile/ChainageMapping.js";
import AlignmentProfileApplicationService from "../../../src/services/alignment/AlignmentProfileApplicationService.js";
import {
	SYNCHRONIZED_ALIGNMENT_PROFILE_PROJECTION_VERSION,
	createSynchronizedAlignmentProfileProjection,
} from "../../../src/services/alignment/createSynchronizedAlignmentProfileProjection.js";

const alignmentId = "alignment-sync";

function makeProfileState({ withRailEvidence = false } = {}) {
	const vertical = appendVerticalElement(
		createVerticalConstructiveState({
			id: "vertical-sync",
			alignmentId,
		}),
		{
			id: "V1",
			type: "constant-gradient",
			startS: 0,
			endS: 200,
			startElevation: 120,
			gradient: 0.005,
		}
	);
	let cant = appendCantElement(
		createCantConstructiveState({
			id: "cant-sync",
			alignmentId,
		}),
		{
			id: "C1",
			type: "linear-cross-level",
			startS: 0,
			endS: 200,
			startCrossLevel: 0,
			crossLevelRate: 0.0005,
		}
	);
	if (withRailEvidence) {
		cant = Object.freeze({
			...cant,
			pairedRails: Object.freeze({
				status: "known",
				left: Object.freeze({ lateral: -0.75, vertical: -0.02 }),
				right: Object.freeze({ lateral: 0.75, vertical: 0.02 }),
				governingRailDistance: 1.5,
				distanceMeasurementDefinition: "governing-rail-edges",
			}),
			sourceReference: Object.freeze({
				status: "known",
				kind: "lowerRail",
				side: "left",
				direction: "increasing-s",
				provenance: "fixture/source-A",
			}),
			referenceTransformation: Object.freeze({
				status: "known",
				transformationId: "lower-rail-to-midpoint-v1",
				targetConvention: "midpointGoverningRailEdges",
				reversible: true,
				inputProvenance: "fixture/source-A",
			}),
		});
	}
	const chainage = appendChainageSegment(
		createChainageMapping({
			id: "chainage-sync",
			alignmentId,
			schemeId: "DB",
			schemeVersion: "source-v1",
		}),
		{
			id: "K1",
			startS: 0,
			endS: 200,
			startAddress: 42000,
			direction: 1,
		}
	);
	return Object.freeze({
		vertical,
		cant,
		chainageMappings: Object.freeze([chainage]),
	});
}

function repository(initial) {
	let stored = initial;
	return {
		loadCalls: [],
		saveCalls: [],
		async loadById(id) {
			this.loadCalls.push(id);
			return stored;
		},
		async saveById(id, value) {
			this.saveCalls.push({ id, value });
			stored = value;
			return stored;
		},
		readStored() {
			return stored;
		},
	};
}

test("projects vertical cant and chainage from one intrinsic cursor and revision immutably", async () => {
	const profileState = makeProfileState();
	const source = {
		type: "AlignmentData",
		id: alignmentId,
		revision: Object.freeze({ id: "R8", parentId: "R7" }),
		horizontal: Object.freeze({ preserved: true }),
		profileState,
	};
	const repo = repository(source);
	const service = new AlignmentProfileApplicationService({
		alignmentRepository: repo,
	});
	const result = await service.projectAt({ alignmentId, s: 100 });

	assert.equal(
		result.contractVersion,
		SYNCHRONIZED_ALIGNMENT_PROFILE_PROJECTION_VERSION
	);
	assert.deepEqual(result.cursor, {
		parameterKind: "intrinsic-s",
		s: 100,
	});
	assert.deepEqual(result.revision, source.revision);
	assert.equal(result.vertical.value.elevation, 120.5);
	assert.equal(result.cant.value.crossLevel, 0.05);
	assert.equal(
		result.chainage.mappings[0].candidates[0].address,
		42100
	);
	assert.equal(result.state.presence, "present");
	assert.deepEqual(result.state.vertical, profileState.vertical);
	assert.deepEqual(result.state.cant, profileState.cant);
	assert.deepEqual(
		result.state.chainageMappings,
		profileState.chainageMappings
	);
	assert.notStrictEqual(result.state.vertical, profileState.vertical);
	assert.equal(Object.isFrozen(result), true);
	assert.equal(Object.isFrozen(result.state), true);
	assert.equal(Object.isFrozen(result.state.chainageMappings), true);
	assert.deepEqual(repo.loadCalls, [alignmentId]);
	assert.deepEqual(source.horizontal, { preserved: true });
});

test("scalar cant stays partial and does not fabricate paired rails or a source transformation", async () => {
	const service = new AlignmentProfileApplicationService({
		records: [
			{
				alignmentId,
				...makeProfileState(),
			},
		],
	});
	const result = await service.projectAt({ alignmentId, s: 50 });
	assert.deepEqual(result.cant.reference, {
		status: "partial",
		workingReference: "midpointGoverningRailEdges",
		scalarCrossLevelStatus: "partial-evidence",
		pairedRails: {
			status: "unknown",
			reason: "PAIRED_RAIL_STATE_NOT_AVAILABLE",
		},
		sourceReference: {
			status: "unknown",
			reason: "SOURCE_REFERENCE_NOT_AVAILABLE",
		},
		transformation: {
			status: "not-performed",
			reason: "COMPLETE_SOURCE_CONVENTION_NOT_AVAILABLE",
		},
	});
});

test("complete source evidence and paired rail state are preserved without implicit conversion", async () => {
	const profileState = makeProfileState({ withRailEvidence: true });
	const service = new AlignmentProfileApplicationService({
		records: [{ alignmentId, ...profileState }],
	});
	const result = await service.projectAt({ alignmentId, s: 75 });
	assert.equal(result.cant.reference.status, "known");
	assert.equal(
		result.cant.reference.workingReference,
		"midpointGoverningRailEdges"
	);
	assert.deepEqual(
		result.cant.reference.pairedRails,
		profileState.cant.pairedRails
	);
	assert.deepEqual(
		result.cant.reference.sourceReference,
		profileState.cant.sourceReference
	);
	assert.deepEqual(
		result.cant.reference.transformation,
		profileState.cant.referenceTransformation
	);
	assert.notStrictEqual(
		result.cant.reference.pairedRails,
		profileState.cant.pairedRails
	);
});

test("absent profileState remains absent at projection and through save/reopen", async () => {
	const source = Object.freeze({
		type: "AlignmentData",
		id: alignmentId,
		revision: "R-ABSENT",
		horizontal: Object.freeze({ identity: "horizontal-A" }),
	});
	const repo = repository(source);
	const service = new AlignmentProfileApplicationService({
		alignmentRepository: repo,
	});
	const before = await service.projectAt({ alignmentId, s: 0 });
	assert.equal(before.profileStatePresence, "absent");
	assert.deepEqual(before.vertical, { status: "absent" });
	assert.deepEqual(before.cant, {
		status: "absent",
		reference: { status: "absent" },
	});
	assert.deepEqual(before.chainage, {
		status: "absent",
		mappings: [],
	});

	const reopened = await service.saveProfileState({
		alignmentId,
		profileState: undefined,
	});
	assert.equal(reopened.presence, "absent");
	assert.equal(
		Object.prototype.hasOwnProperty.call(repo.readStored(), "profileState"),
		false
	);
	assert.strictEqual(repo.readStored().horizontal, source.horizontal);
});

test("save/reopen retains profile state and unrelated horizontal state losslessly", async () => {
	const originalProfile = makeProfileState();
	const nextProfile = makeProfileState({ withRailEvidence: true });
	const horizontal = Object.freeze({
		editModel: Object.freeze({ identity: "H1" }),
		sparseAlignment: Object.freeze({ identity: "S1" }),
	});
	const repo = repository({
		type: "AlignmentData",
		id: alignmentId,
		revision: "R9",
		horizontal,
		profileState: originalProfile,
	});
	const service = new AlignmentProfileApplicationService({
		alignmentRepository: repo,
	});
	const reopened = await service.saveProfileState({
		alignmentId,
		profileState: nextProfile,
	});
	assert.equal(reopened.presence, "present");
	assert.strictEqual(repo.readStored().horizontal, horizontal);
	assert.strictEqual(repo.readStored().profileState, nextProfile);
	assert.strictEqual(reopened.vertical, nextProfile.vertical);
	assert.strictEqual(reopened.cant, nextProfile.cant);
	assert.strictEqual(
		reopened.chainageMappings[0],
		nextProfile.chainageMappings[0]
	);
});

test("save requires explicit profile intent and rejects malformed profile state without writing", async () => {
	const repo = repository({
		type: "AlignmentData",
		id: alignmentId,
		horizontal: Object.freeze({ identity: "H-safe" }),
	});
	const service = new AlignmentProfileApplicationService({
		alignmentRepository: repo,
	});
	for (const request of [
		{ alignmentId },
		{ alignmentId, profileState: null },
		{
			alignmentId,
			profileState: {
				vertical: null,
				cant: null,
				chainageMappings: null,
			},
		},
	]) {
		await assert.rejects(
			() => service.saveProfileState(request),
			(error) =>
				error.code === "INVALID_SAVE_REQUEST" &&
				error instanceof Error
		);
	}
	assert.deepEqual(repo.saveCalls, []);
	assert.equal(repo.readStored().horizontal.identity, "H-safe");
});

test("pure projection rejects malformed inputs and never mutates its sources", () => {
	for (const input of [
		{},
		{ evaluation: {}, profileSnapshot: {} },
		{
			evaluation: {
				status: "evaluated",
				alignmentId,
				s: Number.NaN,
			},
			profileSnapshot: { presence: "present" },
		},
	]) {
		assert.throws(
			() => createSynchronizedAlignmentProfileProjection(input),
			TypeError
		);
	}
});
