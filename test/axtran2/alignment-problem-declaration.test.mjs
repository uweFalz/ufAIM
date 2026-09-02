import assert from "node:assert/strict";
import test from "node:test";

const BASE = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const load = (name) => import(new URL(name, BASE));

const { createAlignmentVariableCodec, AlignmentVariableCodecError, VARIABLE_ROLES } =
	await load("AlignmentVariableCodec.js");
const { createAlignmentConstraintBuilder, AlignmentConstraintBuilderError, ELEMENT_KINDS, EVIDENCE_ONLY } =
	await load("AlignmentConstraintBuilder.js");
const { createAlignmentResidualBuilder, AlignmentResidualBuilderError } =
	await load("AlignmentResidualBuilder.js");
const { createAlignmentOptimizationProblem, AlignmentOptimizationProblemError } =
	await load("AlignmentOptimizationProblem.js");
const { evaluateAlignmentOptimizationProblem } = await load("AlignmentOptimizationDiagnostics.js");
const {
	createMetricContext,
	createIntrinsicMetricContext,
	metricComparabilityConflict,
	MetricContextError,
	LENGTH_AUTHORITIES,
} = await load("MetricContext.js");

const INTRINSIC = createIntrinsicMetricContext();
const END_POSE = { x: 1000, y: 250, theta: 0.3 };

function codecOf(freeCurvature = true) {
	return createAlignmentVariableCodec({
		elements: [
			{ id: "E0", quantities: { length: "held" }, values: { length: 200 } },
			{ id: "E1", quantities: { length: "free" }, values: { length: 90 } },
			{
				id: "E2",
				quantities: { length: "free", curvature: freeCurvature ? "free" : "held" },
				values: { length: 300, curvature: 1 / 700 },
			},
			{ id: "E3", quantities: { length: "free" }, values: { length: 90 } },
		],
	});
}

const POINTS = [
	{ name: "M0", x: 10, y: 0.03, tolerance: 0.1 },
	{ name: "M1", x: 20, y: -0.02, tolerance: 0.1 },
	{ name: "Z0", x: 30, y: 0.4, target: 0, tolerance: 0.01, kind: "zwangspunkt" },
];

// straight reference axis along +x, so lateral offset is simply y
const worldToTrack = (x, y) => ({ q: y, s: x });

// ---------------------------------------------------------------- codec

test("codec declares held, free and derived roles and scales by engineering magnitude", () => {
	assert.deepEqual([...VARIABLE_ROLES], ["held", "free", "derived"]);
	const codec = codecOf();
	assert.equal(codec.freeCount, 4);
	assert.equal(codec.heldCount, 1);
	assert.deepEqual([...codec.freeNames], ["E1.length", "E2.length", "E2.curvature", "E3.length"]);
	// one metre of length, 1e-3 1/m of curvature; never a Jacobian norm
	assert.deepEqual([...codec.freeScales], [1, 1, 1e-3, 1]);
	assert.equal(codec.roleOf("E0.length"), "held");
});

test("codec round trips only the free variables", () => {
	const codec = codecOf();
	assert.deepEqual([...codec.encode()], [90, 300, 1 / 700, 90]);
	const overlay = codec.decode([95, 310, 0.0015, 88]);
	assert.deepEqual(overlay.E2, { length: 310, curvature: 0.0015 });
	assert.equal("E0" in overlay, false, "held variables never appear in the overlay");
	assert.throws(() => codec.decode([1, 2]), (e) => e.code === "VECTOR_LENGTH");
});

test("codec refuses a declaration with nothing free", () => {
	assert.throws(
		() => createAlignmentVariableCodec({
			elements: [{ id: "E0", quantities: { length: "held" }, values: { length: 1 } }],
		}),
		(e) => e instanceof AlignmentVariableCodecError && e.code === "NO_FREE_VARIABLES"
	);
});

// ---------------------------------------------------------------- metric context

test("metric context enumerates the length authorities and defaults the intrinsic one", () => {
	assert.deepEqual([...LENGTH_AUTHORITIES], ["intrinsic", "grid", "ground", "ellipsoid"]);
	assert.equal(INTRINSIC.lengthAuthority, "intrinsic");
	assert.equal(INTRINSIC.distanceOperator, "arc-length");
	assert.equal(INTRINSIC.provenance, null);
});

