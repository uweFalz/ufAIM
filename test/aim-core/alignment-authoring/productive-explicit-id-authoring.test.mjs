import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
const aliases = {
	"@src/": "src/",
	"@spot/": "src/model/spot/",
	"@projection/": "src/domain/projection/",
	"@transition/": "src/domain/transition/",
	"@alignment/": "src/domain/alignment/",
	"@domain/": "src/domain/",
	"@shared/": "src/shared/",
	"@kgeom/": "src/lib/geom/",
	"@kmath/": "src/lib/math/",
	"@utils/": "src/lib/utils/",
};
registerHooks({
	resolve(specifier, context, nextResolve) {
		for (const [prefix, target] of Object.entries(aliases)) {
			if (specifier.startsWith(prefix)) {
				return nextResolve(
					new URL(target + specifier.slice(prefix.length), rootUrl).href,
					context
				);
			}
		}
		return nextResolve(specifier, context);
	},
});

const { AlignmentApplicationService } = await import(
	"../../../src/services/alignment/AlignmentApplicationService.js"
);
const { SpotAlignmentRepositoryAdapter } = await import(
	"../../../src/services/alignment/SpotAlignmentRepositoryAdapter.js"
);
const { AlignmentMapper } = await import(
	"../../../src/model/spot/model/AlignmentSpotObjectMapper.js"
);

const BASE_STATE = {
	type: "AlignmentData",
	id: "alignment-B",
	name: "Productive Explicit B",
	editModel: {
		startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
		elements: [
			{
				id: "straight-1",
				type: "straight",
				parameters: { length: 100 },
				unknownStraight: 0,
			},
			{
				id: "transition-1",
				type: "transition",
				parameters: { length: 60, transitionType: "clothoid" },
			},
			{
				id: "arc-1",
				type: "arc",
				parameters: { length: 100, curvature: 0.002, radius: 500 },
				unknownArc: { preserve: true },
			},
		],
	},
	source: { kind: "native", native: true },
	unknownEnvelope: { zero: 0, false: false, empty: "", null: null },
};

const clone = (value) => structuredClone(value);

function makeRepository(entries = { "alignment-B": BASE_STATE }) {
	const objects = new Map(
		Object.entries(entries).map(([id, value]) => [id, clone(value)])
	);
	const loads = [];
	const saves = [];
	return {
		async loadById(id) {
			loads.push(id);
			return objects.has(id) ? clone(objects.get(id)) : null;
		},
		async saveById(id, state) {
			saves.push({ id, state: clone(state) });
			objects.set(id, clone(state));
			return clone(state);
		},
		get(id) {
			return objects.has(id) ? clone(objects.get(id)) : null;
		},
		loads,
		saves,
	};
}

function makeStrictService(repository) {
	const store = {
		getState() {
			throw new Error("explicit-ID method read workspace selection");
		},
		actions: {
			setWorkspaceSelection() {
				throw new Error("explicit-ID method changed workspace selection");
			},
		},
	};
	const spotGateway = {
		async getObjectById() {
			throw new Error("explicit-ID method bypassed repository");
		},
		async saveObject() {
			throw new Error("explicit-ID method bypassed repository");
		},
	};
	return new AlignmentApplicationService({
		store,
		spotGateway,
		mapper: new AlignmentMapper(),
		alignmentRepository: repository,
	});
}

const arcRequest = (overrides = {}) => ({
	alignmentId: "alignment-B",
	elementId: "arc-1",
	curvature: 0.003,
	...overrides,
});

test("1 explicit-ID curvature update saves exactly once", async () => {
	const repository = makeRepository();
	const result = await makeStrictService(repository).updateArcByAlignmentId(
		arcRequest()
	);
	assert.equal(result.status, "changed");
	assert.equal(result.alignmentState.editModel.elements[2].parameters.curvature, 0.003);
	assert.equal(repository.saves.length, 1);
	assert.equal(repository.saves[0].id, "alignment-B");
});

test("2 requested B changes while unrelated A remains byte-identical", async () => {
	const alignmentA = { ...clone(BASE_STATE), id: "alignment-A", name: "A" };
	const repository = makeRepository({
		"alignment-A": alignmentA,
		"alignment-B": BASE_STATE,
	});
	const beforeA = repository.get("alignment-A");
	await makeStrictService(repository).updateArcByAlignmentId(arcRequest());
	assert.deepEqual(repository.get("alignment-A"), beforeA);
	assert.equal(repository.loads[0], "alignment-B");
});

