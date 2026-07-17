# AIM Supporting Figure Set

This document defines the first complete supporting-figure pass for AIM.
Each supporting figure is an explanatory lemma for one conceptual obstacle and supports, but does not replace, a canonical Chapter Icon.

Scope note:

- No artwork.
- No TikZ/SVG generation.
- No new primitives.
- No new figure patterns.

## Family 1 - Comparison Figures (Comparison Pattern)

### F1.1 pose2 vs pose3

- Engineering question answered: Why is pose3 an extension of pose2 instead of a replacement?
- Dominant relation: controlled contrast of intrinsic versus extended state.
- Visual center: symmetric Comparison Pair anchored to shared station reference.
- Figure pattern: Comparison Pattern.
- Primitives used: Comparison Pair, State Node, Intrinsic Curve, Station Marker, Local Frame, Reference, Annotation.
- Composition: left side pose2 on intrinsic curve; right side pose3 with additional frame context; no directional arrow between sides.
- Visual hierarchy: shared reference first; both compared states equal; extension cues secondary.
- Prohibited additions: transformation arrows, operator blocks, realization halos.
- Intended thesis location: State part near pose2/pose3 relation section.
- Relationship to corresponding Chapter Icon: supports [docs/thesis/AIM/figures/state/icon_state_pose2_pose3.tex](docs/thesis/AIM/figures/state/icon_state_pose2_pose3.tex) by removing ambiguity between extension and replacement.
- Didactic review: Keep (text alone commonly blurs the distinction between intrinsic and extended state).

### F1.2 Target vs Realized

- Engineering question answered: How does realized geometry differ from target semantics without invalidating target identity?
- Dominant relation: controlled contrast under shared reference.
- Visual center: paired target/realized states with shared baseline.
- Figure pattern: Comparison Pattern.
- Primitives used: Comparison Pair, State Node, Intrinsic Curve, Realization Halo, Reference, Annotation.
- Composition: target and realized shown side by side with shared canonical anchor; no process chain.
- Visual hierarchy: target and realized balanced; halo cue secondary.
- Prohibited additions: observed layer, assessment operator, directional transformation between compared sides.
- Intended thesis location: Reality part in realized-pose comparison chapter.
- Relationship to corresponding Chapter Icon: supports [docs/thesis/AIM/figures/reality/icon_reality_target_realized_observed.tex](docs/thesis/AIM/figures/reality/icon_reality_target_realized_observed.tex) by isolating the comparison sub-question.
- Didactic review: Keep (readers frequently conflate comparison with realization pipeline).

### F1.3 Canonical Engineering Information vs Representation

- Engineering question answered: Why is representation downstream and not concept ownership?
- Dominant relation: conceptual contrast between canonical semantics and representational form.
- Visual center: symmetric pair with boundary marker for representational side.
- Figure pattern: Comparison Pattern.
- Primitives used: Comparison Pair, State Node, Representation, Boundary, Layer, Reference, Annotation.
- Composition: canonical side and representation side in parallel with shared semantic anchor.
- Visual hierarchy: canonical side slightly stronger; representation visibly secondary.
- Prohibited additions: dependency/flow arrows that imply process.
- Intended thesis location: Applications part near interoperability boundary discussion.
- Relationship to corresponding Chapter Icon: supports [docs/thesis/AIM/figures/applications/icon_applications_downstream.tex](docs/thesis/AIM/figures/applications/icon_applications_downstream.tex) by clarifying distinction before downstream chain interpretation.
- Didactic review: Keep (core obstacle in downstream-interoperability reading).

### F1.4 Native Alignment vs Imported Alignment

