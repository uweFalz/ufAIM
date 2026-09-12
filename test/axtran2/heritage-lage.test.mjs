import assert from "node:assert/strict";
import test from "node:test";

// The heritage regression, in the horizontal. axtranNew never survived as a
// program, so there is no output to regress against; what survives is the
// intent, eight lines in the thesis (docs/thesis/AIM/discussion/
// axtran_reinterpretation-DE.tex, "Ursprüngliche Absicht"). One test per
// line, each held against a reference that exists: the nine-element
// scenario, the registry's families, the Ril 800 numbers, the evidence
// service's contract. A line the module does not fulfil is skipped with
// its reason named, not passed.

const BASE = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const { solveAlignmentProblem } = await import(new URL("AlignmentSQPSolver.js", BASE));
const { solveAlignmentLexicographic } = await import(new URL("AlignmentLexicographicSolver.js", BASE));
const { createAlignmentPoseJacobian } = await import(new URL("AlignmentPoseJacobian.js", BASE));
const { hauptbahn } = await import(new URL("profiles/index.js", BASE));
const { createNineElementScenario, build } = await import(new URL("fixtures/nineElementScenario.mjs", import.meta.url));
const { momentsFor, deps } = await import(new URL("corpus/createTraScenario.mjs", import.meta.url));
const { buildProductionAlignment } = await import(new URL("corpus/loadTraAlignment.mjs", import.meta.url));
const { AlignmentAxtranEvidenceService } = await import(new URL("../../src/services/alignment/AlignmentAxtranEvidenceService.js", import.meta.url));

const solverInput = (scenario) => ({ problem: scenario.problem, buildAlignment: scenario.buildAlignment, analyticJacobian: scenario.analyticJacobian });

// 1. das Erfüllen von Anschluss-, Pose-, Krümmungs- und Randbedingungen
test("heritage 1: end pose, a Zwangspunkt and curvature continuity are met by the fit", () => {
	const scenario = createNineElementScenario({ pointCount: 24, hardPointNames: ["M11"] });
	const run = solveAlignmentProblem({ ...solverInput(scenario), objective: "points", maxIterations: 300 });
	assert.ok(run.ok, `fit: ${run.status} ${run.reason ?? ""}`);
	assert.ok(run.diagnostics.endPoseDistance < 1e-6, `end pose missed by ${run.diagnostics.endPoseDistance}`);
	// the hard point is on the alignment, not merely near it
	const overlay = scenario.codec.decode(run.candidate.variables);
	const built = scenario.buildAlignment(overlay);
	const hard = scenario.points.find((p) => p.name === "M11");
	assert.equal(hard.enforcement, "hard");
	const foot = built.worldToTrack(hard.x, hard.y);
	assert.ok(Math.abs(foot.q) < 1e-6, `Zwangspunkt M11 sits ${foot.q} m off the alignment`);
	// curvature is continuous at every joint: a transition takes its ends from
	// its neighbours
	const { lengths, curvatures } = scenario.materialise(overlay);
	const alignment = build(lengths, curvatures);
	let s = 0;
	for (let i = 0; i < lengths.length - 1; i++) {
		s += lengths[i];
		const before = alignment.curvatureAt(s - 1e-6);
		const after = alignment.curvatureAt(s + 1e-6);
		assert.ok(Math.abs(before - after) < 1e-7, `curvature jumps at joint ${i}: ${before} -> ${after}`);
	}
});

