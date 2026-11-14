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
// Zwangspunkt are equalities, a one-sided Zwangspunkt (at least, or at most,
// so far from the point) is an inequality on its lateral offset, the element
// sequence contributes lower bounds on the element lengths. An inconsistent
// linearisation is not an error here: the relaxed QP reports how far it had
// to give up through its slack.
//
// The alignment builder and the projector are injected, so this module stays
// free of geometry imports and of any realization binding.

import { footPointOf, boundViolation, sideOf } from "./AlignmentResidualBuilder.js";
import { solveSQP } from "../../../lib/math/optim/sqp/solveSQP.js";
import { finiteDiffJacobian } from "../../../lib/math/optim/diff/finiteDiffJacobian.js";
import { scaleEvaluator, scale as toScaled, unscale } from "../../../lib/math/optim/scale/variableScaling.js";
import { symmetricEigen } from "../../../lib/math/lina/symmetricEigen.js";

export const ALIGNMENT_SQP_SOLVER_VERSION = "axtran2/alignment-sqp-solver/0.5";

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
	// Measured, not chosen: on the nine-element scenario the bound form
	// converges at 82 and 91 iterations, the exact form at 100; over the corpus
	// of real alignments (#17) the length objective reaches a verdict on 85 %
	// and the points objective on 75 % within 200, and nothing that reaches one
	// does so past it. Sixty stopped the bound form halfway to its own answer.
	maxIterations = 1000,
	relaxationWeight = 1e6,
	// forwarded rather than fixed here: which penalty rule suits an alignment is
	// a question about this problem, not about the optimiser
	penaltyRule,
	penaltySafety,
	restoration,
	restorationLimit,
	eagerViolationRadii,
	// "bfgs", "gauss-newton" or "auto" (default). For the points objective
	// the Gauss-Newton Hessian is J'J of the residuals, exact where the
	// residuals are small and free of the identity start BFGS has to learn
	// from. Neither carries every alignment: measured on the thirteen giants
	// of the corpus, BFGS from the identity collapses at a start whose end
	// pose is hundreds of metres off (four of thirteen, box-sized steps the
	// search cuts to 3 %, a subproblem relaxed to nothing, two restorations
	// and a verdict), and Gauss-Newton stalls in the valley with residuals
	// outside tolerance (six of thirteen), its BFGS phase crawling on the
	// stiff J'J it switched away from. "auto" tries them in the order the
	// corpus ranks them - BFGS, then Gauss-Newton, then BFGS with an eager
	// restoration - and stops at the first verdict that is ok; the attempts
	// are in the diagnostics. It costs nothing where the first one holds.
	hessian = "auto",
	structuredStart,
	hybridSwitch,
	qpIterations,
	filterMargin,
	filterCeiling,
	filterSwitching,
	correctionClosure,
	correctionRows,
	correctionMetric,
	pinnedWeight,
	qpWarmStart,
	// The points fit ends "stationary" with the reason "within_tolerance" once
	// every point is within its tolerance, the constraints are met, the last
	// step gained less than a thousandth and the points leave directions
	// undetermined (see determinedSubspaceOf and solveSQP's determinedSubspace);
	// off, the flat valley runs to max_iterations.
	undeterminedVerdict = true,
	// The measured points as a corridor for the length objective: one
	// inequality, the residual rms in tolerance units at most one,
	// sum(r_i^2)/N - 1 <= 0. The length objective asks for the shortest
	// admissible chain between the poses, and without the corridor nothing
	// holds that chain to the measurements: the length tier shortened the
	// giants by 3 to 11 km and handed the strict order a budget no fit could
	// meet (AXTRAN2_LEXICOGRAPHIC_CORPUS_2026-09-10.md). The row is quadratic
	// and its curvature, mu * 2 J'J / N, goes into the provided Hessian with
	// the multiplier of the last subproblem; without it the row was reached
	// and could not be held. Under the corridor the length objective runs
	// with that Hessian (Gauss-Newton mode), whatever the hessian option says.
	// A no-op on the points objective, which carries the points already.
	corridor = false,
	// Which multiplier weighs the corridor's curvature in the model.
	//
	//   "multiplier"  the last subproblem's, as it came back - zero whenever
	//                 that subproblem did not hold the row.
	//   "held"        the last positive one a subproblem returned, kept while
	//                 the row is not held; as it came back until one has.
	//
	// A subproblem that does not hold the row returns a multiplier of zero,
	// and the next model then has no curvature along the row at all: the
	// length is linear, so that model is a linear programme in the directions
	// the points determine, and its step runs to the region's edge. Measured
	// on 92 station tracks of 7 to 33 elements (corpus places 130-221), from a
	// warm start deep inside the corridor (rms 0.1): on 90 of them the tier
	// left the corridor at rms 3 to 10 within its first steps, and the eighty
	// to two hundred iterations back are where the tier's verdict was lost -
	// to a filter that refuses the small steps back, a region halved forty
	// times, a subproblem relaxed to nothing. The length has no interior
	// optimum; where the corridor is what stops it the row is held at the
	// answer and its multiplier there is positive, and keeping the last
	// positive estimate is keeping the Lagrangian's curvature where the
	// answer needs it. Six runs each, the point tolerance moved by 10 to 30 pm
	// between them (the verdicts are that sensitive): 76.7 of 92 with a
	// verdict under "multiplier" (sd 2.1, 33 files whose verdict depends on
	// the run), 86.5 with the curvature kept (sd 1.4, 13 files).
	//
	// Kept from the start - a weight of one before any subproblem had held
	// the row - it cost the small alignments: where bounds stop the length
	// and the corridor is never reached, the tier crept under a curvature it
	// had no evidence for, 2.5 times the iterations on 130 alignments of 3 to
	// 7 elements, and settled up to 6 mm long. Kept only once returned, those
	// are as before (docs/app/architecture/
	// AXTRAN2_LENGTH_TIER_STABILITY_2026-11-12.md).
	corridorCurvature = "held",
	// { steps, absolute, feasibility? }: the objective is done when it has
	// settled (solveSQP's objectiveSettled). Set by the solver itself for the
	// length objective under the corridor; a caller may set it for a phase
	// whose purpose it knows - the lexicographic order does for its held
	// points phase, whose fit at a fixed length settles rather than converges.
	objectiveSettled,
	// A weak pseudo-observation on free lengths, as a geodetic adjustment
	// carries one on a weakly determined parameter: { sigma, elements? } adds
	// a residual (L - L0) / (sigma · L0) for every free length of the named
	// elements (all free lengths when unnamed), L0 the start value. Measured
	// on the corpus giants: a length traded between a transition and its
	// neighbouring arc moves the lateral residuals by millimetres, J'J has
	// eigenvalues down to 1e-13 of its largest, and the fit walks that valley
	// for thousands of iterations without a verdict. The prior says what the
	// points cannot; it is a modelling decision and off by default.
	lengthPrior = null,
	// What the points determine. "report" appends to the diagnostics, for the
	// points objective, the directions of the fit's J'J along which a unit
	// move - one metre of length, 1e-3/m of curvature - changes the residual
	// norm by less than determinacyThreshold tolerances: the exact null of a
	// straight's length no lateral offset can see, and the near-null trades of
	// length between a transition and its neighbouring arcs (docs/app/
	// architecture/AXTRAN2_FLAT_VALLEY_FINDING.md). Absolute, not relative to
	// the largest eigenvalue: curvature directions are 1e10 more sensitive
	// than lengths in these units and would make every length look
	// undetermined. A tenth of a tolerance per unit: a metre along such a
	// direction moves the residual norm by less than 1.5 cm over all points
	// together. The report says which lengths the points did not decide; it
	// changes nothing about the solve.
	determinacy = "report",
	determinacyThreshold = 0.1,
} = {}) {
	if (!problem?.codec) error("MISSING_PROBLEM", "problem is required");
	if (determinacy !== "report" && determinacy !== "off") {
		error("INVALID_OPTION", `determinacy must be "report" or "off", got ${JSON.stringify(determinacy)}`);
	}
	// a no-op on the points objective, which needs no row and may run without
	// the analytic Jacobian
	if (corridor && objective === "accumulated-length" && typeof analyticJacobian !== "function") {
		error("INVALID_OPTION", "the corridor needs the analytic Jacobian for its row");
	}
	if (corridorCurvature !== "held" && corridorCurvature !== "multiplier") {
		error("INVALID_OPTION", `corridorCurvature must be "held" or "multiplier", got ${JSON.stringify(corridorCurvature)}`);
	}
	if (hessian !== "bfgs" && hessian !== "gauss-newton" && hessian !== "auto") {
		error("INVALID_OPTION", `hessian must be "bfgs" or "gauss-newton", got ${JSON.stringify(hessian)}`);
	}
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
	if (lengthPrior !== null && (!(lengthPrior.sigma > 0) || (lengthPrior.elements !== undefined && !Array.isArray(lengthPrior.elements)))) {
		error("INVALID_OPTION", "lengthPrior needs a positive sigma and, if given, an array of element ids");
	}
	const priorColumns = lengthPrior === null ? [] : codec.freeNames.map((name, i) => ({ name, i })).filter(({ name }) => {
		if (!name.endsWith(".length")) return false;
		if (lengthPrior.elements === undefined) return true;
		return lengthPrior.elements.includes(name.slice(0, name.lastIndexOf(".")));
	}).filter(({ i }) => x0[i] > 0).map(({ i }) => ({ i, scale: 1 / (lengthPrior.sigma * x0[i]), start: x0[i] }));
	/** residual rows of the length prior at x, and their Jacobian rows */
	function priorRows(x) {
		const n = codec.freeCount;
		return {
			r: priorColumns.map(({ i, scale, start }) => (x[i] - start) * scale),
			Jr: priorColumns.map(({ i, scale }) => { const row = new Array(n).fill(0); row[i] = scale; return row; }),
		};
	}

	const hardPoints = residuals.hardPoints;
	// the one-sided Zwangspunkte; an older declaration carries none
	const boundPoints = residuals.boundPoints ?? [];
	// poses held at element joints, read off the chain at the exit station of
	// the element they follow; a heading row is weighed by the length it
	// accumulates on, as the end pose's is
	const heldPoses = (constraints.heldPoses ?? []).map((held) => {
		const index = codec.elementSequence.indexOf(held.afterElement);
		if (index < 0) error("INVALID_HELD_POSE", `held pose after "${held.afterElement}": no such element`);
		return { ...held, index, components: ["x", "y", "theta"].filter((key) => held[key] !== undefined) };
	});
	if (heldPoses.length > 0 && typeof analyticJacobian !== "function") {
		error("UNSUPPORTED", "held poses need the analytic Jacobian: the pose at a joint is read off the chain");
	}
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
	// which declared bounds shaped each free variable's interval, so that a
	// candidate sitting on a limit can say whose limit it is
	const boundsOn = new Map();
	for (const bound of [...constraints.bounds, ...(constraints.designBounds ?? [])]) {
		const name = `${bound.elementId}.${bound.quantity ?? "length"}`;
		const index = indexOfName.get(name);
		if (index === undefined) continue;   // the quantity is held, not free
		if (Number.isFinite(bound.minimum)) lower[index] = Math.max(lower[index], bound.minimum);
		if (Number.isFinite(bound.maximum)) upper[index] = Math.min(upper[index], bound.maximum);
		boundsOn.set(name, [...(boundsOn.get(name) ?? []), bound]);
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
	let hessianMode = hessian === "auto" ? "bfgs" : hessian;
	// the last positive multiplier a subproblem returned for the corridor's row;
	// null until one has held it
	let corridorMultiplier = null;
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

	/** residual rows and Jacobian rows of the held poses, from the chain */
	function heldPoseRows(geometry) {
		const h = [];
		const Jh = [];
		for (const held of heldPoses) {
			const station = geometry.stationAfter(held.index);
			const pose = geometry.poseAt(station);
			const rows = geometry.poseJacobianAt(parameterSpecs, station);
			for (const key of held.components) {
				const weight = key === "theta" ? Math.max(station, 1) : 1;
				const residual = key === "theta" ? wrapAngle(pose.theta - held.theta) : pose[key] - held[key];
				h.push(residual * weight);
				Jh.push(rows.map((d) => (key === "x" ? d.dx : key === "y" ? d.dy : d.dtheta) * weight));
			}
		}
		return { h, Jh };
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
		for (const [role, points] of [["zwangspunkt", hardPoints], ["zwangspunkt", boundPoints], ["measured point", softPoints]]) {
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

	/**
	 * The one-sided Zwangspunkte as rows g <= 0: each row is the violation in
	 * metres, positive where the axis comes closer than at-least allows or
	 * farther than at-most does, and the slack as a negative value otherwise.
	 */
	function boundResiduals(built) {
		return boundPoints.map((point) =>
			boundViolation(point.enforcement, point.target, project(built, point, "zwangspunkt").q));
	}

	/** The same rows with their Jacobian from the lateral derivative. */
	function boundRows(built, geometry) {
		const g = [];
		const Jg = [];
		for (const point of boundPoints) {
			const projected = project(built, point, "zwangspunkt");
			g.push(boundViolation(point.enforcement, point.target, projected.q));
			// at-least reads sign * (target - q): the row falls with q on that side
			const sign = sideOf(point.target) * (point.enforcement === "at-least" ? -1 : 1);
			Jg.push(geometry.lateralDerivative(parameterSpecs, projected.s, projected.direction ?? null).map((value) => value * sign));
		}
		return { g, Jg };
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

	// A ramp row that reads no curvature at the current point - both neighbours
	// held, straight, or in the capped region where the cant no longer grows -
	// is L >= m |du| with du a constant there: a lower bound on one length, which
	// is what the bound form carries for every ramp. It travels as that bound
	// for the step from this point (solveSQP reads `lower` off the evaluation)
	// and the row stands aside, strictly satisfied and without a normal, so the
	// row count, the multipliers and the warm start keep their places. As a row
	// with a slack it tied with the trust region's bound on the same length at
	// the subproblem's vertex: under the corridor 135 of 284 subproblems ended
	// stationary_on_working_set and the length tier ran into its iteration
	// limit, where the bound form took 79 steps
	// (docs/app/architecture/AXTRAN2_EXACT_RAMP_RULE_2026-11-10.md). The bound
	// is safe beyond the point it was taken at: where a step carries a
	// curvature out of the capped region, du only falls.
	const RAMP_ROW_ASIDE = -1;

	/** The ramp rows and their Jacobian, for one point; `lower` the lengths' bounds of the rows that stand aside. */
	function rampRows(x) {
		if (rampRules.length === 0 || !cantModel) return { g: [], Jg: [], lower: null, asBound: [], residuals: [] };
		const g = [];
		// m |du| - L as it is, also for a row that stands aside: what the report's rampSlack reads
		const residuals = [];
		const Jg = [];
		const lower = new Array(codec.freeCount).fill(-Infinity);
		const asBound = [];
		for (const rule of rampRules) {
			const entry = curvatureOf(rule.entryElementId, x);
			const exit = curvatureOf(rule.exitElementId, x);
			const length = lengthOf(rule.elementId, x);
			const change = cantModel.cantAt(exit.value) - cantModel.cantAt(entry.value);
			const slopeIn = cantModel.cantSlopeAt(entry.value);
			const slopeOut = cantModel.cantSlopeAt(exit.value);

			const sign = change < 0 ? -1 : 1;
			const residual = sign * rule.gradient * change - length.value;
			residuals.push(residual);
			const readsCurvature = (exit.index !== null && slopeOut !== 0) || (entry.index !== null && slopeIn !== 0);
			if (!readsCurvature && length.index !== null) {
				lower[length.index] = Math.max(lower[length.index], sign * rule.gradient * change);
				asBound.push(true);
				g.push(Math.min(residual, RAMP_ROW_ASIDE));
				Jg.push(new Array(codec.freeCount).fill(0));
				continue;
			}
			asBound.push(false);
			g.push(residual);
			const row = new Array(codec.freeCount).fill(0);
			if (length.index !== null) row[length.index] = -1;
			if (exit.index !== null) row[exit.index] += sign * rule.gradient * slopeOut;
			if (entry.index !== null) row[entry.index] -= sign * rule.gradient * slopeIn;
			Jg.push(row);
		}
		return { g, Jg, lower: asBound.some(Boolean) ? lower : null, asBound, residuals };
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

	function evaluateAnalytically(x, context = null) {
		const overlay = codec.decode(x);
		const built = realise(x);
		const geometry = analyticJacobian(overlay);
		jacobianEvaluations += 1;

		const joints = heldPoseRows(geometry);
		const h = [...equalityResiduals(built), ...joints.h, ...extraResiduals(x)];

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
			Jh.push(geometry.lateralDerivative(parameterSpecs, projected.s, projected.direction ?? null));
		}
		for (const row of joints.Jh) Jh.push(row);
		for (const constraint of extraEqualities) Jh.push([...constraint.gradient]);
		scaleEqualityRows(h, Jh);

		const ramps = rampRows(x);
		// the lengths' bounds of the ramp rows that travel as bounds for the step from here
		const stepBounds = ramps.lower ? { lower: ramps.lower } : {};
		const bounds = boundRows(built, geometry);
		const g = [...ramps.g, ...bounds.g];
		const Jg = [...ramps.Jg, ...bounds.Jg];

		if (objective === "accumulated-length") {
			const gradF = codec.freeNames.map((name) => (name.endsWith(".length") ? 1 : 0));
			if (!corridorActive || softPoints.length === 0) {
				return { f: accumulatedLength(x), gradF, h, Jh, g, Jg, ...stepBounds };
			}
			const N = softPoints.length;
			let sum = 0;
			const row = new Array(codec.freeCount).fill(0);
			const Jr = [];
			for (const point of softPoints) {
				const projected = project(built, point, "measured point");
				const r = (projected.q - point.target) / point.tolerance;
				sum += r * r;
				const dr = geometry.lateralDerivative(parameterSpecs, projected.s, projected.direction ?? null).map((value) => value / point.tolerance);
				Jr.push(dr);
				for (let j = 0; j < row.length; j++) row[j] += (2 / N) * r * dr[j];
			}
			// the corridor's row sits after the ramp and the one-sided point rows;
			// its multiplier is the last subproblem's, one before the first
			const mu = context?.multipliers?.inequality?.[g.length];
			if (Number.isFinite(mu) && mu > 0) corridorMultiplier = mu;
			const asReturned = Number.isFinite(mu) ? Math.max(mu, 0) : 1;
			const weight = (corridorCurvature === "held" ? (asReturned > 0 ? asReturned : corridorMultiplier ?? 0) : asReturned) * (2 / N);
			const squares = gaussNewton(Jr);
			const curvature = squares.map((hRow) => hRow.map((value) => value * weight));
			// the corridor row's own second derivative, (2/N) J'J to the residuals'
			// first order, for whoever has to put a point back inside it (the
			// restoration's Newton term); on demand, it is rarely asked for
			const corridorRow = g.length;
			const rowCurvature = () => [{ row: corridorRow, hessian: squares.map((hRow) => hRow.map((value) => value * (2 / N))) }];
			return { f: accumulatedLength(x), gradF, h, Jh, g: [...g, sum / N - 1], Jg: [...Jg, row], ...stepBounds, hessian: curvature, rowCurvature, residualJacobian: Jr, residualMax: Math.sqrt(sum / N) };
		}

		const prior = priorRows(x);
		const r = [...softResiduals(built), ...prior.r];
		const Jr = [...softPoints.map((point) => {
			const projected = project(built, point, "measured point");
			const row = geometry.lateralDerivative(parameterSpecs, projected.s, projected.direction ?? null);
			return row.map((value) => value / point.tolerance);
		}), ...prior.Jr];
		const f = 0.5 * r.reduce((sum, value) => sum + value * value, 0);
		const gradF = parameterSpecs.map((_, j) =>
			Jr.reduce((sum, row, i) => sum + row[j] * r[i], 0));
		// the largest residual in tolerance units: at most one, every point is
		// within its tolerance, which is the adjustment's own notion of done
		const residualMax = r.reduce((worst, value) => Math.max(worst, Math.abs(value)), 0);
		return { f, gradF, h, Jh, g, Jg, ...stepBounds, residualJacobian: Jr, residualMax, ...(hessianMode === "gauss-newton" ? { hessian: gaussNewton(Jr) } : {}) };
	}

	/**
	 * The directions the residuals determine, as an orthonormal basis in the
	 * solver's scaled coordinates: the eigenvectors of J'J whose eigenvalue's
	 * root - tolerances of residual norm per unit move - clears the
	 * determinacy threshold. What solveSQP tests its Lagrangian against when
	 * the fit stops gaining (its determinedSubspace). The same threshold as
	 * the determinacy report, on the same matrix.
	 */
	function determinedSubspaceOf(state) {
		const Jr = state.residualJacobian;
		if (!Array.isArray(Jr) || Jr.length === 0) return null;
		const n = codec.freeCount;
		const A = Array.from({ length: n }, () => new Array(n).fill(0));
		for (const row of Jr) {
			for (let i = 0; i < n; i++) {
				if (row[i] === 0) continue;
				for (let j = 0; j < n; j++) A[i][j] += row[i] * row[j];
			}
		}
		const { values, vectors } = symmetricEigen(A);
		const kept = values.map((value, k) => k).filter((k) => Math.sqrt(Math.max(0, values[k])) > determinacyThreshold);
		return { basis: kept.map((k) => vectors[k]), curvature: kept.map((k) => values[k]) };
	}

	/** J'J of the residual Jacobian: the Gauss-Newton curvature of ½‖r‖². */
	function gaussNewton(Jr) {
		const n = codec.freeCount;
		const H = Array.from({ length: n }, () => new Array(n).fill(0));
		for (const row of Jr) {
			for (let i = 0; i < n; i++) {
				if (row[i] === 0) continue;
				for (let j = 0; j < n; j++) H[i][j] += row[i] * row[j];
			}
		}
		return H;
	}

	/** The point residuals' Jacobian at x, in physical units, tolerance-scaled rows. */
	function residualJacobianAt(x, built) {
		if (typeof analyticJacobian === "function") {
			const geometry = analyticJacobian(codec.decode(x));
			return softPoints.map((point) => {
				const projected = project(built, point, "measured point");
				return geometry.lateralDerivative(parameterSpecs, projected.s, projected.direction ?? null).map((value) => value / point.tolerance);
			});
		}
		const jacobian = finiteDiffJacobian({
			x, scales, relative: 1e-4,
			residual: (probe) => softResiduals(realise(probe)),
		});
		return jacobian.ok ? jacobian.J : null;
	}

	/**
	 * Which directions of the free variables the points determine, and which
	 * they do not: the eigenpairs of J'J in the solver's scaled coordinates
	 * with eigenvalues under the threshold of the largest, each named by its
	 * strongest components.
	 */
	function determinacyReport(x, built) {
		const Jr = residualJacobianAt(x, built);
		if (!Jr || Jr.length === 0) return null;
		const n = codec.freeCount;
		const A = Array.from({ length: n }, () => new Array(n).fill(0));
		for (const row of Jr) {
			const scaled = row.map((value, j) => value * scales[j]);
			for (let i = 0; i < n; i++) {
				if (scaled[i] === 0) continue;
				for (let j = 0; j < n; j++) A[i][j] += scaled[i] * scaled[j];
			}
		}
		const { values, vectors, converged } = symmetricEigen(A);
		const largest = values[0];
		if (!(largest > 0)) return null;
		const weak = [];
		values.forEach((value, k) => {
			// sqrt of the eigenvalue: tolerances of residual norm per unit move
			if (Math.sqrt(Math.max(0, value)) > determinacyThreshold) return;
			const components = vectors[k]
				.map((weight, j) => ({ name: codec.freeNames[j], weight }))
				.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
				.slice(0, 4)
				.map(({ name, weight }) => Object.freeze({ name, weight: Number(weight.toFixed(4)) }));
			const sensitivity = Math.sqrt(Math.max(0, value));
			weak.push(Object.freeze({
				sensitivity,
				// how far along the direction, in units, before the residual norm
				// has grown by one tolerance; Infinity for an exact null
				play: sensitivity > 0 ? 1 / sensitivity : Infinity,
				components: Object.freeze(components),
			}));
		});
		return Object.freeze({
			variables: n, points: Jr.length, largestEigenvalue: largest, threshold: determinacyThreshold,
			converged, undetermined: weak.length,
			directions: Object.freeze(weak),
			// the variables that lead an undetermined direction, once each
			lengthsNotDetermined: Object.freeze([...new Set(weak.map((d) => d.components[0]?.name).filter(Boolean))]),
		});
	}

	function evaluate(x, context = null) {
		if (typeof analyticJacobian === "function") return evaluateAnalytically(x, context);

		const built = realise(x);
		const h = [...equalityResiduals(built), ...extraResiduals(x)];
		// the one-sided point rows are differenced with the equalities: they
		// read the same projection
		const gBound = boundResiduals(built);
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
				const base = [...equalityResiduals(probed), ...extraResiduals(probe), ...boundResiduals(probed)];
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
		// the lengths' bounds of the ramp rows that travel as bounds for the step from here
		const stepBounds = ramps.lower ? { lower: ramps.lower } : {};
		const g = [...ramps.g, ...gBound];
		const Jg = [...ramps.Jg, ...jacobian.J.slice(h.length, h.length + gBound.length)];

		if (objective === "accumulated-length") {
			const gradF = codec.freeNames.map((name) => (name.endsWith(".length") ? 1 : 0));
			return { f: accumulatedLength(x), gradF, h, Jh, g, Jg, ...stepBounds };
		}

		const prior = priorRows(x);
		const Jr = [...jacobian.J.slice(h.length + gBound.length), ...prior.Jr];
		const rAll = [...r, ...prior.r];
		const f = 0.5 * rAll.reduce((sum, value) => sum + value * value, 0);
		const gradF = x.map((_, j) => Jr.reduce((sum, row, i) => sum + row[j] * rAll[i], 0));
		return { f, gradF, h, Jh, g, Jg, ...stepBounds, ...(hessianMode === "gauss-newton" ? { hessian: gaussNewton(Jr) } : {}) };
	}

	// The solve runs in scaled coordinates. A length in metres and a curvature
	// near 1e-3 1/m differ by five orders of magnitude in the Jacobian, and an
	// identity Hessian against a gradient of that spread drives the QP into its
	// bounds on every iteration. The scaling is by engineering magnitude, fixed
	// before the solve, not by Jacobian norm.
	// the attempts of "auto", or the one the caller asked for
	const corridorActive = corridor && objective === "accumulated-length";
	const plan = corridorActive
		? [{ hessian: "gauss-newton", restoration }]
		: hessian === "auto"
			? [{ hessian: "bfgs", restoration }, { hessian: "gauss-newton", restoration }, { hessian: "bfgs", restoration: "eager" }]
			: [{ hessian, restoration }];
	const attempts = [];
	let scaledRun = null;
	for (const attempt of plan) {
		hessianMode = attempt.hessian;
		const restorationMode = attempt.restoration;
		scaledRun = solveSQP({
		x0: toScaled(x0, scales),
		evaluate: scaleEvaluator(evaluate, scales),
		lower: toScaled(lower, scales),
		upper: toScaled(upper, scales),
		maxIterations,
		relaxationWeight,
		initialHessianScale: 1,
		...(penaltyRule === undefined ? {} : { penaltyRule }),
		...(penaltySafety === undefined ? {} : { penaltySafety }),
		...(restorationMode === undefined ? {} : { restoration: restorationMode }),
		...(restorationLimit === undefined ? {} : { restorationLimit }),
		...(eagerViolationRadii === undefined ? {} : { eagerViolationRadii }),
		hessian: hessianMode === "gauss-newton" ? "provided" : "bfgs",
		...(structuredStart === undefined ? {} : { structuredStart }),
		...(hybridSwitch === undefined ? (corridorActive ? { hybridSwitch: 0 } : {}) : { hybridSwitch }),
		...(qpIterations === undefined ? {} : { qpIterations }),
		...(filterMargin === undefined ? {} : { filterMargin }),
		// Under the corridor the filter's ceiling is the corridor's own width:
		// the row is rms^2 - 1, so a violation of one is rms 1.41. The solve's
		// default of a hundred let the tier out to rms 10 (see corridorCurvature
		// above). The ceiling alone: 83.0 of 92 with a verdict (sd 1.9) against
		// 76.7; with the curvature kept, the closure and the settled window:
		// 91.7 (sd 0.5), one file whose verdict depends on the run, a third
		// fewer iterations.
		...(filterCeiling === undefined ? (corridorActive ? { filterCeiling: 1 } : {}) : { filterCeiling }),
		...(filterSwitching === undefined ? {} : { filterSwitching }),
		...(correctionClosure === undefined ? {} : { correctionClosure }),
		...(correctionRows === undefined ? {} : { correctionRows }),
		...(correctionMetric === undefined ? {} : { correctionMetric }),
		...(pinnedWeight === undefined ? {} : { pinnedWeight }),
		...(qpWarmStart === undefined ? {} : { qpWarmStart }),
		...(objective === "points" && undeterminedVerdict ? { determinedSubspace: determinedSubspaceOf } : {}),
		// The length tier under the corridor creeps along a curved constraint
		// with a linear objective: measured on 64 elements, the length moved by
		// 3 mm between iteration 100 and 852, the corridor corrected at every
		// step, and the KKT residual never small - the objective's gradient is
		// balanced by one row's gradient in a 43-dimensional determined space.
		// A length that has settled to a millimetre over twenty full steps is
		// what the tier hands down, and the millimetre is nothing against the
		// centimetres of the measurements. The constraints are closed to 1e-8
		// for the lexicographic gate; 1e-9 sat at the noise floor of a 7.5 km
		// chain (a restoration from 1.2e-9 took no step it could accept).
		// "within": a step that ends 1e-5 beside the constraints counts for
		// the window too - the corridor at rms 1.000005. The tier creeps along
		// the corridor a few 1e-6 outside it, every step closing the linearised
		// row and reopening it at second order, and held to the solve's
		// relative feasibility the window fills late or not at all. Measured
		// on the 92 station tracks, six runs each: 91.7 with a verdict (sd 0.5,
		// one file whose verdict depends on the run) against 90.7 (sd 1.5, six
		// files), a tenth fewer iterations, no length more than 0.7 mm
		// different. At 1e-4 the tiers end in half the iterations and a tenth
		// of them more than a millimetre long, which is more than the rule
		// promises.
		...(objectiveSettled ? { objectiveSettled } : corridorActive ? { objectiveSettled: { steps: 20, absolute: 1e-3, feasibility: 1e-8, within: 1e-5 } } : {}),
		});
		attempts.push(Object.freeze({
			hessian: attempt.hessian, restoration: attempt.restoration ?? "on-verdict",
			status: scaledRun.status, reason: scaledRun.reason ?? null, iterations: scaledRun.iterations,
		}));
		if (scaledRun.ok) break;
	}
	const run = {
		...scaledRun,
		x: scaledRun.x ? unscale(scaledRun.x, scales) : null,
	};

	// The result is reported even when the point it ended on cannot carry every
	// declared point: refusing to report would lose the diagnosis along with the
	// candidate. The proposal says so instead, and is not ok.
	const built = run.x ? realise(run.x) : null;
	// the held poses at the answer, unweighted, from the chain that holds them
	let heldPoseReport = null;
	if (heldPoses.length > 0 && run.x) {
		try {
			const geometry = analyticJacobian(codec.decode(run.x));
			heldPoseReport = Object.freeze(heldPoses.flatMap((held) => {
				const pose = geometry.poseAt(geometry.stationAfter(held.index));
				return held.components.map((key) => Object.freeze({
					afterElement: held.afterElement, component: key,
					residual: key === "theta" ? wrapAngle(pose.theta - held.theta) : pose[key] - held[key],
				}));
			}));
		} catch { heldPoseReport = null; }
	}
	const inadmissible = built ? [...inadmissiblePoints(built)] : [];
	// Residuals exist only where every declared point could be evaluated. Where
	// they do not, the diagnostics say null rather than a number derived from an
	// empty list: Math.hypot() of nothing is NaN, and the mean of nothing came
	// out as 0, which reads as a flawless result and is the more dangerous of the
	// two because nobody looks twice at a zero.
	// The determinacy report projects every point once more; it goes before
	// the final residuals so that a projector failing on its last call fails
	// the report of record, not this one.
	let determinacyReported = null;
	if (determinacy === "report" && objective === "points" && built !== null && inadmissible.length === 0) {
		try { determinacyReported = determinacyReport(run.x, built); } catch (caught) {
			if (!(caught instanceof AlignmentSqpSolverError)) throw caught;
			determinacyReported = null;
		}
	}
	let finalEquality = null;
	let finalSoft = null;
	let finalBound = null;
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
			finalBound = boundResiduals(built);
		} catch (caught) {
			if (!(caught instanceof AlignmentSqpSolverError)) throw caught;
			finalEquality = null;
			finalSoft = null;
			finalBound = null;
			inadmissible.push(Object.freeze({
				name: caught.detail?.pointName ?? null,
				role: caught.detail?.role ?? null,
				reason: caught.code,
				overshoot: caught.detail?.overshoot ?? null,
			}));
		}
	}
	const finalExtra = run.x ? extraResiduals(run.x) : [];
	// The box bounds the candidate sits on. A free quantity the design or the
	// sequence holds at its limit converges, and the verdict is right - but it
	// did not move freely, and nothing else in this proposal says so: a radius
	// pinned at the EBO floor of 300 m looked like a radius the fit left alone
	// (the 4L finding, 2026-11-09). Pinned variables are the caller's, not a limit.
	const finalRamps = run.x ? rampRows(run.x) : { lower: null };
	const activeBounds = run.x
		? codec.freeNames.flatMap((name, i) => {
			if (pinned.includes(name)) return [];
			const x = run.x[i];
			const at = (b) => Number.isFinite(b) && Math.abs(x - b) <= 1e-9 * Math.max(1, Math.abs(b));
			const side = at(lower[i]) ? "lower" : at(upper[i]) ? "upper" : null;
			// the exact ramp rule carried as a bound for the step: a length that sits on it is on the ramp rule's limit
			if (side === null && finalRamps.lower && at(finalRamps.lower[i])) {
				const rule = rampRules.find((r) => `${r.elementId}.length` === name);
				return [Object.freeze({
					name, elementId: rule?.elementId ?? name.split(".")[0], quantity: "length", side: "lower", value: x, limit: finalRamps.lower[i],
					bound: Object.freeze({ id: rule?.id ?? null, kind: "design-limit", reason: rule?.reason === "exception" ? "exception" : "ramp-rule", source: rule?.source ?? null }),
				})];
			}
			if (side === null) return [];
			const limit = side === "lower" ? lower[i] : upper[i];
			const bound = (boundsOn.get(name) ?? []).find((b) => (side === "lower" ? b.minimum : b.maximum) === limit) ?? null;
			const [elementId, quantity] = name.split(".");
			return [Object.freeze({
				name, elementId: bound?.elementId ?? elementId, quantity: bound?.quantity ?? quantity, side, value: x, limit,
				bound: bound ? Object.freeze({ id: bound.id, kind: bound.kind, reason: bound.reason ?? bound.binding ?? null, source: bound.source ?? null }) : null,
			})];
		})
		: [];

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
			hessian: hessianMode,
			attempts: Object.freeze(attempts),
			iterations: run.iterations,
			determinacy: determinacyReported,
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
			heldPoseResiduals: heldPoseReport,
			endPoseDistance: finalEquality
				? Math.hypot(finalEquality[0], finalEquality[1])
				: null,
			hardPointResiduals: Object.freeze(hardPoints.map((point, i) => Object.freeze({
				name: point.name,
				residual: finalEquality?.[3 + i] ?? null,
			}))),
			// the one-sided Zwangspunkte: the violation in metres, positive where
			// the rule is broken, negative by the slack where it holds
			boundPointResiduals: Object.freeze(boundPoints.map((point, i) => Object.freeze({
				name: point.name,
				enforcement: point.enforcement,
				target: point.target,
				violation: finalBound?.[i] ?? null,
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
				? Math.max(...rampRows(run.x).residuals)
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
			restorations: (run.history ?? []).filter((entry) => entry.status === "restored").length,
			restorationSteps: run.restorationSteps ?? 0,
			// the free variables that sit on a declared bound, and whose bound it is
			activeBounds: Object.freeze(activeBounds),
			history: Object.freeze(run.history ?? []),
			reason: run.reason ?? null,
		}),
		// A proposal is never an engineering decision. Applying, persisting and
		// selecting all happen outside this kernel.
		delta: null,
	});
}
