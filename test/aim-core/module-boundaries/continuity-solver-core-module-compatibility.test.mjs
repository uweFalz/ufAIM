import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/transition/continuity/solveTransitionContinuity.js";
import * as continuity from "../../../src/aim-core/transition/continuity/index.js";
import * as legacy from "../../../src/domain/transition/versioned/continuity/solveTransitionContinuity.js";
import * as legacyIndex from "../../../src/domain/transition/versioned/continuity/index.js";
import * as root from "../../../src/aim-core/index.js";
import * as transition from "../../../src/aim-core/transition/index.js";

const K = "curvature";
const SCHEMA_VERSION = "berlinish-transition-grammar/v1";

function modelFor(residuals = {}, endpoints = {}) {
	return {
		evaluate({ transitionRecord, parameters }) {
			const joins = Object.entries(residuals).map(([id, residual]) => {
				const value =
					typeof residual === "function" ? residual(parameters) : residual;
				return {
					id,
					active: true,
					leftComponentId: `${id}:left`,
					rightComponentId: `${id}:right`,
					quantities: {
						[K]: { left: Number(value), right: 0, residual: Number(value) },
					},
				};
			});
			const endpointValues = Object.fromEntries(
				Object.entries(endpoints).map(([side, value]) => [
					side,
					{
						active: true,
						componentId: `component:${side}`,
						quantities: {
							[K]: Number(
								typeof value === "function" ? value(parameters) : value
							),
						},
					},
				])
			);
			return {
				ok: true,
				recordId: transitionRecord.id,
				parameters: structuredClone(parameters),
				components: [],
				joins,
				inactiveJoins: [],
				endpoints: {
					start: endpointValues.start ?? {
						active: true,
						componentId: "component:start",
						quantities: {},
					},
					end: endpointValues.end ?? {
						active: true,
						componentId: "component:end",
						quantities: {},
					},
				},
				evaluatorQuantities: [K],
				provenance: structuredClone(transitionRecord.provenance),
			};
		},
	};
}

function record(id = "compat-record") {
	return {
		id,
		schemaVersion: SCHEMA_VERSION,
		provenance: { source: "synthetic-compatibility" },
	};
}

function problem(overrides = {}) {
	return {
		problemId: "compat-problem",
		transitionRecord: record(),
		knownParameters: {},
		fixedParameters: [],
		freeParameters: [],
		constraints: [],
		requestedOutputQuantities: [K],
		provenance: { source: "compatibility-test" },
		...overrides,
	};
}

function free(id, initialValue, min = 0, max = 1) {
	return {
		id,
		initialValue,
		bounds: { min, max },
		provenance: { source: "compatibility-test" },
	};
}

function join(id, joinId) {
	return { id, kind: "join", joinId, quantity: K, scale: 1 };
}

function runBoth(model, input, options) {
	const before = structuredClone(input);
	const oldSolver = legacy.createTransitionContinuitySolver({ model, options });
	const newSolver = canonical.createTransitionContinuitySolver({ model, options });
	const oldResult = oldSolver.solve(input);
	const newResult = newSolver.solve(input);
	assert.deepEqual(input, before);
	assert.deepEqual(newResult, oldResult);
	assert.deepEqual(newSolver.settings, oldSolver.settings);
	return newResult;
}

test("legacy canonical and all barrels share one solver authority", () => {
	assert.deepEqual(Object.keys(legacy), Object.keys(canonical));
	assert.strictEqual(
		legacy.createTransitionContinuitySolver,
		canonical.createTransitionContinuitySolver
	);
	assert.strictEqual(
		legacyIndex.createTransitionContinuitySolver,
		canonical.createTransitionContinuitySolver
	);
	assert.strictEqual(
		continuity.createTransitionContinuitySolver,
		canonical.createTransitionContinuitySolver
	);
	assert.strictEqual(
		transition.createTransitionContinuitySolver,
		canonical.createTransitionContinuitySolver
	);
	assert.strictEqual(
		root.createTransitionContinuitySolver,
		canonical.createTransitionContinuitySolver
	);
});

