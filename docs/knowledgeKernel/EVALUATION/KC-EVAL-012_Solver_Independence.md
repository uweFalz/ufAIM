# KC-EVAL-012 Solver Independence

## Status

`candidate`

Unresolved marker: `evidence-missing`

## Canonical Question

Which engineering meaning and authority must remain independent of solver representations and implementations?

## Candidate Canonical Answer

No candidate canonical answer is asserted. Available evidence supports a separation concern but not its exact scope, conformance criteria, or limits.

## Normative Meaning

- Established boundary: engineering problem, mathematical formulation, solver representation, solver implementation, candidate result, and engineering acceptance are distinct responsibilities.
- No universal solver interchangeability is claimed.

## Boundaries

- Solver independence does not mean every formulation works with every solver or yields equivalent numerical behavior.
- Solver success does not establish engineering acceptance, truth, or decision authority.

## Relations to Other Kernel Concepts

- Potentially protects Engineering Knowledge, Constraints, Preferences, Candidate Solutions, and Decisions from solver ownership.

## Consequences for Reference Implementation

- Solver adapters should preserve traceability to an engineering problem and expose formulation-specific assumptions.

## Consequences for Thesis

- Claims should distinguish meaning independence, formulation portability, implementation substitution, and numerical equivalence.

## Evidence and Origin

- Thesis-only correspondence: [`kernel/engineering_decisions.tex`](../../thesis/AIM/kernel/engineering_decisions.tex) and [`foundations/operators.tex`](../../thesis/AIM/foundations/operators.tex).
- Implementation demonstrates solver-specific representations but supplies no canonical independence contract.

Evidence classification: evidence-missing.

## Open Decisions

- Required Research follow-up: [`EVAL-R-012`](EVIDENCE_REGISTER.md#eval-r-012--solver-independence).
