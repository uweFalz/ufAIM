# AXTRAN2: a filter in place of the merit — design and measurement

Design for the last open item of the scaling work (#23–#30): the length
objective on 119 elements ends `infeasible_subproblem` with the end pose a
kilometre off. A prototype was built behind an option, off by default, and
measured; the numbers decide what is proposed.

## 1. What goes wrong, as measured

`1280_026-042` (119 elements, 169 free quantities), length objective, eager
start. The restoration makes the start feasible (violation 289 → 1e-9). Then:

| iteration | f [m] | violation | α | region |
|---|---|---|---|---|
| 1 | 14830 | 2 | 1 | 300 |
| 3 | 13421 | 320 | 1 | 1200 |
| 6 | 11162 | 1900 | 1 | 9700 |
| 9 | 9323 | 7200 | 1 | 77000 |
| 15 | 7397 | 7600 | 1 | 610000 |

Fifteen full steps, no backtracking, the region doubling each time, the
objective down by 7.5 km and the end pose 7.6 km off. The l1 merit accepted
every one. For the length objective the exchange rate is one: a metre of
length costs a metre, a metre of end miss costs its multiplier, and at the
optimum that multiplier is about one; Powell's rule with the safety of 2
(#11) prices a metre of violation at two metres of length, so a step that
gains three and loses one is a bargain. The linearisation that promised
"end pose met" (δ ≈ 1e-7) was wrong by kilometres, and the region grew on
every acceptance.

After the wander the merit cannot come back: a step that repairs 200 m of
violation and costs 500 m of length is a merit increase. The subproblem
comes back fully relaxed, the second restoration goes from 5476 to 1231 and
stalls, the verdict is `infeasible_subproblem` at 37.

Two things were tried before this design and rejected with numbers: a bound
on the violation's growth per step (2026-09-09, slower verdicts on the
corpus, a `qp_failed`), and a larger penalty safety (10 and 100: no verdict
either).

## 2. What a filter does differently

A Fletcher–Leyffer filter keeps the pairs (violation h, objective f) of the
points it has left behind and accepts a trial that is not dominated by any
of them - h below every remembered h by a margin, or f below every
remembered f by a margin of that h - and under a ceiling on h. It does not
prevent the wander: each wandering point had lower f than the last and is
undominated. It changes two things:

- **the ceiling** - h may not exceed `filterCeiling × max(1, h₀)`; with h₀ the
  restored start's 1e-9, a ceiling of 100 holds the wander at 100 m;
- **the way back** - a step that lowers h is acceptable whatever it costs in
  f, as long as some remembered point does not dominate it. The merit refuses
  exactly this step.

The rest stays: the relaxed subproblem, the trust region sized by the
search, the second-order correction, Powell's weights (still used for the
`merit_stationary` verdict), restoration on the verdict. The prototype
implements acceptance only: `meritOf` returns "accepted" or `Infinity`, the
Armijo search backtracks on `Infinity` as it would on a merit rise, and after
an accepted h-type step the point left behind enters the filter.

Parameters (Wächter–Biegler 2006 for the margins): `filterMargin` 1e-5,
`filterCeiling` 1e4 in the literature and 1e2 here - see below.

## 3. Measured on the prototype

Length objective, eager start, budget 1000:

| file | merit (default) | filter, ceiling 1e4 | filter, ceiling 1e2 |
|---|---|---|---|
| 1280_026-042, 119 el. | infeasible_subproblem @37, end pose 1.0e3 m | stationary @289, end pose 2e-7, f 13583 | stationary @574, end pose 1e-6, one restoration |
| 5500R074-082, 41 el. | stationary @386, 1.8 s | stationary @391, 0.9 s | – |
| 2631K139, 110 el. | stationary @647, 82 s | inadmissible_points @21 | – |

