# Knowledge Kernel Constitution

## Status

`candidate`

This Constitution has not been approved and does not authorize itself. [`KD-2026-001`](GOVERNANCE/DECISION_LOG.md#kd-2026-001) permits Codex missions to prepare, edit, and validate `candidate` content within explicit mission scope without granting approval or revocation authority.

## Purpose

The ufAIM Knowledge Kernel is the canonical representation of stable engineering knowledge. Research discovers, Governance decides, the Knowledge Kernel preserves, the Reference Implementation demonstrates, and the Thesis explains.

The Knowledge Kernel is neither an implementation nor a thesis. It is the architectural authority that both may realize or explain without redefining.

## Scope and Applicability

This Constitution governs active Kernel content in `docs/knowledgeKernel/`. The `research/` and `_draft/` subtrees supply evidence and history but are not active canonical homes.

It defines authority boundaries, evidence priority, governance separation, and the lifecycle from research to approved knowledge. It does not approve itself or any technical concept.

## Principles

- Research is free to explore alternatives and unresolved hypotheses.
- Governance admits, changes, deprecates, rejects, or revokes canonical knowledge through an authorized human decision. Uwe Falz is the primary Approval and Revocation Authority and may explicitly delegate a limited mandate under [`KD-2026-002`](GOVERNANCE/DECISION_LOG.md#kd-2026-002).
- Every concept has one identifiable canonical home.
- Candidate content is visibly distinct from approved knowledge.
- Missing evidence, contradictions, and decisions remain explicit.
- Services and Reference Implementations operationalize or demonstrate Kernel meaning; they do not define it.
- The Thesis explains approved knowledge and may discuss research without promoting it.

## Authority and Evidence Order

Review evidence in this order:

1. explicitly approved Kernel decisions,
2. this Constitution and approved canonical freezes,
3. consistent statements from multiple research sources,
4. reproducible Reference Implementation behavior,
5. Thesis explanation.

Lower-priority evidence cannot override higher-priority authority. This Constitution remains `candidate`. Canonical freezes FC-001 and FC-002 are separately approved through [`KD-2026-003`](GOVERNANCE/DECISION_LOG.md#kd-2026-003) and [`KD-2026-004`](GOVERNANCE/DECISION_LOG.md#kd-2026-004); historical labels alone establish no authority.

## Governance Lifecycle

Research produces evidence and proposals. Governance review turns sufficiently supported proposals into candidates and review-ready packages. Only an explicit authorized decision makes a concept `approved`. Approved concepts guide services, Reference Implementations, and Thesis explanation. The complete status and transition model is defined by [`GOVERNANCE-002`](GOVERNANCE/GOVERNANCE-002_Kernel_Approval_Process.md).

## Relations to Governance Entries

- [`GOVERNANCE-001`](GOVERNANCE/GOVERNANCE-001_Kernel_Domain_Ownership.md) assigns domain and decision ownership.
- [`GOVERNANCE-002`](GOVERNANCE/GOVERNANCE-002_Kernel_Approval_Process.md) defines status transitions and decision records.
- [`DECISION_LOG`](GOVERNANCE/DECISION_LOG.md) records effective human Governance decisions under the convention established by [`KD-2026-005`](GOVERNANCE/DECISION_LOG.md#kd-2026-005).
- [`FREEZES`](FREEZES/README.md) contains approved canonical freezes.

If these candidates conflict, the affected statement remains `conflict-unresolved` until an authorized human decision. Neither lower-level entry silently overrides the Constitution.

## Open Decisions

- Formal approval, rejection, or revision of this Constitution requires a separate Decision Record. `KD-2026-001` establishes an operational candidate-preparation mandate but does not approve the Constitution.
