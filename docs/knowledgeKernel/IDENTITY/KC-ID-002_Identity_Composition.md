# KC-ID-002 Identity Composition

## Status

`candidate`

## Canonical Question

Is Engineering Object Identity monolithic, or is it formed from multiple identity aspects?

## Candidate Canonical Answer

Engineering Object Identity is the coherent composition of the stable identity aspects and canonical relations required to distinguish an object; no single representation-dependent attribute constitutes that identity.

## Normative Meaning

- Identity may comprise multiple aspects whose relevance and combination depend on the engineering object type.
- Composition preserves the distinction between the object and each aspect that helps distinguish it.
- The whole identity cannot be reduced automatically to one key, geometry, representation, or contextual attribute.
- Composition must be explicit enough to support consistent identity judgments across change and exchange.

## Boundaries

- Identity Composition is not aggregation of every attribute owned by an object.
- It does not make representation, realization, workflow, project context, or provenance universally constitutive of identity.
- It does not prescribe a universal tuple or implementation schema for all engineering objects.
- Relations may contribute to distinguishability without merging the identities of related objects.

## Relations to Other Kernel Concepts

- Composes the durable distinguishability defined by [`KC-ID-001 Engineering Object Identity`](KC-ID-001_Engineering_Object_Identity.md).
- May include [`KC-ID-003 Constructive Identity`](KC-ID-003_Constructive_Identity.md) where intrinsic construction distinguishes the object.
- [`KC-ID-004 Alignment Identity`](KC-ID-004_Alignment_Identity.md) states the alignment-specific composition candidate.
- Network and relational semantics remain Research concepts and are not promoted by this entry.

## Consequences for Reference Implementation

- A single database or object key must not be assumed to encode the complete engineering identity.
- Object-type-specific identity handling should expose the aspects and relations used for distinction instead of relying on incidental serialized attributes.
- Existing IDs, element sequences, source links, and object relations are correspondence evidence; K1 does not define a storage schema for identity composition.

## Consequences for Thesis

- The Thesis should explain identity composition as object-type-specific and distinguish stable identity aspects from representation-dependent attributes.
- Examples must not silently elevate contextual placement, provenance, or a software key into universally mandatory identity components.

## Evidence and Origin

- Direct Research provenance: [`KC-FOUND-002 Identity Composition`](../research/FOUNDATIONS/KC-FOUND-002_Identity_Composition.md).
- Supporting Research: [`KC-FOUND-005 Network Identity`](../research/FOUNDATIONS/KC-FOUND-005_Network_Identity.md) and [`KC-FOUND-006 Relational Semantics`](../research/FOUNDATIONS/KC-FOUND-006_Relational_Semantics.md), used only to bound the possible role of relations.
- Research boundary evidence: [`KC-FOUND-008 Representation`](../research/FOUNDATIONS/KC-FOUND-008_Representation.md).
- RefImpl correspondence: [`AlignmentSpotObjectMapper.js`](../../../src/model/spot/model/AlignmentSpotObjectMapper.js) maintains an object ID while mapping editable data and derived content; this is not proof of the full composition.
- Thesis explanation: [`kernel/engineering_identity.tex`](../../thesis/AIM/kernel/engineering_identity.tex) and [`foundations/kernel_glossary.tex`](../../thesis/AIM/foundations/kernel_glossary.tex).

Identifier correspondence: `KC-FOUND-002` is direct Research provenance for `KC-ID-002`; no semantic conflict was found. K1 retains both identifier families in their existing locations.

## Open Decisions

- The mandatory identity aspects and canonical relations for object types other than Alignment remain evidence-missing and must be specified by their owning concepts rather than generalized here.
