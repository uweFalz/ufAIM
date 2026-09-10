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
