import assert from "node:assert/strict";
import test from "node:test";

// A turnout as held elements, and the Weicheneinrechnung: the toe's pose
// held from the main track, the turnout's branch held as the catalogue
// gives it, the connection on either side fitted to the survey and the end
// pose. This is the second of the two cases the original AXTRAN was used
// for; the first, the line, is test/axtran2/heritage-lage.test.mjs.

const BASE = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const { turnout, turnoutElements, parseTurnoutDesignation, STANDARD_TURNOUTS, TurnoutCatalogueError } = await import(new URL("TurnoutCatalogue.js", BASE));
const { solveAlignmentProblem } = await import(new URL("AlignmentSQPSolver.js", BASE));
const { createAlignmentPoseJacobian } = await import(new URL("AlignmentPoseJacobian.js", BASE));
const { createTraScenario, momentsFor } = await import(new URL("corpus/createTraScenario.mjs", import.meta.url));

test("a designation is its own catalogue: radius, ratio, angle and the branch arc follow from it", () => {
	const parsed = parseTurnoutDesignation("EW 60-500-1:12");
	assert.deepEqual(parsed, { kind: "EW", rail: 60, radius: 500, ratio: 12 });
	assert.deepEqual(parseTurnoutDesignation("EW60-1200-1:18,5"), { kind: "EW", rail: 60, radius: 1200, ratio: 18.5 });
	const right = turnout({ designation: "EW 60-500-1:12", side: "right" });
	assert.ok(Math.abs(right.angle - Math.atan(1 / 12)) < 1e-15);
	assert.ok(Math.abs(right.branchLength - 500 * Math.atan(1 / 12)) < 1e-12, "the branch runs from the toe to the crossing angle");
	assert.ok(Math.abs(right.mainLength - 500 * Math.sin(Math.atan(1 / 12))) < 1e-12);
	assert.equal(right.curvature, -1 / 500, "a right-hand branch has negative curvature in the kernel's frame");
	assert.equal(turnout({ designation: "EW 60-500-1:12", side: "left" }).curvature, 1 / 500);
	assert.equal(right.status, "candidate");
	assert.match(right.source, /not read/);
	const elements = turnoutElements(right, { prefix: "W1" });
	assert.deepEqual(Object.keys(elements), ["branch", "main"]);
	assert.ok(elements.branch.held && elements.main.held, "a turnout's elements have no free quantity");
	assert.equal(elements.branch.type, "arc");
	assert.equal(elements.main.type, "straight");
	for (const designation of STANDARD_TURNOUTS) assert.ok(turnout({ designation, side: "left" }).branchLength > 20, designation);
	assert.throws(() => turnout({ designation: "EW 60-500", side: "left" }), TurnoutCatalogueError);
	assert.throws(() => turnout({ radius: 500, ratio: 12, side: "up" }), /side/);
	assert.throws(() => turnout({ radius: -1, ratio: 12, side: "left" }), /radius/);
});

// the branch line of a turnout, as a chain: the main track's approach
// through a curve (E1-E3) onto the straight the toe lies on (E4), the
// turnout's branch (E5), and the connection to a parallel track - a
// transition, an arc back, a straight. A toe held in x, y and theta needs
// three free quantities before it, which the curve supplies; on a start
// pose sitting on the toe's own straight the pose would be redundant, and
// the declaration refuses six equalities against four unknowns.
const weiche = turnout({ designation: "EW 60-500-1:12", side: "right" });
const branch = turnoutElements(weiche, { prefix: "W1" }).branch;
const startPose = { x: 0, y: 0, theta: 0.2 };
const chainElements = [
	{ id: "E0", type: "straight", length: 40 },
	{ id: "E1", type: "transition", length: 70, family: "bloss" },
	{ id: "E2", type: "arc", length: 180, curvature: 1 / 900 },
	{ id: "E3", type: "transition", length: 70, family: "bloss" },
	{ id: "E4", type: "straight", length: 120 },
	{ id: "E5", type: "arc", length: branch.length, curvature: branch.curvature, held: true },
	{ id: "E6", type: "transition", length: 60, family: "bloss" },
	{ id: "E7", type: "arc", length: 200, curvature: 1 / 800 },
	{ id: "E8", type: "straight", length: 150 },
];
const TOE = 4;
const truthChain = createAlignmentPoseJacobian({ elements: chainElements, startPose, momentsFor });
const toe = truthChain.poseAt(truthChain.stationAfter(TOE));
const loaded = { name: "weiche-EW60-500", startPose, elements: chainElements, unsupported: [], kinks: 0 };

