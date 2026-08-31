# MISSION REPORT

## 1. Mission

MISSION-AXTRAN2-LEXICOGRAPHIC-001 — carry the declared engineering priority
order end to end:

    tier 0   poseA, poseE, element sequence   never traded
    tier 1   accumulated element length       minimised
    tier 2   reality check via point offsets
    tier 3   design limits                    declared in this mission

The order is ranked, not weighted. The mission began as the orchestration
between tiers 1 and 2, and grew to include the solver work that made tier 1
converge and the declaration of tier 3 that made it mean something.

## 2. Status

Complete and pushed. Branch `feat/axtran2-sqp-solver`, eight commits from
`1916c27` to this report.

Both objectives converge. Tier 1 reaches its optimum in 105 iterations with the
end pose closed to 2.8e-13 m, and that optimum is now an alignment rather than a
collapse: both radii on the declared 600 m floor, all four transitions on their
60 m floor.

One thing is settled by measurement rather than left open: **the strict order,
`epsilon = 0`, is answered entirely by tier 1.** Its optimum is a vertex of the
feasible set, so tier 2 inherits no freedom at all and returns that alignment
unchanged, in a single iteration. Choosing `epsilon` is therefore choosing how
much of the answer tier 2 is allowed to give. Section 6 measures what each
choice costs; the choice itself is OD-2, and it is the one thing this mission
cannot make.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Developer/ufAIM-axtran2` (dedicated worktree).
- Branch `feat/axtran2-sqp-solver`, baseline `c4b289f`.
- The shared checkout at `/Users/uwefalz/Developer/ufAIM` was neither switched
  nor cleaned, and none of its uncommitted changes were taken over.
- Authorized: `src/domain/optimization/alignment/`, `src/lib/math/optim/`,
  `test/axtran2/`, this report.
- Excluded and untouched: `technetViewer.html`, `app/`, `docs/knowledgeKernel/`,
  AIM Core, SPOT, persistence, import.
- No parallel mission overlapped these paths.

## 4. Work Performed

### The priority order as phases

`AlignmentLexicographicSolver.js` solves each tier on its own and freezes its
attained value into a budget for the tiers below it:

    minimise f2(x)   subject to   tier 0, tier 3   and   f1(x) <= f1* + epsilon

`epsilon = 0` is the strict order. A positive epsilon is the engineering
statement that so much length is worth spending on the points, and it has to be
declared, never discovered.

Budgets are linear, and only linear. `accumulated-length` is a sum of free
lengths, so its budget is one row the solver holds exactly; a budget on a
nonlinear tier would need its gradient rebuilt every iteration and is refused up
front, before any expensive phase runs. The declared order pays nothing for
this, since the last tier never hands a budget down.

A budget is an inequality: each phase is solved free of it first, and only what
the result overspends is then held as an equality. A held phase starts at the
budget's own witness — the point the tier attained it at, which satisfies it
exactly — never at the overspending free optimum.

Two things a tier may not do, both found by measuring and both now behaviour: it
may not hand down a budget it reached by giving feasibility back, and it may not
hand down that point either. Both are withheld and the tier is reported through
`skippedBudgets`.

### Tier 3, the design limits

The constraint builder now takes a design profile: a smallest admissible radius,
which becomes a two-sided bound on every free curvature — a curve may run either
way and may straighten out entirely, but may not be tighter than the design
allows — and a smallest admissible length per element kind, which takes over
from the sequence bound wherever it is stricter, recording which of the two is
speaking.

No limit is invented. Values are declared, because they live in the engineer's
rule book and not in a calculation kernel. What the module will do on request is
the pure kinematics:

    R >= V^2 / a          from the unbalanced lateral acceleration limit
    L >= V^3 / (R j)      from the limit on its rate of change

Both are cant-free, since cant is not modelled, and the second is conservative
twice over: the honest form bounds `|dkappa|`, which is a variable, and
enforcing that needs a general inequality the solver does not carry. A declared
radius tighter than `V^2/a` is refused rather than silently overruled — the rule
book knows things this kinematics does not.

### The solver work this required

Five defects, each named by a measurement rather than guessed at:

1. **The Armijo reference was a bound, not a value.** `-d'Hd` is Gerdts'
   guarantee that a descent direction exists; the directional derivative of the
   l1 merit is `grad f . d - (1 - delta) sum eta_j |h_j|`. With the bound the
   Armijo condition accepted any step that dipped the merit at all, which for a
   linear objective means buying objective by giving feasibility back.
