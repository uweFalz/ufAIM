# GOVERNANCE-001 Kernel Domain Ownership

## Status

`candidate`

This entry is a governance candidate. It has not been approved.

## Canonical Question

Which repository domain owns canonical architectural meaning, and who may approve or revoke it?

## Canonical Answer

The Knowledge Kernel owns canonical architectural meaning. Research discovers, Governance decides, the Knowledge Kernel preserves, the Reference Implementation demonstrates, and the Thesis explains. Only an explicitly recorded decision by Uwe Falz or a holder of his limited explicit delegation may approve or revoke Kernel content.

## Normative Meaning

- Each canonical concept has exactly one home in the active Kernel outside `research/` and `_draft/`.
- Research owns hypotheses, alternatives, evidence, and unresolved claims; it does not own canonical meaning.
- Governance owns admission, status transition, correction, deprecation, and revocation decisions. Under [`KD-2026-002`](DECISION_LOG.md#kd-2026-002), Uwe Falz is the primary Approval and Revocation Authority and may explicitly delegate a limited mandate to a named person or role.
- The Reference Implementation owns executable behavior and technical realization choices, subject to conformance with approved Kernel meaning.
- The Thesis owns scientific explanation and presentation, not architectural definition.
- Repetition outside the canonical home is a reference or explanation and cannot redefine the concept.

## Boundaries

- This entry assigns authority; it does not define Identity, SpotObject, Realization, Evaluation, Communication, or Representation semantics.
- Repository location alone does not prove approval. In particular, an approval claim in `research/` or `_draft/` is evidence about provenance, not active canonical status.
- Reproducible implementation behavior is evidence, not approval.
- Grey is a reviewer or arbitrator by default and has no approval authority unless a Decision Record explicitly delegates it under `KD-2026-002`.

## Relations to Other Kernel Concepts

- Constitutional basis: [`../KERNEL_CONSTITUTION.md`](../KERNEL_CONSTITUTION.md)
- Process counterpart: [`GOVERNANCE-002_Kernel_Approval_Process.md`](GOVERNANCE-002_Kernel_Approval_Process.md)
- Effective authority decisions: [`KD-2026-001`](DECISION_LOG.md#kd-2026-001) and [`KD-2026-002`](DECISION_LOG.md#kd-2026-002)
- Applies to every active Kernel concept and navigation document.

## Consequences for Reference Implementation

- The Reference Implementation must not be cited as the sole source of a new canonical statement.
- A conflict with approved Kernel meaning is a conformance issue to be recorded and governed, not an implicit Kernel revision.

## Consequences for Thesis

- The Thesis may explain and formalize Kernel concepts but must identify research candidates and unresolved questions as such.
- A Thesis formulation cannot acquire canonical authority without an explicit Kernel decision.

## Evidence and Origin

- [`../KERNEL_CONSTITUTION.md`](../KERNEL_CONSTITUTION.md), especially **Purpose**, **Principles**, and **Authority Order**.
- [`../research/THESIS/KC-EDITOR-006_Research_vs_Canonical_Knowledge.md`](../research/THESIS/KC-EDITOR-006_Research_vs_Canonical_Knowledge.md), separation of research and canonical narrative.
- [`../../thesis/AIM/foundations/principles.tex`](../../thesis/AIM/foundations/principles.tex) and [`../../thesis/AIM/foundations/ontology.tex`](../../thesis/AIM/foundations/ontology.tex), explanatory correspondence only.
- Repository instruction `AGENTS.md`, which names `docs/knowledgeKernel/` as the sole architectural authority.

## Open Decisions

- None within this entry. Any future delegation requires its own Decision Record specifying holder, scope, permitted transitions, and duration or revocation condition.
