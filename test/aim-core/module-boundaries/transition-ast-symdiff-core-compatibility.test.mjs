import assert from "node:assert/strict";
import test from "node:test";

import { makeEvalFn } from "../../../src/aim-core/transition/ast/evalAst.js";
import * as astBarrel from "../../../src/aim-core/transition/ast/index.js";
import * as canonical from "../../../src/aim-core/transition/ast/symDiff.js";
import * as legacy from "../../../src/domain/transition/registry/ast/symDiff.js";
import * as transition from "../../../src/aim-core/transition/index.js";
import * as root from "../../../src/aim-core/index.js";

function outcome(api, value) {
	try {
		return { value: api.symDiff(value) };
	} catch (error) {
		return { error: { name: error.name, message: error.message } };
	}
}

test("legacy canonical and barrels share one symDiff authority", () => {
	assert.deepEqual(Object.keys(legacy), ["symDiff"]);
	assert.deepEqual(Object.keys(canonical), ["symDiff"]);
	for (const api of [legacy, astBarrel, transition, root]) {
		assert.strictEqual(api.symDiff, canonical.symDiff);
	}
});

test("null number constants pi and 2pi differentiate to exact zero shape", () => {
	for (const input of [
		null,
		0,
		12,
		{ op: "const", value: 8 },
		{ op: "pi" },
		{ op: "2pi" },
	]) {
		assert.deepEqual(canonical.symDiff(input), { op: "const", value: 0 });
		assert.deepEqual(outcome(legacy, input), outcome(canonical, input));
	}
});

test("polynomial coefficient coercion order and cleanup remain exact", () => {
	assert.deepEqual(
		canonical.symDiff({
			op: "poly",
			coeff: ["1", "2", 3, 0, Number.NaN],
		}),
		{ op: "poly", coeff: [2, 6] }
	);
	assert.deepEqual(canonical.symDiff({ op: "poly", coeff: [7] }), {
		op: "poly",
		coeff: [],
	});
	assert.deepEqual(
		canonical.symDiff({ op: "poly", coeff: [0, null, false, "4"] }),
		{ op: "poly", coeff: [0, 0, 12] }
	);
});

test("neg scalar and add differentiation preserve simplification behavior", () => {
	assert.deepEqual(
		canonical.symDiff({
			op: "neg",
			arg: { op: "poly", coeff: [1, 2, 3] },
		}),
		{ op: "poly", coeff: [-2, -6] }
	);
	assert.deepEqual(
		canonical.symDiff({
			op: "sc",
			value: "2",
			arg: { op: "poly", coeff: [1, 3] },
		}),
		{ op: "poly", coeff: [6] }
	);
	assert.deepEqual(
		canonical.symDiff({
			op: "add",
			args: [
				{ op: "poly", coeff: [1, 2] },
				{ op: "const", value: 3 },
				{ op: "poly", coeff: [0, 4, 5] },
			],
		}),
		{ op: "poly", coeff: [6, 10] }
	);
});

test("sin and cos rules preserve defaults coercion sign and node shapes", () => {
	assert.deepEqual(canonical.symDiff({ op: "sin" }), {
		op: "sc",
		value: 1,
		arg: { op: "cos", m: 1, n: 0 },
	});
	assert.deepEqual(canonical.symDiff({ op: "sin", m: "2", n: "-1" }), {
		op: "sc",
		value: 2,
		arg: { op: "cos", m: 2, n: -1 },
	});
	assert.deepEqual(canonical.symDiff({ op: "cos", m: "3", n: "4" }), {
		op: "sc",
		value: -3,
		arg: { op: "sin", m: 3, n: 4 },
	});
	assert.deepEqual(canonical.symDiff({ op: "cos", m: 0, n: 2 }), {
		op: "sc",
		value: -0,
		arg: { op: "sin", m: 0, n: 2 },
	});
});

test("nested derivative results evaluate to the expected numeric derivative", () => {
	const expression = {
		op: "add",
		args: [
			{ op: "poly", coeff: [1, 2, 3] },
			{ op: "sin", m: 2, n: 0.5 },
			{ op: "sc", value: -3, arg: { op: "cos", m: 4, n: 1 } },
		],
	};
	const derivative = canonical.symDiff(expression);
	const evaluate = makeEvalFn(derivative);
	for (const u of [0, 0.25, 1]) {
		const expected =
			2 +
			6 * u +
			2 * Math.cos(2 * u + 0.5) +
			12 * Math.sin(4 * u + 1);
		assert.ok(Math.abs(evaluate(u) - expected) <= 1e-12);
	}
});

test("nonobject unsupported and malformed errors remain exact", () => {
	const cases = [
		["text", "symDiff: node must be object"],
		[{ op: "mul", args: [] }, "symDiff: unsupported op 'mul'"],
		[{ op: "ref", id: "A" }, "symDiff: unsupported op 'ref'"],
		[
			{ op: "sc", value: Number.POSITIVE_INFINITY, arg: { op: "sin" } },
			"simplify: sc.value must be finite",
		],
	];
	for (const [input, message] of cases) {
		assert.deepEqual(outcome(canonical, input), {
			error: { name: "Error", message },
		});
		assert.deepEqual(outcome(legacy, input), outcome(canonical, input));
	}
	for (const malformed of [
		{ op: "poly" },
		{ op: "add", args: {} },
	]) {
		assert.deepEqual(outcome(legacy, malformed), outcome(canonical, malformed));
		assert.equal(outcome(canonical, malformed).error?.name, "TypeError");
	}
});

test("symDiff does not mutate or retain aliases from supported inputs", () => {
	const expression = {
		op: "add",
		args: [
			{ op: "poly", coeff: [1, 2, 3] },
			{ op: "sin", m: 2, n: 1 },
		],
	};
	const before = structuredClone(expression);
	const result = canonical.symDiff(expression);
	assert.deepEqual(expression, before);
	assert.notStrictEqual(result, expression);
	assert.notStrictEqual(result.args, expression.args);
});

test("legacy and canonical results remain identical on independent fixtures", () => {
	const fixtures = [
		{ op: "poly", coeff: [1, 2, 3] },
		{ op: "neg", arg: { op: "sin", m: 3, n: 2 } },
		{
			op: "add",
			args: [
				{ op: "sc", value: 2, arg: { op: "cos", m: 4, n: 1 } },
				{ op: "poly", coeff: [0, 1] },
			],
		},
	];
	for (const fixture of fixtures) {
		assert.deepEqual(
			outcome(legacy, structuredClone(fixture)),
			outcome(canonical, structuredClone(fixture))
		);
	}
});
