# AIM Visual Primitive Library

## 1. Purpose

The AIM Visual Primitive Library defines a finite graphical alphabet for thesis figures.
Its role is equivalent to mathematical symbols in equations: stable meaning, reusable form, and consistent interpretation.

The objective is visual notation, not illustration.
Figures built from this library should communicate engineering semantics directly and reproducibly across chapters.

## 2. Design Principles

The primitive library is governed by the following constraints:

- Minimal: only primitives with indispensable semantic roles are included.
- Orthogonal: each primitive has one primary meaning and no redundant overlap.
- Reusable: the same primitive can be recomposed across different figure families.
- Implementation-independent: semantics are defined independently of drawing tool.
- Visually consistent: identical semantics map to identical visual behavior.
- Semantically stable: primitive meaning does not drift across chapters.

Primary rule:

- One primitive, one primary engineering meaning.

## 3. Primitive Catalogue

For each primitive: canonical meaning, graphical role, visual appearance, permitted uses, prohibited uses, and typical combinations.

### 3.1 Intrinsic Curve

- Canonical meaning: alignment identity and station-progressive intrinsic geometry.
- Graphical role: primary carrier of geometric continuity.
- Visual appearance: continuous primary stroke.
- Permitted uses: central path in geometry/state/runtime/reality context.
- Prohibited uses: decorative path, uncertainty band, UI motif.
- Typical combinations: Station Marker, Tangent, Normal, Local Frame, State Node, Attachment.

### 3.2 Station Marker

- Canonical meaning: localized station position along intrinsic progression.
- Graphical role: indexing anchor.
- Visual appearance: small point/tick marker on or tied to Intrinsic Curve.
- Permitted uses: sampled states, measurement locations, comparison anchors.
- Prohibited uses: free-floating concept node detached from station context.
- Typical combinations: Intrinsic Curve, State Node, Local Frame, Annotation, Reference.

### 3.3 State Node

- Canonical meaning: engineering state at a station or station interval.
- Graphical role: semantic state anchor.
- Visual appearance: compact node shape, visually subordinate to curve unless state-focused figure.
- Permitted uses: pose2, pose3, runtime state, realized state.
- Prohibited uses: generic unlabeled container unrelated to state semantics.
- Typical combinations: Station Marker, Transformation Arrow, Operator, Observation Halo, Realization Halo.

### 3.4 Tangent

- Canonical meaning: local directional orientation of intrinsic geometry.
- Graphical role: directional local cue.
- Visual appearance: short oriented line segment attached at station.
- Permitted uses: frame-based geometric interpretation.
- Prohibited uses: global axis substitute.
- Typical combinations: Station Marker, Normal, Local Frame, Intrinsic Curve.

### 3.5 Normal

- Canonical meaning: local normal orientation associated with intrinsic geometry.
- Graphical role: orthogonal local cue.
- Visual appearance: short line segment orthogonal to Tangent at station.
- Permitted uses: frame interpretation and geometric state explanation.
- Prohibited uses: arbitrary decorative cross-mark.
- Typical combinations: Tangent, Local Frame, Station Marker.

### 3.6 Local Frame

- Canonical meaning: local coordinate/frame context for interpretation.
- Graphical role: grouped orientation primitive at station.
- Visual appearance: minimal frame indicator built from Tangent and Normal.
- Permitted uses: pose interpretation, transformation context.
- Prohibited uses: full global coordinate system replacement unless explicitly global.
- Typical combinations: Station Marker, State Node, Transformation Arrow, Annotation.

### 3.7 Operator

- Canonical meaning: rule-governed transformation/evaluation service.
- Graphical role: active transformation block.
- Visual appearance: enclosed node (typically rounded container).
- Permitted uses: runtime evaluation, mapping, projection, realization operator roles.
- Prohibited uses: passive taxonomy group or chapter box.
- Typical combinations: State Node, Transformation Arrow, Dependency Arrow, Boundary.

### 3.8 Transformation Arrow

- Canonical meaning: directed transformation from source to target semantics.
- Graphical role: causal/semantic direction carrier.
- Visual appearance: directed arrow with clear head.
- Permitted uses: curvature-to-pose2, pose2-to-pose3, operator input-output flow.
- Prohibited uses: undirected relation or vague association.
- Typical combinations: Operator, State Node, Layer, Representation.

### 3.9 Dependency Arrow

- Canonical meaning: prerequisite/ownership dependency.
- Graphical role: dependency relation carrier.
- Visual appearance: directed connector visually distinct from Transformation Arrow by context/weight/labeling convention.
- Permitted uses: concept ordering, chapter/part dependency, ownership chains.
- Prohibited uses: physical or temporal process depiction unless explicitly dependency-focused.
- Typical combinations: Layer, Boundary, Scope, Reference.

### 3.10 Attachment

- Canonical meaning: semantic attachment to canonical object.
- Graphical role: non-transformative linkage.
- Visual appearance: thin connector line.
- Permitted uses: constraints, interpretations, contextual qualifiers attached to state/curve.
- Prohibited uses: transformation path, process pipeline edge.
- Typical combinations: Intrinsic Curve, State Node, Annotation, Scope.

