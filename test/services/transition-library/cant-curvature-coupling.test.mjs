import assert from "node:assert/strict";
import test from "node:test";

import {
	DEFAULT_REQUIRED_SMOOTHNESS_ORDER,
	assessCouplingSuitability,
	cantFromCurvature,
	couplingEpsilon,
	curvatureFromCant,
} from "../../../src/services/transition-library/cantCurvatureCoupling.js";

// Ramp polynomial of degree 7 with f' = f'' = f''' = 0 at both ends.
const f7 = (x) => 35 * x ** 4 - 84 * x ** 5 + 70 * x ** 6 - 20 * x ** 7;
const f7d2 = (x) => 420 * x ** 2 - 1680 * x ** 3 + 2100 * x ** 4 - 840 * x ** 5;
const EPS = 0.134;

test("epsilon follows from reference height, end cant, radius and length", () => {
	assert.ok(Math.abs(couplingEpsilon() - Math.sqrt(1.8 * 0.1 * 1000) / 100) < 1e-15);
	assert.equal(couplingEpsilon({ length: 200 }), couplingEpsilon() / 2);
	assert.throws(() => couplingEpsilon({ radius: 0 }));
});

test("cant given: the curvature gets the counter-swerve", () => {
	const { samples } = curvatureFromCant({ cant: f7, cant2: f7d2 }, EPS, { count: 401 });
	const min = Math.min(...samples.map((s) => s.curvature));
	assert.ok(Math.abs(min + 0.0828) < 1e-3, String(min));
	assert.equal(samples[0].curvature, 0);
	assert.ok(Math.abs(samples.at(-1).curvature - 1) < 1e-12);
});

test("forward and reverse are inverse to each other", () => {
	const forward = curvatureFromCant({ cant: f7, cant2: f7d2 }, EPS, { count: 2001 });
	const k = (x) => f7(x) - EPS * EPS * f7d2(x);
	const reverse = cantFromCurvature(k, EPS, { count: 2001 });
	reverse.samples.forEach((sample, index) => assert.ok(Math.abs(sample.cant - forward.samples[index].cant) < 1e-5, `u=${sample.u}`));
	assert.ok(assessCouplingSuitability(reverse.endSlopes).suitable);
});

test("the end slope vanishes exactly at the epsilon the curvature was built for", () => {
	const k = (x) => f7(x) - EPS * EPS * f7d2(x);
	const slope = (eps) => cantFromCurvature(k, eps, { count: 4001 }).endSlopes.start;
	assert.ok(slope(0.08) < -0.2);
	assert.ok(Math.abs(slope(EPS)) < 1e-3);
	assert.ok(slope(0.2) > 0.2);
});

test("classical curvatures give ramps with kinked ends", () => {
	const clothoid = cantFromCurvature((x) => x, EPS);
	clothoid.samples.forEach((sample) => assert.ok(Math.abs(sample.cant - sample.u) < 1e-9));
	assert.ok(Math.abs(clothoid.endSlopes.start - 1) < 1e-6);
	const bloss = cantFromCurvature((x) => 3 * x * x - 2 * x ** 3, EPS, { count: 4001 });
	const analytic = 6 * EPS / Math.tanh(1 / (2 * EPS)) - 12 * EPS * EPS;
	assert.ok(Math.abs(bloss.endSlopes.start - analytic) < 1e-3, `${bloss.endSlopes.start} vs ${analytic}`);
	assert.ok(Math.abs(bloss.endSlopes.end - analytic) < 1e-3);
	assert.equal(assessCouplingSuitability(bloss.endSlopes).suitable, false);
});

test("epsilon zero means cant and curvature coincide", () => {
	const result = cantFromCurvature((x) => 3 * x * x - 2 * x ** 3, 0, { count: 11 });
	result.samples.forEach((sample) => assert.ok(Math.abs(sample.cant - sample.curvature) < 1e-12));
});

// --- smoothness of the ramp ends up to f''' -------------------------------

const ramp = (f, f1, f2) => curvatureFromCant({ cant: f, cant1: f1, cant2: f2 }, 0.1, { count: 401 });
const judge = (result, options = {}) => assessCouplingSuitability(result.endSlopes, { endDerivatives: result.endDerivatives, peaks: result.peaks, ...options });

