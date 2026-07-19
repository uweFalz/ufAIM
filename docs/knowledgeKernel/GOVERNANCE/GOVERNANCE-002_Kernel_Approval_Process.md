# GOVERNANCE-002 Kernel Approval Process

## Status

`candidate`

This entry is a governance candidate. It has not been approved.

## Canonical Question

How does a researched claim become, change, or cease to be approved Kernel knowledge?

## Canonical Answer

Kernel knowledge changes status only through a traceable evidence package, contradiction and impact review, and an explicit Decision Record by Uwe Falz or a holder of his limited explicit delegation. Under [`KD-2026-001`](DECISION_LOG.md#kd-2026-001), Codex missions may prepare candidates within explicit scope but may not approve or revoke them.

## Normative Meaning

### Status model

The allowed status values for active Kernel concept files are:

- `candidate`: substantively formulated and supported by sufficient evidence for governance consideration.
- `review-ready`: complete evidence, contradiction, dependency, and impact checks have been recorded.
- `approved`: admitted by an explicit decision of the authorized human governance authority.
- `evidence-missing`: the intended canonical question is known, but available evidence cannot support a candidate answer.
- `open-decision-required`: evidence supports multiple governance-relevant options and a decision is required before formulation or transition.
- `conflict-unresolved`: authoritative or materially relevant evidence contradicts itself.
- `deprecated`: retained for historical interpretation but superseded for new canonical use by a recorded decision.
- `revoked`: removed from canonical validity by a recorded decision.
- `rejected`: considered and explicitly declined by a recorded decision.

`research` is a repository area and lifecycle phase, not an active Kernel concept status. Descriptive documents such as inventories and README files report the statuses of governed entries but do not acquire concept status merely by being in the active tree.

### Admission and transition

To enter `candidate`, an entry must provide the mandatory concept sections, concrete evidence, boundaries, dependencies, and honest open decisions. A single implementation choice or Thesis statement is insufficient.

To enter `review-ready`, the package must additionally record:

- completed evidence and origin checks,
- contradiction and duplicate-definition checks,
- affected Kernel entries and identifier issues,
- Reference Implementation and Thesis impacts,
- valid internal references.

Under [`KD-2026-002`](DECISION_LOG.md#kd-2026-002), only Uwe Falz or a holder of a limited mandate explicitly delegated by Decision Record may transition an entry to `approved`, `deprecated`, `revoked`, or `rejected`. Each transition requires a Decision Record. Grey is not an approver by default. Unresolved states cannot transition to `approved` until their blocking condition is closed.

### Decision record format

[`KD-2026-005`](DECISION_LOG.md#kd-2026-005) establishes [`DECISION_LOG.md`](DECISION_LOG.md) as the append-only canonical log and the immutable sequential identifier form `KD-YYYY-NNN`. Every record must use this shape:

```text
Decision ID: <KD-YYYY-NNN>
Date: <YYYY-MM-DD>
Authority: <authorized human name or explicitly delegated holder>
Question: <decision question>
Decision: <selected outcome and any status transition>
Rationale: <evidence, contradictions, and reasons>
Affected Files: <links to governed records and exact revision when needed>
Status: <decision-record status>
Supersedes: <earlier decision or status assertion, or None>
Follow-up: <dependent impacts and required actions, or None>
```

Issued identifiers must never be reused or renumbered. Corrections and supersession require later records. Absence of a record means absence of demonstrated approval.

### Contradiction and withdrawal handling

When evidence conflicts, the affected entry becomes or remains `conflict-unresolved`; independent entries may continue. Deprecation and revocation require reasons, impact analysis, migration guidance, and an explicit decision. Historical content must remain traceable.

## Boundaries

- Evidence priority orders review; it does not itself perform approval.
- `evidence-missing`, `open-decision-required`, and `conflict-unresolved` are honest blocking statuses, not weaker forms of approval.
- A heading or sentence saying “approved” under `research/` or `_draft/` is not a substitute for a governance decision record.
- This process does not decide the technical content of any concept.

## Relations to Other Kernel Concepts

- Constitutional basis: [`../KERNEL_CONSTITUTION.md`](../KERNEL_CONSTITUTION.md)
- Authority assignment: [`GOVERNANCE-001_Kernel_Domain_Ownership.md`](GOVERNANCE-001_Kernel_Domain_Ownership.md)
- Operational decision briefs and inventory: [`INVENTORY_2026-07-18.md`](INVENTORY_2026-07-18.md)
- Canonical decisions: [`DECISION_LOG.md`](DECISION_LOG.md)

## Consequences for Reference Implementation

- Implementation correspondence and reproducible behavior belong in the evidence package.
- Approval, change, deprecation, or revocation must identify implementation impact without treating implementation as the approving authority.

## Consequences for Thesis

- Thesis correspondence belongs in the evidence package at lower authority than approved Kernel content and consistent multi-source research.
- Status changes must produce a traceable Thesis impact note; they do not silently rewrite the Thesis.

## Evidence and Origin

- [`../KERNEL_CONSTITUTION.md`](../KERNEL_CONSTITUTION.md), lifecycle, authority order, and separation of domains.
- [`GOVERNANCE-001_Kernel_Domain_Ownership.md`](GOVERNANCE-001_Kernel_Domain_Ownership.md), ownership and decision authority candidate.
- [`../research/THESIS/KC-EDITOR-006_Research_vs_Canonical_Knowledge.md`](../research/THESIS/KC-EDITOR-006_Research_vs_Canonical_Knowledge.md), canonical admission boundary.
- The P0 and K1 mission authorizations and required document formats, used as operational origins for candidate preparation only.

## Open Decisions

- None. Under [`KD-2026-005`](DECISION_LOG.md#kd-2026-005), historical status files remain in place for now and receive explicit provenance or status clarification where necessary.
