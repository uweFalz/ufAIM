# Knowledge Kernel Decision Log

This is the append-only canonical log of effective Knowledge Kernel governance decisions. Decision identifiers are immutable and sequential within their year, as established by `KD-2026-005`. Corrections must be recorded by a later decision rather than rewriting an effective decision's meaning.

## KD-2026-001

- **Decision ID:** `KD-2026-001`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** May Codex missions prepare, edit, and validate Kernel candidates without receiving approval or revocation authority?
- **Decision:** Codex missions may prepare, edit, and validate Kernel candidates only within explicit mission scope. This mandate grants no approval or revocation authority.
- **Rationale:** Candidate preparation requires a stable operational mandate while canonical status transitions remain human decisions.
- **Affected Files:** [`../KERNEL_CONSTITUTION.md`](../KERNEL_CONSTITUTION.md), [`GOVERNANCE-001_Kernel_Domain_Ownership.md`](GOVERNANCE-001_Kernel_Domain_Ownership.md), [`GOVERNANCE-002_Kernel_Approval_Process.md`](GOVERNANCE-002_Kernel_Approval_Process.md)
- **Status:** effective
- **Supersedes:** None
- **Follow-up:** Every Codex editing mission must retain explicit file scope and must not infer approval authority.

## KD-2026-002

- **Decision ID:** `KD-2026-002`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** Who holds Approval and Revocation Authority, and may that authority be delegated?
- **Decision:** Uwe Falz is the primary human Approval and Revocation Authority. He may delegate a limited mandate to a named person or role through an explicit Decision Record. Grey is a reviewer or arbitrator by default and is not an approver unless explicitly delegated.
- **Rationale:** Human authority must be explicit, auditable, and limited; review must not be confused with approval.
- **Affected Files:** [`../KERNEL_CONSTITUTION.md`](../KERNEL_CONSTITUTION.md), [`GOVERNANCE-001_Kernel_Domain_Ownership.md`](GOVERNANCE-001_Kernel_Domain_Ownership.md), [`GOVERNANCE-002_Kernel_Approval_Process.md`](GOVERNANCE-002_Kernel_Approval_Process.md)
- **Status:** effective
- **Supersedes:** None
- **Follow-up:** Any delegation must identify its holder, scope, permitted transitions, and duration or revocation condition in a later Decision Record.

## KD-2026-003

- **Decision ID:** `KD-2026-003`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** Shall the substantive freeze “Representation is never Identity” become an approved canonical freeze despite the unaudited historical approval label?
- **Decision:** Approve FC-001 as a canonical freeze with the meaning “Representation is never Identity.” Its canonical home is [`../FREEZES/FC-001.md`](../FREEZES/FC-001.md); the historical draft remains provenance only.
- **Rationale:** The boundary is explicitly confirmed now without inferring legitimacy from the historical `Status: Approved` label.
- **Affected Files:** [`../FREEZES/FC-001.md`](../FREEZES/FC-001.md), [`../_draft/40-freezes/FC-001.md`](../_draft/40-freezes/FC-001.md), [`../KERNEL_CONSTITUTION.md`](../KERNEL_CONSTITUTION.md)
- **Status:** effective
- **Supersedes:** The unaudited status assertion in `_draft/40-freezes/FC-001.md`; it does not erase or replace that historical file.
- **Follow-up:** Kernel candidates must preserve the approved Representation/Identity boundary.

## KD-2026-004

