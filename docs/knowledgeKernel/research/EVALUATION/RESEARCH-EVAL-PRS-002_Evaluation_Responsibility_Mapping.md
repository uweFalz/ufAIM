# Evaluation Responsibility Mapping

## Research Status

- Research ID: `RESEARCH-EVAL-PRS-002`
- Status: completed Research; non-canonical
- Date: 2026-07-19
- Primary evidence: [`RESEARCH-EVAL-PRS-001 Purpose-Relative Sufficiency`](RESEARCH-EVAL-PRS-001_Purpose_Relative_Sufficiency.md)
- Selected disposition: `missing Evaluation responsibility`
- Research completion outcome: `survives with reformulation`
- Confidence: high

This mapping neither approves a Kernel concept nor creates an active Kernel ID. It preserves the primary evidence unchanged and tests only its surviving engineering question against the current Evaluation candidates.

## Question

Can the surviving Purpose-Relative Sufficiency relation be owned without distortion by an existing Evaluation concept, or does the Evaluation domain lack the responsibility needed to answer:

> Is the available engineering information sufficient for a specified consequential use?

## Evidence and Inference Separation

### Observed in the primary evidence

- Sufficiency is relative to an explicit purpose and the material consequences of failure.
- The relevant assessment may include completeness, provenance, uncertainty, reference precision, realization detail, validation criteria, acceptable loss, and decision readiness.
- Technical sufficiency is distinct from truth, applicability, completeness, approval, and authorization.
- Material Consequence and Purpose-Relative Sufficiency are related but independent responsibilities.
- The original formulation survives only after reformulation as a purpose- and consequence-relative evaluative relation rather than a universal property of information.

### Inferred by this mapping

- No current Evaluation candidate owns the complete evaluative responsibility without importing hidden use-purpose and consequence semantics.
- The smallest missing responsibility is a consequence-relative capability evaluation that produces a contestable sufficiency claim for a specified use.
- Authorization or acceptance consumes that claim and other evidence; it must not be folded into the technical evaluation.

## Surviving Relation

The smallest surviving relation is:

```text
available engineering information
  evaluated against requirements derived from
  a specified use context and its material consequences
  → capability evaluation
  → technical sufficiency claim
```

The relation does not assert that the information is true, universally complete, applicable in every context, approved, or authorized for use.

## Reduction Tests Against Existing Evaluation Concepts

| Existing concept | What the reduction preserves | What it loses | Distortion | Hidden semantics that must be reintroduced | Result |
|---|---|---|---|---|---|
| `KC-EVAL-001` Engineering Knowledge | admitted information available for engineering reliance | specified use, consequence-derived requirements, capability assessment, and sufficiency claim | Knowledge would become an evaluation result rather than the information being evaluated | purpose, material consequence, capability dimensions, acceptance threshold | rejected |
| `KC-EVAL-002` Engineering Observation | source-grounded evidence and uncertainty relevant to an assessment | non-observational knowledge, use requirements, consequence sensitivity, and overall sufficiency | Observation would be made responsible for fitness beyond what was observed | use context, requirements, aggregation across evidence kinds | rejected |
| `KC-EVAL-003` Knowledge Ownership | accountability for meaning, maintenance, and revision of knowledge | the technical test and its result | Ownership would be confused with evaluative adequacy | purpose, consequence, capability criteria, threshold | rejected |
| `KC-EVAL-004` Truth Mode | epistemic qualification of claims used as evidence | use-relative capability and consequence sensitivity | Truth would be made equivalent to sufficiency, despite true information being insufficient and uncertain information sometimes being sufficient | use, acceptable uncertainty or loss, required capability | rejected |
| `KC-EVAL-005` Residual | a typed deviation that may support one evaluation dimension | multidimensional requirements, provenance, applicability, acceptable loss, and claim responsibility | A numerical deviation would be promoted into a general adequacy judgment | purpose, consequence, threshold meaning, non-metric criteria | rejected |
| `KC-EVAL-006` Engineering Constraint | mandatory requirements against which information or a solution may be checked | whether available information has the capability to support the specified use across all relevant dimensions | A requirement would become both criterion and assessment result | use-derived requirement set, evidence capability, consequence-relative tolerance | rejected |
| `KC-EVAL-007` Preference | non-mandatory comparative concerns that may influence a use decision | minimum adequacy, material failure consequences, and technical sufficiency | Preference would acquire mandatory pass/fail force | sufficiency threshold, consequence, required capabilities | rejected |
| `KC-EVAL-008` Candidate Solution | an evaluable subject whose supporting information may be assessed | adequacy of the information for a use independent of whether the subject is a candidate solution | The object under evaluation would become the evaluation relation | use context, information requirements, capability test | rejected |
| `KC-EVAL-009` Proposal | accountable packaging or submission of material for evaluation | technical adequacy of the contained information and its consequence-relative basis | Submission would imply sufficiency | use, consequences, requirements, assessment result | rejected |
| `KC-EVAL-010` Delta Operation | change content whose evidence may need to be sufficient for use | evaluation of information not reducible to change semantics | An operation would acquire epistemic and acceptance responsibilities | use context, required evidence, consequence model | rejected |
| `KC-EVAL-011` Engineering Decision | downstream acceptance, rejection, or selection informed by evidence | the independent technical assessment that may exist without authorization | Evaluation would collapse into decision and technical sufficiency into approval | purpose-specific requirements and capability result must be reintroduced as decision evidence | rejected |
| `KC-EVAL-012` Solver Independence | independence of engineering meaning from computational machinery | the meaning and test of sufficiency itself | An invariance principle would become an adequacy relation | use, consequences, requirements, information capability | rejected |

