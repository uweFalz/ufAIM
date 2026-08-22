import test from "node:test";
import assert from "node:assert/strict";

import transitionLookup from "../../src/domain/transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "../../src/domain/transition/registry/RegistryResolver.js";
import { upgradeLegacyTransitionLookup } from "../../src/domain/transition/versioned/upgradeLegacyTransitionLookup.js";
import { TransitionQuantityRole } from "../../src/aim-core/transition/grammar/TransitionQuantityRoles.js";
import { createVersionedContinuityModel } from "../../src/domain/transition/versioned/continuity/createVersionedContinuityModel.js";
import { createTransitionContinuitySolver } from "../../src/aim-core/transition/continuity/solveTransitionContinuity.js";
import { validateContinuityCandidate } from "../../src/aim-core/transition/continuity/validateContinuityCandidate.js";

const K = TransitionQuantityRole.CURVATURE;
const K1 = TransitionQuantityRole.CURVATURE_FIRST_DERIVATIVE;
const K2 = TransitionQuantityRole.CURVATURE_SECOND_DERIVATIVE;
const schemaVersion = "berlinish-transition-grammar/v1";

function record(id = "synthetic-solver-record") {
	return {
		id,
		schemaVersion,
		provenance: {
			status: "synthetic-solver-test-only",
			note: "Not historical transition evidence",
		},
	};
}

function syntheticModel({
	joinFunctions = {},
	startFunctions = {},
	endFunctions = {},
	inactiveJoins = [],
} = {}) {
	return {
		evaluate({ transitionRecord, parameters }) {
			const quantityValues = (functions) => Object.fromEntries(
				Object.entries(functions).map(([quantity, fn]) => {
					const value = Number(fn(parameters));
					return [quantity, value];
				})
			);
			const joins = Object.entries(joinFunctions).map(([id, functions]) => ({
				id,
				active: true,
				leftComponentId: `${id}:left`,
				rightComponentId: `${id}:right`,
				quantities: Object.fromEntries(Object.entries(functions).map(([quantity, fn]) => {
					const residual = Number(fn(parameters));
					return [quantity, { left: residual, right: 0, residual }];
				})),
			}));
			return {
				ok: true,
				recordId: transitionRecord.id,
				parameters: structuredClone(parameters),
				components: [],
				joins,
				inactiveJoins: structuredClone(inactiveJoins),
				endpoints: {
					start: { active: true, componentId: "synthetic:start", quantities: quantityValues(startFunctions) },
					end: { active: true, componentId: "synthetic:end", quantities: quantityValues(endFunctions) },
				},
				evaluatorQuantities: [K, K1, K2],
				provenance: structuredClone(transitionRecord.provenance),
			};
		},
	};
}

function problem({
	id = "solver-test",
	freeParameters = [],
	fixedParameters = [],
	knownParameters = {},
	constraints = [],
	transitionRecord = record(),
	provenance = { source: "synthetic-continuity-solver-test" },
} = {}) {
	return {
		problemId: id,
		transitionRecord,
		knownParameters,
		fixedParameters,
		freeParameters,
		constraints,
		requestedOutputQuantities: [K, K1, K2],
		provenance,
	};
}

function free(id, initialValue, min = 0, max = 1) {
	return {
		id,
		initialValue,
		bounds: { min, max },
		quantityRole: TransitionQuantityRole.NORMALIZED_LONGITUDINAL_PARAMETER,
		provenance: { status: "declared-free", source: "synthetic-solver-test" },
	};
}

function join(id, joinId, quantity) {
	return { id, kind: "join", joinId, quantity, scale: 1, tolerance: 1e-8 };
}

function endpoint(id, side, quantity, target) {
	return { id, kind: "endpoint", endpoint: side, quantity, target, scale: 1, tolerance: 1e-8 };
}

test("synthetic solver case: already continuous fixed composition", () => {
	const solver = createTransitionContinuitySolver({ model: syntheticModel({ joinFunctions: { J: { [K]: () => 0 } } }) });
	const candidate = solver.solve(problem({ fixedParameters: [{ id: "w1", value: 0.5 }], constraints: [join("j-k", "J", K)] }));
	assert.equal(candidate.state, "solved");
	assert.equal(candidate.joinResiduals[0].residual, 0);
	assert.deepEqual(candidate.unchangedFixedParameters, { w1: 0.5 });
});

