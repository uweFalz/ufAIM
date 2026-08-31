// src/domain/optimization/alignment/AlignmentLexicographicSolver.js
//
// AXTRAN2 Calculation Kernel - the priority order, run as phases.
//
// The engineering priorities are ranked, not weighted:
//
//   tier 0   poseA, poseE and the element sequence. Never traded, so they are
//            constraints of every phase and never an objective.
//   tier 1   the accumulated element length, minimised.
//   tier 2   the reality check through the point distances.
//   tier 3   design-speed requirements. Not yet declared.
//
// A ranked order is not a weighted sum, and collapsing it into one would hide
// exactly the trade the ranking forbids. Each tier is therefore solved on its
// own, and its attained value is frozen into a budget for the tiers below it:
//
//     minimise f_2(x)   subject to   tier 0   and   f_1(x) <= f_1* + epsilon
//
// With epsilon = 0 the order is strict: a lower tier may only use what the tier
// above it left indifferent. A positive epsilon is the engineering statement
// "half a metre of length is worth spending on the points", and it has to be
// declared, not discovered.
//
// A tier may also hand its value down as a REFERENCE rather than as a limit,
// which is what epsilon set to the full span amounts to. Then the tier
// establishes what its objective could achieve, reports it, and stops
// constraining: the answer is the lower tier's own optimum, and the upper tier
// has said what that answer cost. Since the limit would never bind, it is not
// imposed at all - computing a number that is then always inactive would be
// theatre, and the machinery it needs (a held phase, its witness, its active
// set) would run for nothing.
//
// A reference tier does not hand its point down either. It establishes neither
// a constraint nor a direction, so the tier below it starts where the run
// started rather than at an optimum it does not have to respect. Measured on
// the nine-element alignment, starting the points tier at the length tier's
// vertex cost 359 iterations against 171 from the declared alignment.
//
// Budgets are linear. "accumulated-length" is a sum of free lengths, so its
// budget is one linear row and the solver can hold it exactly. A budget on a
// nonlinear tier would need its gradient rebuilt every iteration and is
// refused rather than approximated. For the declared order this costs nothing:
// the last tier never needs a budget.
//
// A budget is an inequality, and it is handled as a two-case active set: solve
// the phase free of it, and if the result overspends, solve again with the
// budget held as an equality. Nothing else can happen with a single linear
// constraint - either the unconstrained optimum is affordable or the optimum
// sits on the boundary.
//
// Starting point. Phase 1 minimises a linear objective from a point that need
// not be feasible at all, which is the hardest thing this solver does: the
// merit function can buy objective by giving feasibility back, and the penalty
// weights only catch up over several iterations. Feasibility is much easier to
// reach under the least-squares objective, which supplies its own curvature.
// The driver may therefore run one preparatory solve whose only purpose is to
// deliver a feasible starting point. This changes where the phases start, not
// what they minimise; it is a warm start, not a reordering. It does bias each
// phase towards the nearest local optimum, which is stated in the report.

import { solveAlignmentProblem, OBJECTIVES } from "./AlignmentSQPSolver.js";

export const ALIGNMENT_LEXICOGRAPHIC_VERSION = "axtran2/alignment-lexicographic/0.1";

/** Objectives whose budget is a single linear row in the free variables. */
export const BUDGETABLE_OBJECTIVES = Object.freeze(["accumulated-length"]);

/** How a tier hands its attainment to the tiers below it. */
export const BUDGET_MODES = Object.freeze(["reference", "limit"]);

// Decision OD-2, reading (b): the length tier establishes what is achievable and
// then stops constraining. Readings (a) and (c) are a declared epsilon away -
// `{ objective: "accumulated-length", absolute: 0 }` for the strict order, any
// positive absolute or relative for a real budget.
export const DEFAULT_TIERS = Object.freeze([
	Object.freeze({ objective: "accumulated-length", budget: "reference" }),
	Object.freeze({ objective: "points" }),
]);

