import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	assertAlignmentProfileStateReaderPort,
} from "../../../src/aim-core/alignment/profile/AlignmentProfileStateReaderPort.js";
import {
	ALIGNMENT_PROFILE_EVALUATION_RESULT_VERSION,
	AlignmentProfileEvaluationService,
	AlignmentProfileEvaluationServiceError,
} from "../../../src/aim-core/alignment/profile/AlignmentProfileEvaluationService.js";
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

const alignmentId = "alignment-A";

function verticalState({ empty = false } = {}) {
	const state = createVerticalConstructiveState({
		id: "vertical-A",
		alignmentId,
	});
	return empty
		? state
		: appendVerticalElement(state, {
				id: "V",
				type: "constant-gradient",
				startS: 0,
				endS: 100,
				startElevation: 10,
				gradient: 0.01,
			});
}

function cantState({ empty = false } = {}) {
	const state = createCantConstructiveState({
		id: "cant-A",
		alignmentId,
	});
	return empty
		? state
		: appendCantElement(state, {
				id: "C",
				type: "linear-cross-level",
				startS: 0,
				endS: 100,
				startCrossLevel: 0,
				crossLevelRate: 0.001,
			});
}

function mapping({
	id = "mapping-K",
	schemeId = "K",
	schemeVersion = "v1",
} = {}) {
	return createChainageMapping({
		id,
		alignmentId,
		schemeId,
		schemeVersion,
	});
}

function evaluatedMapping() {
	return appendChainageSegment(mapping(), {
		id: "S",
		startS: 0,
		endS: 100,
		startAddress: 1000,
		direction: 1,
	});
}

function fakeReader({
	vertical = verticalState(),
	cant = cantState(),
	chainage = [evaluatedMapping()],
} = {}) {
	const calls = [];
	return {
		calls,
		loadVerticalByAlignmentId(id) {
			calls.push(["vertical", id]);
			return vertical;
		},
		loadCantByAlignmentId(id) {
			calls.push(["cant", id]);
			return cant;
		},
		loadChainageMappingsByAlignmentId(id) {
			calls.push(["chainage", id]);
			return chainage;
		},
	};
}

function expectCode(code, operation) {
	return assert.rejects(operation, (error) => {
		assert.equal(
			error instanceof AlignmentProfileEvaluationServiceError,
			true
		);
		assert.equal(error.code, code);
		return true;
	});
}

test("port assertion accepts and returns an identical reader with all three methods", () => {
	const reader = fakeReader();
	assert.equal(assertAlignmentProfileStateReaderPort(reader), reader);
});

test("port assertion rejects null or each missing/non-callable operation", () => {
	assert.throws(() => assertAlignmentProfileStateReaderPort(null), TypeError);
	for (const operation of [
		"loadVerticalByAlignmentId",
		"loadCantByAlignmentId",
		"loadChainageMappingsByAlignmentId",
	]) {
		const reader = fakeReader();
		reader[operation] = null;
		assert.throws(
			() => assertAlignmentProfileStateReaderPort(reader),
			TypeError
		);
	}
});

test("evaluates vertical, cant, and one chainage mapping for explicit Alignment ID and intrinsic s", async () => {
	const service = new AlignmentProfileEvaluationService({
		stateReader: fakeReader(),
	});
	const result = await service.evaluateAt({ alignmentId, s: 50 });
	assert.equal(
		result.contractVersion,
		ALIGNMENT_PROFILE_EVALUATION_RESULT_VERSION
	);
	assert.equal(result.vertical.value.elevation, 10.5);
	assert.equal(result.vertical.value.gradient, 0.01);
	assert.equal(result.cant.value.crossLevel, 0.05);
	assert.equal(result.cant.value.twist, 0.001);
	assert.equal(result.chainage.mappings[0].candidates[0].address, 1050);
	assert.equal(Object.isFrozen(result), true);
	assert.equal(Object.isFrozen(result.chainage.mappings[0]), true);
});

test("invokes every port read exactly once with the trimmed explicit Alignment ID", async () => {
	const reader = fakeReader();
	const service = new AlignmentProfileEvaluationService({
		stateReader: reader,
	});
	await service.evaluateAt({ alignmentId: " alignment-A ", s: 50 });
	assert.deepEqual(reader.calls, [
		["vertical", alignmentId],
		["cant", alignmentId],
		["chainage", alignmentId],
	]);
});

