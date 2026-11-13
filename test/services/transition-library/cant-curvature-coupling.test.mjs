import assert from "node:assert/strict";
import test from "node:test";

import {
	DEFAULT_REQUIRED_SMOOTHNESS_ORDER,
	assessCouplingSuitability,
	cantFromCurvature,
	couplingEpsilon,
	couplingGeometry,
	curvatureFromCant,
} from "../../../src/services/transition-library/cantCurvatureCoupling.js";

// Ramp polynomial of degree 7 with f' = f'' = f''' = 0 at both ends.
const f7 = (x) => 35 * x ** 4 - 84 * x ** 5 + 70 * x ** 6 - 20 * x ** 7;
const f7d2 = (x) => 420 * x ** 2 - 1680 * x ** 3 + 2100 * x ** 4 - 840 * x ** 5;
const EPS = 0.134;

test("epsilon follows from reference height, end cant, radius and length", () => {
	// sin(psiE) = cant / rail base, so psiE = asin(0.1), not 0.1
	assert.ok(Math.abs(couplingEpsilon() - Math.sqrt(1.8 * Math.asin(0.1) * 1000) / 100) < 1e-15);
	assert.throws(() => couplingEpsilon({ endCant: 1.5 }), /smaller than railBase/);
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

// The exact expression, written out independently of the module.
function exactCurvature(f, f1, f2, { epsilon, endAngle: a, offsetRatio: rho }) {
	const refEnd = 1 / (1 - rho * Math.sin(a)); // kappaRef at the end, times R
	const ref = refEnd * f;
	const d = rho * Math.sin(a * f); // kappaE * d
	const d2 = epsilon ** 2 * (f2 * Math.cos(a * f) - a * f1 ** 2 * Math.sin(a * f)); // R * d''
	return (ref - d2) / (1 + ref * d);
}
const f7d1 = (x) => 140 * x ** 3 - 420 * x ** 4 + 420 * x ** 5 - 140 * x ** 6;

test("the geometry of an assumption: epsilon, end angle, offset ratio", () => {
	const g = couplingGeometry({ referenceHeight: 1.8, endCant: 0.224, railBase: 1.5, radius: 1 / 1.75e-3, length: 200 });
	assert.ok(Math.abs(g.endAngle - Math.asin(0.224 / 1.5)) < 1e-15);
	assert.ok(Math.abs(g.offsetRatio - 1.8 * 1.75e-3) < 1e-15);
	assert.ok(Math.abs(g.epsilon ** 2 - (1.8 * g.endAngle) / (1.75e-3 * 200 ** 2)) < 1e-15);
});

test("exact expression, cant given: matches the written-out formula and still joins 0 and 1", () => {
	const g = couplingGeometry({ endCant: 0.224, radius: 1 / 1.75e-3, length: 200 });
	const exact = curvatureFromCant({ cant: f7, cant1: f7d1, cant2: f7d2 }, g.epsilon, { count: 201, endAngle: g.endAngle, offsetRatio: g.offsetRatio });
	assert.equal(exact.exact, true);
	for (const sample of exact.samples) {
		const want = exactCurvature(f7(sample.u), f7d1(sample.u), f7d2(sample.u), g);
		assert.ok(Math.abs(sample.curvature - want) < 1e-13, `u=${sample.u}`);
	}
	assert.ok(Math.abs(exact.samples[0].curvature) < 1e-12);
	assert.ok(Math.abs(exact.samples.at(-1).curvature - 1) < 1e-12);
	// against the small-angle form the difference is small but not zero
	const linear = curvatureFromCant({ cant: f7, cant1: f7d1, cant2: f7d2 }, g.epsilon, { count: 201 });
	assert.equal(linear.exact, false);
	const gap = Math.max(...exact.samples.map((sample, i) => Math.abs(sample.curvature - linear.samples[i].curvature)));
	assert.ok(gap > 1e-6 && gap < 5e-3, `gap ${gap}`);
});

test("exact expression: angle and offset zero give the small-angle form bit for bit", () => {
	const a = curvatureFromCant({ cant: f7, cant2: f7d2 }, EPS, { count: 101, endAngle: 0, offsetRatio: 0 });
	const b = curvatureFromCant({ cant: f7, cant2: f7d2 }, EPS, { count: 101 });
	assert.deepEqual(a.samples, b.samples);
	const k = (x) => 3 * x * x - 2 * x ** 3;
	assert.deepEqual(cantFromCurvature(k, EPS, { count: 101, endAngle: 0, offsetRatio: 0 }).samples, cantFromCurvature(k, EPS, { count: 101 }).samples);
});

test("exact expression, curvature given: the iteration converges and inverts the forward direction", () => {
	const g = couplingGeometry({ endCant: 0.224, radius: 1 / 1.75e-3, length: 200 });
	const shape = { count: 2001, endAngle: g.endAngle, offsetRatio: g.offsetRatio };
	const k = (x) => exactCurvature(f7(x), f7d1(x), f7d2(x), g);
	const reverse = cantFromCurvature(k, g.epsilon, shape);
	assert.equal(reverse.exact, true);
	assert.equal(reverse.converged, true);
	assert.ok(reverse.iterations >= 1 && reverse.iterations < 20, `iterations ${reverse.iterations}`);
	reverse.samples.forEach((sample) => assert.ok(Math.abs(sample.cant - f7(sample.u)) < 1e-5, `u=${sample.u}`));
	const verdict = assessCouplingSuitability(reverse.endSlopes, { endDerivatives: reverse.endDerivatives, peaks: reverse.peaks });
	assert.equal(verdict.suitable, true);
	assert.ok(verdict.order >= 2);
	// the small-angle solve of the same curvature misses the ramp by more
	const linear = cantFromCurvature(k, g.epsilon, { count: 2001 });
	const missLinear = Math.max(...linear.samples.map((sample) => Math.abs(sample.cant - f7(sample.u))));
	const missExact = Math.max(...reverse.samples.map((sample) => Math.abs(sample.cant - f7(sample.u))));
	assert.ok(missLinear > 10 * missExact, `${missLinear} against ${missExact}`);
});

test("exact expression: a steep cant angle still converges, an impossible one is refused", () => {
	const steep = cantFromCurvature((x) => 3 * x * x - 2 * x ** 3, 0.2, { count: 401, endAngle: 0.5, offsetRatio: 0.01 });
	assert.equal(steep.converged, true);
	assert.throws(() => cantFromCurvature((x) => x, 0.1, { endAngle: 2 }), /endAngle/);
});