test("3 success preserves identities and unknown members", async () => {
	const repository = makeRepository();
	const result = await makeStrictService(repository).updateArcByAlignmentId(
		arcRequest()
	);
	const arc = result.alignmentState.editModel.elements.find(
		(element) => element.id === "arc-1"
	);
	assert.equal(result.alignmentState.id, "alignment-B");
	assert.equal(arc.id, "arc-1");
	assert.deepEqual(arc.unknownArc, { preserve: true });
	assert.deepEqual(result.alignmentState.unknownEnvelope, BASE_STATE.unknownEnvelope);
});

test("4 success returns recommendation without selection action", async () => {
	const result = await makeStrictService(makeRepository()).updateArcByAlignmentId(
		arcRequest()
	);
	assert.deepEqual(result.focusRecommendation, {
		alignmentId: "alignment-B",
		elementId: "arc-1",
	});
});

test("5 missing Alignment rejects with zero saves", async () => {
	const repository = makeRepository({});
	const result = await makeStrictService(repository).updateArcByAlignmentId(
		arcRequest()
	);
	assert.equal(result.code, "ALIGNMENT_NOT_FOUND");
	assert.equal(repository.saves.length, 0);
});

test("6 loaded ID mismatch rejects with zero saves", async () => {
	const repository = makeRepository({
		"alignment-B": { ...clone(BASE_STATE), id: "alignment-other" },
	});
	const result = await makeStrictService(repository).updateArcByAlignmentId(
		arcRequest()
	);
	assert.equal(result.code, "ALIGNMENT_ID_MISMATCH");
	assert.equal(repository.saves.length, 0);
});

test("7 missing element rejects without mutation or save", async () => {
	const repository = makeRepository();
	const before = repository.get("alignment-B");
	const result = await makeStrictService(repository).updateArcByAlignmentId(
		arcRequest({ elementId: "missing" })
	);
	assert.equal(result.code, "ELEMENT_NOT_FOUND");
	assert.equal(repository.saves.length, 0);
	assert.deepEqual(repository.get("alignment-B"), before);
});

test("8 straight target rejects with zero saves", async () => {
	const repository = makeRepository();
	const result = await makeStrictService(repository).updateArcByAlignmentId(
		arcRequest({ elementId: "straight-1" })
	);
	assert.equal(result.code, "ELEMENT_TYPE_MISMATCH");
	assert.equal(repository.saves.length, 0);
});

test("9 invalid and conflicting parameters reject with zero saves", async () => {
	const repository = makeRepository();
	const service = makeStrictService(repository);
	const zero = await service.updateArcByAlignmentId(arcRequest({ curvature: 0 }));
	const conflict = await service.updateArcByAlignmentId(
		arcRequest({ curvature: 0.003, radius: 400 })
	);
	assert.equal(zero.code, "INVALID_REQUEST");
	assert.equal(conflict.code, "INVALID_REQUEST");
	assert.equal(repository.saves.length, 0);
});

test("10 structurally invalid sequence rejects with zero saves", async () => {
	const invalid = clone(BASE_STATE);
	invalid.editModel.elements = [
		invalid.editModel.elements[0],
		invalid.editModel.elements[2],
	];
	const repository = makeRepository({ "alignment-B": invalid });
	const result = await makeStrictService(repository).updateArcByAlignmentId(
		arcRequest()
	);
	assert.equal(result.code, "CONSTRUCTIVE_SEQUENCE_REJECTED");
	assert.equal(repository.saves.length, 0);
});

test("11 explicit method has no selection, UI, browser, Worker or GND dependency", async () => {
	const source = AlignmentApplicationService.prototype.updateArcByAlignmentId.toString();
	assert.doesNotMatch(
		source,
		/\bstore\b|getState|workspace|selection|\bactive\b|window|document|Worker|Messaging|GND|MapLibre|app\//
	);
	for (const path of [
		"src/aim-core/alignment/authoring/AlignmentAuthoringContract.js",
		"src/aim-core/alignment/authoring/AlignmentRepositoryPort.js",
	]) {
		const text = await readFile(new URL(path, rootUrl), "utf8");
		assert.doesNotMatch(
			text,
			/app\/|window|document|Worker|SharedWorker|messaging|GND|MapLibre|storage/i
		);
	}
});