### 3.11 Layer

- Canonical meaning: conceptual stratum with explicit role.
- Graphical role: ordered semantic band.
- Visual appearance: stacked/ordered region or aligned tier.
- Permitted uses: canonical vs derived, state/runtime/reality organization.
- Prohibited uses: arbitrary grouping without semantic hierarchy.
- Typical combinations: Dependency Arrow, Boundary, Scope, Representation.

### 3.12 Realization Halo

- Canonical meaning: realized physical manifestation relative to target semantics.
- Graphical role: realization envelope/overlay around canonical object.
- Visual appearance: secondary envelope or offset contour around/near target state/path.
- Permitted uses: target-realized relation depiction.
- Prohibited uses: replacement of canonical target identity.
- Typical combinations: State Node, Intrinsic Curve, Comparison Pair, Observation Halo.

### 3.13 Observation Halo

- Canonical meaning: measured/observed evidence around engineering object.
- Graphical role: observation context marker.
- Visual appearance: halo/secondary marker, visually lighter than canonical object.
- Permitted uses: measurement coupling and data interpretation figures.
- Prohibited uses: canonical state identity encoding.
- Typical combinations: State Node, Realization Halo, Annotation, Reference.

### 3.14 Representation

- Canonical meaning: downstream representational/exchange form.
- Graphical role: secondary branch/output object.
- Visual appearance: offset branch element, visually subordinate.
- Permitted uses: BIM/GIS/export/reporting downstream depiction.
- Prohibited uses: canonical concept ownership.
- Typical combinations: Transformation Arrow, Operator, Layer, Boundary.

### 3.15 Comparison Pair

- Canonical meaning: controlled contrast of two comparable entities under shared reference.
- Graphical role: paired composition skeleton.
- Visual appearance: symmetric side-by-side arrangement with common baseline/reference.
- Permitted uses: target vs realized, method A vs method B.
- Prohibited uses: unrelated examples placed together.
- Typical combinations: State Node, Intrinsic Curve, Realization Halo, Reference.

### 3.16 Boundary

- Canonical meaning: conceptual or responsibility boundary.
- Graphical role: enclosure indicating ownership/scope separation.
- Visual appearance: thin enclosing contour.
- Permitted uses: chapter responsibility and concept ownership figures.
- Prohibited uses: decorative framing.
- Typical combinations: Layer, Scope, Dependency Arrow, Operator.

### 3.17 Scope

- Canonical meaning: explicitly addressed domain subset in figure context.
- Graphical role: scoped region or tagged zone.
- Visual appearance: subtle bounded region or label-linked extent.
- Permitted uses: distinguish included vs external concerns.
- Prohibited uses: hierarchy replacement for Layer.
- Typical combinations: Boundary, Annotation, Reference, Dependency Arrow.

### 3.18 Annotation

- Canonical meaning: concise semantic clarifier.
- Graphical role: controlled textual cue.
- Visual appearance: short label near anchored primitive.
- Permitted uses: symbols, short noun phrases, operator names.
- Prohibited uses: explanatory paragraph text in-figure.
- Typical combinations: Station Marker, State Node, Operator, Reference.

### 3.19 Reference

- Canonical meaning: pointer to equation/definition/chapter concept anchor.
- Graphical role: cross-link indicator.
- Visual appearance: compact reference tag near related primitive.
- Permitted uses: tie figure semantics to formal manuscript anchors.
- Prohibited uses: external bibliography replacement or caption duplication.
- Typical combinations: Annotation, State Node, Operator, Dependency Arrow.

## 4. Semantic Rules

Grammar-style combination rules:

- State Node attaches to Station Marker or Intrinsic Curve when station-dependent.
- Tangent and Normal attach only through Station Marker and jointly define Local Frame.
- Operator receives and emits via Transformation Arrow.
- Transformation Arrow must connect semantically typed source and target primitives.
- Dependency Arrow expresses prerequisite/ownership, not state transformation.
- Observation Halo surrounds or neighbors State Node or Intrinsic Curve but never defines identity.
- Realization Halo overlays or offsets canonical target but never replaces it.
- Representation appears downstream of canonical/state/runtime content.
- Attachment links contextual semantics to canonical anchors without implying transformation.
- Comparison Pair requires shared Reference or shared baseline.
- Boundary and Scope constrain interpretation and ownership; they do not transform content.
- Annotation and Reference clarify existing semantics; they do not create new semantics.

Invalid combinations:

- Observation Halo as canonical object.
- Representation as upstream source of canonical definition.
- Dependency Arrow used as transformation flow in process figures.
- Operator without defined input/output relation.

## 5. Appearance Rules

Semantic appearance behavior:

