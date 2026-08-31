# MISSION REPORT

## 1. Mission

MISSION-AXTRAN2-LEXICOGRAPHIC-001 — carry the declared engineering priority
order end to end:

    tier 0   poseA, poseE, element sequence   never traded
    tier 1   accumulated element length       minimised
    tier 2   reality check via point offsets
    tier 3   design limits                    declared, with provenance

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

**OD-2, OD-3 and OD-4 are decided.** Epsilon is at the full span, reading (b), and
tier 3 is a declared profile with provenance and the real cant kinematics. The tier-0 gate compares metres with metres at 1e-8 m, a value read off the
measurements rather than chosen. What is left of OD-3 is a person checking the
profile numbers against the rule book they name, which no code can do.

**OD-2, reading (b), epsilon at the full span.** The length tier
establishes what its objective could achieve, reports it, and stops
constraining. The answer is the points optimum and the length tier has said what
it cost — on the measured scenario, 5.889 m.

Epsilon at the full span and no constraint at all are the same thing, so the
limit is not imposed rather than computed and then never binding. A tier now
hands its value down either as a `limit`, which constrains, or as a `reference`,
which reports; `reference` is the default. Readings (a) and (c) remain one
declaration away.

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

### Tier 3, a declared profile with provenance

The design limits are a profile, not numbers in a fixture. A smallest admissible
radius becomes a two-sided bound on every free curvature — a curve may run
either way and may straighten out entirely, but may not be tighter than the
design allows — and a smallest admissible length per element kind takes over
from the sequence bound wherever it is stricter, recording which of the two is
speaking.

**Provenance is required, not encouraged.** Every declared value is
`{ value, source }`; a bare number is refused, and so is a profile that does not
say where it comes from. A limit nobody can trace cannot be reviewed, and will
be copied into the next project by someone who assumes it was.

The kinematics is the real one, with cant. With `s` the dynamic gauge, `u` the
applied cant and `u_f` the deficiency:

    R >= s V^2 / (g (u + u_f))
    L >= V u / (du/dt)          cant ramp in time
    L >= n u                    cant ramp in space, gradient 1:n
    L >= V u_f / (du_f/dt)      deficiency change rate

All four are physics and geometry; every limit inside them is a rule-book number
and is declared. A transition takes the longest of the three length rules, and
the two that did not bind stay on the record with the formula that produced
them. A rule-book floor — EBO's smallest radius — is not a competing derivation
but a floor: the binding radius is the larger of it and the kinematics, and
which one spoke is reported.

Local departures are declared per element with their own reason, because real
projects keep curves they inherited and station throats run tighter than the
open line. An exception that cannot say why is refused; it is indistinguishable
from an error.

Cant itself is not modelled. AXTRAN2 optimises the horizontal alignment, and
cant enters as an assumption at its declared maximum — which makes the three
length rules the worst case for an element running the full cant range, and
conservative for one that does not.

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
- `src/domain/optimization/alignment/AlignmentDesignProfile.js`
- `src/domain/optimization/alignment/profiles/index.js`
- `test/axtran2/lexicographic.test.mjs`
- `test/axtran2/design-profile.test.mjs`
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

Design profile: `hauptbahn-V100` at 140 mm of cant, which derives a smallest
radius of 491.8 m and a shortest transition of 77.8 m. The scenario's own truth
— R1 = 700, R2 = 900, transitions of 80 and 90 m — satisfies those narrowly, on
purpose: a profile with room to spare would not show whether the limits reach
the solver at all.

Measurements taken before the profile existed used bare limits of 600 m and
40/60/60 m and are labelled where they appear.

The derivations, checked the cheapest way there is — a faster line must need a
larger radius and longer transitions:

| profile | R_min [m] | shortest transition [m] |
|---|---|---|
| hauptbahn-V100 | 453.9 | 88.9 |
| hauptbahn-V160 | 1162.1 | 142.2 |
| hauptbahn-V200 | 1627.9 | 177.8 |

Worth stating: under `hauptbahn-V160` this scenario's own truth would be
inadmissible — 700 m against a required 1162 m. That is the profile working.

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

### The two-phase run end to end, as decided, under the declared profile

Reading (b), the default: no warm start, 400 iterations allowed per phase,
under `hauptbahn-V100` at 140 mm.

