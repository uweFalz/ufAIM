// src/domain/optimization/alignment/AlignmentSQPSolver.js
//
// AXTRAN2 Calculation Kernel - the solver.
//
// Turns a declared problem document into an SQP run and returns a proposal:
// candidates, residuals, diagnostics. It never applies, persists, selects, or
// decides which candidate is the engineering answer.
//
// The objective is chosen by the caller, not by this module. Which quantity
// AXTRAN2 should minimise is an engineering decision that is still open, and
// the two candidates behave very differently:
//
//   "points"             sum of squared point residuals. A least-squares
//                        objective supplies its own curvature through J'J.
//   "accumulated-length" the total element length. Linear, so its Hessian is
//                        exactly zero and the descent estimate
//                        l1'(x; d; eta) <= -d'Qd degenerates to <= 0. Powell's
//                        modified BFGS is what keeps that usable; without it
//                        the line search has no descent guarantee at all.
//
// Both are supported so that the decision can be made on measurements rather
// than on which one the solver happens to allow.
//
// Constraints come from the problem document: poseE and every hardened
// Zwangspunkt are equalities, the element sequence contributes lower bounds on
// the element lengths. An inconsistent linearisation is not an error here: the
// relaxed QP reports how far it had to give up through its slack.
//
// The alignment builder and the projector are injected, so this module stays
// free of geometry imports and of any realization binding.

import { solveSQP } from "../../../lib/math/optim/sqp/solveSQP.js";
import { finiteDiffJacobian } from "../../../lib/math/optim/diff/finiteDiffJacobian.js";
import { scaleEvaluator, scale as toScaled, unscale } from "../../../lib/math/optim/scale/variableScaling.js";

export const ALIGNMENT_SQP_SOLVER_VERSION = "axtran2/alignment-sqp-solver/0.1";

export const OBJECTIVES = Object.freeze(["points", "accumulated-length"]);

export class AlignmentSqpSolverError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "AlignmentSqpSolverError";
		this.code = code;
		this.detail = detail;
	}
}

function error(code, message, detail) {
	throw new AlignmentSqpSolverError(code, message, detail);
}

function wrapAngle(angle) {
	let value = angle;
	while (value > Math.PI) value -= 2 * Math.PI;
	while (value < -Math.PI) value += 2 * Math.PI;
	return value;
}

/**
 * @param {object} input
 * @param {object} input.problem                       from createAlignmentOptimizationProblem
 * @param {(overlay: object) => object} input.buildAlignment
 *        receives the decoded free-variable overlay and returns
 *        { worldToTrack, endPose, lengths } for that parameter set
 * @param {"points"|"accumulated-length"} [input.objective]
 * @param {(overlay: object) => object} [input.analyticJacobian]
 *        optional; returns an object with endPoseJacobian(parameters) and
 *        lateralDerivative(parameters, station), as built by
 *        createAlignmentPoseJacobian. When supplied the finite-difference path
 *        is not used at all.
 * @param {Array<{id: string, residual: (x: number[]) => number, gradient: number[]}>}
 *        [input.extraEqualities]
 *        additional linear equalities on the free variables, used by the
 *        lexicographic driver to hold a budget from an earlier tier
 * @param {number[]} [input.startAt]
 *        starting point in free-variable order; defaults to the declared one.
 *        Used to warm start a later phase from an earlier phase's result.
 * @param {number} [input.maxIterations]
 */
