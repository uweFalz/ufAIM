# Evaluation

## Domain Purpose

Evaluation separates evidence, admitted knowledge, mandatory conditions, non-mandatory comparison, material consequence, use-relative engineering sufficiency, candidate alternatives, accountable proposals, changes, and decisions from their software and solver encodings. KERNEL-REPAIR-004 prepared the initial candidates and evidence gaps; `KD-2026-008`–`KD-2026-017` add Engineering Sufficiency and Material Consequence as candidates and approve no concept.

## Concept Groups

- Epistemic: Engineering Knowledge, Engineering Observation, Knowledge Ownership, Truth Mode.
- Evaluation: Residual, Engineering Constraint, Preference, Material Consequence, Engineering Sufficiency.
- Decision support: Candidate Solution, Proposal, Delta Operation, Engineering Decision.
- Independence: Solver Independence.

## Concept Index

| Kernel ID | Concept | Lifecycle status | Unresolved marker | Evidence classification |
|---|---|---|---|---|
| [`KC-EVAL-001`](KC-EVAL-001_Engineering_Knowledge.md) | Engineering Knowledge | `candidate` | None | multi-source support |
| [`KC-EVAL-002`](KC-EVAL-002_Engineering_Observation.md) | Engineering Observation | `candidate` | None | multi-source support |
| [`KC-EVAL-003`](KC-EVAL-003_Knowledge_Ownership.md) | Knowledge Ownership | `candidate` | None | direct provenance |
| [`KC-EVAL-004`](KC-EVAL-004_Truth_Mode.md) | Truth Mode | `candidate` | `evidence-missing` | evidence-missing |
| [`KC-EVAL-005`](KC-EVAL-005_Residual.md) | Residual | `candidate` | `evidence-missing` | evidence-missing |
| [`KC-EVAL-006`](KC-EVAL-006_Engineering_Constraint.md) | Engineering Constraint | `candidate` | `evidence-missing` | evidence-missing |
| [`KC-EVAL-007`](KC-EVAL-007_Preference.md) | Preference | `candidate` | `evidence-missing` | evidence-missing |
| [`KC-EVAL-008`](KC-EVAL-008_Candidate_Solution.md) | Candidate Solution | `candidate` | `evidence-missing` | evidence-missing |
| [`KC-EVAL-009`](KC-EVAL-009_Proposal.md) | Proposal | `candidate` | `evidence-missing` | evidence-missing |
| [`KC-EVAL-010`](KC-EVAL-010_Delta_Operation.md) | Delta Operation | `candidate` | `evidence-missing` | evidence-missing |
| [`KC-EVAL-011`](KC-EVAL-011_Engineering_Decision.md) | Engineering Decision | `candidate` | `evidence-missing` | evidence-missing |
| [`KC-EVAL-012`](KC-EVAL-012_Solver_Independence.md) | Solver Independence | `candidate` | `evidence-missing` | evidence-missing |
| [`KC-EVAL-013`](KC-EVAL-013_Engineering_Sufficiency.md) | Engineering Sufficiency | `candidate` | None | strongly supported Research plus responsibility mapping |
| [`KC-EVAL-014`](KC-EVAL-014_Material_Consequence.md) | Material Consequence | `candidate` | None | high-confidence independent-relation Research |

## Dependencies and Boundaries

- Governance controls Kernel ownership, approval, and Decision Records; Engineering Decision remains a separate unresolved concept.
- Identity and workflow remain independent: candidate, proposal, and decision roles do not redefine engineering-object identity.
- [`KC-REALIZATION-005 Physical Realization`](../REALIZATION/KC-REALIZATION-005_Physical_Realization.md) remains distinct from observation.
- [`FC-001`](../FREEZES/FC-001.md) prevents representations from becoming Identity or knowledge merely through form.
- Physical variability, observation uncertainty, constraint violation, and residual magnitude remain separate.
- Constraint ≠ Residual; Preference ≠ Constraint; Candidate Solution ≠ Proposal ≠ Engineering Decision.
- Engineering Sufficiency is relative to a specified consequential use; it is not truth, validity, applicability, completeness, constraint, preference, decision, approval, or acceptance.
- A Sufficiency Claim is the evidence-bearing result of an Engineering Sufficiency evaluation, not a separate concept in this package.
- [`KC-EVAL-014 Material Consequence`](KC-EVAL-014_Material_Consequence.md) is related to Engineering Sufficiency but independent; consequence remains distinct from probability, risk, uncertainty, requirement, constraint, preference, approval, and authority.

## Traceability Matrix

