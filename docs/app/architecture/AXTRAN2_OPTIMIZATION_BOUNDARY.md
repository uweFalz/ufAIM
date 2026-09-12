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

Measured, not experimental (state of 2026-09-12; the block above it stood
from before #22 and was stale).

Known current state:

- SQP with Powell's relaxation, a Fletcher-Leyffer filter with the
  Wächter-Biegler switching condition, a box trust region, second-order
  correction, BFGS or Gauss-Newton with a structured secant, restoration
  on verdict (docs/app/architecture/AXTRAN2_*.md)
- every end of a solve is a named verdict: converged, stationary,
  infeasible_subproblem, restoration_failed, line_search_failed,
  qp_failed, infeasible_stationary, max_iterations
- the subproblem's active set answers the true optimum
  (test/axtran2/qp-multipliers.test.mjs) and starts warm
- measured on 248 as-built alignments (AXTRAN2_CORPUS_BASELINE_2026-09-10.md):
  points 190, length 235, strict lexicographic order 123 of 235 without
  the thirteen giants; the giants have no points verdict
- interactive use is bounded at 96 free variables
  (AlignmentAxtranEvidenceService)
- the heritage intent, line by line: test/axtran2/heritage-lage.test.mjs

Current solver status:

```txt
measured
proposal-only
non-mutating
