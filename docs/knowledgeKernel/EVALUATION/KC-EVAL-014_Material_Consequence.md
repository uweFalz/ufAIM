# KC-EVAL-014 Material Consequence

## Status

`candidate`

## Canonical Question

Under which scoped relation can a possible deficiency or event change an engineering-relevant outcome for an affected subject in a specified Use Context?

## Candidate Canonical Answer

Material Consequence is the scoped relation by which a possible deficiency or event is capable of changing an engineering-relevant outcome for an affected subject under a specified Use Context.

## Normative Meaning

- The relation identifies why a possible deficiency or event matters for an affected subject, scope, and use; it does not assert that the event will occur.
- Engineering-relevant outcomes may be safety, physical, operational, legal, contractual, economic, evidential, or responsibility effects without forming a universal consequence-class hierarchy.
- Materiality may depend on outcome kind, affected scope, severity, accumulation, reversibility, detectability, protective margins, lifecycle, and Use Context.
- The relation may activate or prioritize independently grounded requirements, thresholds, and tolerances for a specified use. It does not create those criteria.
- Evidence of consequence may arise from observation, analysis, models, tests, history, standards, or defensible inference and retains its provenance, scope, and uncertainty.
- A changed deficiency, affected scope, lifecycle situation, evidence basis, or Use Context may change the consequence assessment even when other participants remain unchanged.
- Descriptive assessment of consequence remains contestable and separate from authoritative establishment of acceptable boundaries or permission to proceed.

## Boundaries

- consequence ≠ probability: probability concerns likelihood; consequence concerns the engineering-relevant outcome that may change.
- consequence ≠ risk: risk may relate probability, uncertainty, exposure, and consequence, but the consequence relation remains a distinct input.
- consequence ≠ uncertainty: uncertainty characterizes what is unknown or bounded; deterministic and well-known effects may still be consequential.
- consequence ≠ requirement: consequence explains why an independently grounded requirement matters for a use; it does not state or author the requirement.
- consequence ≠ constraint: a constraint expresses a mandatory condition; consequence identifies an outcome that violation, omission, or error may change.
- consequence ≠ preference: preference compares desirable alternatives; Material Consequence can activate mandatory treatment without expressing a ranking.
- consequence ≠ approval: approval is authoritative assent and cannot change the descriptive relation.
- consequence ≠ authority: authority may establish classifications, requirements, thresholds, or permission, but does not manufacture or erase the supported engineering effect.
- materiality ≠ magnitude alone: small cumulative, latent, irreversible, legal, or boundary-crossing effects may be material, while a large reversible deviation may be irrelevant to the specified use.
- No universal risk equation, severity taxonomy, consequence-class hierarchy, or software object model is defined by this candidate (`KD-2026-017`).

## Relations to Other Kernel Concepts

- [`KC-EVAL-013 Engineering Sufficiency`](KC-EVAL-013_Engineering_Sufficiency.md) uses Material Consequence to determine which independently grounded requirements, thresholds, and tolerances matter for a specified use. Engineering Sufficiency does not own or generate the consequence relation.
- [`KC-EVAL-006 Engineering Constraint`](KC-EVAL-006_Engineering_Constraint.md) may express an independently grounded mandatory condition whose contextual activation or priority is informed by Material Consequence; the concepts do not reduce to one another.
- [`KC-EVAL-007 Preference`](KC-EVAL-007_Preference.md) remains non-mandatory comparison and does not determine whether an outcome is materially consequential.
- [`KC-EVAL-011 Engineering Decision`](KC-EVAL-011_Engineering_Decision.md) may consume consequence evidence, apply authority, and accept or reject action. A decision does not create the descriptive consequence relation.
- Engineering Observation and Engineering Knowledge may supply evidence about affected outcomes, propagation, severity, reversibility, detectability, and protective margins.
- Uncertainty qualifies consequence evidence or likelihood but is not the consequence.
- Risk assessment may use Material Consequence alongside probability, uncertainty, exposure, or other risk-model inputs; no universal risk relation is asserted here.
- Use Context scopes the contemplated engineering use and affected conditions. It participates in but does not subsume Material Consequence.
- Requirements and thresholds arise independently from engineering, physical, contractual, regulatory, operational, or risk sources. Material Consequence informs which of them matter for the scoped use but does not establish their authority.

## Consequences for Reference Implementation

- Follow-up implementation should preserve traceability among the possible deficiency or event, affected subject and scope, Use Context, outcome evidence, and any requirements or thresholds whose application it informs.
- Consequence evidence and uncertainty should remain distinguishable from probability, risk calculation, requirement records, decisions, and acceptance.
- Domain-specific classifications or scales may be referenced with provenance and version but must not be presented as universal Kernel enumerations.
- This candidate does not prescribe classes, schemas, APIs, workflow states, calculation methods, or a software object model.

## Consequences for Thesis

- Follow-up Thesis work should explain materiality as a scoped deficiency- or event-to-outcome relation rather than magnitude, probability, risk, or authority.
- Examples may illustrate domain-specific outcome kinds and factors while preserving the absence of a universal taxonomy or risk equation.
- The Thesis should distinguish consequence evidence, requirement activation, Engineering Sufficiency evaluation, and downstream authorization.

## Evidence and Origin

- Primary Research provenance: [`RESEARCH-EVAL-MC-001 Material Consequence`](../research/EVALUATION/RESEARCH-EVAL-MC-001_Material_Consequence.md), outcome `survives with reformulation`, disposition `independent relation`, confidence high.
- Supporting Research: [`RESEARCH-EVAL-PRS-001 Purpose-Relative Sufficiency`](../research/EVALUATION/RESEARCH-EVAL-PRS-001_Purpose_Relative_Sufficiency.md) and [`RESEARCH-EVAL-PRS-002 Evaluation Responsibility Mapping`](../research/EVALUATION/RESEARCH-EVAL-PRS-002_Evaluation_Responsibility_Mapping.md).
- Governance decisions: [`KD-2026-015`](../GOVERNANCE/DECISION_LOG.md#kd-2026-015) through [`KD-2026-017`](../GOVERNANCE/DECISION_LOG.md#kd-2026-017).

The effective decisions authorize candidate preparation and boundaries, not approval. `KC-EVAL-014` remains `candidate`.

## Open Decisions

- Determine which lifecycle changes invalidate or require revision of an existing consequence assessment.
- Determine the minimum provenance required for consequence classes, propagation paths, affected scope, and supporting evidence.
- Determine how cross-domain meaning relates to domain-specific profiles without creating a universal consequence hierarchy.
- Determine how cumulative and interacting consequences are expressed without prescribing a universal risk model.
- Reference Implementation and Thesis conformance remain follow-up work.
