# KC-EVAL-006 Engineering Constraint

## Status

`candidate`

Unresolved marker: `evidence-missing`

## Canonical Question

What makes a condition a mandatory Engineering Constraint rather than a measurement, residual, preference, or solver encoding?

## Candidate Canonical Answer

No candidate canonical answer is asserted. Available evidence does not establish the authority, applicability, identity, and lifecycle of mandatory engineering conditions independently of solver forms.

## Normative Meaning

- Established boundary: constraint responsibility must precede and remain traceable through mathematical and solver encodings.
- Mandatory conditions and non-mandatory preferences require separate treatment.

## Boundaries

- A constraint is not its residual function, penalty weight, builder class, observed violation, or uncertainty.
- A violated constraint and an uncertain observation are not equivalent.

## Relations to Other Kernel Concepts

- Depends on Engineering Knowledge and Knowledge Ownership; remains distinct from Residual and Preference.

## Consequences for Reference Implementation

- Constraint builders are implementation correspondence only; they should retain source authority and applicability metadata.

## Consequences for Thesis

- The Thesis should separate the engineering rule from its residual and solver representation.

## Evidence and Origin

- Thesis-only and implementation-only evidence: [`engineering/constraints_and_rules.tex`](../../thesis/AIM/engineering/constraints_and_rules.tex) and optimization builders.
- No substantive Research definition was found.

Evidence classification: evidence-missing.

## Open Decisions

- Required Research follow-up: [`EVAL-R-006`](EVIDENCE_REGISTER.md#eval-r-006--engineering-constraint).
