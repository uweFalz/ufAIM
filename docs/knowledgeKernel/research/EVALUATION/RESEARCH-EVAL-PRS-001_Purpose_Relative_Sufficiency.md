# Purpose-Relative Sufficiency

> **Restoration provenance**
>
> - Original source: Codex attachment `4cdfb3b3-3fc3-4ced-a538-6edfcaf90703/pasted-text.txt`
> - Restoration date: 2026-07-19
> - Status: Research
> - Canonical status: non-canonical; not approved or review-ready
> - Original outcome: `survives with reformulation`
> - Evidence strength: `strongly supported`

## Executive Summary

Purpose-Relative Sufficiency cannot be eliminated without losing an essential engineering evaluation capability. The existing nine principles can describe identity, claims, relations, applicability, reference domains, transformations, evidence, uncertainty, and authority, but they do not determine which of those capabilities must be present, at what fidelity, or with what tolerable loss for a particular use.

The candidate does not survive unchanged. “Purpose” alone is too vague, and “sufficiency” is not an intrinsic property of information. The strongest formulation is consequence-relative:

> Engineering information is sufficient for a specified use context when its available meaning, evidence, fidelity, uncertainty characterization, authority, representation, and computational accessibility satisfy the requirements activated by the material consequences of using it in that context.

This is not equivalent to validity under a condition. Information may be true and applicable yet lack necessary topology, precision, provenance, authority, or computational form. Nor is sufficiency created by approval: an authority may permit use, define thresholds, or accept residual risk, but cannot make missing technical capability exist.

Sufficiency is best understood as:

- A relation among information, a use context, requirements, and consequences.
- A multidimensional evaluation, not usually a single scalar property.
- Potentially binary at a decision boundary, though based on graded dimensions.
- A contestable engineering statement supported by evidence.
- Activated when information is selected, omitted, transformed, exchanged, relied upon, or accepted for consequential use.
- Independent of the existing principles as an organizing question, while depending on them for its evaluation dimensions.

The deeper concept exposed by the investigation is material consequence. Purpose identifies the contemplated use; material consequence explains why a capability or omission matters. Purpose-Relative Sufficiency therefore survives, but only after reformulation around a specified use context and material consequences.

## Candidate under Test

The provisional candidate was:

> The adequacy and required semantic closure of engineering information can be assessed only relative to an intended use, affected scope, required fidelity, and material consequences of loss or error.

The investigation rejects four possible overstatements:

1. Every information item does not need an explicit purpose.
2. An item does not possess sufficiency independently of a use.
3. One intended use is not necessarily the only legitimate basis of evaluation.
4. Purpose alone does not generate requirements.

The surviving claim is:

> No defensible judgment that engineering information is “enough” can be completed without identifying a use context, applicable requirements, and the material consequences of omission, distortion, uncertainty, or error.

This is an inference from the subtraction, reduction, and countermodel tests below. It is not a Governance or canonical conclusion.

## Definitions and Distinctions

### Purpose

An engineering purpose is a contemplated relation between information and a consequential engineering activity, decision, communication, preservation obligation, or action.

Purpose is not identical to:

- The function of the engineering object.
- The intention of an actor.
- The purpose of the containing system.
- The legal authorization to use information.
- Actual use after the fact.
- Every possible future use.

For sufficiency evaluation, purpose must be understood as a use context. A use context may include an activity, required outcome, affected scope, lifecycle phase, responsible actor, jurisdiction, and consequence class. These qualifiers do not all belong intrinsically to “purpose,” but they can change its requirements.

### Sufficiency

Information is sufficient when no unmet requirement material to the specified use context prevents the information from supporting that use within the applicable tolerances and accepted risk boundary.

The listed forms of sufficiency are evaluation dimensions rather than wholly independent concepts:

- Semantic: required referents, claims, conditions, and relations are interpretable.
- Epistemic: knowledge quality and uncertainty support the warranted conclusion.
- Geometric: geometry has the necessary dimensions, frame, accuracy, and fidelity.
- Structural: required decomposition, ordering, connectivity, and dependencies exist.
- Evidential: required provenance and justification exist.
- Authoritative: required status, competence, approval, or permission exists.
- Computational: tools can execute the required operations without losing necessary meaning.
- Representational: the form communicates or preserves the required meaning.
- Operational: information can safely support the activity under actual operating conditions.
- Legal or regulatory: applicable documentary, evidential, procedural, and authority requirements are met.