2. **No trust region.** A linear objective has no curvature of its own, so the
   reduced Hessian is genuinely tiny and the Newton step correspondingly
   enormous: `|d| = 150` where the variables are of order 100, cut to
   `alpha = 2e-3` by the line search.
3. **No second-order correction.** The l1 merit has a kink at every feasible
   point, so a step that lowers the objective at first order can raise the
   violation at second order and be charged at once — the Maratos effect.
   Unaided it backtracked 31 times to `alpha = 5e-10` with the objective
   unchanged in five digits.
4. **Stationarity could not be told from exhaustion.** A step goes to zero
   either because the point is stationary or because the trust region collapsed
   onto it, and the old test reported `merit_stationary` at a KKT residual of
   3.09 with the region shrunk to 8e-6. The KKT residual is now measured on the
   *projected* Lagrangian gradient, because a bound holding the solution
   contributes a multiplier that does not appear in the plain one — the first
   version of the guard rejected a correct bound-held optimum for exactly that.
5. **A pinned working set was iterated against.** At a vertex there is no
   admissible direction; the QP says so by returning a zero step from
   `stationary_on_working_set`. That is now recognised, and the step tolerance
   is relative to the point rather than an absolute 1e-12 that means nothing at
   hundreds of metres.

## 5. Changed Files

Added:

- `src/domain/optimization/alignment/AlignmentLexicographicSolver.js`
- `test/axtran2/lexicographic.test.mjs`
- `test/axtran2/fixtures/nineElementScenario.mjs`
- `docs/app/architecture/MISSION_REPORT_AXTRAN2_LEXICOGRAPHIC_001.md`

Modified:

- `src/domain/optimization/alignment/AlignmentConstraintBuilder.js`
- `src/domain/optimization/alignment/AlignmentSQPSolver.js`
- `src/lib/math/optim/qp/solveBoxQP.js`
- `src/lib/math/optim/sqp/merit.js`
- `src/lib/math/optim/sqp/solveSQP.js`
- `src/lib/math/optim/sqp/sqpStep.js`
- `test/axtran2/alignment-problem-declaration.test.mjs`
- `test/axtran2/sqp-solver.test.mjs`

Moved or renamed: None.
Deleted: None.

## 6. Evidence and Validation

Scenario: nine elements (straight / transition / arc / transition / straight /
transition / arc / transition / straight), lengths summing to 1430 m, R1 = 700,
R2 = −900. E0 and E8 held, so 9 free variables and 6 degrees of freedom after
the three end-pose equalities. Points sampled from the truth with a fixed-seed
lateral disturbance of ±0.04 m, tolerance 0.15 m. Start perturbed to 3.6 m of
end-pose offset. Analytic Jacobian throughout.

Design profile: minimum radius 600 m, minimum lengths 40 m straight, 60 m arc,
60 m transition. The truth satisfies all of them comfortably, so the target
stays reachable and every measurement is about the solver or the objective.

### Convergence, before and after the solver work

| objective | before | after |
|---|---|---|
| points | no verdict in 300 iterations; with the trust region alone, a false `merit_stationary` at 124 with rms 0.2375 and a KKT residual of 3.09 | `stationary` at 171, end pose 0.0, 0/12 outside, rms 0.0640 |
| accumulated-length, no design limits | no verdict in 300; `stationary` only at 3739 | `stationary` at 388 |
| accumulated-length, with design limits | — | `stationary` at **105**, end pose 2.8e-13 |

42 of the points steps and 182 of the length steps were accepted only through
the second-order correction.

### That tier 1 was descending correctly, not cheating

Taking tier 1's iterate at ΣL 1425.5612 with the end pose 5.7e-3 m open and
restoring feasibility alone from there gives ΣL 1425.5615 with the constraints
closed to 2.5e-13 — 0.4 mm apart. The shorter feasible alignment was really
there. The iteration was slow, not wrong, and raising the penalty weight, which
was the obvious move from the trace, would have been the wrong fix.