- **Decision ID:** `KD-2026-004`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** Shall the substantive freeze “Metric Realization is not Identity” become an approved canonical freeze despite the unaudited historical approval label?
- **Decision:** Approve FC-002 as a canonical freeze with the meaning “Metric Realization is not Identity.” Its canonical home is [`../FREEZES/FC-002.md`](../FREEZES/FC-002.md); the historical draft remains provenance only.
- **Rationale:** The boundary is explicitly confirmed now without inferring legitimacy from the historical `Status: Approved` label.
- **Affected Files:** [`../FREEZES/FC-002.md`](../FREEZES/FC-002.md), [`../_draft/40-freezes/FC-002.md`](../_draft/40-freezes/FC-002.md), [`../KERNEL_CONSTITUTION.md`](../KERNEL_CONSTITUTION.md)
- **Status:** effective
- **Supersedes:** The unaudited status assertion in `_draft/40-freezes/FC-002.md`; it does not erase or replace that historical file.
- **Follow-up:** Kernel candidates must preserve the approved Metric Realization/Identity boundary.

## KD-2026-005

- **Decision ID:** `KD-2026-005`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** Where and under what identifier convention are Kernel governance decisions recorded?
- **Decision:** The canonical Decision Log is `docs/knowledgeKernel/GOVERNANCE/DECISION_LOG.md`. Records use immutable sequential identifiers `KD-YYYY-NNN`. Historical status files remain in place and receive provenance or status clarification when necessary.
- **Rationale:** A single append-only sequence makes authority, status transitions, and provenance auditable while preserving history.
- **Affected Files:** [`DECISION_LOG.md`](DECISION_LOG.md), [`GOVERNANCE-002_Kernel_Approval_Process.md`](GOVERNANCE-002_Kernel_Approval_Process.md), [`README.md`](README.md)
- **Status:** effective
- **Supersedes:** The provisional record convention in `GOVERNANCE-002` and the unresolved location brief D-004 in [`INVENTORY_2026-07-18.md`](INVENTORY_2026-07-18.md).
- **Follow-up:** Allocate the next 2026 decision as `KD-2026-007`; never reuse or renumber an issued identifier.

## KD-2026-006

- **Decision ID:** `KD-2026-006`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** What does “stationing” mean in the Research provenance for Alignment Identity?
- **Decision:** For `KC-ID-004`, “stationing” means only intrinsic longitudinal parameterization. Operational station or kilometre addressing does not define intrinsic Alignment Identity because it may jump, overlap, change, or be reassigned.
- **Rationale:** Intrinsic parameterization contributes to constructive distinction; mutable external addressing does not.
- **Affected Files:** [`../IDENTITY/KC-ID-004_Alignment_Identity.md`](../IDENTITY/KC-ID-004_Alignment_Identity.md), [`INVENTORY_2026-07-18.md`](INVENTORY_2026-07-18.md)
- **Status:** effective
- **Supersedes:** The unresolved interpretation brief K1-ID-001 in [`INVENTORY_2026-07-18.md`](INVENTORY_2026-07-18.md).
- **Follow-up:** `KC-ID-004` remains `candidate`; any later approval requires a separate Decision Record.

## KD-2026-007

- **Decision ID:** `KD-2026-007`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** Should `KC-REALIZATION-005 Physical Realization Space` remain evidence-missing, or should it be reformulated in response to K3-REAL-001 and focused Research?
- **Decision:** Accept the `supported with reformulation` Research result. Retain stable ID `KC-REALIZATION-005`, rename the concept and active file to Physical Realization, and set its status to `candidate`. Physical Realization is the construction- and maintenance-mediated relation or process by which an intended engineering state is instantiated in a physical asset and gives rise to time-indexed physical states.
- **Rationale:** [`RESEARCH-REALIZATION-001`](../research/REALIZATION/RESEARCH-REALIZATION-001_Physical_Realization_Space.md) found that the enduring target-to-physical responsibility survives cross-domain and counterexample tests, while the word “Space” incorrectly suggests a coordinate domain, Metric Space, or object container. The reformulation preserves FC-001 and FC-002 and keeps Physical Asset, Physical State, Observation, and Representation separate.
- **Affected Files:** [`../REALIZATION/KC-REALIZATION-005_Physical_Realization.md`](../REALIZATION/KC-REALIZATION-005_Physical_Realization.md), [`../REALIZATION/README.md`](../REALIZATION/README.md), [`INVENTORY_2026-07-18.md`](INVENTORY_2026-07-18.md)
- **Status:** effective; affected Kernel concept remains `candidate`
- **Supersedes:** The `evidence-missing` disposition and open decision `K3-REAL-001` recorded for `KC-REALIZATION-005`; the stable concept ID is unchanged.
- **Follow-up:** Separate Research and Governance remain required for Physical Asset Identity, the complete time-indexed Physical State model, and formal separation of construction variability from observation uncertainty. This decision does not approve `KC-REALIZATION-005`.