The dimensions are distinguishable but can interact. For example, a geometrically accurate coordinate may remain semantically insufficient if its reference frame is unknown.

### Adequacy

Sufficiency answers whether minimum material requirements are met. Adequacy is broader and asks whether the available information is suitable in quality, form, accessibility, and context.

An information package may be sufficient but awkward, inefficient, or poorly represented, and therefore only marginally adequate. Conversely, an elegant and usable representation may be inadequate because a necessary semantic component is absent.

### Semantic Closure

Information is semantically closed for a use when all semantic dependencies required to interpret consequential claims for that use are either:

- Present,
- Reliably resolvable,
- Explicitly bounded,
- Or declared unavailable in a way that prevents unsafe reliance.

Closure does not require all possible knowledge about an object. It requires closure over the dependency set activated by the use.

Semantic closure is therefore purpose-relative in application. The underlying referents and relations may exist independently, but the boundary of “all required dependencies” cannot be fixed without a context or declared capability scope.

### Materiality

An omission, error, ambiguity, approximation, or uncertainty is material when it can change a relevant conclusion, decision, action, compliance status, safety condition, allocation of responsibility, or other consequence within the use context.

Materiality depends on some combination of:

- Magnitude and probability of consequence.
- Safety, physical, economic, legal, or operational effect.
- Reversibility.
- Detectability before harm.
- Available protective margins.
- Uncertainty.
- Reliance and authority.
- The contemplated use.

Materiality is not reducible to purpose: it provides the consequence-sensitive test by which purpose activates requirements.

### Distinction Table

| Concept | Fundamental Question | Relation to Sufficiency | Independent? |
|---|---|---|---|
| Truth | Is the claim the case? | Necessary for many uses, never sufficient alone | Yes |
| Validity | Does the claim satisfy its governing rules or inference conditions? | A valid claim may lack needed scope or detail | Yes |
| Applicability | Does the claim apply under these conditions? | Selects usable claims; does not show they are enough | Yes |
| Accuracy | How close is the value to the relevant target? | One possible threshold dimension | Yes |
| Precision | How finely or reproducibly is a value expressed? | May help or mislead; precision is not accuracy | Yes |
| Uncertainty | What range or confidence limits the claim? | Material uncertainty may determine sufficiency | Yes |
| Completeness | Are all members required by a closure rule present? | Becomes a sufficiency dimension when the rule is use-derived | Partly |
| Adequacy | Is the information suitable in content, quality, and form? | Broader evaluative family containing sufficiency | Partly |
| Sufficiency | Are all material requirements for the use met? | Central question | Yes as a relation |
| Fitness for use | Can the information responsibly support the contemplated use? | Operational synthesis of sufficiency and context | Near-equivalent result |
| Materiality | Could the deficiency change a relevant consequence? | Activates and prioritizes sufficiency requirements | Yes |
| Acceptance | Has a recipient agreed to receive or rely on it? | May occur despite technical insufficiency | Yes |
| Approval | Has authorized assent been granted? | Can be a requirement but cannot create missing content | Yes |
| Authority | Who may establish requirements or permit reliance? | Governs thresholds and accountable use | Yes |
| Usability | Can intended users effectively employ the representation? | May be operationally necessary without being semantic | Yes |
| Interoperability | Can systems exchange and act on information coherently? | One use-specific capability | Yes |
| Losslessness | Was source information preserved through transformation? | Does not establish source suitability | Yes |
| Semantic closure | Are all required interpretive dependencies resolved? | A major sufficiency dimension | Derived relative to a closure boundary |

These distinctions do not imply that each term requires a separate fundamental principle.

## Formalization

Let:

- \(I\) be an information state or package.
- \(U\) be a specified use context.
- \(S\) be the affected engineering scope.
- \(R(U,S)\) be the applicable requirement set.
- \(K\) be the material consequence classes.
- \(T\) be thresholds or tolerances justified for those consequences.
- \(A\) be the relevant authority and acceptance context.
- \(t\) be the time or lifecycle state.
- \(c_j(I,U)\) be the demonstrated capability of \(I\) along dimension \(j\).

Then:

\[
\operatorname{Sufficient}(I,U,S,t)
\]

