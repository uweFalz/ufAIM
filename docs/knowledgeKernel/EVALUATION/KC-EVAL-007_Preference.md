# KC-EVAL-007 Preference

## Status

`candidate`

Unresolved marker: `evidence-missing`

## Canonical Question

What non-mandatory engineering criterion supports comparison without becoming a constraint or decision?

## Candidate Canonical Answer

No candidate canonical answer is asserted. Evidence does not establish whose preference, applicable scope, comparison semantics, or authority the concept carries.

## Normative Meaning

- Established boundary: preference must remain non-mandatory and cannot silently exclude otherwise admissible alternatives.
- Any later formulation must separate engineering meaning from weights, objectives, rankings, and solver encodings.

## Boundaries

- Preference is not constraint, acceptance, decision, universal utility, or numerical weight.

## Relations to Other Kernel Concepts

- May compare Candidate Solutions after constraints are evaluated; it does not decide among them.

## Consequences for Reference Implementation

- Objective weights and UI choices must not be treated as canonical preferences without ownership and applicability.

## Consequences for Thesis

- Preference examples should state owner, scope, comparison relation, and non-mandatory status.

## Evidence and Origin

- Thesis-only correspondence: [`kernel/engineering_decisions.tex`](../../thesis/AIM/kernel/engineering_decisions.tex) and the Thesis glossary.
- No substantive Research definition was found.

Evidence classification: evidence-missing.

## Open Decisions

- Required Research follow-up: [`EVAL-R-007`](EVIDENCE_REGISTER.md#eval-r-007--preference).