test("reports absent vertical, absent cant, and absent chainage without fabrication", async () => {
	const service = new AlignmentProfileEvaluationService({
		stateReader: fakeReader({
			vertical: null,
			cant: null,
			chainage: [],
		}),
	});
	const result = await service.evaluateAt({ alignmentId, s: 50 });
	assert.deepEqual(result.vertical, { status: "absent" });
	assert.deepEqual(result.cant, { status: "absent" });
	assert.deepEqual(result.chainage, {
		status: "absent",
		mappings: [],
	});
});

test("translates empty vertical and cant states to not-covered with EMPTY_PROFILE and EMPTY_CANT", async () => {
	const service = new AlignmentProfileEvaluationService({
		stateReader: fakeReader({
			vertical: verticalState({ empty: true }),
			cant: cantState({ empty: true }),
			chainage: [],
		}),
	});
	const result = await service.evaluateAt({ alignmentId, s: 50 });
	assert.deepEqual(result.vertical, {
		status: "not-covered",
		code: "EMPTY_PROFILE",
	});
	assert.deepEqual(result.cant, {
		status: "not-covered",
		code: "EMPTY_CANT",
	});
});

test("translates positions outside populated vertical/cant domains to not-covered with POSITION_OUTSIDE_DOMAIN", async () => {
	const service = new AlignmentProfileEvaluationService({
		stateReader: fakeReader({ chainage: [] }),
	});
	const result = await service.evaluateAt({ alignmentId, s: 150 });
	assert.equal(result.vertical.code, "POSITION_OUTSIDE_DOMAIN");
	assert.equal(result.cant.code, "POSITION_OUTSIDE_DOMAIN");
});

test("retains a chainage mapping with zero candidates at the requested intrinsic position", async () => {
	const service = new AlignmentProfileEvaluationService({
		stateReader: fakeReader({
			vertical: null,
			cant: null,
			chainage: [evaluatedMapping()],
		}),
	});
	const result = await service.evaluateAt({ alignmentId, s: 150 });
	assert.equal(result.chainage.status, "evaluated");
	assert.equal(result.chainage.mappings.length, 1);
	assert.deepEqual(result.chainage.mappings[0].candidates, []);
});

test("preserves mapping order, scheme/version identity, and multiple touching-boundary candidates", async () => {
	let oldMapping = mapping({
		id: "K-old",
		schemeId: "K",
		schemeVersion: "old",
	});
	oldMapping = appendChainageSegment(oldMapping, {
		id: "BACK",
		startS: 0,
		endS: 100,
		startAddress: 1000,
		direction: 1,
	});
	oldMapping = appendChainageSegment(oldMapping, {
		id: "AHEAD",
		startS: 100,
		endS: 200,
		startAddress: 1200,
		direction: 1,
	});
	let newMapping = mapping({
		id: "K-new",
		schemeId: "K",
		schemeVersion: "new",
	});
	newMapping = appendChainageSegment(newMapping, {
		id: "NEW",
		startS: 0,
		endS: 200,
		startAddress: 2000,
		direction: 1,
	});
	const service = new AlignmentProfileEvaluationService({
		stateReader: fakeReader({
			vertical: null,
			cant: null,
			chainage: [oldMapping, newMapping],
		}),
	});
	const result = await service.evaluateAt({ alignmentId, s: 100 });
	assert.deepEqual(
		result.chainage.mappings.map((entry) => ({
			id: entry.mappingId,
			version: entry.schemeVersion,
			addresses: entry.candidates.map(({ address }) => address),
		})),
		[
			{ id: "K-old", version: "old", addresses: [1100, 1200] },
			{ id: "K-new", version: "new", addresses: [2100] },
		]
	);
});

test("rejects invalid request before any port read", async () => {
	for (const request of [
		{ alignmentId: " ", s: 0 },
		{ alignmentId, s: NaN },
	]) {
		const reader = fakeReader();
		const service = new AlignmentProfileEvaluationService({
			stateReader: reader,
		});
		await expectCode("INVALID_REQUEST", () =>
			service.evaluateAt(request)
		);
		assert.deepEqual(reader.calls, []);
	}
});

test("rejects invalid vertical/cant/null-chainage port shapes with INVALID_PORT_RESULT", async () => {
	for (const values of [
		{ vertical: {}, cant: null, chainage: [] },
		{ vertical: null, cant: {}, chainage: [] },
		{ vertical: null, cant: null, chainage: null },
	]) {
		const service = new AlignmentProfileEvaluationService({
			stateReader: fakeReader(values),
		});
		await expectCode("INVALID_PORT_RESULT", () =>
			service.evaluateAt({ alignmentId, s: 0 })
		);
	}
});

