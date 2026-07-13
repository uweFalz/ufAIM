# AIM Pilot Figure Set

This document defines a pilot set of eight conceptual figure specifications to validate the AIM Visual Language and AIM Visual Primitive Library.

Scope note:

- No artwork.
- No diagram generation.
- No implementation notation.
- Primitive-language validation only.

## Figure 1 - Concept Figure: Intrinsic Curve

- Engineering message: the intrinsic curve is the primary carrier of engineering identity.
- Dominant relation: canonical identity organized along intrinsic progression.
- Visual center: one Intrinsic Curve.
- Primitives used: Intrinsic Curve, Station Marker, State Node, Attachment, Annotation, Reference.
- Composition: one central curve with sparse station markers; one state node attached at a representative station; optional lightweight attachment for context.
- Prohibited additions: multiple competing curves, decorative background geometry, realization/observation overlays, literal railway objects.
- Expected visual emphasis: strongest emphasis on the continuous canonical curve; all other primitives subordinate.
- Intended chapter location: Geometry part introduction or first identity-defining section.

Validation:

- One dominant relation: yes.
- One visual center: yes (Intrinsic Curve).
- Primitives only: yes.
- No semantic overlap: yes.
- Canonical-before-derived: yes.
- Consistent with visual language: yes.
- Consistent with primitive library: yes.

## Figure 2 - Transformation Figure: Curvature -> pose2

- Engineering message: curvature drives constructive state evolution toward pose2.
- Dominant relation: directed transformation from curvature law to intrinsic state.
- Visual center: Transformation Arrow chain linking source to target state.
- Primitives used: State Node, Operator, Transformation Arrow, Intrinsic Curve, Reference, Annotation.
- Composition: source state (curvature) -> operator (integration/constructive step) -> target state (pose2), with optional minimal intrinsic-curve cue at output.
- Prohibited additions: dependency arrows replacing transformation arrows, multiple side branches, realization or representation branches.
- Expected visual emphasis: directional constructive flow with clear source and target.
- Intended chapter location: Geometry chapter on curvature-driven reconstruction.

Validation:

- One dominant relation: yes.
- One visual center: yes (transformation chain).
- Primitives only: yes.
- No semantic overlap: yes.
- Canonical-before-derived: yes.
- Consistent with visual language: yes.
- Consistent with primitive library: yes.

## Figure 3 - State Figure: pose2 -> pose3

- Engineering message: pose3 extends pose2 as spatial railway state and does not replace intrinsic identity.
- Dominant relation: state extension hierarchy.
- Visual center: pose2 state node as canonical anchor with directed extension to pose3.
- Primitives used: State Node, Transformation Arrow, Local Frame, Station Marker, Intrinsic Curve, Attachment, Annotation.
- Composition: pose2 node anchored to intrinsic curve; one extension arrow to pose3; local frame indicator attached at station to show spatial interpretation context.
- Prohibited additions: depiction suggesting pose3 is independent canonical root, operator complexity unrelated to extension claim, realization/observation overlays.
- Expected visual emphasis: asymmetry showing pose2 foundational priority and pose3 downstream extension.
- Intended chapter location: State part (pose2/pose3 relation chapter).

Validation:

- One dominant relation: yes.
- One visual center: yes (pose2 anchor).
- Primitives only: yes.
- No semantic overlap: yes.
- Canonical-before-derived: yes.
- Consistent with visual language: yes.
- Consistent with primitive library: yes.

## Figure 4 - Operator Figure: Metric Realization -> Runtime Evaluation -> Representation

- Engineering message: representation is downstream of metric realization and runtime evaluation.
- Dominant relation: operator-mediated downstream interpretation chain.
- Visual center: operator sequence.
- Primitives used: Operator, Transformation Arrow, State Node, Layer, Representation, Annotation, Reference.
- Composition: three-stage linear chain where metric realization and runtime evaluation are operator blocks leading to a secondary representation branch/output.
- Prohibited additions: representation shown as upstream source, dependency arrows used as process flow, symmetric treatment of canonical and representation outputs.
- Expected visual emphasis: strong left-to-right or top-to-bottom process direction with representation visually secondary.
- Intended chapter location: Runtime services or runtime-representation boundary chapter.

Validation:

- One dominant relation: yes.
- One visual center: yes (operator chain).
- Primitives only: yes.
- No semantic overlap: yes.
- Canonical-before-derived: yes.
- Consistent with visual language: yes.
- Consistent with primitive library: yes.

## Figure 5 - Realization Figure: Target -> Realized -> Observed