## KD-2026-008

- **Decision ID:** `KD-2026-008`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** What candidate identity and canonical question shall own the missing Evaluation responsibility identified by Purpose-Relative Sufficiency Research?
- **Decision:** Create `KC-EVAL-013 Engineering Sufficiency` with status `candidate` and the canonical question “Is the available engineering information sufficient for a specified consequential use?”
- **Rationale:** The responsibility mapping found that none of the existing twelve Evaluation concepts can own this question without distortion, while the Research evidence supports preparation of a bounded candidate.
- **Affected Files:** [`../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md`](../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md), [`../EVALUATION/README.md`](../EVALUATION/README.md), [`INVENTORY_2026-07-18.md`](INVENTORY_2026-07-18.md)
- **Status:** effective; affected Kernel concept remains `candidate`
- **Supersedes:** The missing-responsibility disposition in [`RESEARCH-EVAL-PRS-002`](../research/EVALUATION/RESEARCH-EVAL-PRS-002_Evaluation_Responsibility_Mapping.md) only to the extent that it assigns a candidate identity; the Research finding and provenance remain intact.
- **Follow-up:** Approval or any later status transition for `KC-EVAL-013` requires a separate Decision Record.

## KD-2026-009

- **Decision ID:** `KD-2026-009`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** How shall the historical Purpose-Relative Sufficiency investigation relate to the canonical Engineering Sufficiency candidate?
- **Decision:** Preserve “Purpose-Relative Sufficiency” as the Research provenance and historical investigation name; use “Engineering Sufficiency” as the canonical candidate name. The Research documents are not renamed or rewritten.
- **Rationale:** Separating provenance naming from canonical naming preserves the evidentiary record without forcing historical Research terminology into the active Kernel.
- **Affected Files:** [`../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md`](../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md), [`../EVALUATION/EVIDENCE_REGISTER.md`](../EVALUATION/EVIDENCE_REGISTER.md), [`../EVALUATION/README.md`](../EVALUATION/README.md)
- **Status:** effective; affected Kernel concept remains `candidate`
- **Supersedes:** None
- **Follow-up:** Future references must distinguish the Research investigation name from the active candidate name.

## KD-2026-010

- **Decision ID:** `KD-2026-010`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** Is Engineering Sufficiency an intrinsic property of information, or a scoped relation among information, use, consequences, requirements, capabilities, and thresholds?
- **Decision:** Engineering Sufficiency is a relation among available engineering information, a specified Use Context, material consequences, independently grounded requirements, demonstrated information capabilities, and applicable thresholds and tolerances. It is not an intrinsic property of information.
- **Rationale:** The same information may be sufficient for one consequential use and insufficient for another; evaluation therefore requires explicit relational scope and criteria.
- **Affected Files:** [`../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md`](../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md), [`../EVALUATION/EVIDENCE_REGISTER.md`](../EVALUATION/EVIDENCE_REGISTER.md)
- **Status:** effective; affected Kernel concept remains `candidate`
- **Supersedes:** Any interpretation of sufficiency as an unqualified intrinsic property in the candidate package; no active Kernel entry is superseded.
- **Follow-up:** Candidate review must test multidimensional capability and lifecycle- or use-dependent changes without prescribing a software object model.

## KD-2026-011

