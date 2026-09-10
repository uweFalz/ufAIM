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
and neutral everywhere else; the option is in the solver at its old value
of 1 and the flip is a decision, not a measurement.

The strict order's rate stays 120 of 161. The first failure above (region
collapse at a degenerate vertex, `AHBI_Gl_037`) stands as described.