- Canonical: solid, strongest visual priority.
- Derived: dashed or lighter, secondary priority.
- Runtime: lighter than canonical while preserving direct linkage.
- Operator: enclosed transformation block.
- Transformation: directed arrow.
- Dependency: directed connector with dependency semantics.
- Observation: halo-like marker.
- Realization: overlay/offset relation marker.
- Boundary: thin enclosure.
- Scope: subtle bounded extent.
- Comparison: symmetric composition with shared anchor.

Style constraints:

- no exact color dependency for meaning,
- no heavy decorative fill,
- no visual effects that compete with semantic hierarchy,
- no style reuse with conflicting meanings.

## 6. Composition Rules

Complete-figure construction rules:

- One visual center.
- One dominant relation.
- Minimal crossings.
- Consistent attachment anchors.
- No decorative geometry.
- No duplicated semantics through multiple primitives.
- Visual hierarchy follows engineering hierarchy.
- Canonical object must remain visually dominant.
- Secondary context must remain legible but subordinate.
- Labels are concise and anchored; captions carry extended explanation.

Quality checks before figure acceptance:

1. Can the dominant relation be named in one sentence?
2. Is every primitive semantically valid under this library?
3. Is any primitive overloaded with multiple meanings?
4. Would grayscale reproduction preserve semantic hierarchy?

## 7. Primitive Examples

Conceptual (non-drawn) examples for natural chapter use:

- Intrinsic Curve: alignment identity in Geometry and State parts.
- Station Marker: sampled station positions in State and Runtime.
- State Node: pose2/pose3 nodes in State taxonomy figures.
- Tangent: local direction cue in Geometry sketches.
- Normal: orthogonal local cue in frame interpretation sketches.
- Local Frame: runtime/state interpretation in State and Reality.
- Operator: runtime service block in Runtime chapter diagrams.
- Transformation Arrow: curvature-to-pose2 or pose2-to-pose3 transitions.
- Dependency Arrow: chapter/concept ordering in part-intro maps.
- Attachment: engineering constraints attached to canonical state.
- Layer: separation of canonical/derived/runtime/reality contexts.
- Realization Halo: target-realized relation in Reality chapters.
- Observation Halo: measured evidence around realized state.
- Representation: downstream BIM/GIS branch in Applications.
- Comparison Pair: target vs realized comparison in Reality/Applications.
- Boundary: conceptual ownership boundaries in Foundations/Discussion.
- Scope: included-vs-external concern delineation in Discussion.
- Annotation: concise symbol labels in all technical figures.
- Reference: equation/definition pointers in operator/state diagrams.

## 8. Figure Construction Examples

How primitives combine by figure class:

### 8.1 Concept Figure

- Core: Boundary + Scope + central primitive (often Intrinsic Curve or State Node).
- Support: Attachment + minimal Annotation.
- Relation: semantic neighborhood around one concept.

### 8.2 Transformation Figure

- Core: source primitive + Transformation Arrow + target primitive.
- Optional: Operator in between.
- Relation: explicit directional change.

### 8.3 Operator Figure

- Core: input State Node(s) -> Operator -> output State Node(s).
- Support: Reference tags and minimal Layer context.
- Relation: service semantics and interfaces.

### 8.4 Dependency Figure

- Core: Layered or bounded concept nodes linked by Dependency Arrow.
- Support: Boundary/Scope for ownership.
- Relation: prerequisite and responsibility order.

### 8.5 Runtime Figure

- Core: State Node + Operator + Transformation Arrow in evaluation loop/chain.
- Support: Layer (runtime vs canonical), Annotation.
- Relation: runtime evaluation and derived quantity generation.

### 8.6 State Figure

- Core: Intrinsic Curve + Station Marker + State Node + Local Frame.
- Support: Attachment for interpretation qualifiers.
- Relation: station-dependent state semantics.

### 8.7 Realization Figure

- Core: canonical target (Curve/State Node) + Realization Halo + Observation Halo.
- Support: Comparison Pair for target-realized alignment.
- Relation: realized and observed relation to canonical semantics.

### 8.8 Comparison Figure

- Core: Comparison Pair with shared Reference.
- Support: matched primitives in both halves for symmetry.
- Relation: controlled contrast under common frame.

## 9. Evolution Rules

The primitive library evolves like mathematical notation:

- Stability is default.
- Extension is exceptional.

A new primitive is accepted only when all conditions hold:

1. Existing primitives cannot express the intended meaning without ambiguity.
2. The new primitive has a single primary engineering meaning.
3. No semantic overlap exists with current primitives.
4. The new primitive composes with current grammar without contradictions.
5. The library remains minimal after introduction.

Change process:

1. Propose semantic gap.
2. Test candidate with at least two figure families.
3. Verify non-overlap and readability.
4. Add formal primitive definition to this document.
5. Record first canonical usage and rationale.

Rejection criteria:

- cosmetic motivation only,
- chapter-specific one-off style,
- semantic duplication,
- increased ambiguity.

---

This file is the canonical AIM graphical notation manual for primitive-level semantics.
All future figure work should conform to it before implementation-specific drawing decisions are made.