/**
 * Whether a tier constrains the tiers below it or only reports to them.
 * A declared epsilon is a limit by construction; declaring one and asking for a
 * reference at the same time is a contradiction, not a preference.
 */
function budgetModeOf(tier) {
	const declaredEpsilon = tier.relative !== undefined || tier.absolute !== undefined;
	if (tier.budget !== undefined) {
		if (!BUDGET_MODES.includes(tier.budget)) {
			error("UNKNOWN_BUDGET_MODE",
				`budget must be one of ${BUDGET_MODES.join(", ")}, not "${tier.budget}"`, { tier });
		}
		if (tier.budget === "reference" && declaredEpsilon) {
			error("CONTRADICTORY_BUDGET",
				"a tier cannot both declare an epsilon and hand its value down as a reference",
				{ tier });
		}
		return tier.budget;
	}
	return declaredEpsilon ? "limit" : "reference";
}

/** Relative slop below which a budget counts as met rather than overspent. */
export const BUDGET_TOLERANCE = 1e-9;

/**
 * Geometric closure below which a phase result counts as feasible, in metres.
 * A budget frozen from an infeasible result is worse than no budget at all: it
 * is a limit the constraints cannot honour, so every tier below inherits an
 * impossible problem and reports failure for a reason that is not its own.
 */
export const FEASIBILITY_TOLERANCE = 1e-3;

export class AlignmentLexicographicError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "AlignmentLexicographicError";
		this.code = code;
		this.detail = detail;
	}
}

function error(code, message, detail) {
	throw new AlignmentLexicographicError(code, message, detail);
}

/**
 * Whether a phase result honours tier 0 - the end pose and every hardened
 * Zwangspunkt. This is not a quality judgement about the tier's own objective;
 * it only asks whether the point the tier reached is a real alignment.
 */
export function tierZeroSatisfied(diagnostics, tolerance = FEASIBILITY_TOLERANCE) {
	if (!diagnostics) return false;
	if (!(Math.abs(diagnostics.endPoseDistance ?? Infinity) <= tolerance)) return false;
	const angular = Math.abs(diagnostics.endPoseResidual?.[2] ?? Infinity);
	if (!(angular <= tolerance)) return false;
	return (diagnostics.hardPointResiduals ?? []).every(
		(point) => Math.abs(point.residual ?? Infinity) <= tolerance
	);
}

/**
 * The value of a budgetable objective, and the gradient row that holds it.
 * Held lengths are a constant offset: they do not change the gradient, and the
 * budget is formed from the same quantity on both sides, so the offset cancels.
 */
function linearObjective(objective, codec) {
	if (objective !== "accumulated-length") {
		error(
			"UNBUDGETABLE_TIER",
			`a budget is only available for ${BUDGETABLE_OBJECTIVES.join(", ")}, not for "${objective}"`,
			{ objective }
		);
	}
	const gradient = codec.freeNames.map((name) => (name.endsWith(".length") ? 1 : 0));
	return {
		gradient,
		value: (x) => gradient.reduce((sum, weight, i) => sum + weight * x[i], 0),
	};
}

/**
 * Run the declared priority order as a sequence of phases.
 *
 * @param {object} input
 * @param {object} input.problem                        from createAlignmentOptimizationProblem
 * @param {(overlay: object) => object} input.buildAlignment
 * @param {(overlay: object) => object} [input.analyticJacobian]
 * @param {Array<{objective: string, relative?: number, absolute?: number}>} [input.tiers]
 *        in priority order, highest first. relative/absolute widen this tier's
 *        budget for the tiers below it; both default to 0, which is the strict
 *        lexicographic order.
 * @param {false|{objective?: string, maxIterations?: number}} [input.warmStart]
 *        a preparatory solve that only supplies a feasible starting point
 * @param {number} [input.maxIterations]  per phase
 * @param {number} [input.feasibilityTolerance]
 *        geometric closure, in metres, below which a phase result may hand a
 *        budget down to the tiers under it
 */