test("a projected authority may not be declared without provenance", () => {
	assert.throws(
		() => createMetricContext({
			id: "utm32", lengthAuthority: "grid", unit: "m", referenceFrame: "EPSG:25832",
		}),
		(e) => e instanceof MetricContextError && e.code === "MISSING_PROVENANCE"
	);
});

test("a CRS identifier alone does not make two contexts comparable", () => {
	const grid = createMetricContext({
		id: "utm32.grid", lengthAuthority: "grid", unit: "m", referenceFrame: "EPSG:25832",
		provenance: { projection: "UTM32N" },
	});
	const ground = createMetricContext({
		id: "utm32.ground", lengthAuthority: "ground", unit: "m", referenceFrame: "EPSG:25832",
		distanceOperator: "ground-reduced", provenance: { projection: "UTM32N" },
	});
	// same reference frame, same unit, different measurement law
	assert.match(metricComparabilityConflict(grid, ground), /length authority differs/);
	assert.equal(metricComparabilityConflict(grid, grid), null);
});

// ---------------------------------------------------------------- residuals

test("residuals require a metric context", () => {
	assert.throws(
		() => createAlignmentResidualBuilder({ points: POINTS }),
		(e) => e instanceof AlignmentResidualBuilderError && e.code === "MISSING_METRIC_CONTEXT"
	);
});

test("a point measured under another authority is refused, not divided", () => {
	const grid = createMetricContext({
		id: "utm32", lengthAuthority: "grid", unit: "m", referenceFrame: "EPSG:25832",
		provenance: { projection: "UTM32N" },
	});
	assert.throws(
		() => createAlignmentResidualBuilder({
			metricContext: INTRINSIC,
			points: [{ name: "P", x: 0, y: 0, tolerance: 0.1, metricContext: grid }],
		}),
		(e) => e.code === "INCOMPARABLE_METRIC_CONTEXT"
	);
});

test("measured point, Zwangspunkt and prescribed offset are one mechanism", () => {
	const residuals = createAlignmentResidualBuilder({
		metricContext: INTRINSIC,
		points: [
			{ name: "M", x: 0, y: 0.05, tolerance: 0.1 },
			{ name: "Z", x: 0, y: 0.005, tolerance: 0.01, kind: "zwangspunkt" },
			{ name: "O", x: 0, y: 0.25, target: 0.25, tolerance: 0.01 },
		],
	});
	const evaluated = residuals.evaluate(worldToTrack);
	assert.deepEqual(evaluated.map((p) => p.met), [true, true, true]);
	assert.equal(evaluated[0].residual, 0.5);
	assert.equal(evaluated[2].deviation, 0);
});

test("an unprojectable point is reported, not silently scored", () => {
	const residuals = createAlignmentResidualBuilder({
		metricContext: INTRINSIC,
		points: [{ name: "P", x: 0, y: 0, tolerance: 0.1 }],
	});
	const [point] = residuals.evaluate(() => null);
	assert.equal(point.projected, false);
	assert.equal(point.residual, null);
	assert.equal(point.met, false);
});

test("a point that fell onto an extension of the alignment is not scored either", () => {
	// Projectors clamp the foot station to the ends - Alignment2D does - so a
	// point past an end comes back with the offset from the extended end tangent
	// and no hint that it did. Measured on a 1430 m alignment, a point a
	// kilometre past the end reports an offset of 0.0500 m, which would be
	// scored as comfortably met. The distance gives it away: at a true foot
	// point the offset IS the distance.
	const residuals = createAlignmentResidualBuilder({
		metricContext: INTRINSIC,
		points: [{ name: "P", x: 0, y: 0.05, tolerance: 0.1 }],
	});

	const [beyond] = residuals.evaluate(() => ({ q: 0.05, s: 1430, dist: 1000 }));
	assert.equal(beyond.projected, false, "it must not be scored");
	assert.equal(beyond.extrapolated, true);
	assert.equal(beyond.met, false);
	assert.equal(beyond.residual, null);
	assert.ok(Math.abs(beyond.overshoot - Math.sqrt(1000 ** 2 - 0.05 ** 2)) < 1e-9);
	assert.equal(beyond.offset, 0.05, "the misleading number is kept, for the diagnosis");
	assert.equal(beyond.station, 1430);

	// a genuine foot point has dist = |q| and is scored as before
	const [honest] = residuals.evaluate(() => ({ q: 0.05, s: 700, dist: 0.05 }));
	assert.equal(honest.projected, true);
	assert.equal(honest.extrapolated, false);
	assert.equal(honest.met, true);
	assert.equal(honest.residual, 0.5);

	// a projector that reports no distance cannot be checked, and says so rather
	// than claiming it passed
	const [unchecked] = residuals.evaluate(() => ({ q: 0.05, s: 700 }));
	assert.equal(unchecked.projected, true);
	assert.equal(unchecked.extrapolated, null, "unknown, not false");
});

