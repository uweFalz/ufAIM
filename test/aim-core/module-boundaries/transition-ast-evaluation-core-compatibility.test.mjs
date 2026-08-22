import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/transition/ast/evalAst.js";
import * as astBarrel from "../../../src/aim-core/transition/ast/index.js";
import * as legacy from "../../../src/domain/transition/registry/ast/evalAst.js";
import * as transition from "../../../src/aim-core/transition/index.js";
import * as root from "../../../src/aim-core/index.js";

function evaluateThroughBoth(expr, inputs) {
	const legacyFn = legacy.makeEvalFn(expr);
	const canonicalFn = canonical.makeEvalFn(expr);
	return inputs.map((input) => [legacyFn(input), canonicalFn(input)]);
}

test("legacy canonical and barrel AST exports share one function authority", () => {
	assert.deepEqual(Object.keys(legacy).sort(), Object.keys(canonical).sort());
	for (const api of [legacy, astBarrel, transition, root]) {
		assert.strictEqual(api.makeEvalFn, canonical.makeEvalFn);
	}
});

test("all supported AST operations retain deeply equal numeric behavior", () => {
	const expressions = [
		null,
		2,
		"text",
		{ op: "const", value: "3.5" },
		{ op: "pi" },
		{ op: "2pi" },
		{ op: "poly", coeff: [1, 0, 2] },
		{ op: "poly", coeff: [1, null, 2] },
		{ op: "sin" },
		{ op: "sin", m: "2", n: "0.5" },
		{ op: "cos" },
		{ op: "cos", m: "3", n: "-1" },
		{ op: "neg", arg: { op: "const", value: 4 } },
		{ op: "sc", value: "2", arg: { op: "poly", coeff: [1, 1] } },
		{ op: "add", args: [] },
		{ op: "add", args: [{ op: "const", value: 2 }, { op: "pi" }] },
		{ op: "mul", args: [] },
		{ op: "mul", args: [{ op: "const", value: 2 }, { op: "poly", coeff: [1, 1] }] },
		{ op: "div", dividend: { op: "const", value: 1 }, divisor: { op: "const", value: 0 } },
		{ op: "pow", base: { op: "poly", coeff: [1, 1] }, exp: "2" },
		{
			op: "add",
			args: [
				{ op: "sin", m: 2, n: 1 },
				{
					op: "mul",
					args: [
						{ op: "const", value: 3 },
						{ op: "pow", base: { op: "poly", coeff: [0, 1] }, exp: 2 },
					],
				},
			],
		},
	];
	for (const expression of expressions) {
		for (const [legacyValue, canonicalValue] of evaluateThroughBoth(
			expression,
			[0, "0.5", 2]
		)) {
			assert.ok(
				Object.is(legacyValue, canonicalValue) ||
					(Number.isNaN(legacyValue) && Number.isNaN(canonicalValue))
			);
		}
	}
});

test("malformed supported-node behavior remains identical", () => {
	for (const expression of [
		{ op: "poly" },
		{ op: "neg" },
		{ op: "div" },
		{ op: "pow" },
	]) {
		const runLegacy = () => legacy.makeEvalFn(expression)(1);
		const runCanonical = () => canonical.makeEvalFn(expression)(1);
		let legacyOutcome;
		let canonicalOutcome;
		try {
			legacyOutcome = { value: runLegacy() };
		} catch (error) {
			legacyOutcome = { name: error.name, message: error.message };
		}
		try {
			canonicalOutcome = { value: runCanonical() };
		} catch (error) {
			canonicalOutcome = { name: error.name, message: error.message };
		}
		assert.deepEqual(canonicalOutcome, legacyOutcome);
	}
});

test("unsupported operation preserves exact Error type and message", () => {
	const expression = { op: "future-op" };
	assert.throws(
		() => canonical.makeEvalFn(expression)(0),
		(error) =>
			error instanceof Error &&
			error.message === "evalAst: unsupported op 'future-op'"
	);
	assert.throws(
		() => legacy.makeEvalFn(expression)(0),
		(error) =>
			error instanceof Error &&
			error.message === "evalAst: unsupported op 'future-op'"
	);
});

test("evaluation coerces u through Number and preserves operand order", () => {
	const expression = {
		op: "div",
		dividend: { op: "poly", coeff: [0, 2] },
		divisor: { op: "poly", coeff: [1, 1] },
	};
	assert.equal(canonical.makeEvalFn(expression)("3"), 1.5);
	assert.equal(
		canonical.makeEvalFn({
			op: "pow",
			base: { op: "const", value: -2 },
			exp: 3,
		})(0),
		-8
	);
});

test("closure retains the original AST reference", () => {
	const expression = { op: "const", value: 2 };
	const legacyFn = legacy.makeEvalFn(expression);
	const canonicalFn = canonical.makeEvalFn(expression);
	expression.value = 7;
	assert.equal(legacyFn(0), 7);
	assert.equal(canonicalFn(0), 7);
});

test("evaluation does not mutate AST inputs", () => {
	const expression = {
		op: "add",
		args: [
			{ op: "poly", coeff: [1, 2, 3] },
			{ op: "sin", m: 2, n: 1 },
		],
	};
	const before = structuredClone(expression);
	canonical.makeEvalFn(expression)("0.5");
	assert.deepEqual(expression, before);
});
