import assert from "node:assert/strict";
import test from "node:test";

import { makeEvalFn } from "../../../src/aim-core/transition/ast/evalAst.js";
import * as astBarrel from "../../../src/aim-core/transition/ast/index.js";
import * as canonical from "../../../src/aim-core/transition/ast/symInt.js";
import * as legacy from "../../../src/domain/transition/registry/ast/symInt.js";
import * as transition from "../../../src/aim-core/transition/index.js";
import * as root from "../../../src/aim-core/index.js";

function outcome(api, value) {
	try {
		return { value: api.symInt(value) };
	} catch (error) {
		return { error: { name: error.name, message: error.message } };
	}
}

test("legacy canonical and barrels share one symInt authority", () => {
	assert.deepEqual(Object.keys(legacy), ["symInt"]);
	assert.deepEqual(Object.keys(canonical), ["symInt"]);
	for (const api of [legacy, astBarrel, transition, root]) {
		assert.strictEqual(api.symInt, canonical.symInt);
	}
});

test("number const pi and 2pi preserve exact polynomial integral shapes", () => {
	assert.deepEqual(canonical.symInt(3), { op: "poly", coeff: [0, 3] });
	assert.deepEqual(canonical.symInt({ op: "const", value: "4" }), {
		op: "poly",
		coeff: [0, 4],
	});
	assert.deepEqual(canonical.symInt({ op: "pi" }), {
		op: "poly",
		coeff: [0, Math.PI],
	});
	assert.deepEqual(canonical.symInt({ op: "2pi" }), {
		op: "poly",
		coeff: [0, 2 * Math.PI],
	});
});

test("polynomial integration preserves coefficient coercion order and I zero", () => {
	assert.deepEqual(
		canonical.symInt({ op: "poly", coeff: ["2", 6, null, false] }),
		{ op: "poly", coeff: [0, 2, 3] }
	);
	assert.deepEqual(canonical.symInt({ op: "poly", coeff: [] }), {
		op: "poly",
		coeff: [],
	});
	assert.equal(makeEvalFn(canonical.symInt({ op: "poly", coeff: [2, 6] }))(0), 0);
});

test("sin and cos retain affine defaults coercion ordering and boundary constants", () => {
	assert.deepEqual(canonical.symInt({ op: "sin" }), {
		op: "add",
		args: [
			{ op: "sc", value: -1, arg: { op: "cos", m: 1, n: 0 } },
			{ op: "const", value: 1 },
		],
	});
	assert.deepEqual(canonical.symInt({ op: "cos", m: "2", n: "1" }), {
		op: "add",
		args: [
			{ op: "sc", value: 0.5, arg: { op: "sin", m: 2, n: 1 } },
			{ op: "const", value: -Math.sin(1) / 2 },
		],
	});
	for (const node of [
		{ op: "sin", m: 2, n: 1 },
		{ op: "cos", m: -3, n: 0.5 },
	]) {
		assert.ok(Math.abs(makeEvalFn(canonical.symInt(node))(0)) <= 1e-15);
	}
});

test("nonfinite and near-zero trig rates retain constant-law threshold behavior", () => {
	assert.deepEqual(canonical.symInt({ op: "sin", m: Number.NaN, n: 1 }), {
		op: "poly",
		coeff: [0, Math.sin(1)],
	});
	assert.deepEqual(canonical.symInt({ op: "cos", m: 1e-16, n: "2" }), {
		op: "poly",
		coeff: [0, Math.cos(2)],
	});
	assert.equal(canonical.symInt({ op: "sin", m: 1e-15, n: 0 }).op, "add");
});

test("neg scalar add and nested integration preserve simplification timing", () => {
	assert.deepEqual(
		canonical.symInt({
			op: "neg",
			arg: { op: "poly", coeff: [2, 6] },
		}),
		{ op: "poly", coeff: [-0, -2, -3] }
	);
	assert.deepEqual(
		canonical.symInt({
			op: "sc",
			value: "2",
			arg: { op: "poly", coeff: [1, 4] },
		}),
		{ op: "poly", coeff: [0, 2, 4] }
	);
	assert.deepEqual(
		canonical.symInt({
			op: "add",
			args: [
				{ op: "poly", coeff: [1, 2] },
				{ op: "const", value: 3 },
			],
		}),
		{ op: "poly", coeff: [0, 4, 1] }
	);
});

test("integrals evaluate to zero at the domain origin and differentiate numerically", () => {
	const expression = {
		op: "add",
		args: [
			{ op: "poly", coeff: [1, 2, 3] },
			{ op: "sin", m: 2, n: 0.5 },
			{ op: "sc", value: -3, arg: { op: "cos", m: 4, n: 1 } },
		],
	};
	const integral = makeEvalFn(canonical.symInt(expression));
	assert.ok(Math.abs(integral(0)) <= 1e-15);
	for (const u of [0.25, 1]) {
		const h = 1e-6;
		const numericDerivative = (integral(u + h) - integral(u - h)) / (2 * h);
		const expected =
			1 + 2 * u + 3 * u * u +
			Math.sin(2 * u + 0.5) -
			3 * Math.cos(4 * u + 1);
		assert.ok(Math.abs(numericDerivative - expected) <= 1e-8);
	}
});

test("null nonobject poly arg unsupported and malformed errors remain exact", () => {
	const cases = [
		[null, "symInt: node null"],
		["text", "symInt: node must be object"],
		[
			{ op: "poly", coeff: [1], arg: { op: "poly", coeff: [0, 1] } },
			"symInt: poly with arg not supported (should be composed earlier)",
		],
		[
			{ op: "mul", args: [] },
			"symInt: unsupported op 'mul' (expected sc + poly/trig/add/neg)",
		],
		[
			{ op: "pow", base: {}, exp: 2 },
			"symInt: unsupported op 'pow' (expected simplify to expand for poly)",
		],
		[{ op: "ref", id: "A" }, "symInt: unsupported op 'ref'"],
	];
	for (const [input, message] of cases) {
		assert.deepEqual(outcome(canonical, input), {
			error: { name: "Error", message },
		});
		assert.deepEqual(outcome(legacy, input), outcome(canonical, input));
	}
	assert.deepEqual(canonical.symInt({ op: "poly", coeff: {} }), {
		op: "poly",
		coeff: [],
	});
	for (const malformed of [{ op: "add", args: {} }]) {
		assert.deepEqual(outcome(legacy, malformed), outcome(canonical, malformed));
		assert.equal(outcome(canonical, malformed).error?.name, "TypeError");
	}
});

test("symInt preserves input nonmutation and existing result alias behavior", () => {
	const expression = {
		op: "add",
		args: [
			{ op: "poly", coeff: [1, 2, 3] },
			{ op: "sin", m: 2, n: 1 },
		],
	};
	const before = structuredClone(expression);
	const result = canonical.symInt(expression);
	assert.deepEqual(expression, before);
	assert.notStrictEqual(result, expression);
	assert.notStrictEqual(result.args, expression.args);
});

test("legacy and canonical outcomes remain identical on independent fixtures", () => {
	const fixtures = [
		3,
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
