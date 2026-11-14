import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { makeEvalFn } from "../../../src/aim-core/transition/ast/evalAst.js";
import { simplify } from "../../../src/aim-core/transition/ast/simplify.js";
import { symDiff } from "../../../src/aim-core/transition/ast/symDiff.js";
import { symInt } from "../../../src/aim-core/transition/ast/symInt.js";
import { createTransitionLibraryService } from "../../../src/services/transition-library/createTransitionLibraryService.js";

const ROOT = new URL("../../../", import.meta.url);
const builtIn = JSON.parse(await readFile(new URL("src/domain/transition/transitionLookup.json", ROOT), "utf8"));
const pristine = JSON.stringify(builtIn);
const make = () => createTransitionLibraryService({ catalogue: builtIn });
const near = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

const REFERENCE = {
	sinh: { f: Math.sinh, f1: Math.cosh, f2: Math.sinh },
	cosh: { f: Math.cosh, f1: Math.sinh, f2: Math.cosh },
	exp: { f: Math.exp, f1: Math.exp, f2: Math.exp },
};

test("mode 0 describes sinh, cosh and exp of m·x + n with f′ and f″", () => {
	const service = make();
	const m = 1.7; const n = -0.4;
	for (const [op, ref] of Object.entries(REFERENCE)) {
		const d = service.describeFunction({ value: { op, m, n }, interval: [0, 1], range: [-0.5, 1.5], count: 9 });
		assert.equal(d.ok, true, op);
		for (const s of d.samples) {
			const arg = m * s.x + n;
			assert.ok(near(s.f, ref.f(arg)), `${op} f at ${s.x}`);
			assert.ok(near(s.f1, m * ref.f1(arg)), `${op} f′ at ${s.x}`);
			assert.ok(near(s.f2, m * m * ref.f2(arg)), `${op} f″ at ${s.x}`);
		}
		assert.ok(near(d.frame.fa, ref.f(n)) && near(d.frame.fb, ref.f(m + n)), `${op} frame`);
		assert.equal(d.usableAsPiece, true, op);
	}
	// cosh is even: on a symmetric interval both ends are equal, no piece
	assert.equal(service.describeFunction({ value: { op: "cosh", m: 1, n: 0 }, interval: [-1, 1] }).usableAsPiece, false);
	// m and n default to 1 and 0
	assert.ok(near(service.describeFunction({ value: { op: "exp" }, interval: [0, 1], count: 3 }).samples[2].f, Math.E));
	assert.equal(service.describeFunction({ value: { op: "sinh", m: "x", n: 0 }, interval: [0, 1] }).code, "USER_LIBRARY_STRUCTURE_INVALID");
	assert.equal(JSON.stringify(builtIn), pristine, "the built-in catalogue is untouched");
});

test("the derivative of the integral is the function, and the integral starts at zero", () => {
	for (const op of Object.keys(REFERENCE)) {
		for (const [m, n] of [[2.5, 0.3], [-1.2, 0], [0, 0.7]]) {
			const node = { op, m, n };
			const integral = symInt(node);
			const I = makeEvalFn(simplify(integral));
			const back = makeEvalFn(symDiff(integral));
			const f = makeEvalFn(node);
			assert.ok(Math.abs(I(0)) < 1e-12, `${op} m=${m}: I(0) = 0`);
			for (const u of [0, 0.25, 0.6, 1]) assert.ok(near(back(u), f(u)), `${op} m=${m} at ${u}`);
			// against the closed form
			const F = m === 0 ? REFERENCE[op].f(n) : (antiderivative(op)(m + n) - antiderivative(op)(n)) / m;
			assert.ok(near(I(1), F), `${op} m=${m}: I(1)`);
		}
	}
});

function antiderivative(op) {
	return op === "sinh" ? Math.cosh : op === "cosh" ? Math.sinh : Math.exp;
}

test("sinh(x/ε) / sinh(1/ε) is a ramp from 0 to 1 that solves f − ε²·f″ = 0", () => {
	const service = make();
	const eps = 0.2;
	const d = service.describeFunction({ value: { op: "sinh", m: 1 / eps, n: 0 }, interval: [0, 1], count: 11 });
	const scale = Math.sinh(1 / eps);
	assert.ok(near(d.frame.fa, 0) && near(d.frame.fb / scale, 1));
	for (const s of d.samples) assert.ok(Math.abs(s.f - eps * eps * s.f2) / scale < 1e-12, `at ${s.x}`);
});

test("a stored sinh is offered as a function and builds a halfWave, alone and in a sum with a polynomial", () => {
	const service = make();
	const stored = service.putUserRecords([
		{ level: "simpleFcn", id: "MY_SINH", value: { op: "sinh", m: 3, n: 0 } },
		{ level: "protoFcn", id: "PROTO_MY_SINH", value: { op: "ref", id: "MY_SINH", crop: [0, 1] } },
		{ level: "halfWave", id: "HW_MY_SINH", value: { proto: "PROTO_MY_SINH", source: "kappa" } },
	]);
	assert.equal(stored.ok, true, stored.reason);
	assert.deepEqual(service.listSimpleFunctions().find((f) => f.id === "MY_SINH"), { id: "MY_SINH", value: { op: "sinh", m: 3, n: 0 }, origin: "user", interval: [0, 1] });

	const draft = service.describeDraft({ halfWave1: "HW_MY_SINH", halfWave2: "HW_MY_SINH", normLengthPartition: [0.5, 0, 0.5], count: 21 });
	assert.equal(draft.ok, true, draft.reason);
	assert.ok(draft.samples.every((s) => Number.isFinite(s.k)));
	assert.ok(near(draft.samples[0].k, 0) && near(draft.samples.at(-1).k, 1, 1e-9), "the transition runs from 0 to 1");

	// mode 1: factor · sinh plus a polynomial term, as curvature and as κ′ (integrated)
	const tree = { op: "add", args: [
		{ op: "mul", args: [{ op: "const", value: 0.5 }, { op: "ref", id: "MY_SINH", crop: [0, 1] }] },
		{ op: "ref", id: "IDENT", crop: [0, 1] },
	] };
	for (const source of ["kappa", "kappa1"]) {
		const hw = service.describeHalfWave({ proto: tree, source, count: 11 });
		assert.equal(hw.ok, true, `${source}: ${hw.reason}`);
	}
	assert.equal(JSON.stringify(builtIn), pristine, "the built-in catalogue is untouched");
});
