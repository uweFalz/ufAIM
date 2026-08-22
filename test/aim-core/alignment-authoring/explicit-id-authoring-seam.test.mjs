import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const name of ["window", "document", "Worker", "SharedWorker", "navigator"]) {
	Reflect.deleteProperty(globalThis, name);
}

assert.equal(typeof globalThis.window, "undefined");
assert.equal(typeof globalThis.document, "undefined");
assert.equal(typeof globalThis.Worker, "undefined");
assert.equal(typeof globalThis.SharedWorker, "undefined");
assert.equal(typeof globalThis.navigator, "undefined");

const {
	ALIGNMENT_AUTHORING_RESULT_VERSION,
	validateAlignmentAuthoringRequest,
} = await import(
	"../../../src/aim-core/alignment/authoring/AlignmentAuthoringContract.js"
);
const { assertAlignmentRepositoryPort } = await import(
	"../../../src/aim-core/alignment/authoring/AlignmentRepositoryPort.js"
);
const { findElementById, updateArcById } = await import(
	"../../../src/aim-core/alignment/authoring/alignmentEditOps.js"
);

const BASE_STATE = {
	type: "AlignmentData",
	id: "alignment-A",
	name: "Characterization A",
	editModel: {
		startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
		elements: [
			{ id: "straight-1", type: "straight", parameters: { length: 100 } },
			{
				id: "transition-1",
				type: "transition",
				parameters: { length: 60, transitionType: "clothoid" },
			},
			{
				id: "arc-1",
				type: "arc",
				parameters: { length: 100, curvature: 0.002, radius: 500 },
			},
		],
	},
	source: { kind: "native", native: true },
	placement: {
		engineeringCrsId: "engineering-nullCRS",
		geographicOrigin: null,
	},
	extensionEvidence: {
		preserve: { zero: 0, false: false, empty: "", null: null },
	},
};

const clone = (value) => structuredClone(value);

function makeRepository(entries) {
	const objects = new Map(
		Object.entries(entries).map(([id, value]) => [id, clone(value)])
	);
	const saveCalls = [];
	return {
		async loadById(id) {
			return objects.has(id) ? clone(objects.get(id)) : null;
		},
		async saveById(id, state) {
			const stored = clone(state);
			saveCalls.push({ alignmentId: id, alignmentState: clone(stored) });
			objects.set(id, stored);
			return clone(stored);
		},
		getObject(id) {
			return objects.has(id) ? clone(objects.get(id)) : null;
		},
		saveCalls,
	};
}

function rejected(alignmentId, elementId, code, reason) {
	return {
		contractVersion: ALIGNMENT_AUTHORING_RESULT_VERSION,
		status: "rejected",
		alignmentId: typeof alignmentId === "string" ? alignmentId : "",
		elementId:
			typeof elementId === "string" && elementId.length > 0
				? elementId
				: null,
		code,
		reason,
		focusRecommendation: null,
	};
}

async function executeUpdateArc(repository, request) {
	assertAlignmentRepositoryPort(repository);
	const validation = validateAlignmentAuthoringRequest(request);
	if (!validation.ok) {
		return rejected(
			request?.alignmentId,
			request?.elementId,
			validation.code,
			validation.reason
		);
	}

	const value = validation.value;
	const loaded = await repository.loadById(value.alignmentId);
	if (loaded == null) {
		return rejected(
			value.alignmentId,
			value.elementId,
			"ALIGNMENT_NOT_FOUND",
			`Alignment ${value.alignmentId} was not found`
		);
	}
	if (loaded.id !== value.alignmentId) {
		return rejected(
			value.alignmentId,
			value.elementId,
			"ALIGNMENT_ID_MISMATCH",
			"Loaded Alignment ID does not match the explicit request ID"
		);
	}

	const element = findElementById(loaded, value.elementId);
	if (element == null) {
		return rejected(
			value.alignmentId,
			value.elementId,
			"ELEMENT_NOT_FOUND",
			`Element ${value.elementId} was not found`
		);
	}
	if (element.type !== "arc") {
		return rejected(
			value.alignmentId,
			value.elementId,
			"ELEMENT_TYPE_MISMATCH",
			`Element ${value.elementId} is not an arc`
		);
	}

	let changed;
	try {
		changed = updateArcById(clone(loaded), {
			elementId: value.elementId,
			...value.changes,
			now: "2026-07-26T00:00:00.000Z",
		});
	} catch (error) {
		return rejected(
			value.alignmentId,
			value.elementId,
			"INVALID_ARC_PARAMETERS",
			error instanceof Error ? error.message : String(error)
		);
	}

	const stored = await repository.saveById(value.alignmentId, changed);
	return {
		contractVersion: ALIGNMENT_AUTHORING_RESULT_VERSION,
		status: "changed",
		alignmentId: value.alignmentId,
		elementId: value.elementId,
		alignmentState: stored,
		focusRecommendation: {
			alignmentId: value.alignmentId,
			elementId: value.elementId,
		},
	};
}

function request(overrides = {}) {
	return {
		contractVersion: "aim-core/alignment-authoring/0.1",
		alignmentId: "alignment-A",
		operation: "update-arc",
		elementId: "arc-1",
		changes: { curvature: 0.003 },
		...overrides,
	};
}

function assertRejected(result, code) {
	assert.equal(result.status, "rejected");
	assert.equal(result.code, code);
	assert.equal(result.focusRecommendation, null);
	assert.ok(result.reason.length > 0);
}