- Engineering question answered: How is imported alignment interpreted relative to native canonical semantics?
- Dominant relation: contrast under common canonical frame.
- Visual center: native/imported pair tied to shared reference baseline.
- Figure pattern: Comparison Pattern.
- Primitives used: Comparison Pair, State Node, Intrinsic Curve, Representation, Boundary, Reference, Annotation.
- Composition: native and imported presented as comparable states with explicit boundary cue for import pathway.
- Visual hierarchy: shared canonical anchor first; imported side marked as secondary context.
- Prohibited additions: transformation or responsibility chain in same figure.
- Intended thesis location: Applications or modeling interoperability sections.
- Relationship to corresponding Chapter Icon: supports [docs/thesis/AIM/figures/applications/icon_applications_downstream.tex](docs/thesis/AIM/figures/applications/icon_applications_downstream.tex).
- Didactic review: Keep (important to prevent false equivalence between import format and canonical meaning).

## Family 2 - Responsibility Figures (Responsibility Pattern)

### F2.1 AlignmentData -> SparseAlignment -> SpotObject

- Engineering question answered: Which layer owns which transformation in data-to-model progression?
- Dominant relation: bounded ownership transitions.
- Visual center: boundary transitions across staged responsibility regions.
- Figure pattern: Responsibility Pattern.
- Primitives used: Boundary, Scope, Dependency Arrow, State Node, Annotation, Reference.
- Composition: three staged nodes in ownership zones with boundary-crossing transitions.
- Visual hierarchy: boundaries primary; entities secondary.
- Prohibited additions: operator loops, comparison symmetry, realization halos.
- Intended thesis location: Modeling part near sparse model responsibilities.
- Relationship to corresponding Chapter Icon: supports [docs/thesis/AIM/figures/modeling/icon_modeling_constructive_sparse.tex](docs/thesis/AIM/figures/modeling/icon_modeling_constructive_sparse.tex) by adding ownership detail.
- Didactic review: Keep (text tends to collapse ownership into one implicit step).

### F2.2 Runtime -> Representation

- Engineering question answered: Where does runtime responsibility end and representation responsibility begin?
- Dominant relation: responsibility boundary handoff.
- Visual center: handoff boundary.
- Figure pattern: Responsibility Pattern.
- Primitives used: Boundary, Scope, Dependency Arrow, State Node, Representation, Layer, Annotation, Reference.
- Composition: runtime region feeding representation region across one explicit boundary.
- Visual hierarchy: boundary/handoff primary, regions secondary.
- Prohibited additions: operator internals, realization overlays.
- Intended thesis location: Runtime chapter at representation boundary subsection.
- Relationship to corresponding Chapter Icon: supports [docs/thesis/AIM/figures/runtime/icon_runtime_operator_chain.tex](docs/thesis/AIM/figures/runtime/icon_runtime_operator_chain.tex) by clarifying responsibility separation.
- Didactic review: Keep (common confusion around runtime outputs vs representational ownership).

### F2.3 Projection -> View

- Engineering question answered: Why is projection not identical to final view semantics?
- Dominant relation: ownership distinction between projection stage and view stage.
- Visual center: boundary between projection and view scopes.
- Figure pattern: Responsibility Pattern.
- Primitives used: Boundary, Scope, Dependency Arrow, State Node, Annotation, Reference.
- Composition: projection scope transitions into view scope with one directed ownership relation.
- Visual hierarchy: scope boundary first, stage nodes second.
- Prohibited additions: transformation/algorithm detail.
- Intended thesis location: Applications/representation discussion where view generation is described.
- Relationship to corresponding Chapter Icon: supports [docs/thesis/AIM/figures/applications/icon_applications_downstream.tex](docs/thesis/AIM/figures/applications/icon_applications_downstream.tex).
- Didactic review: Keep (high-value disambiguation for representation pipeline reading).

## Family 3 - Dependency Figures (Dependency Pattern)

### F3.1 Identity -> State -> Runtime

- Engineering question answered: What is the prerequisite order from canonical identity to runtime interpretation?
- Dominant relation: acyclic semantic dependency.
- Visual center: dependency spine.
- Figure pattern: Dependency Pattern.
- Primitives used: Dependency Arrow, State Node, Layer, Annotation, Reference.
- Composition: vertical dependency chain with no cycles.
- Visual hierarchy: upstream identity strongest; runtime downstream and lighter.
- Prohibited additions: operators, transformation arrows, comparison symmetry.
- Intended thesis location: Foundations-to-state transition context.
- Relationship to corresponding Chapter Icon: bridges [docs/thesis/AIM/figures/foundations/icon_foundations_dependency.tex](docs/thesis/AIM/figures/foundations/icon_foundations_dependency.tex) and [docs/thesis/AIM/figures/runtime/icon_runtime_operator_chain.tex](docs/thesis/AIM/figures/runtime/icon_runtime_operator_chain.tex).
- Didactic review: Keep (dependency order is frequently misread as interchangeable).

