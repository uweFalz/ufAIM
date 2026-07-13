# AIM Visual Language

## 1. Philosophy

The AIM visual language is a scientific notation system for figures.
It is not an illustration style in the decorative sense.
Its purpose is to make engineering meaning readable at a glance, with the same consistency expected from mathematical notation.

The language is built on five commitments:

- Consistency: the same concept is shown the same way across the manuscript.
- Minimalism: figures include only what is needed for the dominant relation.
- Conceptual clarity: every visual element has a defined semantic role.
- Visual hierarchy: canonical elements dominate derived or contextual elements.
- Engineering semantics: diagrams explain dependency, transformation, and state, not visual effects.

A figure in AIM should behave like an equation:

- compact,
- precise,
- reusable,
- and unambiguous in context.

## 2. Core Design Principles

- One figure. One dominant relation.
- One visual center.
- Minimal labels.
- Canonical before derived.
- Meaning before appearance.
- Consistency before creativity.
- Transformation must be directional.
- Attachment must be explicit.
- Derived context must never overpower canonical identity.
- Every figure must be legible at chapter-overview scale and print scale.

Operational interpretation:

- If a figure has two equally strong messages, split it.
- If labels are needed to explain styling, styling is too complex.
- If decorative detail does not change understanding, remove it.

## 3. Visual Grammar

### 3.1 Intrinsic Curve

- Meaning: canonical alignment identity and intrinsic progression.
- Graphical role: primary geometric carrier.
- Intended usage: base path for state, frame, attachment, and dependency context.
- Must never represent: realized uncertainty cloud, software path, or decorative background stroke.

### 3.2 State

- Meaning: engineering state at station or along station domain.
- Graphical role: localized semantic anchor on or relative to the intrinsic curve.
- Intended usage: pose2, pose3, runtime state, realized state.
- Must never represent: generic data container with no station relation.

### 3.3 Frame

- Meaning: local orientation context for interpretation.
- Graphical role: tangent-normal or local coordinate cue attached to a state point.
- Intended usage: frame-dependent interpretation and transformation context.
- Must never represent: global style ornament or axis grid.

### 3.4 Operator

- Meaning: rule-driven transformation service.
- Graphical role: enclosed transformation node between inputs and outputs.
- Intended usage: runtime evaluation, mapping, projection, realization operators.
- Must never represent: storage, passive classification, or chapter title box.

### 3.5 Transformation

- Meaning: directed change of representation, state, or layer.
- Graphical role: arrow with clear source and target.
- Intended usage: curvature to pose2, pose2 to pose3, target to realized comparison pipeline.
- Must never represent: undirected association.

### 3.6 Layer

- Meaning: conceptual stratum with clear ownership boundary.
- Graphical role: ordered band or stacked region.
- Intended usage: canonical vs derived, state vs runtime vs realization context.
- Must never represent: arbitrary color grouping.

### 3.7 Attachment

- Meaning: semantic dependence on canonical core.
- Graphical role: thin connector from dependent element to canonical anchor.
- Intended usage: constraints, observations, operational interpretation attached to state.
- Must never represent: transformation path.

### 3.8 Observation

- Meaning: measured evidence connected to engineering objects.
- Graphical role: secondary envelope, halo, or observation marker near target object.
- Intended usage: reality coupling and measured-vs-target interpretation.
- Must never represent: canonical identity.

### 3.9 Realization

- Meaning: physical realization outcome relative to target semantics.
- Graphical role: paired or offset state/path with explicit relation to canonical target.
- Intended usage: target-realized comparison and realization-aware dynamics.
- Must never represent: unrelated alternative design branch.

### 3.10 Representation

- Meaning: downstream exchange or display form.
- Graphical role: offset, downstream, visually secondary branch.
- Intended usage: BIM, GIS, export, reporting context.
- Must never represent: canonical concept ownership.

### 3.11 Dependency

- Meaning: conceptual prerequisite relation.
- Graphical role: directed edge in dependency figures.
- Intended usage: part/chapter progression and concept ordering.
- Must never represent: temporal execution unless explicitly intended.

### 3.12 Comparison

- Meaning: controlled contrast of two states/models under shared frame.
- Graphical role: aligned side-by-side composition with common reference.
- Intended usage: target vs realized, model A vs model B.
- Must never represent: independent unrelated examples.

## 4. Visual Syntax

Canonical syntax mapping:

- canonical: solid stroke, normal weight.
- derived: dashed stroke, lighter tone.
- runtime: lighter but direct, still connected to canonical source.
- operator: enclosed node or bounded transformation block.
- transformation: directed arrow.
- observation: halo or observation marker.
- realization: paired/offset counterpart with explicit relation.
- representation: downstream branch, visually secondary.
- dependency: directed connector without geometric embellishment.
- comparison: symmetric layout anchored by shared reference.

Composition rules:

- One dominant visual axis per figure.
- Primary object appears first in reading order.
- Labels are nouns or short noun phrases, not explanatory sentences.
- Arrowheads must always indicate causal or semantic direction.
- Secondary context must remain visually subordinate.

Disallowed syntax patterns:

- mixed meanings for the same line style,
- heavy fills competing with canonical geometry,
- multiple accent colors with no semantic mapping,
- perspective effects that imply physical realism where abstraction is intended.

