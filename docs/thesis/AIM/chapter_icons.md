# AIM Chapter Icon Set

This document defines one canonical chapter icon for each major thesis part.
Each icon is a conceptual specification using only the AIM Visual Primitive Library and AIM Visual Language.

Scope note:

- No artwork.
- No diagram generation.
- No implementation syntax.
- Identity specification only.

## 1. Introduction Icon

- Engineering message: alignment is the organizing center of engineering meaning.
- Dominant relation: semantic attachment of engineering meaning to a single intrinsic center.
- Visual center: one Intrinsic Curve.
- Primitives used: Intrinsic Curve, Station Marker, Attachment, State Node, Annotation, Reference, Scope.
- Composition: a single dominant intrinsic curve with sparse station markers; selected state/meaning nodes attach to the curve without forming independent centers.
- Visual hierarchy: curve first, attached meaning nodes second, annotations last.
- Prohibited additions: parallel competing center curves, operator chains, realization halos, literal infrastructure motifs.
- Expected visual emphasis: canonical centrality of alignment semantics.
- Relationship to cover illustration: direct structural sibling; cover is label-free abstraction of the same organizing principle.

## 2. Foundations Icon

- Engineering message: identity -> state -> realization -> representation as dependency order.
- Dominant relation: canonical dependency cascade.
- Visual center: the ordered dependency spine.
- Primitives used: State Node, Dependency Arrow, Layer, Boundary, Annotation, Reference, Representation.
- Composition: four-level vertical or linear dependency chain with explicit ordering; representation is terminal downstream layer.
- Visual hierarchy: Identity and State strongest; Realization intermediate; Representation visually secondary.
- Prohibited additions: runtime operator loops, cyclic feedback arrows, parallel alternative roots.
- Expected visual emphasis: non-cyclic conceptual dependency.
- Relationship to cover illustration: cover expresses intrinsic identity; foundations icon formalizes dependency strata originating from that identity.

## 3. Geometry Icon

- Engineering message: curvature -> intrinsic curve -> pose2 constructive relation.
- Dominant relation: constructive geometric transformation.
- Visual center: Intrinsic Curve as dominant geometric carrier.
- Primitives used: Intrinsic Curve, State Node, Transformation Arrow, Operator, Station Marker, Tangent, Annotation, Reference.
- Composition: curvature source transforms through constructive operation toward pose2, with the intrinsic curve visually central and persistent.
- Visual hierarchy: intrinsic curve strongest, pose2 next, curvature source and operator secondary.
- Prohibited additions: runtime semantics, realization/observation overlays, representation branches.
- Expected visual emphasis: intrinsic geometry as canonical output of curvature-based construction.
- Relationship to cover illustration: cover hints at intrinsic progression; geometry icon makes construction explicit.

## 4. State Icon

- Engineering message: pose2 -> pose3 as continuous engineering state extension.
- Dominant relation: state extension hierarchy.
- Visual center: pose2 state anchor on intrinsic progression.
- Primitives used: Intrinsic Curve, Station Marker, State Node, Transformation Arrow, Local Frame, Attachment, Annotation, Reference.
- Composition: pose2 anchored to intrinsic curve; directed extension to pose3 with local-frame cue showing spatial extension without replacing base identity.
- Visual hierarchy: pose2 and intrinsic anchor primary; pose3 secondary extension.
- Prohibited additions: motion trajectories implying dynamic simulation, operator loops, realization halos.
- Expected visual emphasis: continuity and extension, not replacement.
- Relationship to cover illustration: cover suggests progression; state icon resolves that progression into pose-level hierarchy.

## 5. Runtime Icon

- Engineering message: engineering information -> operators -> derived runtime state.
- Dominant relation: operator-mediated downstream derivation.
- Visual center: Operator block or operator chain.
- Primitives used: State Node, Operator, Transformation Arrow, Layer, Attachment, Annotation, Reference.
- Composition: canonical engineering information enters operator stage, yielding runtime-derived state in downstream layer.
- Visual hierarchy: canonical information source first, operator stage second, runtime-derived result third.
- Prohibited additions: representation as upstream source, dependency arrows replacing process flow, realization halos.
- Expected visual emphasis: runtime is derived interpretation, not canonical origin.
- Relationship to cover illustration: cover encodes latent progression; runtime icon makes computational derivation explicit.

## 6. Reality Icon

- Engineering message: target -> realized -> observed as dependent layers.
- Dominant relation: realization-observation layering relative to target semantics.
- Visual center: target state anchor.
- Primitives used: State Node, Transformation Arrow, Realization Halo, Observation Halo, Comparison Pair, Annotation, Reference.
- Composition: target state first; realized counterpart offset/paired with realization cue; observed evidence wrapped as observation layer.
- Visual hierarchy: target strongest, realized second, observed halo third.
- Prohibited additions: observation depicted as canonical source, decorative uncertainty textures, operator stacks beyond minimal relation.
- Expected visual emphasis: dependent layering and semantic non-equivalence.
- Relationship to cover illustration: cover suggests canonical object; reality icon shows how physical and observed layers depend on it.

