# AXTRAN2: the lexicographic order on the corpus

The priority order of `AlignmentLexicographicSolver` - tier 0 the poses and
the sequence, tier 1 the accumulated length, tier 2 the points - had been
measured on the nine-element scenario only. This is its first run over real
alignments, with the corpus runner's new `--objectives lexicographic`
and `--tiers`. Solver defaults of `main` (filter acceptance, BFGS,
restoration on the verdict, budget 1000 per phase).

## What the order can mean

- **reference** (the declared default, OD-2 reading b): the length tier
  establishes what the shortest admissible alignment would be and reports
  it; the points tier decides. The result is the points fit, plus a number:
  what the points cost in length.
- **strict** (`absolute: 0`): the points may only use what the length tier
  left indifferent. Tier 2 runs first free, and if it overspends, again with
  the length held as an equality (`budget-active`).
- **a budget** (`absolute: ε` metres): "ε metres of length are worth
  spending on the points".

## Measured on the corpus, range 0–161 (3 to 41 elements)

| tiers | ok | no verdict | points rms (tol. units) | length spent over the shortest | tier-2 iterations |
|---|---|---|---|---|---|
| reference | 150 / 161 | 7 no budget, 4 max_iterations | **0.132** | mean 0.60 m, max 15.0 m | 0.7 |
| absolute 5 m | 152 / 161 | 7 no budget, 2 qp_failed | 1.59 | mean 0.53 m, max 5.0 m | 38 |
| absolute 0.5 m | 151 / 161 | 7 no budget, 2 qp_failed, 1 max_iterations | 7.96 | mean 0.15 m, max 0.5 m | 37 |
| strict | 118 / 161 | 7 no budget, 16 max_iterations, 12 qp_failed, 5 restoration_failed, 3 line_search_failed | 7.49 | 0 | 16 |
| strict, merit acceptance | 105 / 161 | 9 no budget, 17 max_iterations, 12 line_search_failed, 11 qp_failed, 7 restoration_failed | 7.94 | 0 | – |

"No budget" (`tier_established_no_budget`): the length tier's result did
not honour tier 0 to the gate, so nothing was handed down and the points
decided alone.

## What it says

- **The reference order is a measurement, and a good one.** The points fit is
  the points fit (rms 0.132 as in the single-objective run), and the length
  tier adds one number the single objectives cannot: on these files the
  as-built geometry is 0.60 m longer on average than the shortest admissible
  alignment through the same poses, and 15 m at most. That number is the
  engineering content of tier 1.
- **The strict order throws the points away.** The shortest alignment leaves
  the sample points by 7.5 tolerance units - over a metre - and the phase
  that holds the length as an equality at the length tier's vertex fails on
  43 of 161 files. This is not the acceptance rule: under the merit it is
  worse (105). A hard length equality on top of the end pose at a vertex of
  the box is the degenerate problem the vertex tier test describes; the
  solver survives it on small files and not in general.
- **A budget is only as good as its size.** Half a metre buys nothing (rms
  7.96, the points remain out of reach on most files); five metres buys most
  of the fit (rms 1.59) with the same failure count as the reference. The
  declared epsilon has to come from the engineering question, and on this
  corpus the answer to "what would keeping the points cost" is the
  reference run's own number: 0.6 m on average, 15 m at most.

## What follows

- The reference order is fit for the app's option C ("rules where the
  measurements are silent") as far as the length is concerned: run it, show
  the span. Nothing to build in the solver for that.
- The strict order's budget-active phase: see the next section.
- The four `max_iterations` under the reference are the points objective's
  own (the flat valley); the prior would end them as in #26.

## The whole corpus, reference order (212 files)