test("synthetic solver case: one free partition variable solves curvature join", () => {
	const solver = createTransitionContinuitySolver({ model: syntheticModel({ joinFunctions: { J: { [K]: ({ w1 }) => w1 - 0.4 } } }) });
	const candidate = solver.solve(problem({ freeParameters: [free("w1", 0.1)], constraints: [join("j-k", "J", K)] }));
	assert.equal(candidate.state, "solved");
	assert.ok(Math.abs(candidate.solvedParameters.w1 - 0.4) < 1e-8);
	assert.ok(Math.abs(candidate.joinResiduals[0].residual) < 1e-8);
});

test("synthetic solver case: two free partition variables solve two joins deterministically", () => {
	const model = syntheticModel({ joinFunctions: {
		J1: { [K]: ({ w1 }) => w1 - 0.2 },
		J2: { [K1]: ({ w2 }) => w2 - 0.8 },
	} });
	const solver = createTransitionContinuitySolver({ model });
	const input = problem({
		freeParameters: [free("w1", 0.4), free("w2", 0.6)],
		constraints: [join("j-k", "J1", K), join("j-k1", "J2", K1)],
	});
	const first = solver.solve(input);
	const second = solver.solve(input);
	assert.equal(first.state, "solved");
	assert.deepEqual(first, second);
	assert.ok(Math.abs(first.solvedParameters.w1 - 0.2) < 1e-8);
	assert.ok(Math.abs(first.solvedParameters.w2 - 0.8) < 1e-8);
});

test("synthetic solver case: curvature-first-derivative join solution", () => {
	const solver = createTransitionContinuitySolver({ model: syntheticModel({ joinFunctions: { J: { [K1]: ({ w1 }) => 2 * w1 - 0.6 } } }) });
	const candidate = solver.solve(problem({ freeParameters: [free("w1", 0.7)], constraints: [join("j-k1", "J", K1)] }));
	assert.equal(candidate.state, "solved");
	assert.ok(Math.abs(candidate.solvedParameters.w1 - 0.3) < 1e-8);
	assert.equal(candidate.joinResiduals[0].quantity, K1);
});

test("synthetic solver case: curvature-second-derivative evaluation is explicit", () => {
	const solver = createTransitionContinuitySolver({ model: syntheticModel({ joinFunctions: { J: { [K2]: () => 2.5e-9 } } }) });
	const candidate = solver.solve(problem({ fixedParameters: [{ id: "w1", value: 0.5 }], constraints: [join("j-k2", "J", K2)] }));
	assert.equal(candidate.state, "solved-with-residual");
	assert.equal(candidate.joinResiduals[0].quantity, K2);
	assert.equal(candidate.joinResiduals[0].residual, 2.5e-9);
});

test("synthetic solver case: endpoint condition solves declared free quantity", () => {
	const solver = createTransitionContinuitySolver({ model: syntheticModel({ endFunctions: { [K]: ({ w1 }) => w1 } }) });
	const candidate = solver.solve(problem({ freeParameters: [free("w1", 0.2)], constraints: [endpoint("end-k", "end", K, 0.75)] }));
	assert.equal(candidate.state, "solved");
	assert.ok(Math.abs(candidate.solvedParameters.w1 - 0.75) < 1e-8);
	assert.ok(Math.abs(candidate.endpointResiduals[0].residual) < 1e-8);
});

test("synthetic solver case: unresolved free parameter remains explicit", () => {
	const solver = createTransitionContinuitySolver({ model: syntheticModel() });
	const candidate = solver.solve(problem({ freeParameters: [free("w1", 0.5)] }));
	assert.equal(candidate.state, "underdetermined");
	assert.equal(candidate.remainingFreeParameters[0].id, "w1");
	assert.ok(candidate.warnings.some((warning) => warning.code === "CONTINUITY_UNDERDETERMINED"));
});

test("synthetic solver case: overdetermined consistent system is not called approved", () => {
	const solver = createTransitionContinuitySolver({ model: syntheticModel({ joinFunctions: { J: { [K]: ({ w1 }) => w1 - 0.5 } } }) });
	const candidate = solver.solve(problem({
		freeParameters: [free("w1", 0.1)],
		constraints: [join("same-1", "J", K), join("same-2", "J", K)],
	}));
	assert.equal(candidate.state, "overdetermined");
	assert.equal(candidate.authoritative, false);
	assert.equal(candidate.reviewStatus, "unreviewed-calculation-candidate");
});