All twelve reductions preserve a neighboring contribution, but none preserves the surviving relation as a whole. Each successful-looking reduction depends on silently restoring purpose, consequence, requirements, or capability semantics.

## Reduction Tests Against Adjacent Responsibilities

| Adjacent responsibility | Preserved contribution | Loss or counterexample | Disposition |
|---|---|---|---|
| Conditional Applicability | determines whether particular knowledge or requirements apply in the use context | applicable information can still be insufficient; sufficient information for one use can be inapplicable to another | input, not owner |
| Evidence and uncertainty | supports confidence and bounds risk in the capability assessment | well-characterized uncertainty does not itself answer whether the use can tolerate it | input, not owner |
| Authority and approval | determines who may authorize or accept use | an authority may reject sufficient information or accept risk despite technical insufficiency | downstream, separate |
| Completeness | tests coverage relative to a declared frame | complete information can lack precision, provenance, validity, or realization detail required by the use | one dimension only |
| Validity | tests conformance to applicable rules or methods | valid information can remain inadequate for the specified consequential use | one dimension only |
| Fitness for use | closely preserves purpose-relative adequacy | as an unowned phrase it hides consequence-derived requirements, capability dimensions, and the distinction from authorization | near synonym, not an existing owner |
| Acceptable loss | supplies a consequence-relative tolerance or risk boundary | tolerance does not establish the information's capability or who assesses it | input to criteria |
| Material Consequence | explains why requirements and tolerances differ by use | consequence alone does not evaluate available information | related independent responsibility |
| Decision readiness | asks whether a decision has adequate supporting material | narrower workflow context and can collapse technical evaluation into authorization | possible application, not general owner |

Counterexamples defeating the main reductions include: true but insufficient information; complete but imprecise information; applicable but provenance-deficient information; technically sufficient information that is not approved; approved use with explicitly accepted residual risk; and a small residual that masks a missing mandatory evidence category.

## Ownership Test

One existing concept should not own the entire chain.

| Chain element | Appropriate responsibility | Mapping conclusion |
|---|---|---|
| Use Context | the engineering activity or decision context supplies the declared use and scope | required input; no new owner assigned here |
| Material Consequences | a consequence responsibility identifies material effects of failure, error, or omission | related independent responsibility requiring separate treatment |
| Requirements | applicable Engineering Knowledge and Engineering Constraints express the derived requirements under their respective authority and applicability | existing neighbors contribute criteria but do not own sufficiency |
| Capability Evaluation | assesses the available information against the consequence-derived requirements, including relevant uncertainty and provenance | smallest missing Evaluation responsibility |
| Sufficiency Claim | records the scoped, evidence-backed, contestable result of the capability evaluation | output of the missing responsibility; not truth or approval |
| Authorization or Acceptance | an accountable Engineering Decision or other applicable authority accepts, rejects, or conditions use | downstream and explicitly separate from technical sufficiency |

