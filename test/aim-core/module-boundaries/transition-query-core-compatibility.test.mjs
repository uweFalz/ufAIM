import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/transition/query/createTransitionQueryService.js";
import * as queryBarrel from "../../../src/aim-core/transition/query/index.js";
import * as legacy from "../../../src/domain/transition/service/TransitionQueryService.js";
import * as transition from "../../../src/aim-core/transition/index.js";
import * as root from "../../../src/aim-core/index.js";

function fixture() {
	const db = {
		schema: { version: "fixture/v1" },
		constant: { a: { value: 1 } },
		simpleFcn: {},
		protoFcn: {},
		halfWave: {},
		transition: {
			bloss: {
				id: "bloss",
				label: "Bloss",
				halfWave1: "same",
				halfWave2: "same",
				normLengthPartition: [0.5, 0, 0.5],
			},
			vienna6: {
				id: "vienna6",
				label: "Vienna 6",
				normLengthPartition: [0.25, 0.5, 0.25],
			},
		},
	};
	const calls = [];
	const registryResolver = {
		resolveTransitionDescriptor(id) {
			calls.push(id);
			return db.transition[String(id).toLowerCase()] ?? null;
		},
	};
	return { db, registryResolver, calls };
}

function runSequence(api) {
	const state = fixture();
	const service = api.createTransitionQueryService(state);
	const output = {
		presets: service.listPresets(),
		catalogue: service.getCatalogue(),
		spec: service.getPresetSpec("BLOSS"),
		unknownUpdate: service.updateWorkingCopy({
			presetId: "missing",
			normLengthPartition: [0, 1, 0],
		}),
		invalidLength: service.updateWorkingCopy({
			presetId: "bloss",
			normLengthPartition: [0.5, 0.5],
		}),
		invalidValue: service.updateWorkingCopy({
			presetId: "bloss",
			normLengthPartition: [0.5, Number.NaN, 0.5],
		}),
		invalidSum: service.updateWorkingCopy({
			presetId: "bloss",
			normLengthPartition: [0.2, 0.2, 0.2],
		}),
		update: service.updateWorkingCopy({
			presetId: " BLOSS ",
			normLengthPartition: ["0.2", "0.6", "0.2"],
		}),
		workingSpec: service.getPresetSpec("bloss"),
		workingCatalogue: service.getCatalogue(),
		reset: service.resetWorkingCopy({ presetId: " BLOSS " }),
		resetAgain: service.resetWorkingCopy({ presetId: "bloss" }),
		resetSpec: service.getPresetSpec("bloss"),
		calls: state.calls,
	};
	return { state, service, output };
}

test("old canonical and barrel Query exports share one function authority", () => {
	assert.deepEqual(Object.keys(legacy).sort(), Object.keys(canonical).sort());
	for (const api of [legacy, queryBarrel, transition, root]) {
		assert.strictEqual(
			api.createTransitionQueryService,
			canonical.createTransitionQueryService
		);
	}
});

test("representative catalogue preset update reject and reset sequences remain identical", () => {
	const oldRun = runSequence(legacy);
	const canonicalRun = runSequence(canonical);
	assert.deepEqual(canonicalRun.output, oldRun.output);
});

test("constructor and unknown-preset errors remain exact", () => {
	for (const api of [legacy, canonical]) {
		assert.throws(
			() => api.createTransitionQueryService(),
			(error) =>
				error instanceof Error &&
				error.message === "createTransitionQueryService: missing db"
		);
		assert.throws(
			() => api.createTransitionQueryService({ db: {} }),
			(error) =>
				error instanceof Error &&
				error.message ===
					"createTransitionQueryService: missing registryResolver"
		);
		const service = api.createTransitionQueryService({
			db: {},
			registryResolver: { resolveTransitionDescriptor: () => null },
		});
		assert.throws(
			() => service.getPresetSpec("missing"),
			(error) =>
				error instanceof Error &&
				error.message === "Unknown presetId: missing"
		);
	}
});

test("service captures db and resolver references and preserves resolver call behavior", () => {
	const state = fixture();
	const service = canonical.createTransitionQueryService(state);
	state.db.transition.late = {
		id: "late",
		normLengthPartition: [0, 1, 0],
	};
	assert.equal(service.listPresets().at(-1).id, "late");
	assert.equal(service.getPresetSpec("late").presetId, "late");
	assert.deepEqual(state.calls, ["late"]);
});

test("returned records are cloned while source inputs remain unchanged", () => {
	const state = fixture();
	const before = structuredClone(state.db);
	const service = canonical.createTransitionQueryService(state);
	const catalogue = service.getCatalogue();
	const spec = service.getPresetSpec("bloss");
	catalogue.schema.version = "changed";
	catalogue.records.transition[0].value.label = "changed";
	spec.descriptor.normLengthPartition[0] = 99;
	assert.deepEqual(state.db, before);
});

test("independent service instances keep isolated working-copy state", () => {
	const state = fixture();
	const first = canonical.createTransitionQueryService(state);
	const second = canonical.createTransitionQueryService(state);
	first.updateWorkingCopy({
		presetId: "bloss",
		normLengthPartition: [0.2, 0.6, 0.2],
	});
	assert.deepEqual(first.getCatalogue().workingCopyIds, ["bloss"]);
	assert.deepEqual(second.getCatalogue().workingCopyIds, []);
	assert.deepEqual(second.getPresetSpec("bloss").cuts01, { w1: 0.5, w2: 0.5 });
});

test("legacy path remains importable without duplicate Query authority", async () => {
	const imported = await import(
		"../../../src/domain/transition/service/TransitionQueryService.js"
	);
	assert.strictEqual(
		imported.createTransitionQueryService,
		canonical.createTransitionQueryService
	);
});
