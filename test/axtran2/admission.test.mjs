import assert from "node:assert/strict";
import test from "node:test";

// Two ways a result can look like an engineering answer without being one:
// a constraint that could not be evaluated and was scored zero, and a limit
// nobody has read that shaped the alignment anyway. Both are refused here.

const BASE = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const load = (name) => import(new URL(name, BASE));

const { createAlignmentVariableCodec } = await load("AlignmentVariableCodec.js");
const { createAlignmentConstraintBuilder, EVIDENCE_ONLY, AlignmentConstraintBuilderError } =
	await load("AlignmentConstraintBuilder.js");
const { createAlignmentResidualBuilder } = await load("AlignmentResidualBuilder.js");
const { createAlignmentOptimizationProblem } = await load("AlignmentOptimizationProblem.js");
const { createIntrinsicMetricContext } = await load("MetricContext.js");
const { solveAlignmentProblem, AlignmentSqpSolverError } = await load("AlignmentSQPSolver.js");
const { createAlignmentDesignProfile } = await load("AlignmentDesignProfile.js");
const { hauptbahn } = await load("profiles/index.js");

// ---------------------------------------------------------------- a toy line

// A straight run along +x, so the lateral offset of a point is simply its y and
// the arithmetic is checkable by eye. Its only reason to exist is to let a
// projection fail on demand.
const END_POSE = { x: 300, y: 0, theta: 0 };

function scenario({ points, unprojectable = [] }) {
	// five free lengths, so there is room for the three end-pose equalities and a
	// hardened point on top of them
	const ids = ["E0", "E1", "E2", "E3", "E4"];
	const codec = createAlignmentVariableCodec({
		elements: ids.map((id) => ({ id, quantities: { length: "free" }, values: { length: 60 } })),
	});
	const problem = createAlignmentOptimizationProblem({
		codec,
		constraints: createAlignmentConstraintBuilder({
			endPose: END_POSE,
			elementSequence: codec.elementSequence,
			minimumElementLength: 10,
			hardPoints: points.filter((p) => p.enforcement === "hard").map((p) => ({ name: p.name })),
		}),
		residuals: createAlignmentResidualBuilder({
			metricContext: createIntrinsicMetricContext(),
			points,
		}),
	});
	const buildAlignment = (overlay) => {
		const lengths = ids.map((id) => overlay[id]?.length ?? 60);
		const total = lengths.reduce((sum, value) => sum + value, 0);
		return {
			lengths,
			endPose: { x: total, y: 0, theta: 0 },
			// the named points fall off the alignment and cannot be projected
			worldToTrack: (x, y) =>
				(unprojectable.some((p) => p.x === x && p.y === y) ? null : { q: y, s: x }),
		};
	};
	return { problem, buildAlignment, codec, ids };
}

// ---------------------------------------------------------------- projection

test("a Zwangspunkt that cannot be projected is refused, not recorded as met", () => {
	// Zero is the one value it must not be given: for a hardened point zero reads
	// as "exactly met", so a constraint with no evaluable meaning would be
	// recorded as the best possible outcome.
	const point = { name: "Z", x: 400, y: 0, target: 0, tolerance: 0.01, enforcement: "hard" };
	const { problem, buildAlignment } = scenario({ points: [point], unprojectable: [point] });

	assert.throws(
		() => solveAlignmentProblem({ problem, buildAlignment, objective: "points", maxIterations: 5 }),
		(e) => {
			assert.ok(e instanceof AlignmentSqpSolverError);
			assert.equal(e.code, "UNPROJECTABLE_POINT");
			assert.equal(e.detail.pointName, "Z");
			assert.equal(e.detail.role, "zwangspunkt");
			return true;
		}
	);
});

test("a measured point that cannot be projected is refused too", () => {
	// The same zero is worse than silent here, it is perverse: the length tier
	// shortens the alignment, which moves its end past measured points, which
	// then stop projecting. Scoring them zero would reward the shortening by
	// making the measurements disappear.
	const point = { name: "M", x: 400, y: 0.05, tolerance: 0.1 };
	const { problem, buildAlignment } = scenario({ points: [point], unprojectable: [point] });

	assert.throws(
		() => solveAlignmentProblem({ problem, buildAlignment, objective: "points", maxIterations: 5 }),
		(e) => e.code === "UNPROJECTABLE_POINT" && e.detail.role === "measured point"
	);
});

