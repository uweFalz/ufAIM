# AIM Figure Pattern Library

This document defines the canonical figure pattern classes for AIM.
Each thesis figure shall be an instance of exactly one pattern.
Patterns are finite, semantically distinct, and grounded in the AIM Visual Language and AIM Visual Primitive Library.

Scope note:

- No artwork.
- No diagram generation.
- No implementation notation.
- Pattern-level specification only.

## Pattern 1. Concept Pattern

- Engineering purpose: introduce one engineering concept with minimal supporting context.
- Dominant relation: concept centrality.
- Permitted primitives: State Node, Intrinsic Curve, Attachment, Annotation, Reference, Scope, Boundary.
- Prohibited primitives: Cycle-like return arrows, dense multi-operator chains, Comparison Pair unless concept itself is comparative.
- Preferred composition: single center node/object with sparse supporting attachments.
- Preferred hierarchy: central concept strongest; context attachments subordinate.
- Preferred label style: short noun phrase labels; one primary concept label.
- Common misuse: turning concept figure into dependency chain or process pipeline.
- Example thesis applications: introduction alignment-centered meaning figure; part-intro concept anchors.

## Pattern 2. Dependency Pattern

- Engineering purpose: show ownership, prerequisite, or semantic dependence.
- Dominant relation: directed dependence.
- Permitted primitives: Dependency Arrow, State Node, Layer, Boundary, Scope, Annotation, Reference.
- Prohibited primitives: Transformation Arrow used as dependency edge, loop closure edges, Realization Halo.
- Preferred composition: acyclic vertical or linear chain (A -> B -> C).
- Preferred hierarchy: upstream prerequisite visually stronger than downstream dependents.
- Preferred label style: role names or concept names, no procedural verbs.
- Common misuse: depicting process execution timing as dependency.
- Example thesis applications: foundations dependency cascade; chapter-level ownership order.

## Pattern 3. Transformation Pattern

- Engineering purpose: illustrate constructive evolution from input to output via operation.
- Dominant relation: directed transformation.
- Permitted primitives: Transformation Arrow, Operator, State Node, Intrinsic Curve, Annotation, Reference.
- Prohibited primitives: Dependency Arrow as transformation substitute, unrelated side branches, scope-heavy enclosures.
- Preferred composition: Input -> Operator -> Output.
- Preferred hierarchy: transformation path dominant; source and output balanced, operator explicit.
- Preferred label style: short semantic action labels or operator names.
- Common misuse: mixing comparison and transformation in one figure.
- Example thesis applications: curvature to pose2; pose2 extension inputs to derived state outputs.

## Pattern 4. State Pattern

- Engineering purpose: show relations between engineering states.
- Dominant relation: state relation (extension, refinement, or classification).
- Permitted primitives: State Node, Intrinsic Curve, Station Marker, Local Frame, Attachment, Transformation Arrow, Annotation, Reference.
- Prohibited primitives: heavy boundary maps (responsibility semantics), representation-dominant branches.
- Preferred composition: canonical state anchor with one clear relation to secondary state(s).
- Preferred hierarchy: canonical state primary; derived/runtime/secondary state(s) subordinate.
- Preferred label style: concise state names (for example pose2, pose3).
- Common misuse: confusing state relation with runtime operator pipeline.
- Example thesis applications: pose2 -> pose3 icon; track-state vs vehicle-state conceptual relations.

## Pattern 5. Operator Pattern

- Engineering purpose: illustrate runtime or mathematical operators and their interfaces.
- Dominant relation: operator mediation.
- Permitted primitives: Operator, Transformation Arrow, State Node, Layer, Annotation, Reference.
- Prohibited primitives: Dependency-only chains without operator semantics, decorative attachments.
- Preferred composition: input states -> operator block(s) -> output states.
- Preferred hierarchy: operator region central; inputs upstream and outputs downstream.
- Preferred label style: operator names and concise input/output labels.
- Common misuse: turning operator figure into full algorithm flowchart.
- Example thesis applications: metric realization -> runtime evaluation -> downstream output relation.

## Pattern 6. Realization Pattern

