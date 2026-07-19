# KC-EVAL-003 Knowledge Ownership

## Status

`candidate`

## Canonical Question

Which concept or accountable authority is responsible for establishing, maintaining, interpreting, and revising particular Engineering Knowledge?

## Candidate Canonical Answer

Knowledge Ownership is the explicit responsibility boundary assigning Engineering Knowledge to the canonical concept and accountable authority entitled to establish, maintain, interpret, and revise its meaning within a stated scope.

## Normative Meaning

- Ownership identifies responsibility for meaning, admission, maintenance, revision, and applicability.
- Repetition, storage, representation, implementation, or use does not transfer ownership.
- Ownership must remain traceable when knowledge is derived, copied, or represented elsewhere.
- Authority to decide a particular change must be explicit and need not belong to the tool that evaluates it.

## Boundaries

- Knowledge Ownership is not Engineering Object Identity, property ownership, file ownership, database ownership, authorship, or mere custody.
- It does not imply that an owner may exceed Governance authority or erase provenance.
- A solver, renderer, Thesis, or source system does not acquire ownership through computation or presentation.

## Relations to Other Kernel Concepts

- Applies to [`KC-EVAL-001 Engineering Knowledge`](KC-EVAL-001_Engineering_Knowledge.md).
- Specializes the authority separation in [`GOVERNANCE-001`](../GOVERNANCE/GOVERNANCE-001_Kernel_Domain_Ownership.md).
- Remains distinct from Identity and from approval authority recorded in the Governance Decision Log.

## Consequences for Reference Implementation

- Knowledge records should identify owning concept, authority, scope, revision, and provenance rather than infer ownership from storage location.

## Consequences for Thesis

- The Thesis should attribute definitions and rules to their owning Kernel concepts and distinguish explanation from ownership.

## Evidence and Origin

- Direct Governance provenance: [`GOVERNANCE-001`](../GOVERNANCE/GOVERNANCE-001_Kernel_Domain_Ownership.md), [`GOVERNANCE-002`](../GOVERNANCE/GOVERNANCE-002_Kernel_Approval_Process.md), and [`KD-2026-002`](../GOVERNANCE/DECISION_LOG.md#kd-2026-002).
- Research support: [`KC-EDITOR-006`](../research/THESIS/KC-EDITOR-006_Research_vs_Canonical_Knowledge.md).
- Thesis explanation: [`kernel/engineering_knowledge.tex`](../../thesis/AIM/kernel/engineering_knowledge.tex).

Evidence classification: direct provenance from Governance authority and ownership boundaries.

## Open Decisions

- Domain-specific knowledge-owner assignment remains the responsibility of each governed concept or decision.
