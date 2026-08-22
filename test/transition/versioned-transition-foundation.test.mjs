import test from "node:test";
import assert from "node:assert/strict";

import transitionLookup from "../../src/domain/transition/transitionLookup.json" with { type: "json" };
import { KappaFcnBuilder } from "../../src/domain/transition/build/KappaFcnBuilder.js";
import { RegistryResolver } from "../../src/domain/transition/registry/RegistryResolver.js";
import {
	createLegacyRoundTripSnapshot,
	createVersionedTransitionEvaluator,
	upgradeLegacyTransitionLookup,
} from "../../src/domain/transition/versioned/index.js";
import { buildFutureAxtranInputContract } from "../../src/aim-core/transition/axtran/buildFutureAxtranInputContract.js";
import { validateVersionedTransitionRegistry } from "../../src/aim-core/transition/registry/validateVersionedTransitionRegistry.js";
import {
	TRANSITION_COMPONENT_ORDER,
	TransitionComponentRole,
	TransitionQuantityRole,
} from "../../src/aim-core/transition/grammar/TransitionQuantityRoles.js";

function clone(value) {
	return structuredClone(value);
}

function legacyDescriptorFromLookup(db, transitionId) {
	const id = String(transitionId).toLowerCase();
	const tr = db.transition[id];
	const hw1 = db.halfWave[tr.halfWave1];
	const hw2 = db.halfWave[tr.halfWave2];

	return {
		id,
		label: tr.label ?? id,
		normLengthPartition: tr.normLengthPartition ?? [0, 1, 0],
		halfWave1: {
			id: tr.halfWave1,
			protoId: hw1.proto,
			protoDef: db.protoFcn[hw1.proto],
			source: hw1.source ?? "kappa",
		},
		halfWave2: {
			id: tr.halfWave2,
			protoId: hw2.proto,
			protoDef: db.protoFcn[hw2.proto],
			source: hw2.source ?? "kappa",
		},
		core: {
			id: "clothoCore",
			protoId: "clothoCore",
			protoDef: db.protoFcn.clothoCore,
			source: "kappa",
		},
		simpleFcn: db.simpleFcn,
	};
}