167 of 212 ok (78.8 %): 23 without a budget, 20 `max_iterations`, one
`line_search_failed`, one `qp_failed`. Points rms 0.129. Of the 17 files with
40 and more elements one reaches a verdict: eight end `max_iterations` on
the points (the flat valley), eight hand no budget down because the length
tier on those files ends `inadmissible_points` or `infeasible_subproblem`
(the shortest alignment without the points as constraints, as the corpus
baseline notes). The length spent over the shortest admissible alignment is
34 m on average and 1628 m at most - the Kyll valley lines (25 elements),
where the as-built winds and the design limits would admit a far shorter
alignment through the same poses. That number is what tier 1 is for.

## The budget-active phase, made as robust as it gets (2026-09-10)

Five things were built or tried for the strict order's held phase, each
measured on 0–161 against the 118 of 161 it finished before:

| change | ok / 161 | what it did |
|---|---|---|
| Gauss-Newton curvature for the phases | 119 | nothing for the failures |
| eager restoration | 118 | never triggers: the witness start is feasible |
| start at the overspending optimum, restored onto the budget first | 80 | worse: the restoration from the fit onto the budget manifold stalls (47 restoration_failed) |
| **a subproblem that runs out shrinks the region and tries again** (kept, `solveSQP`) | 120 | qp_failed 12 → 3; a smaller box changes the degenerate active set |
| **a zero step shrinks the region and ends at its floor** (kept, `solveSQP`) | 120 | the 872-iteration idle loop at a collapsed region ends as `line_search_failed` at 130 instead of `max_iterations` at 1000 |

The single objectives are unchanged by the two kept changes (322 of 322
rows identical on 0–161).

What remains, on the two files looked at closely: at a degenerate vertex
with the length held as an equality the subproblem answers
`stationary_on_working_set` with a zero step while δ sits at 0.57, and the
region collapses to its floor (`AHBI_Gl_037`); or the iteration zigzags
with a step of 4e-3, f and the violation unchanged to nine digits and a
KKT residual of 3, for as long as the budget lasts (`AHBI_Gl_033`) - a
non-stationary point the filter's margins cannot tell from progress. Both
are the same thing seen twice: the feasible set under a hard length
equality at the length optimum's vertex is a sliver cut by bounds, and the
points fit on it is a bad fit (rms 7.5, over a metre) whose level sets are
steep against that sliver. The verdict rate of the strict order is a
property of the question, and a robust phase reports it early and by name
rather than answering it.

## The zigzag that was a creep (2026-09-10)

The second failure above was misread. Looked at with twelve digits,
`AHBI_Gl_033`'s held phase does not zigzag: from iteration 40 to 1000 every
step is full and uncorrected, f falls by 5e-3 a step, the relative KKT
residual sits at 1.4e-5 - stationary to the solver's own tolerance of
1e-4 - and the violation sits at 1.5e-4 with the relaxation at zero,
falling by one part in ten thousand a step. The subproblem closes the
linearised constraints every time; the tangential step along the
objective's descent regenerates the same residual at second order. That is
the Maratos effect, and the correction that answers it is only tried when
the full step *raises* the violation, which this one never does.

Two things were built against it and measured on the corpus 0–161:

| change | strict order ok / 161 | single objectives | what it did |
|---|---|---|---|
| second-order correction also when the step leaves more than a tenth of the violation (`correctionClosure` 0.1) | 120 | 160 + 161 of 161 (from 159 + 161); 127 of 322 rows move either way, iterations 12 542 → 12 300 | `AHBI_Gl_033` converges at 74; elsewhere neutral with noise |
| the same at 0.5 | 119 | not measured | still creeps at 5e-5, with a correction every step |
| **creep verdict** (kept: `infeasible_stationary`, reason `creep`) | 120 | 159 + 161, 321 of 322 rows identical | `AHBI_Gl_033` ends at 100 instead of 1000; `Gls401v` length fires at 35, restored in one step, converged at 52 instead of 51 |