test("synthetic solver case: inconsistent fixed problem", () => {
	const solver = createTransitionContinuitySolver({ model: syntheticModel({ joinFunctions: { J: { [K]: () => 0.1 } } }) });
	const candidate = solver.solve(problem({ fixedParameters: [{ id: "w1", value: 0.5 }], constraints: [join("j", "J", K)] }));
	assert.equal(candidate.state, "inconsistent");
	assert.equal(candidate.solvedParameters.w1, undefined);
});

test("synthetic solver case: invalid bounds and initial bound violation", () => {
	const solver = createTransitionContinuitySolver({ model: syntheticModel() });
	const reversed = solver.solve(problem({ freeParameters: [free("w1", 0.5, 0.8, 0.2)] }));
	const outside = solver.solve(problem({ freeParameters: [free("w1", 1.2, 0, 1)] }));
	assert.equal(reversed.state, "invalid-input");
	assert.equal(outside.state, "invalid-input");
	assert.ok(reversed.diagnostics.some((entry) => entry.code === "CONTINUITY_PARAMETER_BOUNDS_INVALID"));
	assert.ok(outside.diagnostics.some((entry) => entry.code === "CONTINUITY_PARAMETER_INITIAL_OUT_OF_BOUNDS"));
});

test("synthetic solver case: bounded non-convergence classification", () => {
	const solver = createTransitionContinuitySolver({
		model: syntheticModel({ joinFunctions: { J: { [K]: ({ w1 }) => w1 * w1 + 1 } } }),
		options: { maxIterations: 2 },
	});
	const candidate = solver.solve(problem({ freeParameters: [free("w1", 0.5, -1, 1)], constraints: [join("j", "J", K)] }));
	assert.equal(candidate.state, "not-converged");
	assert.ok(candidate.convergence.iterationCount <= 2);
});

test("synthetic solver case: non-finite evaluator output", () => {
	const solver = createTransitionContinuitySolver({ model: syntheticModel({ joinFunctions: { J: { [K]: () => Number.NaN } } }) });
	const candidate = solver.solve(problem({ fixedParameters: [{ id: "w1", value: 0.5 }], constraints: [join("j", "J", K)] }));
	assert.equal(candidate.state, "invalid-input");
	assert.ok(candidate.diagnostics.some((entry) => entry.code === "CONTINUITY_EVALUATION_NONFINITE"));
});

test("solver preserves immutable input, provenance and candidate serialization", () => {
	const model = syntheticModel({ joinFunctions: { J: { [K]: ({ w1 }) => w1 - 0.5 } } });
	const solver = createTransitionContinuitySolver({ model });
	const input = problem({
		freeParameters: [free("w1", 0.2)],
		constraints: [join("j", "J", K)],
		provenance: { source: "calculation-request", chain: ["evidence-a", "evidence-b"] },
	});
	const before = structuredClone(input);
	const candidate = solver.solve(input);
	assert.deepEqual(input, before);
	assert.deepEqual(candidate.provenance.input, input.provenance);
	assert.deepEqual(candidate.provenance.transition, input.transitionRecord.provenance);
	assert.deepEqual(JSON.parse(JSON.stringify(candidate)), candidate);
	assert.equal(candidate.candidateId, "solver-test::candidate-0001");
	assert.deepEqual(validateContinuityCandidate(candidate), { ok: true, errors: [] });
	const invalid = structuredClone(candidate);
	invalid.state = "approved";
	invalid.authoritative = true;
	const invalidReport = validateContinuityCandidate(invalid);
	assert.equal(invalidReport.ok, false);
	assert.ok(invalidReport.errors.some((entry) => entry.code === "CONTINUITY_CANDIDATE_STATE_INVALID"));
	assert.ok(invalidReport.errors.some((entry) => entry.code === "CONTINUITY_CANDIDATE_AUTHORITY_INVALID"));
});

const versioned = upgradeLegacyTransitionLookup(transitionLookup);
const registryModel = createVersionedContinuityModel({
	registryResolver: new RegistryResolver(transitionLookup),
});