## 5. Figure Families

### 5.1 Concept Figure

- Purpose: define one concept and its immediate semantic neighborhood.
- Structure: central concept + limited attachments.
- Typical usage: part introductions and foundational chapter anchors.
- Thesis examples: architecture and roadmap figures in foundations.

### 5.2 Dependency Figure

- Purpose: show prerequisite ordering and ownership boundaries.
- Structure: directed acyclic relation or layered stack.
- Typical usage: chapter progression, state taxonomy dependencies.
- Thesis examples: state taxonomy and roadmap-style dependency layouts.

### 5.3 Transformation Figure

- Purpose: show directional concept/state conversion.
- Structure: source -> operator/process -> target.
- Typical usage: curvature-to-pose2, pose2-to-pose3, world-track mapping.
- Thesis examples: transformation pipelines in geometry/runtime/reality sections.

### 5.4 Operator Figure

- Purpose: isolate operator role and interfaces.
- Structure: input ports, enclosed operator, output ports.
- Typical usage: runtime operators and service composition.
- Thesis examples: runtime pipeline and runtime loop diagrams.

### 5.5 State Figure

- Purpose: clarify state classes and interpretation levels.
- Structure: canonical state center + derived states and constraints.
- Typical usage: pose2/pose3 relation, track vs vehicle state.
- Thesis examples: state taxonomy and track-vehicle relation visuals.

### 5.6 Realization Figure

- Purpose: connect target semantics to physical realization and observation.
- Structure: target, realized, measured/observed with explicit relation.
- Typical usage: realization-aware chapters and comparison analysis.
- Thesis examples: realization pipeline and target-vs-realized figures.

### 5.7 Comparison Figure

- Purpose: contrast two alternatives under controlled common frame.
- Structure: paired objects + shared baseline/reference.
- Typical usage: method comparisons, target vs realized state.
- Thesis examples: application/reality comparison compositions.

### 5.8 Responsibility Figure

- Purpose: show conceptual ownership by part/chapter without overlap.
- Structure: bounded regions with directed dependencies.
- Typical usage: chapter responsibility and boundary clarification.
- Thesis examples: architecture overview and part-intro ownership sketches.

### 5.9 Mathematical Sketch

- Purpose: communicate geometric or state intuition without full derivation.
- Structure: sparse geometric primitives tied to notation.
- Typical usage: intrinsic curve, frame, curvature evolution.
- Thesis examples: geometry chapters and state interpretation sketches.

## 6. Chapter Identity

Each major part should have one iconic figure type:

- Introduction: AIM thesis map anchored by one intrinsic curve and layer progression.
- Foundations: system-layer ownership map with canonical core emphasized.
- Geometry: intrinsic curvature-to-trajectory sketch.
- State: pose2 to pose3 state-ladder with runtime extension.
- Runtime: operator loop from state request to evaluated quantity.
- Reality: target-realized-observed relation figure.
- Optimization: closed loop of parameters, evaluation, residuals, update.
- Applications: downstream interoperability and decision-support consequence map.
- Discussion: synthesis map of established scope and boundaries.

Selection rule:

- If a chapter has many figures, one must serve as the chapter icon and all others should use compatible grammar.

## 7. Cover Philosophy

The cover is the visual manifesto of AIM.

Required intent:

- one intrinsic curve as central identity,
- subtle state cues along progression,
- implicit transformation/organization logic,
- timeless abstraction,
- engineering precision without literal railway depiction.

The cover should communicate alignment, state, organization, transformation, and engineering semantics through structure alone.

The cover must avoid:

- literal trains/rails/sleepers,
- aerial or satellite imagery,
- software or CAD aesthetics,
- decorative realism.

## 8. Design Constraints

- Monochrome by default.
- One restrained accent color only when semantically justified.
- Consistent typography across all figure families.
- Thin, stable line-weight hierarchy.
- No decorative gradients.
- No unnecessary shadows.
- No pseudo-3D perspective unless mathematically required.
- No texture overlays.
- Must remain readable in grayscale print.
- Must scale from thumbnail to poster without semantic loss.

## 9. Long-Term Evolution

Evolution rule:

- Extend grammar, do not replace style.

Process for adding future figures:

1. Identify dominant relation.
2. Select figure family.
3. Map entities to existing primitives.
4. Apply canonical syntax.
5. Verify one-center hierarchy.
6. Check compatibility with chapter icon and global thesis identity.

Change-control criteria for introducing any new primitive:

- existing primitives cannot express the meaning without ambiguity,
- new primitive has stable semantics across multiple chapters,
- new primitive does not conflict with established syntax.

Versioning recommendation:

- maintain this document as the single source of truth for AIM visual semantics.
- document each accepted extension with rationale and first usage.

---

## Recommendations for the First Illustration Pass

- Start with one chapter-icon figure per major part before adding secondary figures.
- Prioritize chapters with strongest structural dependencies: Foundations, State, Runtime, Reality.
- Build a reference sheet mapping primitives to visual tokens for all figure authors.
- Review every new figure against Sections 2 to 4 before acceptance.
- Ensure cover concept is finalized first, then align chapter icons to the same grammar.
