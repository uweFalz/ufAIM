import assert from "node:assert/strict";
import test from "node:test";

// The length tier under the corridor, made reproducible (2026-11-12): the
// corridor's curvature stays in the model while the row is not held, the
// filter's ceiling is the corridor's own width, a verdict that ends the solve
// closes to the feasibility the caller asked for, and a length that has
// settled beside the constraints counts as settled. Measured on the corpus in
// docs/app/architecture/AXTRAN2_LENGTH_TIER_STABILITY_2026-11-12.md; these are
// the same statements on scenarios that need no corpus.

const BASE = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const OPTIM = new URL("../../src/lib/math/optim/", import.meta.url);
const { solveAlignmentProblem } = await import(new URL("AlignmentSQPSolver.js", BASE));
const { solveAlignmentLexicographic, DEFAULT_TIERS } = await import(new URL("AlignmentLexicographicSolver.js", BASE));
const { solveSQP } = await import(new URL("sqp/solveSQP.js", OPTIM));
const { createNineElementScenario } = await import(new URL("fixtures/nineElementScenario.mjs", import.meta.url));

const START = { startLengths: [200, 92, 298, 88, 152, 82, 258, 78, 180], startCurvatures: [1 / 695, -1 / 905] };
const order = (scenario, solver = {}, maxIterations = 400) => solveAlignmentLexicographic({
	problem: scenario.problem, buildAlignment: scenario.buildAlignment, analyticJacobian: scenario.analyticJacobian,
	tiers: DEFAULT_TIERS, maxIterations, solver,
});
const tier = (run) => run.phases.find((phase) => phase.label === "tier-1");
const worst = (run) => tier(run).diagnostics.history.reduce((most, entry) => Math.max(most, Number.isFinite(entry.violation) ? entry.violation : 0), 0);

test("the length tier does not leave the corridor by more than the corridor's own width", () => {
	const scenario = createNineElementScenario({ pointCount: 12, ...START });
	const before = order(scenario, { corridorCurvature: "multiplier", filterCeiling: 100 });
	const now = order(scenario);
	// what it was: the second step runs out of the corridor, rms 3 and more
	assert.ok(worst(before) > 5, `the model without the row's curvature walked out to a violation of ${worst(before)}`);
	// the row is rms^2 - 1: a violation of one is rms 1.41
	assert.ok(worst(now) <= 1, `violation ${worst(now)}`);
	assert.equal(now.status, "converged");
	assert.ok(tier(now).ok, tier(now).status);
	// and it is the same length, to the millimetre the settled rule promises
	assert.equal(before.status, "converged");
	assert.ok(Math.abs(tier(now).diagnostics.accumulatedLength - tier(before).diagnostics.accumulatedLength) < 1e-3,
		`${tier(now).diagnostics.accumulatedLength} against ${tier(before).diagnostics.accumulatedLength}`);
});

test("with a one-sided Zwangspunkt beside the corridor the tier ends where it has settled, whatever the last digit of the target", () => {
	// With the curvature kept from the start - a weight of one before any
	// subproblem had held the corridor's row - the tier stood at its answer
	// from step 127, crept on a few 1e-7 outside the corridor and left it at
	// 143: three of six runs lost their budget. Kept only once returned, it
	// ends at 69.
	const lengths = [];
	for (const eps of [0, 1e-10, -1e-10]) {
		const mast = createNineElementScenario({ pointCount: 12, ...START, boundPoints: [{ name: "Mast", fraction: 0.45, clearance: 2.0, target: 2.2 + eps, enforcement: "at-least" }] });
		const run = order(mast);
		assert.equal(run.status, "converged", `target 2.2 ${eps >= 0 ? "+" : "-"} ${Math.abs(eps)}: ${run.status}, tier ${tier(run).status}`);
		const d = tier(run).diagnostics;
		assert.ok(d.iterations < 200, `${d.iterations} steps`);
		assert.ok(d.endPoseDistance <= 1e-8, `end pose ${d.endPoseDistance} m`);
		assert.ok(d.boundPointResiduals[0].violation <= 1e-6, `Zwangspunkt ${d.boundPointResiduals[0].violation} m`);
		lengths.push(d.accumulatedLength);
	}
	assert.ok(Math.max(...lengths) - Math.min(...lengths) < 1e-3, `lengths ${lengths.join(", ")}`);
});

test("the curvature rule is an option with two values", () => {
	const scenario = createNineElementScenario({ pointCount: 12, ...START });
	assert.throws(() => solveAlignmentProblem({
		problem: scenario.problem, buildAlignment: scenario.buildAlignment, analyticJacobian: scenario.analyticJacobian,
		objective: "accumulated-length", corridor: true, corridorCurvature: "sometimes",
	}), (error) => error.code === "INVALID_OPTION");
});

// f = x0 over x0 >= 0, with x1 held to 1e4 by an equality: the start is the
// answer except that the equality stands 1e-7 open, inside the solve's
// relative feasibility (1e-9 of the point) and outside what a caller may ask
const pinned = (objectiveSettled) => solveSQP({
	x0: [0, 1e4 + 1e-7],
	lower: [0, -Infinity],
	upper: [Infinity, Infinity],
	evaluate: (x) => ({ f: x[0], gradF: [1, 0], h: [x[1] - 1e4], Jh: [[0, 1]] }),
	stepTolerance: 1e-3,
	...(objectiveSettled ? { objectiveSettled } : {}),
});

test("a verdict that ends the solve closes to the feasibility the caller asked for", () => {
	const plain = pinned(null);
	assert.equal(plain.status, "stationary");
	assert.ok(Math.abs(plain.x[1] - 1e4) > 5e-8, "without the ask the point is left where the relative tolerance accepts it");
	const asked = pinned({ steps: 20, absolute: 1e-3, feasibility: 1e-9 });
	assert.equal(asked.status, "stationary");
	assert.ok(Math.abs(asked.x[1] - 1e4) <= 1e-9, `the equality stands ${Math.abs(asked.x[1] - 1e4)} open`);
	assert.equal(asked.x[0], 0);
});

test("a length that has settled beside the constraints counts as settled", () => {
	// x0 sits on its bound from the start; the equality stands 5e-6 open and
	// the region lets a step close 1e-6, then 2e-6, then the rest. Held to the
	// solve's own feasibility the window opens when the equality has closed;
	// with `within` the steps beside it count, and the closure does the rest.
	const creep = (objectiveSettled) => solveSQP({
		x0: [2, 1e4 + 5e-6],
		lower: [2, -Infinity],
		upper: [Infinity, Infinity],
		evaluate: (x) => ({ f: x[0], gradF: [1, 0], h: [x[1] - 1e4], Jh: [[0, 1]] }),
		feasibilityTolerance: 1e-12,
		trustRadius: 1e-6,
		maxIterations: 60,
		objectiveSettled,
	});
	const strict = creep({ steps: 1, absolute: 1e-6, feasibility: 1e-10 });
	const within = creep({ steps: 1, absolute: 1e-6, feasibility: 1e-10, within: 1e-5 });
	assert.ok(strict.ok && within.ok, `${strict.status} / ${within.status}`);
	assert.equal(within.reason, "objective_settled");
	assert.equal(within.iterations, 1, "two points beside the constraint fill a window of one step");
	assert.ok(strict.iterations > within.iterations, `${strict.iterations} against ${within.iterations}`);
	assert.ok(Math.abs(within.x[1] - 1e4) <= 1e-10, `the equality stands ${Math.abs(within.x[1] - 1e4)} open`);
	assert.equal(within.x[0], 2);
});