test("rejects a returned vertical or cant Alignment-ID mismatch with ALIGNMENT_ID_MISMATCH", async () => {
	const wrongVertical = {
		...verticalState(),
		alignmentId: "alignment-B",
	};
	const wrongCant = { ...cantState(), alignmentId: "alignment-B" };
	for (const values of [
		{ vertical: wrongVertical, cant: null, chainage: [] },
		{ vertical: null, cant: wrongCant, chainage: [] },
	]) {
		const service = new AlignmentProfileEvaluationService({
			stateReader: fakeReader(values),
		});
		await expectCode("ALIGNMENT_ID_MISMATCH", () =>
			service.evaluateAt({ alignmentId, s: 0 })
		);
	}
});

test("rejects a returned chainage Alignment-ID mismatch with ALIGNMENT_ID_MISMATCH", async () => {
	const wrong = { ...evaluatedMapping(), alignmentId: "alignment-B" };
	const service = new AlignmentProfileEvaluationService({
		stateReader: fakeReader({
			vertical: null,
			cant: null,
			chainage: [wrong],
		}),
	});
	await expectCode("ALIGNMENT_ID_MISMATCH", () =>
		service.evaluateAt({ alignmentId, s: 0 })
	);
});

test("rejects duplicate chainage mapping identity with DUPLICATE_MAPPING_ID", async () => {
	const first = evaluatedMapping();
	const duplicate = { ...first };
	const service = new AlignmentProfileEvaluationService({
		stateReader: fakeReader({
			vertical: null,
			cant: null,
			chainage: [first, duplicate],
		}),
	});
	await expectCode("DUPLICATE_MAPPING_ID", () =>
		service.evaluateAt({ alignmentId, s: 0 })
	);
});

test("wraps thrown/rejected port reads as PORT_READ_FAILED, wraps unexpected evaluator failures as COMPONENT_EVALUATION_FAILED, and preserves inputs byte-identically", async () => {
	const vertical = verticalState();
	const before = structuredClone(vertical);
	const failingReader = fakeReader({ vertical });
	failingReader.loadCantByAlignmentId = async () => {
		throw new Error("read failed");
	};
	await expectCode("PORT_READ_FAILED", () =>
		new AlignmentProfileEvaluationService({
			stateReader: failingReader,
		}).evaluateAt({ alignmentId, s: 50 })
	);
	assert.deepEqual(vertical, before);

	const volatileElements = new Proxy(vertical.elements, {
		get(target, property, receiver) {
			if (property === "find") throw new Error("evaluation failed");
			return Reflect.get(target, property, receiver);
		},
	});
	const volatileVertical = { ...vertical, elements: volatileElements };
	const service = new AlignmentProfileEvaluationService({
		stateReader: fakeReader({
			vertical: volatileVertical,
			cant: null,
			chainage: [],
		}),
	});
	await expectCode("COMPONENT_EVALUATION_FAILED", () =>
		service.evaluateAt({ alignmentId, s: 50 })
	);
	assert.deepEqual(vertical, before);
});

test("source/document dependency scan proves the port has zero imports and the service imports only the four authorized Core modules, with no forbidden dependency", async () => {
	const portUrl = new URL(
		"../../../src/aim-core/alignment/profile/AlignmentProfileStateReaderPort.js",
		import.meta.url
	);
	const serviceUrl = new URL(
		"../../../src/aim-core/alignment/profile/AlignmentProfileEvaluationService.js",
		import.meta.url
	);
	const docUrl = new URL(
		"../../../docs/app/architecture/aim-core/services/ALIGNMENT-PROFILE-EVALUATION-SERVICE-v0.1.md",
		import.meta.url
	);
	const [portSource, serviceSource, documentation] = await Promise.all([
		readFile(portUrl, "utf8"),
		readFile(serviceUrl, "utf8"),
		readFile(docUrl, "utf8"),
	]);
	assert.equal(/^\s*import\s/m.test(portSource), false);
	const imports = [
		...serviceSource.matchAll(/from\s+"([^"]+)"/g),
	].map((match) => match[1]);
	assert.deepEqual(imports, [
		"./AlignmentProfileStateReaderPort.js",
		"./VerticalConstructiveState.js",
		"./CantConstructiveState.js",
		"./ChainageMapping.js",
	]);
	for (const forbidden of [
		"app/",
		"window",
		"document",
		"Worker",
		"Messaging",
		"SPOT",
		"storage",
		"src/import",
		"GND",
		"selection",
		"adapter",
		"harness",
	]) {
		assert.equal(serviceSource.includes(forbidden), false);
	}
	assert.match(documentation, /component-preserving evaluation result/);
	assert.match(documentation, /non-canonical comparison evidence/);
});
