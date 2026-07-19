# Evaluation Evidence Register

This descriptive register supports KERNEL-REPAIR-004. It records no approval and does not execute the Research missions specified below.

## Evidence Matrix

| Kernel ID | Canonical question focus | Strongest evidence | Classification | Dependencies | Counterexample or conflict | Missing evidence |
|---|---|---|---|---|---|---|
| KC-EVAL-001 | admitted information usable for engineering reliance | Import/SPOT admission Research; Governance | multi-source support | Governance, Observation, Ownership | stored or repeated data without authority | domain-specific admission criteria |
| KC-EVAL-002 | source-grounded evidence about object/state/context | Realization Research; observation draft | multi-source support | Identity, Physical Realization | several conflicting observations of one state | raw record versus observation versus inferred state |
| KC-EVAL-003 | responsibility for knowledge meaning and revision | GOVERNANCE-001/002 | direct provenance | Governance, Knowledge | storage custodian differs from semantic owner | domain owner assignments |
| KC-EVAL-004 | epistemic classification responsibility | Thesis only | evidence-missing | Knowledge, Observation, Decision | valid-but-false, approved-but-limited, uncertain observation | truth/status dimensions and transitions |
| KC-EVAL-005 | typed deviation relation or quantity | implementation and Thesis only | evidence-missing | Observation, Constraint, Preference | zero residual with invalid model; uncertainty without violation | residual families and semantics |
| KC-EVAL-006 | mandatory engineering condition | implementation and Thesis only | evidence-missing | Knowledge, Ownership | same rule encoded by inequality, residual, or logic | authority, applicability, lifecycle |
| KC-EVAL-007 | non-mandatory comparison criterion | Thesis only | evidence-missing | Candidate, Constraint, Decision | preference weight accidentally excludes an alternative | ownership and comparison semantics |
| KC-EVAL-008 | evaluable unaccepted alternative | Thesis only | evidence-missing | Constraint, Preference, Proposal | same candidate generated manually and by solver | identity, content, lifecycle |
| KC-EVAL-009 | accountable submission for evaluation | implementation and Thesis only | evidence-missing | Candidate, Delta, Decision | proposal with several candidates or no executable delta | identity, authority, required contents |
| KC-EVAL-010 | intended/executed/recorded change responsibility | Thesis only | evidence-missing | Proposal, Decision, Identity | numerical difference that is not executable; command not yet executed | whether name combines concepts |
| KC-EVAL-011 | accountable acceptance/rejection/selection act | Thesis only | evidence-missing | Proposal, Knowledge, authority | solver optimum rejected by responsible engineer | authority, identity, effects, record |
| KC-EVAL-012 | separation of meaning from solver machinery | Thesis and implementation only | evidence-missing | all evaluation concepts | formulations with incompatible solver requirements | exact independence scope and tests |
| KC-EVAL-013 | sufficient information capability for a specified consequential use | PRS-001 and PRS-002 | strongly supported Research plus responsibility mapping | Knowledge, Observation, Constraint, Use Context, independently grounded requirements, material consequences, evidence and uncertainty | true, complete, applicable, or approved information that still lacks a required capability | domain-specific capability dimensions; claim ownership |
| KC-EVAL-014 | scoped deficiency- or event-to-outcome relation | MC-001; PRS-001; PRS-002 | high-confidence independent-relation Research | Use Context, affected subject and scope, outcome evidence, requirements and thresholds | high-probability negligible effect; low-probability catastrophic effect; large but use-irrelevant deviation | lifecycle invalidation; minimum provenance; cumulative effects; domain profiles |

RefImpl and Thesis material are correspondence evidence, not authority. Principal terminology conflicts are constraint versus residual encoding, preference versus weighted objective, proposal versus candidate, and intended delta versus executed change.

## Purpose-Relative Sufficiency

The completed investigation has been restored as [`RESEARCH-EVAL-PRS-001 Purpose-Relative Sufficiency`](../research/EVALUATION/RESEARCH-EVAL-PRS-001_Purpose_Relative_Sufficiency.md). Its recorded outcome is `survives with reformulation` and its evidence strength is `strongly supported`. It is non-canonical Research and is not approved or review-ready.

The source investigates completeness, fitness for use, acceptable loss, required provenance, uncertainty, authority, reference precision, realization detail, validation criteria, and decision readiness as consequence-relative evaluation concerns.