- **Decision ID:** `KD-2026-011`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** What is a Sufficiency Claim, and does it require a separate Kernel concept in this package?
- **Decision:** A Sufficiency Claim is the evidence-bearing result of an Engineering Sufficiency evaluation. This package creates no separate Kernel concept for it.
- **Rationale:** The claim must remain scoped, traceable, and contestable, but the confirmed evidence does not require a second concept identity.
- **Affected Files:** [`../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md`](../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md), [`../EVALUATION/EVIDENCE_REGISTER.md`](../EVALUATION/EVIDENCE_REGISTER.md)
- **Status:** effective; affected Kernel concept remains `candidate`
- **Supersedes:** The open question in [`RESEARCH-EVAL-PRS-002`](../research/EVALUATION/RESEARCH-EVAL-PRS-002_Evaluation_Responsibility_Mapping.md) about whether the claim is a separate concept or evaluation result.
- **Follow-up:** Later evidence may refine the claim's record form, but no separate ID may be inferred from this decision.

## KD-2026-012

- **Decision ID:** `KD-2026-012`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** Where do the requirements and acceptable-loss thresholds used by Engineering Sufficiency originate?
- **Decision:** Requirements and acceptable-loss thresholds have explicit provenance and defined scope, may be versioned, and may arise from engineering, physical, contractual, regulatory, operational, or risk sources. The sufficiency evaluation applies them but does not create them.
- **Rationale:** Independently grounded criteria prevent an evaluation from manufacturing the conditions by which it declares itself sufficient.
- **Affected Files:** [`../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md`](../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md), [`../EVALUATION/EVIDENCE_REGISTER.md`](../EVALUATION/EVIDENCE_REGISTER.md)
- **Status:** effective; affected Kernel concept remains `candidate`
- **Supersedes:** The unresolved provenance and versioning question in [`RESEARCH-EVAL-PRS-002`](../research/EVALUATION/RESEARCH-EVAL-PRS-002_Evaluation_Responsibility_Mapping.md).
- **Follow-up:** Domain-specific packages may define governed sources and versioning practices without transferring their authority to the evaluation.

## KD-2026-013

- **Decision ID:** `KD-2026-013`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** How must technical sufficiency remain separated from approval, acceptance, authorization, and Engineering Decision?
- **Decision:** Technical sufficiency, approval, acceptance, authorization, and Engineering Decision remain separate. Authority may establish thresholds, approve use, or accept residual risk; it cannot make missing technical capability exist.
- **Rationale:** Authority governs criteria and permitted action, while technical capability remains an evidence question. Collapsing them would convert approval into manufactured evidence.
- **Affected Files:** [`../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md`](../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md), [`../EVALUATION/README.md`](../EVALUATION/README.md)
- **Status:** effective; affected Kernel concept remains `candidate`
- **Supersedes:** None
- **Follow-up:** Research and candidate work on `KC-EVAL-011 Engineering Decision` must preserve this separation.

## KD-2026-014

- **Decision ID:** `KD-2026-014`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** Does this package create or approve Material Consequence as a Kernel concept?
- **Decision:** Material Consequence is related to Engineering Sufficiency but independent. This package creates or approves no Material Consequence concept and records it as a focused open Research responsibility.
- **Rationale:** Consequences ground requirements and tolerances, but they are not the sufficiency relation or its result; their own responsibility remains unresolved.
- **Affected Files:** [`../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md`](../EVALUATION/KC-EVAL-013_Engineering_Sufficiency.md), [`../EVALUATION/EVIDENCE_REGISTER.md`](../EVALUATION/EVIDENCE_REGISTER.md), [`../EVALUATION/README.md`](../EVALUATION/README.md), [`INVENTORY_2026-07-18.md`](INVENTORY_2026-07-18.md)
- **Status:** effective; affected Kernel concept remains `candidate`
- **Supersedes:** None
- **Follow-up:** Conduct a separately authorized focused Research mission on Material Consequence before proposing any concept or active ID.

## KD-2026-015

