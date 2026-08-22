import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
import {
	RepositoryAlignmentProfileStateReaderAdapter,
	RepositoryAlignmentProfileStateReaderAdapterError,
} from "../../../src/services/alignment/RepositoryAlignmentProfileStateReaderAdapter.js";
import AlignmentProfileApplicationService from "../../../src/services/alignment/AlignmentProfileApplicationService.js";

const alignmentId = "alignment-A";

function makeProfileState(owner = alignmentId) {
	const vertical = appendVerticalElement(
		createVerticalConstructiveState({
			id: `vertical-${owner}`,
			alignmentId: owner,
		}),
		{
			id: "V",
			type: "constant-gradient",
			startS: 0,
			endS: 100,
			startElevation: 10,
			gradient: 0.01,
		}
	);
	const cant = appendCantElement(
		createCantConstructiveState({
			id: `cant-${owner}`,
			alignmentId: owner,
		}),
		{
			id: "C",
			type: "linear-cross-level",
			startS: 0,
			endS: 100,
			startCrossLevel: 0,
			crossLevelRate: 0.001,
		}
	);
	const chainage = appendChainageSegment(
		createChainageMapping({
			id: `mapping-${owner}`,
			alignmentId: owner,
			schemeId: "K",
			schemeVersion: "v1",
		}),
		{
			id: "S",
			startS: 0,
			endS: 100,
			startAddress: 1000,
			direction: 1,
		}
	);
	return { vertical, cant, chainageMappings: [chainage] };
}

function repository(value, { error } = {}) {
	return {
		loadCalls: [],
		async loadById(id) {
			this.loadCalls.push(id);
			if (error) throw error;
			return value;
		},
		async saveById() {
			throw new Error("not used");
		},
	};
}

function alignment(profileState = makeProfileState()) {
	return { type: "AlignmentData", id: alignmentId, profileState };
}

async function expectCode(code, operation) {
	await assert.rejects(operation, (error) => {
		assert.equal(
			error instanceof
				RepositoryAlignmentProfileStateReaderAdapterError,
			true
		);
		assert.equal(error.code, code);
		return true;
	});
}

test("constructs a conforming reader from the existing repository port", () => {
	const adapter =
		new RepositoryAlignmentProfileStateReaderAdapter({
			alignmentRepository: repository(alignment()),
		});
	assert.equal(
		adapter instanceof RepositoryAlignmentProfileStateReaderAdapter,
		true
	);
});

test("loads identical states and a frozen copied mapping list", async () => {
	const profileState = makeProfileState();
	const adapter =
		new RepositoryAlignmentProfileStateReaderAdapter({
			alignmentRepository: repository(alignment(profileState)),
		});
	assert.strictEqual(
		await adapter.loadVerticalByAlignmentId(alignmentId),
		profileState.vertical
	);
	assert.strictEqual(
		await adapter.loadCantByAlignmentId(alignmentId),
		profileState.cant
	);
	const mappings =
		await adapter.loadChainageMappingsByAlignmentId(alignmentId);
	assert.deepEqual(mappings, profileState.chainageMappings);
	assert.notStrictEqual(mappings, profileState.chainageMappings);
	assert.strictEqual(mappings[0], profileState.chainageMappings[0]);
	assert.equal(Object.isFrozen(mappings), true);
});

test("loads one revision-qualified profile snapshot in one repository read", async () => {
	const profileState = makeProfileState();
	const value = {
		...alignment(profileState),
		revision: Object.freeze({
			id: "revision-7",
			parentId: "revision-6",
		}),
	};
	const repo = repository(value);
	const adapter =
		new RepositoryAlignmentProfileStateReaderAdapter({
			alignmentRepository: repo,
		});
	const snapshot =
		await adapter.loadProfileSnapshotByAlignmentId(alignmentId);
	assert.equal(snapshot.presence, "present");
	assert.strictEqual(snapshot.revision, value.revision);
	assert.strictEqual(snapshot.vertical, profileState.vertical);
	assert.strictEqual(snapshot.cant, profileState.cant);
	assert.deepEqual(snapshot.chainageMappings, profileState.chainageMappings);
	assert.equal(Object.isFrozen(snapshot), true);
	assert.deepEqual(repo.loadCalls, [alignmentId]);
});