## Separation Tests

| Required separation | Test result |
|---|---|
| technical sufficiency ≠ approval | preserved: technical assessment may precede, support, or disagree with approval |
| sufficiency ≠ truth | preserved: truth is relevant evidence, but truth alone does not establish adequacy for use |
| sufficiency ≠ applicability | preserved: applicability selects relevant information and rules; adequacy remains to be assessed |
| sufficiency ≠ completeness | preserved: completeness is one possible capability dimension |
| sufficiency ≠ preference | preserved: preference compares desirable alternatives; sufficiency establishes a scoped adequacy threshold |
| sufficiency ≠ constraint | preserved: constraints contribute requirements; they are not the evaluation relation or claim |
| sufficiency ≠ decision | preserved: a decision consumes evidence and exercises authority; the sufficiency claim remains independently contestable |

## Missing-Responsibility Test

The current Evaluation domain cannot answer the canonical engineering question without distorting one of its twelve concepts or importing an unnamed relation. The smallest missing responsibility is:

> Evaluate whether available engineering information has the required capabilities for a specified use, where the requirements and tolerances are derived from that use's material consequences, and state the resulting scoped technical sufficiency claim.

This identifies a responsibility, not a complete ontology. It does not prescribe entity structure, lifecycle, enumeration, implementation, or a new active Kernel ID.

## Disposition

### Selected disposition

`missing Evaluation responsibility`

### Strongest reasoning

The relation is irreducibly evaluative and consequence-relative. Existing concepts provide evidence, criteria, subjects, ownership, or downstream decisions, but none owns the transition from declared consequential use through capability requirements to a scoped sufficiency claim. Assigning it to any one of them either loses that transition or collapses a required separation.

### Rejected mappings

- Engineering Knowledge and Engineering Observation are evaluated inputs, not the sufficiency relation.
- Truth Mode, Residual, Constraint, Preference, completeness, validity, and applicability each cover at most one contributing dimension.
- Candidate Solution, Proposal, and Delta Operation may be subjects or contexts of an assessment.
- Engineering Decision and authority consume the result but must not define technical sufficiency.
- Solver Independence protects representational separation but supplies no adequacy semantics.
- “Fitness for use” is too underspecified to act as an existing owner without reintroducing the full missing responsibility.

### Proposed canonical question

> Is the available engineering information sufficient for a specified consequential use?

### Proposed domain and neighbors

The proposed home is the Evaluation domain. Immediate neighbors are Engineering Knowledge, Engineering Observation, Truth Mode, Engineering Constraint, Engineering Decision, Conditional Applicability, evidence and uncertainty, and the independent Material Consequence responsibility.

### Material Consequence

Material Consequence requires separate treatment. It is necessary to derive requirements and tolerances, but it is neither the sufficiency evaluation nor its result. This mission does not determine whether it warrants its own Kernel concept, a relation owned elsewhere, or a researched composition.

### Governance recommendation

Governance should authorize a focused candidate-preparation package for the missing Evaluation responsibility only after deciding its canonical name, exact boundary, and relation to Material Consequence. That package should decide whether the sufficiency claim is itself a concept or a result/role of the evaluation. It must retain the separation from Engineering Decision and must not infer approval from the strength of this Research evidence.

### Evidence Register change required

The Evaluation Evidence Register should link this mapping, record the disposition `missing Evaluation responsibility`, retain the primary Research outcome and evidence strength, and state that no existing concept was promoted or modified.

## Unresolved Questions

1. Is Material Consequence a separate Evaluation responsibility, a Governance concern, or a cross-domain input relation?
2. Should the eventual canonical subject be named Purpose-Relative Sufficiency, Use-Context Sufficiency, or Capability Evaluation?
3. Is a Sufficiency Claim a first-class Kernel concept or an evidence-bearing result/role of an evaluation?
4. How are consequence-derived requirements and acceptable-loss thresholds governed and versioned?
5. Which authority owns the technical assessment, independently of the authority that accepts or authorizes use?

These questions do not make the disposition inconclusive. They bound the later candidate design and approval work.

## Final Assessment

Purpose-Relative Sufficiency survives the responsibility mapping with its prior reformulation. Its correct current disposition is `missing Evaluation responsibility`. The result is high-confidence Research evidence, not an approved or active Kernel concept.