test("a candidate the solve wanders onto is rejected, and the run continues", () => {
	// A trial point whose alignment cannot carry a declared point is not a
	// failure of the run, it is a step not taken. The line search sees a failed
	// evaluation and backtracks.
	const carried = { name: "M0", x: 100, y: 0.05, tolerance: 0.1 };
	const far = { name: "M1", x: 290, y: -0.04, tolerance: 0.1 };
	const { problem, buildAlignment, codec } = scenario({ points: [carried, far] });

	// the far point stops projecting once the alignment is shortened past it
	const shrinking = (overlay) => {
		const built = buildAlignment(overlay);
		const total = built.lengths.reduce((sum, value) => sum + value, 0);
		return {
			...built,
			worldToTrack: (x, y) => (x > total ? null : { q: y, s: x }),
		};
	};
	const result = solveAlignmentProblem({
		problem, buildAlignment: shrinking, objective: "points", maxIterations: 20,
	});
	assert.ok(result.candidate.variables.length === codec.freeCount);
	assert.deepEqual([...result.diagnostics.inadmissiblePoints], [],
		"whatever it ended on carries every declared point");
});

test("a point beyond the end is refused, though it projects perfectly well", () => {
	// This is the case that actually occurs. The production projector clamps the
	// foot station to [0, arcLength] and never returns null for a point past an
	// end: it returns the offset from the extended end tangent. Measured on the
	// nine-element alignment, a point 1000 m past the end reports q = 0.0500 m,
	// comfortably inside any tolerance, while sitting a kilometre from the track.
	// A null check cannot see that; the distance can.
	const point = { name: "M", x: 400, y: 0.05, tolerance: 0.1 };
	const { problem, buildAlignment } = scenario({ points: [point] });

	// 100 m past the end of a 300 m alignment, reported the way the production
	// projector reports it: a small offset and a large distance
	const clamping = (overlay) => ({
		...buildAlignment(overlay),
		worldToTrack: () => ({ q: 0.05, s: 300, dist: 100 }),
	});
	assert.throws(
		() => solveAlignmentProblem({
			problem, buildAlignment: clamping, objective: "points", maxIterations: 5,
		}),
		(e) => {
			assert.equal(e.code, "EXTRAPOLATED_PROJECTION");
			assert.ok(Math.abs(e.detail.overshoot - Math.sqrt(100 ** 2 - 0.05 ** 2)) < 1e-9);
			assert.match(e.message, /extended tangent/);
			return true;
		}
	);

	// a genuine foot point has dist = |q| and passes
	const honest = (overlay) => ({
		...buildAlignment(overlay),
		worldToTrack: (x, y) => ({ q: y, s: x, dist: Math.abs(y) }),
	});
	assert.doesNotThrow(() => solveAlignmentProblem({
		problem, buildAlignment: honest, objective: "points", maxIterations: 3,
	}));
});

test("a projector that reports no distance records that the check did not run", () => {
	// A check that quietly does not run is the same fail-open one level up.
	const point = { name: "M", x: 100, y: 0.05, tolerance: 0.1 };
	const { problem, buildAlignment } = scenario({ points: [point] });
	const silent = (overlay) => ({
		...buildAlignment(overlay),
		worldToTrack: (x, y) => ({ q: y, s: x }),          // no dist
	});
	const result = solveAlignmentProblem({
		problem, buildAlignment: silent, objective: "points", maxIterations: 3,
	});
	assert.equal(result.diagnostics.extrapolationChecked, false);

	const withDistance = solveAlignmentProblem({
		problem,
		buildAlignment: (overlay) => ({
			...buildAlignment(overlay),
			worldToTrack: (x, y) => ({ q: y, s: x, dist: Math.abs(y) }),
		}),
		objective: "points", maxIterations: 3,
	});
	assert.equal(withDistance.diagnostics.extrapolationChecked, true);
});

// ---------------------------------------------------------------- admission

test("a design profile nobody has read may not silently become a constraint", () => {
	// Its numbers do not stay advisory once they are here: they become the
	// curvature bound and the transition floor, and the solver runs the alignment
	// onto them.
	const candidate = hauptbahn({ speedKmh: 160 });
	assert.equal(candidate.status, "candidate");

	assert.throws(
		() => createAlignmentConstraintBuilder({
			endPose: END_POSE,
			elementSequence: ["E0", "E1"],
			elementKinds: { E0: "arc", E1: "transition" },
			design: candidate,
		}),
		(e) => {
			assert.ok(e instanceof AlignmentConstraintBuilderError);
			assert.equal(e.code, "UNCONFIRMED_DESIGN_PROFILE");
			assert.match(e.message, /maximumCantRate/, "and it names what is unread");
			assert.match(e.message, /evidence-only/, "and what to declare to proceed anyway");
			return true;
		}
	);
});

