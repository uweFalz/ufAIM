import assert from "node:assert/strict";
import test from "node:test";

const BASE = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const {
	solveAlignmentLexicographic,
	AlignmentLexicographicError,
	BUDGETABLE_OBJECTIVES,
	DEFAULT_TIERS,
	tierZeroSatisfied,
} = await import(new URL("AlignmentLexicographicSolver.js", BASE));
const { solveAlignmentProblem } = await import(new URL("AlignmentSQPSolver.js", BASE));
const { createNineElementScenario } = await import(new URL("fixtures/nineElementScenario.mjs", import.meta.url));

// A short, cheap scenario: the driver's contract is orchestration, and the
// phases only have to run, not to reach their optima, for that to be testable.
const scenario = createNineElementScenario({
	pointCount: 6,
	startLengths: [200, 92, 298, 88, 152, 82, 258, 78, 180],
	startCurvatures: [1 / 695, -1 / 905],
});
const common = {
	problem: scenario.problem,
	buildAlignment: scenario.buildAlignment,
	analyticJacobian: scenario.analyticJacobian,
};
const HELD_LENGTH = 380;   // E0 and E8, both declared held
const total = (diagnostics) => HELD_LENGTH + diagnostics.accumulatedLength;

// A tier may only hand a budget down once it honours tier 0, and reaching that
// on this scenario costs more iterations than a test should spend. The budget
// mechanism is therefore exercised with the feasibility gate opened wide, and
// the gate itself is tested separately, on its own.
const OPEN_GATE = { feasibilityTolerance: Infinity };

// ---------------------------------------------------------------- declaration

test("the default order is the declared one: length first, points second", () => {
	assert.deepEqual(DEFAULT_TIERS.map((tier) => tier.objective), ["accumulated-length", "points"]);
	assert.equal(DEFAULT_TIERS[0].relative, 0, "the default order is strict");
	assert.equal(DEFAULT_TIERS[0].absolute, 0);
});

test("a tier that cannot hand down a budget is refused before any phase runs", () => {
	// "points" is a sum of squared residuals: its gradient changes every
	// iteration, so it cannot be held as one linear row. Refusing this up front
	// is what keeps a run from failing after the expensive phases are paid for.
	assert.throws(
		() => solveAlignmentLexicographic({
			...common,
			tiers: [{ objective: "points" }, { objective: "accumulated-length" }],
			warmStart: false,
		}),
		(e) => {
			assert.ok(e instanceof AlignmentLexicographicError);
			assert.equal(e.code, "UNBUDGETABLE_TIER");
			assert.equal(e.detail.objective, "points");
			return true;
		}
	);
	assert.deepEqual([...BUDGETABLE_OBJECTIVES], ["accumulated-length"]);
});

test("a single tier needs no budget, so any objective may stand alone", () => {
	assert.doesNotThrow(() => solveAlignmentLexicographic({
		...common, tiers: [{ objective: "points" }], warmStart: false, maxIterations: 1,
	}));
});

test("an unknown objective is named, not swallowed", () => {
	assert.throws(
		() => solveAlignmentLexicographic({ ...common, tiers: [{ objective: "smoothness" }] }),
		(e) => e.code === "UNKNOWN_OBJECTIVE"
	);
	assert.throws(
		() => solveAlignmentLexicographic({ ...common, tiers: [] }),
		(e) => e.code === "MISSING_TIERS"
	);
});

// ---------------------------------------------------------------- phases

test("the warm start is a phase of its own and is not counted as a tier", () => {
	const withWarm = solveAlignmentLexicographic({
		...common, warmStart: { objective: "points", maxIterations: 2 }, maxIterations: 2,
	});
	assert.deepEqual(
		withWarm.phases.map((phase) => phase.label).slice(0, 3),
		["warm-start", "tier-1", "tier-2"]
	);

	const without = solveAlignmentLexicographic({ ...common, warmStart: false, maxIterations: 2 });
	assert.deepEqual(without.phases.map((phase) => phase.label).slice(0, 2), ["tier-1", "tier-2"]);

	// a warm start that stops early must not make the run report failure: it
	// only decides where the phases begin
	assert.equal(
		withWarm.phases[0].ok || withWarm.ok === withWarm.phases.slice(1).every((p) => p.ok),
		true
	);
});

