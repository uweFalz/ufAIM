# KC-ID-003 Constructive Identity

## Status

`candidate`

## Canonical Question

Which identity aspect captures an engineering object's intrinsic constructive definition?

## Candidate Canonical Answer

Constructive Identity is the identity aspect determined by an engineering object's intrinsic constructive definition and composition before metric realization, representation, workflow, or project use.

## Normative Meaning

- Constructive Identity records what construction makes the engineering object distinguishable independently of how or where it is realized or represented.
- It may be composed from ordered parts, intrinsic laws, and constructive relations when these belong to the object's defining construction.
- Metric realization consumes or interprets constructive identity but does not own it.
- A change to a representation or project context does not by itself change constructive identity.

## Boundaries

- Constructive Identity is an aspect of Engineering Object Identity, not a synonym for the whole identity of every object.
- It is not measured coordinates, CRS embedding, sampled geometry, rendered geometry, exchange data, workflow state, or project context.
- “Constructive definition” names the intrinsic construction captured by this concept; K1 does not create a separate Kernel concept with that name.
- Derived runtime state may realize a construction without becoming its identity.

## Relations to Other Kernel Concepts

- Contributes to [`KC-ID-001 Engineering Object Identity`](KC-ID-001_Engineering_Object_Identity.md) through [`KC-ID-002 Identity Composition`](KC-ID-002_Identity_Composition.md).
- [`KC-ID-004 Alignment Identity`](KC-ID-004_Alignment_Identity.md) is an alignment-specific constructive identity candidate.
- Metric Realization and Representation are neighboring concepts but remain outside K1 and are not defined here.

## Consequences for Reference Implementation

- Constructive source information must remain distinguishable from derived geometry and presentation artifacts.
- Services may derive metric or runtime states from constructive information without transferring identity ownership to those products.
- `AlignmentData.editModel` and the derived sparse alignment are implementation correspondence only; their current class or field names do not define the canonical boundary.

## Consequences for Thesis

- The Thesis should explain constructive identity before metric embedding and distinguish it from data formats, sampled geometry, and operational use.
- Derivations from construction to metric or runtime state belong in Realization or explanatory sections, not in this canonical answer.

## Evidence and Origin

- Direct Research provenance: [`KC-FOUND-003 Constructive Identity`](../research/FOUNDATIONS/KC-FOUND-003_Constructive_Identity.md).
- Supporting Research boundaries: [`KC-FOUND-007 Metric Realization`](../research/FOUNDATIONS/KC-FOUND-007_Metric_Realization.md), [`KC-FOUND-008 Representation`](../research/FOUNDATIONS/KC-FOUND-008_Representation.md), and [`KC-FOUND-009 Workflow / Project Context`](../research/FOUNDATIONS/KC-FOUND-009_Workflow_Project_Context.md).
- Draft correspondence: [`PR-002 Metric Realization is not Identity`](../_draft/00-principles/PR-002-realization.md) and [`MetricRealizationService.md`](../_draft/20-services/MetricRealizationService.md); these are evidence, not active authority.
- Unresolved freeze evidence: [`FC-002`](../_draft/40-freezes/FC-002.md), consistent with the boundary but not treated as demonstrated approval.
- RefImpl correspondence: [`buildSparseAlignment.js`](../../../src/domain/alignment/editor/buildSparseAlignment.js) distinguishes editable source data from a derived sparse alignment.
- Thesis explanation: [`foundations/kernel_glossary.tex`](../../thesis/AIM/foundations/kernel_glossary.tex), [`kernel/engineering_objects.tex`](../../thesis/AIM/kernel/engineering_objects.tex), and [`reality/data.tex`](../../thesis/AIM/reality/data.tex).

Identifier correspondence: `KC-FOUND-003` is direct Research provenance for `KC-ID-003`; no semantic conflict was found.

## Open Decisions

- The exact constructive constituents are object-type-specific. This candidate intentionally does not define a universal constructive schema.
