# AXTRAN2 Optimization Boundary

## STATUS

Frozen boundary.

AXTRAN2 is currently experimental.

No feature expansion until this boundary is respected.

---

## ROLE

AXTRAN2 is an optimization service layer.

It may consume canonical engineering data and produce optimization results for review.

It is not:

- AlignmentData
- sparseAlignment
- SPOT
- Workspace
- RouteProject
- GeoView
- Representation Builder

AXTRAN2 must never become canonical truth.

---

## INPUTS

AXTRAN2 may consume:

- AlignmentData
- sparseAlignment
- constraints
- point data
- workspace context
- metric realization context

These inputs are read-only from AXTRAN2's perspective.

---

## OUTPUTS

AXTRAN2 may produce:

- proposal
- optimized candidate
- diagnostics
- delta operations

AXTRAN2 must not directly produce:

- SpotObject
- Workspace focus
- canonical AlignmentData replacement
- persisted Project state

---

## NON-GOALS

AXTRAN2 does not own:

- canonical alignment semantics
- SPOT mutation
- Workspace focus
- RouteProject structure
- relation semantics
- representation creation
- rendering
- persistence
- import promotion

AXTRAN2 is not a replacement for the alignment kernel.

---

## CANONICAL DATA RULES

AXTRAN2 must not:

- replace AlignmentData
- mutate SPOT directly
- mutate Workspace directly
- become the canonical alignment kernel
- define workspace focus
- define relation semantics
- create representations directly

AXTRAN2 may only return reviewable results.

Canonical application must happen elsewhere.

---

## PROPOSAL / CANDIDATE / DELTA MODEL

### proposal

An optimization result not yet accepted.

A proposal may contain one or more candidates, diagnostics, and suggested deltas.

### candidate

A concrete possible replacement or variation.

A candidate is not canonical until accepted by external application logic.

### delta

An explicit operation set that may be reviewed and applied elsewhere.

Only external application logic may apply a delta.

### diagnostics

Numeric, geometric, and constraint report.

Diagnostics may include:

- residuals
- constraint violations
- iteration history
- convergence status
- conditioning warnings
- active constraints
- rejected steps
- feasibility notes

---

## SOLVER STATUS

Measured, not experimental (state of 2026-10-11; the block of 2026-09-12
is kept in git history).

Known current state:

- SQP with Powell's relaxation, a Fletcher-Leyffer filter with the
  Wächter-Biegler switching condition, a box trust region, second-order
  correction on the equalities (closure 0.1), BFGS or Gauss-Newton with a
  structured secant and the `auto` ladder, restoration on verdict
  (docs/app/architecture/AXTRAN2_*.md)
- every end of a solve is a named verdict: converged, stationary with the
  reason within_tolerance (every point within its tolerance, the rest
  undetermined by the points), objective_settled, infeasible_subproblem,
  restoration_failed, line_search_failed, qp_failed,
  infeasible_stationary (creep), max_iterations
- the subproblem's active set answers the true optimum
  (test/axtran2/qp-multipliers.test.mjs) and starts warm
- constraints declared, not coded: end pose, hardened Zwangspunkte, held
  elements, held poses at element joints (the turnout's tangent), kink
  stations, design profile with inherited exceptions; objectives: points,
  accumulated length under a points corridor, in lexicographic order with
  a tier-0 gate that judges end pose, Zwangspunkte and held poses alike
- turnouts as held elements from their designation (EW, IBW/ABW, EKW/DKW;
  TurnoutCatalogue.js, status candidate: Ril 800.0120 not read)
- measured on 248 as-built alignments (AXTRAN2_CORPUS_BASELINE_2026-09-10.md):
  points 235 of 235 and length 235 of 235 without the thirteen giants,
  strict lexicographic order 225 of 235 (ten station tracks open); giants
  points 13 of 13, strict 12 of 13
- the AXTRAN mark, 22 km with 5 011 survey points and 228 free
  quantities: within_tolerance in 775 s after the search in
  Alignment2D.poseAt (#67)
- the adapter tools/axtran2/fitTra.mjs: TRA, survey list and Zwangspunkte
  in, fitted TRA with station equations, report and residual list out -
  the one path with real points; the corpus fits synthetic ones
- interactive use is bounded at 96 free variables
  (AlignmentAxtranEvidenceService); held poses reach the service
- the heritage intent, line by line: test/axtran2/heritage-lage.test.mjs

Current solver status:

```txt
measured
proposal-only
non-mutating
