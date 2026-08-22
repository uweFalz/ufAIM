import assert from "node:assert/strict";
import test from "node:test";

const legacy = await import(
	"../../../src/domain/transition/versioned/quantityRoles.js"
);
const canonical = await import(
	"../../../src/aim-core/transition/grammar/TransitionQuantityRoles.js"
);

test("legacy transition grammar has the canonical named export set", () => {
	assert.deepEqual(Object.keys(legacy).sort(), Object.keys(canonical).sort());
});

test("every legacy transition grammar export is reference-identical", () => {
	for (const name of Object.keys(canonical)) {
		assert.strictEqual(legacy[name], canonical[name], name);
	}
});

test("legacy path remains importable with shared frozen vocabulary identity", () => {
	for (const name of [
		"TransitionQuantityRole",
		"TransitionComponentRole",
		"TransitionRepresentationLevel",
		"TRANSITION_COMPONENT_ORDER",
		"ZERO_LENGTH_POLICY",
		"SUPPORTED_EVALUATION_QUANTITIES",
	]) {
		assert.equal(Object.isFrozen(legacy[name]), true, name);
		assert.strictEqual(legacy[name], canonical[name], name);
	}
});

test("component order and frozen object relationships are preserved exactly", () => {
	assert.deepEqual(legacy.TRANSITION_COMPONENT_ORDER, [
		legacy.TransitionComponentRole.HALFWAVE_IN,
		legacy.TransitionComponentRole.CLOTHOID_CORE,
		legacy.TransitionComponentRole.HALFWAVE_OUT,
	]);
	assert.strictEqual(
		legacy.TRANSITION_COMPONENT_ORDER[0],
		canonical.TransitionComponentRole.HALFWAVE_IN
	);
	assert.strictEqual(legacy.ZERO_LENGTH_POLICY, canonical.ZERO_LENGTH_POLICY);
	assert.deepEqual(Object.keys(legacy.TransitionQuantityRole), [
		"NORMALIZED_LONGITUDINAL_PARAMETER",
		"NORMALIZED_COMPONENT_LENGTH",
		"PHYSICAL_LENGTH",
		"CURVATURE",
		"CURVATURE_FIRST_DERIVATIVE",
		"CURVATURE_SECOND_DERIVATIVE",
		"CURVATURE_INTEGRAL",
		"DIMENSIONLESS_COEFFICIENT",
		"ANGLE",
	]);
});

test("supported and unsupported predicate outcomes share one grammar authority", () => {
	for (const quantity of Object.values(canonical.TransitionQuantityRole)) {
		assert.equal(
			legacy.isSupportedEvaluationQuantity(quantity),
			canonical.isSupportedEvaluationQuantity(quantity),
			quantity
		);
	}
	for (const quantity of [null, undefined, "", "speed", "curvature-third-derivative"]) {
		assert.equal(legacy.isSupportedEvaluationQuantity(quantity), false);
		assert.equal(canonical.isSupportedEvaluationQuantity(quantity), false);
	}
	assert.strictEqual(
		legacy.isSupportedEvaluationQuantity,
		canonical.isSupportedEvaluationQuantity
	);
});