The verdict: a point stationary to `stationarityTolerance` and infeasible,
whose violation over `creepWindow` (20) consecutive such iterations shrinks
at a geometric rate that will not reach the tolerance within the budget
that is left - or does not shrink at all. It is handed to the restoration
like the fully relaxed subproblem's verdict and reported once the
restoration limit is spent. On `AHBI_Gl_033` the restoration closes the
1.5e-4 twice and the descent creeps back into it both times; the third is
reported. On `Gls401v` under the plain length objective the violation was
*growing* over the window (ratio 1.16 a step, full steps of 0.57 m with the
objective descending), the one restoration step took it to 7e-12 and the
run finished.

The correction on weak closure is the better answer to the Maratos creep
where it is one - it turns the verdict on `AHBI_Gl_033` into a solution -
and neutral everywhere else. **Decided 2026-09-10 (Uwe Falz):
`correctionClosure` 0.1 is the default.** Measured with the creep verdict
in place, against the default of 1 on 0–161:

| | `correctionClosure` 1 | 0.1 (default) |
|---|---|---|
| strict order ok / 161 | 120 | 122 |
| single objectives ok | 159 + 161 | 160 + 161 |
| single objectives, iterations | 12 560 | 12 243 |
| single rows moved (status or iterations) | | 124 of 322, none to a failure; 20 swaps converged ↔ stationary, one `qp_failed` → `stationary` |
| strict rows moved | | 27 of 161: 7 failures → converged (`AHBI_Gl_033` among them, at 74), 5 converged → failure (`1285_261-262_KM`, `AHBI_Gl_073`, `AHBI_Gl_031`, `AHBI_Gl_075`, `Ka_NCH_Gl1A`) |

The held phase is a chaotic question, and a change to any step rule
reshuffles which sliver fits it finds; the net is two more, and no single
objective got worse. The verdict stays for the creeps the correction does
not close (the unit test holds the rule at 1 to measure it).

The first failure above (region collapse at a degenerate vertex,
`AHBI_Gl_037`) stands as described.

## The degenerate length budget, and the corridor that would fix it (2026-09-14)

The length tier asks for the shortest admissible chain between the poses,
and nothing in that question holds the chain to the measurements. On the
giants it shortens the alignment by 3 to 11 km (`dL` in the tables of
AXTRAN2_QP_ACTIVE_SET_2026-09-11.md) and hands the strict order a budget
no fit can meet; the held phase then fails at once, `infeasible_subproblem`
at 15. On `3250_4-11_S` (64 elements) the same tier ends `stationary` at
263 with the alignment 1008 m shorter and the points 3125 tolerances off.
The strict order's rms of 7 to 17 on the files it does finish is the mild
form of the same thing: the length optimum has left the points, and the
held phase fits what it can on the length-preserving manifold.

What would fix it is a corridor - the measured points as a constraint of
the length tier, so that the question becomes the shortest alignment that
still carries them. Two forms were built and measured on `3250_4-11_S`:

| corridor | length tier alone, from the perturbed start | in the strict order, from the warm start |
|---|---|---|
| two rows per point, \|r_i\| ≤ 1 | 306 slacks in the subproblem; three attempts, 4260 s, `infeasible_subproblem` at rms 0.66 | 1328 s, tier 1 `infeasible_subproblem` at 322, no budget |
| one row, rms ≤ 1 (Σr²/N − 1 ≤ 0) | `restoration_failed` at 0: restoring the corridor from a far start is a points fit, and the restoration's Gauss-Newton stalls at rms 24 | reaches the answer - the alignment 1.2 m shorter than the warm start, at rms 1.00 - and cannot end there: `restoration_failed` at 291 |

The one-row form is the right size and shows what the answer is: within
the noise the shortest alignment is a metre shorter, not a kilometre. It
does not converge on the corridor's boundary. The row is quadratic in the
residuals and its linearisation has no slope along the directions the
points do not determine - exactly the directions the length gradient
pulls along - so every subproblem overshoots the corridor at second order
(rms 9 after the first steps, from 0.16), the region and the filter bring
it back over eighty iterations, and at the boundary the region collapses
with the subproblem fully relaxed while the corridor stands 0.4 % over;
the restoration, Gauss-Newton on that one row against four end-pose rows,
stalls there. What the subproblem lacks is the constraint's curvature,
μ · 2J'J/N, the Lagrangian's second-order term: the evaluator contract
carries no multipliers, so the model cannot form it, and BFGS learns it
too slowly to hold the boundary.