test("the Weicheneinrechnung: the toe held from the main track, the branch held from the catalogue, the rest fitted", async () => {
	const sc = await createTraScenario(loaded, { pointSpacing: 10, heldPoses: [{ afterElement: `E${TOE}`, ...toe }] });
	assert.ok(!sc.codec.freeNames.some((name) => name.startsWith("E5.")), "the turnout's branch has no free quantity");
	assert.equal(sc.problem.constraints.equalityCount, 6);
	const run = solveAlignmentProblem({ problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, objective: "points", maxIterations: 300 });
	assert.ok(run.ok, `${run.status} ${run.diagnostics.reason ?? ""}`);
	const chain = sc.analyticJacobian(sc.codec.decode(run.candidate.variables));
	const at = chain.poseAt(chain.stationAfter(TOE));
	assert.ok(Math.hypot(at.x - toe.x, at.y - toe.y) < 1e-6 && Math.abs(at.theta - toe.theta) < 1e-8, `toe ${JSON.stringify(at)} against ${JSON.stringify(toe)}`);
	const branchTurn = chain.poseAt(chain.stationAfter(TOE + 1)).theta - at.theta;
	assert.ok(Math.abs(branchTurn + weiche.angle) < 1e-9, `the branch turns by the crossing angle: ${branchTurn} against ${-weiche.angle}`);
	assert.ok(run.diagnostics.endPoseDistance < 1e-6);
	assert.ok(run.diagnostics.softResidualRms < 1, `rms ${run.diagnostics.softResidualRms}`);
});

test("a toe held half a metre off the survey bends the connection and is met exactly", async () => {
	const shifted = { x: toe.x - 0.5 * Math.sin(toe.theta), y: toe.y + 0.5 * Math.cos(toe.theta), theta: toe.theta };
	const sc = await createTraScenario(loaded, { pointSpacing: 10, heldPoses: [{ afterElement: `E${TOE}`, ...shifted }] });
	const run = solveAlignmentProblem({ problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, objective: "points", maxIterations: 300 });
	assert.ok(run.ok, `${run.status} ${run.diagnostics.reason ?? ""}`);
	const chain = sc.analyticJacobian(sc.codec.decode(run.candidate.variables));
	const at = chain.poseAt(chain.stationAfter(TOE));
	assert.ok(Math.hypot(at.x - shifted.x, at.y - shifted.y) < 1e-6, "the toe is where it was held");
	const free = await createTraScenario(loaded, { pointSpacing: 10 });
	const plain = solveAlignmentProblem({ problem: free.problem, buildAlignment: free.buildAlignment, analyticJacobian: free.analyticJacobian, objective: "points", maxIterations: 300 });
	assert.ok(plain.ok && run.diagnostics.softResidualRms > plain.diagnostics.softResidualRms, `held ${run.diagnostics.softResidualRms} against free ${plain.diagnostics.softResidualRms}`);
});