- Engineering purpose: show target, realization, and observation relation.
- Dominant relation: layered non-equivalence anchored in target semantics.
- Permitted primitives: State Node, Transformation Arrow, Realization Halo, Observation Halo, Comparison Pair, Annotation, Reference.
- Prohibited primitives: observation as canonical source, dense operator stacks as primary structure.
- Preferred composition: Target -> Realized -> Observed with target visually dominant.
- Preferred hierarchy: target primary, realized secondary, observed tertiary.
- Preferred label style: short layer labels (target, realized, observed).
- Common misuse: presenting observed data as replacement for canonical target.
- Example thesis applications: realized pose chapters and realization-aware interpretation figures.

## Pattern 7. Responsibility Pattern

- Engineering purpose: illustrate ownership boundaries and responsibility transitions.
- Dominant relation: bounded ownership progression.
- Permitted primitives: Boundary, Scope, Dependency Arrow, State Node, Layer, Annotation, Reference, Representation.
- Prohibited primitives: unbounded node clouds, transformation arrows implying process instead of ownership.
- Preferred composition: staged ownership regions with controlled transitions across boundaries.
- Preferred hierarchy: boundary and ownership semantics primary; data entities secondary.
- Preferred label style: owner/domain labels plus concise transition labels.
- Common misuse: using responsibility figure to depict runtime computation.
- Example thesis applications: alignment data -> sparse alignment -> object -> representation boundary icon.

## Pattern 8. Comparison Pattern

- Engineering purpose: compare two equivalent concepts without implying transformation.
- Dominant relation: controlled contrast.
- Permitted primitives: Comparison Pair, State Node, Intrinsic Curve, Reference, Annotation, optional Realization Halo where both sides share semantics.
- Prohibited primitives: directional transformation chain between compared items, dependency hierarchy arrows.
- Preferred composition: symmetric side-by-side layout with shared baseline/reference.
- Preferred hierarchy: shared reference first, both compared entities equal visual status.
- Preferred label style: matched concise labels on both sides.
- Common misuse: adding directional arrows that imply causality.
- Example thesis applications: target vs realized comparison when framed as contrast rather than process.

## Pattern 9. Layer Pattern

- Engineering purpose: illustrate layered engineering semantics and stratum boundaries.
- Dominant relation: vertical or ordered layering.
- Permitted primitives: Layer, Dependency Arrow, State Node, Boundary, Scope, Annotation, Reference, Representation.
- Prohibited primitives: loop closure edges, dense local-frame geometry unless layer relation depends on it.
- Preferred composition: stacked layers with sparse cross-layer relations.
- Preferred hierarchy: canonical layer strongest, derived layers progressively lighter.
- Preferred label style: concise layer titles.
- Common misuse: mixing layer semantics with process flow semantics.
- Example thesis applications: identity -> state -> realization -> representation ordering in foundations.

## Pattern 10. Network Pattern

- Engineering purpose: illustrate relations without implying ownership.
- Dominant relation: relational connectivity.
- Permitted primitives: State Node, Attachment, optional unlabeled neutral connectors, Annotation, Reference, Scope.
- Prohibited primitives: Dependency Arrow or Transformation Arrow when relation is non-hierarchical and non-causal.
- Preferred composition: sparse network with one highlighted focal node.
- Preferred hierarchy: focal node first; neighboring relations secondary.
- Preferred label style: relation type labels only where ambiguity exists.
- Common misuse: accidental reading as dependency graph due to directional arrows.
- Example thesis applications: non-hierarchical concept neighborhood maps in introductory synthesis.

## Pattern 11. Cycle Pattern

- Engineering purpose: illustrate iterative engineering evaluation.
- Dominant relation: closed refinement cycle.
- Permitted primitives: State Node, Operator, Transformation Arrow, Attachment, Annotation, Reference, Scope.
- Prohibited primitives: dependency-only chains, multiple nested cycles in one figure.
- Preferred composition: Parameters -> Evaluation -> Residual -> Updated Parameters loop.
- Preferred hierarchy: cycle path dominant; node details subordinate.
- Preferred label style: stage names and one concise cycle purpose label.
- Common misuse: converting cycle into implementation-level algorithm chart.
- Example thesis applications: optimization chapter icon and evaluation loop figures.

