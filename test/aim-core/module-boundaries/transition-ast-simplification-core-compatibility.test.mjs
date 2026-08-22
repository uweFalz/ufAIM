import assert from "node:assert/strict";
import test from "node:test";

import * as canonical from "../../../src/aim-core/transition/ast/simplify.js";
import * as astBarrel from "../../../src/aim-core/transition/ast/index.js";
import * as legacy from "../../../src/domain/transition/registry/ast/simplify.js";
import * as transition from "../../../src/aim-core/transition/index.js";
import * as root from "../../../src/aim-core/index.js";

const SIMPLIFY_API = [
	"mkAdd",
	"mkConst",
	"mkCos",
	"mkDiv",
	"mkMul",
	"mkNeg",
	"mkPoly",
	"mkSc",
	"mkSin",
	"mkSub",
	"simplify",
];

function outcome(api, value) {
	try {
		return { value: api.simplify(value) };
	} catch (error) {
		return { error: { name: error.name, message: error.message } };
	}
}

test("legacy canonical and barrels share one simplification authority", () => {
	assert.deepEqual(Object.keys(legacy).sort(), SIMPLIFY_API);
	assert.deepEqual(Object.keys(canonical).sort(), SIMPLIFY_API);
	for (const api of [legacy, astBarrel, transition, root]) {
		for (const name of SIMPLIFY_API) {
			assert.strictEqual(api[name], canonical[name], name);
		}
	}
});

test("constructors preserve exact defaults coercions shapes and references", () => {
	const coeff = [1, 2];
	const args = [{ op: "pi" }];
	const arg = { op: "cos" };
	assert.deepEqual(canonical.mkPoly(coeff), { op: "poly", coeff: [1, 2] });
	assert.notStrictEqual(canonical.mkPoly(coeff).coeff, coeff);
	assert.deepEqual(canonical.mkSin(), { op: "sin", m: 1, n: 0 });
	assert.deepEqual(canonical.mkSin("2", null), { op: "sin", m: 2, n: 0 });
	assert.deepEqual(canonical.mkCos("3", "-1"), { op: "cos", m: 3, n: -1 });
	assert.deepEqual(canonical.mkAdd(args), { op: "add", args });
	assert.strictEqual(canonical.mkAdd(args).args, args);
	assert.strictEqual(canonical.mkMul(args).args, args);
	assert.strictEqual(canonical.mkNeg(arg).arg, arg);
	assert.deepEqual(canonical.mkSub(arg, args[0]), {
		op: "sub",
		minuend: arg,
		subtrahend: args[0],
	});
	assert.deepEqual(canonical.mkDiv(arg, args[0]), {
		op: "div",
		dividend: arg,
		divisor: args[0],
	});
	assert.strictEqual(canonical.mkSc("2", arg).arg, arg);
	assert.deepEqual(canonical.mkSc("2", arg), { op: "sc", value: 2, arg });
	assert.deepEqual(canonical.mkConst("4", "PI"), {
		op: "const",
		value: 4,
		symbolic: "PI",
	});
	assert.deepEqual(canonical.mkConst("4", ""), { op: "const", value: 4 });
});

test("atoms polynomials and trig normalization preserve exact outputs", () => {
	const cases = [
		[null, null],
		[7, 7],
		["x", "x"],
		[{ op: "const", value: "2", symbolic: "C" }, { op: "const", value: 2, symbolic: "C" }],
		[{ op: "pi", extra: true }, { op: "pi" }],
		[{ op: "2pi", extra: true }, { op: "2pi" }],
		[{ op: "poly", coeff: ["1", "0", Number.NaN, 0] }, { op: "poly", coeff: [1] }],
		[{ op: "sin" }, { op: "sin", m: 1, n: 0 }],
		[{ op: "cos", m: "2", n: "-1" }, { op: "cos", m: 2, n: -1 }],
		[
			{ op: "sin", arg: { op: "poly", coeff: [2, 3] } },
			{ op: "sin", m: 3, n: 2 },
		],
		[
			{
				op: "cos",
				arg: {
					op: "add",
					args: [
						{ op: "const", value: 2 },
						{ op: "poly", coeff: [0, 3] },
					],
				},
			},
			{ op: "cos", m: 3, n: 2 },
		],
	];
	for (const [input, expected] of cases) {
		assert.deepEqual(canonical.simplify(input), expected);
		assert.deepEqual(outcome(legacy, input), outcome(canonical, input));
	}
});

test("add neg scalar and multiplication folding preserve order and shapes", () => {
	assert.deepEqual(canonical.simplify({ op: "add", args: [] }), {
		op: "const",
		value: 0,
	});
	assert.deepEqual(
		canonical.simplify({
			op: "add",
			args: [
				{ op: "sin" },
				{ op: "const", value: 2 },
				{ op: "poly", coeff: [1, 2] },
				{ op: "const", value: 3 },
				{ op: "poly", coeff: [4, -2] },
				{ op: "cos" },
			],
		}),
		{
			op: "add",
			args: [
				{ op: "poly", coeff: [5] },
				{ op: "const", value: 5 },
				{ op: "sin", m: 1, n: 0 },
				{ op: "cos", m: 1, n: 0 },
			],
		}
	);
	assert.deepEqual(
		canonical.simplify({ op: "neg", arg: { op: "poly", coeff: [1, -2] } }),
		{ op: "poly", coeff: [-1, 2] }
	);
	assert.deepEqual(
		canonical.simplify({
			op: "mul",
			args: [
				{ op: "const", value: 2 },
				{ op: "poly", coeff: [1, 1] },
				{ op: "poly", coeff: [1, -1] },
			],
		}),
		{ op: "poly", coeff: [2, 0, -2] }
	);
	assert.deepEqual(
		canonical.simplify({
			op: "mul",
			args: [
				{ op: "sc", value: 2, arg: { op: "sin" } },
				{ op: "cos" },
			],
		}),
		{
			op: "sc",
			value: 2,
			arg: {
				op: "mul",
				args: [
					{ op: "sin", m: 1, n: 0 },
					{ op: "cos", m: 1, n: 0 },
				],
			},
		}
	);
});