- **Decision ID:** `KD-2026-015`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** What candidate identity and canonical question shall represent the independent relation established by Material Consequence Research?
- **Decision:** Create `KC-EVAL-014 Material Consequence` with status `candidate` and the canonical question “Under which scoped relation can a possible deficiency or event change an engineering-relevant outcome for an affected subject in a specified Use Context?”
- **Rationale:** [`RESEARCH-EVAL-MC-001`](../research/EVALUATION/RESEARCH-EVAL-MC-001_Material_Consequence.md) found with high confidence that the relation survives reduction, subtraction, counterexample, ownership, and cross-domain tests without duplicating an existing Evaluation concept.
- **Affected Files:** [`../EVALUATION/KC-EVAL-014_Material_Consequence.md`](../EVALUATION/KC-EVAL-014_Material_Consequence.md), [`../EVALUATION/README.md`](../EVALUATION/README.md), [`INVENTORY_2026-07-18.md`](INVENTORY_2026-07-18.md)
- **Status:** effective; affected Kernel concept remains `candidate`
- **Supersedes:** The open Research follow-up established by `KD-2026-014`; the decision that Material Consequence is related but independent remains in force.
- **Follow-up:** Approval or any later status transition for `KC-EVAL-014` requires a separate Decision Record.

## KD-2026-016

- **Decision ID:** `KD-2026-016`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** What is the enduring meaning of Material Consequence, and which neighboring responsibilities must remain separate?
- **Decision:** Material Consequence is the scoped relation by which a possible deficiency or event is capable of changing an engineering-relevant outcome for an affected subject under a specified Use Context. Consequence remains distinct from probability, risk, uncertainty, requirement, constraint, preference, approval, and authority; materiality is not magnitude alone.
- **Rationale:** The relation explains why independently grounded requirements and thresholds matter for a use while preserving descriptive consequence assessment separately from likelihood, evaluation, and authoritative acceptance.
- **Affected Files:** [`../EVALUATION/KC-EVAL-014_Material_Consequence.md`](../EVALUATION/KC-EVAL-014_Material_Consequence.md), [`../EVALUATION/EVIDENCE_REGISTER.md`](../EVALUATION/EVIDENCE_REGISTER.md), [`../EVALUATION/README.md`](../EVALUATION/README.md)
- **Status:** effective; affected Kernel concept remains `candidate`
- **Supersedes:** The unresolved candidate-boundary questions in `RESEARCH-EVAL-MC-001` only to the extent explicitly decided here; the Research provenance remains unchanged.
- **Follow-up:** Lifecycle invalidation and the division between cross-domain meaning and domain profiles remain open candidate questions.

## KD-2026-017

- **Decision ID:** `KD-2026-017`
- **Date:** 2026-07-19
- **Authority:** Uwe Falz
- **Question:** Does the Material Consequence candidate prescribe universal risk, severity, consequence-class, or software models?
- **Decision:** `KC-EVAL-014` prescribes no universal risk equation, severity taxonomy, consequence-class hierarchy, or software object model. Materiality may depend on outcome kind, affected scope, severity, accumulation, reversibility, detectability, protective margins, lifecycle, and Use Context without fixing universal encodings or classifications.
- **Rationale:** The cross-domain relation survives while its scales, classes, assessment methods, and representations remain domain- and context-dependent. Universal models would extend the evidence beyond its supported scope.
- **Affected Files:** [`../EVALUATION/KC-EVAL-014_Material_Consequence.md`](../EVALUATION/KC-EVAL-014_Material_Consequence.md), [`../EVALUATION/EVIDENCE_REGISTER.md`](../EVALUATION/EVIDENCE_REGISTER.md), [`INVENTORY_2026-07-18.md`](INVENTORY_2026-07-18.md)
- **Status:** effective; affected Kernel concept remains `candidate`
- **Supersedes:** None
- **Follow-up:** Domain-specific profiles and lifecycle rules require separately authorized evidence and candidate work; none is created by this decision.