The 119-element run under the filter (ceiling 1e2): the wander tops at 100 m
at iteration 57, the end pose is met to 1e-3 by iteration 245, the objective
settles at 11015 (the merit's 7397 was never feasible). 466 of 572 steps
full.

Corpus 0–161 under `bound`, both objectives, filter against merit:

| objective | verdicts merit | verdicts filter | mean iterations | quality |
|---|---|---|---|---|
| length | 159 | 158 (−1: AHBI_Gl_075 max_iterations) | 56 → 33 | 2 rows longer by > 1 cm |
| points | 159 | 158 (+2 / −3, two of them `qp_failed`) | 41 → 42 | rms worse on 8 rows, better on 1 |

## 3a. Measured with the switching condition (2026-09-10)

The switching condition of Wächter-Biegler (s_θ 1.1, s_f 2.3, δ 1, η_f 1e-4)
was built into the prototype: when the model predicts a large decrease of f
against the violation, the trial must satisfy Armijo on f and is an f-type
step that leaves the filter alone; otherwise the filter decides against the
current point with the margins, and an accepted h-type step adds the point
left behind, margins taken.

Length objective, eager start, budget 1000:

| file | merit | filter + switching, ceiling 1e4 | ceiling 1e2 |
|---|---|---|---|
| 1280_026-042, 119 el. | infeasible_subproblem @37, end pose 1.0e3 m | stationary @289 | stationary @509, 4 restoration steps, end pose 1.5e-9 |
| 5500R074-082, 41 el. | stationary @386, 1.8 s | stationary @391, 0.9 s | stationary @425, 0.9 s |
| 2631K139, 110 el. | stationary @647, 82 s | inadmissible_points @21 | **stationary @614, 31 s** |

Corpus 0–161 under `bound`, filter + switching (ceiling 1e4 and 1e2 give the same rows) against merit:

| objective | verdicts | mean iterations | quality |
|---|---|---|---|
| length | 159 → 158 (AHBI_Gl_075: converged at 1326 instead of stationary at 21) | 56 → 33 | 2 rows longer by > 1 cm |
| points | 159 → **161** (AHBI_Gl_021_034, Gls432 gained; the two `qp_failed` of §3 gone) | 44 → 41 | rms worse 0, better 0 |

## 4. Proposal (revised)

- With the switching condition the filter is level or better than the merit
  on everything measured: every giant reaches a verdict with the ceiling
  1e2, the corpus gains two points verdicts and loses one slow length
  verdict, the length objective needs half the iterations, no row is worse
  in rms. The recommendation is now **`acceptance: "filter"` with
  `filterCeiling` 1e2 as the default**. The switch is one word; it is not
  flipped on this branch, because every verdict, restoration and hybrid
  decision since #10 was measured against the merit and a default change
  is a decision, not a measurement.
- The merit keeps its two jobs either way: Powell's weights price the
  `merit_stationary` verdict, and `acceptance: "merit"` stays available.
- The 110-element `inadmissible_points` under ceiling 1e4 is the length
  objective without the points as constraints walking off its samples; the
  ceiling 1e2 keeps it on them. The lexicographic layer, where points precede
  length, remains the right home for that objective.

## 4b. Proposal (as first written)

- **Not the default.** On the corpus the filter is level on verdicts and
  worse on the points objective's quality; the merit with Powell's weights is
  the better everyday rule, and every verdict, restoration and hybrid
  decision since #10 was measured against it.
- **An option for the length objective at scale**, `acceptance: "filter"`
  with `filterCeiling` 1e2: it is the only thing that has reached a verdict
  on the 119-element shortest-alignment problem, and it halves the length
  objective's mean iterations on the corpus.
- **The 110-element loss is a different problem.** `inadmissible_points`:
  the shortest alignment walks so far that three sample points lose their
  foot on it. That is a property of the length objective without the points
  as constraints, not of the acceptance rule; the lexicographic layer, where
  points precede length, is where it belongs.
- **What would make the filter the default** is a switching condition
  (Wächter–Biegler): require Armijo on f when the model predicts a large f
  decrease against a small h, and let the filter decide otherwise. It was not
  built; the prototype accepts by dominance alone. With it the points
  objective's `qp_failed` cases may disappear. That is the next measurement,
  if the option earns its keep.

## 5. Where it plugs in

`solveSQP`: options `acceptance` ("merit" | "filter", validated),
`filterMargin`, `filterCeiling`, `filterSwitching` (default true),
`filterSTheta`, `filterSF`, `filterDelta`, `filterEta`; the filter is a list
of `{ h, f }` per solve. `AlignmentSQPSolver` forwards `acceptance`,
`filterMargin`, `filterCeiling`, `filterSwitching`; `runCorpus.mjs` takes
`--acceptance`, `--filterSwitching`, `--filterCeiling`. **Default since
2026-09-10 (decided by Uwe Falz): `acceptance: "filter"`, `filterCeiling` 1e2**;
`"merit"` stays available.

## 6. What the flip needed beyond the option

The suite found three things the corpus had not, all on the nine-element
reference scenario and the lexicographic vertex tier:

- **The second-order correction is tried whenever the raw step raises the
  violation**, not only when the step is refused (and, since 2026-09-10,
  whenever it leaves more than a tenth of it: `correctionClosure` 0.1, see
  the lexicographic corpus note). Accepting the raw step at
  once crept to a vertex 0.2 m longer than the corrected steps reach
  (1042.794 against 1042.598); with the correction first the filter converges
  there at 55 iterations where the merit takes 82.
- **The merit's no-descent rule is the merit's.** Under the filter a step
  the merit cannot fall along may still be an h-type step; the rule shrank
  the region 36 times around such a step at the vertex tier and the
  subproblem ran out (`qp_failed`). Skipped under the filter: the tier ends
  `stationary` at 3.
- **A step of length zero goes back to the loop**, not to the search: the
  relaxed-stall verdict counts its way to `infeasible_subproblem` (the
  box-excluded equality of #18), where the search answered
  `line_search_failed` at once.
- The filter is cleared with the restoration's fresh start, as the curvature
  estimate and the weights are.

Tests that measure the merit's own mechanics - the Maratos correction, the
weights paying off a violated ramp row, the no-descent rule's backtracking -
now say `acceptance: "merit"`; everything else runs on the default.
