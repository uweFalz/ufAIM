# MISSION REPORT

## 1. Mission

MISSION-AXTRAN2-LEXICOGRAPHIC-001 — implement the two-phase run that carries the
declared engineering priority order:

    tier 0   poseA, poseE, element sequence   never traded
    tier 1   accumulated element length       minimised   (decision OD-1)
    tier 2   reality check via point offsets
    tier 3   design-speed requirements        not yet declared

The order is ranked, not weighted. The mission is the orchestration between the
tiers, not a new solver.

## 2. Status

Implemented and pushed. The driver is complete and tested; **tier 1 contributes
nothing on the measured scenario**, and the driver reports that rather than
concealing it. See section 8, R-1.

Branch `feat/axtran2-sqp-solver`, three commits: `1916c27`, `39e455b`, `8c3f04c`.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM-axtran2` (dedicated worktree).
- Branch `feat/axtran2-sqp-solver`, baseline `c4b289f`.
- The shared checkout at `/Users/uwefalz/Developer/ufAIM` was neither switched
  nor cleaned, and none of its uncommitted changes were taken over.
- Authorized: `src/domain/optimization/alignment/`, `src/lib/math/optim/`,
  `test/axtran2/`, this report.
- Excluded and untouched: `technetViewer.html`, `app/`, `docs/knowledgeKernel/`,
  AIM Core, SPOT, persistence, import.
- No parallel mission overlapped these paths; `git status` was clean apart from
  this mission's own files at every commit.

## 4. Work Performed

**The priority order as phases.** `AlignmentLexicographicSolver.js` solves each
tier on its own and freezes its attained value into a budget for the tiers below
it: `minimise f2(x) subject to tier 0 and f1(x) <= f1* + epsilon`. With
`epsilon = 0` the order is strict. A positive epsilon is the engineering
statement that so much length is worth spending on the points; it must be
declared, never discovered.

**Budgets are linear, and only linear.** `accumulated-length` is a sum of free
lengths, so its budget is one row the solver holds exactly. A budget on a
nonlinear tier would need its gradient rebuilt every iteration and is refused up
front, before any expensive phase runs. The declared order pays nothing for this
restriction: the last tier never hands a budget down.

**A budget is an inequality.** Each phase is solved free of the budget first;
only what the result overspends is then held as an equality. The held set grows
until it stops growing. Growth only — a held budget is not released — which
cannot loop but can stop on a boundary a full active-set method would have left.
With two tiers there is never more than one budget.

**Two failure modes found by measuring, both now behaviour:**

1. *A budget may only be frozen from a phase that honours tier 0.* Minimising a
   length against constraints it has not met is the cheapest thing an optimiser
   can do, and the value is a debt, not an optimum. Handing it down makes every
   tier below fail for its predecessor's reason.
2. *Nor may such a tier hand down its point.* The gate alone was not enough: the
   tier still moved the starting point onto its own infeasible result, and tier
   2 could not recover from there.

Both are withheld now, and the tier is reported through `skippedBudgets` with
the closure it failed to reach. The last tier is the exception: its result is
the answer and the caller must see it whatever it is.

**Warm start.** The least-squares objective supplies its own curvature and
reaches feasibility far more easily than the linear one, so one preparatory
solve may run before the tiers. This changes where the phases begin, not what
they minimise. It does bias each phase towards the nearest local optimum, which
the module states at its definition.

**Supporting changes to the solver.** `solveAlignmentProblem` now takes
`startAt`, so a phase can begin at an earlier phase's result, and
`extraEqualities`, so a budget arrives as a constraint row rather than being
encoded into the problem document. Both paths — analytic and finite-difference —
carry them, and the final budget residual is reported.

## 5. Changed Files

Added:

- `src/domain/optimization/alignment/AlignmentLexicographicSolver.js`
- `test/axtran2/lexicographic.test.mjs`
- `test/axtran2/fixtures/nineElementScenario.mjs`
- `docs/app/architecture/MISSION_REPORT_AXTRAN2_LEXICOGRAPHIC_001.md`

Modified:

- `src/domain/optimization/alignment/AlignmentSQPSolver.js`
- `src/lib/math/optim/sqp/merit.js`
- `src/lib/math/optim/sqp/solveSQP.js`
- `src/lib/math/optim/sqp/sqpStep.js`

Moved or renamed: None.
Deleted: None.

## 6. Evidence and Validation

Scenario: nine elements (straight / transition / arc / transition / straight /
transition / arc / transition / straight), lengths summing to 1430 m, R1 = 700,
R2 = −900. E0 and E8 held, so 9 free variables and 6 degrees of freedom after
the three end-pose equalities. Twelve points sampled from the truth with a
fixed-seed lateral disturbance of ±0.04 m, tolerance 0.15 m. Start perturbed to
3.6 m of end-pose offset. Analytic Jacobian, 80 iterations per phase.

At the truth the scenario closes exactly and no point is outside tolerance
(rms 0.127), so the target is reachable and the measurements below are about
the solver, not about an impossible problem.

Single phase, for comparison:

| objective | ΣL [m] | end pose [m] | outside | rms |
|---|---|---|---|---|
| points | 1429.9989 | 2.3e-4 | 0/12 | 0.1372 |
| accumulated-length | 1425.1062 | 2.5e-2 | 8/12 | 76.17 |

The second row is the whole problem in one line: 4.9 m of length bought with an
open end pose and two thirds of the points out of tolerance.

Two-phase, strict (epsilon = 0), with warm start:

| phase | ΣL [m] | end pose [m] | outside | rms |
|---|---|---|---|---|
| warm-start | 1429.9989 | 2.3e-4 | 0/12 | 0.1372 |
| tier-1 | 1425.0518 | 3.3e-2 | 8/12 | 77.76 |
| tier-2 | 1429.9944 | 2.0e-5 | 0/12 | 0.0641 |

reported as `ok=false`, `status=tier_established_no_budget`, with
`skippedBudgets = [{tier-1, infeasible, endPoseDistance 3.3e-2}]`.

The same run against an earlier state of this mission's own code, before the
gate and before the point was withheld — kept because it is the evidence for
both:

| phase | ΣL [m] | end pose [m] | outside | rms |
|---|---|---|---|---|
| tier-2 (budget held) | 1425.0518 | 1.1e-3 | 8/12 | 34.13 |

with `line_search_failed`. The warm start's good answer was destroyed by a
budget the constraints could not honour.

Without the warm start, tier 2 reaches 1429.9989 / 0 of 12 / rms 0.1372 —
exactly the single-phase points result, which is the correct consequence of tier
1 establishing nothing and not moving the point.

`epsilon = 0.30 m` produced results identical to `epsilon = 0`, because no
budget was established in either case. Epsilon is therefore **not yet measured**.

Tests: 17 in `test/axtran2/lexicographic.test.mjs`, 50 in `test/axtran2`, all
passing. Full suite 1525 of 1530. The three failures are pre-existing and
environmental: `test/samples/` is untracked local data absent from this worktree
(two tests), and one test spawns `rg`, which exists here only as a shell
function and not as a binary on PATH.

## 7. Kernel and Architecture Impact

The driver decides nothing. It returns a proposal with `delta: null`; applying,
persisting and selecting stay outside this kernel, as with the solver.

No new state store, no engineering-state mutation, no persistence, no SPOT
contact, no import semantics. The optimisation library under `src/lib/math/optim/`
remains free of domain and platform references — the boundary test in
`sqp-solver.test.mjs` covers this and still passes.

The lexicographic driver imports only `AlignmentSQPSolver`. The tier order is a
parameter, not a constant of the module; `DEFAULT_TIERS` records the declared
one and can be overridden by the caller.

`AXTRAN2_OPTIMIZATION_BOUNDARY.md` was read, not modified. Nothing in this
mission crosses the boundary it draws.

## 8. Conflicts, Risks, and Open Decisions

**R-1 (risk, open).** Tier 1 does not converge under its own penalty schedule
and does not stay feasible once it gets there: on this scenario the end pose is
closed to 1.2e-5 m after three iterations and open again to 1.8e-2 m after six.
The consequence for this mission is that tier 1 establishes no budget on any
measured configuration, so the two-phase machinery is exercised but the length
tier contributes nothing. The correction to the merit line search in `1916c27`
bounded the violation but did not fix convergence. This is the same open item as
in the previous package.

**R-2 (risk, open).** The `points` phase converges only linearly: rms 0.36 at 60
iterations, 0.14 at 150, 0.09 at 300, never reporting `converged`. The end pose
does close (1.6e-8 m at 300). This is a separate weakness from R-1 and was not
addressed here.

**R-3 (limitation, accepted).** The budget active set only grows. A budget once
held is not released, so with three or more tiers the run can stop on a boundary
a full active-set method would have left. With the declared two-tier order there
is never more than one budget and the case does not arise. Stated in the module.

**OD-1 (decision required).** The stopping rule for tier 1, carried over and
still open. Given that tier 1 is a minimisation, does it stop at a budget
`ΣL <= L* + epsilon`, or at a floor imposed by tier 2? The driver implements the
budget form and takes epsilon as a declared parameter; it does not choose a
value. No measurement is available yet, because tier 1 has not produced a
feasible optimum to budget from (R-1).

**OD-2 (decision required).** Is `epsilon = 0` the intended default? The driver
currently defaults to the strict order. The alternative is a small declared
epsilon, which would let tier 2 use length the length tier was indifferent
about. This cannot be decided on measurements until R-1 is resolved.

**OD-3 (decision required).** What should `feasibilityTolerance` be? It is
currently 1e-3 m of geometric closure, chosen as a millimetre-level default and
not from any engineering requirement.

Conflicts with parallel missions: None.
Terminology collisions: None.

## 9. Handover

Next safe step: fix tier-1 convergence (R-1). Everything else in the priority
order waits on it, including both open decisions that need measurements.

Prerequisites: none beyond this branch.

Files it may touch: `src/lib/math/optim/sqp/` and
`src/domain/optimization/alignment/AlignmentSQPSolver.js`. The lexicographic
driver should not need changing — it is written against the solver's contract,
not its convergence.

Independent streams: the viewer and IVHW work is untouched by this mission and
can proceed in parallel. `docs/knowledgeKernel/` was not modified.

Done criterion for the next package: the `accumulated-length` objective reports
`converged` from the declared start on the nine-element scenario, under its own
penalty schedule with no forced weight, honouring the end pose to 1e-5 m; and
the two-phase run then reports `ok=true` with a budget actually established by
tier 1.

Recommendations here do not authorize a new mission.