- Engineering message: realized and observed states are related to but not identical with target semantics.
- Dominant relation: realization-observation relation relative to canonical target.
- Visual center: target state with realization and observation overlays downstream.
- Primitives used: State Node, Transformation Arrow, Realization Halo, Observation Halo, Comparison Pair, Reference, Annotation.
- Composition: canonical target state first; realized counterpart as offset/paired state with realization halo; observed context shown by observation halo around realized/target comparison context.
- Prohibited additions: observation replacing canonical identity, realization depicted as unrelated branch, decorative uncertainty textures.
- Expected visual emphasis: canonical target remains visually strongest; realized/observed remain secondary but explicit.
- Intended chapter location: Reality part, realized-pose comparison chapter.

Validation:

- One dominant relation: yes.
- One visual center: yes (target anchor).
- Primitives only: yes.
- No semantic overlap: yes.
- Canonical-before-derived: yes.
- Consistent with visual language: yes.
- Consistent with primitive library: yes.

## Figure 6 - Dependency Figure: Knowledge -> Decision -> Transformation -> History

- Engineering message: semantic dependency chain from knowledge to historical trace through decisions and transformations.
- Dominant relation: prerequisite dependency ordering.
- Visual center: dependency sequence.
- Primitives used: Dependency Arrow, State Node, Layer, Boundary, Scope, Annotation, Reference.
- Composition: four ordered nodes in a strict acyclic dependency chain; optional boundary/scope enclosure to indicate conceptual domain.
- Prohibited additions: transformation arrows used in place of dependency arrows, bidirectional loops that break dependency semantics, operator blocks unless needed for explicit operator meaning.
- Expected visual emphasis: ordered dependency readability and precedence.
- Intended chapter location: Analysis/discussion dependency narrative or governance-adjacent knowledge flow context.

Validation:

- One dominant relation: yes.
- One visual center: yes (dependency chain).
- Primitives only: yes.
- No semantic overlap: yes.
- Canonical-before-derived: yes.
- Consistent with visual language: yes.
- Consistent with primitive library: yes.

## Figure 7 - Responsibility Figure: AlignmentData -> SparseAlignment -> SpotObject -> Representation

- Engineering message: ownership boundaries and downstream responsibility progression from data to representation.
- Dominant relation: responsibility/ownership transition with downstream representation boundary.
- Visual center: bounded staged chain with explicit boundary semantics.
- Primitives used: Boundary, Scope, Dependency Arrow, State Node, Representation, Layer, Annotation, Reference.
- Composition: staged nodes with boundary regions indicating ownership domains; representation appears in last downstream region as secondary outcome.
- Prohibited additions: representation shown as canonical owner, transformation semantics replacing ownership semantics, unbounded node cloud.
- Expected visual emphasis: boundaries and ownership transitions first; representation clearly downstream.
- Intended chapter location: Applications/interoperability boundary chapter or architecture responsibility overview.

Validation:

- One dominant relation: yes.
- One visual center: yes (responsibility chain within boundaries).
- Primitives only: yes.
- No semantic overlap: yes.
- Canonical-before-derived: yes.
- Consistent with visual language: yes.
- Consistent with primitive library: yes.

## Figure 8 - Cover Prototype (No Text, No Labels)

- Engineering message: intrinsic organization and engineering progression through pure primitive composition.
- Dominant relation: continuous canonical organization around one intrinsic path.
- Visual center: one Intrinsic Curve with sparse station/state progression cues.
- Primitives used: Intrinsic Curve, Station Marker, State Node, Local Frame, Attachment, optional subtle Realization Halo (secondary only).
- Composition: one central intrinsic curve as the dominant object; sparse station progression markers; minimal local frame/state cues along path; no textual annotation.
- Prohibited additions: any literal railway imagery, icons, labels, chapter names, decorative gradients, software-like UI motifs, competing central objects.
- Expected visual emphasis: timeless canonical geometry first; derived semantics suggested only through restrained secondary primitives.
- Intended chapter location: thesis title page identity prototype.

Validation:

- One dominant relation: yes.
- One visual center: yes (single intrinsic curve).
- Primitives only: yes.
- No semantic overlap: yes.
- Canonical-before-derived: yes.
- Consistent with visual language: yes.
- Consistent with primitive library: yes.

## Grammar Validation Outcome

Pilot-set coverage confirms that concept, transformation, state, operator, realization, dependency, responsibility, and cover-identity intents are expressible using existing AIM primitives.

Additional primitives required:

- None.

Justification:

- Every required figure can be composed with existing primitives and current semantic rules without ambiguity.
- No figure required semantic overloading or contradictory style mapping.

## Recommendation

The AIM Visual Language and AIM Visual Primitive Library are expressive enough to begin the first chapter-figure pass.

Suggested first pass order:

1. Foundations icon figure.
2. State icon figure.
3. Runtime operator figure.
4. Reality realization figure.
5. Cover prototype refinement.
