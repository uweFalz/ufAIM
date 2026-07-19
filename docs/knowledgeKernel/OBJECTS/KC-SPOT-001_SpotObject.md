# KC-SPOT-001 SpotObject

## Status

`candidate`

## Canonical Question

What qualifies a durable engineering object to be a SpotObject?

## Candidate Canonical Answer

A SpotObject is a durable, referenceable engineering object admitted into SPOT and capable of participating in explicit engineering relations independently of its representations.

## Normative Meaning

- A SpotObject denotes the engineering object, not the record, file, view, wrapper, or geometry through which it is accessed.
- Admission into SPOT recognizes the object as part of the loaded engineering-object universe; an import candidate is not a SpotObject merely because it is available for review.
- A SpotObject can be the endpoint of explicit engineering relations without those relations collapsing it into another object.
- Information and representations associated with a SpotObject remain distinguishable from the durable object they describe.

## Boundaries

- A SpotObject is not SPOT itself. SPOT is the loaded universe containing admitted objects and their relations; the destination of that separate Research concept remains unresolved.
- It is not an import candidate, source record, workspace item, project file, renderer, view model, runtime wrapper, serialization, or other representation.
- Derived geometry may represent or realize information about a SpotObject but is not the SpotObject.
- This entry does not define admission procedure, persistence technology, relation types, or object-type-specific payload schemas.
- The current `SpotStore` is implementation correspondence only and does not define the canonical concept.

## Relations to Other Kernel Concepts

- [`KC-SPOT-002 SpotObject Identity`](KC-SPOT-002_SpotObject_Identity.md) specializes durable identity for a SpotObject.
- [`KC-ID-001 Engineering Object Identity`](../IDENTITY/KC-ID-001_Engineering_Object_Identity.md) supplies the general identity boundary.
- [`KC-ID-002 Identity Composition`](../IDENTITY/KC-ID-002_Identity_Composition.md) bounds how object-type-specific identity aspects may contribute.
- Approved [`FC-001`](../FREEZES/FC-001.md) requires representation to remain distinct from Identity; approved [`FC-002`](../FREEZES/FC-002.md) requires metric realization to remain distinct from Identity.
- Engineering Relations, Import Boundary, Workspace Boundary, and the SPOT Object Universe remain Research concepts; this entry does not promote them.

## Consequences for Reference Implementation

- Admission code must keep candidate records distinct from admitted SpotObjects.
- Store keys, source aliases, runtime object references, and UI item identifiers may locate a SpotObject but must not silently define its engineering identity.
- Payloads and derived geometry must remain distinguishable from the admitted object and its relation endpoints.
- `SpotStore`, `promoteImportItems`, and the Alignment SpotObject mapper exhibit relevant separation, but their names and current data shapes do not prove Kernel conformance.

## Consequences for Thesis

- The Thesis should explain SpotObject as a durable admitted engineering object and distinguish it from SPOT as a universe, import state, storage records, projects, and representations.
- Implementation-specific object shapes and store behavior should appear as realization examples, not as the definition.

## Evidence and Origin

- Direct Research provenance: [`research/SPOT/KC-SPOT-002 SpotObject`](../research/SPOT/KC-SPOT-002.md).
- Boundary evidence: [`KC-SPOT-001 SPOT Object Universe`](../research/SPOT/KC-SPOT-001.md), [`KC-SPOT-005 Representation Independence`](../research/SPOT/KC-SPOT-005.md), [`KC-SPOT-006 Geometry Boundary`](../research/SPOT/KC-SPOT-006.md), [`KC-SPOT-007 Import Boundary`](../research/SPOT/KC-SPOT-007.md), and [`KC-SPOT-008 Workspace Boundary`](../research/SPOT/KC-SPOT-008.md). Research approval labels are provenance assertions, not active approval.
- Draft correspondence: [`SpotObject.md`](../_draft/10-concepts/SpotObject.md), used as evidence rather than authority.
- RefImpl correspondence: [`SpotStore.js`](../../../src/model/spot/model/SpotStore.js), [`promoteImportItems.js`](../../../src/model/spot/mutate/promoteImportItems.js), [`createAlignmentSpotObject.js`](../../../src/model/spot/model/createAlignmentSpotObject.js), and [`AlignmentSpotObjectMapper.js`](../../../src/model/spot/model/AlignmentSpotObjectMapper.js).
- Thesis explanation: [`foundations/kernel_glossary.tex`](../../thesis/AIM/foundations/kernel_glossary.tex) and [`modeling/sparse.tex`](../../thesis/AIM/modeling/sparse.tex).

Identifier correspondence: Research `KC-SPOT-002` is direct provenance for active `KC-SPOT-001`. Research `KC-SPOT-001` is a separate SPOT Object Universe concept and is not treated as equivalent.

## Open Decisions

- `K2-SPOT-001`: The active canonical destination and identifier for the distinct SPOT Object Universe concept are unresolved. Options are to promote it in a later authorized package, retain it as Research evidence, or reject it through Governance review. This candidate recommends later independent review and does not create that concept.
- Admission criteria and the governed transition from candidate information to an admitted SpotObject require a separately owned concept or decision; this entry states only the resulting boundary.