test("repository evidence: exact curvature, first- and second-derivative residuals are exposed", () => {
	const evaluation = registryModel.evaluate({ transitionRecord: versioned.records.transition.gubar, parameters: {} });
	assert.equal(evaluation.ok, true);
	assert.equal(evaluation.joins.length, 2);
	for (const joinResult of evaluation.joins) {
		for (const quantity of [K, K1, K2]) {
			assert.equal(typeof joinResult.quantities[quantity].left, "number");
			assert.equal(typeof joinResult.quantities[quantity].right, "number");
			assert.equal(typeof joinResult.quantities[quantity].residual, "number");
		}
	}
	assert.equal(evaluation.endpoints.start.quantities[K], 0);
	assert.equal(evaluation.endpoints.end.quantities[K], 1);
	const solver = createTransitionContinuitySolver({ model: registryModel });
	const candidate = solver.solve(problem({
		id: "gubar-fixed-continuity",
		transitionRecord: versioned.records.transition.gubar,
		fixedParameters: [{ id: "w1", value: 0.25 }, { id: "w2", value: 0.75 }],
		constraints: [join("gubar-in-k", evaluation.joins[0].id, K)],
	}));
	assert.equal(candidate.state, "solved");
	assert.equal(candidate.joinResiduals.length, 6);
	assert.deepEqual([...new Set(candidate.joinResiduals.map((entry) => entry.quantity))], [K, K1, K2]);
});

test("repository evidence: explicit zero-length components create no false join", () => {
	const clothoid = registryModel.evaluate({ transitionRecord: versioned.records.transition.clothoid, parameters: {} });
	const bloss = registryModel.evaluate({ transitionRecord: versioned.records.transition.bloss, parameters: {} });
	assert.equal(clothoid.components.length, 3);
	assert.equal(clothoid.components.filter((component) => component.active).length, 1);
	assert.equal(clothoid.joins.length, 0);
	assert.equal(clothoid.inactiveJoins.length, 2);
	assert.equal(bloss.components[1].active, false);
	assert.equal(bloss.joins.length, 1);
	assert.equal(bloss.joins[0].leftComponentId, "bloss::halfwave-in");
	assert.equal(bloss.joins[0].rightComponentId, "bloss::halfwave-out");
});

test("repository-grounded zero-length entering and exiting components remain identifiable", () => {
	const db = structuredClone(transitionLookup);
	db.transition.zero_in_solver = { halfWave1: "HW_BLOSS", halfWave2: "HW_BLOSS", normLengthPartition: [0, 0.7, 0.3] };
	db.transition.zero_out_solver = { halfWave1: "HW_BLOSS", halfWave2: "HW_BLOSS", normLengthPartition: [0.3, 0.7, 0] };
	const upgraded = upgradeLegacyTransitionLookup(db);
	const model = createVersionedContinuityModel({ registryResolver: new RegistryResolver(db) });
	const zeroIn = model.evaluate({ transitionRecord: upgraded.records.transition.zero_in_solver, parameters: {} });
	const zeroOut = model.evaluate({ transitionRecord: upgraded.records.transition.zero_out_solver, parameters: {} });
	assert.equal(zeroIn.components[0].active, false);
	assert.equal(zeroIn.components[0].provenance.fieldProvenance.normalizedLength.status, "sourced");
	assert.equal(zeroIn.joins.length, 1);
	assert.equal(zeroOut.components[2].active, false);
	assert.equal(zeroOut.components[2].provenance.fieldProvenance.normalizedLength.status, "sourced");
	assert.equal(zeroOut.joins.length, 1);
});

test("repository evidence: nonzero three-component and asymmetric composition", () => {
	const gubar = registryModel.evaluate({ transitionRecord: versioned.records.transition.gubar, parameters: {} });
	assert.equal(gubar.components.every((component) => component.active), true);
	assert.deepEqual(gubar.components.map((component) => component.normalizedLength), [0.25, 0.5, 0.25]);
	assert.equal(gubar.joins.length, 2);
});

test("repository compatibility: all 31 transition records evaluate without mutation", () => {
	const before = structuredClone(versioned);
	const ids = Object.keys(versioned.records.transition);
	assert.equal(ids.length, 31);
	for (const id of ids) {
		const evaluation = registryModel.evaluate({ transitionRecord: versioned.records.transition[id], parameters: {} });
		assert.equal(evaluation.ok, true, `${id} should evaluate`);
		assert.deepEqual(evaluation.evaluatorQuantities, [K, K1, K2]);
		for (const component of evaluation.components.filter((entry) => entry.active)) {
			for (const side of ["start", "end"]) {
				for (const quantity of [K, K1, K2]) assert.ok(Number.isFinite(component[side][quantity]), `${id} ${component.role} ${side} ${quantity}`);
			}
		}
	}
	assert.deepEqual(versioned, before);
});
