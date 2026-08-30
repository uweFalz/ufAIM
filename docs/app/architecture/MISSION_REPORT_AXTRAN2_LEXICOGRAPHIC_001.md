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

Implemented and pushed. The driver is complete and tested. R-1 and R-2 are
closed: both objectives now converge, tier 1 in 388 iterations and the points
objective in 55.

**What the converged tier 1 says is the finding of this mission, and it is not a
solver result.** Minimising the accumulated length strictly, against nothing but
the end pose and the element sequence, collapses the alignment onto the shortest
path between the two poses: six of the seven free elements end on their 20 m
lower bound. The declared priority order produces this by construction. See
section 8, F-1, and the decisions OD-1 and OD-2 that follow from it.

Branch `feat/axtran2-sqp-solver`, five commits: `1916c27`, `39e455b`, `8c3f04c`,
`fb08237`, `59d05b9`.

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
3.6 m of end-pose offset. Analytic Jacobian throughout.

At the truth the scenario closes exactly and no point is outside tolerance
(rms 0.127), so the target is reachable and every measurement below is about the
solver or the objective, never about an impossible problem.

### The globalisation, before and after

| objective | before | after |
|---|---|---|
| points | no verdict in 300 iterations; with the trust region alone, a false `merit_stationary` at 124 with rms 0.2375 and a KKT residual of 3.09 | `stationary` at **55**, end pose 0.0, 0/12 outside, rms **0.0640** |
| accumulated-length | no verdict in 300; `stationary` only at 3739 | `stationary` at **388**, end pose 4.6e-13 |

42 of the 55 points steps and 182 of the 388 length steps were accepted only
through the second-order correction.

### That tier 1 was descending correctly

Taking tier 1's iterate at ΣL = 1425.5612 with the end pose 5.7e-3 m open and
restoring feasibility alone from there (objective identically zero):

| | ΣL [m] | ‖h‖ |
|---|---|---|
| tier 1's iterate | 1425.5612 | 5.7e-3 |
| after restoration | 1425.5615 | 2.5e-13 |

0.4 mm apart. The shorter feasible alignment was really there, so the merit
function was not being cheated — the iteration was slow, not wrong.

### What tier 1 converges to (F-1)

| | ΣL [m] | end pose [m] | outside | rms | R1 | element lengths |
|---|---|---|---|---|---|---|
| min ΣL | 1415.657 | 4.6e-13 | 8/12 | 167.2 | — | `200 20 20 20 916 20 20 20 180` |
| min points | 1429.994 | 0.0 | 0/12 | 0.0640 | 701.7 | `200 89 308 76 166 60 271 79 180` |

Six of the seven free elements end on their 20 m lower bound. The alignment has
collapsed to one long straight between the two poses, which is exactly what
minimising length subject only to the end pose means.

### What epsilon buys

Tier 1's optimum does not depend on epsilon, so it was solved once; each row
below is tier 2 under the budget `ΣL <= 1415.657 + epsilon`, held as an equality
when the free optimum overspends it.

| epsilon [m] | ΣL [m] | end pose [m] | outside | rms | R1 [m] | verdict |
|---|---|---|---|---|---|---|
| no budget | 1429.994 | 0.0 | 0/12 | 0.0640 | 702 | `stationary` at 55 |
| 0 | 1421.164 | **3.3** | 10/12 | 80.12 | 523 | `max_iterations` at 80 |
| 8 | 1423.657 | 1.5e-11 | 7/12 | 47.97 | 691 | `max_iterations` at 80 |
| 14.4 | 1429.994 | 0.0 | 0/12 | 0.0640 | 702 | `stationary` at 55 |

The `epsilon = 0` row is **not a result**: it never reached its own budget and
left the end pose 3.3 m open. That is itself the finding — under the strict
budget tier 2 has almost nothing left to move, since six of the seven free
elements arrive already pinned on their lower bounds.

The points optimum costs ΣL = 1429.994, which is 14.337 m above the length
optimum. So epsilon has no useful middle: at 8 m the points are already 48 times
outside their tolerance, and only an epsilon large enough to stop constraining
tier 2 at all returns them. **On this scenario, ranking the length above the
points is equivalent to discarding the points.**

### Tests

19 in `sqp-solver.test.mjs`, 17 in `lexicographic.test.mjs`, 54 in
`test/axtran2`, all passing. Full suite 1529 of 1534. The three failures are
pre-existing and environmental: `test/samples/` is untracked local data absent
from this worktree (two tests), and one test spawns `rg`, which exists here only
as a shell function and not as a binary on PATH.

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

**F-1 (finding, decision required).** Tier 1, minimised strictly, is degenerate.
Converged, it returns element lengths `[200, 20, 20, 20, 916, 20, 20, 20, 180]`
at 1415.657 m with the end pose closed to 4.6e-13 m: six of the seven free
elements sit on their 20 m lower bound and the alignment is one long straight
with vestigial curves. Every point is far outside tolerance (rms 167). This is
not a solver failure - it is the correct minimum of the declared objective under
the declared constraints.

The reason is structural. Nothing in tiers 0 to 2 opposes shortening. The point
residuals are tier 2 and may not oppose tier 1 in a ranked order; the element
sequence only forbids elements from vanishing. What would oppose it is tier 3,
the design-speed requirements - minimum radii, minimum transition lengths - and
tier 3 is not yet declared. **The priority list is incomplete, not the solver.**

**R-1 (closed).** Tier 1 did not converge. Diagnosed to three separate defects
in the SQP globalisation and fixed in `59d05b9`: no trust region, no
second-order correction against the Maratos effect, and a stationarity test that
could not tell a stationary point from a collapsed trust region. Tier 1 now
reports `stationary` at 388 iterations with the end pose at 4.6e-13 m.

The diagnosis also overturned a reading of mine. Tier 1 was never buying
feasibility to lower its value; it was descending correctly towards a genuinely
shorter feasible alignment. Restoring feasibility from its iterate at 1425.5612
(end pose 5.7e-3 m open) lands at 1425.5615 with the constraints closed to
2.5e-13 - the shorter alignment was really there.

**R-2 (closed).** The points objective converged only linearly and, after the
trust region was added but before the correction and the stationarity guard,
reported `merit_stationary` at a KKT residual of 3.09 with the region shrunk to
8e-6 - a false verdict. It now reports `stationary` at 55 iterations with the
end pose closed exactly and rms 0.0640.

**R-3 (limitation, accepted).** The budget active set only grows. A budget once
held is not released, so with three or more tiers the run can stop on a boundary
a full active-set method would have left. With the declared two-tier order there
is never more than one budget and the case does not arise. Stated in the module.

**OD-1 (decision required).** What bounds tier 1? Three options, and F-1 says
one of them has to be taken:

  a. Declare tier 3 (design-speed requirements: minimum radius, minimum
     transition length per element) and let it constrain tier 1. This is the
     option that matches the engineering, and the constraint builder already has
     the shape for it - it carries one lower bound per element today.
  b. Keep tier 1 as an objective but give it a large declared epsilon, which
     makes it a budget rather than a priority.
  c. Move the length below the points in the ranking.

The driver implements the budget form and takes epsilon as a parameter; it
chooses nothing.

**OD-2 (decision required).** `epsilon = 0` is the current default and, given
F-1, it is very probably wrong: it hands tier 2 an alignment with six of seven
elements pinned on their bounds and no freedom left. The measured epsilon sweep
is in section 6 and shows what each value costs.

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
