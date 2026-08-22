import assert from "node:assert/strict";
import test from "node:test";

import * as astBarrel from "../../../src/aim-core/transition/ast/index.js";
import * as canonical from "../../../src/aim-core/transition/ast/buildProtoAst.js";
import * as legacy from "../../../src/domain/transition/registry/ast/buildProtoAst.js";
import * as transition from "../../../src/aim-core/transition/index.js";
import * as root from "../../../src/aim-core/index.js";

const SIMPLE = {
	poly: { op: "poly", coeff: [1, 2, 3] },
	sin: { op: "sin", m: 2, n: 1 },
	cos: { op: "cos" },
	constant: { op: "const", value: "4", symbolic: "C" },
	pi: { op: "pi" },
	twoPi: { op: "2pi" },
};

function outcome(api, tree, simpleFcn = SIMPLE) {
	try {
		return { value: api.buildProtoAst(tree, simpleFcn) };
	} catch (error) {
		return { error: { name: error.name, message: error.message } };
	}
}

test("legacy canonical and barrels share one buildProtoAst authority", () => {
	assert.deepEqual(Object.keys(legacy), ["buildProtoAst"]);
	assert.deepEqual(Object.keys(canonical), ["buildProtoAst"]);
	for (const api of [legacy, astBarrel, transition, root]) {
		assert.strictEqual(api.buildProtoAst, canonical.buildProtoAst);
	}
});

test("direct const pi 2pi poly and trig nodes preserve exact shapes and coercions", () => {
	assert.deepEqual(canonical.buildProtoAst({ op: "const", value: "3" }, SIMPLE), {
		op: "const",
		value: 3,
	});
	assert.deepEqual(canonical.buildProtoAst({ op: "pi" }, SIMPLE), { op: "pi" });
	assert.deepEqual(canonical.buildProtoAst({ op: "2pi" }, SIMPLE), {
		op: "2pi",
	});
	assert.deepEqual(
		canonical.buildProtoAst({ op: "poly", coeff: ["1", 2, false] }, SIMPLE),
		{ op: "poly", coeff: [1, 2] }
	);
	assert.deepEqual(canonical.buildProtoAst({ op: "sin" }, SIMPLE), {
		op: "sin",
		m: 1,
		n: 0,
	});
	assert.deepEqual(
		canonical.buildProtoAst(
			{ op: "cos", m: "2", n: "-1" },
			SIMPLE
		),
		{ op: "cos", m: 2, n: -1 }
	);
});

test("explicit trig arguments retain affine simplification behavior", () => {
	assert.deepEqual(
		canonical.buildProtoAst(
			{ op: "sin", arg: { op: "poly", coeff: [1, 2] } },
			SIMPLE
		),
		{ op: "sin", m: 2, n: 1 }
	);
	assert.deepEqual(
		canonical.buildProtoAst(
			{ op: "cos", arg: { op: "const", value: 2 } },
			SIMPLE
		),
		{ op: "cos", m: 0, n: 2 }
	);
});

test("simpleFcn refs preserve default forward and reversed polynomial crops", () => {
	assert.deepEqual(
		canonical.buildProtoAst({ op: "ref", id: "poly" }, SIMPLE),
		{ op: "poly", coeff: [1, 2, 3] }
	);
	assert.deepEqual(
		canonical.buildProtoAst(
			{ op: "ref", id: "poly", crop: [1, 0] },
			SIMPLE
		),
		{ op: "poly", coeff: [6, -8, 3] }
	);
	assert.deepEqual(
		canonical.buildProtoAst(
			{ op: "ref", id: "poly", crop: ["0.25", "0.75"] },
			SIMPLE
		),
		{ op: "poly", coeff: [1.6875, 1.75, 0.75] }
	);
});

test("simpleFcn trig constant pi and 2pi refs preserve crop formulas and shapes", () => {
	assert.deepEqual(
		canonical.buildProtoAst(
			{ op: "ref", id: "sin", crop: [0.25, 0.75] },
			SIMPLE
		),
		{ op: "sin", m: 1, n: 1.5 }
	);
	assert.deepEqual(
		canonical.buildProtoAst(
			{ op: "ref", id: "cos", crop: [1, 0] },
			SIMPLE
		),
		{ op: "cos", m: -1, n: 1 }
	);
	assert.deepEqual(
		canonical.buildProtoAst({ op: "ref", id: "constant" }, SIMPLE),
		{ op: "const", value: 4, symbolic: "C" }
	);
	assert.deepEqual(canonical.buildProtoAst({ op: "ref", id: "pi" }, SIMPLE), {
		op: "pi",
	});
	assert.deepEqual(
		canonical.buildProtoAst({ op: "ref", id: "twoPi" }, SIMPLE),
		{ op: "2pi" }
	);
});

