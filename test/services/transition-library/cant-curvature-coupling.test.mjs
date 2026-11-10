import assert from "node:assert/strict";
import test from "node:test";

import {
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