### Why tier 3 was needed

| | ΣL [m] | end pose [m] | outside | rms | R1 | element lengths |
|---|---|---|---|---|---|---|
| min ΣL, no design limits | 1415.657 | 4.6e-13 | 8/12 | 167.2 | **108** | `200 20 20 20 916 20 20 20 180` |
| min ΣL, with design limits | 1424.105 | 2.8e-13 | 8/12 | 52.9 | 600 | `200 60 215 60 482 60 107 60 180` |
| min points | 1429.994 | 0.0 | 0/12 | 0.0640 | 702 | `200 89 308 76 166 60 271 79 180` |

Without design limits, minimising the length collapses the alignment onto the
shortest path between the two poses: six of seven free elements on their 20 m
bound and a 108 m radius. That is the correct minimum of the declared objective
and not an alignment. With the limits it is one, and the gap to the points
optimum falls from 14.337 m of nonsense to **5.889 m** of real trade.

### What epsilon buys

Tier 1's optimum does not depend on epsilon, so it was solved once; each row is
tier 2 held to `ΣL <= 1424.105 + epsilon`, started at tier 1's own point.

| epsilon [m] | ΣL [m] | end pose [m] | outside | rms | R1 | R2 |
|---|---|---|---|---|---|---|
| 0 | 1424.105 | 0.0 | 8/12 | 52.878 | 600 | −600 |
| 1.5 | 1425.605 | 1.4e-12 | 7/12 | 34.731 | 645 | −765 |
| 3.0 | 1427.105 | 2.0e-8 | 8/12 | 21.543 | 698 | −840 |
| 4.5 | 1428.605 | 4.4e-7 | 7/12 | 15.016 | 642 | −731 |
| 5.889 (unbudgeted) | 1429.994 | 0.0 | **0/12** | **0.0640** | 702 | −902 |

Read this with one reservation stated plainly: the four intermediate rows all
stopped on `max_iterations` at 150, so their rms values are **upper bounds on**
the quality achievable at that budget, not the optimum under it. The first and
last rows are converged. What the table establishes is the shape and the two
ends of the trade, not the exact height of its middle.

The `epsilon = 0` row is exact and approximates nothing: tier 1's optimum is a
vertex — four transitions on their length floor, both arcs on the curvature
bound, six active bounds and four equalities pinning all nine variables — so
tier 2 has no admissible direction and returns tier 1's alignment unchanged.

### The two-phase run end to end

Strict order, no warm start, 300 iterations per phase:

| phase | verdict | ΣL [m] | end pose [m] | outside | rms |
|---|---|---|---|---|---|
| tier-1 | `stationary` at 105 | 1424.105 | 2.8e-13 | 8/12 | 52.878 |
| tier-2 | `max_iterations` at 300 | 1429.993 | 2.3e-13 | 0/12 | 0.074 |
| tier-2/budget-active | `stationary` at **0** | 1424.105 | 2.8e-13 | 8/12 | 52.878 |

with `skippedBudgets` empty — tier 1 established a real budget — and the held
phase recognising at once that it had nowhere admissible to go.

At `epsilon = 6 m`, which exceeds the span, the budget is affordable and no
held phase is needed. With 1000 iterations allowed per phase:

| phase | verdict | ΣL [m] | end pose [m] | outside | rms | R1 | R2 |
|---|---|---|---|---|---|---|---|
| tier-1 | `stationary` at 105 | 1424.105 | 2.8e-13 | 8/12 | 52.878 | 600 | −600 |
| tier-2 | `stationary` at 359 | 1429.993 | **0.0** | **0/12** | **0.0739** | 701 | −902 |

`ok=true`, `status=converged`, budget 1430.105, no tier skipped. Both tiers
reach their own optimum, every declared design limit holds, the end pose closes
exactly, and no point is outside its tolerance. That is the run in full.

Tier 2 needs more iterations inside the driver than on its own — 359 against 171
— because it starts at tier 1's vertex rather than at the declared alignment.
The warm start exists for exactly this and was left off here so that the phases
could be read without it.

### Tests