holds only if every applicable material requirement has adequate evidence of satisfaction:

\[
\forall r_j \in R(U,S,t):
\operatorname{Material}(r_j,K)
\Rightarrow
c_j(I,U) \models T_j
\]

and no known unresolved deficiency can invalidate the intended reliance.

This is not circular because the requirements do not originate from the declaration of sufficiency. They arise from external sources such as physical constraints, engineering methods, contracts, regulation, risk tolerances, exchange agreements, and tool capabilities. Material-consequence analysis determines which requirements affect the contemplated use.

The formalization accommodates the example forms:

- Information \(I\) sufficient for purpose \(P\): general use-context judgment.
- Claim set \(C\) sufficient for activity \(A\): semantic and epistemic closure.
- Representation \(R\) sufficient for use \(U\): preservation plus usability.
- Evidence \(E\) sufficient for decision \(D\): justified decision readiness.
- Realization \(X\) sufficient for operation \(O\): fidelity and risk thresholds.
- Model \(M\) complete enough for consequence class \(K\): scoped closure.

Sufficiency is multidimensional before judgment. An operational process may impose a binary gate—sufficient or insufficient—but that gate is derived from multiple graded capabilities and thresholds.

The assessment is:

- Descriptive when reporting available capabilities.
- Epistemic when judging evidential support.
- Normative when requirements prescribe what must be present.
- Authoritative when a competent actor approves thresholds or permits reliance.

These modes must remain distinguishable.

## Independence Tests

### Independence Test Table

| Existing Principle | Reduction Attempt | Successful? | Residual Question |
|---|---|---:|---|
| Referential Continuity | Enough information means every relevant object is identifiable | No | Which objects must be identifiable for this use? |
| Explicit Predication | Enough information means all necessary claims are explicit | No | Which claims are necessary, and at what fidelity? |
| Explicit Relational Organization | Enough information means relations are explicit | No | Which relations are consequential? |
| Conditional Applicability | “Sufficient for P” means “valid when condition P holds” | No | Valid and applicable information can still lack necessary content |
| Domain-Relative Reference | Enough information has a declared reference domain | No | Is the domain precise and suitable enough for the use? |
| Realization and Transformation | Enough information preserves required transformation fidelity | No | Which fidelity and losses are permissible? |
| Evidential Traceability | Enough information has adequate provenance | No | Provenance of what content, and how much evidence is required? |
| Epistemic Limitation | Enough information lies below an uncertainty threshold | No | The wrong or incomplete quantity may be known with certainty |
| Accountable Force | Enough information is approved by authority | No | Can approval override physical or semantic deficiency? |

### Conditional Applicability

Applicability and sufficiency have different logical forms.

- Applicability: claim \(C\) may be used under condition \(Q\).
- Sufficiency: information set \(I\) meets the material requirements for use \(U\).

A coordinate can validly apply to an asset and date while being insufficiently accurate for setting out. A model can validly describe a railway segment while lacking connectivity needed for route simulation.

Purpose may qualify applicability, but the sufficiency judgment additionally compares available capability against a requirement boundary.

### Epistemic Limitation

Low uncertainty cannot repair semantic absence. A precisely known coordinate without a reference frame, timestamp, or relevant topology may be insufficient.

High uncertainty can be acceptable when it is immaterial to the use, conservatively bounded, or dominated by other margins. Sufficiency is therefore broader than an uncertainty threshold.

### Evidential Traceability

Complete provenance establishes where information came from, not whether the information contains what is needed. A perfectly documented two-dimensional survey remains insufficient for a task requiring elevation.

### Accountable Force

Authority can:

- Establish permissible thresholds.
- Recognize demonstrated sufficiency.
- Approve use.
- Accept residual risk.
- Grant an exception.

Authority cannot make missing topology exist or inaccurate geometry accurate. “Approved for use” and “technically sufficient” may coincide but are not logically equivalent.

### Realization and Transformation

A lossless transformation preserves the source state. It does not establish that the source state contains the meaning needed by the receiver.

### Predication and Relations

Explicit claims and relations can provide semantic closure, but the existing principles do not determine which predicates and relations are required. That determination reintroduces use, requirements, and consequence.

## Subtraction Test

A system with the existing nine principles can state:

- What an item refers to.
- What it claims.
- How it relates to other items.
- When it applies.
- In which reference domain it operates.
- How it was transformed.
- What evidence supports it.
- What is unknown.
- Who has authority over it.