test("missing Alignment and legacy missing profileState are absent without mutation", async () => {
	for (const value of [
		null,
		{ type: "AlignmentData", id: alignmentId },
	]) {
		const before =
			value === null ? null : structuredClone(value);
		const adapter =
			new RepositoryAlignmentProfileStateReaderAdapter({
				alignmentRepository: repository(value),
			});
		assert.equal(
			await adapter.loadVerticalByAlignmentId(alignmentId),
			null
		);
		assert.equal(
			await adapter.loadCantByAlignmentId(alignmentId),
			null
		);
		const mappings =
			await adapter.loadChainageMappingsByAlignmentId(alignmentId);
		assert.deepEqual(mappings, []);
		assert.equal(Object.isFrozen(mappings), true);
		assert.deepEqual(value, before);
	}
});

test("snapshot distinguishes absent profileState without fabricating empty state", async () => {
	const legacy = {
		type: "AlignmentData",
		id: alignmentId,
		revision: "revision-legacy",
	};
	const adapter =
		new RepositoryAlignmentProfileStateReaderAdapter({
			alignmentRepository: repository(legacy),
		});
	const snapshot =
		await adapter.loadProfileSnapshotByAlignmentId(alignmentId);
	assert.deepEqual(snapshot, {
		presence: "absent",
		revision: "revision-legacy",
		vertical: null,
		cant: null,
		chainageMappings: [],
	});
	assert.equal(Object.isFrozen(snapshot), true);
});

test("trims identity and rejects invalid identity before repository access", async () => {
	const repo = repository(alignment());
	const adapter =
		new RepositoryAlignmentProfileStateReaderAdapter({
			alignmentRepository: repo,
		});
	await adapter.loadVerticalByAlignmentId(" alignment-A ");
	assert.deepEqual(repo.loadCalls, [alignmentId]);
	for (const invalid of ["", " ", null, 42]) {
		await expectCode(
			"INVALID_ALIGNMENT_ID",
			() => adapter.loadVerticalByAlignmentId(invalid)
		);
	}
	assert.deepEqual(repo.loadCalls, [alignmentId]);
});

test("invalid repository port preserves the existing port assertion", () => {
	for (const invalid of [null, {}, { loadById() {} }]) {
		assert.throws(
			() =>
				new RepositoryAlignmentProfileStateReaderAdapter({
					alignmentRepository: invalid,
				}),
			/AlignmentRepositoryPort requires loadById\(\) and saveById\(\)/
		);
	}
});

test("repository failures retain cause with REPOSITORY_READ_FAILED", async () => {
	const cause = new Error("repository unavailable");
	const adapter =
		new RepositoryAlignmentProfileStateReaderAdapter({
			alignmentRepository: repository(null, { error: cause }),
		});
	await assert.rejects(
		() => adapter.loadVerticalByAlignmentId(alignmentId),
		(error) => {
			assert.equal(error.code, "REPOSITORY_READ_FAILED");
			assert.strictEqual(error.cause, cause);
			return true;
		}
	);
});

test("invalid repository result is deterministic INVALID_PORT_RESULT", async () => {
	for (const value of [
		[],
		"invalid",
		{ type: "AlignmentData", id: "alignment-B" },
	]) {
		const adapter =
			new RepositoryAlignmentProfileStateReaderAdapter({
				alignmentRepository: repository(value),
			});
		await expectCode(
			"INVALID_PORT_RESULT",
			() => adapter.loadCantByAlignmentId(alignmentId)
		);
	}
});