What the subproblem lacked is now in the model (2026-09-19). solveSQP
hands the evaluator the multipliers of the last subproblem (null before
the first), and the alignment solver folds the corridor's curvature,
μ · 2J'J/N, into the Hessian it provides; the length tier runs in
Gauss-Newton mode with the hybrid switch at zero, so the model is the
Lagrangian's. On `3250_4-11_S` the tier ends `stationary` at 926 with the
alignment 1.26 m shorter at rms 1.000, and the strict order finishes on
that budget - the held phase at 2.

Measured on the corpus without the giants:

| | ok / 235 | \|ΔL\| to the truth, mean / max | rms of the fit |
|---|---|---|---|
| strict order, no corridor (same day, same code) | 139 | 105 m mean, 1629 m max | 7 to 17 |
| **strict order, corridor** (default now) | **199** | **0.16 m / 2.0 m** | 0.80 |
| length objective alone, corridor, from the perturbed start | 187 | 0.08 m / 1.0 m | 0.78 |

The corridor is the lexicographic order's default for its length tiers
whenever a points tier is in the order (`solver: { corridor: false }`
turns it off; an order of length alone is a length fit and runs to the
bounds). It is not the default of a
single length fit: from a perturbed start the corridor has to be reached
first, which is a points fit the restoration does badly (25 of 235
`restoration_failed`), and the warm start of the lexicographic order is
what provides it. The thirty-six strict runs that still fail are 15 with no
budget (the length tier not finished), 18 out of budget in the length
tier - the corridor's boundary is reached at 600 and held slowly - and 3
verdicts.

The thirteen giants under the strict order today, for the record: 0 of
13, as on 2026-09-12. Nine establish no budget (the length tier ends
`stationary` but the run is not held to it), three establish a degenerate
one - the alignment 4.0, 10.9 and 10.9 km shorter - and fail at once in
the held phase, one runs out in its second tier. The run took 5.7 hours,
most of it on one file whose failed phases were retried with two more
Hessians because the corpus runner passed `hessian` explicitly and
overrode the phases' BFGS; the runner now passes it only when asked.

The thirteen giants under the strict order with the corridor: 0 of 13 by
verdict, and the answers are the right ones. Ten reach the corridor's
boundary and run out of the length tier's budget there, the alignment
1.9 to 5.7 m shorter at rms 1.00; the held phase then finishes on five of
them and runs out on four. Two fail the length tier before the boundary
(`line_search_failed` at 393, `restoration_failed` at 101). Two things
in that table are open items rather than results: on the two
`1280_..._KM` files the held phase reports `stationary` at 2 and 6 with
rms 23 763 and 24 339 - a verdict on a collapsed geometry, which the
within-tolerance rule does not cover and the step-too-small rule should
not grant; and one run of `6100_247-282_LI` took 46 123 s where its twin
took 737 s, which is a cost with no explanation yet. The length tier at
the boundary is the slow part everywhere: 1000 iterations for the last
metres, where the corpus's 64-element file needs 926.

## The "verdict on a collapsed geometry" was the foot memory's branch (2026-09-20)

The two `1280_..._KM` giants whose held phase reported `stationary` at
rms 23 763 were reproduced with a trace, and the collapse was earlier and
elsewhere: the free points phase, started at the corridor's witness
(rms 1.00, checked through a fresh scan), evaluated to f = 8.5e10 a
hair's breadth from it - a discontinuity in the residuals, not in the
solver. The trace of the evaluations found it. A trial step of the
points fit put every curvature on its bound (1/300) and every length
98 m longer; on that geometry the far end of the 22 km alignment coils
next to its start, and the points of km 19 found their nearest foot at
station 850, ten kilometres off. The line search halved that step forty
times back to the start, and at every halving the foot memory's Newton
started from the station it remembered - which stayed a stationary point
of the distance, never the nearest - so the wrong branch walked all the
way back to the witness: 61 feet wrong at the truth, rms 25 000 where the
scan says 0.15. The check of #48 (a station moved by more than 200 m is
stale) could not see it: each halving moved the geometry a little, and
the branch was inherited across a continuous path.

