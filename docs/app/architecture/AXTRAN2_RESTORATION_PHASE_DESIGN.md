# AXTRAN2: a feasibility restoration phase — design

Status: proposal, measured on a prototype, not implemented.
Scope: `src/lib/math/optim/sqp/` (pure numerics) and its use from
`src/domain/optimization/alignment/AlignmentSQPSolver.js`.
Follows: PR #18 (`infeasible_subproblem` verdict), PR #17 (corpus).

## 1. The problem, as measured

The SQP solves a relaxed subproblem at every iterate. The relaxation is
Powell's: one slack `delta` in `[0, 1]` scales every equality row, and
`(d, delta) = (0, 1)` is feasible by construction. When no step inside the
bounds meets the linearised equalities, the subproblem returns exactly that
point. Since #18 the solve then stops with `infeasible_subproblem` instead
of spending its whole budget there.

The corpus (#17) produces this on every three-element turnout whose truth has
an element on a bound: `ABCH_Gl_064`, `AHBI_Gl_077`, `AHBI_Gl_036`,
`AHRO_Abzw_W_104`, `Abzw-li_DKW503`, `Abzw-re_DKW510`, and `AAH_W_806-035`
under the points objective. The linearisation at the perturbed start says the
only way to close the end pose is to shorten the transition; its floor forbids
that; the subproblem is right to relax fully. The problem itself is feasible -
the truth sits exactly on the floor and closes the end pose - but not along
the linearisation at that point.

Two attempts to make the QP "leave the vertex" were built and rejected in #18:
the QP was not wrong. The verdict is a diagnosis. This is the cure.

## 2. The mechanism

A restoration phase minimises the constraint violation alone, under the
bounds, until the point is feasible, and hands the SQP a feasible start.

    minimise   1/2 |D h(x)|^2  +  1/2 |max(0, g(x))|^2
    subject to lo <= x <= up

`D` is the row scaling the solve already uses (#15: the heading row times the
lever arm, so that every row is metres). Each step is a projected
Gauss-Newton step: with `J` the Jacobian of the scaled residual `r`,

    minimise   1/2 |J d + r|^2  +  1/2 mu |d|^2
    subject to max(lo - x, -radius) <= d <= min(up - x, radius)

solved by `solveBoxQP` with `H = J'J + mu I`, `c = J'r`, no equality rows;
then an Armijo backtrack on `|r|` with the trial point projected into the
box. `mu` is Levenberg-Marquardt damping: it starts at `1e-6`, is divided by
three after an accepted step and multiplied by ten after a rejected one, with
the radius halved alongside.

Why this succeeds where the relaxed subproblem cannot: the single `delta`
relaxes all rows by the same factor, so a linearisation that cannot be met
exactly inside the box yields no step at all. A least-squares step reduces
the residual as far as the box allows, re-linearises there, and the next
linearisation allows more. On the turnouts the first step already takes `|h|`
from 9.5 to 0.03 with the transition still on its floor; the second, from
the new point, lifts it off and reaches 8e-7; the third is at 7e-10.

## 3. Measured on the prototype

Prototype: a script over the corpus scenarios, restoring from the point the
solve stopped at, then restarting the ordinary solve from the restored point
(`startAt`). Distances are relative to the file's own geometry (the truth).

| alignment | objective | stopped | restoration | then the SQP |
|---|---|---|---|---|
| ABCH_Gl_064 | length | `infeasible_subproblem` @5, end pose 8.1 m | 3 steps, `|h|` 9.5 → 7e-10, 0.00 % from truth | `stationary` @1 |
| AHBI_Gl_077 | length | `infeasible_subproblem` @5, 9.7 m | 3 steps, 9.7 → 3e-12, 0.00 % | `converged` @0 |
| AHBI_Gl_036 | length | `max_iterations` @200, 13.7 m | → 1e-12, 0.00 % | `stationary` @0 |
| AHBI_Gl_036 | points | `infeasible_subproblem` @71, 20.3 m | → 5e-13, 0.00 % | `stationary` @0 |
| AHRO_Abzw_W_104 | both | `infeasible_subproblem` @4, 0.17 m | → 8e-13, 0.00 % | `converged` @0 |
| AAH_W_806-035 | points | `max_iterations` @200, 1.1e-3 m | → 1e-14, 0.00 % | `converged` @1 |
| Abzw-li_DKW503 | both | `infeasible_subproblem` @4, 0.46 m | → 2e-11, 0.00 % | `converged` @1 |
| Abzw-re_DKW510 | both | `infeasible_subproblem` @4, 0.27 m | → 7e-11, 0.00 % | `converged` @0 |

Every case the corpus had left without a verdict on a small alignment is
restored to the truth in at most three steps. The restart then has nothing
left to do: the truth is the length-minimal feasible point for these turnouts
and the points fit is at its noise floor.

The prototype ran outside the solver, against the scaled evaluator it exposes
internally; the numbers above are the argument for building it inside.

## 4. Where it plugs in

`solveSQP` gains one option and one internal phase.

    restoration: "off" | "on-verdict"        default "on-verdict"
    restorationLimit: 2                       restorations per solve

Trigger: the `infeasible_subproblem` verdict of #18. Not `max_iterations`:
that has other causes (slow linear convergence, chatter along a ramp row) and
restoring from a merely slow point would throw away progress on the objective.
The two `max_iterations` rows in the table happened to restore well; they are
not the trigger, they are a bonus to be measured, not assumed.

On trigger: run the phase from the current iterate. On success (`|r|` at or
below `feasibilityTolerance`): reset the quasi-Newton matrix to the scaled
identity, reset the penalty weights to their initial values, set the radius to
its initial value, record a `restored` history entry carrying the steps taken
and the violation before and after, and continue the SQP loop from the
restored point. On failure (no descent at `mu > 1e3`, or the step limit): stop
with `restoration_failed`, carrying the best violation reached. A second
verdict after a restoration is allowed once (`restorationLimit`); a third ends
the solve as `infeasible_subproblem` as today.

The phase lives in `src/lib/math/optim/sqp/restoreFeasibility.js`, pure
numerics, taking `{ evaluate, x, lower, upper, feasibilityTolerance, ... }`
and returning `{ ok, x, state, steps, violationBefore, violationAfter,
history }`. It reuses `solveBoxQP` and the merit module's
`constraintViolation`. `AlignmentSQPSolver` needs no change beyond forwarding
the option, because the row scaling of #15 happens in its evaluator and the
phase sees scaled rows.

Inequalities: the residual vector carries `max(0, g_j)` with the row's
Jacobian where violated and nothing where not, so the phase restores a
violated ramp row too. None of the measured cases had one; the corpus files
that chatter along an active row (the 8-point synthetic case, #16) do not
trigger the verdict and are not this phase's business.

The lexicographic driver (`AlignmentLexicographicSolver`) counts restoration
steps into the tier's iteration budget - a tier that spends its budget
restoring says so in its report - but the budget of a later tier is unaffected.

## 5. What it is not

- Not a fix to the QP. The subproblem's answer at the vertex is correct, and
  the two attempts to change it broke Gerdts 3.2.3 (#18).
- Not a replacement for the relaxation. Powell's `delta` keeps every ordinary
  iteration well defined; restoration is for the point where it cannot move.
- Not per-row elastic relaxation (SNOPT's elastic mode). That would let the
  subproblem itself reduce the violation partially and could make the phase
  unnecessary, but it changes the merit's directional derivative and every
  step of every solve; measured cost and benefit are unknown. It is the
  alternative to compare against, after this phase is in and measured.

## 6. Risks, stated

- Restoration lands on the nearest feasible point, not the objective's
  preferred one. On the turnouts the two coincide; on a wide alignment they
  may not, and the SQP continues from wherever restoration stopped. The
  `restored` history entry makes that visible.
- A verdict, a restoration, and a verdict again is a loop; `restorationLimit`
  ends it and the second verdict is reported as such.
- Each restoration step is one QP with `H = J'J`; on the 82-variable
  alignment where the ordinary solve already fails early (`3250_4-11_S`,
  #17) the phase will be as slow as the solve, and whether it helps there is
  a measurement, not a promise.
- The trigger inherits the verdict's thresholds (`delta > 1 - 1e-3`, five
  iterations, under one percent progress); those were measured on this
  corpus, not derived.

## 7. Tests and measurement

- The reproducer of #18 (`qp-relaxed-vertex.test.mjs`): the synthetic
  `h = x - 5` under `x <= 1` must end `restoration_failed`, because the box
  genuinely excludes feasibility - restoration must not fake a success.
- The corpus turnouts above as a regression: each ends `ok: true` within a
  handful of iterations after restoration.
- The full corpus run (`runCorpus.mjs`) before and after: the count of
  verdicts and `max_iterations` rows, and that no row that reached a verdict
  before reaches a different point after.
- Gerdts 3.2.3 and the nine-element scenario unchanged: the phase never
  triggers there.