export function solveAlignmentLexicographic({
	problem,
	buildAlignment,
	analyticJacobian = null,
	tiers = DEFAULT_TIERS,
	warmStart = { objective: "points" },
	maxIterations = 60,
	feasibilityTolerance = FEASIBILITY_TOLERANCE,
	relaxationWeight = 1e6,
} = {}) {
	if (!problem?.codec) error("MISSING_PROBLEM", "problem is required");
	if (!Array.isArray(tiers) || tiers.length === 0) {
		error("MISSING_TIERS", "at least one tier is required");
	}
	for (const tier of tiers) {
		if (!OBJECTIVES.includes(tier?.objective)) {
			error("UNKNOWN_OBJECTIVE", `unknown tier objective "${tier?.objective}"`, { tier });
		}
	}
	// Every tier but the last hands a budget down, so every tier but the last
	// has to be budgetable. Checking this up front means a run cannot fail
	// halfway through, after the expensive phases have already been paid for.
	tiers.slice(0, -1).forEach((tier) => linearObjective(tier.objective, problem.codec));

	const { codec } = problem;
	const phases = [];
	let x = [...codec.encode()];
	let last = null;

	const run = (objective, start, extraEqualities, label, iterations = maxIterations) => {
		const result = solveAlignmentProblem({
			problem,
			buildAlignment,
			startAt: start,
			analyticJacobian,
			objective,
			extraEqualities,
			maxIterations: iterations,
			relaxationWeight,
		});
		phases.push(Object.freeze({
			label,
			objective,
			status: result.status,
			ok: result.ok,
			budgets: Object.freeze(extraEqualities.map((constraint) => constraint.id)),
			candidate: result.candidate,
			diagnostics: result.diagnostics,
		}));
		return result;
	};

	if (warmStart) {
		const objective = warmStart.objective ?? "points";
		const prepared = run(
			objective, x, [], "warm-start",
			warmStart.maxIterations ?? maxIterations
		);
		// A warm start that fails is not fatal: it only means the phases begin
		// where they would have begun anyway.
		if (prepared.candidate.variables.length) x = [...prepared.candidate.variables];
		last = prepared;
	}

	/** Budgets inherited from the tiers already solved, as linear equalities. */
	const budgets = [];
	/** Tiers that established no budget, and why. */
	const skipped = [];

	tiers.forEach((tier, index) => {
		const mode = budgetModeOf(tier);
		const asEquality = (budget) => ({
			id: budget.id,
			gradient: budget.gradient,
			residual: (probe) => budget.value(probe) - budget.limit,
		});

		// First the phase on its own. A budget is an inequality, and a phase whose
		// free optimum is affordable must not be pushed onto the boundary.
		let result = run(tier.objective, x, [], `tier-${index + 1}`);

		// If it does overspend, that budget's boundary is where the optimum sits,
		// and holding it as an equality is exactly right. Holding one can push a
		// second over its own limit, so the set of held budgets grows until it
		// stops growing. Growth only: a budget once held is not released again,
		// which cannot loop but can end on a boundary a full active-set method
		// would have left. With the declared two-tier order there is never more
		// than one budget, and the question does not arise.
		//
		// Where the held phase starts is not a detail. Starting it at the
		// overspending free optimum begins the solve outside the very constraint
		// it must honour, and on the nine-element scenario that was fatal: the
		// budget row opened at 5.89 m, the trust region grew 30 -> 60 -> 121 while
		// the relaxation gave the linearisation up entirely, and the QP's active
		// set churned through 67 releases before running out. Every budget has a
		// witness that satisfies it exactly - the point the tier attained it at -
		// so the held phase starts there and never leaves a satisfied constraint
		// to come back to it.
		const active = [];
		for (let pass = 0; pass < budgets.length; pass++) {
			const reached = result.candidate.variables?.length ? result.candidate.variables : x;
			const added = budgets.filter((budget) =>
				budget.mode === "limit"
				&& !active.includes(budget)
				&& budget.value(reached) - budget.limit
					> BUDGET_TOLERANCE * Math.max(1, Math.abs(budget.limit)));
			if (added.length === 0) break;
			active.push(...added);
			// the witness of the most recently added budget satisfies every budget
			// added before it as well, since those were already held when it was
			// attained
			const witness = added.at(-1).attainedAt;
			result = run(
				tier.objective,
				[...witness],
				active.map(asEquality),
				`tier-${index + 1}/budget-active`
			);
		}

		last = result;

		// A tier that bought its objective by giving feasibility back has
		// established nothing: neither a budget for the tiers below it nor a point
		// worth continuing from. Handing its value down as a limit would make
		// every tier below fail for its predecessor's reason, and handing its
		// point down would throw away a better one the run already holds. Both are
		// withheld, and the tier is reported. Only the last tier's result is kept
		// regardless, because it is the answer and the caller has to see it.
		const established = tierZeroSatisfied(result.diagnostics, feasibilityTolerance);
		const isLast = index === tiers.length - 1;
		// A reference tier constrains nothing below it, so it has no claim on
		// where the tier below it starts either.
		const advances = isLast || (established && mode === "limit");
		if (advances && result.candidate.variables?.length) {
			x = [...result.candidate.variables];
		}

		if (!established && !isLast) {
			skipped.push(Object.freeze({
				tier: `tier-${index + 1}`,
				objective: tier.objective,
				reason: "infeasible",
				endPoseDistance: result.diagnostics?.endPoseDistance ?? null,
				worstHardPoint: Math.max(
					0,
					...(result.diagnostics?.hardPointResiduals ?? []).map(
						(point) => Math.abs(point.residual ?? 0))
				),
			}));
		} else if (!isLast) {
			const linear = linearObjective(tier.objective, codec);
			const reached = result.candidate.variables?.length ? result.candidate.variables : x;
			const attained = linear.value(reached);
			const relative = tier.relative ?? 0;
			const absolute = tier.absolute ?? 0;
			const slack = Math.max(Math.abs(attained) * relative, absolute);
			budgets.push({
				id: `tier-${index + 1}:${tier.objective}`,
				objective: tier.objective,
				mode,
				gradient: linear.gradient,
				value: linear.value,
				attained,
				// a reference imposes no limit; saying "Infinity" would invite it to
				// be compared against, and null cannot be
				limit: mode === "limit" ? attained + slack : null,
				slack: mode === "limit" ? slack : null,
				// the point this value was attained at, which satisfies the budget
				// exactly and is therefore where a phase held to it should begin
				attainedAt: [...reached],
			});
		}
	});

	return Object.freeze({
		version: ALIGNMENT_LEXICOGRAPHIC_VERSION,
		type: "proposal",
		// A phase that stops on max_iterations has not proved anything about its
		// tier, and the phases below it inherit a budget that may not be the
		// tier's optimum. That is reported, never silently smoothed over.
		ok: skipped.length === 0
			&& phases.every((phase) => phase.label === "warm-start" || phase.ok),
		status: skipped.length
			? "tier_established_no_budget"
			: phases.find((phase) => phase.label !== "warm-start" && !phase.ok)?.status ?? "converged",
		candidate: last?.candidate ?? null,
		// What each tier established, and what the answer actually spent against
		// it. The two are free-variable sums, so neither is the alignment's total
		// length - but their difference is, because the held elements are the same
		// constant on both sides. The span is the number that means something on
		// its own: it is what the tiers below cost the tier above.
		budgets: Object.freeze(budgets.map((budget) => {
			const spent = last?.candidate?.variables?.length
				? budget.value(last.candidate.variables)
				: null;
			return Object.freeze({
				id: budget.id,
				objective: budget.objective,
				mode: budget.mode,
				attained: budget.attained,
				spent,
				span: spent === null ? null : spent - budget.attained,
				limit: budget.limit,
				slack: budget.slack,
			});
		})),
		skippedBudgets: Object.freeze(skipped),
		phases: Object.freeze(phases),
		diagnostics: last?.diagnostics ?? null,
		delta: null,
	});
}