Without Purpose-Relative Sufficiency or an equivalent, it cannot non-arbitrarily answer:

- Which provenance depth must be retained.
- Which uncertainty matters.
- Which relations are consequential.
- Which losses are acceptable.
- What realization fidelity is necessary.
- When the model is complete enough.
- When omission is safe.
- Whether a derived result may replace its source.
- Whether exchange succeeded in engineering terms.

Attempts to repair the subtraction necessarily introduce one of:

- Required for use.
- Material to a decision.
- Necessary to prevent a consequence.
- Needed by a receiving capability.
- Sufficient under an agreed profile.

Each is an equivalent purpose-and-consequence relation. The subtraction therefore leaves a genuine explanatory gap.

## Reduction Attempts

| Alternative | What it explains | Limitation | Assessment |
|---|---|---|---|
| Fitness for Use | Practical ability to support activity | Often conflates technical ability, usability, and authorized use | Close operational expression |
| Engineering Adequacy | Broad suitability | Less precise about minimum thresholds | Broader family |
| Semantic Sufficiency | Meaning dependencies | Excludes computational, authority, and operational dimensions | Important specialization |
| Purpose Context | Conditions surrounding use | Names context, not the evaluation relation | Component |
| Material Consequence | Why a deficiency matters | Does not alone compare capability with requirements | Deeper activating concept |
| Information Requirement | What must be present | Does not determine whether the available information satisfies it | Input to evaluation |
| Evaluation Criterion | How a property is tested | Too methodological to explain why it is required | Method component |
| Decision Readiness | Whether a decision can responsibly proceed | Narrower than construction, exchange, preservation, or operation | Specialization |
| Capability Matching | Whether supplied and required capabilities align | Understates consequence, evidence, and authority | Useful operational model |
| Semantic Closure | Whether interpretive dependencies resolve | Excludes nonsemantic operational constraints | Major derived dimension |
| Acceptable Loss | Which omissions or transformations are tolerable | Addresses transformations, not all sufficiency questions | Derived criterion |

“Engineering Adequacy” is linguistically broader, but it does not improve the analytical distinction. “Fitness for Use” is a useful result term but commonly folds together technical sufficiency, usability, and approval. “Purpose-Relative Sufficiency” remains the most precise name after purpose is reformulated as a use context and material consequence is made explicit.

## Countermodels

### Complete Universal Model

A model containing all possible information at unlimited precision is incoherent as a realizable engineering object:

- “All possible information” lacks a closed domain boundary.
- Unlimited precision is physically and computationally unavailable.
- Contradictory models, times, authorities, and observation states may coexist.
- Selection and interpretation remain necessary for finite action.
- Excess information can impair usability without resolving authority.

Even an idealized universal model would require purpose-sensitive extraction and evaluation. Purpose-relative sufficiency does not disappear.

### Minimal Valid Model

A set of true, applicable statements can omit every statement needed for the task except one. Validity does not entail closure or adequacy.

### Fully Provenanced Model

Complete provenance can explain the history of an inadequate measurement. It does not add the missing quantity, accuracy, scope, or relation.

### Fully Authoritative Model

Properly approved information can remain technically wrong or incomplete. Approval may permit action or assign accountability, but it does not alter physical sufficiency.

### Exact Geometry Model

Exact geometry without identity, topology, state, reference frame, validity time, provenance, or authority can be unusable for engineering action.

### Lossless Exchange Model

A receiver may obtain every source bit and still lack:

- Semantic interpretation.
- Required concepts.
- Suitable resolution.
- Executable representation.
- Appropriate authority.
- Information never present at the source.

Losslessness is relative to source preservation; sufficiency is relative to use.

### Purpose-Free Descriptive Archive

An archive can adopt preservation as its present purpose. If future uses are unknown, it cannot assert universal future sufficiency. It can instead preserve broad capabilities, provenance, context, and declared limitations.

### Unknown Future Use Model

Purpose-relative sufficiency remains usable without selecting one future purpose by evaluating against:

- A declared family of anticipated purposes.
- A conservative preservation obligation.
- Capability and limitation statements.
- Reversibility and recoverability.
- The material risk of losing optional dimensions.

It cannot guarantee sufficiency for arbitrary unknown purposes.