export function solveAlignmentProblem({
	problem,
	buildAlignment,
	analyticJacobian = null,
	objective = "points",
	extraEqualities = [],
	startAt = null,
	maxIterations = 60,
	// Relative slop below which a foot point counts as a genuine perpendicular
	// foot rather than a station clamped to an end. See project().
	extrapolationTolerance = 1e-9,
	relaxationWeight = 1e6,
} = {}) {
	if (!problem?.codec) error("MISSING_PROBLEM", "problem is required");
	if (typeof buildAlignment !== "function") {
		error("MISSING_BUILDER", "buildAlignment is required");
	}
	if (!OBJECTIVES.includes(objective)) {
		error("UNKNOWN_OBJECTIVE", `objective must be one of ${OBJECTIVES.join(", ")}`, { objective });
	}

	const { codec, constraints, residuals } = problem;
	const scales = [...codec.freeScales];
	const declared = [...codec.encode()];
	if (startAt && startAt.length !== declared.length) {
		error("START_LENGTH", "startAt must have one entry per free variable", {
			expected: declared.length, received: startAt.length,
		});
	}
	const x0 = startAt ? [...startAt] : declared;

	const hardPoints = residuals.hardPoints;
	const softPoints = residuals.softPoints;

	// Bounds on the variables come from two declarations that meet here. The
	// element sequence contributes one lower bound per element length, so that
	// no element vanishes. The design limits contribute a two-sided bound on
	// every free curvature, so that no curve is tighter than admissible. Where
	// both speak about one variable the stricter one holds, which is what
	// intersecting the intervals does.
	const lower = codec.freeNames.map(() => -Infinity);
	const upper = codec.freeNames.map(() => Infinity);
	const indexOfName = new Map(codec.freeNames.map((name, i) => [name, i]));
	for (const bound of [...constraints.bounds, ...(constraints.designBounds ?? [])]) {
		const index = indexOfName.get(`${bound.elementId}.${bound.quantity ?? "length"}`);
		if (index === undefined) continue;   // the quantity is held, not free
		if (Number.isFinite(bound.minimum)) lower[index] = Math.max(lower[index], bound.minimum);
		if (Number.isFinite(bound.maximum)) upper[index] = Math.min(upper[index], bound.maximum);
	}
	codec.freeNames.forEach((name, i) => {
		if (lower[i] > upper[i]) {
			error("EMPTY_BOUND_INTERVAL",
				`the declared bounds leave nothing admissible for "${name}"`,
				{ name, lower: lower[i], upper: upper[i] });
		}
	});

	let builds = 0;
	let jacobianEvaluations = 0;
	// set when a projector reported no distance, so the extrapolation check could
	// not be made for at least one point
	let distanceMissing = false;

	// codec names carry the element id; the analytic Jacobian addresses elements
	// by their position in the sequence
	const parameterSpecs = codec.freeNames.map((name) => {
		const dot = name.lastIndexOf(".");
		const elementId = name.slice(0, dot);
		return {
			elementIndex: codec.elementSequence.indexOf(elementId),
			kind: name.slice(dot + 1),
		};
	});

	function realise(x) {
		builds += 1;
		const overlay = codec.decode(x);
		const built = buildAlignment(overlay);
		if (typeof built?.worldToTrack !== "function" || !built?.endPose) {
			error("BUILDER_CONTRACT", "buildAlignment must return { worldToTrack, endPose }");
		}
		return built;
	}

	/**
	 * Project one declared point onto a candidate alignment, or refuse.
	 *
	 * A point that cannot be projected has no residual, and zero is the one value
	 * it must not be given: for a hardened Zwangspunkt zero reads as "exactly
	 * met", so a constraint with no evaluable meaning would be recorded as the
	 * best possible outcome. The declaration layer already refuses to score such
	 * a point - AlignmentResidualBuilder reports it as `projected: false,
	 * residual: null, met: false` - and the solver contradicting its own
	 * declaration layer is the defect, not the missing number.
	 *
	 * For the soft points the same zero is worse than silent, it is perverse.
	 * Tier 1 minimises length; shortening the alignment moves its end past
	 * measured points, which then stop projecting and score zero. Shortening
	 * would be rewarded by making the measurements disappear.
	 *
	 * So an unprojectable point makes the whole evaluation inadmissible. During
	 * the solve that rejects the trial point - the line search treats a failed
	 * evaluation as a step not taken - and at the declared start it comes out to
	 * the caller with the point named.
	 *
	 * The second way, which is the one that actually happens. The production
	 * projector clamps the foot station to [0, arcLength] and never returns null
	 * for a point beyond the ends: it returns the offset from the END TANGENT,
	 * extended. Measured on the nine-element alignment, a point 1000 m past the
	 * end reports q = 0.0500 m - comfortably inside any tolerance - while sitting
	 * a kilometre away from the track. That is a lateral offset from a line the
	 * alignment does not occupy, and nothing in the number says so.
	 *
	 * It is cheap to catch. At a true foot point the offset IS the distance;
	 * where the station was clamped, the two differ by the longitudinal overshoot.
	 * Measured: dist - |q| is 2.8e-17 m at genuine foot points across the whole
	 * alignment, and already 9.9e-4 m one centimetre past the end. Any threshold
	 * between separates them, and 1e-9 catches an overshoot of about ten microns.
	 *
	 * A projector that reports no distance forgoes this check. That is recorded
	 * rather than passed over, because a check that quietly does not run is the
	 * same fail-open one level up.
	 */
	function project(built, point, role) {
		const projected = built.worldToTrack(point.x, point.y);
		if (!Number.isFinite(projected?.q)) {
			error(
				"UNPROJECTABLE_POINT",
				`${role} "${point.name}" cannot be projected onto this alignment, so it has no `
					+ "residual; the candidate is not admissible",
				{ pointName: point.name, role, x: point.x, y: point.y }
			);
		}
		if (Number.isFinite(projected.dist)) {
			const gap = projected.dist - Math.abs(projected.q);
			if (gap > extrapolationTolerance * Math.max(1, Math.abs(projected.q))) {
				const overshoot = Math.sqrt(Math.max(0, projected.dist ** 2 - projected.q ** 2));
				error(
					"EXTRAPOLATED_PROJECTION",
					`${role} "${point.name}" has no foot point on this alignment: it lies `
						+ `${overshoot.toFixed(3)} m beyond an end, and its offset of `
						+ `${projected.q.toFixed(4)} m is measured from the extended tangent, not `
						+ "from the alignment",
					{ pointName: point.name, role, overshoot, offset: projected.q, distance: projected.dist }
				);
			}
		} else {
			distanceMissing = true;
		}
		return projected;
	}

	/** Which declared points a candidate fails to carry, and why. */
	function inadmissiblePoints(built) {
		const failed = [];
		for (const [role, points] of [["zwangspunkt", hardPoints], ["measured point", softPoints]]) {
			for (const point of points) {
				try {
					project(built, point, role);
				} catch (caught) {
					if (!(caught instanceof AlignmentSqpSolverError)) throw caught;
					failed.push(Object.freeze({
						name: point.name, role, reason: caught.code,
						overshoot: caught.detail?.overshoot ?? null,
					}));
				}
			}
		}
		return failed;
	}

	/** Equality residuals: end pose first, then every hardened Zwangspunkt. */
	function equalityResiduals(built) {
		const pose = built.endPose;
		const target = constraints.endPose;
		const values = [
			pose.x - target.x,
			pose.y - target.y,
			wrapAngle(pose.theta - target.theta),
		];
		for (const point of hardPoints) {
			values.push(project(built, point, "zwangspunkt").q - point.target);
		}
		return values;
	}

	/** Residuals of the equalities carried over from an earlier tier. */
	function extraResiduals(x) {
		return extraEqualities.map((constraint) => constraint.residual(x));
	}

	/** Soft point residuals, each in units of its own tolerance. */
	function softResiduals(built) {
		return softPoints.map((point) =>
			(project(built, point, "measured point").q - point.target) / point.tolerance);
	}

	function accumulatedLength(x) {
		// Only the free lengths vary; the held ones are a constant offset that
		// does not change the gradient.
		let total = 0;
		codec.freeNames.forEach((name, i) => {
			if (name.endsWith(".length")) total += x[i];
		});
		return total;
	}

	function evaluateAnalytically(x) {
		const overlay = codec.decode(x);
		const built = realise(x);
		const geometry = analyticJacobian(overlay);
		jacobianEvaluations += 1;

		const h = [...equalityResiduals(built), ...extraResiduals(x)];

		// end pose: three rows straight from the chain rule
		const poseRows = geometry.endPoseJacobian(parameterSpecs);
		const Jh = [
			poseRows.map((d) => d.dx),
			poseRows.map((d) => d.dy),
			poseRows.map((d) => d.dtheta),
		];
		// hardened Zwangspunkte: one row each, at their own foot station
		for (const point of hardPoints) {
			// project() has already refused anything unprojectable, so a row here
			// always stands for a residual that exists
			const projected = project(built, point, "zwangspunkt");
			Jh.push(geometry.lateralDerivative(parameterSpecs, projected.s));
		}
		for (const constraint of extraEqualities) Jh.push([...constraint.gradient]);

		if (objective === "accumulated-length") {
			const gradF = codec.freeNames.map((name) => (name.endsWith(".length") ? 1 : 0));
			return { f: accumulatedLength(x), gradF, h, Jh };
		}

		const r = softResiduals(built);
		const Jr = softPoints.map((point) => {
			const projected = project(built, point, "measured point");
			const row = geometry.lateralDerivative(parameterSpecs, projected.s);
			return row.map((value) => value / point.tolerance);
		});
		const f = 0.5 * r.reduce((sum, value) => sum + value * value, 0);
		const gradF = parameterSpecs.map((_, j) =>
			Jr.reduce((sum, row, i) => sum + row[j] * r[i], 0));
		return { f, gradF, h, Jh };
	}

	function evaluate(x) {
		if (typeof analyticJacobian === "function") return evaluateAnalytically(x);

		const built = realise(x);
		const h = [...equalityResiduals(built), ...extraResiduals(x)];
		// Before any derivative work: a point that cannot be projected has to
		// surface as itself, not as a differencing failure three frames later.
		// This costs nothing - the residuals are needed below anyway.
		const r = objective === "points" ? softResiduals(built) : null;

		const jacobian = finiteDiffJacobian({
			x,
			scales,
			relative: 1e-4,
			residual: (probe) => {
				const probed = realise(probe);
				const base = [...equalityResiduals(probed), ...extraResiduals(probe)];
				return objective === "points" ? [...base, ...softResiduals(probed)] : base;
			},
		});
		if (!jacobian.ok) {
			error("JACOBIAN_FAILED", `finite differences failed: ${jacobian.status}`, jacobian);
		}

		const Jh = jacobian.J.slice(0, h.length);

		if (objective === "accumulated-length") {
			const gradF = codec.freeNames.map((name) => (name.endsWith(".length") ? 1 : 0));
			return { f: accumulatedLength(x), gradF, h, Jh };
		}

		const Jr = jacobian.J.slice(h.length);
		const f = 0.5 * r.reduce((sum, value) => sum + value * value, 0);
		const gradF = x.map((_, j) => Jr.reduce((sum, row, i) => sum + row[j] * r[i], 0));
		return { f, gradF, h, Jh };
	}

	// The solve runs in scaled coordinates. A length in metres and a curvature
	// near 1e-3 1/m differ by five orders of magnitude in the Jacobian, and an
	// identity Hessian against a gradient of that spread drives the QP into its
	// bounds on every iteration. The scaling is by engineering magnitude, fixed
	// before the solve, not by Jacobian norm.
	const scaledRun = solveSQP({
		x0: toScaled(x0, scales),
		evaluate: scaleEvaluator(evaluate, scales),
		lower: toScaled(lower, scales),
		upper: toScaled(upper, scales),
		maxIterations,
		relaxationWeight,
		initialHessianScale: 1,
	});
	const run = {
		...scaledRun,
		x: scaledRun.x ? unscale(scaledRun.x, scales) : null,
	};

	// The result is reported even when the point it ended on cannot carry every
	// declared point: refusing to report would lose the diagnosis along with the
	// candidate. The proposal says so instead, and is not ok.
	const built = run.x ? realise(run.x) : null;
	const inadmissible = built ? inadmissiblePoints(built) : [];
	const finalEquality = built && inadmissible.length === 0 ? equalityResiduals(built) : [];
	const finalExtra = run.x ? extraResiduals(run.x) : [];
	const finalSoft = built && inadmissible.length === 0 ? softResiduals(built) : [];

	return Object.freeze({
		version: ALIGNMENT_SQP_SOLVER_VERSION,
		type: "proposal",
		objective,
		status: inadmissible.length ? "inadmissible_points" : run.status,
		ok: run.ok === true && inadmissible.length === 0,
		// Whether this proposal may be treated as an engineering answer. A run
		// that converged cleanly on limits nobody has read is still evidence and
		// not an answer, and the two must not look alike.
		admission: problem.admission ?? "confirmed",
		admissible: problem.admissible !== false && inadmissible.length === 0,
		candidate: Object.freeze({
			variables: Object.freeze(run.x ? [...run.x] : []),
			names: codec.freeNames,
			overlay: run.x ? codec.decode(run.x) : null,
		}),
		diagnostics: Object.freeze({
			iterations: run.iterations,
			alignmentBuilds: builds,
			jacobianKind: typeof analyticJacobian === "function" ? "analytic" : "finite-difference",
			jacobianEvaluations,
			// declared points the final candidate cannot carry, with the reason;
			// empty is the normal case and anything else makes it inadmissible
			inadmissiblePoints: Object.freeze(inadmissible),
			// false when a projector reported no distance, so no point could be
			// checked for being an extrapolation past an end
			extrapolationChecked: !distanceMissing,
			endPoseResidual: finalEquality.slice(0, 3),
			endPoseDistance: built ? Math.hypot(finalEquality[0], finalEquality[1]) : null,
			hardPointResiduals: Object.freeze(hardPoints.map((point, i) => Object.freeze({
				name: point.name,
				residual: finalEquality[3 + i] ?? null,
			}))),
			softOutsideTolerance: finalSoft.filter((value) => Math.abs(value) > 1).length,
			softResidualRms: finalSoft.length
				? Math.sqrt(finalSoft.reduce((sum, v) => sum + v * v, 0) / finalSoft.length)
				: 0,
			// slack of the relaxed QP in the last recorded iteration: how far the
			// linearised constraints had to be given up to stay solvable
			extraEqualityResiduals: Object.freeze(extraEqualities.map((constraint, i) => Object.freeze({
				id: constraint.id,
				residual: finalExtra[i] ?? null,
			}))),
			accumulatedLength: run.x ? accumulatedLength(run.x) : null,
			// The whole alignment, held elements included. accumulatedLength is the
			// objective and sums only the free ones; this is the thing that has a
			// physical length, and a heading error needs it as a lever arm before
			// it can be compared against a distance.
			alignmentLength: Array.isArray(built?.lengths)
				? built.lengths.reduce((sum, value) => sum + value, 0)
				: null,
			finalRelaxation: run.history?.at(-1)?.delta ?? null,
			history: Object.freeze(run.history ?? []),
			reason: run.reason ?? null,
		}),
		// A proposal is never an engineering decision. Applying, persisting and
		// selecting all happen outside this kernel.
		delta: null,
	});
}