## 7. Optimization Icon

- Engineering message: parameters -> evaluation -> residual -> updated parameters as engineering loop.
- Dominant relation: closed evaluation refinement loop.
- Visual center: residual-evaluation junction in loop.
- Primitives used: State Node, Operator, Transformation Arrow, Attachment, Annotation, Reference, Scope.
- Composition: directional loop with explicit sequence and return edge from residual/update to parameter state.
- Visual hierarchy: loop direction and residual link dominant; individual nodes secondary.
- Prohibited additions: algorithm internals, implementation-specific solver subgraphs, decorative complexity.
- Expected visual emphasis: iterative engineering evaluation, not algorithm branding.
- Relationship to cover illustration: cover conveys canonical organization; optimization icon introduces controlled iterative refinement around that canon.

## 8. Modeling Icon

- Engineering message: constructive elements -> sparse alignment -> engineering model.
- Dominant relation: constructive semantic aggregation.
- Visual center: Sparse Alignment node as synthesis center.
- Primitives used: State Node, Transformation Arrow, Operator, Boundary, Scope, Attachment, Annotation, Reference.
- Composition: constructive element primitives aggregate through constructive operation into sparse alignment, then propagate into engineering model layer.
- Visual hierarchy: sparse alignment synthesis center strongest; input elements and model output subordinate.
- Prohibited additions: dense geometric ornament, runtime loops, external representation branches dominating core relation.
- Expected visual emphasis: constructive semantics and sparse structural composition.
- Relationship to cover illustration: cover provides canonical curve identity; modeling icon shows constructive abstraction built upon it.

## 9. Applications Icon

- Engineering message: canonical engineering meaning -> representations -> external systems.
- Dominant relation: downstream interoperability chain.
- Visual center: transition from canonical meaning to representation boundary.
- Primitives used: State Node, Transformation Arrow, Representation, Boundary, Layer, Dependency Arrow, Annotation, Reference.
- Composition: canonical semantics on primary side; representation branch in secondary layer; external systems beyond boundary.
- Visual hierarchy: canonical meaning primary, representation secondary, external systems tertiary.
- Prohibited additions: external systems depicted as canonical source, reverse arrows implying ownership inversion, runtime/operator overload.
- Expected visual emphasis: strict downstream status of representation and interoperability.
- Relationship to cover illustration: cover communicates internal canonical order; applications icon communicates external projection of that order.

## 10. Outlook Icon

- Engineering message: established knowledge -> research frontier as continuity.
- Dominant relation: forward dependency from stable base to frontier.
- Visual center: boundary between established scope and frontier scope.
- Primitives used: Boundary, Scope, Dependency Arrow, Attachment, Annotation, Reference, State Node.
- Composition: established-knowledge region connected by single forward dependency to frontier region, preserving continuity.
- Visual hierarchy: established base primary, frontier secondary but clearly connected.
- Prohibited additions: discontinuous break imagery, completion/cutoff symbolism, decorative horizon effects.
- Expected visual emphasis: progression without conceptual rupture.
- Relationship to cover illustration: cover encodes timeless canonical core; outlook icon extends that core forward into open but connected frontier.

## Per-Icon Consistency Verification

Every icon in this set satisfies:

- uses only AIM primitives,
- exactly one dominant relation,
- exactly one visual center,
- no semantic duplication,
- canonical-before-derived hierarchy,
- consistency with AIM Visual Language,
- consistency with AIM Visual Primitive Library,
- distinguishable core relation from all other icons.

## Family Consistency Review

Family-level confirmation:

- all icons share one notation system and primitive semantics,
- each icon encodes a different engineering relation,
- no two icons compete for the same visual message,
- progression follows thesis narrative order:
  Introduction -> Foundations -> Geometry -> State -> Runtime -> Reality -> Optimization -> Modeling -> Applications -> Outlook.

Identity cohesion:

- recurring canonical anchor logic,
- controlled downstream semantics,
- strict hierarchy and minimalism,
- stable chapter-to-chapter recognizability.

## Maturity Assessment

The Chapter Icon Set is mature enough to begin the first complete illustration pass.

Recommended first implementation order:

1. Introduction icon (sets family center and cover relation).
2. Foundations icon (dependency backbone).
3. Geometry and State icons (core constructive/state semantics).
4. Runtime and Reality icons (derived and observed layers).
5. Optimization, Modeling, Applications, Outlook icons (extension and boundary system).