| Kernel ID | Evidence classification | Research source | Governance decision | RefImpl correspondence | Thesis explanation | Status | Unresolved marker |
|---|---|---|---|---|---|---|---|
| KC-EVAL-001 | multi-source support | IMPORT-002; SPOT-007; EDITOR-006 | candidate mandate `KD-2026-001`; approval absent | import/admission states only; incomplete | engineering knowledge chapter | `candidate` | None |
| KC-EVAL-002 | multi-source support | REALIZATION-001 counterexamples; observation draft | candidate mandate; approval absent | observation/provenance behavior incomplete | observations and measurement chapters | `candidate` | None |
| KC-EVAL-003 | direct provenance | EDITOR-006 support | GOVERNANCE-001/002; `KD-2026-002` | ownership metadata unverified | engineering knowledge chapter | `candidate` | None |
| KC-EVAL-004 | evidence-missing | None found | approval absent | no canonical contract | knowledge chapter/glossary only | `candidate` | `evidence-missing` |
| KC-EVAL-005 | evidence-missing | None found | approval absent | optimization residual vectors | constraint/optimization chapters only | `candidate` | `evidence-missing` |
| KC-EVAL-006 | evidence-missing | None found | approval absent | constraint builders | constraints chapter only | `candidate` | `evidence-missing` |
| KC-EVAL-007 | evidence-missing | None found | approval absent | weights/objectives only | decisions/glossary only | `candidate` | `evidence-missing` |
| KC-EVAL-008 | evidence-missing | None found | approval absent | solver candidate outputs | decisions/operators only | `candidate` | `evidence-missing` |
| KC-EVAL-009 | evidence-missing | None found | approval absent | solver proposal variables | decisions/context only | `candidate` | `evidence-missing` |
| KC-EVAL-010 | evidence-missing | None found | approval absent | edit operations are naming evidence only | glossary only | `candidate` | `evidence-missing` |
| KC-EVAL-011 | evidence-missing | None found | Governance decisions are a distinct counterexample | no accountable engineering-decision contract | decisions chapter only | `candidate` | `evidence-missing` |
| KC-EVAL-012 | evidence-missing | None found | approval absent | solver-specific formulations | decisions/operators only | `candidate` | `evidence-missing` |
| KC-EVAL-013 | strongly supported Research plus responsibility mapping | PRS-001; PRS-002 | `KD-2026-008`–`KD-2026-014`; approval absent | follow-up required; no object model prescribed | follow-up required | `candidate` | None |
| KC-EVAL-014 | high-confidence independent-relation Research | MC-001; PRS-001; PRS-002 | `KD-2026-015`–`KD-2026-017`; approval absent | follow-up required; no universal risk or object model prescribed | follow-up required | `candidate` | None |

Implementation and Thesis correspondences are evidence, not canonical authority or demonstrated conformance.

## Evidence Register and Research Follow-ups

The [`Evaluation Evidence Register`](EVIDENCE_REGISTER.md) contains the full evidence matrix and focused missions `EVAL-R-004` through `EVAL-R-012`. Each mission specifies its question, reductions, counterexamples, boundaries, acceptable outcomes, and done criterion.

Unsupported entries must remain marked `evidence-missing` until their respective Research mission and a separately authorized Kernel repair are complete.

## Purpose-Relative Sufficiency

[`RESEARCH-EVAL-PRS-001 Purpose-Relative Sufficiency`](../research/EVALUATION/RESEARCH-EVAL-PRS-001_Purpose_Relative_Sufficiency.md) has outcome `survives with reformulation` and evidence strength `strongly supported`. [`RESEARCH-EVAL-PRS-002 Evaluation Responsibility Mapping`](../research/EVALUATION/RESEARCH-EVAL-PRS-002_Evaluation_Responsibility_Mapping.md) compares that result with all twelve Evaluation candidates and records the non-canonical disposition `missing Evaluation responsibility`.

`KD-2026-008`–`KD-2026-014` resolve the missing responsibility as [`KC-EVAL-013 Engineering Sufficiency`](KC-EVAL-013_Engineering_Sufficiency.md), a substantive `candidate`. Purpose-Relative Sufficiency remains the unchanged Research provenance and historical investigation name.

Engineering Sufficiency relates available information, scoped use, material consequences, independently grounded requirements, demonstrated capabilities, and applicable thresholds. Its result is a contestable Sufficiency Claim, not a separate concept. Material Consequence remains related and independent, and authorization or acceptance remains downstream.

[`RESEARCH-EVAL-MC-001 Material Consequence`](../research/EVALUATION/RESEARCH-EVAL-MC-001_Material_Consequence.md) resolves the Research disposition as `independent relation` with high confidence. `KD-2026-015`–`KD-2026-017` create [`KC-EVAL-014 Material Consequence`](KC-EVAL-014_Material_Consequence.md) as a substantive, non-approved `candidate`. The relation connects a possible deficiency or event to an engineering-relevant outcome for an affected scope under a specified Use Context; it informs requirement activation and prioritization but is not risk, authority, or Engineering Sufficiency.

Lifecycle invalidation, minimum provenance, cumulative consequence treatment, and the boundary between cross-domain meaning and domain profiles remain open. Reference Implementation and Thesis conformance require follow-up.