test("the diagnostics keep the two unscoreable cases apart", () => {
	const residuals = createAlignmentResidualBuilder({
		metricContext: INTRINSIC,
		points: [
			{ name: "onTrack", x: 10, y: 0.02, tolerance: 0.1 },
			{ name: "beyondEnd", x: 999, y: 0.05, tolerance: 0.1 },
		],
	});
	const codec = codecOf();
	const problem = createAlignmentOptimizationProblem({
		codec,
		constraints: createAlignmentConstraintBuilder({
			endPose: END_POSE, elementSequence: codec.elementSequence, minimumElementLength: 20,
		}),
		residuals,
	});
	const report = evaluateAlignmentOptimizationProblem({
		problem,
		worldToTrack: (x, y) => (x > 500
			? { q: 0.05, s: 500, dist: x - 500 }      // clamped to the end
			: { q: y, s: x, dist: Math.abs(y) }),
	});
	assert.equal(report.summary.unprojected, 1);
	assert.equal(report.summary.extrapolated, 1, "and it is the same one, named as what it is");
	assert.deepEqual(report.summary.extrapolatedPoints.map((p) => p.name), ["beyondEnd"]);
	assert.ok(report.summary.extrapolatedPoints[0].overshoot > 400);
	// and it is kept out of the ranking rather than ranked as excellent
	assert.equal(report.sharpening.every((p) => p.name !== "beyondEnd"), true);
});

// ---------------------------------------------------------------- problem

test("the degree-of-freedom budget subtracts poseE and each hardened Zwangspunkt", () => {
	const codec = codecOf();
	const soft = createAlignmentOptimizationProblem({
		codec,
		constraints: createAlignmentConstraintBuilder({
			endPose: END_POSE, elementSequence: codec.elementSequence, minimumElementLength: 20,
		}),
		residuals: createAlignmentResidualBuilder({ metricContext: INTRINSIC, points: POINTS }),
	});
	assert.equal(soft.budget.degreesOfFreedom, 1, "4 free minus 3 end-pose equalities");
	assert.equal(soft.budget.sequenceBounds, 4, "one lower bound per element, never subtracted");

	const hard = createAlignmentOptimizationProblem({
		codec,
		constraints: createAlignmentConstraintBuilder({
			endPose: END_POSE, elementSequence: codec.elementSequence,
			minimumElementLength: 20, hardPoints: [{ name: "Z0" }],
		}),
		residuals: createAlignmentResidualBuilder({
			metricContext: INTRINSIC,
			points: POINTS.map((p) => (p.name === "Z0" ? { ...p, enforcement: "hard" } : p)),
		}),
	});
	assert.equal(hard.budget.hardenedPoints, 1);
	assert.equal(hard.budget.degreesOfFreedom, 0, "hardening costs exactly one degree of freedom");
});

test("over-constraining is refused by name, not as a generic failure", () => {
	const codec = codecOf(false); // 3 free
	const names = ["Z0", "H1", "H2"];
	assert.throws(
		() => createAlignmentOptimizationProblem({
			codec,
			constraints: createAlignmentConstraintBuilder({
				endPose: END_POSE, elementSequence: codec.elementSequence,
				hardPoints: names.map((name) => ({ name })),
			}),
			residuals: createAlignmentResidualBuilder({
				metricContext: INTRINSIC,
				points: names.map((name, i) => ({
					name, x: i, y: 0, tolerance: 0.01, enforcement: "hard",
				})),
			}),
		}),
		(e) => {
			assert.ok(e instanceof AlignmentOptimizationProblemError);
			assert.equal(e.code, "OVER_CONSTRAINED");
			assert.equal(e.detail.shortfall, 3, "3 free against 6 equalities");
			assert.deepEqual(e.detail.releaseCandidates, names);
			return true;
		}
	);
});