function approx(actual, expected, tolerance, label) {
	assert.ok(Number.isFinite(actual), `${label}: value is not finite`);
	assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}, tol=${tolerance}`);
}

test("inventory and strict validation report for versioned registry", () => {
	const versioned = upgradeLegacyTransitionLookup(transitionLookup);
	const report = validateVersionedTransitionRegistry({ versionedRegistry: versioned, legacyDb: transitionLookup });

	assert.equal(report.ok, true);
	assert.deepEqual(report.inventory, {
		constant: 5,
		simpleFcn: 20,
		protoFcn: 28,
		halfWave: 28,
		transition: 31,
	});

	assert.ok(report.warnings.some((w) => w.code === "VIENNA6_PARTV6_DUPLICATE"));
	assert.ok(report.warnings.some((w) => w.code === "CONSTANTS_DISCONNECTED"));
	assert.ok(report.diagnostics.disconnectedConstants.length >= 1);
	assert.ok(report.diagnostics.duplicateEquivalentTransitions.some((entry) => entry.ids.includes("vienna6") && entry.ids.includes("part_v6")));
});

test("legacy to versioned upgrade retains provenance and explicit composition", () => {
	const versioned = upgradeLegacyTransitionLookup(transitionLookup);
	const bloss = versioned.records.transition.bloss;

	assert.equal(bloss.schemaVersion, "berlinish-transition-grammar/v1");
	assert.equal(bloss.provenance.originalRecordIdentifier, "bloss");
	assert.equal(bloss.provenance.originalRegistryLevel, "transition");
	assert.equal(bloss.provenance.sourceFile, "src/domain/transition/transitionLookup.json");
	assert.equal(bloss.provenance.fieldProvenance.normLengthPartition.status, "sourced");

	assert.deepEqual(bloss.componentOrdering, TRANSITION_COMPONENT_ORDER);
	assert.equal(bloss.components.length, 3);
	assert.equal(bloss.components[0].role, TransitionComponentRole.HALFWAVE_IN);
	assert.equal(bloss.components[1].role, TransitionComponentRole.CLOTHOID_CORE);
	assert.equal(bloss.components[2].role, TransitionComponentRole.HALFWAVE_OUT);
});

test("round-trip snapshot retains legacy records", () => {
	const versioned = upgradeLegacyTransitionLookup(transitionLookup);
	const snapshot = createLegacyRoundTripSnapshot(versioned);

	assert.deepEqual(snapshot.constant, transitionLookup.constant);
	assert.deepEqual(snapshot.simpleFcn, transitionLookup.simpleFcn);
	assert.deepEqual(snapshot.protoFcn, transitionLookup.protoFcn);
	assert.deepEqual(snapshot.halfWave, transitionLookup.halfWave);
	assert.deepEqual(snapshot.transition, transitionLookup.transition);
});

test("component zero-length policy covers entering/core/exiting cases", () => {
	const db = clone(transitionLookup);
	db.transition.zero_in = {
		halfWave1: "HW_BLOSS",
		halfWave2: "HW_BLOSS",
		normLengthPartition: [0, 0.2, 0.8],
	};
	db.transition.zero_core = {
		halfWave1: "HW_BLOSS",
		halfWave2: "HW_BLOSS",
		normLengthPartition: [0.5, 0, 0.5],
	};
	db.transition.zero_out = {
		halfWave1: "HW_BLOSS",
		halfWave2: "HW_BLOSS",
		normLengthPartition: [0.3, 0.7, 0],
	};

	const versioned = upgradeLegacyTransitionLookup(db);

	assert.equal(versioned.records.transition.zero_in.components[0].zeroLength, true);
	assert.equal(versioned.records.transition.zero_core.components[1].zeroLength, true);
	assert.equal(versioned.records.transition.zero_out.components[2].zeroLength, true);
	assert.equal(versioned.records.transition.clothoid.components[0].zeroLength, true);
	assert.equal(versioned.records.transition.clothoid.components[1].zeroLength, false);
	assert.equal(versioned.records.transition.clothoid.components[2].zeroLength, true);
	assert.equal(versioned.records.transition.bloss.components[1].zeroLength, true);
});

test("pure curved and asymmetric transitions keep explicit partition boundaries", () => {
	const versioned = upgradeLegacyTransitionLookup(transitionLookup);
	const bloss = versioned.records.transition.bloss;
	const gubar = versioned.records.transition.gubar;

	approx(bloss.typedParameters.w1.value, 0.5, 1e-12, "bloss w1");
	approx(bloss.typedParameters.w2.value, 0.5, 1e-12, "bloss w2");
	approx(gubar.typedParameters.w1.value, 0.25, 1e-12, "gubar w1");
	approx(gubar.typedParameters.w2.value, 0.75, 1e-12, "gubar w2");
});

test("strict validator rejects invalid partition and broken references", () => {
	const versioned = upgradeLegacyTransitionLookup(transitionLookup);
	const broken = clone(versioned);

	broken.records.transition.bloss.typedParameters.w1.value = 0.9;
	broken.records.transition.bloss.typedParameters.w2.value = 0.2;
	broken.records.transition.bloss.legacyRecord.halfWave1 = "HW_DOES_NOT_EXIST";

	const report = validateVersionedTransitionRegistry({ versionedRegistry: broken, legacyDb: transitionLookup });

	assert.equal(report.ok, false);
	assert.ok(report.errors.some((err) => err.code === "TRANSITION_PARTITION_ORDER"));
	assert.ok(report.errors.some((err) => err.code === "TRANSITION_HALFWAVE1_MISSING"));
});

test("strict validator rejects malformed boundary-condition structure", () => {
	const versioned = upgradeLegacyTransitionLookup(transitionLookup);
	const broken = clone(versioned);
	delete broken.records.transition.bloss.boundaryConditions.normalized;

	const report = validateVersionedTransitionRegistry({ versionedRegistry: broken, legacyDb: transitionLookup });
	assert.equal(report.ok, false);
	assert.ok(report.errors.some((err) => err.code === "BOUNDARY_STRUCTURE_INVALID"));
});

test("quantity-aware evaluator returns structured results and rejects unsupported quantities", () => {
	const resolver = new RegistryResolver(transitionLookup);
	const evaluator = createVersionedTransitionEvaluator({ registryResolver: resolver });

	const out = evaluator.evaluate({
		recordId: "bloss",
		quantity: TransitionQuantityRole.CURVATURE_FIRST_DERIVATIVE,
		at: {
			role: TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER,
			value: 0.35,
		},
	});

	assert.equal(out.ok, true);
	assert.equal(out.request.quantity, TransitionQuantityRole.CURVATURE_FIRST_DERIVATIVE);
	assert.equal(out.origin.recordId, "bloss");
	assert.equal(out.normalizedDomain.start, 0);
	assert.equal(out.normalizedDomain.end, 1);
	assert.equal(typeof out.result.value, "number");

	const rejected = evaluator.evaluate({
		recordId: "bloss",
		quantity: "angle",
		at: {
			role: TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER,
			value: 0.35,
		},
	});

	assert.equal(rejected.ok, false);
	assert.equal(rejected.error.code, "TRANSITION_QUANTITY_UNSUPPORTED");
});

test("golden compatibility for all transition records and all quantities", () => {
	const resolver = new RegistryResolver(transitionLookup);
	const evaluator = createVersionedTransitionEvaluator({ registryResolver: resolver });

	const ids = Object.keys(transitionLookup.transition);
	assert.equal(ids.length, 31);

	const sampleU = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];
	const checks = [
		{ quantity: TransitionQuantityRole.CURVATURE, fn: "kappa", tolerance: 1e-11 },
		{ quantity: TransitionQuantityRole.CURVATURE_FIRST_DERIVATIVE, fn: "kappa1", tolerance: 1e-10 },
		{ quantity: TransitionQuantityRole.CURVATURE_SECOND_DERIVATIVE, fn: "kappa2", tolerance: 1e-9 },
		{ quantity: TransitionQuantityRole.CURVATURE_INTEGRAL, fn: "kappaInt", tolerance: 1e-10 },
	];

	for (const id of ids) {
		const oldDesc = legacyDescriptorFromLookup(transitionLookup, id);
		const oldPreset = KappaFcnBuilder.buildPresetFromDescriptor(oldDesc);

		for (const check of checks) {
			for (const u of sampleU) {
				const oldValue = Number(oldPreset[check.fn](u));
				const out = evaluator.evaluate({
					recordId: id,
					quantity: check.quantity,
					at: {
						role: TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER,
						value: u,
					},
				});
				assert.equal(out.ok, true, `${id} ${check.quantity} at u=${u} should be finite`);
				approx(out.result.value, oldValue, check.tolerance, `${id} ${check.quantity} at u=${u}`);
			}
		}

		const k0 = evaluator.evaluate({
			recordId: id,
			quantity: TransitionQuantityRole.CURVATURE,
			at: { role: TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER, value: 0 },
		});
		const k1 = evaluator.evaluate({
			recordId: id,
			quantity: TransitionQuantityRole.CURVATURE,
			at: { role: TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER, value: 1 },
		});

		approx(k0.result.value, 0, 1e-10, `${id} kappa(0)`);
		approx(k1.result.value, 1, 1e-10, `${id} kappa(1)`);
	}
});

test("future AXTRAN input contract is available and typed", () => {
	const contract = buildFutureAxtranInputContract({
		transitionId: "bloss",
		components: [
			{ role: "halfwave-in", ref: "HW_BLOSS" },
			{ role: "clothoid-core", ref: "clothoCore" },
			{ role: "halfwave-out", ref: "HW_BLOSS" },
		],
		knownParameters: { w1: 0.5, w2: 0.5 },
		freeParameters: ["w1"],
		fixedParameters: ["w2"],
		constraints: [{ kind: "partition-order" }],
		requestedOutputQuantities: [
			TransitionQuantityRole.CURVATURE,
			TransitionQuantityRole.CURVATURE_INTEGRAL,
		],
	});

	assert.equal(contract.contractVersion, "future-axtran-input/v1");
	assert.equal(contract.transitionId, "bloss");
	assert.equal(contract.status, "prepared-only");
	assert.equal(contract.requestedOutputQuantities.length, 2);
});