| phase | verdict | ΣL [m] | end pose [m] | outside | rms | R1 | R2 | profile |
|---|---|---|---|---|---|---|---|---|
| tier-1 | `stationary` at 123 | 1423.234 | **0.0** | 8/12 | 65.956 | 492 | −492 | held |
| tier-2 | `stationary` at **57** | 1429.994 | **0.0** | **0/12** | **0.0828** | 702 | −901 | held |

`ok=true`, `status=converged`, no tier skipped. The reference reports:
achievable 1423.234 m, spent 1429.994 m, **span 6.760 m**.

The length tier sits exactly on the radius limit and on the transition floor,
which is what a limit is for. Both phases honour every limit in the profile.

Under the earlier bare limits of 600 m and 40/60/60 m the same run gave
1424.105 m and 1429.994 m with rms 0.0640, a span of 5.889 m, and tier 2 taking
171 iterations. The real profile costs a little point quality — its transition
floor is 77.8 m against 60 — and buys a wider, honest span.

Both tiers reach their own optimum, every declared design limit holds, the end
pose closes exactly, and no point is outside its tolerance.

Because a reference tier hands no point down, tier 2 starts at the declared
alignment rather than at tier 1's vertex. That is measurably better, not merely
tidier: 171 iterations against 359, and rms 0.0640 against 0.0739.

### The same run under the readings not taken

Reading (a), the strict order, no warm start, 300 iterations per phase:

| phase | verdict | ΣL [m] | end pose [m] | outside | rms |
|---|---|---|---|---|---|
| tier-1 | `stationary` at 105 | 1424.105 | 2.8e-13 | 8/12 | 52.878 |
| tier-2 | `max_iterations` at 300 | 1429.993 | 2.3e-13 | 0/12 | 0.074 |
| tier-2/budget-active | `stationary` at **0** | 1424.105 | 2.8e-13 | 8/12 | 52.878 |

with `skippedBudgets` empty — tier 1 established a real budget — and the held
phase recognising at once that it had nowhere admissible to go.

An explicit `epsilon = 6 m`, which exceeds the span, reaches the same answer the
long way round: the budget is computed, found affordable, never held, and tier 2
still starts at tier 1's vertex because a limit tier does hand its point down.
`ok=true` at 1429.993 m with rms 0.0739, after 359 iterations. That this costs
188 more iterations and a slightly worse optimum than the decided default is the
argument for not expressing (b) as a very large epsilon.

### The tier-0 gate

The heading, judged as the distance it accumulates to over the alignment's own
length, alongside the position it sits beside:

| objective | iterations | verdict | position [m] | heading [m] |
|---|---|---|---|---|
| accumulated-length | 1 | `max_iterations` | 1.14e-2 | 9.54e-3 |
| accumulated-length | 3 | `max_iterations` | 1.17e-5 | 5.89e-5 |
| accumulated-length | 60 | `max_iterations` | 4.15e-3 | 1.04e-2 |
| accumulated-length | 300 | `stationary` | 0.0 | 3.95e-14 |
| points | 5 | `max_iterations` | 1.69e-6 | 2.35e-6 |
| points | 20 | `max_iterations` | 4.45e-11 | **1.09e-10** |
| points | 300 | `stationary` | 0.0 | 0.0 |

The row in bold is the one that sets the band's upper edge, and the reason the
gate must not be a convergence test: it stopped on `max_iterations` with its own
objective still moving, and it honoured tier 0 to 1e-10. It has to be accepted.

### Tests

81 in `test/axtran2`, all passing: 21 declaration, 19 solver, 20 lexicographic,
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

**OD-2 (decided: reading (b)).** Epsilon at the full span. Implemented as a
reference rather than as a limit, because the two are the same thing and only
one of them runs machinery for nothing. The default tier order carries it.
Readings (a) — `absolute: 0` — and (c) — any positive epsilon — remain declared
options and are still tested.

One consequence worth stating: under (b) the length tier never shapes the
answer, only measures it. If a later scenario should show the span growing large
enough that the length matters engineeringly, the decision is worth revisiting
against that number rather than against this one.

