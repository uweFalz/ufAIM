# AXTRAN2: the subproblem's active set, corrected and warm-started (2026-09-11)

Where the time goes. CPU profile of a 64-element points fit
(`metroB/AIT_5904R_b`, 200 iterations, 4.8 s):

| share | where |
|---|---|
| 49 % | `solveBoxQP` (active-set loop, decomposition, SPD solves) |
| 17 % | `AlignmentPoseJacobian` (assembly of the derivatives) |
| 6 % | `Alignment2D.poseAt` (production geometry for feet and end pose) |
| 10 % | numerical integration over transitions (Romberg, `kappaInt`, the registry's expression evaluator) |
| 1 % | `TransitionMoments` |

The moment series already is the polynomial that a "cheap approximation
for transitions" would be, exact to machine precision in the track range,
so there is nothing left there. The active set is half the time, and its
cost is not spread evenly: 31 of 200 subproblems ended
`stationary_on_working_set` after a median of 99 iterations, the other 169
`solved` after a median of 4.

## Three changes to `solveBoxQP`

**The bound multipliers were wrong.** The test for whether a pinned
variable wants off its bound read the gradient projected out of the row
space of A over all coordinates. That is the null-space part of the
multiplier vector, not the multiplier: with g = -A'mu - nu it returns
-(I - P) nu, and where a pinned variable's column has a part in the row
space the sign can be wrong. Measured against a brute-force enumeration of
every working set on 5000 random problems with five variables and two
equality rows: 8 % of the answers reported `solved` sat above the optimum,
by up to a tenth of the objective. The multipliers of the equalities are
now fitted on the free block's own stationarity, g_F + A_F'mu = 0, and a
pinned variable's multiplier is what its gradient component leaves,
nu_P = -(g_P + A_P'mu). On the same 5000 problems none is suboptimal
(`qp-multipliers.test.mjs`). At a degenerate vertex A_F does not determine
mu; the pinned columns are given a millionth of the weight in the fit,
which decides only there.

**A degenerate vertex ends as stationary on its working set.** With the
multipliers read correctly the active set at the lexicographic vertex tier
swapped members without moving for the whole budget - 101 releases and 98
blocks in 200 iterations at one z, Bland's rule running. More zero-length
steps in a row than there are variables, with Bland already on, is the
vertex, and it is reported as `stationary_on_working_set`; the solver
reads that as a point with no admissible direction, as before.

**Warm start.** Each subproblem is handed the working set the previous
one ended with ({ atLower, atUpper, activeRows }). The solve still starts
at (d, delta) = (0, 1), which it can prove feasible, and makes one move
towards the optimum of that working set: the target satisfies the
equalities and so does the start, so every point between them does, and
the ratio test on the bounds says how far the move goes. A set that no
longer fits costs one free-block solve. On random problems the walk is
under 60 % of the cold one; a wrong set still lands on the optimum.

## Measured (corpus, 235 files without the thirteen giants)

| | points ok | length ok | strict ok | single time | strict time | QP iterations single / strict |
|---|---|---|---|---|---|---|
| before | 190 | 223 | 129 | 500 s | 959 s | - |
| multipliers exact | 190 | 233 | 124 | 392 s | 758 s | 556k / 1.33M |
| + degenerate cap | 190 | 233 | 123 | 393 s | 753 s | 536k / 1.31M |
| **+ warm start** (default) | **190** | **235** | **123** | **362 s** | **621 s** | **248k / 583k** |

The length objective gains twelve (ten `inadmissible_points` became
`stationary`: the subproblem no longer stops short of its optimum), the
points objective is unchanged in count with a handful of rows swapping
verdicts, and the strict order loses six. The held phase of the strict
order lives at degenerate vertices, where the corrected multipliers take
a different path through the same sliver (79 of 235 rows identical, nine
converged runs now run out, four that ran out now converge). That is the
open item: the degenerate vertex has no unique multiplier, and the choice
made there (the millionth) is a choice.

Three tests were calibrated on the old subproblem and were rewritten:
the ladder no longer freezes under a feasibility tolerance of zero (every
stage reaches the end pose exactly), the ramp test reads the rows at the
converged point, which the terminal history entry now carries, and the
corpus creep test accepts a phase that closes as well as one that names
its creep - `AHBI_Gl_033` closes under both correction rules now.