// 2. die ausdrückliche Behandlung fester, abgeleiteter, beschränkter, gekoppelter und freier Größen
test("heritage 2: held, free, derived and bounded quantities are declared, and the bounds hold", () => {
	const scenario = createNineElementScenario({ pointCount: 12 });
	const codec = scenario.problem.codec;
	assert.ok(!codec.freeNames.includes("E0.length") && !codec.freeNames.includes("E8.length"), "the anchoring lengths are held");
	assert.ok(codec.freeNames.includes("E1.length") && codec.freeNames.includes("E2.curvature"), "lengths and curvatures are free");
	// a transition's end curvatures are derived from its neighbours: moving an
	// arc curvature moves three elements in the chain
	const chain = scenario.analyticJacobian({});
	const rows = chain.endPoseJacobian([{ elementIndex: 2, kind: "curvature" }]);
	assert.ok(Math.abs(rows[0].dtheta) > 0, "an arc curvature reaches the end heading through its transitions");
	// the declared profile is a bound the candidate respects
	const run = solveAlignmentProblem({ ...solverInput(scenario), objective: "points", maxIterations: 300 });
	assert.ok(run.ok, `fit: ${run.status}`);
	assert.equal(run.admissible, true, "the candidate honours the declared limits");
	const { lengths, curvatures } = scenario.materialise(scenario.codec.decode(run.candidate.variables));
	const profile = hauptbahn({ speedKmh: 100, cantMm: 130 });
	for (const k of curvatures) assert.ok(1 / Math.abs(k) >= profile.minimumRadius * (1 - 1e-9), `radius ${1 / Math.abs(k)} under ${profile.minimumRadius}`);
	for (const i of [1, 3, 5, 7]) assert.ok(lengths[i] >= profile.minimumLengthFor("transition") * (1 - 1e-9), `transition E${i} of ${lengths[i]} m under the ramp floor`);
});

// 3. die Komposition von Halbwellen-, Klothoiden- und Null-Längen-Komponenten
test("heritage 3: every registry family the corpus needs, and a zero-length component, compose in chain and kernel alike", () => {
	const startPose = { x: 5, y: -3, theta: 0.2 };
	for (const family of ["clothoid", "bloss", "helmert"]) {
		const elements = [
			{ id: "E0", type: "straight", length: 100 },
			{ id: "E1", type: "transition", length: 80, family },
			{ id: "E2", type: "arc", length: 200, curvature: 1 / 600 },
			{ id: "E3", type: "kink", length: 0, deltaDir: -0.01, held: true },
			{ id: "E4", type: "straight", length: 50 },
		];
		const real = buildProductionAlignment({ elements, startPose, deps });
		const chain = createAlignmentPoseJacobian({ elements, startPose, momentsFor });
		assert.ok(Math.abs(chain.arcLength - real.arcLength) < 1e-9, family);
		let worst = 0;
		for (let i = 1; i <= 20; i++) {
			const s = (real.arcLength * i) / 21;
			const a = chain.poseAt(s);
			const b = real.poseAt(s);
			worst = Math.max(worst, Math.hypot(a.x - b.p.x, a.y - b.p.y));
		}
		assert.ok(worst < 1e-6, `${family}: chain and kernel differ by ${worst} m`);
	}
});

// 4. die Bestimmung zulässiger Parameterkombinationen
test("heritage 4: what the points determine is reported, and a declaration that admits nothing is refused", () => {
	const scenario = createNineElementScenario({ pointCount: 12 });
	const run = solveAlignmentProblem({ ...solverInput(scenario), objective: "points", maxIterations: 300, determinacy: "report" });
	assert.ok(run.ok, `fit: ${run.status}`);
	const report = run.diagnostics.determinacy;
	assert.ok(report && Number.isInteger(report.undetermined) && Array.isArray(report.directions), "the determinacy report names the weak directions");
	assert.equal(report.variables, scenario.problem.codec.freeNames.length);
	// V = 300 km/h at 130 mm asks for a radius of 4085 m where the truth has
	// 700 and 900: no combination the profile admits fits the points, and
	// the answer is a named verdict with the candidate on the declared floor,
	// not a fit that pretends
	const impossible = createNineElementScenario({ pointCount: 12, design: hauptbahn({ speedKmh: 300, cantMm: 130 }) });
	const refused = solveAlignmentProblem({ ...solverInput(impossible), objective: "points", maxIterations: 300 });
	assert.equal(refused.ok, false);
	assert.ok(typeof refused.status === "string" && refused.status !== "max_iterations", `named: ${refused.status}`);
	const floor = hauptbahn({ speedKmh: 300, cantMm: 130 }).minimumRadius;
	for (const k of impossible.materialise(impossible.codec.decode(refused.candidate.variables)).curvatures) {
		assert.ok(1 / Math.abs(k) >= floor * (1 - 1e-9), `radius ${1 / Math.abs(k)} under the floor ${floor}`);
	}
});