66 in `test/axtran2`, all passing: 21 declaration, 19 solver, 20 lexicographic,
6 analytic Jacobian. Full suite 1538 of 1543. The three failures are
pre-existing and environmental: `test/samples/` is untracked local data absent
from this worktree (two tests), and one test spawns `rg`, which exists here only
as a shell function and not as a binary on PATH.

## 7. Kernel and Architecture Impact

The driver decides nothing. It returns a proposal with `delta: null`; applying,
persisting and selecting stay outside this kernel, as with the solver.

No new state store, no engineering-state mutation, no persistence, no SPOT
contact, no import semantics. The optimisation library under
`src/lib/math/optim/` remains free of domain and platform references — the
boundary test in `sqp-solver.test.mjs` covers this and still passes.

The tier order is a parameter, not a constant of the module. Tier 3 is declared
data, not built-in knowledge: the constraint builder holds the shape of a design
limit and none of its values.

`AXTRAN2_OPTIMIZATION_BOUNDARY.md` was read, not modified.

## 8. Conflicts, Risks, and Open Decisions

**Correction to a correction of mine.** I had reported the finding "minimising
the length drives elements onto the sequence bound" as an artefact of too small
a penalty weight. That retraction was wrong: forcing the weight large pinned the
solve near its starting point and I mistook where it stopped for where the
optimum is. The original finding stands, and section 6 shows it in full.

**OD-2 (decision required).** What is epsilon? The measurements cannot settle
it, because it is a question about worth and not about geometry. Three readings,
all defensible:

  a. `epsilon = 0`. The length is genuinely first and the points only check the
     result, never shape it. The answer is tier 1's alignment; tier 2 becomes a
     report. On this scenario that means 8 of 12 points outside tolerance.
  b. `epsilon` at the full span, here 5.889 m. Tier 1 establishes what is
     achievable and then stops constraining. The answer is the points optimum,
     and tier 1 has told you what it cost.
  c. Somewhere between — the only reading under which both tiers shape the
     answer, and the only one that needs the middle of the table measured
     properly first.

The driver takes epsilon as a declared parameter and chooses nothing. Its
current default is 0, which is (a); if the intent is (b) or (c), the default
should change with the decision.

**OD-3 (decision required).** The design profile used here — 600 m radius, 40 m
and 60 m lengths — was chosen so the test scenario satisfies it comfortably. It
is a fixture value, not an engineering one. What are the real limits, and are
they per project, per line category, or per element?

**OD-4 (decision required).** `feasibilityTolerance`, the geometric closure
below which a tier may hand a budget down, is 1e-3 m. A millimetre-level
default, not derived from any requirement.

**R-2 (risk, open).** The intermediate epsilon rows do not converge in 150
iterations, and a budget-held points phase costs about 2 seconds per iteration
against 0.35 for a free one — some 24 alignment builds per iteration instead of
4, from backtracking and the second-order correction. If reading (c) is chosen,
this has to be addressed before the middle of the trade can be quoted.

**R-3 (limitation, accepted).** The budget active set only grows; a budget once
held is not released. With two tiers there is never more than one budget and the
case does not arise. Stated in the module.

**R-4 (limitation, accepted).** The transition-length rule is enforced in its
conservative constant form. The honest form bounds `|dkappa|`, a variable, and
needs a general inequality the solver does not carry. It is stricter than
required whenever a transition does not run the full curvature range.

Conflicts with parallel missions: None.
Terminology collisions: None.

## 9. Handover

Next safe step: decide OD-2, then set the driver's default epsilon to match. No
code change is needed to try any of the three readings — epsilon is already a
parameter — so this can be answered by running the driver, not by writing
anything.

If reading (c) is chosen, R-2 comes first: the middle of the trade cannot be
quoted from rows that stopped on `max_iterations`.

Files the next step may touch: `AlignmentLexicographicSolver.js` for the
default, `src/lib/math/optim/sqp/` if R-2 is taken up. The constraint builder
and the declaration layer should not need changing.

Independent streams: the viewer and IVHW work is untouched and can proceed in
parallel. `docs/knowledgeKernel/` was not modified.

Done criterion for the next package: the driver runs at the decided epsilon,
reports `ok=true`, and the resulting alignment honours every declared design
limit with its point residuals recorded against the tolerances.

Recommendations here do not authorize a new mission.
