import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/transition/registry/validateVersionedTransitionRegistry.js";
import { TRANSITION_SCHEMA_VERSION } from "../../../src/aim-core/transition/grammar/TransitionQuantityRoles.js";
import * as legacy from "../../../src/domain/transition/versioned/validateVersionedTransitionRegistry.js";

function validRegistry() {
	return {
		schema: { version: TRANSITION_SCHEMA_VERSION },
		records: {
			constant: {},
			simpleFcn: {},
			protoFcn: {},
			halfWave: {},
			transition: {},
		},
	};
}

test("legacy and canonical Registry exports are equal and reference-identical", () => {
	assert.deepEqual(Object.keys(legacy).sort(), Object.keys(canonical).sort());
	for (const name of Object.keys(canonical)) {
		assert.strictEqual(legacy[name], canonical[name], name);
	}
});

test("legacy Registry path remains importable through one authority", () => {
	assert.strictEqual(
		legacy.validateVersionedTransitionRegistry,
		canonical.validateVersionedTransitionRegistry
	);
});

test("representative valid and missing registries return identical reports", () => {
	const valid = validRegistry();
	assert.deepEqual(
		legacy.validateVersionedTransitionRegistry({
			versionedRegistry: valid,
		}),
		canonical.validateVersionedTransitionRegistry({
			versionedRegistry: valid,
		})
	);
	assert.deepEqual(
		legacy.validateVersionedTransitionRegistry({
			versionedRegistry: null,
		}),
		canonical.validateVersionedTransitionRegistry({
			versionedRegistry: null,
		})
	);
});

test("representative broken registry reports remain deeply identical", () => {
	const broken = validRegistry();
	broken.schema.version = "unsupported";
	broken.records.transition.broken = {
		legacyRecord: {
			halfWave1: "missing-1",
			halfWave2: "missing-2",
		},
		typedParameters: {
			normLengthPartition: { value: [0, Number.NaN, 0] },
			w1: { value: 2 },
			w2: { value: -1 },
		},
		components: [],
		zeroLengthPolicy: "unsupported",
	};
	assert.deepEqual(
		legacy.validateVersionedTransitionRegistry({
			versionedRegistry: broken,
		}),
		canonical.validateVersionedTransitionRegistry({
			versionedRegistry: broken,
		})
	);
});

test("Registry validation does not mutate inputs or throw for invalid registries", () => {
	const registry = validRegistry();
	const legacyDb = {
		transition: {
			vienna6: {
				halfWave1: "a",
				halfWave2: "b",
				normLengthPartition: [0, 1, 0],
			},
			part_v6: {
				halfWave1: "a",
				halfWave2: "b",
				normLengthPartition: [0, 1, 0],
			},
		},
	};
	const beforeRegistry = structuredClone(registry);
	const beforeLegacy = structuredClone(legacyDb);
	assert.doesNotThrow(() =>
		canonical.validateVersionedTransitionRegistry({
			versionedRegistry: registry,
			legacyDb,
		})
	);
	assert.deepEqual(registry, beforeRegistry);
	assert.deepEqual(legacyDb, beforeLegacy);
	assert.doesNotThrow(() =>
		canonical.validateVersionedTransitionRegistry({
			versionedRegistry: undefined,
		})
	);
});