test("a declared ramp is judged by f', f'' and f''' at its ends", () => {
	// Bloss 3x² − 2x³: tangential, but f'' jumps by ±6 and f''' is −12.
	const bloss = ramp((x) => 3 * x * x - 2 * x ** 3, (x) => 6 * x - 6 * x * x, (x) => 6 - 12 * x);
	assert.ok(Math.abs(bloss.endDerivatives.second.start - 6) < 1e-12);
	assert.ok(Math.abs(bloss.endDerivatives.second.end + 6) < 1e-12);
	assert.ok(Math.abs(bloss.endDerivatives.third.start + 12) < 1e-6);
	assert.equal(judge(bloss).order, 1);
	assert.equal(DEFAULT_REQUIRED_SMOOTHNESS_ORDER, 2);
	assert.equal(judge(bloss).suitable, false, "the patent's minimum asks for f'' = 0");
	assert.equal(judge(bloss, { requiredOrder: 1 }).suitable, true);

	// Quintic 10x³ − 15x⁴ + 6x⁵: f' = f'' = 0, f'''(0) = 60.
	const quintic = ramp((x) => 10 * x ** 3 - 15 * x ** 4 + 6 * x ** 5, (x) => 30 * x * x - 60 * x ** 3 + 30 * x ** 4, (x) => 60 * x - 180 * x * x + 120 * x ** 3);
	assert.ok(Math.abs(quintic.endDerivatives.third.start - 60) < 0.01);
	assert.equal(judge(quintic).order, 2);
	assert.equal(judge(quintic).suitable, true);
	assert.equal(judge(quintic, { requiredOrder: 3 }).suitable, false);

	// Septic f7: all three vanish.
	const septic = ramp(f7, (x) => 140 * x ** 3 - 420 * x ** 4 + 420 * x ** 5 - 140 * x ** 6, (x) => 420 * x * x - 1680 * x ** 3 + 2100 * x ** 4 - 840 * x ** 5);
	const verdict = judge(septic, { requiredOrder: 3 });
	assert.equal(verdict.order, 3);
	assert.equal(verdict.suitable, true);
	assert.deepEqual(verdict.checks.map((check) => [check.order, check.ok]), [[1, true], [2, true], [3, true]]);
	// f'' and f''' are measured against their own size on the ramp.
	assert.ok(verdict.checks[1].limit > 0.02 && verdict.checks[2].limit > verdict.checks[1].limit);
});

test("with curvature given, f'' follows from the equation and f''' from the end slope", () => {
	const eps = 0.134;
	const k = (x) => 3 * x * x - 2 * x ** 3;
	const result = cantFromCurvature(k, eps, { count: 2001 });
	// k hits 0 and 1, so f'' = (f − k)/ε² is zero at both ends …
	assert.equal(result.endDerivatives.second.start, 0);
	assert.equal(result.endDerivatives.second.end, 0);
	// … and f''' = (f' − k')/ε² with k' = 0 there.
	const expected = result.endSlopes.start / (eps * eps);
	assert.ok(Math.abs(result.endDerivatives.third.start - expected) / expected < 0.01, `${result.endDerivatives.third.start} vs ${expected}`);
	const verdict = judge(result);
	assert.equal(verdict.order, 0, "the kink in f' already ends the count");
	assert.equal(verdict.checks[1].ok, true);
	assert.equal(verdict.suitable, false);
});

test("without the higher derivatives the verdict is the end-slope verdict as before", () => {
	const verdict = assessCouplingSuitability({ start: 0.001, end: -0.002 });
	assert.equal(verdict.suitable, true);
	assert.equal(verdict.order, 1);
	assert.equal(verdict.requiredOrder, 1);
	assert.equal(verdict.checks.length, 1);
	assert.equal(assessCouplingSuitability({ start: 0.5, end: 0 }).suitable, false);
	assert.equal(assessCouplingSuitability({ start: 0, end: 0 }, { requiredOrder: "x" }).requiredOrder, 1);
});