test("the warm start moves the starting point, and only that", () => {
	const declared = [...scenario.codec.encode()];
	const prepared = solveAlignmentLexicographic({
		...common, tiers: [{ objective: "points" }],
		warmStart: { objective: "points", maxIterations: 3 }, maxIterations: 1,
	});
	// tier 1 ran for one iteration from the warm start, so its result cannot be
	// the declared point any more
	const moved = prepared.phases.at(-1).candidate.variables;
	assert.ok(
		moved.some((value, i) => Math.abs(value - declared[i]) > 1e-9),
		"the phase started somewhere other than the declared point"
	);
	assert.equal(moved.length, declared.length);
});

// ---------------------------------------------------------------- budget

test("a strict tier freezes exactly what it attained", () => {
	const run = solveAlignmentLexicographic({ ...common, ...OPEN_GATE, warmStart: false, maxIterations: 3 });
	assert.equal(run.budgets.length, 1, "only the tier above the last hands one down");
	const [budget] = run.budgets;
	assert.equal(budget.objective, "accumulated-length");
	assert.equal(budget.slack, 0, "epsilon = 0");
	assert.equal(budget.limit, budget.attained, "a strict budget is the attained value itself");

	// and it is the value tier 1 actually reached, not a nominal one
	const tier1 = run.phases.find((phase) => phase.label === "tier-1");
	assert.ok(
		Math.abs(HELD_LENGTH + budget.attained - total(tier1.diagnostics)) < 1e-9,
		"the budget is tier 1's own accumulated length"
	);
});

test("a declared epsilon widens the budget by exactly that much", () => {
	const run = solveAlignmentLexicographic({
		...common, ...OPEN_GATE, warmStart: false, maxIterations: 3,
		tiers: [{ objective: "accumulated-length", absolute: 0.5 }, { objective: "points" }],
	});
	const [budget] = run.budgets;
	assert.equal(budget.slack, 0.5);
	assert.ok(Math.abs(budget.limit - budget.attained - 0.5) < 1e-12, "half a metre, no more");
});

test("a held budget is met by the phase that inherits it", () => {
	const run = solveAlignmentLexicographic({ ...common, ...OPEN_GATE, warmStart: false, maxIterations: 6 });
	const [budget] = run.budgets;
	const final = run.phases.at(-1);
	assert.ok(
		total(final.diagnostics) <= HELD_LENGTH + budget.limit + 1e-6,
		`tier 2 spent ${total(final.diagnostics)}, budget ${HELD_LENGTH + budget.limit}`
	);
	// when the budget binds, the solver is told about it as a constraint, and
	// the residual of that row is what proves it was held rather than ignored
	const active = run.phases.find((phase) => phase.label.endsWith("budget-active"));
	if (active) {
		const [row] = active.diagnostics.extraEqualityResiduals;
		assert.equal(row.id, budget.id);
		assert.ok(Math.abs(row.residual) < 1e-4, `budget row residual ${row.residual}`);
	}
});

test("an unspent budget leaves the phase below it unconstrained", () => {
	// a budget so wide that no result can overspend it must not produce a
	// second, boundary-held solve
	const run = solveAlignmentLexicographic({
		...common, ...OPEN_GATE, warmStart: false, maxIterations: 3,
		tiers: [{ objective: "accumulated-length", absolute: 1e6 }, { objective: "points" }],
	});
	assert.equal(
		run.phases.filter((phase) => phase.label.endsWith("budget-active")).length,
		0,
		"nothing to hold, so nothing was held"
	);
	assert.deepEqual(run.phases.at(-1).diagnostics.extraEqualityResiduals.length, 0);
});