### F3.2 Knowledge -> Decision -> Transformation

- Engineering question answered: How does decision-making depend on prior knowledge before transformation is justified?
- Dominant relation: decision dependency chain.
- Visual center: decision node in prerequisite sequence.
- Figure pattern: Dependency Pattern.
- Primitives used: Dependency Arrow, State Node, Scope, Annotation, Reference.
- Composition: three-node dependency chain with decision as middle dependency gate.
- Visual hierarchy: knowledge source first; transformation terminal.
- Prohibited additions: iterative cycle closure, process operators.
- Intended thesis location: Analysis/discussion sections on decision semantics.
- Relationship to corresponding Chapter Icon: supports [docs/thesis/AIM/figures/overview/icon_outlook_established_frontier.tex](docs/thesis/AIM/figures/overview/icon_outlook_established_frontier.tex) by clarifying knowledge-forward continuity.
- Didactic review: Keep (eliminates ambiguity between dependency and execution order).

### F3.3 Constructive Geometry -> Realization -> Observation

- Engineering question answered: Why does observation depend on realized outcome, which depends on constructive geometry?
- Dominant relation: layered dependency from design semantics to evidence.
- Visual center: three-level dependency chain.
- Figure pattern: Dependency Pattern.
- Primitives used: Dependency Arrow, State Node, Layer, Annotation, Reference.
- Composition: ordered chain from constructive geometry through realization to observation.
- Visual hierarchy: constructive source dominant; observation tertiary.
- Prohibited additions: realization halos (reserved for Realization Pattern), operator chains.
- Intended thesis location: Reality part, before target-realized-observed details.
- Relationship to corresponding Chapter Icon: supports [docs/thesis/AIM/figures/reality/icon_reality_target_realized_observed.tex](docs/thesis/AIM/figures/reality/icon_reality_target_realized_observed.tex) by preconditioning dependency logic.
- Didactic review: Keep (prevents frequent inversion of evidence and semantics).

## Family 4 - Operator Figures (Operator Pattern)

### F4.1 world -> track

- Engineering question answered: How is world-coordinate information mapped into track-relative interpretation?
- Dominant relation: operator-mediated mapping to track frame.
- Visual center: mapping operator block.
- Figure pattern: Operator Pattern.
- Primitives used: Operator, Transformation Arrow, State Node, Local Frame, Annotation, Reference.
- Composition: world input state -> mapping operator -> track output state.
- Visual hierarchy: operator central; track output highlighted as target context.
- Prohibited additions: dependency-only arrows, realization/observation layers.
- Intended thesis location: world-to-track chapter in State/Reality interface.
- Relationship to corresponding Chapter Icon: supports [docs/thesis/AIM/figures/runtime/icon_runtime_operator_chain.tex](docs/thesis/AIM/figures/runtime/icon_runtime_operator_chain.tex) for specific operator semantics.
- Didactic review: Keep (major recurring conceptual hurdle in coordinate interpretation).

### F4.2 track -> world

- Engineering question answered: How is track-relative state projected back to world coordinates?
- Dominant relation: inverse-direction operator mapping.
- Visual center: projection operator block.
- Figure pattern: Operator Pattern.
- Primitives used: Operator, Transformation Arrow, State Node, Local Frame, Annotation, Reference.
- Composition: track input state -> projection operator -> world output state.
- Visual hierarchy: operator central; world output as mapped result.
- Prohibited additions: mixed bidirectional mapping in one figure.
- Intended thesis location: runtime/reality projection service discussion.
- Relationship to corresponding Chapter Icon: complements [docs/thesis/AIM/figures/runtime/icon_runtime_operator_chain.tex](docs/thesis/AIM/figures/runtime/icon_runtime_operator_chain.tex) with inverse mapping specificity.
- Didactic review: Keep (paired with world->track to prevent directional confusion).