test("malformed present records and states are INVALID_PROFILE_STATE", async () => {
	for (const profileState of [
		null,
		[],
		{},
		{ vertical: null, cant: null },
		{ vertical: {}, cant: null, chainageMappings: [] },
		{ vertical: null, cant: {}, chainageMappings: [] },
		{ vertical: null, cant: null, chainageMappings: null },
		{ vertical: null, cant: null, chainageMappings: [{}] },
	]) {
		const adapter =
			new RepositoryAlignmentProfileStateReaderAdapter({
				alignmentRepository: repository(alignment(profileState)),
			});
		await expectCode(
			"INVALID_PROFILE_STATE",
			() => adapter.loadVerticalByAlignmentId(alignmentId)
		);
	}
});

test("state and mapping Alignment mismatches are rejected", async () => {
	const other = makeProfileState("alignment-B");
	for (const profileState of [
		{ ...makeProfileState(), vertical: other.vertical },
		{ ...makeProfileState(), cant: other.cant },
		{
			...makeProfileState(),
			chainageMappings: other.chainageMappings,
		},
	]) {
		const adapter =
			new RepositoryAlignmentProfileStateReaderAdapter({
				alignmentRepository: repository(alignment(profileState)),
			});
		await expectCode(
			"ALIGNMENT_ID_MISMATCH",
			() => adapter.loadVerticalByAlignmentId(alignmentId)
		);
	}
});

test("duplicate mapping IDs reject without input mutation", async () => {
	const profileState = makeProfileState();
	profileState.chainageMappings.push(profileState.chainageMappings[0]);
	const before = structuredClone(profileState);
	const adapter =
		new RepositoryAlignmentProfileStateReaderAdapter({
			alignmentRepository: repository(alignment(profileState)),
		});
	await expectCode(
		"DUPLICATE_MAPPING_ID",
		() => adapter.loadChainageMappingsByAlignmentId(alignmentId)
	);
	assert.deepEqual(profileState, before);
});

test("application service repository static and injected paths are equivalent and exclusive", async () => {
	const profileState = makeProfileState();
	const repo = repository(alignment(profileState));
	const staticService = new AlignmentProfileApplicationService({
		records: [{ alignmentId, ...profileState }],
	});
	const repositoryService =
		new AlignmentProfileApplicationService({
			alignmentRepository: repo,
		});
	const reader =
		new RepositoryAlignmentProfileStateReaderAdapter({
			alignmentRepository: repo,
		});
	const injectedService =
		new AlignmentProfileApplicationService({
			stateReader: reader,
		});
	const request = { alignmentId, positions: [0, 50, 100] };
	const expected = await staticService.evaluateMany(request);
	assert.deepEqual(
		await repositoryService.evaluateMany(request),
		expected
	);
	assert.deepEqual(
		await injectedService.evaluateMany(request),
		expected
	);
	for (const options of [
		{ records: [], alignmentRepository: repo },
		{ records: [], stateReader: reader },
		{ alignmentRepository: repo, stateReader: reader },
	]) {
		assert.throws(
			() => new AlignmentProfileApplicationService(options),
			(error) => error.code === "INVALID_CONSTRUCTION"
		);
	}
});

test("source dependencies are Core-only without SPOT or browser coupling", async () => {
	const source = await readFile(
		new URL(
			"../../../src/services/alignment/RepositoryAlignmentProfileStateReaderAdapter.js",
			import.meta.url
		),
		"utf8"
	);
	const imports = [
		...source.matchAll(/from\s+["']([^"']+)["']/g),
	].map((match) => match[1]);
	assert.deepEqual(imports, [
		"../../aim-core/alignment/authoring/AlignmentRepositoryPort.js",
		"../../aim-core/alignment/profile/AlignmentProfileStateReaderPort.js",
		"../../aim-core/alignment/profile/VerticalConstructiveState.js",
		"../../aim-core/alignment/profile/CantConstructiveState.js",
		"../../aim-core/alignment/profile/ChainageMapping.js",
	]);
	for (const forbidden of [
		"model/spot",
		"SPOT",
		"Messaging",
		"Worker",
		"window",
		"document",
		"localStorage",
		"sessionStorage",
	]) {
		assert.equal(source.includes(forbidden), false, forbidden);
	}
});