test("saying the word admits the profile and marks the result as evidence", () => {
	const candidate = hauptbahn({ speedKmh: 160 });
	const constraints = createAlignmentConstraintBuilder({
		endPose: END_POSE,
		elementSequence: ["E0", "E1"],
		elementKinds: { E0: "arc", E1: "transition" },
		design: candidate,
		admitUnconfirmedDesign: EVIDENCE_ONLY,
	});
	assert.equal(constraints.admission, EVIDENCE_ONLY);
	assert.equal(constraints.admissible, false);

	// and it travels: problem, then proposal, without either having to know how a
	// design profile is declared
	const codec = createAlignmentVariableCodec({
		elements: [
			{ id: "E0", quantities: { length: "free", curvature: "free" }, values: { length: 150, curvature: 0 } },
			{ id: "E1", quantities: { length: "free" }, values: { length: 150 } },
		],
	});
	const problem = createAlignmentOptimizationProblem({
		codec,
		constraints: createAlignmentConstraintBuilder({
			endPose: END_POSE,
			elementSequence: codec.elementSequence,
			elementKinds: { E0: "arc", E1: "transition" },
			design: candidate,
			admitUnconfirmedDesign: EVIDENCE_ONLY,
		}),
		residuals: createAlignmentResidualBuilder({
			metricContext: createIntrinsicMetricContext(),
			points: [{ name: "M", x: 100, y: 0.02, tolerance: 0.1 }],
		}),
	});
	assert.equal(problem.admission, EVIDENCE_ONLY);
	assert.equal(problem.admissible, false);

	const buildAlignment = (overlay) => {
		const lengths = ["E0", "E1"].map((id) => overlay[id]?.length ?? 150);
		const total = lengths.reduce((sum, value) => sum + value, 0);
		return { lengths, endPose: { x: total, y: 0, theta: 0 }, worldToTrack: (x, y) => ({ q: y, s: x }) };
	};
	// two free lengths and one free curvature against three end-pose equalities
	const proposal = solveAlignmentProblem({
		problem, buildAlignment, objective: "points", maxIterations: 5,
	});
	assert.equal(proposal.admission, EVIDENCE_ONLY);
	assert.equal(proposal.admissible, false, "however cleanly it converged");
});

test("a raw design declaration cannot pass as confirmed", () => {
	// Regression, AXTRAN2-REVIEW-003. The gate asked "is this a profile that is
	// not confirmed?" and let everything else through, so the one form carrying
	// no provenance at all - a plain object - was the one form treated as
	// confirmed. A bare { minimumRadius: 400 } became a binding constraint and
	// the result called itself admissible.
	assert.throws(
		() => createAlignmentConstraintBuilder({
			endPose: END_POSE,
			elementSequence: ["E0", "E1"],
			elementKinds: { E0: "arc", E1: "transition" },
			design: { minimumRadius: 400, minimumLength: { transition: 55 } },
		}),
		(e) => {
			assert.ok(e instanceof AlignmentConstraintBuilderError);
			assert.equal(e.code, "UNSOURCED_DESIGN_DECLARATION");
			assert.match(e.message, /no provenance/);
			assert.match(e.message, /createAlignmentDesignProfile/, "and what to build instead");
			return true;
		}
	);

	// with the word it builds, and the result is evidence - never confirmed,
	// because there is no source to read
	const admitted = createAlignmentConstraintBuilder({
		endPose: END_POSE,
		elementSequence: ["E0", "E1"],
		elementKinds: { E0: "arc", E1: "transition" },
		design: { minimumRadius: 400 },
		admitUnconfirmedDesign: EVIDENCE_ONLY,
	});
	assert.equal(admitted.admission, EVIDENCE_ONLY);
	assert.equal(admitted.admissible, false);
	// the limit itself still works; it is the claim about it that was wrong
	assert.ok(Math.abs(admitted.designBounds[0].maximum - 1 / 400) < 1e-15);
	assert.equal(admitted.designBounds[0].source, null, "and it still has no source to give");
});

test("a confirmed profile needs no word, and yields an admissible result", () => {
	const confirmed = createAlignmentDesignProfile({
		id: "read", source: "read", status: "confirmed",
		speed: { value: 30, source: "read", verified: true },
		maximumCant: { value: 0.15, source: "read", verified: true },
		maximumCantDeficiency: { value: 0.1, source: "read", verified: true },
	});
	const constraints = createAlignmentConstraintBuilder({
		endPose: END_POSE,
		elementSequence: ["E0", "E1"],
		elementKinds: { E0: "arc", E1: "transition" },
		design: confirmed,
	});
	assert.equal(constraints.admission, "confirmed");
	assert.equal(constraints.admissible, true);
});

test("a problem with no design profile at all is admissible", () => {
	// The boundary is about unread limits, not about having limits.
	const { problem } = scenario({ points: [{ name: "M", x: 100, y: 0.02, tolerance: 0.1 }] });
	assert.equal(problem.admission, "confirmed");
	assert.equal(problem.admissible, true);
});