### F4.3 Metric Realization -> Runtime Evaluation -> Representation

- Engineering question answered: How do realization and runtime operators feed representation without transferring concept ownership?
- Dominant relation: operator chain with downstream representational output.
- Visual center: runtime evaluation operator in chain.
- Figure pattern: Operator Pattern.
- Primitives used: Operator, Transformation Arrow, State Node, Layer, Representation, Annotation, Reference.
- Composition: metric realization operator -> runtime evaluation operator -> secondary representation output.
- Visual hierarchy: operator chain first; representation branch secondary.
- Prohibited additions: ownership boundary semantics (Responsibility Pattern), symmetric comparison.
- Intended thesis location: Runtime services chapter.
- Relationship to corresponding Chapter Icon: directly elaborates [docs/thesis/AIM/figures/runtime/icon_runtime_operator_chain.tex](docs/thesis/AIM/figures/runtime/icon_runtime_operator_chain.tex).
- Didactic review: Keep (critical for canonical-versus-representation boundary comprehension).

## Family 5 - Realization Figures (Realization Pattern)

### F5.1 Design -> Construction -> Reality

- Engineering question answered: How does design semantics propagate through construction into realized reality?
- Dominant relation: realization pipeline anchored in design target.
- Visual center: construction-to-reality realization step.
- Figure pattern: Realization Pattern.
- Primitives used: State Node, Transformation Arrow, Realization Halo, Annotation, Reference.
- Composition: design target -> construction stage -> realized reality state with realization cue.
- Visual hierarchy: design target first, realized outcome second.
- Prohibited additions: observation layer (reserved for separate figure), operator-loop detail.
- Intended thesis location: construction-and-realization chapter.
- Relationship to corresponding Chapter Icon: supports [docs/thesis/AIM/figures/reality/icon_reality_target_realized_observed.tex](docs/thesis/AIM/figures/reality/icon_reality_target_realized_observed.tex) by isolating realization path.
- Didactic review: Keep (separates realization from observation in reader mental model).

### F5.2 Target -> Observed -> Assessment

- Engineering question answered: How does observed evidence feed assessment relative to target semantics?
- Dominant relation: observation-to-assessment relation with target anchor.
- Visual center: observed layer as intermediary evidence node.
- Figure pattern: Realization Pattern.
- Primitives used: State Node, Transformation Arrow, Observation Halo, Realization Halo, Annotation, Reference.
- Composition: target anchor, observed layer, assessment outcome with explicit evidence mediation.
- Visual hierarchy: target anchor strongest; observed intermediary secondary; assessment tertiary.
- Prohibited additions: comparison symmetry, full operator chains.
- Intended thesis location: reality data/measurement chapters.
- Relationship to corresponding Chapter Icon: supports [docs/thesis/AIM/figures/reality/icon_reality_target_realized_observed.tex](docs/thesis/AIM/figures/reality/icon_reality_target_realized_observed.tex) by detailing observation and assessment semantics.
- Didactic review: Keep (core obstacle: confusing measured evidence with design truth).

## Global Consistency Review

- Every supporting figure belongs to exactly one Figure Pattern: satisfied.
- Every supporting figure supports exactly one Chapter Icon: satisfied.
- No supporting figure duplicates a Chapter Icon: satisfied (all are narrower explanatory lemmas).
- No supporting figure duplicates another supporting figure: satisfied (distinct engineering question per figure).
- Complete system remains visually minimal: satisfied.

## Supporting Set Validation Outcome

- Total supporting figures specified: 15.
- Rejected by didactic review: 0.
- Kept by didactic review: 15.

Rationale:

- Each figure addresses a specific conceptual obstacle that surrounding text alone does not reliably remove.
- No decorative-only figure is included.

## Readiness Statement

This supporting-figure set is sufficient for the first supporting illustration execution pass under the existing AIM visual language and pattern system.