## Boundary Cases

### Boundary-Case Table

| Case | Purpose | Required Meaning | Acceptable Loss | Sufficiency Finding |
|---|---|---|---|---|
| Disposable visualization | Rapid orientation | Identity cues, approximate form, relevant distinctions | Fine geometry and full provenance may be omitted | Highly purpose-relative |
| Construction set-out coordinate | Place physical work | Object identity, reference frame, units, epoch, tolerance, status | No loss affecting position or authority | Strict geometric and authoritative closure |
| Legal approval record | Prove authorized disposition | Subject, decision, authority, scope, date, conditions, evidence | Cosmetic representation differences | Evidence and authority dominate |
| Diagnostic simulation | Explore causal behavior | State, topology, assumptions, boundary conditions | Detail irrelevant to diagnosed behavior | Model validity alone is insufficient |
| Safety-critical operational limit | Constrain operation | Limit, units, scope, conditions, uncertainty, authority, fail-safe meaning | No ambiguity affecting safe response | Consequence-driven threshold |
| Exact mathematical definition | Establish formal meaning | Symbols, domains, assumptions, dependencies | Examples and implementation detail | Sufficient for definition, not necessarily application |
| Historical archive | Preserve future interpretability | Original content, provenance, context, formats, limitations | Operational convenience may be lost | Evaluated against preservation purpose family |
| Preliminary design | Compare options | Assumptions, alternatives, approximate geometry, uncertainties | Construction-level detail | Sufficient for selection, insufficient for construction |
| Accepted as-built model | Record realized asset | Identity, realized state, survey basis, deviations, acceptance | Design alternatives may be omitted | Acceptance does not guarantee every operational use |
| Scientific measurement | Support inference and reuse | Measurand, method, calibration, uncertainty, provenance | Presentation-specific formatting | Use family affects necessary context |
| Predictive model | Forecast defined outcomes | Inputs, domain, assumptions, uncertainty, validation evidence | Internal detail may be abstracted if behavior is preserved | Prediction target defines sufficiency |
| Temporary import candidate | Support review/admission | Source identity, parsed content, provenance, limitations | Canonical identity and approval may be absent | Sufficient before admission, not as canonical truth |
| Canonical engineering object | Preserve durable meaning | Stable identity, required claims/relations, controlled status | Source-format detail may be externalized | Canonicality does not imply universal sufficiency |
| Simplified public communication | Explain without enabling engineering reliance | Correct central message and limitations | Technical detail and computational form | Suitable for communication only |
| Machine-readable exchange | Automated interpretation | Syntax, semantics, units, identities, relations, profiles | Human layout | Lossless syntax alone is insufficient |
| Human-readable drawing | Communicate and authorize work | Geometry, annotations, references, revision, status | Internal computational structures | May be sufficient contractually but not computationally |

None of these cases permits a complete sufficiency assessment without identifying the contemplated purpose or a declared purpose family.

## Purpose Identity and Scope

Two purposes can share a label while imposing different requirements. “Construction” can mean preliminary staking, final set-out, contractor coordination, or acceptance measurement. A usable purpose reference therefore requires enough identity to distinguish materially different requirement contexts.

A single activity may contain several purposes. A simulation may support diagnosis, verification, approval evidence, and training. Information may be sufficient for one and insufficient for another.

Purposes can:

- Change over time.
- Inherit more general requirements.
- Specialize a purpose family.
- Apply only to a lifecycle phase or jurisdiction.
- Be replaced without changing the truth of the underlying information.

Purpose does not necessarily require a first-class data object. It must, however, be sufficiently explicit or traceable for the sufficiency claim to be testable.

Useful qualifiers include:

- Temporal and lifecycle scope.
- Organizational or jurisdictional scope.
- Affected objects and spatial extent.
- Responsible actor.
- Required output.
- Consequence class and acceptable risk.
- Required fidelity.
- Governing authority.

These qualify the use context. They should not all be treated as synonyms for purpose.

## Sufficiency Criteria

Criteria can arise from:

- Physical law.
- Engineering analysis.
- Design requirements.
- Regulation.
- Contract.
- Organizational policy.
- Decision authority.
- Risk tolerance.
- Operational need.
- Scientific method.
- Exchange agreement.
- Tool capability.

