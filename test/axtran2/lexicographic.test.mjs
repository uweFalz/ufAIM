import assert from "node:assert/strict";
import test from "node:test";

const BASE = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const {
	solveAlignmentLexicographic,
	AlignmentLexicographicError,
	BUDGETABLE_OBJECTIVES,
	BUDGET_MODES,
	DEFAULT_TIERS,
	tierZeroSatisfied,
	tierZeroReport,
	FEASIBILITY_TOLERANCE,
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

test("the default order is the declared one, and the length tier only reports", () => {
	// Decision OD-2, reading (b): epsilon at the full span, which is the same
	// thing as not constraining at all.
	assert.deepEqual(DEFAULT_TIERS.map((tier) => tier.objective), ["accumulated-length", "points"]);
	assert.equal(DEFAULT_TIERS[0].budget, "reference");
	assert.equal(DEFAULT_TIERS[0].relative, undefined, "no epsilon: there is nothing to widen");
	assert.equal(DEFAULT_TIERS[0].absolute, undefined);
	assert.deepEqual([...BUDGET_MODES], ["reference", "limit"]);
});

test("declaring an epsilon and a reference at once is a contradiction, not a preference", () => {
	assert.throws(
		() => solveAlignmentLexicographic({
			...common, warmStart: false, maxIterations: 1,
			tiers: [
				{ objective: "accumulated-length", budget: "reference", absolute: 2 },
				{ objective: "points" },
			],
		}),
		(e) => e instanceof AlignmentLexicographicError && e.code === "CONTRADICTORY_BUDGET"
	);
	assert.throws(
		() => solveAlignmentLexicographic({
			...common, warmStart: false, maxIterations: 1,
			tiers: [{ objective: "accumulated-length", budget: "cap" }, { objective: "points" }],
		}),
		(e) => e.code === "UNKNOWN_BUDGET_MODE"
	);
});

test("a declared epsilon makes a tier a limit without being told to", () => {
	const run = solveAlignmentLexicographic({
		...common, ...OPEN_GATE, warmStart: false, maxIterations: 2,
		tiers: [{ objective: "accumulated-length", absolute: 0.5 }, { objective: "points" }],
	});
	assert.equal(run.budgets[0].mode, "limit");
	assert.equal(run.budgets[0].slack, 0.5);
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
	const run = solveAlignmentLexicographic({
		...common, ...OPEN_GATE, warmStart: false, maxIterations: 3,
		tiers: [{ objective: "accumulated-length", absolute: 0 }, { objective: "points" }],
	});
	assert.equal(run.budgets.length, 1, "only the tier above the last hands one down");
	assert.equal(run.budgets[0].mode, "limit");
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
	const run = solveAlignmentLexicographic({
		...common, ...OPEN_GATE, warmStart: false, maxIterations: 6,
		tiers: [{ objective: "accumulated-length", absolute: 0 }, { objective: "points" }],
	});
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

// ---------------------------------------------------------------- reference

test("a reference tier constrains nothing and hands no point down", () => {
	// Under reading (b) the length tier says what its objective could achieve and
	// then stops. The tier below must be solved exactly as if it stood alone.
	const run = solveAlignmentLexicographic({
		...common, ...OPEN_GATE, warmStart: false, maxIterations: 4,
	});
	assert.equal(run.budgets[0].mode, "reference");
	assert.equal(run.budgets[0].limit, null, "a reference is not something to compare against");
	assert.equal(run.budgets[0].slack, null);
	assert.equal(
		run.phases.filter((phase) => phase.label.endsWith("budget-active")).length, 0,
		"nothing was held, so no held phase ran"
	);
	assert.deepEqual(run.phases.at(-1).diagnostics.extraEqualityResiduals.length, 0);

	// and the last tier began at the declared alignment, not at tier 1's answer
	const alone = solveAlignmentProblem({ ...common, objective: "points", maxIterations: 4 });
	run.phases.at(-1).candidate.variables.forEach((value, i) => {
		assert.ok(
			Math.abs(value - alone.candidate.variables[i]) < 1e-12,
			`variable ${i}: in the run ${value}, standing alone ${alone.candidate.variables[i]}`
		);
	});
});

test("a reference reports what the answer cost the tier that established it", () => {
	const run = solveAlignmentLexicographic({
		...common, ...OPEN_GATE, warmStart: false, maxIterations: 4,
	});
	const [budget] = run.budgets;
	assert.ok(Number.isFinite(budget.attained), "what the length tier reached");
	assert.ok(Number.isFinite(budget.spent), "what the answer used");
	assert.ok(
		Math.abs(budget.span - (budget.spent - budget.attained)) < 1e-12,
		"and the span is exactly the difference"
	);
	// the span is what the points cost in length, so it cannot be negative: the
	// length tier's own optimum is the smallest value available
	assert.ok(budget.span >= -1e-9, `span ${budget.span}`);
});

// ---------------------------------------------------------------- tier 3

test("the declared profile reaches the solver as bounds on the result", () => {
	// A curvature bound is not a bound on a length, and the solver used to read
	// only the latter. Whatever the profile derives has to survive the whole way
	// to the candidate - and the length tier is the case that matters, because
	// it is the one that pushes against every limit it can find.
	const profile = scenario.problem.constraints.design;
	const run = solveAlignmentLexicographic({
		...common,
		tiers: [{ objective: "accumulated-length" }],
		warmStart: false,
		maxIterations: 300,
	});
	const { lengths, curvatures } = scenario.materialise(
		scenario.problem.codec.decode(run.candidate.variables));

	for (const curvature of curvatures) {
		assert.ok(
			Math.abs(curvature) <= 1 / profile.minimumRadius + 1e-9,
			`radius ${(1 / Math.abs(curvature)).toFixed(1)} m is tighter than the profile's `
				+ `${profile.minimumRadius.toFixed(1)} m`
		);
	}
	// E1, E3, E5, E7 are the transitions
	[1, 3, 5, 7].forEach((i) => assert.ok(
		lengths[i] >= profile.minimumTransitionLength - 1e-9,
		`transition ${i} is ${lengths[i].toFixed(1)} m against a floor of `
			+ `${profile.minimumTransitionLength.toFixed(1)} m`
	));

	// and the limits are not decoration: minimising the length puts the
	// alignment on them
	assert.ok(
		Math.abs(Math.abs(curvatures[0]) - 1 / profile.minimumRadius) < 1e-9,
		"the length tier ran the first arc down onto the radius limit"
	);
});

test("the profile the scenario declares carries its own provenance", () => {
	const profile = scenario.problem.constraints.design;
	assert.ok(profile.id, "it is named");
	assert.equal(profile.status, "confirmed", "every limit's source has been read");
	assert.ok(profile.derivations.length >= 2, "and shows how its numbers were reached");
	assert.equal(profile.radiusBinding, "kinematics");
});

test("a tier held to the budget of a vertex says so at once", () => {
	// Under the design limits the length optimum is a vertex of the feasible
	// set: four transitions on their length floor, both arcs on the curvature
	// bound, six active bounds and four equalities pinning all nine variables.
	// A tier held to that budget has no admissible direction at all, and has to
	// report that rather than iterate against it until the count runs out.
	const codec = scenario.problem.codec;
	const gradient = codec.freeNames.map((name) => (name.endsWith(".length") ? 1 : 0));
	const total = (x) => gradient.reduce((sum, weight, i) => sum + weight * x[i], 0);

	const length = solveAlignmentProblem({ ...common, objective: "accumulated-length", maxIterations: 300 });
	assert.equal(length.status, "stationary", "the length tier reached its own optimum");
	const limit = total(length.candidate.variables);

	const held = solveAlignmentProblem({
		...common, objective: "points", maxIterations: 40,
		startAt: [...length.candidate.variables],
		extraEqualities: [{ id: "budget", gradient, residual: (x) => total(x) - limit }],
	});
	assert.equal(held.status, "stationary");
	// Well inside the 40 it was given, which is the point: it recognises the
	// vertex instead of iterating against it. It is no longer one or two, because
	// the subproblem now tries Bland's rule before declaring itself stationary on
	// its working set - it used to give up on the first immediate re-block and
	// hand back a direction it could not vouch for.
	assert.ok(held.diagnostics.iterations <= 15, `took ${held.diagnostics.iterations} iterations`);
	// Which of the three ways it recognised there was nothing to do depends on
	// how the multipliers land, and all three are correct answers to the same
	// question. What must not happen is iterating against a pinned working set
	// until the count runs out, which is what the assertions above forbid.
	assert.ok(
		["stationary", "no_admissible_direction", "degenerate_vertex"]
			.includes(held.diagnostics.history.at(-1).reason),
		`reported "${held.diagnostics.history.at(-1).reason}"`
	);
	// and it is still the length tier's alignment, because there was nowhere
	// admissible to go. Not bit-identical any more: the subproblem takes a few
	// genuine steps before it declares itself stationary on its working set,
	// where it used to give up on the first immediate re-block, so the point
	// drifts by around 4e-8 m. A tolerance of a micron is far below anything an
	// alignment cares about and far above that drift.
	held.candidate.variables.forEach((value, i) => {
		assert.ok(
			Math.abs(value - length.candidate.variables[i]) < 1e-6,
			`variable ${i} moved to ${value} from ${length.candidate.variables[i]}`
		);
	});
});

test("a budget is honoured from its own witness, not from the point that broke it", () => {
	// The witness satisfies the budget exactly, so the held phase starts inside
	// the constraint it must honour. Starting at the overspending free optimum
	// began it outside, and the solve ran away: measured, the trust region grew
	// 30 -> 60 -> 121 and the QP's active set gave up after 67 releases.
	const run = solveAlignmentLexicographic({
		...common, warmStart: false, maxIterations: 8,
		feasibilityTolerance: Infinity,   // so a short tier 1 still hands a budget down
	});
	const held = run.phases.find((phase) => phase.label.endsWith("budget-active"));
	if (!held) return;    // the free optimum was affordable; nothing to hold
	const [row] = held.diagnostics.extraEqualityResiduals;
	assert.ok(
		Math.abs(row.residual) < 1e-6,
		`the held phase ended off its budget by ${row.residual}`
	);
	assert.notEqual(held.status, "qp_failed", "and it did not run away getting there");
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
	assert.ok(
		run.skippedBudgets[0].endPoseDistance > FEASIBILITY_TOLERANCE,
		"and it says how far off it was"
	);
	// "infeasible" on its own sends the reader back to the trace
	assert.ok(
		["end-pose position", "end-pose heading", "hardened Zwangspunkt"]
			.includes(run.skippedBudgets[0].failing),
		`it names which part of tier 0 it failed: "${run.skippedBudgets[0].failing}"`
	);
	assert.equal(run.skippedBudgets[0].tolerance, FEASIBILITY_TOLERANCE, "and against what");
	assert.equal(run.ok, false);
	assert.equal(run.status, "tier_established_no_budget");

	// the tier below still runs: what it lost is the limit, not its own solve
	assert.ok(run.phases.some((phase) => phase.label === "tier-2"));
});

test("the feasibility gate asks about tier 0 only, never about the tier's own objective", () => {
	assert.equal(tierZeroSatisfied(null), false);
	const met = {
		endPoseDistance: 1e-9, endPoseResidual: [1e-9, 0, 1e-13],
		hardPointResiduals: [{ name: "Z", residual: 2e-9 }],
		alignmentLength: 1430,
	};
	assert.equal(tierZeroSatisfied(met), true, "a huge objective value is not this gate's business");
	assert.equal(tierZeroSatisfied({ ...met, endPoseDistance: 0.5 }), false);
	assert.equal(
		tierZeroSatisfied({ ...met, hardPointResiduals: [{ name: "Z", residual: 0.4 }] }),
		false,
		"a hardened Zwangspunkt is tier 0 too"
	);
});

test("the heading is judged as a distance, over the length it accumulates on", () => {
	// A heading is not a length and cannot be held against one. Compared with a
	// tolerance in metres it was let off by the ratio between them: 1e-6 rad
	// looks tiny and is 1.4 mm of drift at the end of this alignment, while the
	// position beside it was being held to a thousandth of that.
	const base = {
		endPoseDistance: 0, endPoseResidual: [0, 0, 0], hardPointResiduals: [],
		alignmentLength: 1430,
	};
	const heading = (radians) => ({ ...base, endPoseResidual: [0, 0, radians] });

	assert.equal(tierZeroSatisfied(heading(1e-6)), false, "1.43e-3 m of drift is outside the gate");
	assert.equal(tierZeroSatisfied(heading(1e-12)), true, "1.43e-9 m of drift is inside it");
	// and the case the old comparison got wrong: an angle small enough to look
	// harmless in radians, large enough to matter as a distance
	assert.equal(tierZeroSatisfied(heading(1e-10)), false, "1.43e-7 m of drift is not");

	const report = tierZeroReport(heading(1e-6));
	assert.equal(report.failing, "end-pose heading");
	assert.equal(report.leverArm, 1430);
	assert.ok(Math.abs(report.heading - 1.43e-3) < 1e-12, "the drift, in metres");
	assert.equal(report.headingRadians, 1e-6, "and the angle it came from");

	// with no length to lean on, the angle is compared in radians and the report
	// says so rather than passing a radian off as a metre
	const blind = tierZeroReport({ ...heading(1e-6), alignmentLength: null });
	assert.equal(blind.leverArmKnown, false);
	assert.equal(blind.heading, 1e-6);
});

test("the tolerance sits in the middle of the band the measurements leave it", () => {
	// The gate asks whether a tier honoured tier 0, not whether it converged -
	// and those are different questions. The closures measured on this scenario,
	// at iteration counts from 1 to 300, fall into two groups with nothing
	// between them, and the threshold has to land in the gap.
	assert.equal(FEASIBILITY_TOLERANCE, 1e-8);
	const at = (closure) => ({
		endPoseDistance: closure, endPoseResidual: [0, 0, 0],
		hardPointResiduals: [], alignmentLength: 1430,
	});
	// the tightest that must be accepted is a points phase stopped at 20
	// iterations: still moving, but the end pose met to 1e-10
	const honours = [0, 3.95e-14, 1.09e-10];
	const doesNot = [1.69e-6, 1.17e-5, 3.23e-5, 1.97e-3, 1.16e-1];

	for (const closure of honours) {
		assert.equal(tierZeroSatisfied(at(closure), FEASIBILITY_TOLERANCE), true, `${closure} m`);
	}
	for (const closure of doesNot) {
		assert.equal(tierZeroSatisfied(at(closure), FEASIBILITY_TOLERANCE), false, `${closure} m`);
	}

	// and the verdict is the same anywhere in the band, which is the argument
	// for the value: it is not delicate
	for (const tolerance of [1e-9, 1e-8, 1e-7]) {
		assert.equal(honours.every((c) => tierZeroSatisfied(at(c), tolerance)), true, `at ${tolerance}`);
		assert.equal(doesNot.some((c) => tierZeroSatisfied(at(c), tolerance)), false, `at ${tolerance}`);
	}
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