test("a tier that established nothing does not move the starting point either", () => {
	// The warm start reaches a genuinely feasible point. One iteration of tier 1
	// then walks away from it, minimising a length against constraints it no
	// longer meets. Carrying that point into tier 2 would throw away the better
	// one the run already holds, so tier 2 has to begin where tier 1 did.
	// Whether tier 1 happens to hold feasibility for a given iteration count is
	// the tier's own open question and would make this test measure that instead.
	// A tolerance of zero settles it: nothing passes the gate, so the handover is
	// what is under test here.
	const SHUT_GATE = { feasibilityTolerance: 0 };
	const warm = solveAlignmentProblem({ ...common, objective: "points", maxIterations: 3 });
	const run = solveAlignmentLexicographic({
		...common, ...SHUT_GATE,
		warmStart: { objective: "points", maxIterations: 3 },
		maxIterations: 1,
	});
	assert.equal(run.skippedBudgets.length, 1, "tier 1 established nothing");

	const tier1 = run.phases.find((phase) => phase.label === "tier-1");
	assert.ok(
		tier1.candidate.variables.some((value, i) =>
			Math.abs(value - warm.candidate.variables[i]) > 1e-9),
		"tier 1 did move, so there is something to discard"
	);

	// the same single points iteration, started at the warm start by hand
	const reference = solveAlignmentProblem({
		...common, objective: "points",
		startAt: warm.candidate.variables, maxIterations: 1,
	});
	const tier2 = run.phases.find((phase) => phase.label === "tier-2");
	tier2.candidate.variables.forEach((value, i) => {
		assert.ok(
			Math.abs(value - reference.candidate.variables[i]) < 1e-12,
			`variable ${i}: tier 2 gave ${value}, the warm start gives ${reference.candidate.variables[i]}`
		);
	});
});

// ---------------------------------------------------------------- reporting

// ---------------------------------------------------------------- feasibility gate

test("a tier that gave up feasibility hands nothing down", () => {
	// Minimising a length against constraints it has not yet met is the cheapest
	// thing an optimiser can do, and its value is worthless: a budget frozen
	// from it is a limit the constraints cannot honour, so every tier below
	// would fail for its predecessor's reason. One iteration cannot close the
	// scenario's 3.6 m gap, so this is the case with no ambiguity in it.
	//
	// Measured on this scenario, tier 1 does not stay feasible once it gets
	// there: it is closed to 1e-5 m after three iterations and 1.8e-2 m after
	// six. That is the tier's own open weakness, and it is precisely why the
	// gate is checked at the moment the budget is frozen rather than assumed
	// from an earlier iteration.
	const run = solveAlignmentLexicographic({ ...common, warmStart: false, maxIterations: 1 });
	assert.equal(run.budgets.length, 0, "no budget was established");
	assert.equal(run.skippedBudgets.length, 1);
	assert.equal(run.skippedBudgets[0].tier, "tier-1");
	assert.equal(run.skippedBudgets[0].reason, "infeasible");
	assert.ok(run.skippedBudgets[0].endPoseDistance > 1e-3, "and it says how far off it was");
	assert.equal(run.ok, false);
	assert.equal(run.status, "tier_established_no_budget");

	// the tier below still runs: what it lost is the limit, not its own solve
	assert.ok(run.phases.some((phase) => phase.label === "tier-2"));
});

