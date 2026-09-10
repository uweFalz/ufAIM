import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

// The corpus lives in test/samples, which is not versioned: it is customer
// data. Where it is absent these tests skip and say so; they never pass by
// finding nothing to check.

const SAMPLES = new URL("../../samples/", import.meta.url);
const present = existsSync(new URL("eifel/", SAMPLES));
const skip = present ? false : "test/samples is not checked out on this machine";

const { loadTraAlignment, buildProductionAlignment } = await import("./loadTraAlignment.mjs");
const { createTraScenario, chooseProfile, distanceToTruth, momentsFor, deps } = await import("./createTraScenario.mjs");
const { createAlignmentPoseJacobian } =
	await import(new URL("../../../src/domain/optimization/alignment/AlignmentPoseJacobian.js", import.meta.url));

// five alignments across the corpus, small to long, clothoid and Bloss, one
// with a junction arc inserted
const FILES = [
	"metroB/5904S.TRA",
	"Landshut/W424-426.TRA",
	"metroB/Freihöls_Gleis3.TRA",
	"Landshut/5500L074-082.TRA",
	"Landshut/5500S074-082.TRA",
	"metroB/5904072S_ER0.TRA",
];
const at = (name) => new URL(name, SAMPLES);

test("the loader's chain reaches every file's own end point", { skip }, async () => {
	for (const name of FILES) {
		const a = await loadTraAlignment(at(name));
		assert.equal(a.unsupported.length, 0, `${name}: ${JSON.stringify(a.unsupported)}`);
		const chain = createAlignmentPoseJacobian({ elements: a.elements, startPose: a.startPose, momentsFor });
		const miss = Math.hypot(chain.endPose.x - a.endPoint.x, chain.endPose.y - a.endPoint.y);
		assert.ok(miss < 1e-3, `${name}: chain misses the recorded end point by ${miss.toExponential(2)} m over ${chain.arcLength.toFixed(0)} m`);
	}
});

test("a right-hand curve in the file is a right-hand curve in the kernel", { skip }, async () => {
	// R > 0 is a right-hand curve in Verm.esn. Read as 1/R the whole alignment
	// mirrors and misses its end by kilometres; the sign is the loader's, not
	// the parser's, and the chain test above is what holds it.
	const a = await loadTraAlignment(at("eifel/2631R139_Bestand_VR_DBREF03_A.TRA"));
	const first = a.elements.find((e) => e.type === "arc");
	assert.ok(first.curvature < 0, `R = +500 in the file, curvature ${first.curvature} in the kernel`);
});

test("the production geometry and the moment chain agree", { skip }, async () => {
	for (const name of FILES) {
		const a = await loadTraAlignment(at(name));
		const local = { x: 0, y: 0, theta: a.startPose.theta };
		const chain = createAlignmentPoseJacobian({ elements: a.elements, startPose: local, momentsFor });
		const alignment = buildProductionAlignment({ elements: a.elements, startPose: local, deps });
		const p = alignment.poseAt(alignment.arcLength);
		const gap = Math.hypot(p.p.x - chain.endPose.x, p.p.y - chain.endPose.y);
		assert.ok(gap < 1e-3, `${name}: production and chain differ by ${gap.toExponential(2)} m`);
		assert.ok(Math.abs(alignment.arcLength - chain.arcLength) < 1e-6);
	}
});

test("a transition pair meeting at a curvature gets a held arc of zero length", { skip }, async () => {
	const a = await loadTraAlignment(at("Landshut/5500L074-082.TRA"));
	assert.ok(a.insertedJunctionArcs >= 1);
	const junction = a.elements.find((e) => e.held);
	assert.equal(junction.type, "arc");
	assert.equal(junction.length, 0);
	assert.notEqual(junction.curvature, 0);
});