test("enforcement declared on a point must match the constraint declaration", () => {
	const codec = codecOf();
	assert.throws(
		() => createAlignmentOptimizationProblem({
			codec,
			constraints: createAlignmentConstraintBuilder({
				endPose: END_POSE, elementSequence: codec.elementSequence,
			}),
			residuals: createAlignmentResidualBuilder({
				metricContext: INTRINSIC,
				points: POINTS.map((p) => (p.name === "Z0" ? { ...p, enforcement: "hard" } : p)),
			}),
		}),
		(e) => e.code === "UNDECLARED_HARD_POINT" && e.detail.pointName === "Z0"
	);
});

// ---------------------------------------------------------------- diagnostics

test("sharpening ranks the soft points and surfaces the wrong one first", () => {
	const codec = codecOf();
	const problem = createAlignmentOptimizationProblem({
		codec,
		constraints: createAlignmentConstraintBuilder({
			endPose: END_POSE, elementSequence: codec.elementSequence,
		}),
		residuals: createAlignmentResidualBuilder({ metricContext: INTRINSIC, points: POINTS }),
	});
	const report = evaluateAlignmentOptimizationProblem({ problem, worldToTrack, endPose: END_POSE });

	// Z0 sits 0.4 m off a 0.01 m tolerance; the measured points are within theirs
	assert.equal(report.sharpening[0].name, "Z0");
	assert.equal(report.sharpening[0].met, false);
	assert.ok(
		Math.abs(report.sharpening[0].residual) > 10 * Math.abs(report.sharpening[1].residual),
		"the wrong point separates from the rest by an order of magnitude"
	);
	assert.equal(report.summary.softOutsideTolerance, 1);
	assert.equal(report.endPose.distance, 0);
});

test("hardened points are reported as unrankable rather than scored", () => {
	const codec = codecOf();
	const problem = createAlignmentOptimizationProblem({
		codec,
		constraints: createAlignmentConstraintBuilder({
			endPose: END_POSE, elementSequence: codec.elementSequence, hardPoints: [{ name: "Z0" }],
		}),
		residuals: createAlignmentResidualBuilder({
			metricContext: INTRINSIC,
			points: POINTS.map((p) => (p.name === "Z0" ? { ...p, enforcement: "hard" } : p)),
		}),
	});
	const report = evaluateAlignmentOptimizationProblem({ problem, worldToTrack });
	assert.deepEqual(report.sharpening.map((r) => r.name), ["M0", "M1"]);
	assert.deepEqual(report.unrankable.map((u) => u.name), ["Z0"]);
	assert.match(report.unrankable[0].reason, /does not reveal itself/);
});

// ---------------------------------------------------------------- boundary