test("12 adapter saves with focus false and preserves SPOT evidence", async () => {
	const mapper = new AlignmentMapper();
	const original = {
		id: "alignment-B",
		type: "alignment",
		crsId: "EPSG:25832",
		refs: { source: "retain-ref" },
		data: {
			name: "Productive Explicit B",
			alignmentData: clone(BASE_STATE),
			extended: { evidence: "retain-extended" },
		},
		meta: { source: { kind: "import", evidence: "retain-source" } },
	};
	const calls = [];
	const gateway = {
		async getObjectById() {
			return clone(original);
		},
		async saveObject(object, options) {
			calls.push({ object: clone(object), options: clone(options) });
			return { spotObject: object };
		},
	};
	const adapter = new SpotAlignmentRepositoryAdapter({ spotGateway: gateway, mapper });
	const state = await adapter.loadById("alignment-B");
	state.name = "Changed";
	await adapter.saveById("alignment-B", state);
	assert.deepEqual(calls[0].options, {
		source: "alignment-authoring-explicit-id",
		focus: false,
	});
	assert.deepEqual(calls[0].object.meta.source, original.meta.source);
	assert.deepEqual(calls[0].object.data.extended, original.data.extended);
	assert.equal(calls[0].object.refs.source, original.refs.source);
});

test("13 adapter loads requested ID without active-object lookup", async () => {
	const calls = [];
	const gateway = {
		async getObjectById(id) {
			calls.push(id);
			return {
				id,
				type: "alignment",
				data: { alignmentData: { ...clone(BASE_STATE), id } },
			};
		},
		async saveObject() {
			throw new Error("not expected");
		},
		getActiveAlignment() {
			throw new Error("adapter used active lookup");
		},
	};
	const adapter = new SpotAlignmentRepositoryAdapter({
		spotGateway: gateway,
		mapper: new AlignmentMapper(),
	});
	assert.equal((await adapter.loadById("alignment-B")).id, "alignment-B");
	assert.deepEqual(calls, ["alignment-B"]);
});

function makeCompatibilityService() {
	let selection = {
		primaryId: "alignment-B",
		contextIds: ["context"],
		elementId: "arc-1",
		source: "test",
	};
	const mapper = new AlignmentMapper();
	const original = {
		id: "alignment-B",
		type: "alignment",
		data: { name: BASE_STATE.name, alignmentData: clone(BASE_STATE), extended: {} },
		meta: { source: { kind: "native" } },
		refs: {},
	};
	let current = clone(original);
	const gateway = {
		async getActiveAlignment() {
			return clone(current);
		},
		async getObjectById(id) {
			return id === current.id ? clone(current) : null;
		},
		async saveObject(object, options) {
			current = clone(object);
			return { spotObject: clone(object), options };
		},
	};
	const store = {
		getState() {
			return { workspace_selection: clone(selection) };
		},
		actions: {
			setWorkspaceSelection(next) {
				selection = clone(next);
			},
		},
	};
	return {
		service: new AlignmentApplicationService({ store, spotGateway: gateway, mapper }),
		getSelection: () => clone(selection),
	};
}

test("14 active wrapper preserves success shape and selected element", async () => {
	const fixture = makeCompatibilityService();
	const result = await fixture.service.updateArc({
		elementId: "arc-1",
		curvature: 0.003,
	});
	assert.equal(result.changed, true);
	assert.equal(result.alignmentData.id, "alignment-B");
	assert.ok("sparseAlignment" in result);
	assert.equal(result.spotObject.id, "alignment-B");
	assert.equal(fixture.getSelection().elementId, "arc-1");
	assert.deepEqual(fixture.getSelection().contextIds, ["context"]);
});

test("15 active wrapper invokes explicit method once and bypasses legacy editor", async () => {
	const fixture = makeCompatibilityService();
	let explicitCalls = 0;
	const explicit = fixture.service.updateArcByAlignmentId.bind(fixture.service);
	fixture.service.updateArcByAlignmentId = async (args) => {
		explicitCalls += 1;
		return explicit(args);
	};
	fixture.service._editActiveAlignment = async () => {
		throw new Error("legacy active editor was invoked");
	};
	const result = await fixture.service.updateArc({
		elementId: "arc-1",
		radius: 400,
	});
	assert.equal(result.changed, true);
	assert.equal(explicitCalls, 1);
});