Some criteria are objective once the context and threshold are fixed—for example, whether coordinate uncertainty is below a stated tolerance. Others remain contestable, such as whether evidence justifies a causal conclusion or whether a model covers all material failure modes.

Sufficiency may be:

- Observed through successful use.
- Computed against measurable thresholds.
- Inferred from evidence.
- Predicted before use.
- Required normatively.
- Proposed by an analyst.
- Approved or accepted by authority.
- Rejected after review.
- Revised when purpose, evidence, or consequences change.

Accordingly, “information is sufficient for \(U\)” is normally an Engineering Statement, not a timeless intrinsic property. Its support, scope, author, assumptions, and authority may matter even though this investigation does not prescribe a representation.

## Sufficiency, Authority, and Acceptance

The following must remain separate:

- Information is technically sufficient.
- Information is declared sufficient.
- Information is approved for use.
- Information is accepted despite known insufficiency.
- Information is rejected despite demonstrated technical sufficiency.

Authority can define acceptable thresholds and decide whether residual risk is tolerable. It can recognize evidence of sufficiency or permit an exception. It cannot logically establish a technical fact merely by declaration.

Likewise, rejection does not prove technical insufficiency. A technically sufficient model may be rejected because it lacks contractual status, uses an unauthorized process, arrives late, or fails an evidential requirement.

Accountable acceptance and technical sufficiency are independent dimensions joined in a responsible-use decision.

## Sufficiency, Uncertainty, and Risk

Sufficiency is not simply a threshold on uncertainty.

- Low uncertainty about the wrong quantity does not help.
- High uncertainty may be immaterial for overview visualization.
- Complete provenance does not compensate for inadequate accuracy.
- Exact nominal geometry does not remove uncertainty in physical realization.
- Missing information may be acceptable if conservatively bounded and the bound supports the use.

Risk connects uncertainty with consequence, but sufficiency remains broader. Missing identity or authority can make information insufficient even when numerical risk is not the issue.

A useful noncanonical relationship is:

\[
\text{Risk relevance} \approx
\text{uncertainty or deficiency}
\times
\text{material consequence}
\]

This does not reduce all sufficiency dimensions to a numerical product.

## Sufficiency and Completeness

Universal completeness is not coherent for open engineering reality. Completeness always requires a closure rule:

- Closed-world completeness: everything within a declared finite world is present.
- Schema completeness: every mandatory schema component is present.
- Purpose completeness: every component required for a use is present.
- Domain completeness: all required concepts in a declared domain are covered.
- Evidential completeness: all required justification is available.
- Authority completeness: all required dispositions and signatures exist.

A complete object description is possible only relative to a description boundary. A construction-complete model differs from a simulation-complete or audit-complete record.

Completeness is therefore not identical to sufficiency. A schema-complete exchange may be insufficient for construction because the schema does not require construction tolerances. Conversely, incomplete optional metadata may be immaterial.

## Sufficiency and Representation

A representation may preserve source meaning yet remain operationally unsuitable. For example, a lossless archival encoding may be inaccessible to the required tool or incomprehensible to the responsible actor.

Usability should not be collapsed into semantic sufficiency:

- Semantic sufficiency asks whether the required meaning is available and interpretable.
- Operational usability asks whether the actor or system can effectively employ it.
- Overall fitness for use may require both.

A polyline, PDF, or coordinate list can therefore be sufficient for one use and insufficient for another without changing truth.

Representation independence itself requires a preservation criterion. The acceptable abstraction boundary depends on which consequences must remain invariant.

## Sufficiency and Exchange

A canonical engineering exchange model may be purpose-independent at its conceptual core, but no finite exchange instance can guarantee sufficiency for every purpose.

Enduring strategies include:

- Broad purpose-neutral concepts.
- Purpose-specific capability expectations.
- Layered semantic closure.
- Declared limitations and losses.
- Required concept subsets.
- Preservation of optional context for anticipated future use.

These are analytical strategies, not a proposed exchange design.

Exchange success has at least three levels:

1. Transfer success: bits or structures arrived.
2. Semantic success: the receiver can interpret the intended meaning.
3. Engineering success: the received information is sufficient for the contemplated use.

Lossless transfer proves only the first and perhaps part of the second.

## Lifecycle Analysis

The same truthful information can change sufficiency without changing content:

- Concept development tolerates unresolved alternatives.
- Planning requires scope and feasibility.
- Design requires constructive definition and requirements.
- Verification requires expected behavior and comparison evidence.
- Approval requires authority and auditable justification.
- Construction requires set-out fidelity and controlled status.
- Commissioning requires realized-state and test evidence.
- Operation requires current limits, topology, and state.
- Maintenance requires history, condition, and intervention context.
- Renewal requires present state plus future requirements.
- Decommissioning requires hazards, identity, and disposition.
- Archiving requires provenance, interpretability, and preservation context.

This lifecycle variation strongly resists reduction to truth, validity, or fixed item completeness.

## Cross-Domain Validation

### Cross-Domain Table

| Domain | Purpose Form | Sufficiency Criterion | Independent Principle Needed? |
|---|---|---|---|
| Linear infrastructure | Design, set-out, route simulation, operation | Geometry, stationing, topology, reference systems, lifecycle state | Yes; different uses activate different dimensions |
| Discrete engineered products | Manufacture, assembly, inspection, certification | Configuration, tolerances, materials, interfaces, revision status | Yes; valid product data may be insufficient for manufacture |
| Industrial/operational processes | Control, diagnosis, optimization, audit | Process state, timing, causal relations, limits, uncertainty | Yes; observation content varies with action |
| Safety-critical regulated systems | Hazard control, authorization, continued operation | Traceable requirements, verified behavior, limits, evidence, authority | Yes; approval and technical sufficiency remain distinct |
| Scientific measurement | Inference, replication, calibration transfer | Measurand, uncertainty, method, provenance, context | Yes; exact recording is not universal fitness |
| Software-intensive control | Execution, verification, incident reconstruction | Configuration, interfaces, timing, state, version, evidence | Yes; lossless code exchange does not ensure operational suitability |

The terminology transfers across domains when “purpose” means a scoped consequential use rather than an object’s function or an actor’s private intention.

## Circularity Test

A non-circular evaluation proceeds as follows:

1. Specify the contemplated use and affected scope.
2. Identify external requirement sources.
3. Trace each requirement to a material consequence or binding obligation.
4. Determine observable or arguable satisfaction criteria.
5. Evaluate the available information and evidence.
6. Record disagreement where requirement interpretation or evidence is contested.
7. Keep technical findings separate from authorization and risk acceptance.

“Required” is not defined as “whatever sufficiency requires.” It is grounded in physical constraints, methods, obligations, or consequence-sensitive decisions.

“Sufficient” is not defined as “fit because it is sufficient.” It is the result of comparing demonstrated capabilities with independently grounded material requirements.

Authority interacts by establishing legitimate thresholds or accepting residual risk, not by replacing the comparison.

## Missing-Concept Search

| Candidate | Finding |
|---|---|
| Engineering Consequence | More fundamental as the explanation of why a deficiency matters |
| Materiality | Core activation relation between deficiency and consequence |
| Fitness | Result of technical sufficiency plus operational suitability |
| Relevance | Weaker filter; relevant information need not be sufficient |
| Adequacy | Broader evaluative family |
| Capability | Describes what information enables; does not establish need |
| Requirement Closure | Formalizable specialization of semantic/technical sufficiency |
| Decision Readiness | Use-specific specialization |
| Use Context | Necessary participant in the sufficiency relation |
| Semantic Dependency | Explains closure structure |
| Acceptable Loss | Derived threshold for omission or transformation |

The investigation does not replace Purpose-Relative Sufficiency with Materiality because materiality alone cannot answer whether the available information meets the activated requirements. The concepts form a chain:

\[
\text{Use Context}
\rightarrow
\text{Material Consequences}
\rightarrow
\text{Requirements}
\rightarrow
\text{Capability Evaluation}
\rightarrow
\text{Sufficiency Claim}
\rightarrow
\text{Authorization or Acceptance}
\]

This is an analytical relationship, not a proposed architecture.

## Derived Concepts

### Derived Concept Table