test("sub div pow diff int and fallthrough rewrites remain exact", () => {
	const cases = [
		[
			{
				op: "sub",
				minuend: { op: "poly", coeff: [3, 2] },
				subtrahend: { op: "poly", coeff: [1, 1] },
			},
			{ op: "poly", coeff: [2, 1] },
		],
		[
			{
				op: "div",
				dividend: { op: "poly", coeff: [2, 4] },
				divisor: { op: "const", value: 2 },
			},
			{ op: "poly", coeff: [1, 2] },
		],
		[
			{ op: "pow", base: { op: "poly", coeff: [1, 1] }, exp: 3 },
			{ op: "poly", coeff: [1, 3, 3, 1] },
		],
		[
			{
				op: "pow",
				base: { op: "sin" },
				exp: { op: "const", value: "2" },
			},
			{ op: "pow", base: { op: "sin", m: 1, n: 0 }, exp: 2 },
		],
		[
			{ op: "diff", arg: { op: "const", value: "2" } },
			{ op: "diff", arg: { op: "const", value: 2 } },
		],
		[
			{ op: "int", arg: { op: "poly", coeff: [1, 0] } },
			{ op: "int", arg: { op: "poly", coeff: [1] } },
		],
	];
	for (const [input, expected] of cases) {
		assert.deepEqual(canonical.simplify(input), expected);
	}
	const unknown = { op: "future", payload: { keep: true } };
	assert.strictEqual(canonical.simplify(unknown), unknown);
});

test("invalid inputs preserve exact Error types and messages", () => {
	const cases = [
		[{ op: "poly" }, "simplify: poly.coeff must be array"],
		[
			{ op: "sc", value: Number.NaN, arg: { op: "sin" } },
			"simplify: sc.value must be finite",
		],
		[
			{
				op: "mul",
				args: [
					{ op: "const", value: Number.MAX_VALUE },
					{ op: "const", value: Number.MAX_VALUE },
				],
			},
			"simplify: mul constant overflow/NaN",
		],
		[
			{
				op: "div",
				dividend: { op: "const", value: 1 },
				divisor: { op: "const", value: 0 },
			},
			"simplify: div by zero/NaN",
		],
		[
			{ op: "pow", base: { op: "poly", coeff: [1] }, exp: "2" },
			"simplify: pow.exp must be number or const",
		],
		[
			{ op: "pow", base: { op: "poly", coeff: [1] }, exp: Number.NaN },
			"simplify: pow.exp must be finite",
		],
		[
			{ op: "pow", base: { op: "poly", coeff: [1] }, exp: 1.5 },
			"simplify: pow.exp must be integer",
		],
		[
			{ op: "pow", base: { op: "poly", coeff: [1] }, exp: -1 },
			"simplify: polyPow exp must be >= 0",
		],
		[
			{ op: "sin", arg: { op: "poly", coeff: [0, 1, 2] } },
			"simplify: sin.arg must be affine in u (use crop/reparam on ref)",
		],
	];
	for (const [input, message] of cases) {
		assert.deepEqual(outcome(canonical, input), {
			error: { name: "Error", message },
		});
		assert.deepEqual(outcome(legacy, input), outcome(canonical, input));
	}
});

test("reference aliasing and input mutation behavior remain exact", () => {
	const ref = { op: "ref", id: "A" };
	assert.strictEqual(canonical.simplify(ref), ref);
	const args = [{ op: "const", value: 1 }];
	assert.strictEqual(canonical.mkAdd(args).args, args);
	const poly = { op: "poly", coeff: ["1", "0", "2"] };
	const before = structuredClone(poly);
	const result = canonical.simplify(poly);
	assert.deepEqual(poly, before);
	assert.notStrictEqual(result, poly);
	assert.notStrictEqual(result.coeff, poly.coeff);
});

test("legacy and canonical operations remain identical on independent fixtures", () => {
	const fixtures = [
		{ op: "add", args: [{ op: "const", value: 2 }, { op: "const", value: 3 }] },
		{ op: "mul", a: { op: "poly", coeff: [1, 1] }, b: { op: "const", value: 2 } },
		{ op: "cos", arg: { op: "sc", value: 2, arg: { op: "poly", coeff: [1, 3] } } },
		{ op: "pow", base: { op: "poly", coeff: [1, 2] }, exp: 0 },
	];
	for (const fixture of fixtures) {
		assert.deepEqual(
			outcome(legacy, structuredClone(fixture)),
			outcome(canonical, structuredClone(fixture))
		);
	}
});