test("the chosen profile admits the truth, with a named exception for every inherited element", { skip }, async () => {
	for (const name of FILES) {
		const a = await loadTraAlignment(at(name));
		const profile = chooseProfile(a.elements, { sourceName: name });
		assert.equal(profile.design.status, "confirmed");
		for (const e of a.elements) {
			if (e.length === 0) continue;
			const floor = profile.design.minimumLengthFor(e.type, e.id);
			assert.ok(e.length >= floor * (1 - 1e-9), `${name} ${e.id}: ${e.type} of ${e.length} m under a floor of ${floor} m`);
			if (e.type === "arc") {
				const cap = profile.design.maximumCurvatureFor(e.id);
				assert.ok(Math.abs(e.curvature) <= cap * (1 + 1e-9), `${name} ${e.id}: |k| ${Math.abs(e.curvature)} above ${cap}`);
			}
		}
		for (const id of profile.design.exceptionIds) {
			assert.match(profile.design.exceptionFor(id).source, /corpus: inherited/);
		}
	}
});

test("a truth with a dwarf transition is admissible under the exact ramp rule, too", { skip }, async () => {
	// ASWA W 608: transitions of 0.16 m and 1.04 m between R 1450 and R 219.
	// A length exception lowers their bound, not the exact form's ramp row,
	// which asked for m·|Δu| at 1:600 and left the truth out of reach: both
	// objectives ended restoration_failed, 37× the truth's distance away.
	const { solveAlignmentProblem } = await import(new URL("../../../src/domain/optimization/alignment/AlignmentSQPSolver.js", import.meta.url));
	const { readdirSync } = await import("node:fs");
	const find = (name, dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${e.name}`; if (e.isDirectory()) { const r = find(name, p); if (r) return r; } else if (e.name === name) return p; } return null; };
	const file = find("ASWA_Abzw_W_608_DBREF2016.TRA", SAMPLES.pathname);
	assert.ok(file, "ASWA_Abzw_W_608_DBREF2016.TRA not found under test/samples");
	const a = await loadTraAlignment(file);
	const profile = chooseProfile(a.elements, { sourceName: "ASWA" });
	assert.equal(profile.inheritedRamps, 2);
	a.elements.forEach((e, index) => {
		if (e.type !== "transition") return;
		const cantAt = (k) => profile.design.cantAt(k ?? 0);
		const change = Math.abs(cantAt(a.elements[index + 1]?.curvature) - cantAt(a.elements[index - 1]?.curvature));
		const need = profile.design.rampGradientFor(e.id) * change;
		assert.ok(e.length >= need * (1 - 1e-9), `${e.id}: ${e.length} m against a ramp of ${need} m`);
	});
	const sc = await createTraScenario(file, { rampLengthAs: "constraint" });
	for (const objective of ["accumulated-length", "points"]) {
		const run = solveAlignmentProblem({ problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, objective, maxIterations: 200 });
		assert.ok(run.ok, `${objective}: ${run.status} ${run.reason ?? ""}`);
		assert.equal(run.admissible, true);
		assert.ok(run.diagnostics.endPoseDistance < 1e-6, `end pose ${run.diagnostics.endPoseDistance}`);
		assert.ok(distanceToTruth(sc, run.candidate.variables) < 1e-3, "the truth is where it stays");
	}
});

test("the scenario frees what may move and holds what anchors", { skip }, async () => {
	const sc = await createTraScenario(at("Landshut/5500L074-082.TRA"));
	const free = new Set(sc.codec.freeNames);
	assert.ok(!free.has(`${sc.ids[0]}.length`), "the first element anchors poseA and stays held");
	for (const e of sc.truth.elements) {
		if (e.held) {
			assert.ok(!free.has(`${e.id}.length`) && !free.has(`${e.id}.curvature`), `${e.id} is a junction and holds everything`);
		} else if (e.type === "arc") {
			assert.ok(free.has(`${e.id}.curvature`), `${e.id}.curvature`);
		}
	}
	assert.ok(sc.pointCount >= 6);
	// the start is the truth, disturbed: every free quantity within a few percent
	const start = sc.codec.decode(sc.codec.encode());
	for (const e of sc.truth.elements) {
		const patch = start[e.id]; if (!patch || e.held) continue;
		if (Number.isFinite(patch.length)) assert.ok(Math.abs(patch.length / e.length - 1) <= 0.03 + 1e-9, `${e.id}.length`);
	}
});

test("a turnout whose linearisation is blocked on a floor is restored, and then solved", { skip }, async () => {
	// The point the design was measured on (docs/app/architecture/
	// AXTRAN2_RESTORATION_PHASE_DESIGN.md): a transition on its floor, the
	// end pose reachable only by lifting it, which the linearisation at the
	// perturbed start cannot see. Before restoration: infeasible_subproblem
	// at iteration 5 with the end pose 8 m off.
	const { solveAlignmentProblem } = await import(new URL("../../../src/domain/optimization/alignment/AlignmentSQPSolver.js", import.meta.url));
	const { readdirSync } = await import("node:fs");
	const find = (name, dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${e.name}`; if (e.isDirectory()) { const r = find(name, p); if (r) return r; } else if (e.name === name) return p; } return null; };
	// Since the start's length perturbation sums to zero (the end no longer
	// wanders), only the double slip still starts blocked on its floor; the
	// two Büchen turnouts start near enough to solve without a verdict.
	for (const name of ["Abzw-li_DKW503.TRA"]) {
		const file = find(name, SAMPLES.pathname);
		assert.ok(file, `${name} not found under test/samples`);
		const sc = await createTraScenario(file);
		for (const objective of ["accumulated-length", "points"]) {
			const off = solveAlignmentProblem({ problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, objective, maxIterations: 200, restoration: "off" });
			assert.equal(off.status, "infeasible_subproblem", `${name}/${objective} without restoration: ${off.status}`);
			const on = solveAlignmentProblem({ problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, objective, maxIterations: 200 });
			assert.ok(on.ok, `${name}/${objective} with restoration: ${on.status} ${on.reason ?? ""}`);
			assert.equal(on.diagnostics.restorations, 1);
			assert.ok(on.diagnostics.restorationSteps <= 5, `${on.diagnostics.restorationSteps} restoration steps`);
			assert.ok(on.diagnostics.endPoseDistance < 1e-6, `end pose ${on.diagnostics.endPoseDistance}`);
		}
	}
});

