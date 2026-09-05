// src/domain/optimization/alignment/AlignmentProgressiveSolver.js
//
// Progressive release: the same problem, solved again and again while more of it
// is allowed to move.
//
// The alignment is a chain, and its end pose is the product of every element's
// transform. The end-pose row for an early element therefore carries the lever
// arm of the whole run: measured on the nine-element scenario and confirmed
// against a complex-step Jacobian, d(x)/d(kappa) sits near -5.8e4 where
// d(x)/d(length) sits near 1. Three end-pose rows built out of sensitivities
// that far apart lie almost on top of one another - cos -0.983 between two of
// them, and a condition number of 297 across the active set - and that is what
// a global solve faces from its first iteration, at whatever point it was
// handed.
//
// Releasing progressively does not improve that conditioning; nothing about the
// rows changes. What changes is where the solve arrives from. Each stage starts
// warm from the last, so by the time every variable is free the point is
// already close, and the ill-conditioned rows are asked for a small correction
// instead of a large one.
//
// Forward and backward both, because the chain is anchored at both ends. A
// ladder that only ever frees the leading elements drives its residual towards
// the far anchor and leaves it sitting there.
//
// This is a driver: it owns the schedule and the acceptance rule, and delegates
// every solve to solveAlignmentProblem. It holds no geometry and no numerics.

import { solveAlignmentProblem } from "./AlignmentSQPSolver.js";

export const ALIGNMENT_PROGRESSIVE_SOLVER_VERSION = "axtran2/alignment-progressive-solver/0.1";

export const SWEEPS = Object.freeze(["forward", "backward"]);

export class AlignmentProgressiveError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "AlignmentProgressiveError";
		this.code = code;
		this.detail = detail;
	}
}

const error = (code, message, detail) => {
	throw new AlignmentProgressiveError(code, message, detail);
};

/** the element an out of a free-variable name: "E2.curvature" -> "E2" */
const elementOf = (name) => name.slice(0, name.lastIndexOf("."));

/**
 * Solve by releasing the alignment a few elements at a time.
 *
 * @param {object} input
 * @param {object} input.problem
 * @param {Function} input.buildAlignment
 * @param {Function} [input.analyticJacobian]
 * @param {string} [input.objective]
 * @param {number} [input.initialSpan]  elements free in the first stage. Below
 *        three there is rarely enough freedom to meet a three-component end
 *        pose, and the stage fails without telling you anything.
 * @param {string[]} [input.sweeps]  which directions, in order, at every span
 * @param {number} [input.maxIterations]  per stage, not for the whole ladder
 */
