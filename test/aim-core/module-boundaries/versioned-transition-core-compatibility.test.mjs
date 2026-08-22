import assert from "node:assert/strict";
import test from "node:test";

import transitionLookup from "../../../src/domain/transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver as CoreResolver } from "../../../src/aim-core/transition/registry/RegistryResolver.js";
import { RegistryResolver as LegacyResolver } from "../../../src/domain/transition/registry/RegistryResolver.js";
import * as canonicalVersioned from "../../../src/aim-core/transition/versioned/index.js";
import * as legacyVersioned from "../../../src/domain/transition/versioned/index.js";
import { createVersionedContinuityModel as canonicalModel } from "../../../src/aim-core/transition/continuity/createVersionedContinuityModel.js";
import { createVersionedContinuityModel as legacyModel } from "../../../src/domain/transition/versioned/continuity/createVersionedContinuityModel.js";

function freshDb() {
	return structuredClone(transitionLookup);
}

test("legacy versioned exports are the canonical exports by identity", () => {
	assert.deepEqual(Object.keys(legacyVersioned).sort(), Object.keys(canonicalVersioned).sort());
	for (const name of Object.keys(canonicalVersioned)) {
		assert.strictEqual(legacyVersioned[name], canonicalVersioned[name], name);
	}
	assert.strictEqual(legacyModel, canonicalModel);
});

test("legacy default and injected resolvers match canonical injected resolution", () => {
	const legacyDefault = new LegacyResolver();
	const legacyInjected = new LegacyResolver(freshDb());
	const canonical = new CoreResolver(freshDb());
	assert.equal(legacyDefault instanceof CoreResolver, true);
	assert.equal(legacyInjected instanceof CoreResolver, true);
	assert.deepEqual(legacyDefault.listTransitionIds(), canonical.listTransitionIds());
	assert.deepEqual(legacyInjected.listTransitionIds(), canonical.listTransitionIds());

	for (const id of canonical.listTransitionIds()) {
		assert.deepEqual(legacyDefault.getTransitionMeta(id), canonical.getTransitionMeta(id));
		assert.deepEqual(
			legacyInjected.resolveTransitionDescriptor(id),
			canonical.resolveTransitionDescriptor(id)
		);
		assert.deepEqual(
			legacyInjected.resolveVersionedTransitionRecord(id),
			canonical.resolveVersionedTransitionRecord(id)
		);
	}
	assert.deepEqual(
		legacyInjected.getVersionedValidationReport(),
		canonical.getVersionedValidationReport()
	);
});

test("resolver cache aliases and exact unknown errors remain equivalent", () => {
	for (const Resolver of [LegacyResolver, CoreResolver]) {
		const resolver = new Resolver(freshDb());
		const first = resolver.resolveTransitionDescriptor("BLOSS");
		assert.strictEqual(first, resolver.resolveTransitionDescriptor("bloss"));
		assert.strictEqual(first, resolver.resolvePresetDescriptor("BLOSS"));
		assert.equal(resolver.getTransitionMeta("missing"), null);
		assert.throws(
			() => resolver.resolveTransitionDescriptor("missing"),
			/RegistryResolver: unknown transition "missing"/
		);
	}
});

test("upgrader and roundtrip snapshots remain exact for the full catalogue", () => {
	const leftDb = freshDb();
	const rightDb = freshDb();
	const left = legacyVersioned.upgradeLegacyTransitionLookup(leftDb);
	const right = canonicalVersioned.upgradeLegacyTransitionLookup(rightDb);
	assert.deepEqual(left, right);
	assert.deepEqual(leftDb, transitionLookup);
	assert.deepEqual(rightDb, transitionLookup);

	for (const id of Object.keys(transitionLookup.transition)) {
		assert.deepEqual(
			legacyVersioned.toLegacyTransitionDescriptor({
				legacyDb: leftDb,
				versionedTransitionId: id,
			}),
			canonicalVersioned.toLegacyTransitionDescriptor({
				legacyDb: rightDb,
				versionedTransitionId: id,
			})
		);
	}
	assert.deepEqual(
		legacyVersioned.createLegacyRoundTripSnapshot(left),
		canonicalVersioned.createLegacyRoundTripSnapshot(right)
	);
});

test("evaluator and continuity model preserve representative results and errors", () => {
	const legacyResolver = new LegacyResolver(freshDb());
	const coreResolver = new CoreResolver(freshDb());
	const legacyEvaluator = legacyVersioned.createVersionedTransitionEvaluator({
		registryResolver: legacyResolver,
	});
	const coreEvaluator = canonicalVersioned.createVersionedTransitionEvaluator({
		registryResolver: coreResolver,
	});
	const request = {
		recordId: "bloss",
		quantity: canonicalVersioned.TransitionQuantityRole.CURVATURE,
		at: {
			role: canonicalVersioned.TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER,
			value: 0.4,
		},
		overrides: { w1: 0.2, w2: 0.8 },
	};
	assert.deepEqual(legacyEvaluator.evaluate(request), coreEvaluator.evaluate(request));
	assert.deepEqual(
		legacyEvaluator.evaluate({ recordId: "bloss", quantity: "invalid" }),
		coreEvaluator.evaluate({ recordId: "bloss", quantity: "invalid" })
	);

	const record = coreResolver.resolveVersionedTransitionRecord("bloss");
	assert.deepEqual(
		legacyModel({ registryResolver: legacyResolver }).evaluate({
			transitionRecord: record,
		}),
		canonicalModel({ registryResolver: coreResolver }).evaluate({
			transitionRecord: record,
		})
	);
});

test("invalid injected databases fail through the same deterministic upgrader path", () => {
	for (const value of [null, [], 0, "invalid"]) {
		let legacyError;
		let coreError;
		try { new LegacyResolver(value); } catch (error) { legacyError = error; }
		try { new CoreResolver(value); } catch (error) { coreError = error; }
		assert.equal(legacyError?.constructor, coreError?.constructor);
		assert.equal(legacyError?.message, coreError?.message);
	}
});