The authorized responsibility mapping is recorded in [`RESEARCH-EVAL-PRS-002 Evaluation Responsibility Mapping`](../research/EVALUATION/RESEARCH-EVAL-PRS-002_Evaluation_Responsibility_Mapping.md). Its selected disposition is `missing Evaluation responsibility`: no existing Evaluation concept can answer whether available engineering information is sufficient for a specified consequential use without importing hidden purpose and consequence semantics or collapsing technical sufficiency into approval. No existing concept was promoted or modified.

`KD-2026-008`–`KD-2026-014` implement the Governance disposition as [`KC-EVAL-013 Engineering Sufficiency`](KC-EVAL-013_Engineering_Sufficiency.md), status `candidate`. Purpose-Relative Sufficiency remains the unchanged Research name and provenance. The candidate is a relation among available information, specified Use Context, material consequences, independently grounded requirements, demonstrated capabilities, and applicable thresholds and tolerances; it is not an intrinsic property of information.

A Sufficiency Claim is the evidence-bearing, scoped, and contestable result of that evaluation, not a separate concept. Requirements and acceptable-loss thresholds retain explicit provenance and scope, may be versioned, and are not created by the evaluation. Approval, acceptance, authorization, and Engineering Decision remain separate and cannot make missing technical capability exist.

Material Consequence remains related but independent under `KD-2026-014`. [`RESEARCH-EVAL-MC-001 Material Consequence`](../research/EVALUATION/RESEARCH-EVAL-MC-001_Material_Consequence.md) records the high-confidence disposition `independent relation`: it links a possible deficiency or event to an engineering-relevant outcome for an affected scope under a specified Use Context and thereby explains why independently grounded requirements and thresholds are activated or prioritized.

The Research rejects reductions to Use Context, Engineering Constraint, Preference, Engineering Decision, risk, uncertainty, relevance, authority, and Engineering Sufficiency. `KD-2026-015`–`KD-2026-017` now create [`KC-EVAL-014 Material Consequence`](KC-EVAL-014_Material_Consequence.md) as a substantive `candidate`; the Research sources remain unchanged and the concept is not approved.

The candidate prescribes no universal risk equation, severity taxonomy, consequence-class hierarchy, or software object model. Open evidence needs concern lifecycle invalidation, minimum provenance, cumulative and interacting consequences, and domain-profile boundaries. Reference Implementation and Thesis work remain follow-up.

## Focused Research Follow-ups

### EVAL-R-004 — Truth Mode

- **Question:** Does Truth Mode denote one epistemic dimension or a composition of source kind, derivation kind, assertion status, validity, authority, acceptance, and uncertainty?
- **Reduction attempts:** reduce to Governance lifecycle status, evidence provenance, validity, authority, uncertainty, or Engineering Decision.
- **Counterexamples:** approved but scope-limited claim; valid inference from false premises; uncertain observation; rejected but true claim; derived value later observed independently.
- **Boundaries:** Observation is not reality; approval is not truth; validity is not authority; proposal is not decision.
- **Acceptable outcomes:** supported, supported with reformulation, derived composition, duplicate, eliminated, or inconclusive.
- **Done criterion:** independent dimensions, allowed combinations, and ownership are defensible without inventing a single enumeration.

### EVAL-R-005 — Residual

- **Question:** Is Residual a universal evaluative relation or a family of typed quantities for observation, model fit, constraint evaluation, and optimization?
- **Reduction attempts:** reduce to difference, constraint violation, uncertainty, objective term, or solver vector.
- **Counterexamples:** zero residual with wrong model; nonzero observation residual within uncertainty; inequality satisfied with nonzero encoding; same deviation under different normalization.
- **Boundaries:** residual ≠ constraint; violation ≠ uncertainty; evaluation ≠ solver encoding.
- **Acceptable outcomes:** single bounded concept, typed family, derived mathematical term, duplicate, or inconclusive.
- **Done criterion:** domain/reference, units, sign, normalization, uncertainty relation, and solver-independent meaning are resolved.

### EVAL-R-006 — Engineering Constraint

- **Question:** What makes an engineering condition mandatory, applicable, authoritative, and identifiable independently of its mathematical encoding?
- **Reduction attempts:** reduce to Engineering Knowledge, rule, predicate, residual, solver constraint, or decision.
- **Counterexamples:** same rule encoded as logic/inequality/residual; obsolete regulation; context-inapplicable limit; uncertain observation near a mandatory threshold.
- **Boundaries:** constraint ≠ residual; preference ≠ constraint; violation ≠ uncertainty; encoding ≠ meaning.
- **Acceptable outcomes:** supported normative concept, composition of knowledge plus applicability, derived relation, or inconclusive.
- **Done criterion:** authority, subject, applicability, compliance semantics, lifecycle, and encoding independence are explicit.