export function solveAlignmentProgressive({
	problem,
	buildAlignment,
	analyticJacobian = null,
	objective = "points",
	initialSpan = 3,
	sweeps = SWEEPS,
	maxIterations = 60,
	// How far from the end pose a stage may still be and count as having kept it.
	// Not zero, and the reason is measured: a stage that reaches the end pose
	// exactly reports a distance of 0, and a rule of "no worse than before" then
	// demands exactly 0 of every later stage as well. The ladder froze after two
	// rungs of nine. What tier 0 asks is that the end pose be met, not that a
	// floating-point residual never move off the floor.
	feasibilityTolerance = 1e-8,
	...forwarded
} = {}) {
	if (!problem?.codec) error("MISSING_PROBLEM", "problem is required");
	if (!Array.isArray(sweeps) || sweeps.length === 0) {
		error("EMPTY_SWEEPS", "sweeps must name at least one direction");
	}
	for (const sweep of sweeps) {
		if (!SWEEPS.includes(sweep)) {
			error("UNKNOWN_SWEEP", `sweep must be one of ${SWEEPS.join(", ")}`, { sweep });
		}
	}

	const { codec } = problem;
	const freeNames = [...codec.freeNames];
	// The ladder runs over the elements that have something to move, in sequence
	// order. An element whose length and curvature are both held is not a rung:
	// freeing it frees nothing, and counting it would make a span of three mean
	// three different things in three different problems.
	const movable = [...codec.elementSequence].filter((id) =>
		freeNames.some((name) => elementOf(name) === id));

	if (movable.length === 0) error("NOTHING_FREE", "no element of this problem has a free variable");
	if (!Number.isInteger(initialSpan) || initialSpan < 1) {
		error("INVALID_SPAN", "initialSpan must be a positive integer", { initialSpan });
	}
	const firstSpan = Math.min(initialSpan, movable.length);

	// The schedule: at each span every requested direction, then widen. The
	// sentence it comes from is "forwards, but backwards too, over three
	// elements, then over four".
	const stages = [];
	for (let span = firstSpan; span <= movable.length; span++) {
		for (const sweep of sweeps) {
			const free = sweep === "forward"
				? movable.slice(0, span)
				: movable.slice(movable.length - span);
			// at full span the two directions free the same elements; running the
			// identical stage twice would only spend iterations
			const previous = stages[stages.length - 1];
			if (previous && previous.free.length === free.length
				&& previous.free.every((id, i) => id === free[i])) continue;
			stages.push({ span, sweep, free });
		}
	}

	const distanceOf = (run) => {
		const value = run?.diagnostics?.endPoseDistance;
		return Number.isFinite(value) ? Math.abs(value) : null;
	};

	let point = null;             // what the next stage starts from
	let distance = null;          // the end-pose residual that point carries
	let accepted = null;          // the last run whose point was taken
	const report = [];

	for (const stage of stages) {
		const free = new Set(stage.free);
		const pinned = freeNames.filter((name) => !free.has(elementOf(name)));
		let run = null;
		let thrown = null;
		try {
			run = solveAlignmentProblem({
				problem, buildAlignment, analyticJacobian, objective,
				startAt: point, pinned, maxIterations, ...forwarded,
			});
		} catch (caught) {
			// A stage that throws is a stage, not the end of the ladder: the next
			// span has strictly more freedom and may well succeed where this one
			// could not. The throw is recorded and the point is left alone.
			thrown = caught;
		}

		const candidate = run?.candidate?.variables;
		const usable = Array.isArray(candidate) && candidate.length === freeNames.length
			&& candidate.every(Number.isFinite);
		const reached = distanceOf(run);
		// A stage may not hand on a point that is further from the end pose than
		// the one it was given. Tier 0 is never traded, and a ladder that lets one
		// bad stage through spends every later stage recovering from it.
		const kept = distance === null ? Infinity : Math.max(distance, feasibilityTolerance);
		const improves = usable && reached !== null && reached <= kept;

		if (improves) {
			point = [...candidate];
			distance = reached;
			accepted = run;
		}

		report.push(Object.freeze({
			span: stage.span,
			sweep: stage.sweep,
			free: Object.freeze([...stage.free]),
			freeVariables: freeNames.length - pinned.length,
			status: thrown ? "threw" : run.status,
			ok: thrown ? false : run.ok === true,
			endPoseDistance: reached,
			accepted: improves,
			reason: thrown
				? (thrown.code ?? thrown.message)
				: improves ? null
					: !usable ? "no usable candidate"
						: reached === null ? "no end-pose distance"
							: `would move away from the end pose (${reached.toExponential(2)} against ${kept.toExponential(2)})`,
			iterations: run?.diagnostics?.iterations ?? null,
		}));
	}

	const last = report[report.length - 1];
	return Object.freeze({
		version: ALIGNMENT_PROGRESSIVE_SOLVER_VERSION,
		type: "progressive",
		objective,
		// The answer is the last stage whose point was taken. When that is not the
		// full-span stage, the ladder did not finish the problem, and saying so is
		// the whole value of reporting per stage.
		ok: accepted?.ok === true && last?.span === movable.length && last.accepted === true,
		status: accepted === null
			? "no_stage_accepted"
			: last.span === movable.length && last.accepted
				? accepted.status
				: "ladder_incomplete",
		proposal: accepted,
		elements: Object.freeze([...movable]),
		stages: Object.freeze(report),
	});
}