| Candidate Concept | Relation to Purpose-Relative Sufficiency | Classification |
|---|---|---|
| Semantic closure | Closure over meaning dependencies activated by use | Directly Derived |
| Fitness for use | Sufficiency combined with operational and actor context | Conditionally Derived |
| Completeness | Closure relative to a requirement boundary | Conditionally Derived |
| Fidelity | Required preservation or correspondence quality | Conditionally Derived |
| Granularity | Detail needed to distinguish material consequences | Conditionally Derived |
| Materiality | Determines which deficiencies matter | Related but Independent |
| Acceptable loss | Loss that does not violate material requirements | Directly Derived |
| Required provenance depth | Evidence depth activated by use and authority | Conditionally Derived |
| Required uncertainty expression | Uncertainty needed for consequence-aware judgment | Conditionally Derived |
| Required authority | Authority demanded by the use or obligation | Conditionally Derived |
| Required reference precision | Reference capability necessary for the use | Conditionally Derived |
| Required realization detail | Fidelity needed for physical or operational consequences | Conditionally Derived |
| Exchange profiles | Possible operational expression of use-specific requirements | Conditionally Derived |
| Validation criteria | Tests derived from applicable requirements | Conditionally Derived |
| Decision readiness | Sufficiency for a specified decision plus authority context | Conditionally Derived |

## Falsification Findings

### Counterexample Table

| Proposition | Counterexample | Result |
|---|---|---|
| If information is true, it is sufficient | A true coordinate lacks its reference frame | Falsified |
| If information is valid, it is sufficient | A currently applicable asset model lacks topology for simulation | Falsified |
| If information is complete, it is sufficient | A schema-complete 2D model is used for 3D clearance analysis | Falsified unless “complete” already means purpose-complete |
| If information is approved, it is sufficient | Approved drawings contain an undetected dimensional error | Falsified |
| If information is exact, it is sufficient | Exact geometry lacks identity, state, or authority | Falsified |
| If information is fully provenanced, it is sufficient | Perfect provenance documents an inadequate measurement | Falsified |
| If exchange is lossless, received information is sufficient | Every source bit arrives, but the source lacks required semantics | Falsified |
| If information is sufficient once, it remains sufficient | Preliminary geometry becomes inadequate at construction phase | Falsified |
| If information is sufficient for one purpose, it is sufficient for all | A visualization polyline is used for setting out | Falsified |
| Purpose is merely another applicability condition | A claim applies to the asset and date but lacks required accuracy | Falsified as an equivalence |

The completeness proposition requires qualification. If “complete” is defined as “containing everything required for the same specified purpose,” sufficiency follows partly by definition. That does not eliminate Purpose-Relative Sufficiency; it embeds purpose-relative requirements into the meaning of completeness.

The candidate survived:

- Reduction to every existing principle.
- Removal from a nine-principle system.
- Idealized universal-completeness arguments.
- Validity-, evidence-, authority-, geometry-, and transfer-maximal countermodels.
- Lifecycle changes.
- Cross-domain variation.
- Unknown-future-use analysis.

The initial wording did not survive intact. In particular:

- Purpose must be a specified use context or declared purpose family.
- Material consequence must ground requirement activation.
- Sufficiency must be treated as a supported evaluation claim.
- Authorized acceptance must remain separate.
- Sufficiency must not be asserted as a mandatory property attached to every item.

## Remaining Unresolved Questions

- How narrowly must a use context be specified before a sufficiency claim becomes testable?
- When may a purpose family legitimately stand in for individually enumerated uses?
- How should conflicting technical, contractual, and regulatory thresholds be compared without collapsing authority into truth?
- When does conservative preservation become disproportionate to plausible future benefit?
- Can semantic and operational sufficiency always be separated in human-dependent activities?
- How should cumulative small omissions be assessed when none is material alone?
- When is evidence that no material requirement is missing strong enough?
- Can a sufficiency judgment be monotonic when new evidence or new purposes emerge?
- How should disagreement over consequence severity be represented independently of disagreement over information quality?
- Under what conditions may accepted residual risk permit action while the information remains explicitly insufficient?

## Overall Assessment

The candidate survives because the existing principles describe semantic capabilities but do not select which capabilities, fidelity, evidence, or authority are necessary for a consequential use. Removing the candidate forces purpose, requirement, materiality, or an equivalent concept back into the evaluation.

It requires reformulation because “purpose” is not sufficient by itself. The defensible principle concerns the relation among a specified use context, material consequences, independently grounded requirements, demonstrated information capabilities, and accountable reliance. It does not make purpose a mandatory attribute of every engineering item, and it does not confuse approval with technical sufficiency.

Overall Outcome:
Survives with Reformulation

Evidence:
Strongly Supported