### EVAL-R-007 — Preference

- **Question:** What non-mandatory, owned comparison relation distinguishes Preference from Constraint, objective function, ranking, and Decision?
- **Reduction attempts:** reduce to utility, weight, objective, ordering, stakeholder statement, or decision criterion.
- **Counterexamples:** equal alternatives; cyclic preferences; context-dependent priority; weight that effectively forbids; conflicting stakeholder preferences.
- **Boundaries:** preference ≠ constraint; comparison ≠ acceptance; numerical weight ≠ engineering meaning.
- **Acceptable outcomes:** supported relation, contextual concept, family, duplicate, or inconclusive.
- **Done criterion:** owner, alternatives, scope, ordering semantics, conflict treatment, and non-mandatory effect are defensible.

### EVAL-R-008 — Candidate Solution

- **Question:** Is Candidate Solution an engineering state, configuration, information package, or role applied to an alternative awaiting evaluation?
- **Reduction attempts:** reduce to State, Proposal, solver result, Representation, or workflow status.
- **Counterexamples:** manual and solver generation of same alternative; partial candidate; candidate spanning several objects; rejected candidate reused later.
- **Boundaries:** candidate ≠ proposal; candidate ≠ decision; origin and workflow do not define Engineering Object Identity.
- **Acceptable outcomes:** supported information/state concept, contextual role, derived concept, duplicate, or inconclusive.
- **Done criterion:** identity, contents, provenance, lifecycle, and relation to current accepted state are resolved.

### EVAL-R-009 — Proposal

- **Question:** Is Proposal the submitted information package, the accountable submission act, or a role assigned to intended change content?
- **Reduction attempts:** reduce to Candidate Solution, Delta Operation, workflow item, request, or Decision.
- **Counterexamples:** one proposal with multiple candidates; proposal without executable change; withdrawn/resubmitted proposal; same candidate in distinct proposals.
- **Boundaries:** proposal ≠ candidate; proposal ≠ decision; workflow status ≠ object identity.
- **Acceptable outcomes:** supported package, accountable act, relational concept, split concepts, or inconclusive.
- **Done criterion:** identity, submitter authority, required content, lifecycle, and decision relation are explicit.

### EVAL-R-010 — Delta Operation

- **Question:** Must intended change, computed difference, executable transformation, recorded operation, and resulting state be separate concepts?
- **Reduction attempts:** reduce to mathematical delta, command, event, patch, state transition, Proposal, or Decision.
- **Counterexamples:** difference not executable; authorized change not executed; reversible versus irreversible operation; same result through different operations; no-op with audit meaning.
- **Boundaries:** intent ≠ execution; operation ≠ result; proposal ≠ decision; identity preservation requires explicit rules.
- **Acceptable outcomes:** reformulated single concept, split family, derived implementation term, duplicate, eliminated, or inconclusive.
- **Done criterion:** the responsibilities are separated or a coherent invariant unifies them without inventing architecture.

### EVAL-R-011 — Engineering Decision

- **Question:** What makes acceptance, rejection, or selection an accountable Engineering Decision with identity, authority, scope, and effects?
- **Reduction attempts:** reduce to Governance Decision, workflow status, evaluation result, Proposal resolution, or executed change.
- **Counterexamples:** solver optimum rejected; authorized decision not executed; two authorities decide different scopes; decision preserves current state; later supersession.
- **Boundaries:** evaluation ≠ decision; proposal ≠ decision; Governance authority and engineering authority are distinct.
- **Acceptable outcomes:** supported accountable act/record, relational concept, split decision and record, or inconclusive.
- **Done criterion:** authority, subject, alternatives, evidence, outcome, effective scope, record identity, and supersession are defensible.

### EVAL-R-012 — Solver Independence

- **Question:** Which layers of engineering meaning remain invariant across mathematical formulations, solver representations, and solver implementations?
- **Reduction attempts:** reduce to modularity, problem/formulation separation, solver interchangeability, reproducibility, or decision-authority separation.
- **Counterexamples:** solver supports only differentiable constraints; two formulations yield different local optima; stochastic versus deterministic solver; approximation changes admissibility; solver failure with valid problem.
- **Boundaries:** problem ≠ formulation ≠ solver representation ≠ implementation ≠ candidate result ≠ engineering acceptance.
- **Acceptable outcomes:** bounded principle, several independence principles, derived software quality, or inconclusive.
- **Done criterion:** invariant engineering contract, permitted formulation changes, conformance tests, and explicit non-interchangeability limits are stated.