test("explicit ID curvature update preserves identity and unknown state", async () => {
	const fixtureBefore = clone(BASE_STATE);
	const nonTarget = { ...clone(BASE_STATE), id: "alignment-B" };
	const repository = makeRepository({
		"alignment-A": BASE_STATE,
		"alignment-B": nonTarget,
	});
	const result = await executeUpdateArc(repository, request());
	const arc = findElementById(result.alignmentState, "arc-1");

	assert.equal(result.status, "changed");
	assert.equal(result.alignmentId, "alignment-A");
	assert.equal(result.elementId, "arc-1");
	assert.equal(arc.id, "arc-1");
	assert.equal(arc.parameters.curvature, 0.003);
	assert.equal(arc.parameters.radius, 1 / 0.003);
	assert.equal(repository.saveCalls.length, 1);
	assert.equal(repository.saveCalls[0].alignmentId, "alignment-A");
	assert.deepEqual(BASE_STATE, fixtureBefore);
	assert.deepEqual(repository.getObject("alignment-B"), nonTarget);
	assert.deepEqual(
		result.alignmentState.extensionEvidence,
		BASE_STATE.extensionEvidence
	);
	assert.deepEqual(result.focusRecommendation, {
		alignmentId: "alignment-A",
		elementId: "arc-1",
	});
});

test("explicit radius update derives reciprocal curvature", async () => {
	const repository = makeRepository({ "alignment-A": BASE_STATE });
	const result = await executeUpdateArc(
		repository,
		request({ changes: { radius: 400 } })
	);
	const arc = findElementById(result.alignmentState, "arc-1");
	assert.equal(result.status, "changed");
	assert.equal(arc.parameters.radius, 400);
	assert.equal(arc.parameters.curvature, 1 / 400);
	assert.equal(repository.saveCalls.length, 1);
});

test("missing Alignment rejects without save", async () => {
	const repository = makeRepository({});
	const result = await executeUpdateArc(
		repository,
		request({ alignmentId: "alignment-missing" })
	);
	assertRejected(result, "ALIGNMENT_NOT_FOUND");
	assert.equal(repository.saveCalls.length, 0);
});

test("Alignment ID mismatch rejects without save", async () => {
	const repository = makeRepository({
		"alignment-A": { ...clone(BASE_STATE), id: "alignment-B" },
	});
	assertRejected(
		await executeUpdateArc(repository, request()),
		"ALIGNMENT_ID_MISMATCH"
	);
	assert.equal(repository.saveCalls.length, 0);
});

test("missing element rejects without mutation or save", async () => {
	const repository = makeRepository({ "alignment-A": BASE_STATE });
	const before = repository.getObject("alignment-A");
	assertRejected(
		await executeUpdateArc(repository, request({ elementId: "arc-missing" })),
		"ELEMENT_NOT_FOUND"
	);
	assert.equal(repository.saveCalls.length, 0);
	assert.deepEqual(repository.getObject("alignment-A"), before);
});

test("non-arc target rejects without save", async () => {
	const repository = makeRepository({ "alignment-A": BASE_STATE });
	assertRejected(
		await executeUpdateArc(repository, request({ elementId: "straight-1" })),
		"ELEMENT_TYPE_MISMATCH"
	);
	assert.equal(repository.saveCalls.length, 0);
});

test("zero curvature rejects without save", async () => {
	const repository = makeRepository({ "alignment-A": BASE_STATE });
	const result = await executeUpdateArc(
		repository,
		request({ changes: { curvature: 0 } })
	);
	assert.ok(
		["INVALID_REQUEST", "INVALID_ARC_PARAMETERS"].includes(result.code)
	);
	assert.equal(result.status, "rejected");
	assert.equal(repository.saveCalls.length, 0);
});

test("conflicting curvature and radius rejects without save", async () => {
	const repository = makeRepository({ "alignment-A": BASE_STATE });
	assertRejected(
		await executeUpdateArc(
			repository,
			request({ changes: { curvature: 0.003, radius: 400 } })
		),
		"INVALID_REQUEST"
	);
	assert.equal(repository.saveCalls.length, 0);
});

for (const [name, invalidRequest] of [
	["empty alignment ID", request({ alignmentId: "" })],
	["empty element ID", request({ elementId: "" })],
	["unknown operation", request({ operation: "append-arc" })],
	["no changes", request({ changes: {} })],
]) {
	test(`${name} rejects without save`, async () => {
		const repository = makeRepository({ "alignment-A": BASE_STATE });
		assertRejected(
			await executeUpdateArc(repository, invalidRequest),
			"INVALID_REQUEST"
		);
		assert.equal(repository.saveCalls.length, 0);
	});
}

test("Core seam modules have no forbidden dependencies", async () => {
	const files = [
		new URL(
			"../../../src/aim-core/alignment/authoring/AlignmentAuthoringContract.js",
			import.meta.url
		),
		new URL(
			"../../../src/aim-core/alignment/authoring/AlignmentRepositoryPort.js",
			import.meta.url
		),
	];
	const forbidden =
		/app\/|window|document|navigator|Worker|SharedWorker|messaging|MapLibre|GND|import\/|storage/i;
	for (const file of files) {
		assert.doesNotMatch(await readFile(file, "utf8"), forbidden);
	}
});
