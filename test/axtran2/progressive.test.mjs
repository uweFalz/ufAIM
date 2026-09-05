import assert from "node:assert/strict";
import test from "node:test";

const BASE = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const { solveAlignmentProblem } = await import(new URL("AlignmentSQPSolver.js", BASE));
const {
	solveAlignmentProgressive,
	AlignmentProgressiveError,
	SWEEPS,
} = await import(new URL("AlignmentProgressiveSolver.js", BASE));
const { createNineElementScenario } =
	await import(new URL("fixtures/nineElementScenario.mjs", import.meta.url));

const START = {
	pointCount: 12,
	startLengths: [200, 92, 298, 88, 152, 82, 258, 78, 180],
	startCurvatures: [1 / 695, -1 / 905],
};
const scenario = () => createNineElementScenario(START);
const solverInput = (sc) => ({
	problem: sc.problem,
	buildAlignment: sc.buildAlignment,
	analyticJacobian: sc.analyticJacobian,
});

// ------------------------------------------------------------ pinned

test("a pinned variable does not move", () => {
	const sc = scenario();
	const names = sc.codec.freeNames;
	const held = names.filter((name) => name !== "E4.length");
	const run = solveAlignmentProblem({
		...solverInput(sc), objective: "accumulated-length", maxIterations: 20, pinned: held,
	});
	const before = sc.codec.encode();
	const after = run.candidate.variables;
	names.forEach((name, i) => {
		if (name === "E4.length") return;
		assert.equal(after[i], before[i], `${name} moved while pinned`);
	});
});

test("pinning every variable leaves the declaration where it was", () => {
	const sc = scenario();
	const run = solveAlignmentProblem({
		...solverInput(sc), objective: "accumulated-length", maxIterations: 5,
		pinned: [...sc.codec.freeNames],
	});
	assert.deepEqual([...run.candidate.variables], [...sc.codec.encode()]);
});

test("a name that is not a free variable is refused, not ignored", () => {
	const sc = scenario();
	assert.throws(
		() => solveAlignmentProblem({ ...solverInput(sc), pinned: ["E4.cant"] }),
		(caught) => caught.code === "UNKNOWN_PINNED",
	);
});

// ------------------------------------------------------- the schedule

test("the schedule widens by one and sweeps both ways at every width", () => {
	const sc = scenario();
	const run = solveAlignmentProgressive({
		...solverInput(sc), objective: "accumulated-length", initialSpan: 3, maxIterations: 4,
	});
	// E0 and E8 are held, so seven elements can move
	assert.deepEqual([...run.elements], ["E1", "E2", "E3", "E4", "E5", "E6", "E7"]);
	assert.deepEqual(run.stages.map((s) => `${s.span}${s.sweep[0]}`),
		["3f", "3b", "4f", "4b", "5f", "5b", "6f", "6b", "7f"]);
	// forward frees the leading elements, backward the trailing ones
	assert.deepEqual([...run.stages[0].free], ["E1", "E2", "E3"]);
	assert.deepEqual([...run.stages[1].free], ["E5", "E6", "E7"]);
	// at full width the two directions are the same stage, and it is run once
	assert.deepEqual([...run.stages.at(-1).free], run.elements);
});

test("the sweeps are named, and an unknown one is refused", () => {
	const sc = scenario();
	assert.deepEqual([...SWEEPS], ["forward", "backward"]);
	assert.throws(
		() => solveAlignmentProgressive({ ...solverInput(sc), sweeps: ["sideways"] }),
		(caught) => caught instanceof AlignmentProgressiveError && caught.code === "UNKNOWN_SWEEP",
	);
	assert.throws(
		() => solveAlignmentProgressive({ ...solverInput(sc), sweeps: [] }),
		(caught) => caught.code === "EMPTY_SWEEPS",
	);
});

// --------------------------------------------------- what it arrives at

test("the ladder arrives where the global solve does", () => {
	const ladder = solveAlignmentProgressive({
		...solverInput(scenario()), objective: "accumulated-length", maxIterations: 200,
	});
	const global = solveAlignmentProblem({
		...solverInput(scenario()), objective: "accumulated-length", maxIterations: 200,
	});
	assert.equal(ladder.status, "converged");
	assert.equal(global.status, "converged");
	assert.ok(
		Math.abs(ladder.proposal.diagnostics.accumulatedLength - global.diagnostics.accumulatedLength) < 1e-6,
		`ladder ${ladder.proposal.diagnostics.accumulatedLength} vs global ${global.diagnostics.accumulatedLength}`,
	);
	// the point of a warm start: by the time everything is free there is nothing
	// left to do
	assert.equal(ladder.stages.at(-1).iterations, 0);
});

test("a stage that reaches the end pose exactly does not freeze the ladder", () => {
	// Measured: endPoseDistance comes back as exactly 0 often enough, and an
	// acceptance rule of "no worse than before" then demands exactly 0 of every
	// later stage too. The ladder stopped after two rungs of nine.
	const common = { ...solverInput(scenario()), objective: "accumulated-length", maxIterations: 200 };
	const strict = solveAlignmentProgressive({ ...common, feasibilityTolerance: 0 });
	const tolerant = solveAlignmentProgressive({ ...common });
	const acceptedBy = (run) => run.stages.filter((s) => s.accepted).length;
	assert.ok(acceptedBy(tolerant) > acceptedBy(strict),
		`tolerant accepted ${acceptedBy(tolerant)}, strict ${acceptedBy(strict)}`);
	assert.equal(tolerant.status, "converged");
});

test("an unfinished ladder says so rather than reporting the last thing it saw", () => {
	// four iterations per stage is not enough for the wide ones, and the result
	// has to carry that
	const run = solveAlignmentProgressive({
		...solverInput(scenario()), objective: "accumulated-length", maxIterations: 4,
	});
	assert.equal(run.ok, false);
	assert.ok(["ladder_incomplete", "no_stage_accepted"].includes(run.status), run.status);
	assert.ok(run.stages.some((s) => s.accepted === false));
	for (const stage of run.stages.filter((s) => !s.accepted)) {
		assert.ok(typeof stage.reason === "string" && stage.reason.length > 0,
			`stage ${stage.span}${stage.sweep} was rejected without a reason`);
	}
});