test("a length prior holds what the points cannot see, and says nothing else", { skip }, async () => {
	// 5500R074-082, 41 elements: J'J at the fit has 32 of 46 eigenvalues below
	// 1e-10 of the largest - lengths traded between a transition and its
	// neighbouring arc move the lateral residuals by millimetres. A weak
	// pseudo-observation on the free lengths turns that valley into a bowl.
	const { solveAlignmentProblem } = await import(new URL("../../../src/domain/optimization/alignment/AlignmentSQPSolver.js", import.meta.url));
	const sc = await createTraScenario(at("Landshut/5500R074-082.TRA"));
	const common = { problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, objective: "points", maxIterations: 200, restoration: "eager", hessian: "gauss-newton" };
	const free = solveAlignmentProblem(common);
	const held = solveAlignmentProblem({ ...common, lengthPrior: { sigma: 0.05 } });
	assert.ok(held.ok, `with the prior: ${held.status} ${held.reason ?? ""}`);
	assert.ok(held.diagnostics.iterations < free.diagnostics.iterations || !free.ok, "the prior reaches a verdict sooner");
	assert.ok(held.diagnostics.softResidualRms < 0.2, `rms ${held.diagnostics.softResidualRms}`);
	assert.ok(held.diagnostics.endPoseDistance < 1e-6);
	// a tight prior keeps the free lengths near their start - as near as the
	// end pose, which the start does not meet, allows; without it they roam
	const pinned = solveAlignmentProblem({ ...common, lengthPrior: { sigma: 1e-3 } });
	assert.ok(pinned.candidate, `${pinned.status}`);
	const x0 = [...sc.codec.encode()];
	const lengthIndices = sc.codec.freeNames.map((name, i) => (name.endsWith(".length") ? i : -1)).filter((i) => i >= 0);
	assert.ok(lengthIndices.length > 0);
	const travel = (run) => lengthIndices.reduce((sum, i) => sum + Math.abs(run.candidate.variables[i] - x0[i]) / x0[i], 0) / lengthIndices.length;
	assert.ok(travel(pinned) < 0.2 * travel(free), `lengths travelled ${travel(pinned)} with the prior, ${travel(free)} without`);
	assert.ok(travel(held) < travel(free), `sigma 0.05: ${travel(held)} against ${travel(free)}`);
	// the option is validated
	assert.throws(() => solveAlignmentProblem({ ...common, lengthPrior: { sigma: 0 } }), (e) => e.code === "INVALID_OPTION");
	assert.throws(() => solveAlignmentProblem({ ...common, lengthPrior: { sigma: 0.1, elements: "E1" } }), (e) => e.code === "INVALID_OPTION");
	// named elements only: a prior on one transition leaves the others free
	const one = solveAlignmentProblem({ ...common, lengthPrior: { sigma: 1e-4, elements: [sc.truth.elements.find((e) => e.type === "transition").id] } });
	assert.ok(one.candidate, `${one.status}`);
});