test("the feasibility gate asks about tier 0 only, never about the tier's own objective", () => {
	assert.equal(tierZeroSatisfied(null), false);
	const met = {
		endPoseDistance: 1e-6, endPoseResidual: [1e-6, 0, 1e-7],
		hardPointResiduals: [{ name: "Z", residual: 2e-5 }],
	};
	assert.equal(tierZeroSatisfied(met), true, "a huge objective value is not this gate's business");
	assert.equal(tierZeroSatisfied({ ...met, endPoseDistance: 0.5 }), false);
	assert.equal(
		tierZeroSatisfied({ ...met, hardPointResiduals: [{ name: "Z", residual: 0.4 }] }),
		false,
		"a hardened Zwangspunkt is tier 0 too"
	);
	// the heading is checked separately: two poses can coincide in position and
	// still leave the alignment pointing somewhere else
	assert.equal(tierZeroSatisfied({ ...met, endPoseResidual: [1e-6, 0, 0.2] }), false);
});

test("a tier that established nothing does not move the starting point either", () => {
	// The warm start reaches a genuinely feasible point. One iteration of tier 1
	// then walks away from it, minimising a length against constraints it no
	// longer meets. Carrying that point into tier 2 would throw away the better
	// one the run already holds, so tier 2 has to begin where tier 1 did.
	// Whether tier 1 happens to hold feasibility for a given iteration count is
	// the tier's own open question and would make this test measure that instead.
	// A tolerance of zero settles it: nothing passes the gate, so the handover is
	// what is under test here.
	const SHUT_GATE = { feasibilityTolerance: 0 };
	const warm = solveAlignmentProblem({ ...common, objective: "points", maxIterations: 3 });
	const run = solveAlignmentLexicographic({
		...common, ...SHUT_GATE,
		warmStart: { objective: "points", maxIterations: 3 },
		maxIterations: 1,
	});
	assert.equal(run.skippedBudgets.length, 1, "tier 1 established nothing");

	const tier1 = run.phases.find((phase) => phase.label === "tier-1");
	assert.ok(
		tier1.candidate.variables.some((value, i) =>
			Math.abs(value - warm.candidate.variables[i]) > 1e-9),
		"tier 1 did move, so there is something to discard"
	);

	// the same single points iteration, started at the warm start by hand
	const reference = solveAlignmentProblem({
		...common, objective: "points",
		startAt: warm.candidate.variables, maxIterations: 1,
	});
	const tier2 = run.phases.find((phase) => phase.label === "tier-2");
	tier2.candidate.variables.forEach((value, i) => {
		assert.ok(
			Math.abs(value - reference.candidate.variables[i]) < 1e-12,
			`variable ${i}: tier 2 gave ${value}, the warm start gives ${reference.candidate.variables[i]}`
		);
	});
});



test("a phase that did not converge is reported, not smoothed over", () => {
	// one iteration cannot converge anything; the run must say so
	const run = solveAlignmentLexicographic({
		...common, ...OPEN_GATE, warmStart: false, maxIterations: 1,
	});
	assert.equal(run.ok, false);
	assert.equal(run.status, "max_iterations");
	assert.ok(run.phases.every((phase) => phase.diagnostics.iterations >= 1));
});

test("the driver decides nothing: it returns a proposal with no delta", () => {
	const run = solveAlignmentLexicographic({ ...common, warmStart: false, maxIterations: 1 });
	assert.equal(run.type, "proposal");
	assert.equal(run.delta, null, "applying is not this kernel's business");
	assert.ok(Object.isFrozen(run) && Object.isFrozen(run.phases));
});

// ---------------------------------------------------------------- equivalence

test("one tier through the driver is the same solve as calling the solver directly", () => {
	const direct = solveAlignmentProblem({ ...common, objective: "points", maxIterations: 4 });
	const driven = solveAlignmentLexicographic({
		...common, tiers: [{ objective: "points" }], warmStart: false, maxIterations: 4,
	});
	assert.equal(driven.phases.length, 1);
	driven.candidate.variables.forEach((value, i) => {
		assert.ok(
			Math.abs(value - direct.candidate.variables[i]) < 1e-12,
			`variable ${i}: driver ${value}, solver ${direct.candidate.variables[i]}`
		);
	});
});
