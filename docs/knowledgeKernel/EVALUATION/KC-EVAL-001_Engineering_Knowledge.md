# KC-EVAL-001 Engineering Knowledge

## Status

`candidate`

## Canonical Question

What distinguishes engineering knowledge from data, observations, representations, proposals, and unsupported claims?

## Candidate Canonical Answer

Engineering Knowledge is engineering information admitted for use in interpretation, evaluation, constraint, comparison, or decision-making within an explicit scope, provenance, applicability, and authority.

## Normative Meaning

- Knowledge is information whose engineering use has been admitted by an accountable authority or governed process.
- Evidence, provenance, applicability, uncertainty, and authority remain traceable after admission.
- Knowledge may be supported by observation, theory, standards, derivation, or decisions without becoming identical to any source.
- Storage, repetition, computation, or rendering alone does not establish knowledge.

## Boundaries

- Engineering Knowledge is not the engineering object, physical state, observation, statement, representation, proposal, decision, or stored data.
- Admission establishes permitted reliance, not universal truth or unlimited applicability.
- Conflicting evidence may remain recorded without automatically becoming accepted knowledge.

## Relations to Other Kernel Concepts

- [`KC-EVAL-002 Engineering Observation`](KC-EVAL-002_Engineering_Observation.md) supplies evidence without automatically establishing knowledge.
- [`KC-EVAL-003 Knowledge Ownership`](KC-EVAL-003_Knowledge_Ownership.md) assigns responsibility for meaning and revision.
- Governance controls canonical Kernel admission; Spot admission is related evidence but not identical to all knowledge admission.

## Consequences for Reference Implementation

- Systems should distinguish source evidence, candidate information, admitted knowledge, and decision records.
- Database presence or a `canonical` flag alone must not be treated as sufficient authority.

## Consequences for Thesis

- The Thesis should distinguish knowledge from evidence and state scope, applicability, and authority when describing accepted information.

## Evidence and Origin

- Partial Research correspondence: [`KC-IMPORT-002 Candidate Engineering Knowledge`](../research/IMPORT/KC-IMPORT-002_Candidate_Engineering_Knowledge.md), [`KC-SPOT-007 Import Boundary`](../research/SPOT/KC-SPOT-007.md), and [`KC-EDITOR-006 Research vs Canonical Knowledge`](../research/THESIS/KC-EDITOR-006_Research_vs_Canonical_Knowledge.md).
- Governance support: [`GOVERNANCE-001`](../GOVERNANCE/GOVERNANCE-001_Kernel_Domain_Ownership.md) and [`GOVERNANCE-002`](../GOVERNANCE/GOVERNANCE-002_Kernel_Approval_Process.md).
- Thesis explanation: [`kernel/engineering_knowledge.tex`](../../thesis/AIM/kernel/engineering_knowledge.tex).

Evidence classification: multi-source support. Research approval assertions are provenance claims, not approval of this entry.

## Open Decisions

- Admission authority and criteria outside canonical Kernel governance require domain-specific elaboration.