The rule now: a foot farther from its point than the stale distance is a
foot on a wreck and is not remembered; the next evaluation scans and
resumes from the last foot worth the name. The path from the wreck back
to the truth leaves no foot wrong (`corpus.test.mjs`, 5 s on the giant),
the free points phase from the witness ends within tolerance on both
files, and their held phases run to the corridor's boundary and out of
their budget there at rms 1.00 - the slow boundary, not a collapse.

Found on the way: the corpus runner passed every solver option it knew,
undefined where not asked, and the lexicographic order spread them over
its own defaults - `corridor: undefined` switched the corridor off and
`hessian: undefined` put the phases on "auto" (the 12 932 s giant of
2026-09-14). The order now ignores an option the caller left undefined.
The strict order of 2026-09-19 (199 of 235) had been measured with the
corridor passed explicitly and the phases on "auto"; measured again with
the two fixes and the phases on BFGS: 196 of 235 in 791 s (the three are
files the "auto" retries had carried; the phases stay on BFGS, and the
retry there remains a choice). Points 235 of 235 and the giants 13 of 13
are unchanged by the memory rule.

## The slow boundary: a length that has settled is a length (2026-09-21)

The length tier under the corridor took 852 iterations on `3250_4-11_S`
and the whole budget on every giant. The trace at the boundary: from
iteration 100 the length changed by 3 mm in total, every step full with a
correction, the corridor exactly active, the multiplier constant at 0.64,
and the KKT residual between 3e-3 and 5e-2 of the gradient - all of it in
the determined directions, where one row's gradient cannot balance a
43-dimensional projection of the length's. The iteration crawls along a
strongly curved constraint with a linear objective, and what it is
crawling after is millimetres.

**The rule.** `objectiveSettled: { steps, absolute, feasibility }` in
solveSQP: at a feasible point, when the objective's whole swing over
`steps` accepted steps is at most `absolute` in its own unit, the solve
ends `stationary` with the reason `objective_settled` - after one
restoration to the absolute `feasibility` asked, since a creeping tier
leaves the end pose at 4e-6 where the order's gate wants 1e-8. This is
not the rate test on a residual norm that AXTRAN2_FLAT_VALLEY_FINDING.md
§3 rejected; it is the caller saying what a millimetre of length is
worth. The alignment solver sets it for the length objective under the
corridor (twenty steps, a millimetre, 1e-9), and the lexicographic order
sets it for its held points phase (twenty steps, a hundredth of a squared
tolerance): from a witness that is a settled length rather than a KKT
point, the fit at that length improves by a part in a thousand and then
walks the valley - f 76.50 to 76.33 over a thousand iterations, its
residuals above tolerance by the corridor's own construction. Measured,
that phase ends at its first window everywhere: the witness is the
answer, as the theory says it must be.

| | strict ok / 235 | iterations | time | \|ΔL\| mean / max | giants strict |
|---|---|---|---|---|---|
| 2026-09-20 | 196 | 77 094 | 791 s | 0.15 m / 2.0 m | 0 / 13 (16.7 h) |
| **settled tiers** | **220** | **41 456** | 1049 s | 0.23 m / 2.0 m | **12 / 13 (2.6 h)** |

`3250_4-11_S`: the length tier at 143 instead of 852, the order in 25 s
instead of 57. The giants end 1.9 to 5.7 m shorter at rms 1.00, the held
phase at 20 on every one; the one that fails, `1280_026-049_RE`, loses
its length tier to a failed restoration at 812. The remaining thirteen of
the 235 establish no budget (the length tier fails before the boundary),
two are `infeasible_subproblem`.