// 5. die Kopplung oder Trennung von Krümmungs- und Überhöhungsfunktionen
test("heritage 5: cant reaches the horizontal through two rules of Ril 800, and through nothing else", () => {
	// R = s V^2 / (g (u + u_f)) and L = m du: the smallest radius and the
	// shortest transition. There is no cant law of its own in the horizontal,
	// and the reconstruction found none evidenced (RESEARCH-BERLINISH-AXTRAN-001).
	const profile = hauptbahn({ speedKmh: 100, cantMm: 130 });
	assert.ok(Math.abs(profile.minimumRadius - 453.9) < 0.1, `smallest radius ${profile.minimumRadius}`);
	assert.ok(Math.abs(profile.minimumLengthFor("transition") - 78.0) < 0.1, `shortest transition ${profile.minimumLengthFor("transition")}`);
	assert.equal(profile.derivations.find((d) => d.quantity === "minimumRadius").formula, "s V^2 / (g (u + u_f))");
	assert.ok(hauptbahn({ speedKmh: 160, cantMm: 130 }).minimumRadius > profile.minimumRadius, "more speed, more radius");
	assert.ok(hauptbahn({ speedKmh: 100, cantMm: 160 }).minimumRadius < profile.minimumRadius, "more cant, less radius");
	assert.ok(hauptbahn({ speedKmh: 100, cantMm: 160 }).minimumLengthFor("transition") > profile.minimumLengthFor("transition"), "more cant, longer ramp");
});

// 6. den Vergleich von Alternativen und die Optimierung anhand von Ingenieurzielen
test("heritage 6: the same alignment answers three questions, and the length answer is the shorter one", () => {
	const scenario = createNineElementScenario({ pointCount: 12 });
	const points = solveAlignmentProblem({ ...solverInput(scenario), objective: "points", maxIterations: 300 });
	const length = solveAlignmentProblem({ ...solverInput(scenario), objective: "accumulated-length", maxIterations: 300 });
	assert.ok(points.ok && length.ok, `${points.status} / ${length.status}`);
	assert.ok(length.diagnostics.accumulatedLength <= points.diagnostics.accumulatedLength + 1e-6,
		`length ${length.diagnostics.accumulatedLength} against points ${points.diagnostics.accumulatedLength}`);
	const lex = solveAlignmentLexicographic({ ...solverInput(scenario), maxIterations: 300 });
	assert.ok(Array.isArray(lex.phases) && lex.phases.length >= 2 && typeof lex.status === "string", "the lexicographic order reports its phases");
});

// 7. elementare Bearbeitungen wie das Koppeln von Alignment-Elementen
test("heritage 7: coupling elements is an edit, and the editor's own suite holds it", { skip: "not a solver capability: test/services/alignment and test/app hold the edit operations" }, () => {});

// 8. die Realisierung berechneter Kandidaten als editierbare Alignment-Strukturen
test("heritage 8: a candidate is an editable structure, proposed and not imposed", () => {
	const alignment = (curvature) => ({
		type: "AlignmentData", id: "A1", name: "A1", source: { kind: "editor", native: true },
		editModel: {
			startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
			elements: [
				{ id: "S1", type: "straight", parameters: { length: 100 } },
				{ id: "T1", type: "transition", parameters: { length: 60, transitionType: "bloss" } },
				{ id: "A1", type: "arc", parameters: { length: 100, curvature } },
				{ id: "T2", type: "transition", parameters: { length: 60, transitionType: "bloss" } },
				{ id: "S2", type: "straight", parameters: { length: 100 } },
			],
		},
	});
	const before = alignment(1 / 300);
	const after = alignment(1 / 350);
	const snapshot = JSON.stringify([before, after]);
	const result = new AlignmentAxtranEvidenceService().evaluateChange({ beforeAlignmentData: before, afterAlignmentData: after, sampleCount: 8, maxIterations: 40 });
	assert.equal(JSON.stringify([before, after]), snapshot, "the service mutates nothing");
	assert.equal(result.status, "evidence-only");
	assert.ok(Array.isArray(result.candidate.names) && result.candidate.names.length === result.candidate.variables.length, "the candidate is named per quantity");
	assert.ok(result.candidate.names.includes("A1.curvature"));
	// what the receipt needs to say its one sentence: the mode that ran and
	// what the points left undetermined (the sentence itself is the app's,
	// app/domain/workspace/buildHorizontalRealizationChangeReceipt.js)
	assert.equal(result.fitMode, "keep-plan");
	assert.ok(Array.isArray(result.undetermined), "the undetermined lengths are named for the receipt");
});
