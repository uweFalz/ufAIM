import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/transition/axtran/buildFutureAxtranInputContract.js";
import * as legacy from "../../../src/domain/transition/versioned/buildFutureAxtranInputContract.js";
import { TransitionQuantityRole } from "../../../src/aim-core/transition/grammar/TransitionQuantityRoles.js";

test("legacy and canonical AXTRAN contract exports are equal and reference-identical", () => {
	assert.deepEqual(Object.keys(legacy).sort(), Object.keys(canonical).sort());
	for (const name of Object.keys(canonical)) {
		assert.strictEqual(legacy[name], canonical[name], name);
	}
});

test("legacy AXTRAN contract path remains importable through one authority", () => {
	assert.strictEqual(
		legacy.buildFutureAxtranInputContract,
		canonical.buildFutureAxtranInputContract
	);
});

test("default AXTRAN contract calls are deeply identical", () => {
	assert.deepEqual(
		legacy.buildFutureAxtranInputContract(),
		canonical.buildFutureAxtranInputContract()
	);
});

test("fully populated AXTRAN contract calls are deeply identical", () => {
	const input = {
		transitionId: 42,
		components: [{ id: "component-A" }],
		knownParameters: { length: 100 },
		freeParameters: [{ id: "free-A" }],
		fixedParameters: [{ id: "fixed-A" }],
		constraints: [{ id: "constraint-A" }],
		boundaryConditions: { start: { curvature: 0 } },
		requestedOutputQuantities: [
			TransitionQuantityRole.CURVATURE,
			TransitionQuantityRole.CURVATURE_DERIVATIVE,
		],
	};
	assert.deepEqual(
		legacy.buildFutureAxtranInputContract(input),
		canonical.buildFutureAxtranInputContract(input)
	);
});

test("AXTRAN contract preserves supplied references without solve or evaluate effects", () => {
	const components = [];
	const knownParameters = {};
	const freeParameters = [];
	const fixedParameters = [];
	const constraints = [];
	const boundaryConditions = {};
	const requestedOutputQuantities = [TransitionQuantityRole.CURVATURE];
	const result = canonical.buildFutureAxtranInputContract({
		components,
		knownParameters,
		freeParameters,
		fixedParameters,
		constraints,
		boundaryConditions,
		requestedOutputQuantities,
	});
	assert.strictEqual(result.orderedTransitionComponents, components);
	assert.strictEqual(result.knownParameters, knownParameters);
	assert.strictEqual(result.freeParameters, freeParameters);
	assert.strictEqual(result.fixedParameters, fixedParameters);
	assert.strictEqual(result.constraints, constraints);
	assert.strictEqual(result.boundaryConditions, boundaryConditions);
	assert.strictEqual(
		result.requestedOutputQuantities,
		requestedOutputQuantities
	);
	assert.equal(result.status, "prepared-only");
	assert.equal(
		result.note,
		"This contract is intentionally solver-agnostic and not wired to axtranNew in this package."
	);
	assert.deepEqual(components, []);
});