**OD-3 (decided, with one part left to a person).** The limits are a declared
profile. Where they live is answered by design: a profile is declared **with the
problem**, because two alignments in one project can sit under different rules —
a new line and a reconstruction, an open line and a station throat. What is
shared is named in `profiles/index.js` so it can be referenced rather than
retyped; what is local is an `exception` on the problem's own profile, with its
own reason.

**What remains is not a design question but a reading one.** Every shipped
profile is `status: "candidate"`, and that is the accurate state, not modesty:
the values were entered from the sources each one names, and the current text of
those sources was not read while writing them. Each such value carries `CHECK`
in its source string. Before a profile is used for anything anyone signs, its
numbers have to be checked against the rule book it names and the status moved
to `confirmed`. No code does that.

The values most in need of checking are the rate limits — `maximumCantRate`,
`maximumDeficiencyRate`, `cantGradient` — because they differ by line category
and by whether the case is the normal one or an exception. The radius floor
(EBO § 6) and the cant maxima want checking too, but a wrong rate limit changes
every transition length in the alignment.

**OD-4 (decided: 1e-8 m, and the comparison it makes was wrong).** Before the
value there was a defect. Three quantities were tested against one number — a
distance in metres, a lateral offset in metres, and a heading in radians — and
they are not comparable. Over this alignment 1e-3 rad is 1.43 m of drift, so the
heading was held a thousand times more loosely than the position beside it. The
heading is now multiplied by the alignment's own length and compared as the
length it is; where no length is available the angle is compared in radians and
the report says so.

The value is measured. This gate is not an engineering tolerance — how exactly
the end pose is met is the solver's business — it asks whether a tier honoured
tier 0 at all, and a tier can answer yes without having converged. Reading the
closure off both objectives at 1 to 300 iterations:

| | end-pose closure |
|---|---|
| honours tier 0 | 0, 3.95e-14, 1.09e-10 m |
| does not | 1.69e-6, 1.17e-5, 3.23e-5, 1.97e-3 … 1.16e-1 m |

Any threshold between those groups gives the same verdict on all of them. 1e-8
is the middle of the band on a log scale: 92 times above the tightest result
that must be accepted, 169 times below the loosest that must be refused.

This also corrects reasoning of mine. I had argued for 1e-6 from a gap of ten
orders of magnitude between converged tiers and stopped ones. The gap is a
factor of 1.5e4, and it is not between converged and not: the tightest case that
must be accepted is a points phase stopped at 20 iterations, still moving on its
own objective while meeting the end pose to 1e-10. Conflating the two questions
would have put the threshold at the edge of the band rather than in its middle.

**R-2 (risk, dormant under the decision).** A budget-held points phase costs
about 2 seconds per iteration against 0.35 for a free one — some 24 alignment
builds per iteration instead of 4, from backtracking and the second-order
correction — and the intermediate epsilon rows do not converge in 150 iterations
because of it. Under reading (b) no held phase runs at all, so nothing pays this
today. It returns the moment anyone declares a real epsilon, which is why the
middle of the epsilon table is quoted as upper bounds and not as optima.

**R-3 (limitation, accepted).** The budget active set only grows; a budget once
held is not released. With two tiers there is never more than one budget and the
case does not arise. Stated in the module.

**R-4 (limitation, accepted).** The transition-length rules are enforced at the
declared maximum cant, which is the worst case. An element that does not run the
full cant range is held to a longer transition than it needs. The honest form
couples length to the curvature change, which the solver carries as neither a
bound nor an equality, and it is the same conservatism as bounding `|dkappa|` by
`1/R`.

Conflicts with parallel missions: None.
Terminology collisions: None.

## 9. Handover

The priority order is carried end to end and the decision it waited on is made.
Nothing in this package is left half-built.

All four open decisions are made. Next safe step: confirm the shipped profiles
against the rule book and move their status to `confirmed`. That is reading and checking, not building — the
only change in the repository is a status field and, where a number turns out
wrong, the number.

Files that step may touch: `src/domain/optimization/alignment/profiles/index.js`
and nothing else. The profile module, the constraint builder, the solver and the
driver should not need changing.

Independent streams: the viewer and IVHW work is untouched and can proceed in
parallel. `docs/knowledgeKernel/` was not modified.

Done criterion for the next package: every value in a shipped profile has been
checked against the source it names, no `CHECK` remains in a source string, and
the profile's status is `confirmed`.

Recommendations here do not authorize a new mission.