test("nested neg add sub mul div scalar and pow dispatch preserve order and simplification", () => {
	const fixtures = [
		[
			{ op: "neg", arg: { op: "poly", coeff: [1, 2] } },
			{ op: "poly", coeff: [-1, -2] },
		],
		[
			{
				op: "add",
				args: [
					{ op: "poly", coeff: [1, 2] },
					{ op: "const", value: 3 },
				],
			},
			{
				op: "add",
				args: [
					{ op: "poly", coeff: [1, 2] },
					{ op: "const", value: 3 },
				],
			},
		],
		[
			{
				op: "sub",
				a: { op: "const", value: 5 },
				b: { op: "const", value: 2 },
			},
			{ op: "const", value: 3 },
		],
		[
			{
				op: "mul",
				args: [
					{ op: "const", value: 2 },
					{ op: "poly", coeff: [1, 1] },
				],
			},
			{ op: "poly", coeff: [2, 2] },
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
			{
				op: "sc",
				value: "3",
				arg: { op: "poly", coeff: [1, 2] },
			},
			{ op: "poly", coeff: [3, 6] },
		],
		[
			{
				op: "pow",
				base: { op: "poly", coeff: [1, 1] },
				exp: { op: "const", value: 2 },
			},
			{ op: "poly", coeff: [1, 2, 1] },
		],
	];
	for (const [input, expected] of fixtures) {
		assert.deepEqual(canonical.buildProtoAst(input, SIMPLE), expected);
	}
});

test("alias fallbacks and empty argument defaults remain unchanged", () => {
	assert.deepEqual(
		canonical.buildProtoAst(
			{
				op: "sub",
				minuend: { op: "const", value: 9 },
				subtrahend: { op: "const", value: 4 },
			},
			SIMPLE
		),
		{ op: "const", value: 5 }
	);
	assert.deepEqual(canonical.buildProtoAst({ op: "add", args: null }, SIMPLE), {
		op: "const",
		value: 0,
	});
	assert.deepEqual(canonical.buildProtoAst({ op: "mul", args: null }, SIMPLE), {
		op: "const",
		value: 1,
	});
});

test("explicit validation and protoRef-disabled errors retain exact paths and text", () => {
	const cases = [
		[null, "proto: node is null/undefined"],
		["text", "proto: node must be object"],
		[{}, "proto: missing op"],
		[{ op: "poly", coeff: null }, "proto: poly.coeff must be array"],
		[{ op: "ref" }, "proto: ref.id missing"],
		[
			{ op: "ref", id: "missing" },
			"proto: ref 'missing' not found in simpleFcn (protoRef disabled)",
		],
		[
			{ op: "ref", id: "poly", crop: [0, Number.NaN] },
			"ref.crop entries must be finite",
		],
		[
			{ op: "sc", value: Number.POSITIVE_INFINITY, arg: { op: "pi" } },
			"proto: sc.value must be finite",
		],
		[
			{ op: "pow", base: { op: "pi" }, exp: 1.5 },
			"proto: pow.exp must be integer number or const",
		],
		[{ op: "unknown" }, "proto: unsupported op 'unknown'"],
	];
	for (const [input, message] of cases) {
		assert.deepEqual(outcome(canonical, input), {
			error: { name: "Error", message },
		});
		assert.deepEqual(outcome(legacy, input), outcome(canonical, input));
	}
});

test("simpleFcn validation and native malformed errors remain unchanged", () => {
	const badSimple = {
		trig: { op: "sin", m: Number.NaN, n: 0 },
		unsupported: { op: "add", args: [] },
		malformedPoly: { op: "poly", coeff: null },
	};
	assert.deepEqual(outcome(canonical, { op: "ref", id: "trig" }, badSimple), {
		error: { name: "Error", message: "simpleFcn trig m/n must be finite" },
	});
	assert.deepEqual(
		outcome(canonical, { op: "ref", id: "unsupported" }, badSimple),
		{
			error: { name: "Error", message: "simpleFcn: unsupported op 'add'" },
		}
	);
	assert.equal(
		outcome(canonical, { op: "ref", id: "malformedPoly" }, badSimple).error
			?.name,
		"TypeError"
	);
});

test("builder preserves input nonmutation and legacy canonical deep equality", () => {
	const tree = {
		op: "add",
		args: [
			{ op: "ref", id: 12, crop: [1, 0] },
			{ op: "sin", arg: { op: "poly", coeff: [1, 2] } },
		],
	};
	const simpleFcn = { 12: { op: "poly", coeff: [1, 2, 3] } };
	const treeBefore = structuredClone(tree);
	const simpleBefore = structuredClone(simpleFcn);
	assert.deepEqual(
		outcome(legacy, structuredClone(tree), structuredClone(simpleFcn)),
		outcome(canonical, structuredClone(tree), structuredClone(simpleFcn))
	);
	canonical.buildProtoAst(tree, simpleFcn);
	assert.deepEqual(tree, treeBefore);
	assert.deepEqual(simpleFcn, simpleBefore);
});