test("constructor validation defaults settings and option merge remain exact", () => {
	assert.throws(
		() => canonical.createTransitionContinuitySolver(),
		/createTransitionContinuitySolver: model\.evaluate is required/
	);
	assert.throws(
		() => legacy.createTransitionContinuitySolver({ model: {} }),
		/createTransitionContinuitySolver: model\.evaluate is required/
	);
	const model = modelFor();
	const defaults = canonical.createTransitionContinuitySolver({ model }).settings;
	assert.deepEqual(defaults, {
		maxIterations: 64,
		convergenceTolerance: 1e-10,
		residualTolerance: 1e-8,
		finiteDifferenceStep: 1e-6,
		minimumStepNorm: 1e-12,
	});
	const options = { maxIterations: 3, custom: "retained" };
	const solver = canonical.createTransitionContinuitySolver({ model, options });
	assert.deepEqual(solver.settings, { ...defaults, ...options });
	assert.notStrictEqual(solver.settings, options);
});

test("fixed consistent and inconsistent cases remain deeply identical", () => {
	const fixed = [{ id: "w1", value: 0.5 }];
	const consistent = runBoth(
		modelFor({ J: 0 }),
		problem({ fixedParameters: fixed, constraints: [join("j", "J")] })
	);
	assert.equal(consistent.state, "solved");
	const inconsistent = runBoth(
		modelFor({ J: 0.1 }),
		problem({ fixedParameters: fixed, constraints: [join("j", "J")] })
	);
	assert.equal(inconsistent.state, "inconsistent");
});

test("one-free two-free underdetermined and overdetermined cases remain identical", () => {
	const one = runBoth(
		modelFor({ J: ({ w1 }) => w1 - 0.4 }),
		problem({
			freeParameters: [free("w1", 0.1)],
			constraints: [join("j", "J")],
		})
	);
	assert.equal(one.state, "solved");
	const two = runBoth(
		modelFor({
			J1: ({ w1 }) => w1 - 0.2,
			J2: ({ w2 }) => w2 - 0.8,
		}),
		problem({
			freeParameters: [free("w1", 0.4), free("w2", 0.6)],
			constraints: [join("j1", "J1"), join("j2", "J2")],
		})
	);
	assert.equal(two.state, "solved");
	const under = runBoth(
		modelFor(),
		problem({ freeParameters: [free("w1", 0.5)] })
	);
	assert.equal(under.state, "underdetermined");
	const over = runBoth(
		modelFor({ J: ({ w1 }) => w1 - 0.5 }),
		problem({
			freeParameters: [free("w1", 0.1)],
			constraints: [join("j1", "J"), join("j2", "J")],
		})
	);
	assert.equal(over.state, "overdetermined");
});

test("bounds nonconvergence and nonfinite diagnostics remain identical", () => {
	const invalidBounds = runBoth(
		modelFor(),
		problem({ freeParameters: [free("w1", 0.5, 0.8, 0.2)] })
	);
	assert.equal(invalidBounds.state, "invalid-input");
	const nonconverged = runBoth(
		modelFor({ J: ({ w1 }) => w1 * w1 + 1 }),
		problem({
			freeParameters: [free("w1", 0.5, -1, 1)],
			constraints: [join("j", "J")],
		}),
		{ maxIterations: 2 }
	);
	assert.equal(nonconverged.state, "not-converged");
	const nonfinite = runBoth(
		modelFor({ J: Number.NaN }),
		problem({
			fixedParameters: [{ id: "w1", value: 0.5 }],
			constraints: [join("j", "J")],
		})
	);
	assert.equal(nonfinite.state, "invalid-input");
});

test("candidate provenance schema state and nonauthority remain exact", () => {
	const input = problem({
		freeParameters: [free("w1", 0.2)],
		constraints: [join("j", "J")],
		provenance: { source: "request", chain: ["a", "b"] },
	});
	const result = runBoth(modelFor({ J: ({ w1 }) => w1 - 0.5 }), input);
	assert.equal(result.schemaVersion, SCHEMA_VERSION);
	assert.equal(result.candidateId, "compat-problem::candidate-0001");
	assert.deepEqual(result.provenance.input, input.provenance);
	assert.equal(result.reviewStatus, "unreviewed-calculation-candidate");
	assert.equal(result.authoritative, false);
});

test("model and options are captured by reference with no duplicate authority", () => {
	let target = 0.25;
	const model = modelFor({ J: ({ w1 }) => w1 - target });
	const solver = canonical.createTransitionContinuitySolver({ model });
	const input = problem({
		freeParameters: [free("w1", 0.1)],
		constraints: [join("j", "J")],
	});
	assert.ok(Math.abs(solver.solve(input).solvedParameters.w1 - 0.25) < 1e-8);
	target = 0.75;
	assert.ok(Math.abs(solver.solve(input).solvedParameters.w1 - 0.75) < 1e-8);
	assert.strictEqual(
		legacy.createTransitionContinuitySolver,
		canonical.createTransitionContinuitySolver
	);
});