## Pattern 12. Cover Pattern

- Engineering purpose: define title-page visual identity reserved for cover use.
- Dominant relation: intrinsic organization and progression with no textual explanation.
- Permitted primitives: Intrinsic Curve, Station Marker, State Node, Local Frame, Attachment, optional subtle Realization Halo.
- Prohibited primitives: labels, annotations, references, literal railway imagery, software motifs, dependency chains.
- Preferred composition: one central intrinsic curve with sparse progression cues and strong negative space.
- Preferred hierarchy: intrinsic curve overwhelmingly dominant; all other cues minimal.
- Preferred label style: none.
- Common misuse: converting cover into chapter summary diagram.
- Example thesis applications: title-page identity only.

## Cross-Pattern Rules

### Pattern selection rules

- Use Concept Pattern when introducing one concept, not process or hierarchy.
- Use Dependency Pattern for prerequisite/ownership order.
- Use Transformation Pattern for directed semantic change.
- Use State Pattern for state-to-state semantics.
- Use Operator Pattern when operator mediation is the core message.
- Use Realization Pattern for target-realized-observed layering.
- Use Responsibility Pattern for ownership/boundary transitions.
- Use Comparison Pattern for symmetric contrast without causality.
- Use Layer Pattern for semantic strata.
- Use Network Pattern for non-hierarchical relations.
- Use Cycle Pattern for iterative refinement.
- Use Cover Pattern only for title-page identity.

### Forbidden pattern mixing

- Dependency + Transformation as co-dominant relations in one figure.
- Comparison + Transformation in one primary axis.
- Responsibility + Operator loops in one undifferentiated composition.
- Layer + Cycle as equal top-level messages in one figure.

### Maximum semantic load

- One dominant relation per figure.
- One visual center per figure.
- At most one secondary relation, and only if it supports the dominant relation without changing figure class.

### Transition rules between patterns

- A Concept figure may evolve into Dependency, State, or Layer figures in subsequent explanations.
- A Transformation figure may be followed by Operator or Realization figure to unpack consequences.
- A Responsibility figure may be followed by Applications-layer figures for downstream systems.
- A Cover pattern never transitions within the same figure; it is standalone identity.

### Expected reader interpretation

- Figure class should be inferable in under a few seconds from structure alone.
- Directional arrows imply either dependency or transformation, never both.
- Visual hierarchy should mirror engineering hierarchy, not decorative preference.

## Validation Against Existing AIM Visual Assets

### Chapter Icons to Pattern Mapping

1. Introduction icon -> Concept Pattern.
2. Foundations icon -> Dependency Pattern (with Layer semantics).
3. Geometry icon -> Transformation Pattern.
4. State icon -> State Pattern.
5. Runtime icon -> Operator Pattern.
6. Reality icon -> Realization Pattern.
7. Optimization icon -> Cycle Pattern.
8. Modeling icon -> Transformation Pattern (constructive aggregation).
9. Applications icon -> Responsibility Pattern.
10. Outlook icon -> Dependency Pattern.

Result: every chapter icon maps to exactly one canonical pattern.

### Pilot Figures to Pattern Mapping

1. Intrinsic Curve concept figure -> Concept Pattern.
2. Curvature -> pose2 -> Transformation Pattern.
3. pose2 -> pose3 -> State Pattern.
4. Metric realization -> runtime evaluation -> representation -> Operator Pattern.
5. Target -> realized -> observed -> Realization Pattern.
6. Knowledge -> decision -> transformation -> history -> Dependency Pattern.
7. AlignmentData -> SparseAlignment -> SpotObject -> Representation -> Responsibility Pattern.
8. Cover prototype -> Cover Pattern.

Result: every pilot figure maps to exactly one canonical pattern.

### Completeness Check

- Additional pattern class required: none.
- Every current thesis figure intent can be assigned to one pattern.
- Pattern library remains finite and internally consistent.

## Library Stability Statement

The AIM Figure Pattern Library is complete for current thesis scope.
All future thesis illustrations should be classified into one of the 12 patterns before design execution.
