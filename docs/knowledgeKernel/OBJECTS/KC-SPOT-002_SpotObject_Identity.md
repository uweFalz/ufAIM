# KC-SPOT-002 SpotObject Identity

## Status

`candidate`

## Canonical Question

What makes an admitted SpotObject remain identifiable as the same engineering object?

## Candidate Canonical Answer

SpotObject Identity is the durable sameness condition by which a SpotObject remains distinguishable across changes of representation, realization, source, runtime, storage, workspace, and project context.

## Normative Meaning

- SpotObject Identity specializes Engineering Object Identity for an object admitted into SPOT.
- The object-level sameness condition and the object-type-specific identity aspects that support it must remain stable when a change is treated as modification rather than replacement.
- Admission, assignment of a locator, or storage of a record may make the object referenceable but does not by itself constitute its complete engineering identity.
- Relations may reference a SpotObject without transferring, merging, or replacing its identity.

## Boundaries

- SpotObject Identity is not a source identifier, import identifier, file identifier, database key, `SpotStore` key, runtime object identity, wrapper identity, workspace identifier, or project-local label.
- It is not a representation identifier, renderer/view-model identifier, CRS identifier, coordinate realization, or derived-geometry identifier.
- Source data, payload, metadata, representation, realization, runtime instances, storage location, workspace state, and project membership may change without replacing the SpotObject when its governed engineering sameness condition is preserved.
- Available evidence does not establish whether SpotObject Identity is universally intrinsic, assigned, or a fixed tuple. It is composed from the stable identity aspects required by the engineering object type; external identifiers may reference it.
- This entry does not invent persistence guarantees or a universal algorithm for deciding modification versus replacement.

## Relations to Other Kernel Concepts

- Specializes [`KC-ID-001 Engineering Object Identity`](../IDENTITY/KC-ID-001_Engineering_Object_Identity.md).
- Applies the object-type-specific composition boundary of [`KC-ID-002 Identity Composition`](../IDENTITY/KC-ID-002_Identity_Composition.md).
- Identifies the admitted object defined by [`KC-SPOT-001 SpotObject`](KC-SPOT-001_SpotObject.md).
- Approved [`FC-001`](../FREEZES/FC-001.md) and [`FC-002`](../FREEZES/FC-002.md) exclude representation and metric realization from Identity.
- SPOT Object Universe and Engineering Relations remain separate Research concepts.

## Consequences for Reference Implementation

- A stable store key may serve as a locator only when its lifecycle and authority are explicit; key equality alone is not proof of engineering sameness.
- Mapping or update operations should preserve identity references while allowing payload, representation, metadata, and derived geometry to change.
- Import and admission code must not assume that a source identifier automatically becomes SpotObject Identity.
- Current preservation of `id`, references, and metadata in `AlignmentSpotObjectMapper` is correspondence evidence, not a canonical persistence contract.

## Consequences for Thesis

- The Thesis should present SpotObject Identity as a specialization of Engineering Object Identity and distinguish it from software keys and contextual identifiers.
- Examples of stable identifiers should be described as references or implementation mechanisms unless a governed identity rule establishes more.
- Modification-versus-replacement must remain an explicit engineering judgment rather than an automatic consequence of equal keys or geometry.

## Evidence and Origin

- Direct Research provenance: [`research/SPOT/KC-SPOT-003 SpotObject Identity`](../research/SPOT/KC-SPOT-003.md).
- General identity provenance: [`KC-FOUND-001 Engineering Object Identity`](../research/FOUNDATIONS/KC-FOUND-001_Engineering_Object_Identity.md) and [`KC-FOUND-002 Identity Composition`](../research/FOUNDATIONS/KC-FOUND-002_Identity_Composition.md).
- Supporting Research boundaries: [`KC-SPOT-005 Representation Independence`](../research/SPOT/KC-SPOT-005.md), [`KC-SPOT-006 Geometry Boundary`](../research/SPOT/KC-SPOT-006.md), and [`KC-SPOT-008 Workspace Boundary`](../research/SPOT/KC-SPOT-008.md). Their Research approval labels are not inherited.
- Draft correspondence: [`SpotObject.md`](../_draft/10-concepts/SpotObject.md).
- RefImpl correspondence: [`AlignmentSpotObjectMapper.js`](../../../src/model/spot/model/AlignmentSpotObjectMapper.js), [`SpotStore.js`](../../../src/model/spot/model/SpotStore.js), and [`getSpotObjectById.js`](../../../src/domain/projection/queries/getSpotObjectById.js).
- Thesis explanation: [`foundations/kernel_glossary.tex`](../../thesis/AIM/foundations/kernel_glossary.tex) and [`modeling/sparse.tex`](../../thesis/AIM/modeling/sparse.tex).

Identifier correspondence: Research `KC-SPOT-003` is direct provenance for active `KC-SPOT-002`. The shifted number is documented provenance, not a Research rename.

## Open Decisions

- The stable identity aspects for each admitted engineering object type remain owned by those object-type concepts; no universal SpotObject identity tuple is approved.
- The authority and criteria for deciding whether a substantive change preserves or replaces a SpotObject require later Governance elaboration.