test("a turnout bent onto a curve keeps its crossing angle: IBW adds the curvatures, ABW subtracts them", async () => {
	const { bentOnto } = await import(new URL("TurnoutCatalogue.js", BASE));
	const ew = turnout({ designation: "EW 60-500-1:12", side: "left" });
	// the line curves left with R 1000: a left-hand branch on it is an Innenbogenweiche
	const ibw = bentOnto(ew, 1 / 1000);
	assert.equal(ibw.bent.kind, "IBW");
	assert.ok(Math.abs(ibw.curvature - (1 / 500 + 1 / 1000)) < 1e-15, "the branch takes both curvatures");
	assert.ok(Math.abs(ibw.mainCurvature - 1 / 1000) < 1e-15);
	// the same branch on a line curving right is an Außenbogenweiche
	const abw = bentOnto(ew, -1 / 1000);
	assert.equal(abw.bent.kind, "ABW");
	assert.ok(Math.abs(abw.curvature - (1 / 500 - 1 / 1000)) < 1e-15);
	// bent onto a line as tight as itself, against it, the branch comes out straight
	const straight = bentOnto(ew, -1 / 500);
	assert.equal(straight.curvature, 0);
	assert.equal(turnoutElements(straight).branch.type, "straight");
	// the two arcs of a bent turnout turn against each other by the crossing angle
	const elements = turnoutElements(ibw, { prefix: "W2" });
	assert.equal(elements.main.type, "arc");
	const turnOfBranch = elements.branch.length * elements.branch.curvature;
	const turnOfMain = elements.main.length * elements.main.curvature;
	assert.ok(Math.abs((turnOfBranch - turnOfMain) - ew.angle) < 1e-12, `${turnOfBranch - turnOfMain} against ${ew.angle}`);
	assert.throws(() => bentOnto(ew, NaN), /curvature/);
});

test("the Weicheneinrechnung of an Innenbogenweiche: the toe on the curve, the branch bent with it", async () => {
	const { bentOnto } = await import(new URL("TurnoutCatalogue.js", BASE));
	const lineCurvature = 1 / 900;
	const ibw = bentOnto(turnout({ designation: "EW 60-500-1:12", side: "left" }), lineCurvature);
	const bent = turnoutElements(ibw, { prefix: "W2" }).branch;
	// the toe sits inside the line's curve: the arc before it carries the
	// line's curvature, and the branch leaves it with both
	const elements = [
		{ id: "E0", type: "straight", length: 40 },
		{ id: "E1", type: "transition", length: 70, family: "bloss" },
		{ id: "E2", type: "arc", length: 180, curvature: lineCurvature },
		{ id: "E3", type: "arc", length: bent.length, curvature: bent.curvature, held: true },
		{ id: "E4", type: "transition", length: 60, family: "bloss" },
		{ id: "E5", type: "arc", length: 160, curvature: 1 / 700 },
		{ id: "E6", type: "straight", length: 150 },
	];
	const chain = createAlignmentPoseJacobian({ elements, startPose, momentsFor });
	const toeOnCurve = chain.poseAt(chain.stationAfter(2));
	const sc = await createTraScenario({ name: "ibw-EW60-500-R900", startPose, elements, unsupported: [], kinks: 0 }, { pointSpacing: 10, heldPoses: [{ afterElement: "E2", ...toeOnCurve }] });
	assert.ok(!sc.codec.freeNames.some((name) => name.startsWith("E3.")));
	const run = solveAlignmentProblem({ problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, objective: "points", maxIterations: 300 });
	assert.ok(run.ok, `${run.status} ${run.diagnostics.reason ?? ""}`);
	const fitted = sc.analyticJacobian(sc.codec.decode(run.candidate.variables));
	const at = fitted.poseAt(fitted.stationAfter(2));
	assert.ok(Math.hypot(at.x - toeOnCurve.x, at.y - toeOnCurve.y) < 1e-6 && Math.abs(at.theta - toeOnCurve.theta) < 1e-8, "the toe on the curve is where it was held");
	const turn = fitted.poseAt(fitted.stationAfter(3)).theta - at.theta;
	assert.ok(Math.abs(turn - bent.length * bent.curvature) < 1e-9, "the bent branch turns by its own curvature times its length");
	assert.ok(run.diagnostics.endPoseDistance < 1e-6 && run.diagnostics.softResidualRms < 1, `rms ${run.diagnostics.softResidualRms}`);
});
