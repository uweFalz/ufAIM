# KC-EVAL-005 Residual

## Status

`candidate`

Unresolved marker: `evidence-missing`

## Canonical Question

Which deviations should Residual denote across observation, evaluation, constraints, and solver formulations?

## Candidate Canonical Answer

No candidate canonical answer is asserted. Evidence does not yet determine whether Residual is one mathematical quantity or a family of typed evaluative relations.

## Normative Meaning

- Established boundary: a residual quantification is not automatically a constraint, violation, uncertainty, preference, or solver encoding.
- Domain, reference value, units, sign, normalization, and applicability must be explicit in any later formulation.

## Boundaries

- Zero residual need not prove truth or acceptance; nonzero residual need not prove constraint violation.
- Observation residuals and optimization residual vectors may have different responsibilities.

## Relations to Other Kernel Concepts

- Must remain distinct from Engineering Constraint, Preference, Observation uncertainty, and solver representation.

## Consequences for Reference Implementation

- Existing residual vectors and builder functions are implementation-only evidence and must not define the Kernel concept.

## Consequences for Thesis

- Mathematical examples should state which residual family and reference relation they instantiate.

## Evidence and Origin

- Implementation-only and Thesis-only correspondence: optimization code and [`engineering/constraints_and_rules.tex`](../../thesis/AIM/engineering/constraints_and_rules.tex).
- No substantive Research definition was found.

Evidence classification: evidence-missing.

## Open Decisions

- Required Research follow-up: [`EVAL-R-005`](EVIDENCE_REGISTER.md#eval-r-005--residual).