test("the declaration layer declares only; it neither solves nor applies", async () => {
	const sources = await Promise.all([
		"AlignmentVariableCodec.js",
		"AlignmentConstraintBuilder.js",
		"AlignmentResidualBuilder.js",
		"AlignmentOptimizationProblem.js",
		"AlignmentOptimizationDiagnostics.js",
		"MetricContext.js",
	].map(async (name) => {
		const { readFile } = await import("node:fs/promises");
		return [name, await readFile(new URL(name, BASE), "utf8")];
	}));

	for (const [name, source] of sources) {
		const code = source
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
		// no solving, no authority, no persistence, no workspace
		for (const forbidden of [
			/\bsolve[A-Z(]/, /\bSpot\./, /localStorage|indexedDB/,
			/\bapply[A-Z(]/, /\bpersist/i, /\bworkspace/i, /\bdocument\b|\bwindow\b/,
		]) {
			assert.doesNotMatch(code, forbidden, `${name} must not contain ${forbidden}`);
		}
		// only siblings inside this package may be imported
		const specifiers = [
			...code.matchAll(/^\s*(?:import|export)\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm),
			...code.matchAll(/^\s*import\s*["']([^"']+)["']/gm),
		].map((match) => match[1]);
		for (const spec of specifiers) {
			assert.match(spec, /^\.\/[A-Za-z]+\.js$/, `${name} imports outside the package: ${spec}`);
		}
	}
});

// ---------------------------------------------------------------- tier 3

const KINDS = { E0: "straight", E1: "transition", E2: "arc", E3: "transition" };
// The plain-object form carries no provenance, so it is never admissible and
// always needs the word. These tests are about the arithmetic of the limits,
// not about admission, and say so once here.
const tier3 = (design) => createAlignmentConstraintBuilder({
	endPose: END_POSE,
	elementSequence: ["E0", "E1", "E2", "E3"],
	minimumElementLength: 20,
	elementKinds: KINDS,
	design,
	admitUnconfirmedDesign: EVIDENCE_ONLY,
});

test("a smallest radius becomes a two-sided bound on curvature, and only on arcs", () => {
	// A curve may run either way and may straighten out entirely; what it may
	// not do is be tighter than the design allows. That is a box, not a floor.
	const built = tier3({ minimumRadius: 600 });
	assert.equal(built.designBounds.length, 1, "one bound, on the one arc");
	const [bound] = built.designBounds;
	assert.equal(bound.elementId, "E2");
	assert.equal(bound.quantity, "curvature");
	assert.equal(bound.reason, "minimum-radius");
	assert.ok(Math.abs(bound.maximum - 1 / 600) < 1e-15);
	assert.ok(Math.abs(bound.minimum + 1 / 600) < 1e-15, "the other direction is admissible too");
});

test("a design length takes over from the sequence bound, and says so", () => {
	const built = tier3({ minimumLength: { straight: 40, arc: 60, transition: 60 } });
	const byId = Object.fromEntries(built.bounds.map((bound) => [bound.elementId, bound]));
	assert.equal(byId.E0.minimum, 40);
	assert.equal(byId.E0.binding, "design", "40 is stricter than the sequence bound of 20");
	assert.equal(byId.E1.minimum, 60);
	assert.equal(byId.E0.sequenceMinimum, 20, "and the sequence bound is still recorded");

	// the other way round: where the sequence is stricter it keeps speaking
	const sequenceWins = createAlignmentConstraintBuilder({
		endPose: END_POSE, elementSequence: ["E0"], minimumElementLength: 90,
		elementKinds: { E0: "straight" }, design: { minimumLength: { straight: 40 } },
		admitUnconfirmedDesign: EVIDENCE_ONLY,
	});
	assert.equal(sequenceWins.bounds[0].minimum, 90);
	assert.equal(sequenceWins.bounds[0].binding, "element-sequence");
});

test("the plain form declares literal limits and derives nothing", () => {
	// It used to carry a kinematics of its own, which meant two different
	// transition rules lived in this kernel - and the wrong one, once the
	// governing rule book turned out to state the requirement as a ramp gradient
	// rather than as a rate over time. Deriving belongs with
	// createAlignmentDesignProfile, which carries the provenance that makes a
	// derivation reviewable; this form carries none and is never admissible.
	const built = tier3({ minimumRadius: 600, minimumLength: { transition: 80 } });
	assert.ok(Math.abs(built.designBounds[0].maximum - 1 / 600) < 1e-15);
	const byId = Object.fromEntries(built.bounds.map((bound) => [bound.elementId, bound]));
	assert.equal(byId.E1.minimum, 80, "the declared transition length, taken as given");
	assert.equal(built.admissible, false);

	// nothing is invented where nothing is declared
	const bare = createAlignmentConstraintBuilder({
		endPose: END_POSE, elementSequence: ["E0"], minimumElementLength: 20,
	});
	assert.equal(bare.design, null);
	assert.deepEqual([...bare.designBounds], []);
});

test("a design profile that names element kinds needs to be told them", () => {
	assert.deepEqual([...ELEMENT_KINDS], ["straight", "arc", "transition"]);
	assert.throws(
		() => createAlignmentConstraintBuilder({
			endPose: END_POSE, elementSequence: ["E0"],
			design: { minimumLength: { straight: 40 } },
			admitUnconfirmedDesign: EVIDENCE_ONLY,
		}),
		(e) => e.code === "MISSING_ELEMENT_KINDS"
	);
	assert.throws(
		() => createAlignmentConstraintBuilder({
			endPose: END_POSE, elementSequence: ["E0"],
			elementKinds: { E0: "spiral" }, design: { minimumRadius: 600 },
			admitUnconfirmedDesign: EVIDENCE_ONLY,
		}),
		(e) => e.code === "UNKNOWN_ELEMENT_KIND"
	);
	assert.throws(() => tier3({ minimumRadius: -1 }), (e) => e.code === "INVALID_DESIGN");
});
