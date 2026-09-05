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

import { footPointOf } from "./AlignmentResidualBuilder.js";
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
	// Free variables to hold at their starting value, by codec name. Held by
	// collapsing their bounds onto the point, which is what "held" already means
	// everywhere below it: the subproblem cannot step, and the multiplier fit
	// drops the column because a bound absorbs that part of the gradient.
	pinned = [],
	maxIterations = 60,
	relaxationWeight = 1e6,
	// forwarded rather than fixed here: which penalty rule suits an alignment is
	// a question about this problem, not about the optimiser
	penaltyRule,
	penaltySafety,
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
	if (!Array.isArray(pinned)) error("INVALID_PINNED", "pinned must be an array of free-variable names");
	for (const name of pinned) {
		const index = indexOfName.get(name);
		if (index === undefined) {
			error("UNKNOWN_PINNED", `"${name}" is not a free variable of this problem`, { name });
		}
		// onto the starting point, not onto the declaration: a progressive solve
		// pins what the previous stage left behind, not what the problem was
		// written with
		const value = Math.min(Math.max(x0[index], lower[index]), upper[index]);
		lower[index] = value;
		upper[index] = value;
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
	// set when a projector offered neither a longitudinal residual nor a
	// distance, so the extrapolation check could not be made for at least one
	// point
	let footCheckMissing = false;

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

	// The end pose is three rows in two units: two positions in metres and a
	// heading in radians. Left that way they are not comparable, and everything
	// downstream inherits it. Measured on the nine-element scenario: row norms of
	// 87, 254 and 0.407, so the subproblem satisfied the heading row two hundred
	// times less accurately than the positions - Jh d + h came back as
	// [-2.3e-7, -1.1e-7, +2.2e-5] where the linearisation says all three are
	// zero. The heading multiplier is correspondingly large, so its penalty
	// weight was 367, and a step the subproblem called feasible raised the merit
	// by 8.1e-3 against an objective gain of 7.3e-3. The line search then failed
	// at every step length, the region collapsed, the relaxation took over and
	// the subproblem finally degenerated.
	//
	// The remedy is the one the diagnostics already use and the solve did not: a
	// heading error is a distance once it is carried out to the far end, so the
	// heading row is multiplied by that lever arm and all three rows are metres.
	//
	// This is exact in the dual. Scaling a row by s scales its multiplier by 1/s,
	// so grad f + Jh' lambda is unchanged and the KKT residual with it. An
	// earlier attempt at row scaling was reverted because the stationarity
	// thresholds are calibrated against unscaled gradients; that objection does
	// not reach this, because the gradient it is measured against does not move.
	//
	// Fixed before the solve, from the starting alignment, like the variable
	// scaling above it. A scale that follows the iterate is not a scale but
	// another nonlinearity, and the merit built on it would have no fixed
	// stationary point to find.
	const HEADING_ROW = 2;
	const leverArm = (() => {
		let built = null;
		try { built = realise(x0); } catch { return 1; }
		const total = Array.isArray(built?.lengths)
			? built.lengths.reduce((sum, value) => sum + value, 0)
			: null;
		return Number.isFinite(total) && total > 0 ? total : 1;
	})();

	/**
	 * In place, on the rows the solve sees. The residuals reported at the end are
	 * taken from equalityResiduals directly and stay in their own units: a heading
	 * is reported as an angle, whatever the solve had to do to weigh it.
	 */
	function scaleEqualityRows(h, Jh) {
		if (leverArm === 1 || h.length <= HEADING_ROW) return;
		h[HEADING_ROW] *= leverArm;
		Jh[HEADING_ROW] = Jh[HEADING_ROW].map((value) => value * leverArm);
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
		const foot = footPointOf(projected);
		if (foot.extrapolated) {
			error(
				"EXTRAPOLATED_PROJECTION",
				`${role} "${point.name}" has no foot point on this alignment: it lies `
					+ `${foot.overshoot.toFixed(3)} m beyond an end, and its offset of `
					+ `${projected.q.toFixed(4)} m is measured from the extended tangent, not `
					+ "from the alignment",
				{ pointName: point.name, role, overshoot: foot.overshoot, offset: projected.q }
			);
		}
		if (!foot.checkable) footCheckMissing = true;
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

	// ---------------------------------------------------------------- ramp rule
	//
	// L >= m du per transition, with du the cant change between the curvatures on
	// either side. Both are variables, so this is a genuine inequality coupling a
	// length to two curvatures - not something a box bound can hold, which is why
	// it used to be collapsed into one by taking du at its largest.
	//
	// One row per ramp, m |du| - L <= 0, with the sign of du taken at the current
	// point. The obvious alternative - two rows, m(u_out - u_in) - L <= 0 and its
	// mirror - avoids choosing a sign but is degenerate exactly where this
	// problem lives: in the capped curvature region the cant slope is zero, both
	// rows lose their curvature terms, and what is left is the same row twice
	// with different right-hand sides. Measured, the active set held both members
	// of a pair at once and the trust region collapsed to 2e-10 while the
	// objective sat still.
	//
	// The sign is a kink, and at du = 0 it does not matter: the curvature terms
	// vanish with the slope and the row reads -L <= 0.
	//
	// The cant model has a kink of its own where its cap starts to bind; past it
	// the slope is zero, which is correct - more curvature buys no more cant
	// there, so it cannot lengthen the ramp either.
	//
	// Nothing here builds an alignment: the rule reads variables and the declared
	// values, so its Jacobian is exact and free.
	const slotByName = new Map(codec.slots.map((slot) => [slot.name, slot]));
	const freeIndexByName = new Map(codec.freeNames.map((name, i) => [name, i]));
	const rampRules = constraints.rampConstraints ?? [];
	const cantModel = constraints.cantModel;

	/** The curvature of one element: where it lives, and what it is worth. */
	function curvatureOf(elementId, x) {
		if (elementId === null) return { value: 0, index: null };
		const slot = slotByName.get(`${elementId}.curvature`);
		if (!slot) return { value: 0, index: null };      // a straight, or a transition
		const index = freeIndexByName.get(slot.name);
		return index === undefined
			? { value: slot.value, index: null }
			: { value: x[index], index };
	}

	function lengthOf(elementId, x) {
		const slot = slotByName.get(`${elementId}.length`);
		if (!slot) return { value: 0, index: null };
		const index = freeIndexByName.get(slot.name);
		return index === undefined
			? { value: slot.value, index: null }
			: { value: x[index], index };
	}

	/** The ramp rows and their Jacobian, for one point. */
	function rampRows(x) {
		if (rampRules.length === 0 || !cantModel) return { g: [], Jg: [] };
		const g = [];
		const Jg = [];
		for (const rule of rampRules) {
			const entry = curvatureOf(rule.entryElementId, x);
			const exit = curvatureOf(rule.exitElementId, x);
			const length = lengthOf(rule.elementId, x);
			const change = cantModel.cantAt(exit.value) - cantModel.cantAt(entry.value);
			const slopeIn = cantModel.cantSlopeAt(entry.value);
			const slopeOut = cantModel.cantSlopeAt(exit.value);

			const sign = change < 0 ? -1 : 1;
			g.push(sign * rule.gradient * change - length.value);
			const row = new Array(codec.freeCount).fill(0);
			if (length.index !== null) row[length.index] = -1;
			if (exit.index !== null) row[exit.index] += sign * rule.gradient * slopeOut;
			if (entry.index !== null) row[entry.index] -= sign * rule.gradient * slopeIn;
			Jg.push(row);
		}
		return { g, Jg };
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
		scaleEqualityRows(h, Jh);

		const ramps = rampRows(x);

		if (objective === "accumulated-length") {
			const gradF = codec.freeNames.map((name) => (name.endsWith(".length") ? 1 : 0));
			return { f: accumulatedLength(x), gradF, h, Jh, g: ramps.g, Jg: ramps.Jg };
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
		return { f, gradF, h, Jh, g: ramps.g, Jg: ramps.Jg };
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
		scaleEqualityRows(h, Jh);
		// exact and free: the ramp rule reads variables, not geometry
		const ramps = rampRows(x);

		if (objective === "accumulated-length") {
			const gradF = codec.freeNames.map((name) => (name.endsWith(".length") ? 1 : 0));
			return { f: accumulatedLength(x), gradF, h, Jh, g: ramps.g, Jg: ramps.Jg };
		}

		const Jr = jacobian.J.slice(h.length);
		const f = 0.5 * r.reduce((sum, value) => sum + value * value, 0);
		const gradF = x.map((_, j) => Jr.reduce((sum, row, i) => sum + row[j] * r[i], 0));
		return { f, gradF, h, Jh, g: ramps.g, Jg: ramps.Jg };
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
		...(penaltyRule === undefined ? {} : { penaltyRule }),
		...(penaltySafety === undefined ? {} : { penaltySafety }),
	});
	const run = {
		...scaledRun,
		x: scaledRun.x ? unscale(scaledRun.x, scales) : null,
	};

	// The result is reported even when the point it ended on cannot carry every
	// declared point: refusing to report would lose the diagnosis along with the
	// candidate. The proposal says so instead, and is not ok.
	const built = run.x ? realise(run.x) : null;
	const inadmissible = built ? [...inadmissiblePoints(built)] : [];
	// Residuals exist only where every declared point could be evaluated. Where
	// they do not, the diagnostics say null rather than a number derived from an
	// empty list: Math.hypot() of nothing is NaN, and the mean of nothing came
	// out as 0, which reads as a flawless result and is the more dangerous of the
	// two because nobody looks twice at a zero.
	let finalEquality = null;
	let finalSoft = null;
	if (built !== null && inadmissible.length === 0) {
		// Guarded even though inadmissiblePoints has just projected every one of
		// them. That check and these residuals are two passes over the same
		// projector, and a projector is not required to answer the same way
		// twice - the builder contract says nothing of the sort. Without this the
		// second pass throws out of a function whose whole job at this point is
		// to report, and the caller loses the diagnosis along with the candidate.
		try {
			finalEquality = equalityResiduals(built);
			finalSoft = softResiduals(built);
		} catch (caught) {
			if (!(caught instanceof AlignmentSqpSolverError)) throw caught;
			finalEquality = null;
			finalSoft = null;
			inadmissible.push(Object.freeze({
				name: caught.detail?.pointName ?? null,
				role: caught.detail?.role ?? null,
				reason: caught.code,
				overshoot: caught.detail?.overshoot ?? null,
			}));
		}
	}
	const finalExtra = run.x ? extraResiduals(run.x) : [];

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
		// A check that could not run has not passed. Where the projector offered
		// neither a longitudinal residual nor a distance, nothing here knows
		// whether a declared point sits past an end, and a proposal that cannot
		// know that is evidence rather than an answer - the same verdict it gets
		// for a point it knows is past one.
		admissible: problem.admissible !== false
			&& inadmissible.length === 0
			&& !footCheckMissing,
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
			// false when a projector offered neither a longitudinal residual nor a
			// distance, so no point could be checked for lying past an end
			extrapolationChecked: !footCheckMissing,
			// null throughout where the residuals could not be evaluated: not a
			// number, and not a zero standing in for one
			endPoseResidual: finalEquality ? Object.freeze(finalEquality.slice(0, 3)) : null,
			endPoseDistance: finalEquality
				? Math.hypot(finalEquality[0], finalEquality[1])
				: null,
			hardPointResiduals: Object.freeze(hardPoints.map((point, i) => Object.freeze({
				name: point.name,
				residual: finalEquality?.[3 + i] ?? null,
			}))),
			softOutsideTolerance: finalSoft
				? finalSoft.filter((value) => Math.abs(value) > 1).length
				: null,
			softResidualRms: finalSoft
				? (finalSoft.length
					? Math.sqrt(finalSoft.reduce((sum, v) => sum + v * v, 0) / finalSoft.length)
					: 0)
				: null,
			// slack of the relaxed QP in the last recorded iteration: how far the
			// linearised constraints had to be given up to stay solvable
			extraEqualityResiduals: Object.freeze(extraEqualities.map((constraint, i) => Object.freeze({
				id: constraint.id,
				residual: finalExtra[i] ?? null,
			}))),
			// worst ramp rule slack: positive means a transition is shorter than its
			// cant change allows
			rampSlack: run.x && rampRules.length
				? Math.max(...rampRows(run.x).g)
				: null,
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