test("the diagnostics say which lengths the points did not determine", { skip }, async () => {
	// A straight's length is invisible to lateral offsets on it: an exact
	// null of J'J, unlimited play. The report names it, and stays silent
	// where the solve is not the points objective or the report is off.
	const { solveAlignmentProblem } = await import(new URL("../../../src/domain/optimization/alignment/AlignmentSQPSolver.js", import.meta.url));
	const { readdirSync } = await import("node:fs");
	const find = (name, dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${e.name}`; if (e.isDirectory()) { const r = find(name, p); if (r) return r; } else if (e.name === name) return p; } return null; };
	const sc = await createTraScenario(find("ABCH_Gl_064_DBREF2016.TRA", SAMPLES.pathname));
	const common = { problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, objective: "points" };
	const run = solveAlignmentProblem(common);
	assert.ok(run.ok, `${run.status}`);
	const d = run.diagnostics.determinacy;
	assert.ok(d, "a report for the points objective");
	assert.equal(d.variables, sc.freeCount);
	assert.equal(d.points, sc.pointCount);
	assert.ok(d.converged);
	const last = sc.truth.elements.at(-1);
	assert.equal(last.type, "straight");
	const nullDirection = d.directions.find((dir) => dir.components[0].name === `${last.id}.length`);
	assert.ok(nullDirection, `the last straight's length leads an undetermined direction: ${JSON.stringify(d.lengthsNotDetermined)}`);
	assert.equal(nullDirection.play, Infinity);
	assert.ok(Math.abs(Math.abs(nullDirection.components[0].weight) - 1) < 1e-3);
	assert.ok(d.lengthsNotDetermined.includes(`${last.id}.length`));
	// every reported direction is below the threshold, and named
	for (const dir of d.directions) {
		assert.ok(dir.sensitivity <= d.threshold);
		assert.ok(dir.components.length >= 1 && dir.components.length <= 4);
	}
	assert.equal(solveAlignmentProblem({ ...common, objective: "accumulated-length" }).diagnostics.determinacy, null);
	assert.equal(solveAlignmentProblem({ ...common, determinacy: "off" }).diagnostics.determinacy, null);
	assert.throws(() => solveAlignmentProblem({ ...common, determinacy: "maybe" }), (e) => e.code === "INVALID_OPTION");
});

test("the production bridge reads a right-hand curve as a right-hand curve, and ÜB S-Form as Helmert", { skip }, async () => {
	// Verm.esn states a right-hand curve with a positive radius; the kernel's
	// curvature grows to the left. Read as +1/R the bridge mirrored every
	// imported alignment: on W467-468 the production chain missed the file's
	// own end point by 9.5 km (#17). And "ÜB S-Form" is the Helmert transition.
	const { readFile } = await import("node:fs/promises");
	const { parseTraGraAuto } = await import(new URL("../../../src/import/parsers/technet/vermEsn/parseTRA_GRA.js", import.meta.url));
	const { buildSparseFromLandFAT } = await import(new URL("../../../src/import/build/buildSparseFromLandFAT.js", import.meta.url));
	const { makeAlignment2DFromSparse } = await import(new URL("../../../src/aim-core/alignment/aggregate/AlignmentFactory.js", import.meta.url));
	for (const [name, family] of [["Landshut/W467-468.TRA", null], ["metroB/5904S.TRA", "helmert"]]) {
		const bytes = await readFile(at(name));
		const document = await parseTraGraAuto({ name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
		const bridged = buildSparseFromLandFAT(document.alignments[0]);
		if (family) {
			const families = new Set(bridged.sparse.filter((e) => e.kind === "transition" || e.transType).map((e) => e.transType));
			assert.ok(families.has(family), `${name}: transition families ${[...families]}`);
		}
		const { alignment } = makeAlignment2DFromSparse({ startPose: bridged.startPose, sparse: bridged.sparse, ...deps });
		const loaded = await loadTraAlignment(at(name));
		const end = alignment.poseAt(alignment.arcLength, { quality: "exact" });
		const miss = Math.hypot(end.p.x - loaded.endPoint.x, end.p.y - loaded.endPoint.y);
		assert.ok(miss < 1e-3, `${name}: the bridge's alignment misses the file's end point by ${miss.toExponential(2)} m over ${alignment.arcLength.toFixed(0)} m`);
	}
});

test("a held phase that cannot move ends with a verdict, not with its budget", { skip }, async () => {
	// AHBI_Gl_037 under the strict order: at the length optimum's vertex with
	// the length held as an equality the subproblem answers a zero step with
	// the relaxation at 0.57 and the region at its floor. That used to idle
	// for the whole budget (872 no-step rounds); it ends as line_search_failed
	// at the region's floor now, and a subproblem that runs out gets a smaller
	// region before it is given up on.
	const { solveAlignmentLexicographic } = await import(new URL("../../../src/domain/optimization/alignment/AlignmentLexicographicSolver.js", import.meta.url));
	const { readdirSync } = await import("node:fs");
	const find = (name, dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${e.name}`; if (e.isDirectory()) { const r = find(name, p); if (r) return r; } else if (e.name === name) return p; } return null; };
	const sc = await createTraScenario(find("AHBI_Gl_037_DBREF2016.TRA", SAMPLES.pathname));
	const lex = solveAlignmentLexicographic({
		problem: sc.problem, buildAlignment: sc.buildAlignment, analyticJacobian: sc.analyticJacobian, maxIterations: 1000,
		tiers: [{ objective: "accumulated-length", absolute: 0 }, { objective: "points" }],
	});
	const held = lex.phases.find((p) => p.label.endsWith("budget-active"));
	assert.ok(held, `phases ${lex.phases.map((p) => p.label)}`);
	assert.notEqual(held.status, "max_iterations", "the phase names its failure instead of running out");
	assert.notEqual(held.status, "qp_failed", "a subproblem that ran out was retried with a smaller region");
	assert.ok(held.diagnostics.iterations < 400, `${held.diagnostics.iterations} iterations`);
	const history = held.diagnostics.history ?? [];
	assert.ok(history.some((e) => e.status === "trust_shrunk" && e.reason === "qp_failed") || history.some((e) => e.status === "no_step"), "the region was shrunk on the way");
});
